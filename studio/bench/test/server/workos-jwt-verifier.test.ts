import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from "jose";

import { SubjectBindingResolver } from "../../src/provision/binding-resolver.ts";
import { ControllerBindingRegistryAdapter } from "../../src/provision/server-binding-adapter.ts";
import type { BackendIdentityBinding } from "../../src/provision/binding-types.ts";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import { AuthenticatedClaraRuntime, AuthenticatedRuntimeError } from "../../src/server/authenticated-runtime.ts";
import { PiDurableRuntimeAdapter } from "../../src/server/runtime-adapter.ts";
import {
  WorkOsJwtIdentityVerifier,
  type JwksNetworkAdapter,
  type WorkOsSessionStatusAdapter,
} from "../../src/server/workos-jwt-verifier.ts";

const issuer = "https://api.workos.com/";
const audienceA = "client_syntheticc0001";
const audienceB = "client_syntheticc0002";
const environmentA = "environment_synthetic_c0001";
const environmentB = "environment_synthetic_c0002";

function binding(clientId: "c0001" | "c0002", environmentId: string, audience: string): BackendIdentityBinding {
  return {
    schemaVersion: 1,
    clientId,
    environmentId,
    mode: "synthetic",
    scope: "dedicated",
    backend: { provider: "convex", deploymentId: `synthetic-${clientId}-backend`, url: `https://synthetic-${clientId}.convex.cloud/` },
    identity: { provider: "workos", environmentId, issuer, audience },
    provenance: {
      manifestHash: "b".repeat(64), sourceSha: "a".repeat(40), operationId: "c".repeat(64),
      source: "controller-inspection", observedAt: "2026-09-11T18:30:00.000Z",
    },
    status: "ready",
    credentialRefs: {
      backend: `secretref://${clientId}/controller/convex`,
      identity: `secretref://${clientId}/controller/workos`,
    },
  };
}

async function signingKey(kid: string) {
  const pair = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
  const jwk = await exportJWK(pair.publicKey);
  return { privateKey: pair.privateKey, publicJwk: { ...jwk, kid, alg: "RS256", use: "sig" } as JWK };
}

async function token(input: {
  key: KeyLike | Uint8Array;
  kid: string;
  subject?: string;
  sessionId?: string;
  issuer?: string;
  clientId?: string;
  audienceClaim?: string;
  tokenType?: string;
  expiresAt?: number;
  algorithm?: "RS256" | "HS256";
}) {
  const now = Math.floor(Date.now() / 1000);
  const token = new SignJWT({
    sid: input.sessionId ?? "session_synthetic_a",
    client_id: input.clientId ?? audienceA,
  })
    .setProtectedHeader({ alg: input.algorithm ?? "RS256", kid: input.kid, typ: input.tokenType ?? "at+jwt" })
    .setSubject(input.subject ?? "user_synthetic_a")
    .setIssuer(input.issuer ?? "https://api.workos.com")
    .setIssuedAt(now)
    .setExpirationTime(input.expiresAt ?? now + 300);
  if (input.audienceClaim !== undefined) token.setAudience(input.audienceClaim);
  return token.sign(input.key);
}

async function localJwksServer(current: { value: { keys: JWK[] } }) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(current.value));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}/jwks` };
}

class LoopbackJwksNetwork implements JwksNetworkAdapter {
  private readonly loopbackUrl: string;
  calls = 0;
  constructor(loopbackUrl: string) {
    this.loopbackUrl = loopbackUrl;
  }
  async fetch(_configuredUrl: URL, signal: AbortSignal) {
    this.calls += 1;
    const response = await fetch(this.loopbackUrl, { signal, redirect: "error" });
    if (!response.ok) throw new Error("fixture jwks unavailable");
    return response.json();
  }
}

class SessionStatus implements WorkOsSessionStatusAdapter {
  readonly active = new Set(["session_synthetic_a"]);
  async isActive({ sessionId }: { sessionId: string }) { return this.active.has(sessionId); }
}

function verifier(network: JwksNetworkAdapter, sessionStatus?: WorkOsSessionStatusAdapter) {
  return new WorkOsJwtIdentityVerifier({
    environmentId: environmentA,
    audience: audienceA,
    issuer,
    jwksUrl: `https://api.workos.com/sso/jwks/${audienceA}`,
    network,
    sessionStatus,
    timeoutMs: 500,
    cacheTtlMs: 60_000,
  });
}

function denied(error: unknown) {
  return error instanceof AuthenticatedRuntimeError && error.code === "REQUEST_DENIED";
}

