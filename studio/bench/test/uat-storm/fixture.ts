import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  authorizationBinding,
  identityBinding,
  leaseBinding,
  targetBinding,
} from "../../src/uat-storm/manifest.ts";
import type { EvidenceKind, EvidenceRef, StormManifest } from "../../src/uat-storm/types.ts";

export function liveManifest(root: string, runId = "storm-live-test", epoch = 1): StormManifest {
  const placeholder = (name: string): EvidenceRef => ({ path: join(root, `${name}.json`), sha256: `sha256:${"0".repeat(64)}` });
  return {
    schemaVersion: 1,
    runId,
    mode: "live",
    enabled: true,
    workflow: "clara-c0001-baseline",
    authorization: placeholder("authorization"),
    target: {
      classification: "private-synthetic", clientId: "c0001", origin: "https://studio-c0001.example.invalid",
      integrationSha: "a".repeat(40), applicationSourceSha: "b".repeat(40),
      applicationReleaseId: "c".repeat(64), applicationArtifactDigest: `sha256:${"d".repeat(64)}`,
      backendDeployment: "synthetic-backend", evidence: placeholder("target"),
    },
    identity: {
      clientId: "c0001", actorId: "kai-operator", kind: "operator", role: "owner",
      subjectDigest: `sha256:${"e".repeat(64)}`, runtimeActorDigest: `sha256:${"2".repeat(64)}`, evidence: placeholder("identity"),
    },
    lease: {
      workerId: "root-chrome", leaseId: `lease-${epoch}`, epoch, owner: "root",
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      operatorSessionBindingDigest: `sha256:${"f".repeat(64)}`, evidence: placeholder("lease"),
    },
    oracle: {
      kind: "clara-durable-draft", readOnly: true, bindingDigest: `sha256:${"1".repeat(64)}`,
      evidence: placeholder("oracle"),
    },
    limits: { maxActions: 5, maxSeconds: 180, maxModelDecisions: 0, maxCostMicros: 0 },
    providersEnabled: false,
    faults: [],
  };
}

async function receipt(root: string, kind: EvidenceKind, bindingDigest: string, expiresAt?: string) {
  const path = join(root, `${kind}.json`);
  const value = {
    schemaVersion: 1,
    kind,
    bindingDigest,
    observedAt: new Date().toISOString(),
    ...(["target", "identity", "oracle"].includes(kind) ? { syntheticOnly: true } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  await writeFile(path, bytes, { mode: 0o600 });
  return { path, sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}` as const };
}

export async function writeEvidence(manifest: StormManifest) {
  const root = dirname(manifest.authorization.path);
  await mkdir(root, { recursive: true, mode: 0o700 });
  manifest.target.evidence = await receipt(root, "target", targetBinding(manifest));
  manifest.identity.evidence = await receipt(root, "identity", identityBinding(manifest));
  manifest.lease.evidence = await receipt(root, "lease", leaseBinding(manifest), manifest.lease.expiresAt);
  manifest.oracle.evidence = await receipt(root, "oracle", manifest.oracle.bindingDigest);
  manifest.authorization = await receipt(root, "authorization", authorizationBinding(manifest), manifest.lease.expiresAt);
  return manifest;
}
