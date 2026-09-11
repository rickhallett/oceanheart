import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import {
  AuthenticatedClaraRuntime,
  AuthenticatedRuntimeError,
  type ClaraStartRequest,
} from "../server/authenticated-runtime.ts";

const maxBodyBytes = 64 * 1024;
const operations = new Set([
  "start", "run", "draft", "trace", "adaptation-status", "adaptation-evaluate",
  "adaptation-activate", "adaptation-rollback",
]);

type BridgeRequest =
  | { schemaVersion: 1; operation: "start"; idempotencyKey: string; input: ClaraStartRequest["input"] }
  | { schemaVersion: 1; operation: "run"; runId: string }
  | { schemaVersion: 1; operation: "draft"; runId: string }
  | { schemaVersion: 1; operation: "trace"; runId: string }
  | { schemaVersion: 1; operation: "adaptation-status" }
  | { schemaVersion: 1; operation: "adaptation-evaluate"; idempotencyKey: string; effectiveDate: string; newRateMinor: number; input: ClaraStartRequest["input"] }
  | { schemaVersion: 1; operation: "adaptation-activate"; proposalId: string; expectedActiveReleaseId: string }
  | { schemaVersion: 1; operation: "adaptation-rollback"; targetReleaseId: string; expectedActiveReleaseId: string };

function exactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function parseRequest(value: unknown): BridgeRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("REQUEST_INVALID");
  const request = value as Record<string, unknown>;
  if (request.schemaVersion !== 1 || typeof request.operation !== "string" || !operations.has(request.operation))
    throw new Error("REQUEST_INVALID");
  if (request.operation === "start") {
    if (!exactKeys(request, ["schemaVersion", "operation", "idempotencyKey", "input"]) ||
      typeof request.idempotencyKey !== "string" || !request.input || typeof request.input !== "object" || Array.isArray(request.input))
      throw new Error("REQUEST_INVALID");
    if (Object.hasOwn(request.input, "clientId")) throw new Error("REQUEST_INVALID");
    return request as BridgeRequest;
  }
  if (request.operation === "adaptation-status") {
    if (!exactKeys(request, ["schemaVersion", "operation"])) throw new Error("REQUEST_INVALID");
    return request as BridgeRequest;
  }
  if (request.operation === "adaptation-evaluate") {
    if (!exactKeys(request, ["schemaVersion", "operation", "idempotencyKey", "effectiveDate", "newRateMinor", "input"]) ||
      typeof request.idempotencyKey !== "string" || typeof request.effectiveDate !== "string" ||
      !Number.isSafeInteger(request.newRateMinor) || !request.input || typeof request.input !== "object" || Array.isArray(request.input) ||
      Object.hasOwn(request.input, "clientId")) throw new Error("REQUEST_INVALID");
    return request as BridgeRequest;
  }
  if (request.operation === "adaptation-activate") {
    if (!exactKeys(request, ["schemaVersion", "operation", "proposalId", "expectedActiveReleaseId"]) ||
      typeof request.proposalId !== "string" || typeof request.expectedActiveReleaseId !== "string")
      throw new Error("REQUEST_INVALID");
    return request as BridgeRequest;
  }
  if (request.operation === "adaptation-rollback") {
    if (!exactKeys(request, ["schemaVersion", "operation", "targetReleaseId", "expectedActiveReleaseId"]) ||
      typeof request.targetReleaseId !== "string" || typeof request.expectedActiveReleaseId !== "string")
      throw new Error("REQUEST_INVALID");
    return request as BridgeRequest;
  }
  if (!exactKeys(request, ["schemaVersion", "operation", "runId"]) || typeof request.runId !== "string")
    throw new Error("REQUEST_INVALID");
  return request as BridgeRequest;
}

async function readBody(request: IncomingMessage) {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("REQUEST_INVALID");
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    received += bytes.length;
    if (received > maxBodyBytes) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(bytes);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new Error("REQUEST_INVALID"); }
}

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function errorStatus(error: unknown, authorization: string | undefined) {
  if (error instanceof AuthenticatedRuntimeError) {
    if (error.code === "REQUEST_DENIED") return authorization ? 403 : 401;
    if (error.code === "REQUEST_INVALID" || error.code === "REQUEST_CONFLICT") return 400;
  }
  if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") return 413;
  if (error instanceof Error && error.message === "REQUEST_INVALID") return 400;
  return 503;
}

async function dispatch(runtime: AuthenticatedClaraRuntime, authorization: string | undefined, body: BridgeRequest) {
  if (body.operation === "start")
    return runtime.startClara({ authorization, idempotencyKey: body.idempotencyKey, input: body.input });
  if (body.operation === "run") return runtime.inspectRun(authorization, body.runId);
  if (body.operation === "draft") return runtime.inspectDraft(authorization, body.runId);
  if (body.operation === "trace") return runtime.inspectTrace(authorization, body.runId);
  if (body.operation === "adaptation-status") return runtime.adaptationStatus(authorization);
  if (body.operation === "adaptation-evaluate") return runtime.evaluateAdaptation(authorization, body);
  if (body.operation === "adaptation-activate")
    return runtime.activateAdaptation(authorization, body.proposalId, body.expectedActiveReleaseId);
  return runtime.rollbackAdaptation(authorization, body.targetReleaseId, body.expectedActiveReleaseId);
}

export function createClaraRuntimeBridge(runtime: AuthenticatedClaraRuntime): Server {
  return createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/healthz") return send(response, 200, { status: "ready" });
    if (request.method !== "POST" || request.url !== "/v1/clara") return send(response, 404, { error: "NOT_FOUND" });
    const authorization = typeof request.headers.authorization === "string" ? request.headers.authorization : undefined;
    try {
      const body = parseRequest(await readBody(request));
      const result = await dispatch(runtime, authorization, body);
      return send(response, 200, result);
    } catch (error) {
      const status = errorStatus(error, authorization);
      return send(response, status, { error: status === 401 || status === 403 ? "REQUEST_DENIED" : status === 400 ? "REQUEST_INVALID" : "SERVICE_UNAVAILABLE" });
    }
  });
}

export async function listenOnLoopback(server: Server, port: number) {
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("PRIVATE_PORT_INVALID");
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
    server.close();
    throw new Error("LOOPBACK_BINDING_REQUIRED");
  }
  return address;
}
