import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";
import { lstat, readFile } from "node:fs/promises";

import type { EvidenceKind, EvidenceRef, StormManifest } from "./types.ts";

const hex64 = /^[0-9a-f]{64}$/;
const sha256 = /^sha256:[0-9a-f]{64}$/;
const gitSha = /^[0-9a-f]{40}$/;
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function digest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
}

export function targetBinding(manifest: StormManifest) {
  const { evidence: _evidence, ...target } = manifest.target;
  return digest(target);
}

export function identityBinding(manifest: StormManifest) {
  const { evidence: _evidence, ...identity } = manifest.identity;
  return digest(identity);
}

export function leaseBinding(manifest: StormManifest) {
  const { evidence: _evidence, ...lease } = manifest.lease;
  return digest(lease);
}

export function authorizationBinding(manifest: StormManifest) {
  return digest({
    runId: manifest.runId,
    workflow: manifest.workflow,
    targetBindingDigest: targetBinding(manifest),
    identityBindingDigest: identityBinding(manifest),
    oracleBindingDigest: manifest.oracle.bindingDigest,
    limits: manifest.limits,
  });
}

export function runBinding(manifest: StormManifest) {
  return digest({
    runId: manifest.runId,
    workflow: manifest.workflow,
    targetBindingDigest: targetBinding(manifest),
    identityBindingDigest: identityBinding(manifest),
    oracleBindingDigest: manifest.oracle.bindingDigest,
    workerId: manifest.lease.workerId,
    limits: manifest.limits,
  });
}

function evidenceRef(value: unknown): value is EvidenceRef {
  return isRecord(value) && typeof value.path === "string" && isAbsolute(value.path) &&
    typeof value.sha256 === "string" && sha256.test(value.sha256);
}

export function validateManifest(value: unknown, now = Date.now()): string[] {
  const errors: string[] = [];
  const need = (condition: unknown, code: string) => { if (!condition) errors.push(code); };
  if (!isRecord(value)) return ["MANIFEST_INVALID"];
  const m = value as Partial<StormManifest>;
  need(m.schemaVersion === 1, "SCHEMA_VERSION_INVALID");
  need(typeof m.runId === "string" && /^[a-z][a-z0-9-]{2,63}$/.test(m.runId), "RUN_ID_INVALID");
  need(m.mode === "live" || m.mode === "fixture", "MODE_INVALID");
  need(typeof m.enabled === "boolean", "ENABLED_INVALID");
  need(m.workflow === "clara-c0001-baseline", "WORKFLOW_INVALID");
  need(evidenceRef(m.authorization), "AUTHORIZATION_EVIDENCE_INVALID");

  const target: Record<string, unknown> = isRecord(m.target) ? m.target : {};
  need(target.classification === "private-synthetic", "TARGET_CLASSIFICATION_INVALID");
  need(target.clientId === "c0001", "TARGET_CLIENT_INVALID");
  let origin: URL | undefined;
  try { if (typeof target.origin === "string") origin = new URL(target.origin); } catch { /* classified below */ }
  need(origin?.protocol === "https:" && origin.origin === target.origin && !origin.username && !origin.password,
    "TARGET_ORIGIN_INVALID");
  need(!origin || !["studio.oceanheart.ai", "oceanheart.ai", "www.oceanheart.ai"].includes(origin.hostname),
    "PRODUCTION_TARGET_DENIED");
  need(typeof target.integrationSha === "string" && gitSha.test(target.integrationSha), "INTEGRATION_SHA_INVALID");
  need(typeof target.applicationSourceSha === "string" && gitSha.test(target.applicationSourceSha), "APPLICATION_SOURCE_INVALID");
  need(typeof target.applicationReleaseId === "string" && hex64.test(target.applicationReleaseId), "APPLICATION_RELEASE_INVALID");
  need(typeof target.applicationArtifactDigest === "string" && sha256.test(target.applicationArtifactDigest), "APPLICATION_ARTIFACT_INVALID");
  need(typeof target.backendDeployment === "string" && identifier.test(target.backendDeployment) && target.backendDeployment !== "sensible-frog-663",
    "BACKEND_TARGET_INVALID");
  need(evidenceRef(target.evidence), "TARGET_EVIDENCE_INVALID");

  const identity: Record<string, unknown> = isRecord(m.identity) ? m.identity : {};
  need(identity.clientId === "c0001" && identity.kind === "operator" && identity.role === "owner", "IDENTITY_SCOPE_INVALID");
  need(typeof identity.actorId === "string" && identifier.test(identity.actorId), "ACTOR_ID_INVALID");
  need(typeof identity.subjectDigest === "string" && sha256.test(identity.subjectDigest), "SUBJECT_DIGEST_INVALID");
  need(typeof identity.runtimeActorDigest === "string" && sha256.test(identity.runtimeActorDigest), "RUNTIME_ACTOR_DIGEST_INVALID");
  need(evidenceRef(identity.evidence), "IDENTITY_EVIDENCE_INVALID");

  const lease: Record<string, unknown> = isRecord(m.lease) ? m.lease : {};
  need(typeof lease.workerId === "string" && identifier.test(lease.workerId), "WORKER_ID_INVALID");
  need(typeof lease.leaseId === "string" && identifier.test(lease.leaseId), "LEASE_ID_INVALID");
  need(Number.isSafeInteger(lease.epoch) && Number(lease.epoch) > 0, "LEASE_EPOCH_INVALID");
  need(typeof lease.owner === "string" && identifier.test(lease.owner), "LEASE_OWNER_INVALID");
  need(typeof lease.operatorSessionBindingDigest === "string" && sha256.test(lease.operatorSessionBindingDigest),
    "OPERATOR_SESSION_BINDING_INVALID");
  const expiresAt = typeof lease.expiresAt === "string" ? Date.parse(lease.expiresAt) : Number.NaN;
  need(Number.isFinite(expiresAt) && expiresAt > now, "LEASE_EXPIRED");
  need(evidenceRef(lease.evidence), "LEASE_EVIDENCE_INVALID");

  const oracle: Record<string, unknown> = isRecord(m.oracle) ? m.oracle : {};
  need(oracle.kind === "clara-durable-draft" && oracle.readOnly === true, "ORACLE_INVALID");
  need(typeof oracle.bindingDigest === "string" && sha256.test(oracle.bindingDigest), "ORACLE_BINDING_INVALID");
  need(evidenceRef(oracle.evidence), "ORACLE_EVIDENCE_INVALID");

  const limits: Record<string, unknown> = isRecord(m.limits) ? m.limits : {};
  need(Number.isSafeInteger(limits.maxActions) && Number(limits.maxActions) >= 1 && Number(limits.maxActions) <= 5, "ACTION_BUDGET_INVALID");
  const maxSeconds = m.mode === "live" ? 600 : 180;
  need(Number.isSafeInteger(limits.maxSeconds) && Number(limits.maxSeconds) >= 1 && Number(limits.maxSeconds) <= maxSeconds,
    "TIME_BUDGET_INVALID");
  need(limits.maxModelDecisions === 0, "MODEL_DECISIONS_DENIED");
  need(limits.maxCostMicros === 0, "MODEL_COST_DENIED");
  if (Number.isFinite(expiresAt) && Number.isSafeInteger(limits.maxSeconds))
    need(expiresAt >= now + Number(limits.maxSeconds) * 1000, "LEASE_TOO_SHORT");
  need(m.providersEnabled === false, "PROVIDERS_DENIED");
  need(Array.isArray(m.faults) && m.faults.length === 0, "FAULTS_DENIED");
  if (m.mode === "live") need(m.enabled === true, "LIVE_RUN_DISABLED");
  return [...new Set(errors)];
}

