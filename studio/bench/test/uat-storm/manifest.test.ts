import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { validateManifest, verifyLiveManifest } from "../../src/uat-storm/manifest.ts";
import { liveManifest, writeEvidence } from "./fixture.ts";

test("a complete private live manifest binds every evidence receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "storm-manifest-"));
  const manifest = await writeEvidence(liveManifest(root));
  assert.deepEqual(validateManifest(manifest), []);
  const verified = await verifyLiveManifest(manifest);
  assert.match(verified.manifestDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(verified.runBindingDigest, /^sha256:[0-9a-f]{64}$/);
});

test("production, cost, faults, missing operator binding and disabled live execution fail closed", () => {
  const manifest = liveManifest("/private/evidence");
  manifest.enabled = false;
  manifest.target.origin = "https://studio.oceanheart.ai";
  manifest.target.backendDeployment = "sensible-frog-663";
  manifest.lease.operatorSessionBindingDigest = "bad" as `sha256:${string}`;
  manifest.limits.maxCostMicros = 1 as 0;
  manifest.faults = ["network"] as unknown as [];
  const errors = validateManifest(manifest);
  for (const code of ["PRODUCTION_TARGET_DENIED", "BACKEND_TARGET_INVALID", "OPERATOR_SESSION_BINDING_INVALID",
    "MODEL_COST_DENIED", "FAULTS_DENIED", "LIVE_RUN_DISABLED"]) assert.ok(errors.includes(code), code);
});

test("changed receipt content is rejected before a live adapter can open", async () => {
  const root = await mkdtemp(join(tmpdir(), "storm-evidence-"));
  const manifest = await writeEvidence(liveManifest(root));
  const receipt = JSON.parse(await readFile(manifest.target.evidence.path, "utf8"));
  receipt.bindingDigest = `sha256:${"9".repeat(64)}`;
  await writeFile(manifest.target.evidence.path, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
  await assert.rejects(verifyLiveManifest(manifest), /EVIDENCE_HASH_MISMATCH/);
});