test("signed WorkOS-shaped session drives bound durable Clara start/replay/read and revocation", async (t) => {
  const key = await signingKey("workos-test-key-a");
  const jwks = { value: { keys: [key.publicJwk] } };
  const endpoint = await localJwksServer(jwks);
  t.after(() => new Promise<void>((resolve) => endpoint.server.close(() => resolve())));
  const network = new LoopbackJwksNetwork(endpoint.url);
  const sessions = new SessionStatus();
  const identity = verifier(network, sessions);
  const bindingA = binding("c0001", environmentA, audienceA);
  const bindingB = binding("c0002", environmentB, audienceB);
  const bindings = new ControllerBindingRegistryAdapter(new SubjectBindingResolver({
    bindings: [bindingA, bindingB],
    authorizations: [
      { subject: "user_synthetic_a", issuer, audience: audienceA, clientId: "c0001", environmentId: environmentA },
      { subject: "user_synthetic_b", issuer, audience: audienceB, clientId: "c0002", environmentId: environmentB },
    ],
  }));
  const root = mkdtempSync(join(tmpdir(), "workos-bound-runtime-"));
  const pi = new PiWorkflowRuntime({ root });
  t.after(() => { pi.close(); rmSync(root, { recursive: true, force: true }); });
  const runtime = new PiDurableRuntimeAdapter(pi, {
    clientId: "c0001", environmentId: environmentA, backendDeploymentId: bindingA.backend.deploymentId,
  });
  const server = new AuthenticatedClaraRuntime({
    policy: { mode: "hosted", environmentId: environmentA, provider: "workos", audience: audienceA, issuer },
    identity,
    bindings,
    runtimeFor: (resolved) => resolved.clientId === "c0001" ? runtime : null,
  });
  const input = {
    schemaVersion: 1 as const,
    clientId: "c0002",
    period: { from: "2026-09-01", to: "2026-09-30" },
    sessions: [{ id: "session-1", clientId: "person-1", date: "2026-09-11", attendance: "attended" as const, rateMinor: 8000, rateRef: "synthetic-agreement-v1" }],
  };
  const accessToken = await token({ key: key.privateKey, kid: "workos-test-key-a" });
  const authorization = `Bearer ${accessToken}`;

  await assert.rejects(server.startClara({ idempotencyKey: "workos-request-authless", input }), denied);
  await assert.rejects(server.startClara({ authorization: "Bearer malformed.jwt.value", idempotencyKey: "workos-request-malformed", input }), denied);
  assert.equal(pi.store.db.prepare("SELECT count(*) value FROM effects").get()?.value, 0);

  const first = await server.startClara({ authorization, idempotencyKey: "workos-request-001", input });
  const replay = await server.startClara({ authorization, idempotencyKey: "workos-request-001", input });
  assert.equal(replay.runId, first.runId);
  assert.equal((await server.inspectDraft(authorization, first.runId)).clientId, "c0001");
  assert.equal((await server.inspectRun(authorization, first.runId)).inspectPath, `runs/${first.runId}`);
  assert.doesNotMatch(JSON.stringify(await server.inspectTrace(authorization, first.runId)), /user_synthetic_a|session_synthetic_a|Bearer/);
  assert.equal(pi.store.db.prepare("SELECT count(*) value FROM effects").get()?.value, 1);

  const otherBoundIdentity = await token({ key: key.privateKey, kid: "workos-test-key-a", subject: "user_synthetic_b" });
  await assert.rejects(server.inspectRun(`Bearer ${otherBoundIdentity}`, first.runId), denied);
  sessions.active.delete("session_synthetic_a");
  await assert.rejects(server.inspectDraft(authorization, first.runId), denied);
  assert.equal(pi.store.db.prepare("SELECT count(*) value FROM effects").get()?.value, 1);
  assert.equal(network.calls, 1);
});

