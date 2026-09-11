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

export type ClaraBrowserRequest =
  | { operation: "prepare" }
  | { operation: "run" | "draft" | "trace"; runId: string };

export type ClaraBrowserResponse =
  | { operation: "prepare" | "run"; run: ClaraRun }
  | { operation: "draft"; draft: ClaraDraft }
  | { operation: "trace"; trace: ClaraTraceSummary };

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
  throw new Error("INVALID_REQUEST");
}

export function bridgeRequestFor(
  request: ClaraBrowserRequest,
  idempotencyKey = claraDemoIdempotencyKey,
) {
  return request.operation === "prepare"
    ? {
        schemaVersion: 1 as const,
        operation: "start" as const,
        idempotencyKey,
        input: claraDemoInput,
      }
    : { schemaVersion: 1 as const, operation: request.operation, runId: request.runId };
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

export function parseClaraBridgeResponse(
  request: ClaraBrowserRequest,
  value: unknown,
): ClaraBrowserResponse {
  const operation = request.operation;
  const input = record(value);
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
