export type ClaraRunStatus =
  | "queued"
  | "running"
  | "waiting_for_input"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ClaraRun = {
  schemaVersion: 1;
  runId: string;
  status: ClaraRunStatus;
  inspectPath: string;
  draftId?: string;
};

export type ClaraDraft = {
  schemaVersion: 1;
  currency: "GBP";
  draftId: string;
  lines: Array<{
    sessionId: string;
    amountMinor: number;
    rateRef?: string;
    policyRef?: string;
  }>;
  totalMinor: number;
  unresolved: Array<{ sessionId: string; reason: string }>;
  prepaidSessionIds: string[];
  excludedSessionIds: string[];
  outstanding: Array<{ invoiceId: string; amountMinor: number }>;
};

export type ClaraTraceSummary = {
  schemaVersion: 1;
  eventCount: number;
  configurationVersion: string;
  inputHash: string;
  resultHash?: string;
};

export type ClaraConfigurationSummary = {
  releaseId: string;
  artifactDigest: string;
  version: string;
  generation: number;
};

export type ClaraRateChangeProposal = {
  proposalId: string;
  expectedActiveReleaseId: string;
  candidateArtifactDigest: string;
  candidateVersion: string;
  effectiveDate: string;
  previousRateMinor: number;
  newRateMinor: number;
  baselineTotalMinor: number;
  candidateTotalMinor: number;
  changedSessionIds: string[];
  explanation: string;
  evaluation: {
    evaluationId: string;
    reportDigest: string;
    accepted: boolean;
    passed: number;
    total: number;
  };
};

export type ClaraAdaptationState = {
  schemaVersion: 1;
  active: ClaraConfigurationSummary;
  rollbackTarget?: ClaraConfigurationSummary;
  proposal?: ClaraRateChangeProposal;
};

export type ClaraBrowserRequest =
  | { operation: "prepare" }
  | { operation: "run" | "draft" | "trace"; runId: string }
  | { operation: "adaptation-status" }
  | {
      operation: "adaptation-evaluate";
      effectiveDate: string;
      newRateMinor: number;
    }
  | {
      operation: "adaptation-activate";
      proposalId: string;
      expectedActiveReleaseId: string;
    }
  | {
      operation: "adaptation-rollback";
      targetReleaseId: string;
      expectedActiveReleaseId: string;
    };

export type ClaraBrowserResponse =
  | { operation: "prepare" | "run"; run: ClaraRun }
  | { operation: "draft"; draft: ClaraDraft }
  | { operation: "trace"; trace: ClaraTraceSummary }
  | {
      operation:
        | "adaptation-status"
        | "adaptation-evaluate"
        | "adaptation-activate"
        | "adaptation-rollback";
      adaptation: ClaraAdaptationState;
    };

export const claraDemoInput = Object.freeze({
  schemaVersion: 1 as const,
  period: { from: "2026-09-01", to: "2026-09-30" },
  sessions: [
    {
      id: "clara-session-2026-09-03",
      clientId: "fictional-person-01",
      date: "2026-09-03",
      attendance: "attended" as const,
      rateMinor: 8000,
      rateRef: "fictional-agreement-v1",
    },
    {
      id: "clara-session-2026-09-10",
      clientId: "fictional-person-01",
      date: "2026-09-10",
      attendance: "cancelled" as const,
      cancellationChargeMinor: 4000,
      policyRef: "fictional-cancellation-policy-v1",
    },
    {
      id: "clara-session-2026-09-17",
      clientId: "fictional-person-02",
      date: "2026-09-17",
      attendance: "attended" as const,
      prepaid: true,
    },
  ],
});

export const claraDemoIdempotencyKey = "clara-fictional-september-2026-v1";

const runId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digest = /^[0-9a-f]{64}$/;
const artifactDigestPattern = /^sha256:[0-9a-f]{64}$/;
const calendarDate = /^\d{4}-\d{2}-\d{2}$/;
const statuses = new Set<ClaraRunStatus>([
  "queued", "running", "waiting_for_input", "succeeded", "failed", "cancelled",
]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  if (
    Object.keys(value).length !== expected.length ||
    expected.some((key) => !(key in value))
  )
    throw new Error("INVALID_REQUEST");
}