test("jose verification rejects claim, expiry, algorithm and signature confusion and refreshes a rotated kid", async (t) => {
  const [first, second, impostor] = await Promise.all([
    signingKey("workos-key-1"), signingKey("workos-key-2"), signingKey("workos-key-2"),
  ]);
  const current = { value: { keys: [first.publicJwk] } };
  const endpoint = await localJwksServer(current);
  t.after(() => new Promise<void>((resolve) => endpoint.server.close(() => resolve())));
  const network = new LoopbackJwksNetwork(endpoint.url);
  const diagnostics: string[] = [];
  const identity = new WorkOsJwtIdentityVerifier({
    environmentId: environmentA,
    audience: audienceA,
    issuer,
    jwksUrl: `https://api.workos.com/sso/jwks/${audienceA}`,
    network,
    diagnostic: (code) => diagnostics.push(code),
    timeoutMs: 500,
    cacheTtlMs: 60_000,
  });
  const expected = { environmentId: environmentA, audience: audienceA, issuer };
  const verifyToken = (value: string, overrides: Partial<typeof expected> = {}) => identity.verify({ authorization: `Bearer ${value}`, ...expected, ...overrides });
  const now = Math.floor(Date.now() / 1000);

  await assert.rejects(verifyToken(await token({ key: first.privateKey, kid: "workos-key-1", issuer: "https://wrong.invalid/" })));
  await assert.rejects(verifyToken(await token({ key: first.privateKey, kid: "workos-key-1", clientId: audienceB })));
  await assert.rejects(verifyToken(await token({ key: first.privateKey, kid: "workos-key-1", audienceClaim: audienceB })));
  await assert.rejects(verifyToken(await token({ key: first.privateKey, kid: "workos-key-1", tokenType: "unsupported+jwt" })));
  await assert.rejects(verifyToken(await token({ key: first.privateKey, kid: "workos-key-1", expiresAt: now - 30 })));
  await assert.rejects(verifyToken(await token({ key: new TextEncoder().encode("test-only-symmetric-key-material-32"), kid: "workos-key-1", algorithm: "HS256" })));
  await assert.rejects(verifyToken(await token({ key: first.privateKey, kid: "workos-key-1" }), { environmentId: environmentB }));

  current.value = { keys: [second.publicJwk] };
  const rotated = await token({ key: second.privateKey, kid: "workos-key-2" });
  assert.equal((await verifyToken(rotated)).subject, "user_synthetic_a");
  await assert.rejects(verifyToken(await token({ key: impostor.privateKey, kid: "workos-key-2" })));
  assert.equal(network.calls, 2);
  assert.ok(diagnostics.includes("CLIENT_ID_MISMATCH"));
  assert.ok(diagnostics.includes("AUDIENCE_MISMATCH"));
  assert.ok(diagnostics.includes("TOKEN_HEADER_INVALID"));
});

test("JWKS and session-status stalls fail closed within the configured bound", async () => {
  const never: JwksNetworkAdapter = { fetch: async () => new Promise<never>(() => {}) };
  const identity = new WorkOsJwtIdentityVerifier({
    environmentId: environmentA, audience: audienceA, issuer,
    jwksUrl: `https://api.workos.com/sso/jwks/${audienceA}`,
    network: never, timeoutMs: 50, cacheTtlMs: 1_000,
  });
  const value = "eyJhbGciOiJSUzI1NiIsImtpZCI6Indvcmtvcy10ZXN0In0.eyJzdWIiOiJ1c2VyX3N5bnRoZXRpYyIsInNpZCI6InNlc3Npb25fc3ludGhldGljIiwiZXhwIjo0MTAyNDQ0ODAwfQ.signature";
  const started = Date.now();
  await assert.rejects(identity.verify({ authorization: `Bearer ${value}`, environmentId: environmentA, audience: audienceA, issuer }));
  assert.ok(Date.now() - started < 500);

  const key = await signingKey("workos-status-timeout");
  const statusIdentity = new WorkOsJwtIdentityVerifier({
    environmentId: environmentA, audience: audienceA, issuer,
    jwksUrl: `https://api.workos.com/sso/jwks/${audienceA}`,
    network: { fetch: async () => ({ keys: [key.publicJwk] }) },
    sessionStatus: { isActive: async () => new Promise<never>(() => {}) },
    timeoutMs: 50, cacheTtlMs: 1_000,
  });
  const statusToken = await token({ key: key.privateKey, kid: "workos-status-timeout" });
  const statusStarted = Date.now();
  await assert.rejects(statusIdentity.verify({ authorization: `Bearer ${statusToken}`, environmentId: environmentA, audience: audienceA, issuer }));
  assert.ok(Date.now() - statusStarted < 500);
});

test("verifier configuration is pinned to the WorkOS issuer and bound client JWKS", () => {
  const network: JwksNetworkAdapter = { fetch: async () => ({ keys: [] }) };
  assert.throws(() => new WorkOsJwtIdentityVerifier({
    environmentId: environmentA,
    audience: audienceA,
    issuer: "https://identity.invalid/",
    jwksUrl: `https://api.workos.com/sso/jwks/${audienceA}`,
    network,
  }), /WORKOS_ISSUER_INVALID/);
  assert.throws(() => new WorkOsJwtIdentityVerifier({
    environmentId: environmentA,
    audience: audienceA,
    issuer,
    jwksUrl: `https://api.workos.com/sso/jwks/${audienceB}`,
    network,
  }), /WORKOS_JWKS_URL_INVALID/);
});
