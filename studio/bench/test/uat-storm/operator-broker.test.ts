import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { lstat, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import test from "node:test";

import {
  CLARA_EFFECT_KEY,
  encodeOperatorLine,
  OPERATOR_MESSAGE_LIMIT_BYTES,
  parseOperatorLine,
  parseOperatorRequest,
  parseOperatorResponse,
  type OperatorRequest,
  type OperatorResponse,
} from "../../src/uat-storm/operator-contract.ts";
import {
  OperatorBroker,
  readPendingOperatorRequest,
  submitOperatorResponse,
} from "../../src/uat-storm/operator-broker.ts";

const digest = (character: string) => `sha256:${character.repeat(64)}` as `sha256:${string}`;

async function eventually<T>(action: () => Promise<T>, timeoutMs = 1_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      return await action();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

function exchange(socketPath: string, request: OperatorRequest): Promise<OperatorResponse> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let bytes = Buffer.alloc(0);
    socket.once("connect", () => socket.write(encodeOperatorLine(request)));
    socket.on("data", (chunk: Buffer) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (!bytes.includes(0x0a)) return;
      try {
        resolve(parseOperatorResponse(request, parseOperatorLine(bytes)));
      } catch (error) {
        reject(error);
      } finally {
        socket.destroy();
      }
    });
    socket.once("error", reject);
  });
}

function cli(args: string[], input?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      new URL("../../scripts/uat-storm/operator-broker.ts", import.meta.url).pathname,
      ...args,
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || `CLI_EXIT_${code}`));
    });
    child.stdin.end(input);
  });
}

function inspectResponse(requestId: string): OperatorResponse {
  return {
    schemaVersion: 1,
    requestId,
    ok: true,
    result: {
      schemaVersion: 1,
      mode: "live",
      executionMode: "hosted-operator-driven",
      adapterId: "authorized-chrome-operator",
      targetBindingDigest: digest("a"),
      identityBindingDigest: digest("b"),
      oracleBindingDigest: digest("c"),
      leaseId: "lease-1",
      epoch: 7,
      expiresAt: "2026-09-12T12:00:00.000Z",
      operatorSessionBindingDigest: digest("d"),
      operatorControl: true,
      operatorSession: true,
      dedicatedProfile: false,
      fictionalDataOnly: true,
    },
  };
}

test("operator broker exchanges one private pending request over a real Unix socket", async (t) => {
  const stateDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const broker = new OperatorBroker({ stateDir, timeoutMs: 2_000, pollMs: 10 });
  await broker.start();
  t.after(() => broker.close());

  assert.equal((await lstat(stateDir)).mode & 0o777, 0o700);
  assert.equal((await lstat(broker.paths.socket)).mode & 0o777, 0o600);

  const request = { schemaVersion: 1, requestId: "request-1", kind: "inspect" } as const;
  const result = exchange(broker.paths.socket, request);
  assert.deepEqual(await eventually(() => readPendingOperatorRequest(stateDir)), request);
  assert.equal((await lstat(broker.paths.pending)).mode & 0o777, 0o600);
  await submitOperatorResponse(stateDir, inspectResponse(request.requestId));
  assert.deepEqual(await result, inspectResponse(request.requestId));
});

