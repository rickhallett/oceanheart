import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { createServer, type Server, type Socket } from "node:net";

import {
  encodeOperatorLine,
  fallbackRequestId,
  OPERATOR_MESSAGE_LIMIT_BYTES,
  parseOperatorLine,
  parseOperatorRequest,
  parseOperatorResponse,
  type BrokerErrorCode,
  type OperatorRequest,
  type OperatorResponse,
} from "./operator-contract.ts";

export type OperatorBrokerOptions = {
  stateDir: string;
  timeoutMs?: number;
  pollMs?: number;
};

export type OperatorBrokerPaths = {
  socket: string;
  pending: string;
  response: string;
};

type ActiveRequest = {
  request: OperatorRequest;
  socket: Socket;
  timer: NodeJS.Timeout;
  poller: NodeJS.Timeout;
  settled: boolean;
};

const fileFlags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0);

function pathsFor(stateDir: string): OperatorBrokerPaths {
  return {
    socket: join(stateDir, "operator.sock"),
    pending: join(stateDir, "pending.json"),
    response: join(stateDir, "response.json"),
  };
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function assertPrivateDirectory(path: string): Promise<void> {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700 ||
    (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
    throw new Error("BROKER_DIRECTORY_UNSAFE");
  }
}

async function readPrivateLine(path: string): Promise<Buffer> {
  const handle = await open(path, fileFlags);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()) ||
      stat.size > OPERATOR_MESSAGE_LIMIT_BYTES) throw new Error("BROKER_FILE_UNSAFE");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function createPrivateLine(path: string, value: unknown): Promise<void> {
  const bytes = encodeOperatorLine(value);
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600) throw new Error("BROKER_FILE_UNSAFE");
  } finally {
    await handle.close();
  }
}

async function unlinkIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function failure(requestId: string, code: BrokerErrorCode): OperatorResponse {
  return { schemaVersion: 1, requestId, ok: false, code };
}

function safeEnd(socket: Socket, response: OperatorResponse): void {
  if (!socket.destroyed) socket.end(encodeOperatorLine(response));
}

export async function readPendingOperatorRequest(stateDir: string): Promise<OperatorRequest> {
  if (!isAbsolute(stateDir)) throw new Error("BROKER_STATE_DIR_INVALID");
  await assertPrivateDirectory(stateDir);
  const bytes = await readPrivateLine(pathsFor(stateDir).pending);
  return parseOperatorRequest(parseOperatorLine(bytes));
}

