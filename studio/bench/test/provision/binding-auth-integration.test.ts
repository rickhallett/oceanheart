import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { BackendIdentityBindingController } from "../../src/provision/binding-controller.ts";
import type {
  BackendIdentityProvider,
  BindingProviderRequest,
} from "../../src/provision/binding-provider.ts";
import { PrivateBindingRegistry } from "../../src/provision/binding-registry.ts";
import { SubjectBindingResolver } from "../../src/provision/binding-resolver.ts";
import { ControllerBindingRegistryAdapter } from "../../src/provision/server-binding-adapter.ts";
import type { ProviderEnvironmentBinding } from "../../src/provision/binding-types.ts";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import {
  AuthenticatedClaraRuntime,
  AuthenticatedRuntimeError,
} from "../../src/server/authenticated-runtime.ts";
import type { IdentityVerifier, VerifiedPrincipal } from "../../src/server/binding.ts";
import { PiDurableRuntimeAdapter } from "../../src/server/runtime-adapter.ts";
import { validManifest } from "./fixture.ts";

const issuer = "https://api.workos.com/";

function observed(clientId: string): ProviderEnvironmentBinding {
  const environmentId = `environment_synthetic_${clientId}`;
  return {
    environmentId,
    classification: "synthetic",
    isolation: "dedicated",
    attestedClientId: clientId,
    backend: {
      provider: "convex",
      deploymentId: `synthetic-${clientId}-backend`,
      url: `https://synthetic-${clientId}.convex.cloud`,
    },
    identity: {
      provider: "workos",
      environmentId,
      issuer,
      audience: `client_synthetic${clientId}`,
    },
  };
}

class InspectedProvider implements BackendIdentityProvider {
  readonly name = "synthetic-inspection";
  readonly environments = new Map<string, ProviderEnvironmentBinding>();
  creates = 0;

  async reconcileEnvironment(request: BindingProviderRequest) {
    const binding = this.environments.get(request.clientId);
    return binding
      ? { state: "owned" as const, binding }
      : { state: "absent" as const, retrySafe: true };
  }

  async createEnvironment(request: BindingProviderRequest) {
    this.creates += 1;
    const binding = observed(request.clientId);
    this.environments.set(request.clientId, binding);
    return binding;
  }
}

class VerifiedTestIdentity implements IdentityVerifier {
  readonly provider = "workos" as const;
  private readonly principals: Record<string, VerifiedPrincipal>;

  constructor(principals: Record<string, VerifiedPrincipal>) {
    this.principals = principals;
  }

  async verify({ authorization }: { authorization: string | undefined }) {
    if (!authorization || !this.principals[authorization]) throw new Error("invalid token fixture");
    return this.principals[authorization]!;
  }
}

test("controller registry authorizes one durable run/replay and denies the other client", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "studio-binding-auth-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const provider = new InspectedProvider();
  const registry = new PrivateBindingRegistry(join(root, "bindings"));
  const controller = new BackendIdentityBindingController(
    registry,
    provider,
    () => "2026-09-11T18:00:00.000Z",
  );
  const ensure = (clientId: string) => controller.ensure({
    manifest: validManifest(clientId),
    sourceSha: "a".repeat(40),
    credentialRefs: {
      backend: `secretref://${clientId}/controller/convex`,
      identity: `secretref://${clientId}/controller/workos`,
    },
    idempotencyKey: `binding:${clientId}:integration`,
  });
  const [bindingA, bindingB] = await Promise.all([ensure("c0001"), ensure("c0002")]);
  assert.equal(provider.creates, 2);

  const ownerA = {
    provider: "workos" as const,
    subject: "user_synthetic_a",
    environmentId: bindingA.environmentId,
    audience: bindingA.identity.audience,
    issuer,
  };
  const ownerB = {
    provider: "workos" as const,
    subject: "user_synthetic_b",
    environmentId: bindingB.environmentId,
    audience: bindingB.identity.audience,
    issuer,
  };
  const bindings = new ControllerBindingRegistryAdapter(new SubjectBindingResolver({
    bindings: [bindingA, bindingB],
    authorizations: [
      { ...ownerA, clientId: bindingA.clientId },
      { ...ownerB, clientId: bindingB.clientId },
    ],
  }));
  const runtime = new PiWorkflowRuntime({ root: join(root, "runtime-a") });
  const durable = new PiDurableRuntimeAdapter(runtime, {
    clientId: bindingA.clientId,
    environmentId: bindingA.environmentId,
    backendDeploymentId: bindingA.backend.deploymentId,
  });
  const server = new AuthenticatedClaraRuntime({
    policy: {
      mode: "hosted",
      environmentId: bindingA.environmentId,
      provider: "workos",
      audience: bindingA.identity.audience,
      issuer,
    },
    identity: new VerifiedTestIdentity({ "Bearer owner-a": ownerA, "Bearer owner-b": ownerB }),
    bindings,
    runtimeFor: (binding) => binding.clientId === bindingA.clientId ? durable : null,
  });
  const input = {
    schemaVersion: 1 as const,
    period: { from: "2026-09-01", to: "2026-09-30" },
    sessions: [{
      id: "session-1",
      clientId: "person-1",
      date: "2026-09-11",
      attendance: "attended" as const,
      rateMinor: 8000,
      rateRef: "synthetic-agreement-v1",
    }],
  };
  try {
    const malicious = { ...input, clientId: "c0002" } as typeof input & { clientId: string };
    const first = await server.startClara({
      authorization: "Bearer owner-a",
      idempotencyKey: "binding-auth-request-1",
      input: malicious,
    });
    const replay = await server.startClara({
      authorization: "Bearer owner-a",
      idempotencyKey: "binding-auth-request-1",
      input: malicious,
    });
    assert.equal(replay.runId, first.runId);
    assert.equal((await server.inspectDraft("Bearer owner-a", first.runId)).clientId, "c0001");
    assert.equal(runtime.store.db.prepare("SELECT count(*) value FROM effects").get()?.value, 1);
    await assert.rejects(
      server.startClara({
        authorization: "Bearer owner-b",
        idempotencyKey: "binding-auth-cross-client",
        input,
      }),
      (error) => error instanceof AuthenticatedRuntimeError && error.code === "REQUEST_DENIED",
    );
    await assert.rejects(
      server.inspectRun("Bearer owner-b", first.runId),
      (error) => error instanceof AuthenticatedRuntimeError && error.code === "REQUEST_DENIED",
    );
  } finally {
    runtime.close();
  }
});
