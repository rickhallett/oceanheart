import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { recoverDurableJobs } from "../../scripts/provision/recover-durable-jobs.ts";
import {
  seedInterruptedDraft,
  verifyRecoveredDraft,
} from "../../scripts/provision/remote-recovery-smoke.ts";

const benchRoot = resolve(import.meta.dirname, "../..");

test("a supervisor process recovers an atomic draft and replay cannot duplicate it", async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "studio-recovery-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const seeded = seedInterruptedDraft("c0001", root);
  const receipt = await recoverDurableJobs("c0001", root);
  assert.deepEqual(receipt.errors, []);
  assert.deepEqual(receipt.deferred, []);
  assert.deepEqual(receipt.recovered, [{ runId: seeded.runId, status: "succeeded" }]);
  const verified = await verifyRecoveredDraft("c0001", root);
  assert.equal(verified.runId, seeded.runId);
  assert.equal(verified.draftId, seeded.draftId);
  assert.equal(verified.resultHash, seeded.resultHash);
  assert.deepEqual(
    { jobs: verified.jobs, effects: verified.effects, reservations: verified.reservations },
    { jobs: 1, effects: 1, reservations: 1 },
  );
});

test("recovery defers an unexpired lease and installer is a hardened timer", async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "studio-recovery-lease-")));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const seeded = seedInterruptedDraft("c0002", root);
  const runtimeModule = await import("../../src/runtime/pi-adapter.ts");
  const runtime = new runtimeModule.PiWorkflowRuntime({ root });
  const job = runtime.store.get("c0002", seeded.runId);
  job.lease = Date.now() + 60_000;
  runtime.store.save(job);
  runtime.close();
  const receipt = await recoverDurableJobs("c0002", root);
  assert.deepEqual(receipt.recovered, []);
  assert.deepEqual(receipt.deferred, [{ runId: seeded.runId, status: "running" }]);

  const installer = join(benchRoot, "scripts/provision/install-runtime-recovery.sh");
  const source = readFileSync(installer, "utf8");
  assert.equal(spawnSync("bash", ["-n", installer]).status, 0);
  assert.match(source, /User=studio-runtime/);
  assert.match(source, /ProtectSystem=strict/);
  assert.match(source, /RestrictAddressFamilies=AF_UNIX/);
  assert.match(source, /ReadWritePaths=\/var\/lib\/studio-pi-runtime\/%i/);
  assert.doesNotMatch(source, /PASSWORD=|TOKEN=|KEY=|--env/);
});