export async function submitOperatorResponse(stateDir: string, value: unknown): Promise<void> {
  if (!isAbsolute(stateDir)) throw new Error("BROKER_STATE_DIR_INVALID");
  await assertPrivateDirectory(stateDir);
  const paths = pathsFor(stateDir);
  let pending: OperatorRequest;
  try {
    pending = await readPendingOperatorRequest(stateDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("STALE_RESPONSE");
    throw error;
  }
  const response = parseOperatorResponse(pending, value);
  try {
    await createPrivateLine(paths.response, response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("DUPLICATE_RESPONSE");
    throw error;
  }
}

export class OperatorBroker {
  readonly paths: OperatorBrokerPaths;
  private readonly stateDir: string;
  private readonly timeoutMs: number;
  private readonly pollMs: number;
  private server: Server | null = null;
  private active: ActiveRequest | null = null;
  private readonly sockets = new Set<Socket>();
  private closing = false;

  constructor(options: OperatorBrokerOptions) {
    if (!isAbsolute(options.stateDir)) throw new Error("BROKER_STATE_DIR_INVALID");
    this.stateDir = options.stateDir;
    this.paths = pathsFor(options.stateDir);
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.pollMs = options.pollMs ?? 50;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 50 || this.timeoutMs > 15 * 60_000 ||
      !Number.isSafeInteger(this.pollMs) || this.pollMs < 10 || this.pollMs > 1_000) {
      throw new Error("BROKER_OPTIONS_INVALID");
    }
  }

  async start(): Promise<void> {
    if (this.server) throw new Error("BROKER_ALREADY_STARTED");
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    await assertPrivateDirectory(this.stateDir);
    if (await exists(this.paths.socket) || await exists(this.paths.pending) || await exists(this.paths.response)) {
      throw new Error("BROKER_STATE_NOT_EMPTY");
    }
    const server = createServer((socket) => this.receive(socket));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.paths.socket, () => {
        server.off("error", reject);
        resolve();
      });
    });
    await chmod(this.paths.socket, 0o600);
    const socket = await lstat(this.paths.socket);
    if (!socket.isSocket() || socket.isSymbolicLink() || (socket.mode & 0o777) !== 0o600) {
      await this.close();
      throw new Error("BROKER_SOCKET_UNSAFE");
    }
  }

  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    if (this.active) await this.finish(this.active, failure(this.active.request.requestId, "BROKER_SHUTDOWN"));
    for (const socket of this.sockets) {
      if (!socket.writableEnded) socket.destroy();
    }
    const server = this.server;
    this.server = null;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([
      unlinkIfPresent(this.paths.pending),
      unlinkIfPresent(this.paths.response),
      unlinkIfPresent(this.paths.socket),
    ]);
  }

  private receive(socket: Socket): void {
    let bytes = Buffer.alloc(0);
    let handled = false;
    this.sockets.add(socket);
    const readTimer = setTimeout(() => {
      if (!handled) {
        handled = true;
        safeEnd(socket, failure("invalid-request", "INVALID_REQUEST"));
      }
    }, Math.min(this.timeoutMs, 5_000));
    socket.on("error", () => undefined);
    socket.on("data", (chunk: Buffer) => {
      if (handled) return;
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.byteLength > OPERATOR_MESSAGE_LIMIT_BYTES) {
        handled = true;
        clearTimeout(readTimer);
        safeEnd(socket, failure("invalid-request", "INVALID_REQUEST"));
        return;
      }
      if (!bytes.includes(0x0a)) return;
      handled = true;
      clearTimeout(readTimer);
      void this.accept(bytes, socket);
    });
    socket.on("end", () => {
      if (!handled) socket.destroy();
    });
    socket.once("close", () => {
      clearTimeout(readTimer);
      this.sockets.delete(socket);
    });
  }

  private async accept(bytes: Buffer, socket: Socket): Promise<void> {
    let decoded: unknown;
    let request: OperatorRequest;
    try {
      decoded = parseOperatorLine(bytes);
      request = parseOperatorRequest(decoded);
    } catch {
      safeEnd(socket, failure(fallbackRequestId(decoded), "INVALID_REQUEST"));
      return;
    }
    if (this.closing) {
      safeEnd(socket, failure(request.requestId, "BROKER_SHUTDOWN"));
      return;
    }
    if (this.active) {
      safeEnd(socket, failure(request.requestId, "BROKER_BUSY"));
      return;
    }
    const active = {} as ActiveRequest;
    active.request = request;
    active.socket = socket;
    active.settled = false;
    active.timer = setTimeout(() => {
      void this.finish(active, failure(request.requestId, "OPERATOR_TIMEOUT"));
    }, this.timeoutMs);
    active.poller = setInterval(() => void this.consumeResponse(active), this.pollMs);
    this.active = active;
    socket.once("close", () => {
      if (!active.settled) void this.finish(active, failure(request.requestId, "BROKER_SHUTDOWN"));
    });
    try {
      await createPrivateLine(this.paths.pending, request);
    } catch {
      await this.finish(active, failure(request.requestId, "BROKER_FAILED"));
    }
  }

  private async consumeResponse(active: ActiveRequest): Promise<void> {
    if (active.settled || this.active !== active || !(await exists(this.paths.response))) return;
    try {
      const bytes = await readPrivateLine(this.paths.response);
      const response = parseOperatorResponse(active.request, parseOperatorLine(bytes));
      await this.finish(active, response);
    } catch {
      await this.finish(active, failure(active.request.requestId, "INVALID_RESPONSE"));
    }
  }

  private async finish(active: ActiveRequest, response: OperatorResponse): Promise<void> {
    if (active.settled) return;
    active.settled = true;
    clearTimeout(active.timer);
    clearInterval(active.poller);
    try {
      safeEnd(active.socket, response);
    } finally {
      try {
        await Promise.all([unlinkIfPresent(this.paths.pending), unlinkIfPresent(this.paths.response)]);
      } finally {
        if (this.active === active) this.active = null;
      }
    }
  }
}
