import { createHash } from "node:crypto";

import {
  BindingConflictError,
  BindingCreateRejectedError,
  BindingEffectUncertainError,
  type BackendIdentityProvider,
  type BindingProviderRequest,
} from "./binding-provider.ts";
import { PrivateBindingRegistry } from "./binding-registry.ts";
import type {
  BackendIdentityBinding,
  BindingCredentialRefs,
  BindingRegistryEntry,
  BindingRequest,
} from "./binding-types.ts";
import {
  hashBindingRequest,
  prepareBindingRequest,
  validateProviderBinding,
} from "./binding-validation.ts";

type Clock = () => string;

function operationId(requestHash: string, idempotencyKey: string) {
  return createHash("sha256").update(`${requestHash}:${idempotencyKey}`).digest("hex");
}

export class BackendIdentityBindingController {
  private readonly registry: PrivateBindingRegistry;
  private readonly provider: BackendIdentityProvider;
  private readonly clock: Clock;

  constructor(
    registry: PrivateBindingRegistry,
    provider: BackendIdentityProvider,
    clock: Clock = () => new Date().toISOString(),
  ) {
    this.registry = registry;
    this.provider = provider;
    this.clock = clock;
  }

  async ensure(input: {
    manifest: unknown;
    sourceSha: string;
    credentialRefs: BindingCredentialRefs;
    idempotencyKey: string;
  }): Promise<BackendIdentityBinding> {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(input.idempotencyKey))
      throw new Error("INVALID_BINDING_IDEMPOTENCY_KEY");
    const request = prepareBindingRequest(input);
    const requestHash = hashBindingRequest(request);
    return this.registry.withClientLock(request.clientId, async () => {
      let entry = await this.registry.read(request.clientId);
      if (!entry) {
        const now = this.clock();
        entry = {
          schemaVersion: 1,
          clientId: request.clientId,
          request,
          requestHash,
          operationId: operationId(requestHash, input.idempotencyKey),
          idempotencyKey: input.idempotencyKey,
          state: "planned",
          attempts: 0,
          createdAt: now,
          updatedAt: now,
        };
        await this.registry.write(entry);
      } else {
        if (entry.requestHash !== requestHash) throw new Error("BINDING_REQUEST_MISMATCH");
        if (entry.idempotencyKey !== input.idempotencyKey) throw new Error("BINDING_REQUIRES_ORIGINAL_KEY");
        if (entry.state === "ready") return entry.binding!;
        if (entry.state === "failed" && entry.failure?.code !== "BINDING_CREATE_REJECTED")
          throw new BindingConflictError("A conflicting provider binding requires operator resolution");
      }
      return this.reconcileOrCreate(entry);
    });
  }

  private providerRequest(entry: BindingRegistryEntry): BindingProviderRequest {
    return {
      ...entry.request,
      operationId: entry.operationId,
      idempotencyKey: entry.idempotencyKey,
    };
  }

  private async reconcileOrCreate(entry: BindingRegistryEntry): Promise<BackendIdentityBinding> {
    const priorState = entry.state;
    const request = this.providerRequest(entry);
    let observation;
    try { observation = await this.provider.reconcileEnvironment(request); }
    catch { return this.uncertain(entry, "Provider inspection failed; operator reconciliation is required"); }
    if (observation.state === "owned") {
      let binding;
      try {
        binding = validateProviderBinding(
          observation.binding,
          entry.request,
          entry.operationId,
          this.clock(),
        );
      }
      catch { return this.conflict(entry, "Provider inspection does not match the dedicated synthetic client binding"); }
      return this.ready(entry, binding);
    }
    if (observation.state === "foreign")
      return this.conflict(entry, "Provider reports a binding owned by another client or environment");
    if (observation.state === "partial" || observation.state === "unknown")
      return this.uncertain(entry, "Provider could not establish one complete backend and identity binding");
    if (priorState === "pending" || priorState === "effect_uncertain")
      return this.uncertain(entry, "A prior environment create may have taken effect; inspect before retry");
    if (!observation.retrySafe)
      return this.uncertain(entry, "Provider absence is not authoritative; inspect before retry");

    entry.state = "pending";
    entry.attempts += 1;
    entry.updatedAt = this.clock();
    delete entry.failure;
    await this.registry.write(entry);
    try {
      await this.provider.createEnvironment(request);
      let createdObservation;
      try { createdObservation = await this.provider.reconcileEnvironment(request); }
      catch { return this.uncertain(entry, "Provider post-create inspection failed; inspect before retry"); }
      if (createdObservation.state !== "owned")
        return this.uncertain(entry, "Provider post-create inspection did not confirm one complete binding");
      let binding;
      try {
        binding = validateProviderBinding(
          createdObservation.binding,
          entry.request,
          entry.operationId,
          this.clock(),
        );
      } catch {
        return this.uncertain(entry, "Provider post-create inspection returned an invalid binding");
      }
      return this.ready(entry, binding);
    } catch (error) {
      if (!(error instanceof BindingCreateRejectedError))
        return this.uncertain(entry, "Provider create result is uncertain; inspect before retry");
      entry.state = "failed";
      entry.failure = {
        code: "BINDING_CREATE_REJECTED",
        message: "Provider rejected binding creation before a confirmed external effect",
      };
      entry.updatedAt = this.clock();
      await this.registry.write(entry);
      throw new Error("Provider rejected binding creation before a confirmed external effect");
    }
  }

  private async ready(entry: BindingRegistryEntry, binding: BackendIdentityBinding) {
    entry.state = "ready";
    entry.binding = binding;
    delete entry.failure;
    entry.updatedAt = this.clock();
    await this.registry.write(entry);
    return structuredClone(binding);
  }

  private async uncertain(entry: BindingRegistryEntry, message: string): Promise<never> {
    entry.state = "effect_uncertain";
    delete entry.binding;
    entry.failure = { code: "BINDING_EFFECT_UNCERTAIN", message };
    entry.updatedAt = this.clock();
    await this.registry.write(entry);
    throw new BindingEffectUncertainError(message);
  }

  private async conflict(entry: BindingRegistryEntry, message: string): Promise<never> {
    entry.state = "failed";
    delete entry.binding;
    entry.failure = { code: "BINDING_CONFLICT", message };
    entry.updatedAt = this.clock();
    await this.registry.write(entry);
    throw new BindingConflictError(message);
  }
}