type EvidenceReceipt = {
  schemaVersion: 1;
  kind: EvidenceKind;
  bindingDigest: `sha256:${string}`;
  observedAt: string;
  expiresAt?: string;
  syntheticOnly?: true;
};

async function verifyReceipt(ref: EvidenceRef, kind: EvidenceKind, expectedBinding: string, now: number) {
  const info = await lstat(ref.path);
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.size > 64 * 1024)
    throw new Error("EVIDENCE_FILE_UNSAFE");
  const bytes = await readFile(ref.path);
  if (`sha256:${createHash("sha256").update(bytes).digest("hex")}` !== ref.sha256)
    throw new Error("EVIDENCE_HASH_MISMATCH");
  let receipt: EvidenceReceipt;
  try { receipt = JSON.parse(bytes.toString("utf8")) as EvidenceReceipt; }
  catch { throw new Error("EVIDENCE_JSON_INVALID"); }
  if (receipt.schemaVersion !== 1 || receipt.kind !== kind || receipt.bindingDigest !== expectedBinding ||
    !Number.isFinite(Date.parse(receipt.observedAt))) throw new Error("EVIDENCE_BINDING_MISMATCH");
  if ((kind === "target" || kind === "identity" || kind === "oracle") && receipt.syntheticOnly !== true)
    throw new Error("SYNTHETIC_EVIDENCE_REQUIRED");
  if ((kind === "authorization" || kind === "lease") &&
    (!receipt.expiresAt || !Number.isFinite(Date.parse(receipt.expiresAt)) || Date.parse(receipt.expiresAt) <= now))
    throw new Error("EVIDENCE_EXPIRED");
}

export async function verifyLiveManifest(manifest: StormManifest, now = Date.now()) {
  const errors = validateManifest(manifest, now);
  if (errors.length) throw new Error(errors[0]);
  if (manifest.mode !== "live" || manifest.enabled !== true) throw new Error("LIVE_RUN_DISABLED");
  await verifyReceipt(manifest.target.evidence, "target", targetBinding(manifest), now);
  await verifyReceipt(manifest.identity.evidence, "identity", identityBinding(manifest), now);
  await verifyReceipt(manifest.lease.evidence, "lease", leaseBinding(manifest), now);
  await verifyReceipt(manifest.oracle.evidence, "oracle", manifest.oracle.bindingDigest, now);
  await verifyReceipt(manifest.authorization, "authorization", authorizationBinding(manifest), now);
  return {
    manifestDigest: digest(manifest),
    runBindingDigest: runBinding(manifest),
    targetBindingDigest: targetBinding(manifest),
    identityBindingDigest: identityBinding(manifest),
  };
}
