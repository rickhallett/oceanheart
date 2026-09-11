import { createHash } from "node:crypto";
import type { ReleasePlan, ReleaseReceipt } from "./types.ts";

const fullSha = /^[0-9a-f]{40}$/;
const digest = /^sha256:[0-9a-f]{64}$/;
const clientId = /^c[0-9]{4,}$/;

export type ProviderReleaseObservation = {
  source: "provider-inspection";
  state: "ready" | "failed";
  providerDeploymentId: string;
  applicationUrl: string;
  servedArtifactDigest: string | null;
};

export type ReleasePlanInput = {
  kind: "release" | "rollback";
  clientId: string;
  sourceSha: string;
  artifactDigest: string;
  previousReleaseId: string | null;
  targetReleaseId: string | null;
  dataCompatibility: "no-change" | "backward-compatible";
  now?: () => string;
};

function assertIdentifier(value: string | null, label: string) {
  if (value !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/.test(value))
    throw new Error(`${label} has an invalid format`);
}

export function planRelease(input: ReleasePlanInput): ReleasePlan {
  if (!clientId.test(input.clientId)) throw new Error("Invalid client ID");
  if (!fullSha.test(input.sourceSha)) throw new Error("Release requires a full source SHA");
  if (!digest.test(input.artifactDigest)) throw new Error("Release requires a SHA-256 artifact digest");
  assertIdentifier(input.previousReleaseId, "previousReleaseId");
  assertIdentifier(input.targetReleaseId, "targetReleaseId");
  if (input.kind === "release" && input.targetReleaseId !== null)
    throw new Error("A forward release cannot name a prior target release");
  if (input.kind === "rollback" && input.targetReleaseId === null)
    throw new Error("Rollback requires an exact prior target release");
  const receiptId = createHash("sha256")
    .update(
      `${input.kind}:${input.clientId}:${input.sourceSha}:${input.artifactDigest}:${input.previousReleaseId ?? "none"}:${input.targetReleaseId ?? "new"}:${input.dataCompatibility}`,
    )
    .digest("hex");
  return {
    schemaVersion: 1,
    kind: input.kind,
    receiptId,
    clientId: input.clientId,
    sourceSha: input.sourceSha,
    artifactDigest: input.artifactDigest,
    previousReleaseId: input.previousReleaseId,
    targetReleaseId: input.targetReleaseId,
    dataCompatibility: input.dataCompatibility,
    status: "planned",
    createdAt: (input.now ?? (() => new Date().toISOString()))(),
  };
}

export function finalizeRelease(
  plan: ReleasePlan,
  observation: ProviderReleaseObservation,
  now: () => string = () => new Date().toISOString(),
): ReleaseReceipt {
  if (observation.source !== "provider-inspection")
    throw new Error("Release completion requires provider inspection");
  if (!observation.providerDeploymentId.trim())
    throw new Error("Provider inspection omitted deployment identity");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{1,127}$/.test(observation.providerDeploymentId))
    throw new Error("Provider inspection returned an invalid deployment identity");
  let url: URL;
  try {
    url = new URL(observation.applicationUrl);
  } catch {
    throw new Error("Provider inspection omitted an HTTPS application URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Provider inspection omitted an HTTPS application URL");
  if (
    observation.servedArtifactDigest !== null &&
    !digest.test(observation.servedArtifactDigest)
  )
    throw new Error("Provider inspection returned an invalid artifact digest");
  const matched = observation.servedArtifactDigest === plan.artifactDigest;
  const ready = observation.state === "ready" && matched;
  return {
    ...plan,
    status: ready ? "ready" : "failed",
    providerDeploymentId: observation.providerDeploymentId,
    servedArtifactDigest: observation.servedArtifactDigest,
    applicationUrl: observation.applicationUrl,
    verifiedAt: now(),
    ...(ready ? {} : { failure: "Provider inspection did not confirm the planned artifact" }),
  };
}

export function planRollback(
  current: ReleaseReceipt,
  target: ReleaseReceipt,
  now?: () => string,
) {
  if (current.status !== "ready" || target.status !== "ready")
    throw new Error("Rollback requires two provider-confirmed ready releases");
  if (current.clientId !== target.clientId)
    throw new Error("Rollback releases must belong to the same client");
  return planRelease({
    kind: "rollback",
    clientId: current.clientId,
    sourceSha: target.sourceSha,
    artifactDigest: target.artifactDigest,
    previousReleaseId: current.receiptId,
    targetReleaseId: target.receiptId,
    dataCompatibility: target.dataCompatibility,
    now,
  });
}
