import { createHash } from "node:crypto";

import { hashManifest, validateManifest } from "./manifest.ts";
import type {
  BackendIdentityBinding,
  BindingCredentialRefs,
  BindingRequest,
  ProviderEnvironmentBinding,
} from "./binding-types.ts";

const fullSha = /^[0-9a-f]{40}$/;
const digest = /^[0-9a-f]{64}$/;
const clientId = /^c[0-9]{4,}$/;
const providerId = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const workosAudience = /^client_[A-Za-z0-9]{8,127}$/;
const secretMaterial =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+|\bgh[pousr]_[A-Za-z0-9]+|\bgithub_pat_[A-Za-z0-9_]+|\bwhsec_[A-Za-z0-9]+|\bBearer\s+[A-Za-z0-9._~-]+/;

export function containsBindingSecretMaterial(value: string) {
  return secretMaterial.test(value);
}

export function workosIssuerForAudience(value: string) {
  if (!workosAudience.test(value)) throw new Error("INVALID_BINDING_IDENTITY");
  return `https://api.workos.com/user_management/${value}`;
}

function exactSecretRef(value: string, expected: string) {
  if (value !== expected || containsBindingSecretMaterial(value))
    throw new Error("INVALID_BINDING_CREDENTIAL_REFERENCE");
}

function safeHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("INVALID_BINDING_BACKEND_URL");
  }
  const authority = url.href.slice(`${url.protocol}//`.length).split("/", 1)[0] ?? "";
  if (
    url.protocol !== "https:" || authority.includes("@") || url.port ||
    url.pathname !== "/" || url.search || url.hash ||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.convex\.cloud$/.test(url.hostname)
  ) throw new Error("INVALID_BINDING_BACKEND_URL");
  return url.toString();
}

export function prepareBindingRequest(input: {
  manifest: unknown;
  sourceSha: string;
  credentialRefs: BindingCredentialRefs;
}): BindingRequest {
  const manifest = validateManifest(input.manifest);
  if (manifest.mode !== "synthetic" || manifest.data.backendRef !== `synthetic://${manifest.clientId}/backend`)
    throw new Error("BINDING_REQUIRES_SYNTHETIC_BACKEND");
  if (!fullSha.test(input.sourceSha)) throw new Error("INVALID_BINDING_SOURCE_SHA");
  if (input.sourceSha !== manifest.template.sourceSha) throw new Error("BINDING_SOURCE_MISMATCH");
  exactSecretRef(input.credentialRefs.backend, `secretref://${manifest.clientId}/controller/convex`);
  exactSecretRef(input.credentialRefs.identity, `secretref://${manifest.clientId}/controller/workos`);
  return {
    schemaVersion: 1,
    clientId: manifest.clientId,
    mode: "synthetic",
    manifestHash: hashManifest(manifest),
    sourceSha: input.sourceSha,
    providers: { backend: "convex", identity: "workos" },
    credentialRefs: structuredClone(input.credentialRefs),
  };
}

export function hashBindingRequest(request: BindingRequest) {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

export function validateProviderBinding(
  value: ProviderEnvironmentBinding,
  request: BindingRequest,
  operationId: string,
  observedAt: string,
): BackendIdentityBinding {
  if (
    value.classification !== "synthetic" ||
    value.isolation !== "dedicated"
  ) throw new Error("BINDING_TARGET_NOT_DEDICATED_SYNTHETIC");
  if (value.attestedClientId !== request.clientId) throw new Error("BINDING_CLIENT_MISMATCH");
  if (!providerId.test(value.environmentId)) throw new Error("INVALID_BINDING_ENVIRONMENT_ID");
  if (
    value.backend.provider !== "convex" ||
    !providerId.test(value.backend.deploymentId)
  ) throw new Error("INVALID_BINDING_BACKEND_IDENTITY");
  const url = safeHttpsUrl(value.backend.url);
  if (
    value.identity.provider !== "workos" ||
    !providerId.test(value.identity.environmentId) ||
    value.identity.environmentId !== value.environmentId ||
    !workosAudience.test(value.identity.audience) ||
    value.identity.issuer !== workosIssuerForAudience(value.identity.audience)
  ) throw new Error("INVALID_BINDING_IDENTITY");
  if (!digest.test(operationId)) throw new Error("INVALID_BINDING_OPERATION_ID");
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("INVALID_BINDING_OBSERVED_AT");
  return {
    schemaVersion: 1,
    clientId: request.clientId,
    environmentId: value.environmentId,
    mode: "synthetic",
    scope: "dedicated",
    backend: { ...value.backend, url },
    identity: structuredClone(value.identity),
    provenance: {
      manifestHash: request.manifestHash,
      sourceSha: request.sourceSha,
      operationId,
      source: "controller-inspection",
      observedAt,
    },
    status: "ready",
    credentialRefs: structuredClone(request.credentialRefs),
  };
}

export function validateBinding(value: BackendIdentityBinding, request: BindingRequest) {
  const observed: ProviderEnvironmentBinding = {
    environmentId: value.environmentId,
    classification: "synthetic",
    isolation: value.scope,
    attestedClientId: value.clientId,
    backend: value.backend,
    identity: value.identity,
  };
  const expected = validateProviderBinding(
    observed,
    request,
    value.provenance.operationId,
    value.provenance.observedAt,
  );
  if (
    value.schemaVersion !== 1 || value.status !== "ready" || value.mode !== "synthetic" ||
    value.provenance.manifestHash !== request.manifestHash ||
    value.provenance.sourceSha !== request.sourceSha ||
    value.provenance.source !== "controller-inspection" ||
    JSON.stringify(value) !== JSON.stringify(expected)
  ) throw new Error("INVALID_BACKEND_IDENTITY_BINDING");
  return structuredClone(expected);
}

export function validateBindingRequest(value: BindingRequest) {
  if (
    value.schemaVersion !== 1 || value.mode !== "synthetic" || !clientId.test(value.clientId) ||
    !digest.test(value.manifestHash) || !fullSha.test(value.sourceSha) ||
    value.providers?.backend !== "convex" || value.providers?.identity !== "workos"
  ) throw new Error("INVALID_BINDING_REQUEST");
  exactSecretRef(value.credentialRefs?.backend, `secretref://${value.clientId}/controller/convex`);
  exactSecretRef(value.credentialRefs?.identity, `secretref://${value.clientId}/controller/workos`);
  return structuredClone(value);
}
