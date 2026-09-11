import { createHash, randomUUID } from "node:crypto";
import { hashManifest, validateManifest } from "./manifest.ts";
import {
  ProviderCreateRejectedError,
  ProvisionCollisionError,
  ProvisionEffectUncertainError,
  type ProvisionProvider,
  type ResourceRequest,
} from "./provider.ts";
import { FileRegistry, RegistryIntegrityError } from "./registry.ts";
import {
  resourceKinds,
  type ProvisionManifest,
  type ProvisionPhase,
  type ProvisionPlan,
  type RegistryEntry,
  type ResourceKind,
} from "./types.ts";

type Clock = () => string;

function resourceKey(operationId: string, resource: ResourceKind) {
  return createHash("sha256")
    .update(`${operationId}:${resource}`)
    .digest("hex");
}

function phaseFor(resource: ResourceKind): ProvisionPhase {
  if (resource === "repository" || resource.endsWith("-vm")) return "allocating";
  return "configured";
}

function safeProviderId(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(value);
}

function safeSshDestination(value: string | undefined) {
  return (
    value === undefined ||
    /^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9][A-Za-z0-9.-]{1,252}(?::[0-9]{1,5})?$/.test(value)
  );
}

export class ProvisionController {
  private readonly registry: FileRegistry;
  private readonly provider: ProvisionProvider;
  private readonly clock: Clock;

  constructor(
    registry: FileRegistry,
    provider: ProvisionProvider,
    clock: Clock = () => new Date().toISOString(),
  ) {
    this.registry = registry;
    this.provider = provider;
    this.clock = clock;
  }

  plan(value: unknown): ProvisionPlan {
    const manifest = validateManifest(value);
    return {
      schemaVersion: 1,
      clientId: manifest.clientId,
      manifestHash: hashManifest(manifest),
      resourceOrder: resourceKinds,
      operations: resourceKinds.map((resource) => ({
        resource,
        action: "reconcile-then-create",
      })),
    };
  }

