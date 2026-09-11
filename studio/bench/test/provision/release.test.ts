import assert from "node:assert/strict";
import test from "node:test";
import { finalizeRelease, planRelease, planRollback } from "../../src/provision/release.ts";

const sha = "c".repeat(40);
const artifact = `sha256:${"d".repeat(64)}`;

test("release becomes ready only from an exact provider-inspected digest", () => {
  const plan = planRelease({
    kind: "release",
    clientId: "c0001",
    sourceSha: sha,
    artifactDigest: artifact,
    previousReleaseId: null,
    targetReleaseId: null,
    dataCompatibility: "no-change",
    now: () => "2026-09-11T12:00:00.000Z",
  });
  const ready = finalizeRelease(
    plan,
    {
      source: "provider-inspection",
      state: "ready",
      providerDeploymentId: "deploy-0001",
      applicationUrl: "https://c0001.example.invalid",
      servedArtifactDigest: artifact,
    },
    () => "2026-09-11T12:01:00.000Z",
  );
  assert.equal(ready.status, "ready");
  const mismatch = finalizeRelease(plan, {
    source: "provider-inspection",
    state: "ready",
    providerDeploymentId: "deploy-0002",
    applicationUrl: "https://c0001.example.invalid",
    servedArtifactDigest: `sha256:${"e".repeat(64)}`,
  });
  assert.equal(mismatch.status, "failed");
  assert.match(mismatch.failure ?? "", /did not confirm/);
});

test("rollback is scoped to two ready releases and the exact prior artifact", () => {
  const initialPlan = planRelease({
    kind: "release",
    clientId: "c0001",
    sourceSha: sha,
    artifactDigest: artifact,
    previousReleaseId: null,
    targetReleaseId: null,
    dataCompatibility: "backward-compatible",
  });
  const prior = finalizeRelease(initialPlan, {
    source: "provider-inspection",
    state: "ready",
    providerDeploymentId: "deploy-prior",
    applicationUrl: "https://c0001.example.invalid",
    servedArtifactDigest: artifact,
  });
  const nextPlan = planRelease({
    kind: "release",
    clientId: "c0001",
    sourceSha: "e".repeat(40),
    artifactDigest: `sha256:${"f".repeat(64)}`,
    previousReleaseId: prior.receiptId,
    targetReleaseId: null,
    dataCompatibility: "backward-compatible",
  });
  const current = finalizeRelease(nextPlan, {
    source: "provider-inspection",
    state: "ready",
    providerDeploymentId: "deploy-current",
    applicationUrl: "https://c0001.example.invalid",
    servedArtifactDigest: nextPlan.artifactDigest,
  });
  const rollback = planRollback(current, prior);
  assert.equal(rollback.kind, "rollback");
  assert.equal(rollback.targetReleaseId, prior.receiptId);
  assert.equal(rollback.artifactDigest, prior.artifactDigest);
});
