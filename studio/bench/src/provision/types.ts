export const resourceKinds = [
  "repository",
  "runtime-vm",
  "development-vm",
  "backend",
] as const;

export type ResourceKind = (typeof resourceKinds)[number];
export type ProvisionPhase =
  | "planned"
  | "allocating"
  | "bootstrapping"
  | "configured"
  | "ready"
  | "failed";
export type ProvisionStatus =
  | "in_progress"
  | "effect_uncertain"
  | "failed"
  | "ready";

export type ProvisionManifest = {
  schemaVersion: 1;
  clientId: string;
  mode: "synthetic";
  template: {
    version: string;
    sourceSha: string;
  };
  code: {
    repository: string;
    releaseSha: string | null;
  };
  runtime: {
    provider: "exe.dev";
    region: string;
    runtimeName: string;
    developmentName: string;
    vmId: string | null;
    artifactDigest: string | null;
  };
  harness: {
    kind: "pi";
    version: string;
    profile: "workflow";
  };
  configuration: {
    instructionsVersion: string;
    toolsetVersion: string;
    modelProfile: string;
  };
  data: {
    backendRef: string;
    retrievalRef: string | null;
  };
  credentials: {
    model: string;
    mail: string | null;
  };
  limits: {
    maxConcurrentRuns: number;
    maxRunSeconds: number;
    maxToolCalls: number;
  };
  evaluationSet: string;
};

export type ResourceReceipt = {
  kind: ResourceKind;
  state: "planned" | "pending" | "uncertain" | "confirmed" | "failed";
  idempotencyKey: string;
  attempts: number;
  externalId?: string;
  sshDest?: string;
  detail?: string;
  updatedAt: string;
};

export type RegistryEntry = {
  schemaVersion: 1;
  clientId: string;
  manifest: ProvisionManifest;
  manifestHash: string;
  operationId: string;
  idempotencyKey: string;
  phase: ProvisionPhase;
  status: ProvisionStatus;
  resources: Record<ResourceKind, ResourceReceipt>;
  createdAt: string;
  updatedAt: string;
  failure?: {
    resource?: ResourceKind;
    code: string;
    message: string;
  };
};

export type ProvisionPlan = {
  schemaVersion: 1;
  clientId: string;
  manifestHash: string;
  resourceOrder: readonly ResourceKind[];
  operations: Array<{
    resource: ResourceKind;
    action: "reconcile-then-create";
  }>;
};

export type ReleasePlan = {
  schemaVersion: 1;
  kind: "release" | "rollback";
  receiptId: string;
  clientId: string;
  sourceSha: string;
  artifactDigest: string;
  previousReleaseId: string | null;
  targetReleaseId: string | null;
  dataCompatibility: "no-change" | "backward-compatible";
  status: "planned";
  createdAt: string;
};

export type ReleaseReceipt = Omit<ReleasePlan, "status"> & {
  status: "ready" | "failed";
  providerDeploymentId: string;
  servedArtifactDigest: string | null;
  applicationUrl: string;
  verifiedAt: string;
  failure?: string;
};
