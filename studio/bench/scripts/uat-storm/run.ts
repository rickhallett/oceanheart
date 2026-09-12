#!/usr/bin/env node
import { lstat, open, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { FixtureStormAdapter, type FixtureFault, UnixSocketStormAdapter } from "../../src/uat-storm/adapter.ts";
import { StormJournal } from "../../src/uat-storm/journal.ts";
import { validateManifest, verifyLiveManifest } from "../../src/uat-storm/manifest.ts";
import { writeReport } from "../../src/uat-storm/report.ts";
import { ClaraStormRunner, fixtureBindings } from "../../src/uat-storm/runner.ts";
import type { StormManifest } from "../../src/uat-storm/types.ts";

const args = process.argv.slice(2);
const command = args.shift();
const values = new Map<string, string>();
let resume = false;
for (let index = 0; index < args.length; index++) {
  const key = args[index]!;
  if (key === "--resume") { resume = true; continue; }
  const value = args[++index];
  if (!key.startsWith("--") || value === undefined) usage();
  values.set(key, value);
}
function usage(): never {
  process.stderr.write("Usage: run.ts validate --manifest FILE | fixture --run ID --artifacts DIR [--fault lost-response|duplicate-effect|effect-absent] | live --manifest FILE --artifacts DIR --socket PATH [--response-timeout-ms N] [--resume]\n");
  process.exit(2);
}
const required = (key: string) => values.get(key) ?? usage();

async function readManifest(path: string, requirePrivate: boolean) {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024 || (requirePrivate && (info.mode & 0o077) !== 0))
    throw new Error("MANIFEST_FILE_UNSAFE");
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function writeManifestSnapshot(journal: StormJournal, manifest: StormManifest, isResume: boolean) {
  const name = isResume ? `manifest-epoch-${manifest.lease.epoch}.json` : "manifest.json";
  const handle = await open(join(journal.directory, name), "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`); await handle.sync(); }
  finally { await handle.close(); }
}

function fixtureManifest(runId: string): StormManifest {
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const emptyRef = { path: "/fixture/not-read", sha256: `sha256:${"0".repeat(64)}` as const };
  return {
    schemaVersion: 1,
    runId,
    mode: "fixture",
    enabled: false,
    workflow: "clara-c0001-baseline",
    authorization: emptyRef,
    target: {
      classification: "private-synthetic", clientId: "c0001", origin: "https://fixture.invalid",
      integrationSha: "0".repeat(40), applicationSourceSha: "1".repeat(40),
      applicationReleaseId: "2".repeat(64), applicationArtifactDigest: `sha256:${"3".repeat(64)}`,
      backendDeployment: "fixture-backend", evidence: emptyRef,
    },
    identity: {
      clientId: "c0001", actorId: "fixture-operator", kind: "operator", role: "owner",
      subjectDigest: `sha256:${"4".repeat(64)}`, runtimeActorDigest: `sha256:${"7".repeat(64)}`, evidence: emptyRef,
    },
    lease: {
      workerId: "fixture-worker", leaseId: "fixture-lease", epoch: 1, owner: "fixture-operator", expiresAt,
      operatorSessionBindingDigest: `sha256:${"5".repeat(64)}`, evidence: emptyRef,
    },
    oracle: { kind: "clara-durable-draft", readOnly: true, bindingDigest: `sha256:${"6".repeat(64)}`, evidence: emptyRef },
    limits: { maxActions: 5, maxSeconds: 180, maxModelDecisions: 0, maxCostMicros: 0 },
    providersEnabled: false,
    faults: [],
  };
}

try {
  if (command === "validate") {
    const path = required("--manifest");
    const value = await readManifest(path, false);
    const errors = validateManifest(value);
    let evidenceVerified = false;
    if (errors.length === 0 && (value as StormManifest).mode === "live") {
      await verifyLiveManifest(value as StormManifest);
      evidenceVerified = true;
    }
    process.stdout.write(`${JSON.stringify({ valid: errors.length === 0, evidenceVerified,
      executable: errors.length === 0 && evidenceVerified && (value as StormManifest).enabled === true, errors })}\n`);
    process.exitCode = errors.length === 0 ? 0 : 1;
  } else if (command === "fixture") {
    if (resume) usage();
    const runId = required("--run");
    const root = required("--artifacts");
    if (!isAbsolute(root)) throw new Error("ARTIFACT_ROOT_INVALID");
    const fault = (values.get("--fault") ?? null) as FixtureFault;
    if (![null, "lost-response", "duplicate-effect", "effect-absent"].includes(fault)) usage();
    const manifest = fixtureManifest(runId);
    const bindings = fixtureBindings(manifest);
    const journal = await StormJournal.create(root, runId);
    await writeManifestSnapshot(journal, manifest, false);
    const adapter = new FixtureStormAdapter({
      schemaVersion: 1, executionMode: "fixture", adapterId: "fixture-adapter",
      targetBindingDigest: bindings.targetBindingDigest as `sha256:${string}`,
      identityBindingDigest: bindings.identityBindingDigest as `sha256:${string}`,
      oracleBindingDigest: manifest.oracle.bindingDigest,
      leaseId: manifest.lease.leaseId, epoch: manifest.lease.epoch, expiresAt: manifest.lease.expiresAt,
      operatorSessionBindingDigest: manifest.lease.operatorSessionBindingDigest,
      operatorControl: false, operatorSession: false, dedicatedProfile: false, fictionalDataOnly: true,
    }, fault);
    const outcome = await new ClaraStormRunner(manifest, bindings, journal, adapter).run();
    const report = await writeReport(journal.directory, manifest, journal.events, outcome);
    process.stdout.write(`${JSON.stringify({ directory: journal.directory, classification: outcome.classification,
      evidenceClass: report.evidenceClass })}\n`);
    process.exitCode = outcome.classification === "complete" ? 0 : 1;
  } else if (command === "live") {
    const path = required("--manifest");
    const root = required("--artifacts");
    const socket = required("--socket");
    if (!isAbsolute(root)) throw new Error("ARTIFACT_ROOT_INVALID");
    const manifest = await readManifest(path, true) as StormManifest;
    const bindings = await verifyLiveManifest(manifest);
    const journal = resume ? await StormJournal.resume(root, manifest.runId) : await StormJournal.create(root, manifest.runId);
    await writeManifestSnapshot(journal, manifest, resume);
    const responseTimeoutMs = Number(values.get("--response-timeout-ms") ?? manifest.limits.maxSeconds * 1_000);
    const outcome = await new ClaraStormRunner(
      manifest,
      bindings,
      journal,
      new UnixSocketStormAdapter(socket, responseTimeoutMs),
    ).run();
    const report = await writeReport(journal.directory, manifest, journal.events, outcome);
    process.stdout.write(`${JSON.stringify({ directory: journal.directory, classification: outcome.classification,
      evidenceClass: report.evidenceClass })}\n`);
    process.exitCode = outcome.classification === "complete" ? 0 : 1;
  } else usage();
} catch {
  process.stderr.write("UAT storm command failed closed; preserve the private run directory and inspect its factual journal.\n");
  process.exitCode = 1;
}
