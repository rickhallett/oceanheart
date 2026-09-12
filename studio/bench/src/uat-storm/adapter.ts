import { lstat } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { createConnection } from "node:net";

import type {
  ActionAcknowledgement,
  AdapterInspection,
  ClaraObservation,
  OracleObservation,
  StormAction,
  StormAdapter,
} from "./types.ts";

const sha256 = /^sha256:[0-9a-f]{64}$/;
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function observation(value: unknown): ClaraObservation | undefined {
  if (!record(value) || typeof value.configurationVersion !== "string" ||
    !Number.isSafeInteger(value.configurationGeneration) || Number(value.configurationGeneration) < 1 ||
    !(value.draftId === null || (typeof value.draftId === "string" && identifier.test(value.draftId))) ||
    !(value.totalMinor === null || (Number.isSafeInteger(value.totalMinor) && Number(value.totalMinor) >= 0)) ||
    !(value.traceEvents === null || (Number.isSafeInteger(value.traceEvents) && Number(value.traceEvents) >= 0))) return undefined;
  return value as ClaraObservation;
}

function inspection(value: unknown): AdapterInspection {
  if (!record(value) || value.schemaVersion !== 1 || (value.mode !== "live" && value.mode !== "fixture") ||
    !["fixture", "hosted-operator-driven", "unattended"].includes(String(value.executionMode)) ||
    typeof value.adapterId !== "string" || !identifier.test(value.adapterId) ||
    typeof value.targetBindingDigest !== "string" || !sha256.test(value.targetBindingDigest) ||
    typeof value.identityBindingDigest !== "string" || !sha256.test(value.identityBindingDigest) ||
    typeof value.oracleBindingDigest !== "string" || !sha256.test(value.oracleBindingDigest) ||
    typeof value.leaseId !== "string" || !identifier.test(value.leaseId) ||
    !Number.isSafeInteger(value.epoch) || Number(value.epoch) < 1 ||
    typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt)) ||
    typeof value.operatorSessionBindingDigest !== "string" || !sha256.test(value.operatorSessionBindingDigest) ||
    typeof value.operatorControl !== "boolean" || typeof value.operatorSession !== "boolean" ||
    typeof value.dedicatedProfile !== "boolean" || value.fictionalDataOnly !== true)
    throw new Error("ADAPTER_INSPECTION_INVALID");
  return value as AdapterInspection;
}

function acknowledgement(value: unknown): ActionAcknowledgement {
  if (!record(value) || value.acknowledged !== true ||
    !(value.observation === undefined || observation(value.observation))) throw new Error("ADAPTER_ACK_INVALID");
  return value as ActionAcknowledgement;
}

function oracle(value: unknown): OracleObservation {
  if (!record(value) || !["present", "absent", "unknown"].includes(String(value.status)) ||
    !(value.count === null || (Number.isSafeInteger(value.count) && Number(value.count) >= 0)) ||
    !(value.effectDigest === null || (typeof value.effectDigest === "string" && sha256.test(value.effectDigest))) ||
    !(value.receiptDigest === null || (typeof value.receiptDigest === "string" && sha256.test(value.receiptDigest))) ||
    !(value.observation === undefined || observation(value.observation))) throw new Error("ADAPTER_ORACLE_INVALID");
  if (value.status === "present" &&
    (!Number.isSafeInteger(value.count) || Number(value.count) < 1 || !value.effectDigest || !value.receiptDigest))
    throw new Error("ADAPTER_ORACLE_INVALID");
  if (value.status !== "present" && (value.effectDigest !== null || value.receiptDigest !== null))
    throw new Error("ADAPTER_ORACLE_INVALID");
  return value as OracleObservation;
}

type Request = {
  schemaVersion: 1;
  requestId: string;
  kind: "inspect" | "perform" | "oracle" | "cleanup";
  action?: StormAction;
  effectKey?: string;
};

export class UnixSocketStormAdapter implements StormAdapter {
  readonly mode = "live" as const;
  private readonly socketPath: string;
  private readonly responseTimeoutMs: number;
  private sequence = 0;

  constructor(socketPath: string, responseTimeoutMs = 180_000) {
    if (!isAbsolute(socketPath)) throw new Error("ADAPTER_SOCKET_INVALID");
    if (!Number.isSafeInteger(responseTimeoutMs) || responseTimeoutMs < 1_000 || responseTimeoutMs > 180_000)
      throw new Error("ADAPTER_TIMEOUT_INVALID");
    this.socketPath = socketPath;
    this.responseTimeoutMs = responseTimeoutMs;
  }

