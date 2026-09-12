export type StormMode = "fixture" | "live";
export type StormStep = "status" | "prepare" | "inspect" | "retry" | "final-inspect";
export type StormOperation = "read" | "write";

export type EvidenceKind = "authorization" | "target" | "identity" | "lease" | "oracle";
export type EvidenceRef = { path: string; sha256: `sha256:${string}` };

export type StormTarget = {
  classification: "private-synthetic";
  clientId: "c0001";
  origin: string;
  integrationSha: string;
  applicationSourceSha: string;
  applicationReleaseId: string;
  applicationArtifactDigest: `sha256:${string}`;
  backendDeployment: string;
  evidence: EvidenceRef;
};

export type StormIdentity = {
  clientId: "c0001";
  actorId: string;
  kind: "operator";
  role: "owner";
  subjectDigest: `sha256:${string}`;
  runtimeActorDigest: `sha256:${string}`;
  evidence: EvidenceRef;
};

export type StormLease = {
  workerId: string;
  leaseId: string;
  epoch: number;
  owner: string;
  expiresAt: string;
  operatorSessionBindingDigest: `sha256:${string}`;
  evidence: EvidenceRef;
};

export type StormOracle = {
  kind: "clara-durable-draft";
  readOnly: true;
  bindingDigest: `sha256:${string}`;
  evidence: EvidenceRef;
};

export type StormLimits = {
  maxActions: number;
  maxSeconds: number;
  maxModelDecisions: 0;
  maxCostMicros: 0;
};

export type StormManifest = {
  schemaVersion: 1;
  runId: string;
  mode: StormMode;
  enabled: boolean;
  workflow: "clara-c0001-baseline";
  authorization: EvidenceRef;
  target: StormTarget;
  identity: StormIdentity;
  lease: StormLease;
  oracle: StormOracle;
  limits: StormLimits;
  providersEnabled: false;
  faults: [];
};

export type AdapterInspection = {
  schemaVersion: 1;
  mode: StormMode;
  executionMode: "fixture" | "hosted-operator-driven" | "unattended";
  adapterId: string;
  targetBindingDigest: `sha256:${string}`;
  identityBindingDigest: `sha256:${string}`;
  oracleBindingDigest: `sha256:${string}`;
  leaseId: string;
  epoch: number;
  expiresAt: string;
  operatorSessionBindingDigest: `sha256:${string}`;
  operatorControl: boolean;
  operatorSession: boolean;
  dedicatedProfile: boolean;
  fictionalDataOnly: true;
};

export type ClaraObservation = {
  configurationVersion: string;
  configurationGeneration: number;
  draftId: string | null;
  totalMinor: number | null;
  traceEvents: number | null;
};

export type StormAction = {
  schemaVersion: 1;
  actionId: string;
  step: StormStep;
  operation: StormOperation;
  command: "clara-status" | "clara-prepare" | "clara-inspect" | "clara-retry";
  effectKey?: "clara-c0001-september-invoice";
};

export type ActionAcknowledgement = {
  acknowledged: true;
  observation?: ClaraObservation;
};

export type OracleObservation = {
  status: "present" | "absent" | "unknown";
  count: number | null;
  effectDigest: `sha256:${string}` | null;
  receiptDigest: `sha256:${string}` | null;
  observation?: ClaraObservation;
};

export interface StormAdapter {
  readonly mode: StormMode;
  inspect(signal?: AbortSignal): Promise<AdapterInspection>;
  perform(action: StormAction, signal?: AbortSignal): Promise<ActionAcknowledgement>;
  oracle(effectKey: string, signal?: AbortSignal): Promise<OracleObservation>;
  cleanup(signal?: AbortSignal): Promise<void>;
}

export type OutcomeClass =
  | "complete"
  | "policy_blocked"
  | "harness_failure"
  | "effect_uncertain"
  | "invariant_failed";

export type RunOutcome = {
  classification: OutcomeClass;
  code: string;
  completedSteps: StormStep[];
  effectDigest: `sha256:${string}` | null;
};
