export const OPERATOR_MESSAGE_LIMIT_BYTES = 64 * 1024;
export const CLARA_EFFECT_KEY = "clara-c0001-september-invoice" as const;

export type BrokerErrorCode =
  | "BROKER_BUSY"
  | "BROKER_FAILED"
  | "BROKER_SHUTDOWN"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "OPERATOR_REJECTED"
  | "OPERATOR_TIMEOUT";

export type OperatorRequest =
  | { schemaVersion: 1; requestId: string; kind: "inspect" }
  | { schemaVersion: 1; requestId: string; kind: "perform"; action: OperatorAction }
  | { schemaVersion: 1; requestId: string; kind: "oracle"; effectKey: typeof CLARA_EFFECT_KEY }
  | { schemaVersion: 1; requestId: string; kind: "cleanup" };

export type OperatorAction = {
  schemaVersion: 1;
  actionId: string;
  step: "status" | "prepare" | "inspect" | "retry" | "final-inspect";
  operation: "read" | "write";
  command: "clara-status" | "clara-prepare" | "clara-inspect" | "clara-retry";
  effectKey?: typeof CLARA_EFFECT_KEY;
};

export type ClaraObservation = {
  configurationVersion: string;
  configurationGeneration: number;
  draftId: string | null;
  totalMinor: number | null;
  traceEvents: number | null;
};

export type OperatorInspection = {
  schemaVersion: 1;
  mode: "live";
  executionMode: "hosted-operator-driven";
  adapterId: string;
  targetBindingDigest: `sha256:${string}`;
  identityBindingDigest: `sha256:${string}`;
  oracleBindingDigest: `sha256:${string}`;
  leaseId: string;
  epoch: number;
  expiresAt: string;
  operatorSessionBindingDigest: `sha256:${string}`;
  operatorControl: true;
  operatorSession: true;
  dedicatedProfile: false;
  fictionalDataOnly: true;
};

export type OperatorAcknowledgement = {
  acknowledged: true;
  observation?: ClaraObservation;
};

export type OperatorOracle = {
  status: "present" | "absent" | "unknown";
  count: number | null;
  effectDigest: `sha256:${string}` | null;
  receiptDigest: `sha256:${string}` | null;
  observation?: ClaraObservation;
};

export type OperatorSuccess = {
  schemaVersion: 1;
  requestId: string;
  ok: true;
  result: OperatorInspection | OperatorAcknowledgement | OperatorOracle | Record<string, never>;
};

export type OperatorFailure = {
  schemaVersion: 1;
  requestId: string;
  ok: false;
  code: BrokerErrorCode;
};

export type OperatorResponse = OperatorSuccess | OperatorFailure;

const identifiers = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const sha256s = /^sha256:[0-9a-f]{64}$/;
const errorCodes = new Set<BrokerErrorCode>([
  "BROKER_BUSY",
  "BROKER_FAILED",
  "BROKER_SHUTDOWN",
  "INVALID_REQUEST",
  "INVALID_RESPONSE",
  "OPERATOR_REJECTED",
  "OPERATOR_TIMEOUT",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && identifiers.test(value);
}

function isDigest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && sha256s.test(value);
}

function parseAction(value: unknown): OperatorAction {
  if (!isRecord(value) || !exactKeys(value,
    ["schemaVersion", "actionId", "step", "operation", "command"], ["effectKey"]) ||
    value.schemaVersion !== 1 || !isIdentifier(value.actionId)) throw new Error("INVALID_REQUEST");

  const expected: Record<string, { operation: string; command: string; effect: boolean }> = {
    status: { operation: "read", command: "clara-status", effect: false },
    prepare: { operation: "write", command: "clara-prepare", effect: true },
    inspect: { operation: "read", command: "clara-inspect", effect: false },
    retry: { operation: "write", command: "clara-retry", effect: true },
    "final-inspect": { operation: "read", command: "clara-inspect", effect: false },
  };
  const contract = typeof value.step === "string" ? expected[value.step] : undefined;
  if (!contract || value.operation !== contract.operation || value.command !== contract.command ||
    (contract.effect ? value.effectKey !== CLARA_EFFECT_KEY : value.effectKey !== undefined)) {
    throw new Error("INVALID_REQUEST");
  }
  return value as OperatorAction;
}

export function parseOperatorRequest(value: unknown): OperatorRequest {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isIdentifier(value.requestId) ||
    !["inspect", "perform", "oracle", "cleanup"].includes(String(value.kind))) {
    throw new Error("INVALID_REQUEST");
  }
  if (value.kind === "inspect" || value.kind === "cleanup") {
    if (!exactKeys(value, ["schemaVersion", "requestId", "kind"])) throw new Error("INVALID_REQUEST");
    return value as OperatorRequest;
  }
  if (value.kind === "oracle") {
    if (!exactKeys(value, ["schemaVersion", "requestId", "kind", "effectKey"]) ||
      value.effectKey !== CLARA_EFFECT_KEY) throw new Error("INVALID_REQUEST");
    return value as OperatorRequest;
  }
  if (!exactKeys(value, ["schemaVersion", "requestId", "kind", "action"])) throw new Error("INVALID_REQUEST");
  return { ...value, action: parseAction(value.action) } as OperatorRequest;
}

