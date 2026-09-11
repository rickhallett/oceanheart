import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import type { ClaraAdaptationRuntimeController } from "../../src/adaptation/runtime-controller.ts";
import { AuthenticatedClaraRuntime, AuthenticatedRuntimeError } from "../../src/server/authenticated-runtime.ts";
import type { EnvironmentBinding, EnvironmentBindingRegistry, IdentityVerifier, VerifiedPrincipal } from "../../src/server/binding.ts";
import { PiDurableRuntimeAdapter } from "../../src/server/runtime-adapter.ts";

const sourceSha = "a".repeat(40);
const issuer = "https://identity.synthetic.invalid";
const audience = "studio-bench-synthetic";

function binding(clientId: string, environmentId: string): EnvironmentBinding {
  return {
    schemaVersion: 1,
    clientId,
    environmentId,
    backend: { provider: "synthetic-test", deploymentId: `backend-${clientId}`, url: `synthetic://${clientId}/backend` },
    identity: { provider: "synthetic-test", environmentId, audience, issuer },
    provenance: { sourceSha, source: "synthetic-test", observedAt: "2026-09-11T16:00:00.000Z" },
    status: "ready",
  };
}

class TestIdentity implements IdentityVerifier {
  readonly provider = "synthetic-test" as const;
  private readonly identities: Record<string, VerifiedPrincipal>;
  constructor(identities: Record<string, VerifiedPrincipal>) { this.identities = identities; }
  async verify({ authorization }: { authorization: string | undefined }) {
    if (!authorization || !this.identities[authorization]) throw new Error("invalid synthetic identity");
    return this.identities[authorization]!;
  }
}

class TestRegistry implements EnvironmentBindingRegistry {
  private readonly entries: Record<string, EnvironmentBinding>;
  constructor(entries: Record<string, EnvironmentBinding>) { this.entries = entries; }
  async resolveAuthorized(principal: VerifiedPrincipal) { return this.entries[principal.subject] ?? null; }
}

const principal = (subject: string, environmentId: string, overrides: Partial<VerifiedPrincipal> = {}): VerifiedPrincipal => ({
  provider: "synthetic-test", subject, environmentId, audience, issuer, ...overrides,
});

const input = {
  schemaVersion: 1 as const,
  period: { from: "2026-09-01", to: "2026-09-30" },
  sessions: [{ id: "session-1", clientId: "person-1", date: "2026-09-01", attendance: "attended" as const, rateMinor: 8000, rateRef: "agreement-v1" }],
};

function errorCode(error: unknown) {
  assert.ok(error instanceof AuthenticatedRuntimeError);
  return error.code;
}

test("verified identity starts one durable Clara effect and owns authenticated reads", async () => {
  const root = mkdtempSync(join(tmpdir(), "bench-auth-runtime-"));
  const runtime = new PiWorkflowRuntime({ root });
  const clientBinding = binding("c0001", "env-clara");
  const adapter = new PiDurableRuntimeAdapter(runtime, { clientId: "c0001", environmentId: "env-clara", backendDeploymentId: clientBinding.backend.deploymentId });
  const server = new AuthenticatedClaraRuntime({
    policy: { mode: "synthetic-test", environmentId: "env-clara", provider: "synthetic-test", audience, issuer },
    identity: new TestIdentity({ "Bearer owner-a": principal("owner-a", "env-clara") }),
    bindings: new TestRegistry({ "owner-a": clientBinding }),
    runtimeFor: (candidate) => candidate.clientId === "c0001" ? adapter : null,
  });
  try {
    const supplied = { ...input, clientId: "c9999" } as typeof input & { clientId: string };
    const first = await server.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-001", input: supplied });
    const replay = await server.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-001", input: supplied });
    assert.equal(replay.runId, first.runId);
    await assert.rejects(
      server.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-001", input: { ...input, sessions: [] } }),
      (error) => errorCode(error) === "REQUEST_CONFLICT",
    );
    assert.equal(runtime.store.db.prepare("SELECT count(*) AS n FROM effects").get()?.n, 1);
    assert.equal((await server.inspectRun("Bearer owner-a", first.runId)).status, "succeeded");
    assert.equal((await server.inspectDraft("Bearer owner-a", first.runId)).clientId, "c0001");
    const trace = await server.inspectTrace("Bearer owner-a", first.runId);
    assert.doesNotMatch(JSON.stringify(trace), /owner-a|Bearer|c9999/);
  } finally { runtime.close(); rmSync(root, { recursive: true, force: true }); }
});

