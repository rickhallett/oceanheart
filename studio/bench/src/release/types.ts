export type DataCompatibility = {
  schemaVersion: string;
  dataTarget: string;
  change: "none" | "backward-compatible";
};

export type ApplicationArtifactManifest = {
  schemaVersion: 1;
  kind: "studio-application";
  clientId: string;
  sourceSha: string;
  studioTreeSha: string;
  artifactDigest: string;
  version: string;
  runtime: {
    nodeVersion: string;
    nextVersion: string;
  };
  compatibility: DataCompatibility;
  health: {
    path: string;
    status: number;
    contains: string;
  };
  createdAt: string;
};

export type RunningApplication = {
  releaseId: string;
  manifestPath: string;
  artifactDigest: string;
  sourceSha: string;
  version: string;
  compatibility: DataCompatibility;
  pid: number;
  publicPort: number;
  applicationPort: number;
  ownerToken: string;
  startedAt: string;
};

export type ApplicationReleaseState = {
  schemaVersion: 1;
  clientId: string;
  generation: number;
  router: {
    pid: number;
    port: number;
    ownerToken: string;
    startedAt: string;
  } | null;
  active: RunningApplication | null;
  previous: RunningApplication | null;
  updatedAt: string;
};

export type ApplicationReleaseReceipt = {
  schemaVersion: 1;
  operation: "activate" | "rollback" | "failed-activation";
  clientId: string;
  generation: number;
  requestedReleaseId: string;
  activeReleaseId: string | null;
  previousReleaseId: string | null;
  sourceSha: string;
  artifactDigest: string;
  version: string;
  compatibility: DataCompatibility;
  status: "ready" | "failed";
  activeProcess: {
    pid: number;
    routerPort: number;
    releasePort: number;
    applicationPort: number;
  } | null;
  served: {
    url: string;
    sourceSha: string;
    artifactDigest: string;
    dataTarget: string;
  } | null;
  recordedAt: string;
  failure?: string;
};