function parseObservation(value: unknown): ClaraObservation {
  if (!isRecord(value) || !exactKeys(value,
    ["configurationVersion", "configurationGeneration", "draftId", "totalMinor", "traceEvents"]) ||
    typeof value.configurationVersion !== "string" || value.configurationVersion.length === 0 ||
    !Number.isSafeInteger(value.configurationGeneration) || Number(value.configurationGeneration) < 1 ||
    !(value.draftId === null || isIdentifier(value.draftId)) ||
    !(value.totalMinor === null || (Number.isSafeInteger(value.totalMinor) && Number(value.totalMinor) >= 0)) ||
    !(value.traceEvents === null || (Number.isSafeInteger(value.traceEvents) && Number(value.traceEvents) >= 0))) {
    throw new Error("INVALID_RESPONSE");
  }
  return value as ClaraObservation;
}

function parseInspection(value: unknown): OperatorInspection {
  const keys = [
    "schemaVersion", "mode", "executionMode", "adapterId", "targetBindingDigest",
    "identityBindingDigest", "oracleBindingDigest", "leaseId", "epoch", "expiresAt",
    "operatorSessionBindingDigest", "operatorControl", "operatorSession", "dedicatedProfile",
    "fictionalDataOnly",
  ];
  if (!isRecord(value) || !exactKeys(value, keys) || value.schemaVersion !== 1 || value.mode !== "live" ||
    value.executionMode !== "hosted-operator-driven" || !isIdentifier(value.adapterId) ||
    !isDigest(value.targetBindingDigest) || !isDigest(value.identityBindingDigest) ||
    !isDigest(value.oracleBindingDigest) || !isIdentifier(value.leaseId) ||
    !Number.isSafeInteger(value.epoch) || Number(value.epoch) < 1 ||
    typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) ||
    !isDigest(value.operatorSessionBindingDigest) || value.operatorControl !== true ||
    value.operatorSession !== true || value.dedicatedProfile !== false || value.fictionalDataOnly !== true) {
    throw new Error("INVALID_RESPONSE");
  }
  return value as OperatorInspection;
}

function parseAcknowledgement(value: unknown): OperatorAcknowledgement {
  if (!isRecord(value) || !exactKeys(value, ["acknowledged"], ["observation"]) || value.acknowledged !== true) {
    throw new Error("INVALID_RESPONSE");
  }
  if (value.observation !== undefined) parseObservation(value.observation);
  return value as OperatorAcknowledgement;
}

function parseOracle(value: unknown): OperatorOracle {
  if (!isRecord(value) || !exactKeys(value,
    ["status", "count", "effectDigest", "receiptDigest"], ["observation"]) ||
    !["present", "absent", "unknown"].includes(String(value.status)) ||
    !(value.count === null || (Number.isSafeInteger(value.count) && Number(value.count) >= 0)) ||
    !(value.effectDigest === null || isDigest(value.effectDigest)) ||
    !(value.receiptDigest === null || isDigest(value.receiptDigest))) throw new Error("INVALID_RESPONSE");
  if (value.status === "present" &&
    (!Number.isSafeInteger(value.count) || Number(value.count) < 1 || !value.effectDigest || !value.receiptDigest)) {
    throw new Error("INVALID_RESPONSE");
  }
  if (value.status !== "present" && (value.effectDigest !== null || value.receiptDigest !== null)) {
    throw new Error("INVALID_RESPONSE");
  }
  if (value.observation !== undefined) parseObservation(value.observation);
  return value as OperatorOracle;
}

export function parseOperatorResponse(request: OperatorRequest, value: unknown): OperatorResponse {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.requestId !== request.requestId ||
    typeof value.ok !== "boolean") throw new Error("INVALID_RESPONSE");
  if (value.ok === false) {
    if (!exactKeys(value, ["schemaVersion", "requestId", "ok", "code"]) ||
      typeof value.code !== "string" || !errorCodes.has(value.code as BrokerErrorCode)) {
      throw new Error("INVALID_RESPONSE");
    }
    return value as OperatorFailure;
  }
  if (!exactKeys(value, ["schemaVersion", "requestId", "ok", "result"])) throw new Error("INVALID_RESPONSE");
  if (request.kind === "inspect") parseInspection(value.result);
  else if (request.kind === "perform") parseAcknowledgement(value.result);
  else if (request.kind === "oracle") parseOracle(value.result);
  else if (!isRecord(value.result) || !exactKeys(value.result, [])) throw new Error("INVALID_RESPONSE");
  return value as OperatorSuccess;
}

export function encodeOperatorLine(value: unknown): Buffer {
  const encoded = Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
  if (encoded.byteLength > OPERATOR_MESSAGE_LIMIT_BYTES) throw new Error("MESSAGE_TOO_LARGE");
  return encoded;
}

export function parseOperatorLine(line: Buffer | string): unknown {
  const bytes = Buffer.isBuffer(line) ? line : Buffer.from(line, "utf8");
  if (bytes.byteLength > OPERATOR_MESSAGE_LIMIT_BYTES) throw new Error("MESSAGE_TOO_LARGE");
  const source = bytes.toString("utf8");
  const newline = source.indexOf("\n");
  if (newline < 0 || source.slice(newline + 1).trim() !== "") throw new Error("INVALID_MESSAGE");
  try {
    return JSON.parse(source.slice(0, newline));
  } catch {
    throw new Error("INVALID_MESSAGE");
  }
}

export function fallbackRequestId(value: unknown): string {
  return isRecord(value) && isIdentifier(value.requestId) ? value.requestId : "invalid-request";
}