test("authenticated start preserves the controller's exact active release identity", async () => {
  const root = mkdtempSync(join(tmpdir(), "bench-auth-release-"));
  const runtime = new PiWorkflowRuntime({ root });
  const clientBinding = binding("c0001", "env-clara");
  const adapter = new PiDurableRuntimeAdapter(runtime, { clientId: "c0001", environmentId: "env-clara", backendDeploymentId: clientBinding.backend.deploymentId });
  const releaseId = "a".repeat(64);
  const adaptation = {
    prepare: async (trustedInput: typeof input) => ({
      input: { ...trustedInput, sessions: trustedInput.sessions.map((session) => ({ ...session, rateMinor: 9000 })) },
      idempotencyKey: `request-release-${releaseId}`,
      configurationVersion: "clara-rate-90",
      configurationReleaseId: releaseId,
    }),
  } as unknown as ClaraAdaptationRuntimeController;
  const server = new AuthenticatedClaraRuntime({
    policy: { mode: "synthetic-test", environmentId: "env-clara", provider: "synthetic-test", audience, issuer },
    identity: new TestIdentity({ "Bearer owner-a": principal("owner-a", "env-clara") }),
    bindings: new TestRegistry({ "owner-a": clientBinding }),
    runtimeFor: () => adapter,
    adaptation,
  });
  try {
    const started = await server.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-base", input });
    const stored = runtime.store.get("c0001", started.runId);
    assert.equal(stored.request.configurationReleaseId, releaseId);
    assert.equal(stored.request.configurationVersion, "clara-rate-90");
    assert.equal(stored.result?.totalMinor, 9000);
  } finally { runtime.close(); rmSync(root, { recursive: true, force: true }); }
});

test("authorization rejects no identity, wrong environment/audience, and another actor", async () => {
  const root = mkdtempSync(join(tmpdir(), "bench-auth-denial-"));
  const runtime = new PiWorkflowRuntime({ root });
  const clientBinding = binding("c0001", "env-clara");
  const adapter = new PiDurableRuntimeAdapter(runtime, { clientId: "c0001", environmentId: "env-clara", backendDeploymentId: clientBinding.backend.deploymentId });
  const server = new AuthenticatedClaraRuntime({
    policy: { mode: "synthetic-test", environmentId: "env-clara", provider: "synthetic-test", audience, issuer },
    identity: new TestIdentity({
      "Bearer owner-a": principal("owner-a", "env-clara"),
      "Bearer teammate-a": principal("teammate-a", "env-clara"),
      "Bearer wrong-env": principal("owner-a", "env-other"),
      "Bearer wrong-aud": principal("owner-a", "env-clara", { audience: "other-audience" }),
      "Bearer wrong-issuer": principal("owner-a", "env-clara", { issuer: "https://other.synthetic.invalid" }),
    }),
    bindings: new TestRegistry({ "owner-a": clientBinding, "teammate-a": clientBinding }),
    runtimeFor: () => adapter,
  });
  try {
    const started = await server.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-001", input });
    await assert.rejects(server.startClara({ idempotencyKey: "request-002", input }), (error) => errorCode(error) === "REQUEST_DENIED");
    await assert.rejects(server.startClara({ authorization: "Bearer wrong-env", idempotencyKey: "request-003", input }), (error) => errorCode(error) === "REQUEST_DENIED");
    await assert.rejects(server.startClara({ authorization: "Bearer wrong-aud", idempotencyKey: "request-004", input }), (error) => errorCode(error) === "REQUEST_DENIED");
    await assert.rejects(server.startClara({ authorization: "Bearer wrong-issuer", idempotencyKey: "request-005", input }), (error) => errorCode(error) === "REQUEST_DENIED");
    await assert.rejects(server.inspectRun("Bearer teammate-a", started.runId), (error) => errorCode(error) === "REQUEST_DENIED");
    await assert.rejects(server.inspectDraft(undefined, started.runId), (error) => errorCode(error) === "REQUEST_DENIED");
    await assert.rejects(server.inspectTrace("Bearer wrong-env", started.runId), (error) => errorCode(error) === "REQUEST_DENIED");
  } finally { runtime.close(); rmSync(root, { recursive: true, force: true }); }
});