  async provision(value: unknown, idempotencyKey: string): Promise<RegistryEntry> {
    const manifest = validateManifest(value);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey))
      throw new RegistryIntegrityError("Provision idempotency key has an invalid format");
    const manifestHash = hashManifest(manifest);
    return this.registry.withClientLock(manifest.clientId, async () => {
      let entry = await this.registry.read(manifest.clientId);
      if (!entry) {
        entry = this.newEntry(manifest, manifestHash, idempotencyKey);
        await this.registry.write(entry);
      } else {
        if (entry.manifestHash !== manifestHash)
          throw new RegistryIntegrityError(
            `Client ${manifest.clientId} already has a different manifest`,
          );
        if (entry.idempotencyKey !== idempotencyKey)
          throw new RegistryIntegrityError(
            `Resume ${manifest.clientId} with its original idempotency key`,
          );
        if (entry.status === "ready") return entry;
      }

      for (const resource of resourceKinds) {
        if (entry.resources[resource].state === "confirmed") continue;
        entry = await this.reconcileOrCreate(entry, resource);
      }
      entry.phase = "ready";
      entry.status = "ready";
      entry.updatedAt = this.clock();
      delete entry.failure;
      await this.registry.write(entry);
      return entry;
    });
  }

  private newEntry(
    manifest: ProvisionManifest,
    manifestHash: string,
    idempotencyKey: string,
  ): RegistryEntry {
    const now = this.clock();
    const operationId = randomUUID();
    return {
      schemaVersion: 1,
      clientId: manifest.clientId,
      manifest,
      manifestHash,
      operationId,
      idempotencyKey,
      phase: "planned",
      status: "in_progress",
      resources: Object.fromEntries(
        resourceKinds.map((kind) => [
          kind,
          {
            kind,
            state: "planned",
            idempotencyKey: resourceKey(operationId, kind),
            attempts: 0,
            updatedAt: now,
          },
        ]),
      ) as RegistryEntry["resources"],
      createdAt: now,
      updatedAt: now,
    };
  }

  private request(entry: RegistryEntry, resource: ResourceKind): ResourceRequest {
    return {
      clientId: entry.clientId,
      manifestHash: entry.manifestHash,
      manifest: entry.manifest,
      resource,
      idempotencyKey: entry.resources[resource].idempotencyKey,
    };
  }

  private async reconcileOrCreate(
    entry: RegistryEntry,
    resource: ResourceKind,
  ): Promise<RegistryEntry> {
    const receipt = entry.resources[resource];
    const priorState = receipt.state;
    entry.phase = phaseFor(resource);
    entry.status = "in_progress";
    entry.updatedAt = this.clock();
    delete entry.failure;
    await this.registry.write(entry);

    const request = this.request(entry, resource);
    let observed;
    try {
      observed = await this.provider.reconcileResource(request);
    } catch {
      return this.markUncertain(
        entry,
        resource,
        "Provider reconciliation failed; operator inspection is required",
      );
    }
    if (observed.state === "owned") {
      if (!safeProviderId(observed.externalId) || !safeSshDestination(observed.sshDest))
        return this.markUncertain(
          entry,
          resource,
          "Provider returned an invalid resource identity; operator inspection is required",
        );
      receipt.state = "confirmed";
      receipt.externalId = observed.externalId;
      if (observed.sshDest) receipt.sshDest = observed.sshDest;
      else delete receipt.sshDest;
      receipt.detail = "Reconciled provider-owned resource";
      receipt.updatedAt = this.clock();
      await this.registry.write(entry);
      return entry;
    }
    if (observed.state === "foreign") {
      receipt.state = "failed";
      receipt.detail = "Provider reports a resource owned by another scope";
      receipt.updatedAt = this.clock();
      entry.phase = "failed";
      entry.status = "failed";
      entry.failure = {
        resource,
        code: "RESOURCE_OWNERSHIP_CONFLICT",
        message: "Provider reports a resource owned by another scope",
      };
      entry.updatedAt = this.clock();
      await this.registry.write(entry);
      throw new ProvisionCollisionError(
        resource,
        "Provider reports a resource owned by another scope",
      );
    }
    if (observed.state === "unknown")
      return this.markUncertain(
        entry,
        resource,
        "Provider could not determine current resource state",
      );
    if (priorState === "pending" || priorState === "uncertain")
      return this.markUncertain(
        entry,
        resource,
        "A prior create may have taken effect; operator reconciliation is required",
      );
    if (!observed.retrySafe)
      return this.markUncertain(
        entry,
        resource,
        "Provider absence is not authoritative; operator reconciliation is required",
      );

    receipt.state = "pending";
    receipt.attempts += 1;
    delete receipt.detail;
    receipt.updatedAt = this.clock();
    entry.updatedAt = this.clock();
    await this.registry.write(entry);
    try {
      const created = await this.provider.createResource(request);
      if (!safeProviderId(created.externalId) || !safeSshDestination(created.sshDest))
        throw new Error("Provider returned an invalid resource identity");
      receipt.state = "confirmed";
      receipt.externalId = created.externalId;
      if (created.sshDest) receipt.sshDest = created.sshDest;
      else delete receipt.sshDest;
      receipt.updatedAt = this.clock();
      await this.registry.write(entry);
      return entry;
    } catch (error) {
      if (!(error instanceof ProviderCreateRejectedError))
        return this.markUncertain(
          entry,
          resource,
          "Provider create result is uncertain; reconcile before retry",
        );
      receipt.state = "failed";
      receipt.detail = "Provider rejected resource creation before a confirmed effect";
      receipt.updatedAt = this.clock();
      entry.phase = "failed";
      entry.status = "failed";
      entry.failure = {
        resource,
        code: "PROVIDER_CREATE_FAILED",
        message: "Provider rejected resource creation before a confirmed effect",
      };
      entry.updatedAt = this.clock();
      await this.registry.write(entry);
      throw new Error("Provider rejected resource creation before a confirmed effect");
    }
  }

  private async markUncertain(
    entry: RegistryEntry,
    resource: ResourceKind,
    detail: string,
  ): Promise<never> {
    const receipt = entry.resources[resource];
    receipt.state = "uncertain";
    receipt.detail = detail;
    receipt.updatedAt = this.clock();
    entry.status = "effect_uncertain";
    entry.failure = {
      resource,
      code: "PROVIDER_EFFECT_UNCERTAIN",
      message: detail,
    };
    entry.updatedAt = this.clock();
    await this.registry.write(entry);
    throw new ProvisionEffectUncertainError(resource, detail);
  }
}