test("operator broker permits only one pending request and rejects a duplicate response", async (t) => {
  const stateDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const broker = new OperatorBroker({ stateDir, timeoutMs: 2_000, pollMs: 500 });
  await broker.start();
  t.after(() => broker.close());

  const first = { schemaVersion: 1, requestId: "request-1", kind: "inspect" } as const;
  const firstResult = exchange(broker.paths.socket, first);
  await eventually(() => readPendingOperatorRequest(stateDir));
  const busy = await exchange(broker.paths.socket, { schemaVersion: 1, requestId: "request-2", kind: "cleanup" });
  assert.deepEqual(busy, { schemaVersion: 1, requestId: "request-2", ok: false, code: "BROKER_BUSY" });

  const submissions = await Promise.allSettled([
    submitOperatorResponse(stateDir, inspectResponse(first.requestId)),
    submitOperatorResponse(stateDir, inspectResponse(first.requestId)),
  ]);
  assert.equal(submissions.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(submissions.filter((result) => result.status === "rejected").length, 1);
  await firstResult;
});

test("response identity and payload are validated before the operator can release a request", async (t) => {
  const stateDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const broker = new OperatorBroker({ stateDir, timeoutMs: 2_000, pollMs: 10 });
  await broker.start();
  t.after(() => broker.close());

  const request = { schemaVersion: 1, requestId: "request-7", kind: "inspect" } as const;
  const result = exchange(broker.paths.socket, request);
  await eventually(() => readPendingOperatorRequest(stateDir));
  await assert.rejects(
    submitOperatorResponse(stateDir, inspectResponse("request-other")),
    /INVALID_RESPONSE/,
  );
  await assert.rejects(
    submitOperatorResponse(stateDir, {
      ...inspectResponse(request.requestId),
      result: { ...(inspectResponse(request.requestId) as { result: object }).result, dedicatedProfile: true },
    }),
    /INVALID_RESPONSE/,
  );
  await submitOperatorResponse(stateDir, inspectResponse(request.requestId));
  assert.equal((await result).ok, true);
});

test("perform and independent oracle responses retain their distinct evidence contracts", async (t) => {
  const stateDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const broker = new OperatorBroker({ stateDir, timeoutMs: 2_000, pollMs: 10 });
  await broker.start();
  t.after(() => broker.close());

  const perform = {
    schemaVersion: 1,
    requestId: "request-1",
    kind: "perform",
    action: {
      schemaVersion: 1,
      actionId: "action-1",
      step: "prepare",
      operation: "write",
      command: "clara-prepare",
      effectKey: CLARA_EFFECT_KEY,
    },
  } as const;
  const performResult = exchange(broker.paths.socket, perform);
  await eventually(() => readPendingOperatorRequest(stateDir));
  await submitOperatorResponse(stateDir, {
    schemaVersion: 1,
    requestId: perform.requestId,
    ok: true,
    result: { acknowledged: true, observation: {
      configurationVersion: "clara-2026-09-01", configurationGeneration: 7,
      draftId: "draft-c0001", totalMinor: 12000, traceEvents: 22,
    } },
  });
  assert.equal((await performResult).ok, true);

  const oracle = { schemaVersion: 1, requestId: "request-2", kind: "oracle", effectKey: CLARA_EFFECT_KEY } as const;
  const oracleResult = exchange(broker.paths.socket, oracle);
  await eventually(async () => {
    const pending = await readPendingOperatorRequest(stateDir);
    assert.equal(pending.requestId, oracle.requestId);
    return pending;
  });
  await submitOperatorResponse(stateDir, {
    schemaVersion: 1,
    requestId: oracle.requestId,
    ok: true,
    result: { status: "present", count: 1, effectDigest: digest("e"), receiptDigest: digest("f") },
  });
  assert.equal((await oracleResult).ok, true);
});

test("broker timeout and shutdown fail closed and remove pending state", async () => {
  const timeoutDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const timeoutBroker = new OperatorBroker({ stateDir: timeoutDir, timeoutMs: 80, pollMs: 10 });
  await timeoutBroker.start();
  const timedOut = await exchange(timeoutBroker.paths.socket,
    { schemaVersion: 1, requestId: "request-timeout", kind: "cleanup" });
  assert.deepEqual(timedOut,
    { schemaVersion: 1, requestId: "request-timeout", ok: false, code: "OPERATOR_TIMEOUT" });
  await assert.rejects(readFile(timeoutBroker.paths.pending), { code: "ENOENT" });
  await timeoutBroker.close();

  const shutdownDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const shutdownBroker = new OperatorBroker({ stateDir: shutdownDir, timeoutMs: 2_000, pollMs: 10 });
  await shutdownBroker.start();
  const result = exchange(shutdownBroker.paths.socket,
    { schemaVersion: 1, requestId: "request-shutdown", kind: "cleanup" });
  await eventually(() => readPendingOperatorRequest(shutdownDir));
  await shutdownBroker.close();
  assert.deepEqual(await result,
    { schemaVersion: 1, requestId: "request-shutdown", ok: false, code: "BROKER_SHUTDOWN" });
});

test("strict validation rejects secret-bearing fields and invalid action combinations", () => {
  assert.throws(() => encodeOperatorLine({ payload: "x".repeat(OPERATOR_MESSAGE_LIMIT_BYTES) }),
    /MESSAGE_TOO_LARGE/);
  assert.throws(() => parseOperatorLine(Buffer.alloc(OPERATOR_MESSAGE_LIMIT_BYTES + 1)),
    /MESSAGE_TOO_LARGE/);
  assert.throws(() => parseOperatorRequest({
    schemaVersion: 1,
    requestId: "request-1",
    kind: "inspect",
    cookie: "must-not-enter-transport",
  }), /INVALID_REQUEST/);
  assert.throws(() => parseOperatorRequest({
    schemaVersion: 1,
    requestId: "request-2",
    kind: "perform",
    action: {
      schemaVersion: 1,
      actionId: "action-2",
      step: "prepare",
      operation: "read",
      command: "clara-prepare",
      effectKey: CLARA_EFFECT_KEY,
    },
  }), /INVALID_REQUEST/);
});

test("a response with no current request is stale", async () => {
  const stateDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const broker = new OperatorBroker({ stateDir });
  await broker.start();
  await assert.rejects(
    submitOperatorResponse(stateDir, inspectResponse("request-old")),
    /STALE_RESPONSE/,
  );
  await broker.close();
});

test("pending and respond CLI commands validate the same live envelope", async (t) => {
  const stateDir = join(await mkdtemp(join(tmpdir(), "oceanheart-broker-")), "state");
  const broker = new OperatorBroker({ stateDir, timeoutMs: 2_000, pollMs: 10 });
  await broker.start();
  t.after(() => broker.close());
  const request = { schemaVersion: 1, requestId: "request-cli", kind: "inspect" } as const;
  const result = exchange(broker.paths.socket, request);
  await eventually(() => readPendingOperatorRequest(stateDir));

  const pending = await cli(["pending", "--state-dir", stateDir]);
  assert.deepEqual(JSON.parse(pending.stdout), request);
  const response = inspectResponse(request.requestId);
  const submitted = await cli(["respond", "--state-dir", stateDir], JSON.stringify(response));
  assert.equal(submitted.stdout, "response accepted\n");
  assert.deepEqual(await result, response);
});
