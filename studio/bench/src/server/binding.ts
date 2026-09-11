export type EnvironmentBinding = {
  schemaVersion: 1;
  clientId: string;
  environmentId: string;
  backend: {
    provider: "convex" | "synthetic-test";
    deploymentId: string;
    url: string;
  };
  identity: {
    provider: "workos" | "synthetic-test";
    environmentId: string;
    audience: string;
    issuer: string;
  };
  provenance: {
    sourceSha: string;
    source: "controller-inspection" | "synthetic-test";
    observedAt: string;
  };
  status: "ready" | "degraded" | "planned";
};

export type VerifiedPrincipal = {
  provider: EnvironmentBinding["identity"]["provider"];
  subject: string;
  environmentId: string;
  audience: string;
  issuer: string;
};

export interface IdentityVerifier {
  readonly provider: EnvironmentBinding["identity"]["provider"];
  verify(input: {
    authorization: string | undefined;
    environmentId: string;
    audience: string;
    issuer: string;
  }): Promise<VerifiedPrincipal>;
}

export interface EnvironmentBindingRegistry {
  resolveAuthorized(principal: VerifiedPrincipal): Promise<EnvironmentBinding | null>;
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,255}$/;
const fullSha = /^[0-9a-f]{40}$/;

function exactUrl(value: string, protocols: readonly string[]) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("BINDING_URL_INVALID"); }
  if (!protocols.includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error("BINDING_URL_INVALID");
  return url;
}

export function validateBinding(binding: EnvironmentBinding, mode: "hosted" | "synthetic-test") {
  if (binding.schemaVersion !== 1) throw new Error("BINDING_SCHEMA_INVALID");
  for (const [label, value] of [
    ["client", binding.clientId], ["environment", binding.environmentId],
    ["backend deployment", binding.backend.deploymentId], ["identity environment", binding.identity.environmentId],
  ] as const) if (!identifier.test(value)) throw new Error(`BINDING_${label.toUpperCase().replaceAll(" ", "_")}_INVALID`);
  if (!binding.identity.audience || !binding.identity.issuer) throw new Error("BINDING_IDENTITY_POLICY_MISSING");
  if (!fullSha.test(binding.provenance.sourceSha)) throw new Error("BINDING_SOURCE_SHA_INVALID");
  if (Number.isNaN(Date.parse(binding.provenance.observedAt))) throw new Error("BINDING_PROVENANCE_INVALID");
  if (mode === "hosted") {
    if (binding.backend.provider !== "convex" || binding.identity.provider !== "workos" || binding.provenance.source !== "controller-inspection")
      throw new Error("TEST_BINDING_FORBIDDEN_IN_HOSTED_MODE");
    exactUrl(binding.backend.url, ["https:"]);
    exactUrl(binding.identity.issuer, ["https:"]);
  } else {
    if (binding.backend.provider !== "synthetic-test" || binding.identity.provider !== "synthetic-test" || binding.provenance.source !== "synthetic-test")
      throw new Error("SYNTHETIC_MODE_REQUIRES_TEST_BINDING");
    exactUrl(binding.backend.url, ["synthetic:"]);
    exactUrl(binding.identity.issuer, ["https:"]);
  }
  return binding;
}
