#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import {
  authorizationBinding,
  digest,
  identityBinding,
  leaseBinding,
  targetBinding,
  verifyLiveManifest,
} from "../../src/uat-storm/manifest.ts";
import type { EvidenceRef, StormManifest } from "../../src/uat-storm/types.ts";

type Json = Record<string, unknown>;
const record = (value: unknown): value is Json => value !== null && typeof value === "object" && !Array.isArray(value);
const sha256 = (value: string | Buffer) => `sha256:${createHash("sha256").update(value).digest("hex")}` as const;

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error("PREPARE_OPTION_REQUIRED");
  return value;
}

async function privateJson(path: string): Promise<Json> {
  if (!isAbsolute(path)) throw new Error("PREPARE_PATH_INVALID");
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 128 * 1024 || (info.mode & 0o077) !== 0)
    throw new Error("PREPARE_INPUT_UNSAFE");
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!record(value)) throw new Error("PREPARE_INPUT_INVALID");
  return value;
}

function field(value: unknown, name: string): Json {
  if (!record(value)) throw new Error(`PREPARE_${name}_INVALID`);
  return value;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`PREPARE_${name}_INVALID`);
  return value;
}

async function writePrivate(path: string, value: unknown): Promise<EvidenceRef> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  return { path, sha256: sha256(bytes) };
}

