/**
 * Boundary shared by the synthetic Clara suite and the real workflow adapter.
 * The adapter is deliberately responsible for the workflow; this package only
 * supplies fixtures, invokes that adapter, and checks its structured receipt.
 */
export type FixturePartition = "fixed" | "held-out";

export type ClaraEffect = {
  kind: string;
  external: boolean;
  idempotencyKey?: string;
};

export type ClaraTrace = {
  runId: string;
  href?: string;
};

export type CostLatencyEstimate = {
  latencyMs: number;
  costUsd: number;
  label: "estimate";
  basis: string;
};

export type ClaraWorkflowResult = {
  caseId: string;
  configurationVersion: string;
  result: ClaraResult;
  questions: string[];
  sourceIds: string[];
  effects: ClaraEffect[];
  trace: ClaraTrace;
  estimate: CostLatencyEstimate;
};

export type ClaraFixture = {
  schemaVersion: 1;
  caseId: `CL-0${number}`;
  partition: FixturePartition;
  clientId: "c-clara-synthetic";
  fixedClock: string;
  request: {
    operation: "prepare_invoice";
    clientId: string;
    billingPeriod: string;
  };
  /** Exact canonical ClaraInput shape from bench/src/runtime/contract.ts. */
  input: ClaraInput;
  /** An explicit same-request replay; never inferred from fixture state. */
  replay?: { count: 2 };
  expected: {
    totalMinor: number;
    outstandingMinor?: number;
    sourceIds: string[];
    requiredEffectKinds: string[];
    prohibitedEffectKinds: string[];
    requiredQuestionTerms?: string[];
  };
};

/** Structural mirror of the runtime contract; the fixture JSON is passed as this input unchanged. */
export type ClaraInput = {
  schemaVersion: 1;
  clientId: string;
  period: { from: string; to: string };
  sessions: Array<{
    id: string;
    clientId: string;
    date: string;
    attendance: "attended" | "cancelled" | "unknown";
    rateMinor?: number;
    rateRef?: string;
    cancellationChargeMinor?: number;
    policyRef?: string;
    prepaid?: boolean;
    priorInvoiceId?: string;
  }>;
  payments?: Array<{ invoiceId: string; invoiceTotalMinor: number; receivedMinor: number }>;
};

export type ClaraResult = {
  schemaVersion: 1;
  clientId: string;
  currency: "GBP";
  draftId: string;
  lines: Array<{ sessionId: string; clientId: string; amountMinor: number; rateRef?: string; policyRef?: string }>;
  totalMinor: number;
  unresolved: Array<{ sessionId: string; reason: string }>;
  prepaidSessionIds: string[];
  excludedSessionIds: string[];
  outstanding: Array<{ invoiceId: string; amountMinor: number }>;
};

export type WorkflowSafety = {
  fixtureOnly: true;
  allowBilling: false;
  allowMail: false;
  allowModelCalls: false;
};

export type ClaraWorkflowRequest = {
  fixture: ClaraFixture;
  configurationVersion: string;
  prompt: string;
  sessionId: string;
  safety: WorkflowSafety;
};

export interface ActualClaraWorkflowAdapter {
  run(request: ClaraWorkflowRequest): Promise<ClaraWorkflowResult>;
}

export type ActualWorkflowAdapterModule = {
  createActualClaraWorkflowAdapter?: () => ActualClaraWorkflowAdapter | Promise<ActualClaraWorkflowAdapter>;
  actualClaraWorkflowAdapter?: ActualClaraWorkflowAdapter;
  default?: ActualClaraWorkflowAdapter;
};

export type EvaluationCheck = {
  name: string;
  pass: boolean;
  detail: string;
};
