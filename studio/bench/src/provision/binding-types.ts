export type BindingCredentialRefs = {
  backend: string;
  identity: string;
};

export type ProviderEnvironmentBinding = {
  environmentId: string;
  classification: "synthetic" | "production";
  isolation: "dedicated" | "shared";
  attestedClientId: string;
  backend: {
    provider: "convex";
    deploymentId: string;
    url: string;
  };
  identity: {
    provider: "workos";
    environmentId: string;
    issuer: string;
    audience: string;
  };
};

export type BackendIdentityBinding = {
  schemaVersion: 1;
  clientId: string;
  environmentId: string;
  mode: "synthetic";
  scope: "dedicated";
  backend: ProviderEnvironmentBinding["backend"];
  identity: ProviderEnvironmentBinding["identity"];
  provenance: {
    manifestHash: string;
    sourceSha: string;
    operationId: string;
    source: "controller-inspection";
    observedAt: string;
  };
  status: "ready";
  credentialRefs: BindingCredentialRefs;
};

export type BindingRequest = {
  schemaVersion: 1;
  clientId: string;
  mode: "synthetic";
  manifestHash: string;
  sourceSha: string;
  providers: {
    backend: "convex";
    identity: "workos";
  };
  credentialRefs: BindingCredentialRefs;
};

export type BindingRegistryEntry = {
  schemaVersion: 1;
  clientId: string;
  request: BindingRequest;
  requestHash: string;
  operationId: string;
  idempotencyKey: string;
  state: "planned" | "pending" | "effect_uncertain" | "failed" | "ready";
  attempts: number;
  binding?: BackendIdentityBinding;
  createdAt: string;
  updatedAt: string;
  failure?: {
    code: "BINDING_EFFECT_UNCERTAIN" | "BINDING_CONFLICT" | "BINDING_CREATE_REJECTED";
    message: string;
  };
};
