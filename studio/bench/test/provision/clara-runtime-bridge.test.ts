import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createClaraRuntimeBridge } from "../../src/provision/clara-runtime-bridge.ts";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import { AuthenticatedClaraRuntime } from "../../src/server/authenticated-runtime.ts";
import type { EnvironmentBinding, IdentityVerifier, VerifiedPrincipal } from "../../src/server/binding.ts";
import { PiDurableRuntimeAdapter } from "../../src/server/runtime-adapter.ts";

const principal: VerifiedPrincipal = {
  provider: "workos",
  subject: "user_synthetic_owner",
  environmentId: "environment_synthetic_c0001",
  audience: "client_syntheticc0001",
  issuer: "https://api.workos.com/user_management/client_syntheticc0001",
};
const binding: EnvironmentBinding = {
  schemaVersion: 1,
  clientId: "c0001",
  environmentId: principal.environmentId,
  backend: { provider: "convex", deploymentId: "synthetic-c0001-backend", url: "https://synthetic-c0001.convex.cloud" },
  identity: { provider: "workos", environmentId: principal.environmentId, audience: principal.audience, issuer: principal.issuer },
  provenance: { sourceSha: "a".repeat(40), source: "controller-inspection", observedAt: "2026-09-11T20:00:00.000Z" },
  status: "ready",
};

test("loopback bridge prepares, inspects and replays without caller client authority", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "studio-clara-bridge-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workflow = new PiWorkflowRuntime({ root });
  t.after(() => workflow.close());
  const durable = new PiDurableRuntimeAdapter(workflow, {
    clientId: binding.clientId,
    environmentId: binding.environmentId,
    backendDeploymentId: binding.backend.deploymentId,
  });
  const identity: IdentityVerifier = {
    provider: "workos",
    verify: async ({ authorization }) => {
      if (authorization !== "Bearer accepted.token.fixture") throw new Error("denied");
      return principal;
    },
  };
  const authenticated = new AuthenticatedClaraRuntime({
    policy: { mode: "hosted", environmentId: principal.environmentId, provider: "workos", audience: principal.audience, issuer: principal.issuer },
    identity,
    bindings: { resolveAuthorized: async (candidate) => candidate.subject === principal.subject ? binding : null },
    runtimeFor: () => durable,
  });
  const server = createClaraRuntimeBridge(authenticated);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const call = (body: unknown, authorization = "Bearer accepted.token.fixture") => fetch(`http://127.0.0.1:${address.port}/v1/clara`, {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const input = {
    schemaVersion: 1,
    period: { from: "2026-09-01", to: "2026-09-30" },
    sessions: [{ id: "session-1", clientId: "synthetic-person-1", date: "2026-09-11", attendance: "attended", rateMinor: 8000, rateRef: "synthetic-rate-v1" }],
  };
  const first = await call({ schemaVersion: 1, operation: "start", idempotencyKey: "c0001-clara-prepare-1", input });
  assert.equal(first.status, 200);
  const run = await first.json() as { runId: string; status: string };
  assert.equal(run.status, "succeeded");
  const replay = await call({ schemaVersion: 1, operation: "start", idempotencyKey: "c0001-clara-prepare-1", input });
  assert.equal((await replay.json() as { runId: string }).runId, run.runId);
  const draft = await call({ schemaVersion: 1, operation: "draft", runId: run.runId });
  assert.equal((await draft.json() as { clientId: string }).clientId, "c0001");
  assert.equal(workflow.store.db.prepare("SELECT count(*) value FROM effects").get()?.value, 1);

  const callerAuthority = await call({ schemaVersion: 1, operation: "start", idempotencyKey: "c0001-clara-prepare-2", input: { ...input, clientId: "c0002" } });
  assert.equal(callerAuthority.status, 400);
  const denied = await call({ schemaVersion: 1, operation: "run", runId: run.runId }, "Bearer denied.token.fixture");
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: "REQUEST_DENIED" });
});

test("minimal-guest installer keeps the runtime unprivileged and loopback-only", async () => {
  const script = await readFile(fileURLToPath(new URL("../../scripts/provision/install-clara-runtime.sh", import.meta.url)), "utf8");
  assert.match(script, /start-stop-daemon --start --background --make-pidfile/);
  assert.match(script, /--chuid studio-runtime:studio-runtime/);
  assert.match(script, /127\.0\.0\.1:\$PORT\/healthz/);
  assert.doesNotMatch(script, /0\.0\.0\.0/);
});
