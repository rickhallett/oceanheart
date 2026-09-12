#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import {
  OperatorBroker,
  readPendingOperatorRequest,
  submitOperatorResponse,
} from "../../src/uat-storm/operator-broker.ts";
import { OPERATOR_MESSAGE_LIMIT_BYTES } from "../../src/uat-storm/operator-contract.ts";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function stateDir(): string {
  const value = option("--state-dir");
  if (!value) throw new Error("USAGE_STATE_DIR_REQUIRED");
  return value;
}

async function stdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.from(chunk);
    size += bytes.byteLength;
    if (size > OPERATOR_MESSAGE_LIMIT_BYTES) throw new Error("MESSAGE_TOO_LARGE");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

async function responseInput(): Promise<unknown> {
  const file = option("--file");
  const bytes = file ? await readFile(file) : await stdin();
  if (bytes.byteLength > OPERATOR_MESSAGE_LIMIT_BYTES) throw new Error("MESSAGE_TOO_LARGE");
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("INVALID_RESPONSE");
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "pending") {
    process.stdout.write(`${JSON.stringify(await readPendingOperatorRequest(stateDir()), null, 2)}\n`);
    return;
  }
  if (command === "respond") {
    await submitOperatorResponse(stateDir(), await responseInput());
    process.stdout.write("response accepted\n");
    return;
  }
  if (command !== "serve") throw new Error("USAGE_COMMAND_INVALID");
  const timeoutOption = option("--timeout-ms");
  const timeoutMs = timeoutOption === undefined ? undefined : Number(timeoutOption);
  const broker = new OperatorBroker({ stateDir: stateDir(), timeoutMs });
  await broker.start();
  process.stdout.write(`${broker.paths.socket}\n`);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await broker.close();
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}

main().catch((error: unknown) => {
  const code = error instanceof Error ? error.message : "BROKER_FAILED";
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
});
