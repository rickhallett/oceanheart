import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  artifactDigest,
  baselineArtifact,
  configuredInputForArtifact,
  requestedArtifact,
} from "../../src/adaptation/configuration.ts";
import type { AdaptationEvaluation } from "../../src/adaptation/evaluate.ts";
import { ClaraConfigurationStore } from "../../src/adaptation/release.ts";
import { parseCli } from "../../src/cli-options.ts";
import type { ClaraFixture } from "../../src/eval/contracts.ts";
import { loadClaraFixtures } from "../../src/eval/fixtures.ts";

const baselineDefinition = {
  id: "clara-2026-09-01",
  instructionsVersion: "clara-invoice-rules@2026-09-01",
  toolsetVersion: "invoice-draft-stub@1",
  modelProfile: "workflow-adapter-synthetic",
};
const adaptedDefinition = {
  ...baselineDefinition,
  id: "clara-2026-10-01-rate-change",
  instructionsVersion: "clara-invoice-rules@2026-10-01",
};

async function artifacts() {
  const fixture = (await loadClaraFixtures()).find((item) => item.caseId === "CL-09")!;
  const baseline = baselineArtifact(baselineDefinition, fixture.clientId);
  const candidate = requestedArtifact(adaptedDefinition, fixture, {
    effectiveDate: "2026-10-01",
    newRateMinor: 9000,
  });
  return { fixture, baseline, candidate };
}

async function evaluation(
  root: string,
  clientId: string,
  baselineDigest: string,
  candidateDigest: string,
  accepted = true,
): Promise<AdaptationEvaluation> {
  const directory = join(root, "evaluation-fixture");
  const jsonPath = join(directory, accepted ? "accepted.json" : "rejected.json");
  const htmlPath = join(directory, accepted ? "accepted.html" : "rejected.html");
  const results = Array.from({ length: 18 }, (_, index) => ({ pass: accepted || index > 0 }));
  await mkdir(directory, { recursive: true });
  await writeFile(jsonPath, `${JSON.stringify({ configurations: [{ id: baselineDefinition.id }, { id: adaptedDefinition.id }], results }, null, 2)}\n`);
  await writeFile(htmlPath, "<html></html>\n");
  return {
    schemaVersion: 1,
    evaluationId: "eval-accepted",
    clientId,
    baselineArtifactDigest: baselineDigest,
    candidateArtifactDigest: candidateDigest,
    accepted,
    total: 18,
    passed: accepted ? 18 : 17,
    reportDigest: `sha256:${createHash("sha256").update(await readFile(jsonPath)).digest("hex")}`,
    jsonPath,
    htmlPath,
    stateBoundary: "fresh-isolated-evaluation",
  };
}

test("failed or stale activation keeps the prior configuration active", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bench-config-failure-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { baseline, candidate } = await artifacts();
  const store = new ClaraConfigurationStore(root, baseline.clientId);
  const initial = await store.ensureBaseline(baseline, () => "2026-09-11T10:00:00.000Z");
  const rejected = await evaluation(root, baseline.clientId, artifactDigest(baseline), artifactDigest(candidate), false);
  await assert.rejects(store.activate(candidate, rejected, initial.activeReleaseId), /NOT_ACCEPTED/);
  assert.deepEqual(await store.active(), initial);
  const accepted = await evaluation(root, baseline.clientId, artifactDigest(baseline), artifactDigest(candidate));
  await assert.rejects(store.activate(candidate, accepted, "f".repeat(64)), /STALE_ACTIVE_CONFIGURATION/);
  assert.deepEqual(await store.active(), initial);
  await writeFile(accepted.jsonPath, "{}\n");
  await assert.rejects(store.activate(candidate, accepted, initial.activeReleaseId), /REPORT_MISMATCH/);
  assert.deepEqual(await store.active(), initial);
});

test("accepted immutable configuration activates and rolls back only to its compatible prior release", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bench-config-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { baseline, candidate } = await artifacts();
  const store = new ClaraConfigurationStore(root, baseline.clientId);
  const initial = await store.ensureBaseline(baseline, () => "2026-09-11T10:00:00.000Z");
  const result = await store.activate(
    candidate,
    await evaluation(root, baseline.clientId, artifactDigest(baseline), artifactDigest(candidate)),
    initial.activeReleaseId,
    () => "2026-09-11T10:01:00.000Z",
  );
  assert.equal(result.active.version, "clara-2026-10-01-rate-change");
  assert.equal(result.release?.previousReleaseId, initial.activeReleaseId);
  assert.deepEqual(await store.artifact(result.active.artifactDigest), candidate);
  await assert.rejects(store.rollback("f".repeat(64)), /COMPATIBLE_PRIOR_RELEASE/);
  assert.equal((await store.active())?.activeReleaseId, result.active.activeReleaseId);
  const rollback = await store.rollback(initial.activeReleaseId, () => "2026-09-11T10:02:00.000Z");
  assert.equal(rollback.active.version, "clara-2026-09-01");
  assert.equal(rollback.active.generation, 3);
  assert.deepEqual(await store.artifact(rollback.active.artifactDigest), baseline);
});

test("baseline initialization resumes after a crash between immutable release and pointer", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "bench-config-crash-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const { baseline } = await artifacts();
  const store = new ClaraConfigurationStore(root, baseline.clientId);
  const first = await store.ensureBaseline(baseline, () => "2026-09-11T10:00:00.000Z");
  await unlink(join(root, "configurations", baseline.clientId, "active.json"));
  const recovered = await store.ensureBaseline(baseline, () => "2026-09-11T10:05:00.000Z");
  assert.equal(recovered.activeReleaseId, first.activeReleaseId);
  assert.equal(recovered.version, first.version);
});

test("a Clara configuration leaves another client input byte-for-byte invariant", async () => {
  const { fixture, candidate } = await artifacts();
  const other = structuredClone(fixture) as unknown as ClaraFixture;
  Object.assign(other, { clientId: "c-amira-synthetic" });
  other.input.clientId = "c-amira-synthetic";
  other.request.clientId = "c-amira-synthetic";
  const original = structuredClone(other.input);
  assert.deepEqual(configuredInputForArtifact(other, candidate), original);
  assert.deepEqual(other.input, original);
});

test("rate-change request must exactly match the reviewed effective date and amount", async () => {
  const { fixture } = await artifacts();
  assert.throws(
    () => requestedArtifact(adaptedDefinition, fixture, { effectiveDate: "2026-10-02", newRateMinor: 9000 }),
    /REVIEWED_SCOPE/,
  );
  assert.throws(
    () => requestedArtifact(adaptedDefinition, fixture, { effectiveDate: "2026-10-01", newRateMinor: 9100 }),
    /REVIEWED_SCOPE/,
  );
});

test("CLI selects active configuration by default and requires exact adaptation/rollback arguments", () => {
  const run = parseCli(["run", "clara", "--fixture", "CL-09", "--state-dir", "/tmp/bench-cli"]);
  assert.equal(run.configuration, "active");
  const adapt = parseCli(["adapt", "clara", "--fixture", "CL-09", "--effective-date", "2026-10-01", "--new-rate-minor", "9000"]);
  assert.equal(adapt.newRateMinor, 9000);
  assert.throws(() => parseCli(["adapt", "clara", "--fixture", "CL-09", "--effective-date", "2026-10-01", "--new-rate-minor", "90.5"]));
  assert.throws(() => parseCli(["rollback", "clara"]));
});