async function main(): Promise<void> {
  const output = option("--output");
  const runId = option("--run-id");
  const browserId = option("--browser-id");
  const tabId = option("--tab-id");
  const expiresAt = option("--expires-at");
  const releasePath = option("--release-receipt");
  const providerPath = option("--provider-receipt");
  const identityPath = option("--identity-receipt");
  const authorizationMapPath = option("--authorization-map");
  const oracleSourcePath = option("--oracle-source");
  if (!isAbsolute(output) || !/^[a-z][a-z0-9-]{2,63}$/.test(runId) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(browserId) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(tabId)) throw new Error("PREPARE_BINDING_INVALID");
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || expiry < Date.now() + 600_000) throw new Error("PREPARE_EXPIRY_INVALID");
  await mkdir(output, { recursive: false, mode: 0o700 });
  const outputInfo = await lstat(output);
  if (!outputInfo.isDirectory() || outputInfo.isSymbolicLink() || (outputInfo.mode & 0o777) !== 0o700 ||
    (await readdir(output)).length !== 0) throw new Error("PREPARE_OUTPUT_UNSAFE");

  const [release, provider, identityReceipt, authorizationMap] = await Promise.all([
    privateJson(releasePath), privateJson(providerPath), privateJson(identityPath), privateJson(authorizationMapPath),
  ]);
  const source = field(release.source, "RELEASE_SOURCE");
  const app = field(release.application, "RELEASE_APPLICATION");
  const releaseState = field(release.releaseState, "RELEASE_STATE");
  const binding = field(provider.dedicatedBinding, "PROVIDER_BINDING");
  const convex = field(binding.convex, "PROVIDER_CONVEX");
  const verified = field(identityReceipt.verifiedIdentity, "VERIFIED_IDENTITY");
  const target = field(identityReceipt.target, "IDENTITY_TARGET");
  const subject = text(verified.subject, "SUBJECT");
  if (verified.emailVerified !== true || verified.emailExactMatch !== true || binding.clientId !== "c0001" ||
    target.clientId !== "c0001" || release.environment !== "dedicated synthetic" ||
    releaseState.merged !== true || releaseState.production !== false) throw new Error("PREPARE_SCOPE_INVALID");
  const authorizations = Array.isArray(authorizationMap.authorizations) ? authorizationMap.authorizations : [];
  const matches = authorizations.filter((entry) => record(entry) && entry.subject === subject && entry.clientId === "c0001" &&
    entry.environmentId === target.environmentId && entry.audience === target.audience);
  if (matches.length !== 1) throw new Error("PREPARE_AUTHORIZATION_INVALID");

  const subjectDigest = sha256(subject);
  const runtimeActor = `actor:${createHash("sha256").update(`workos:${subject}`).digest("hex")}`;
  const runtimeActorDigest = sha256(runtimeActor);
  const observedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    runId,
    mode: "live",
    enabled: true,
    workflow: "clara-c0001-baseline",
    authorization: {} as EvidenceRef,
    target: {
      classification: "private-synthetic", clientId: "c0001", origin: text(app.privateUrl, "PRIVATE_URL"),
      integrationSha: text(releaseState.mergeSha, "MERGE_SHA"),
      applicationSourceSha: text(source.commit, "SOURCE_SHA"),
      applicationReleaseId: text(app.releaseId, "RELEASE_ID"),
      applicationArtifactDigest: text(app.artifactDigest, "ARTIFACT_DIGEST") as `sha256:${string}`,
      backendDeployment: text(convex.deploymentName, "BACKEND_DEPLOYMENT"), evidence: {} as EvidenceRef,
    },
    identity: {
      clientId: "c0001", actorId: "kai-operator", kind: "operator", role: "owner",
      subjectDigest, runtimeActorDigest, evidence: {} as EvidenceRef,
    },
    lease: {
      workerId: browserId, leaseId: `lease-${runId}`, epoch: 1, owner: "kai-operator", expiresAt,
      operatorSessionBindingDigest: "" as `sha256:${string}`, evidence: {} as EvidenceRef,
    },
    oracle: {
      kind: "clara-durable-draft", readOnly: true,
      bindingDigest: "" as `sha256:${string}`, evidence: {} as EvidenceRef,
    },
    limits: { maxActions: 5, maxSeconds: 600, maxModelDecisions: 0, maxCostMicros: 0 },
    providersEnabled: false,
    faults: [],
  } satisfies StormManifest;

  const sessionBinding = {
    schemaVersion: 1, executionMode: "hosted-operator-driven", browserId, tabId,
    tabUrl: `${manifest.target.origin}/app`, subjectDigest, operatorControl: true, operatorSession: true,
    dedicatedProfile: false, fictionalDataOnly: true, exclusiveLeaseId: manifest.lease.leaseId,
  };
  manifest.lease.operatorSessionBindingDigest = digest(sessionBinding);
  const oracleSource = await readFile(oracleSourcePath);
  manifest.oracle.bindingDigest = digest({
    clientId: "c0001", backendDeployment: manifest.target.backendDeployment,
    runtimeActorDigest, configurationVersion: "clara-2026-09-01", expectedTotalMinor: 12000,
    expectedTraceEvents: 22, sourceDigest: sha256(oracleSource), readOnly: true,
  });

  const targetEvidence = await writePrivate(join(output, "target.json"), {
    schemaVersion: 1, kind: "target", bindingDigest: targetBinding(manifest), observedAt, syntheticOnly: true,
    sourceReceiptDigest: sha256(await readFile(releasePath)), providerReceiptDigest: sha256(await readFile(providerPath)),
  });
  const identityEvidence = await writePrivate(join(output, "identity.json"), {
    schemaVersion: 1, kind: "identity", bindingDigest: identityBinding(manifest), observedAt, syntheticOnly: true,
    subjectDigest, authorizationMapDigest: sha256(await readFile(authorizationMapPath)), exactAuthorizationMatches: 1,
  });
  const sessionEvidence = await writePrivate(join(output, "operator-session.json"), {
    ...sessionBinding, observedAt, bindingDigest: manifest.lease.operatorSessionBindingDigest,
  });
  const leaseEvidence = await writePrivate(join(output, "lease.json"), {
    schemaVersion: 1, kind: "lease", bindingDigest: leaseBinding(manifest), observedAt, expiresAt,
    operatorSessionEvidence: sessionEvidence,
  });
  const oracleEvidence = await writePrivate(join(output, "oracle.json"), {
    schemaVersion: 1, kind: "oracle", bindingDigest: manifest.oracle.bindingDigest, observedAt, syntheticOnly: true,
    sourceDigest: sha256(oracleSource), stateRoot: "/var/lib/studio-pi-runtime/c0001", access: "read-only",
  });
  manifest.target.evidence = targetEvidence;
  manifest.identity.evidence = identityEvidence;
  manifest.lease.evidence = leaseEvidence;
  manifest.oracle.evidence = oracleEvidence;
  manifest.authorization = await writePrivate(join(output, "authorization.json"), {
    schemaVersion: 1, kind: "authorization", bindingDigest: authorizationBinding(manifest), observedAt, expiresAt,
    scope: "one-c0001-hosted-operator-driven-baseline-pilot",
  });
  const manifestRef = await writePrivate(join(output, "manifest.json"), manifest);
  await verifyLiveManifest(manifest);
  process.stdout.write(`${JSON.stringify({ manifest: manifestRef.path, runId, executable: true })}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "PREPARE_FAILED"}\n`);
  process.exitCode = 1;
});