  private async exchange(kind: Request["kind"], fields: Partial<Request> = {}, signal?: AbortSignal): Promise<unknown> {
    const [socketInfo, parentInfo] = await Promise.all([lstat(this.socketPath), lstat(dirname(this.socketPath))]);
    if (!socketInfo.isSocket() || socketInfo.isSymbolicLink() || (socketInfo.mode & 0o077) !== 0 ||
      !parentInfo.isDirectory() || parentInfo.isSymbolicLink() || (parentInfo.mode & 0o077) !== 0)
      throw new Error("ADAPTER_SOCKET_UNSAFE");
    const requestId = `request-${++this.sequence}`;
    const request: Request = { schemaVersion: 1, requestId, kind, ...fields };
    return new Promise((resolve, reject) => {
      const socket = createConnection({ path: this.socketPath });
      let settled = false;
      let bytes = "";
      const finish = (error?: Error, value?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", aborted);
        socket.destroy();
        error ? reject(error) : resolve(value);
      };
      const aborted = () => finish(new Error("ADAPTER_ABORTED"));
      const timer = setTimeout(() => finish(new Error("ADAPTER_TIMEOUT")), this.responseTimeoutMs);
      signal?.addEventListener("abort", aborted, { once: true });
      socket.once("connect", () => socket.write(`${JSON.stringify(request)}\n`));
      socket.on("data", (chunk) => {
        bytes += String(chunk);
        if (Buffer.byteLength(bytes) > 64 * 1024) return finish(new Error("ADAPTER_RESPONSE_TOO_LARGE"));
        const newline = bytes.indexOf("\n");
        if (newline < 0) return;
        if (bytes.slice(newline + 1).trim() !== "") return finish(new Error("ADAPTER_RESPONSE_INVALID"));
        let envelope: unknown;
        try { envelope = JSON.parse(bytes.slice(0, newline)); } catch { return finish(new Error("ADAPTER_RESPONSE_INVALID")); }
        if (!record(envelope) || envelope.schemaVersion !== 1 || envelope.requestId !== requestId || typeof envelope.ok !== "boolean")
          return finish(new Error("ADAPTER_RESPONSE_INVALID"));
        if (envelope.ok !== true) {
          const code = typeof envelope.code === "string" && identifier.test(envelope.code) ? envelope.code : "BROKER_FAILED";
          return finish(new Error(`ADAPTER_${code}`));
        }
        finish(undefined, envelope.result);
      });
      socket.once("error", () => finish(new Error("ADAPTER_TRANSPORT_FAILED")));
      socket.once("end", () => { if (!settled) finish(new Error("ADAPTER_RESPONSE_INCOMPLETE")); });
    });
  }

  async inspect(signal?: AbortSignal) { return inspection(await this.exchange("inspect", {}, signal)); }
  async perform(action: StormAction, signal?: AbortSignal) {
    return acknowledgement(await this.exchange("perform", { action }, signal));
  }
  async oracle(effectKey: string, signal?: AbortSignal) {
    return oracle(await this.exchange("oracle", { effectKey }, signal));
  }
  async cleanup(signal?: AbortSignal) { await this.exchange("cleanup", {}, signal); }
}

export type FixtureFault = "lost-response" | "duplicate-effect" | "effect-absent" | null;

export class FixtureStormAdapter implements StormAdapter {
  readonly mode = "fixture" as const;
  readonly inspection: AdapterInspection;
  readonly calls: StormAction[] = [];
  private fault: FixtureFault;
  // The c0001 pilot begins with the already committed baseline draft.
  private effectCount = 1;
  private effectDigest: `sha256:${string}` = `sha256:${"a".repeat(64)}`;
  cleaned = false;

  constructor(inspectionValue: Omit<AdapterInspection, "mode">, fault: FixtureFault = null) {
    this.inspection = { ...inspectionValue, mode: "fixture" };
    this.fault = fault;
  }

  async inspect() { return structuredClone(this.inspection); }
  async perform(action: StormAction) {
    this.calls.push(structuredClone(action));
    if (action.operation === "write") {
      if (action.step === "prepare" && this.effectCount === 0) this.effectCount = 1;
      if (action.step === "retry" && this.fault === "duplicate-effect") this.effectCount = 2;
      if (this.fault === "effect-absent") this.effectCount = 0;
      if (action.step === "prepare" && this.fault === "lost-response") {
        this.fault = null;
        throw new Error("FIXTURE_DROPPED_RESPONSE");
      }
    }
    return { acknowledged: true, observation: this.currentObservation() } as ActionAcknowledgement;
  }
  async oracle() {
    if (this.effectCount === 0) return { status: "absent", count: 0, effectDigest: null, receiptDigest: null } as OracleObservation;
    return {
      status: "present",
      count: this.effectCount,
      effectDigest: this.effectDigest,
      receiptDigest: `sha256:${"b".repeat(64)}`,
      observation: this.currentObservation(),
    } as OracleObservation;
  }
  async cleanup() { this.cleaned = true; }

  private currentObservation(): ClaraObservation {
    return {
      configurationVersion: "clara-2026-09-01",
      configurationGeneration: 7,
      draftId: this.effectCount > 0 ? "draft-fixture-c0001" : null,
      totalMinor: this.effectCount > 0 ? 12000 : null,
      traceEvents: this.effectCount > 0 ? 22 : null,
    };
  }
}
