import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { POST } from "../../src/app/api/private/clara/route";
import { claraDemoInput } from "../../src/lib/clara-contract";

vi.mock("@workos-inc/authkit-nextjs", () => ({ withAuth: vi.fn() }));

const origin = "https://c0001.private.example";
const run = {
  schemaVersion: 1,
  runId: "123e4567-e89b-42d3-a456-426614174000",
  status: "succeeded",
  inspectPath: "runs/123e4567-e89b-42d3-a456-426614174000",
  draftId: "draft-123e4567-e89b-42d3-a456-426614174000",
};
const baselineRelease = {
  releaseId: "1".repeat(64),
  artifactDigest: `sha256:${"2".repeat(64)}`,
  version: "clara-2026-09-01",
  generation: 1,
};
const proposal = {
  proposalId: "3".repeat(64),
  expectedActiveReleaseId: baselineRelease.releaseId,
  candidateArtifactDigest: `sha256:${"4".repeat(64)}`,
  candidateVersion: "clara-2026-09-01-rate-90",
  effectiveDate: "2026-09-01",
  previousRateMinor: 8000,
  newRateMinor: 9000,
  baselineTotalMinor: 12000,
  candidateTotalMinor: 13000,
  changedSessionIds: ["clara-session-2026-09-03"],
  explanation: "One eligible attended session changes; cancellation and prepaid sessions remain unchanged.",
  evaluation: {
    evaluationId: "eval-rate-90",
    reportDigest: `sha256:${"5".repeat(64)}`,
    accepted: true,
    passed: 4,
    total: 4,
  },
};

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/private/clara`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("STUDIO_PRIVATE_WORKFLOW", "clara");
  vi.stubEnv("STUDIO_CLARA_RUNTIME_URL", "http://127.0.0.1:4781/v1/clara");
  vi.stubEnv("WORKOS_CLIENT_ID", "client_syntheticc0001");
  vi.stubEnv("WORKOS_API_KEY", "test-only-api-key");
  vi.stubEnv("WORKOS_COOKIE_PASSWORD", "x".repeat(32));
  vi.stubEnv("NEXT_PUBLIC_WORKOS_REDIRECT_URI", `${origin}/callback`);
  vi.mocked(withAuth).mockResolvedValue({
    user: { id: "user_synthetic_a" },
    sessionId: "session_synthetic_a",
    accessToken: "signed.synthetic.token",
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("stays disabled without exact dedicated configuration", async () => {
  vi.stubEnv("STUDIO_PRIVATE_WORKFLOW", "");
  const bridge = vi.fn();
  vi.stubGlobal("fetch", bridge);
  const response = await POST(request({ operation: "prepare" }));
  expect(response.status).toBe(404);
  expect(withAuth).not.toHaveBeenCalled();
  expect(bridge).not.toHaveBeenCalled();
});

it.each([
  ["STUDIO_CLARA_RUNTIME_URL", "http://runtime.private/v1/clara"],
  ["STUDIO_CLARA_RUNTIME_URL", "http://localhost:4781/v1/clara"],
  ["STUDIO_CLARA_RUNTIME_URL", "http://[::1]:4781/v1/clara"],
  ["STUDIO_CLARA_RUNTIME_URL", "https://runtime.private/v1/clara"],
  ["STUDIO_CLARA_RUNTIME_URL", "https://user:password@runtime.private/v1/clara"],
  ["STUDIO_CLARA_RUNTIME_URL", "https://runtime.private/other"],
  ["WORKOS_CLIENT_ID", "not-a-client"],
] as const)("stays disabled for invalid %s", async (key, value) => {
  vi.stubEnv(key, value);
  const bridge = vi.fn();
  vi.stubGlobal("fetch", bridge);
  expect((await POST(request({ operation: "prepare" }))).status).toBe(404);
  expect(withAuth).not.toHaveBeenCalled();
  expect(bridge).not.toHaveBeenCalled();
});

it("rejects cross-origin, auth-free and caller-expanded requests before the bridge", async () => {
  const bridge = vi.fn();
  vi.stubGlobal("fetch", bridge);
  expect(
    (await POST(request({ operation: "prepare" }, { origin: "https://attacker.invalid" }))).status,
  ).toBe(403);
  vi.mocked(withAuth).mockResolvedValue({ user: null } as never);
  expect((await POST(request({ operation: "prepare" }))).status).toBe(401);
  vi.mocked(withAuth).mockResolvedValue({
    user: { id: "user_synthetic_a" },
    sessionId: "session_synthetic_a",
    accessToken: "signed.synthetic.token",
  } as never);
  expect(
    (await POST(request({ operation: "prepare", clientId: "c0002" }))).status,
  ).toBe(400);
  expect(bridge).not.toHaveBeenCalled();
});

it("forwards only the WorkOS token and server-owned fictional start with actor-stable dedupe", async () => {
  const bridge = vi.fn().mockImplementation(() => Promise.resolve(Response.json(run)));
  vi.stubGlobal("fetch", bridge);
  for (let index = 0; index < 2; index += 1) {
    const response = await POST(request({ operation: "prepare" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ operation: "prepare", run });
  }
  expect(bridge).toHaveBeenCalledTimes(2);
  const calls = bridge.mock.calls.map(([, options]) => ({
    authorization: options.headers.authorization,
    body: JSON.parse(options.body),
  }));
  expect(calls[0]).toEqual(calls[1]);
  expect(calls[0].authorization).toBe("Bearer signed.synthetic.token");
  expect(calls[0].body).toMatchObject({
    schemaVersion: 1,
    operation: "start",
    idempotencyKey: `${createHash("sha256").update("user_synthetic_a").digest("hex").slice(0, 24)}-clara-v1`,
    input: { schemaVersion: 1, period: { from: "2026-09-01", to: "2026-09-30" } },
  });
  expect(JSON.stringify(calls[0].body)).not.toContain("c0001");

  vi.mocked(withAuth).mockResolvedValue({
    user: { id: "user_synthetic_b" },
    sessionId: "session_synthetic_b",
    accessToken: "other.signed.token",
  } as never);
  await POST(request({ operation: "prepare" }));
  const other = JSON.parse(bridge.mock.calls[2][1].body);
  expect(other.idempotencyKey).not.toBe(calls[0].body.idempotencyKey);
});

it("reauthorizes and sanitizes run, draft and trace reads", async () => {
  const draft = {
    schemaVersion: 1,
    clientId: "c0001",
    currency: "GBP",
    draftId: run.draftId,
    lines: [{
      sessionId: "clara-session-2026-09-03",
      clientId: "fictional-person-01",
      amountMinor: 8000,
      rateRef: "fictional-agreement-v1",
    }],
    totalMinor: 8000,
    unresolved: [],
    prepaidSessionIds: [],
    excludedSessionIds: [],
    outstanding: [],
  };
  const trace = {
    schemaVersion: 1,
    job: {
      id: run.runId,
      clientId: "c0001",
      actor: "private-actor-value",
      status: "succeeded",
      configurationVersion: "clara-v1",
      inputHash: "a".repeat(64),
      resultHash: "b".repeat(64),
    },
    events: [{ private: "not returned" }, { private: "not returned" }],
  };
  const bridge = vi.fn(async (_url, options) => {
    const operation = JSON.parse(options.body).operation;
    return Response.json(operation === "run" ? run : operation === "draft" ? draft : trace);
  });
  vi.stubGlobal("fetch", bridge);
  const outputs = [];
  for (const operation of ["run", "draft", "trace"] as const) {
    const response = await POST(request({ operation, runId: run.runId }));
    expect(response.status).toBe(200);
    outputs.push(await response.json());
  }
  expect(withAuth).toHaveBeenCalledTimes(3);
  expect(outputs[1]).not.toHaveProperty("draft.clientId");
  expect(outputs[1]).not.toHaveProperty("draft.lines.0.clientId");
  expect(outputs[2]).toEqual({
    operation: "trace",
    trace: {
      schemaVersion: 1,
      eventCount: 2,
      configurationVersion: "clara-v1",
      inputHash: "a".repeat(64),
      resultHash: "b".repeat(64),
    },
  });
  expect(JSON.stringify(outputs)).not.toContain("private-actor-value");
});

it("forwards only the bounded attended-rate proposal and sanitizes its immutable receipt", async () => {
  const upstream = {
    schemaVersion: 1,
    clientId: "private-client",
    active: baselineRelease,
    proposal: { ...proposal, reportPath: "/private/runtime/report.html" },
  };
  const bridge = vi.fn().mockResolvedValue(Response.json(upstream));
  vi.stubGlobal("fetch", bridge);
  const response = await POST(request({
    operation: "adaptation-evaluate",
    effectiveDate: "2026-09-01",
    newRateMinor: 9000,
  }));
  expect(response.status).toBe(200);
  const output = await response.json();
  expect(output).toEqual({
    operation: "adaptation-evaluate",
    adaptation: { schemaVersion: 1, active: baselineRelease, proposal },
  });
  expect(JSON.stringify(output)).not.toContain("private-client");
  expect(JSON.stringify(output)).not.toContain("report.html");
  const options = bridge.mock.calls[0][1];
  expect(options.headers.authorization).toBe("Bearer signed.synthetic.token");
  expect(JSON.parse(options.body)).toEqual({
    schemaVersion: 1,
    operation: "adaptation-evaluate",
    effectiveDate: "2026-09-01",
    newRateMinor: 9000,
    idempotencyKey: `${createHash("sha256").update("user_synthetic_a").digest("hex").slice(0, 24)}-clara-v1-rate-20260901-9000`,
    input: claraDemoInput,
  });

  expect((await POST(request({
    operation: "adaptation-evaluate",
    effectiveDate: "2026-09-01",
    newRateMinor: 9000,
    clientId: "other-client",
  }))).status).toBe(400);
  expect((await POST(request({
    operation: "adaptation-activate",
    proposalId: proposal.proposalId,
    expectedActiveReleaseId: "not-a-release",
  }))).status).toBe(400);
  expect(bridge).toHaveBeenCalledTimes(1);
});

it("redacts bridge denial and failure", async () => {
  const bridge = vi.fn()
    .mockResolvedValueOnce(new Response("private denial", { status: 403 }))
    .mockRejectedValueOnce(new Error("private transport failure"));
  vi.stubGlobal("fetch", bridge);
  const denied = await POST(request({ operation: "prepare" }));
  expect(denied.status).toBe(403);
  expect(await denied.text()).not.toContain("private denial");
  const failed = await POST(request({ operation: "prepare" }));
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain("private transport failure");
});
