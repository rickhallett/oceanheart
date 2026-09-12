import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FixtureStormAdapter, type FixtureFault } from "../../src/uat-storm/adapter.ts";
import { StormJournal } from "../../src/uat-storm/journal.ts";
import { writeReport } from "../../src/uat-storm/report.ts";
import { ClaraStormRunner, fixtureBindings } from "../../src/uat-storm/runner.ts";
import type { StormAction, StormManifest } from "../../src/uat-storm/types.ts";
import { liveManifest } from "./fixture.ts";

function fixtureManifest(root: string, runId: string, epoch = 1) {
  const manifest = liveManifest(root, runId, epoch);
  manifest.mode = "fixture";
  manifest.enabled = false;
  return manifest;
}

function adapterFor(manifest: StormManifest, fault: FixtureFault = null) {
  const bindings = fixtureBindings(manifest);
  return {
    bindings,
    adapter: new FixtureStormAdapter({
      schemaVersion: 1, executionMode: "fixture", adapterId: "fixture-adapter",
      targetBindingDigest: bindings.targetBindingDigest as `sha256:${string}`,
      identityBindingDigest: bindings.identityBindingDigest as `sha256:${string}`,
      oracleBindingDigest: manifest.oracle.bindingDigest,
      leaseId: manifest.lease.leaseId, epoch: manifest.lease.epoch, expiresAt: manifest.lease.expiresAt,
      operatorSessionBindingDigest: manifest.lease.operatorSessionBindingDigest,
      operatorControl: false, operatorSession: false, dedicatedProfile: false, fictionalDataOnly: true,
    }, fault),
  };
}

async function runFixture(fault: FixtureFault = null) {
  const root = await mkdtemp(join(tmpdir(), "storm-runner-"));
  const manifest = fixtureManifest(root, `storm-${fault ?? "complete"}`);
  const journal = await StormJournal.create(root, manifest.runId);
  const { adapter, bindings } = adapterFor(manifest, fault);
  const outcome = await new ClaraStormRunner(manifest, bindings, journal, adapter).run();
  return { root, manifest, journal, adapter, outcome };
}

test("fixed Clara fixture completes five bounded actions and produces fixture-only evidence", async () => {
  const result = await runFixture();
  assert.equal(result.outcome.classification, "complete");
  assert.equal(result.adapter.calls.length, 5);
  const report = await writeReport(result.journal.directory, result.manifest, result.journal.events, result.outcome);
  assert.equal(report.evidenceClass, "fixture");
  assert.equal(report.autonomousBrowserEvidence, false);
  assert.equal(report.realPractitionerOutcomeEvidence, false);
  assert.equal(report.facts.effectObservations, 2);
  assert.equal(report.facts.uniqueEffectCount, 1);
  assert.match((await readFile(join(result.journal.directory, "report-epoch-1.md"), "utf8")), /Deterministic fixture only/);
  assert.equal((await stat(join(result.journal.directory, "events.jsonl"))).mode & 0o777, 0o600);
});

test("lost write response is reconciled once and is never replayed", async () => {
  const result = await runFixture("lost-response");
  assert.equal(result.outcome.classification, "complete");
  assert.equal(result.adapter.calls.filter((action) => action.step === "prepare").length, 1);
  assert.equal(result.journal.events.filter((event) => event.kind === "write-uncertain").length, 1);
  assert.equal(result.journal.events.filter((event) => event.kind === "effect-present").length, 2);
});

test("an absent or duplicate effect stops cleanly without further actions", async () => {
  const absent = await runFixture("effect-absent");
  assert.equal(absent.outcome.classification, "effect_uncertain");
  assert.deepEqual(absent.adapter.calls.map((action) => action.step), ["status", "prepare"]);
  const duplicate = await runFixture("duplicate-effect");
  assert.equal(duplicate.outcome.classification, "invariant_failed");
  assert.equal(duplicate.outcome.code, "DUPLICATE_EFFECT");
  assert.deepEqual(duplicate.adapter.calls.map((action) => action.step), ["status", "prepare", "inspect", "retry"]);
});

test("restart reconciles a persisted pending write under a higher epoch without replay", async () => {
  const root = await mkdtemp(join(tmpdir(), "storm-resume-"));
  const manifest = fixtureManifest(root, "storm-resume", 2);
  const { adapter, bindings } = adapterFor(manifest);
  const prepare: StormAction = {
    schemaVersion: 1, actionId: "prepare-draft", step: "prepare", operation: "write",
    command: "clara-prepare", effectKey: "clara-c0001-september-invoice",
  };
  await adapter.perform(prepare);
  const initial = await StormJournal.create(root, manifest.runId);
  await initial.claim();
  await initial.append({ epoch: 1, kind: "bound", manifestDigest: bindings.manifestDigest,
    runBindingDigest: bindings.runBindingDigest, targetBindingDigest: bindings.targetBindingDigest,
    identityBindingDigest: bindings.identityBindingDigest, deadlineAt: new Date(Date.now() + 180_000).toISOString() });
  await initial.append({ epoch: 1, kind: "action-intent", step: "status", actionId: "status-before", operation: "read" });
  await initial.append({ epoch: 1, kind: "read-complete", step: "status", actionId: "status-before", operation: "read" });
  await initial.append({ epoch: 1, kind: "action-intent", step: "prepare", actionId: "prepare-draft", operation: "write" });
  await initial.close();
  const resumed = await StormJournal.resume(root, manifest.runId);
  const outcome = await new ClaraStormRunner(manifest, bindings, resumed, adapter).run();
  assert.equal(outcome.classification, "complete");
  assert.equal(adapter.calls.filter((action) => action.step === "prepare").length, 1);
  assert.ok(resumed.events.some((event) => event.kind === "effect-present" && event.actionId === "prepare-draft"));
});

test("restart with the same epoch fails closed before adapter mutation", async () => {
  const root = await mkdtemp(join(tmpdir(), "storm-stale-"));
  const manifest = fixtureManifest(root, "storm-stale", 1);
  const { adapter, bindings } = adapterFor(manifest);
  const initial = await StormJournal.create(root, manifest.runId);
  await initial.claim();
  await initial.append({ epoch: 1, kind: "bound", manifestDigest: bindings.manifestDigest,
    runBindingDigest: bindings.runBindingDigest, targetBindingDigest: bindings.targetBindingDigest,
    identityBindingDigest: bindings.identityBindingDigest, deadlineAt: new Date(Date.now() + 180_000).toISOString() });
  await initial.close();
  const resumed = await StormJournal.resume(root, manifest.runId);
  const outcome = await new ClaraStormRunner(manifest, bindings, resumed, adapter).run();
  assert.equal(outcome.code, "RESUME_EPOCH_STALE");
  assert.equal(adapter.calls.length, 0);
});