export function parseClaraBrowserRequest(value: unknown): ClaraBrowserRequest {
  const input = record(value);
  if (input.operation === "prepare") {
    exactKeys(input, ["operation"]);
    return { operation: "prepare" };
  }
  if (["run", "draft", "trace"].includes(String(input.operation))) {
    exactKeys(input, ["operation", "runId"]);
    if (typeof input.runId !== "string" || !runId.test(input.runId))
      throw new Error("INVALID_REQUEST");
    return input as ClaraBrowserRequest;
  }
  if (input.operation === "adaptation-status") {
    exactKeys(input, ["operation"]);
    return { operation: "adaptation-status" };
  }
  if (input.operation === "adaptation-evaluate") {
    exactKeys(input, ["operation", "effectiveDate", "newRateMinor"]);
    if (
      typeof input.effectiveDate !== "string" ||
      !calendarDate.test(input.effectiveDate) ||
      new Date(`${input.effectiveDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== input.effectiveDate ||
      !Number.isSafeInteger(input.newRateMinor) ||
      (input.newRateMinor as number) < 0 ||
      (input.newRateMinor as number) > 100_000_000
    )
      throw new Error("INVALID_REQUEST");
    return input as ClaraBrowserRequest;
  }
  if (input.operation === "adaptation-activate") {
    exactKeys(input, ["operation", "proposalId", "expectedActiveReleaseId"]);
    if (!digest.test(String(input.proposalId)) || !digest.test(String(input.expectedActiveReleaseId)))
      throw new Error("INVALID_REQUEST");
    return input as ClaraBrowserRequest;
  }
  if (input.operation === "adaptation-rollback") {
    exactKeys(input, ["operation", "targetReleaseId", "expectedActiveReleaseId"]);
    if (!digest.test(String(input.targetReleaseId)) || !digest.test(String(input.expectedActiveReleaseId)))
      throw new Error("INVALID_REQUEST");
    return input as ClaraBrowserRequest;
  }
  throw new Error("INVALID_REQUEST");
}

export function bridgeRequestFor(
  request: ClaraBrowserRequest,
  idempotencyKey = claraDemoIdempotencyKey,
) {
  if (request.operation === "prepare")
    return {
        schemaVersion: 1 as const,
        operation: "start" as const,
        idempotencyKey,
        input: claraDemoInput,
      };
  if (request.operation === "run" || request.operation === "draft" || request.operation === "trace")
    return { schemaVersion: 1 as const, operation: request.operation, runId: request.runId };
  if (request.operation === "adaptation-evaluate")
    return {
      schemaVersion: 1 as const,
      ...request,
      idempotencyKey: `${idempotencyKey}-rate-${request.effectiveDate.replaceAll("-", "")}-${request.newRateMinor}`,
      input: claraDemoInput,
    };
  return { schemaVersion: 1 as const, ...request };
}

function safeText(value: unknown, max = 200) {
  if (typeof value !== "string" || !value || value.length > max)
    throw new Error("INVALID_RESPONSE");
  return value;
}

function safeMoney(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("INVALID_RESPONSE");
  return value as number;
}

function stringList(value: unknown) {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("INVALID_RESPONSE");
  return value.map((item) => safeText(item));
}

function releaseSummary(value: unknown): ClaraConfigurationSummary {
  const release = record(value);
  if (
    !digest.test(String(release.releaseId)) ||
    !artifactDigestPattern.test(String(release.artifactDigest)) ||
    !Number.isSafeInteger(release.generation) ||
    (release.generation as number) < 1
  )
    throw new Error("INVALID_RESPONSE");
  return {
    releaseId: String(release.releaseId),
    artifactDigest: String(release.artifactDigest),
    version: safeText(release.version, 100),
    generation: release.generation as number,
  };
}

function rateChangeProposal(value: unknown): ClaraRateChangeProposal {
  const proposal = record(value), evaluation = record(proposal.evaluation);
  const changedSessionIds = stringList(proposal.changedSessionIds);
  if (
    !digest.test(String(proposal.proposalId)) ||
    !digest.test(String(proposal.expectedActiveReleaseId)) ||
    !artifactDigestPattern.test(String(proposal.candidateArtifactDigest)) ||
    typeof proposal.effectiveDate !== "string" ||
    !calendarDate.test(proposal.effectiveDate) ||
    new Date(`${proposal.effectiveDate}T00:00:00.000Z`).toISOString().slice(0, 10) !== proposal.effectiveDate ||
    typeof evaluation.accepted !== "boolean" ||
    !Number.isSafeInteger(evaluation.passed) ||
    !Number.isSafeInteger(evaluation.total) ||
    (evaluation.passed as number) < 0 ||
    (evaluation.total as number) < 1 ||
    (evaluation.passed as number) > (evaluation.total as number) ||
    !artifactDigestPattern.test(String(evaluation.reportDigest))
  )
    throw new Error("INVALID_RESPONSE");
  return {
    proposalId: String(proposal.proposalId),
    expectedActiveReleaseId: String(proposal.expectedActiveReleaseId),
    candidateArtifactDigest: String(proposal.candidateArtifactDigest),
    candidateVersion: safeText(proposal.candidateVersion, 100),
    effectiveDate: proposal.effectiveDate,
    previousRateMinor: safeMoney(proposal.previousRateMinor),
    newRateMinor: safeMoney(proposal.newRateMinor),
    baselineTotalMinor: safeMoney(proposal.baselineTotalMinor),
    candidateTotalMinor: safeMoney(proposal.candidateTotalMinor),
    changedSessionIds,
    explanation: safeText(proposal.explanation, 500),
    evaluation: {
      evaluationId: safeText(evaluation.evaluationId, 100),
      reportDigest: String(evaluation.reportDigest),
      accepted: evaluation.accepted,
      passed: evaluation.passed as number,
      total: evaluation.total as number,
    },
  };
}

function adaptationState(value: unknown): ClaraAdaptationState {
  const state = record(value);
  if (state.schemaVersion !== 1) throw new Error("INVALID_RESPONSE");
  return {
    schemaVersion: 1,
    active: releaseSummary(state.active),
    ...(state.rollbackTarget === undefined ? {} : { rollbackTarget: releaseSummary(state.rollbackTarget) }),
    ...(state.proposal === undefined ? {} : { proposal: rateChangeProposal(state.proposal) }),
  };
}

export function parseClaraBridgeResponse(
  request: ClaraBrowserRequest,
  value: unknown,
): ClaraBrowserResponse {
  const operation = request.operation;
  const input = record(value);
  if (
    operation === "adaptation-status" ||
    operation === "adaptation-evaluate" ||
    operation === "adaptation-activate" ||
    operation === "adaptation-rollback"
  ) {
    return { operation, adaptation: adaptationState(input) } as ClaraBrowserResponse;
  }
  if (operation === "prepare" || operation === "run") {
    if (
      input.schemaVersion !== 1 ||
      typeof input.runId !== "string" ||
      !runId.test(input.runId) ||
      (operation === "run" && input.runId !== request.runId) ||
      !statuses.has(input.status as ClaraRunStatus) ||
      input.inspectPath !== `runs/${input.runId}` ||
      (input.draftId !== undefined && typeof input.draftId !== "string")
    )
      throw new Error("INVALID_RESPONSE");
    return {
      operation,
      run: {
        schemaVersion: 1,
        runId: input.runId,
        status: input.status as ClaraRunStatus,
        inspectPath: input.inspectPath,
        ...(input.draftId ? { draftId: safeText(input.draftId) } : {}),
      },
    };
  }
  if (operation === "draft") {
    if (
      input.schemaVersion !== 1 ||
      input.currency !== "GBP" ||
      !Array.isArray(input.lines) ||
      input.lines.length > 100 ||
      !Array.isArray(input.unresolved) ||
      input.unresolved.length > 100 ||
      !Array.isArray(input.outstanding) ||
      input.outstanding.length > 100
    )
      throw new Error("INVALID_RESPONSE");
    const lines = input.lines.map((item) => {
      const line = record(item);
      return {
        sessionId: safeText(line.sessionId),
        amountMinor: safeMoney(line.amountMinor),
        ...(line.rateRef === undefined ? {} : { rateRef: safeText(line.rateRef) }),
        ...(line.policyRef === undefined ? {} : { policyRef: safeText(line.policyRef) }),
      };
    });
    const unresolved = input.unresolved.map((item) => {
      const issue = record(item);
      return { sessionId: safeText(issue.sessionId), reason: safeText(issue.reason) };
    });
    const outstanding = input.outstanding.map((item) => {
      const invoice = record(item);
      return { invoiceId: safeText(invoice.invoiceId), amountMinor: safeMoney(invoice.amountMinor) };
    });
    const totalMinor = safeMoney(input.totalMinor);
    if (
      input.draftId !== `draft-${request.runId}` ||
      lines.reduce((total, line) => total + line.amountMinor, 0) !== totalMinor
    )
      throw new Error("INVALID_RESPONSE");
    return {
      operation,
      draft: {
        schemaVersion: 1,
        currency: "GBP",
        draftId: safeText(input.draftId),
        lines,
        totalMinor,
        unresolved,
        prepaidSessionIds: stringList(input.prepaidSessionIds),
        excludedSessionIds: stringList(input.excludedSessionIds),
        outstanding,
      },
    };
  }
  if (operation !== "trace") throw new Error("INVALID_RESPONSE");
  const job = record(input.job);
  if (
    input.schemaVersion !== 1 ||
    !Array.isArray(input.events) ||
    input.events.length > 500 ||
    job.id !== request.runId ||
    !statuses.has(job.status as ClaraRunStatus) ||
    !digest.test(String(job.inputHash ?? "")) ||
    (job.resultHash !== undefined && !digest.test(String(job.resultHash)))
  )
    throw new Error("INVALID_RESPONSE");
  return {
    operation,
    trace: {
      schemaVersion: 1,
      eventCount: input.events.length,
      configurationVersion: safeText(job.configurationVersion, 100),
      inputHash: String(job.inputHash),
      ...(job.resultHash ? { resultHash: String(job.resultHash) } : {}),
    },
  };
}