test("client A cannot read or select client B and an unavailable binding fails closed", async () => {
  const rootA = mkdtempSync(join(tmpdir(), "bench-auth-a-"));
  const rootB = mkdtempSync(join(tmpdir(), "bench-auth-b-"));
  const runtimeA = new PiWorkflowRuntime({ root: rootA });
  const runtimeB = new PiWorkflowRuntime({ root: rootB });
  const bindings = { "owner-a": binding("c0001", "env-a"), "owner-b": binding("c0002", "env-b") };
  const adapterA = new PiDurableRuntimeAdapter(runtimeA, { clientId: "c0001", environmentId: "env-a", backendDeploymentId: bindings["owner-a"].backend.deploymentId });
  const adapterB = new PiDurableRuntimeAdapter(runtimeB, { clientId: "c0002", environmentId: "env-b", backendDeploymentId: bindings["owner-b"].backend.deploymentId });
  const identities = new TestIdentity({ "Bearer owner-a": principal("owner-a", "env-a"), "Bearer owner-b": principal("owner-b", "env-b") });
  const make = (environmentId: "env-a" | "env-b", adapter: PiDurableRuntimeAdapter) => new AuthenticatedClaraRuntime({
    policy: { mode: "synthetic-test", environmentId, provider: "synthetic-test", audience, issuer },
    identity: identities,
    bindings: new TestRegistry(bindings),
    runtimeFor: (candidate) => candidate.environmentId === environmentId ? adapter : null,
  });
  const serverA = make("env-a", adapterA);
  const serverB = make("env-b", adapterB);
  try {
    const runA = await serverA.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-a", input });
    await assert.rejects(serverA.startClara({ authorization: "Bearer owner-b", idempotencyKey: "request-cross", input }), (error) => errorCode(error) === "REQUEST_DENIED");
    await assert.rejects(serverB.inspectRun("Bearer owner-b", runA.runId), (error) => errorCode(error) === "REQUEST_DENIED");
    const malicious = { ...input, clientId: "c0001" } as typeof input & { clientId: string };
    const runB = await serverB.startClara({ authorization: "Bearer owner-b", idempotencyKey: "request-b", input: malicious });
    assert.equal((await serverB.inspectDraft("Bearer owner-b", runB.runId)).clientId, "c0002");
    assert.equal(runtimeA.store.db.prepare("SELECT count(*) AS n FROM effects").get()?.n, 1);
    assert.equal(runtimeB.store.db.prepare("SELECT count(*) AS n FROM effects").get()?.n, 1);
    const unavailable = new AuthenticatedClaraRuntime({
      policy: { mode: "synthetic-test", environmentId: "env-a", provider: "synthetic-test", audience, issuer },
      identity: identities, bindings: new TestRegistry(bindings), runtimeFor: () => null,
    });
    await assert.rejects(unavailable.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-unavailable", input }), (error) => errorCode(error) === "SERVICE_UNAVAILABLE");
    const misbound = new AuthenticatedClaraRuntime({
      policy: { mode: "synthetic-test", environmentId: "env-a", provider: "synthetic-test", audience, issuer },
      identity: identities, bindings: new TestRegistry(bindings), runtimeFor: () => adapterB,
    });
    await assert.rejects(misbound.startClara({ authorization: "Bearer owner-a", idempotencyKey: "request-misbound", input }), (error) => errorCode(error) === "SERVICE_UNAVAILABLE");
  } finally {
    runtimeA.close(); runtimeB.close();
    rmSync(rootA, { recursive: true, force: true }); rmSync(rootB, { recursive: true, force: true });
  }
});

test("synthetic identity and backend contracts cannot initialize hosted mode", () => {
  assert.throws(() => new AuthenticatedClaraRuntime({
    policy: { mode: "hosted", environmentId: "env-hosted", provider: "synthetic-test", audience, issuer },
    identity: new TestIdentity({}), bindings: new TestRegistry({}), runtimeFor: () => null,
  }), /TEST_IDENTITY_FORBIDDEN/);
});
