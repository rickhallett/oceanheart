import assert from "node:assert/strict";
import { chmod, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { once } from "node:events";
import test from "node:test";

import { UnixSocketStormAdapter } from "../../src/uat-storm/adapter.ts";

test("private Unix broker exchanges one bounded typed inspection", async () => {
  const root = await mkdtemp(join(tmpdir(), "storm-socket-"));
  const path = join(root, "broker.sock");
  let request: Record<string, unknown> | undefined;
  const server = createServer((socket) => {
    let input = "";
    socket.on("data", (chunk) => {
      input += String(chunk);
      if (!input.includes("\n")) return;
      request = JSON.parse(input.trim()) as Record<string, unknown>;
      socket.end(`${JSON.stringify({ schemaVersion: 1, requestId: request.requestId, ok: true, result: {
        schemaVersion: 1, mode: "live", executionMode: "hosted-operator-driven", adapterId: "root-cua-broker",
        targetBindingDigest: `sha256:${"a".repeat(64)}`, identityBindingDigest: `sha256:${"b".repeat(64)}`,
        oracleBindingDigest: `sha256:${"c".repeat(64)}`, leaseId: "lease-1", epoch: 1,
        expiresAt: new Date(Date.now() + 60_000).toISOString(), operatorSessionBindingDigest: `sha256:${"d".repeat(64)}`,
        operatorControl: true, operatorSession: true, dedicatedProfile: false, fictionalDataOnly: true,
      } })}\n`);
    });
  });
  server.listen(path);
  await once(server, "listening");
  await chmod(path, 0o600);
  const result = await new UnixSocketStormAdapter(path).inspect();
  assert.equal(result.executionMode, "hosted-operator-driven");
  assert.equal(result.operatorSession, true);
  assert.equal(result.dedicatedProfile, false);
  assert.equal(request?.kind, "inspect");
  server.close();
  await once(server, "close");
});

test("broker free-form failure details are discarded", async () => {
  const root = await mkdtemp(join(tmpdir(), "storm-socket-failure-"));
  const path = join(root, "broker.sock");
  const server = createServer((socket) => {
    let input = "";
    socket.on("data", (chunk) => {
      input += String(chunk);
      if (!input.includes("\n")) return;
      const request = JSON.parse(input.trim()) as { requestId: string };
      socket.end(`${JSON.stringify({ schemaVersion: 1, requestId: request.requestId, ok: false,
        code: "operator_declined", detail: "SECRET SHOULD NOT SURFACE" })}\n`);
    });
  });
  server.listen(path);
  await once(server, "listening");
  await chmod(path, 0o600);
  await assert.rejects(new UnixSocketStormAdapter(path).inspect(), (error: Error) => {
    assert.equal(error.message, "ADAPTER_operator_declined");
    assert.equal(error.message.includes("SECRET"), false);
    return true;
  });
  server.close();
  await once(server, "close");
});
