import { lstat, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { BindingCredentialRefs } from "./binding-types.ts";
import { containsBindingSecretMaterial } from "./binding-validation.ts";

export type ApprovedProviderTarget = {
  schemaVersion: 1;
  clientId: string;
  mode: "synthetic";
  scope: "dedicated";
  sourceSha: string;
  manifestHash: string;
  approvedAt: string;
  credentialRefs: BindingCredentialRefs;
  convex: {
    teamId: number;
    projectName: string;
    deploymentReference: string;
    deploymentType: "dev";
  };
  workos: {
    teamId: string;
    projectId: string;
    parentEnvironmentId: string;
    environmentName: string;
  };
};

const opaqueId = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

function hasExactKeys(value: unknown, keys: readonly string[]) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function validateApprovedProviderTarget(value: ApprovedProviderTarget): ApprovedProviderTarget {
  if (
    !hasExactKeys(value, [
      "schemaVersion", "clientId", "mode", "scope", "sourceSha", "manifestHash",
      "approvedAt", "credentialRefs", "convex", "workos",
    ]) ||
    !hasExactKeys(value.credentialRefs, ["backend", "identity"]) ||
    !hasExactKeys(value.convex, ["teamId", "projectName", "deploymentReference", "deploymentType"]) ||
    !hasExactKeys(value.workos, ["teamId", "projectId", "parentEnvironmentId", "environmentName"]) ||
    containsBindingSecretMaterial(JSON.stringify(value)) ||
    value.schemaVersion !== 1 || value.mode !== "synthetic" || value.scope !== "dedicated" ||
    !/^c[0-9]{4,}$/.test(value.clientId) || !/^[0-9a-f]{40}$/.test(value.sourceSha) ||
    !/^[0-9a-f]{64}$/.test(value.manifestHash) ||
    !Number.isFinite(Date.parse(value.approvedAt)) ||
    !Number.isSafeInteger(value.convex.teamId) || value.convex.teamId < 1 ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,79}$/.test(value.convex.projectName) ||
    !/^dev\/[A-Za-z0-9][A-Za-z0-9/-]{2,95}$/.test(value.convex.deploymentReference) ||
    value.convex.deploymentType !== "dev" ||
    !opaqueId.test(value.workos.teamId) || !opaqueId.test(value.workos.projectId) ||
    !/^environment_[A-Za-z0-9]{8,127}$/.test(value.workos.parentEnvironmentId) ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,79}$/.test(value.workos.environmentName) ||
    value.credentialRefs.backend !== `secretref://${value.clientId}/controller/convex` ||
    value.credentialRefs.identity !== `secretref://${value.clientId}/controller/workos`
  ) throw new Error("INVALID_APPROVED_PROVIDER_TARGET");
  return structuredClone(value);
}

export async function readApprovedProviderTarget(path: string) {
  if (resolve(path) !== path || dirname(path) === path)
    throw new Error("PROVIDER_TARGET_PATH_MUST_BE_PRIVATE_ABSOLUTE_FILE");
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0)
    throw new Error("PROVIDER_TARGET_REGISTRATION_NOT_PRIVATE");
  let parsed: ApprovedProviderTarget;
  try { parsed = JSON.parse(await readFile(path, "utf8")) as ApprovedProviderTarget; }
  catch { throw new Error("INVALID_APPROVED_PROVIDER_TARGET"); }
  return validateApprovedProviderTarget(parsed);
}
