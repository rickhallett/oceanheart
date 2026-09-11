import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ClaraAdaptationRuntimeController } from "../../src/adaptation/runtime-controller.ts";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";

const input = {
  schemaVersion: 1 as const,
  clientId: "c0001",
  period: { from: "2026-09-01", to: "2026-09-30" },
  sessions: [
    { id: "clara-session-2026-09-03", clientId: "fictional-person-01", date: "2026-09-03", attendance: "attended" as const, rateMinor: 8000, rateRef: "fictional-agreement-v1" },
    { id: "clara-session-2026-09-10", clientId: "fictional-person-01", date: "2026-09-10", attendance: "cancelled" as const, cancellationChargeMinor: 4000, policyRef: "fictional-cancellation-policy-v1" },
    { id: "clara-session-2026-09-17", clientId: "fictional-person-02", date: "2026-09-17", attendance: "attended" as const, prepaid: true },
  ],
};

test("attended-rate activation creates one release-specific draft and rollback reuses the baseline effect", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "studio-clara-adaptation-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workflow = new PiWorkflowRuntime({ root });
  t.after(() => workflow.close());
  const controller = new ClaraAdaptationRuntimeController(root, "c0001");
  const actor = `actor:${"a".repeat(64)}`;
  const baseKey = "actor-clara-v1";

  const baselinePrepared = await controller.prepare(input, baseKey);
  const baseline = await workflow.startRun({ clientId: "c0001", actor, ...baselinePrepared });
  assert.equal(baseline.result?.totalMinor, 12000);
  const baselineState = await controller.state(actor);

  const evaluated = await controller.evaluate(actor, "actor-rate-20260901-9000", input, "2026-09-01", 9000);
  assert.equal(evaluated.proposal?.baselineTotalMinor, 12000);
  assert.equal(evaluated.proposal?.candidateTotalMinor, 13000);
  assert.deepEqual(evaluated.proposal?.changedSessionIds, ["clara-session-2026-09-03"]);
  assert.equal(evaluated.proposal?.evaluation.accepted, true);
  const activated = await controller.activate(actor, evaluated.proposal!.proposalId, baselineState.active.releaseId);
  assert.equal(activated.active.generation, 2);
  assert.equal((await controller.activate(actor, evaluated.proposal!.proposalId, baselineState.active.releaseId)).active.releaseId, activated.active.releaseId);

  const adaptedPrepared = await controller.prepare(input, baseKey);
  assert.notEqual(adaptedPrepared.idempotencyKey, baseKey);
  const adapted = await workflow.startRun({ clientId: "c0001", actor, ...adaptedPrepared });
  assert.equal(adapted.result?.totalMinor, 13000);
  assert.equal(adapted.request.configurationVersion, "clara-2026-10-01-rate-change");
  assert.equal(adapted.request.configurationReleaseId, activated.active.releaseId);
  const adaptedReplay = await workflow.startRun({ clientId: "c0001", actor, ...adaptedPrepared });
  assert.equal(adaptedReplay.id, adapted.id);
  assert.equal(workflow.store.db.prepare("SELECT count(*) value FROM effects").get()?.value, 2);

  const rolledBack = await controller.rollback(actor, baselineState.active.releaseId, activated.active.releaseId);
  assert.equal(rolledBack.active.generation, 3);
  assert.equal((await controller.rollback(actor, baselineState.active.releaseId, activated.active.releaseId)).active.releaseId, baselineState.active.releaseId);
  const baselineAgain = await controller.prepare(input, baseKey);
  const restored = await workflow.startRun({ clientId: "c0001", actor, ...baselineAgain });
  assert.equal(restored.id, baseline.id);
  assert.equal(restored.result?.totalMinor, 12000);
  assert.equal(workflow.store.db.prepare("SELECT count(*) value FROM effects").get()?.value, 2);
});

test("proposal actor binding and active-release CAS fail closed", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "studio-clara-adaptation-auth-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const controller = new ClaraAdaptationRuntimeController(root, "c0001");
  const actor = `actor:${"a".repeat(64)}`;
  const evaluated = await controller.evaluate(actor, "actor-rate-20260901-9000", input, "2026-09-01", 9000);
  await assert.rejects(
    controller.activate(`actor:${"b".repeat(64)}`, evaluated.proposal!.proposalId, evaluated.active.releaseId),
    /PROPOSAL_DENIED/,
  );
  await assert.rejects(
    controller.activate(actor, evaluated.proposal!.proposalId, "f".repeat(64)),
    /PROPOSAL_DENIED/,
  );
  assert.equal((await controller.state(actor)).active.releaseId, evaluated.active.releaseId);
});
