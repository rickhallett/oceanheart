#!/usr/bin/env node
import { lstat, readFile } from "node:fs/promises";

import { identityBinding, targetBinding } from "../../src/uat-storm/manifest.ts";
import {
  parseOperatorRequest,
  parseOperatorResponse,
  type OperatorResponse,
} from "../../src/uat-storm/operator-contract.ts";
import type { StormManifest } from "../../src/uat-storm/types.ts";

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error("OPERATOR_RESPONSE_OPTION_REQUIRED");
  return value;
}

async function privateJson(path: string): Promise<unknown> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024 || (info.mode & 0o077) !== 0)
    throw new Error("OPERATOR_RESPONSE_FILE_UNSAFE");
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const request = parseOperatorRequest(await privateJson(option("--pending")));
  let response: OperatorResponse;
  if (command === "inspect") {
    if (request.kind !== "inspect") throw new Error("OPERATOR_RESPONSE_KIND_MISMATCH");
    const manifest = await privateJson(option("--manifest")) as StormManifest;
    response = {
      schemaVersion: 1, requestId: request.requestId, ok: true,
      result: {
        schemaVersion: 1, mode: "live", executionMode: "hosted-operator-driven",
        adapterId: "root-cua-browser1", targetBindingDigest: targetBinding(manifest),
        identityBindingDigest: identityBinding(manifest), oracleBindingDigest: manifest.oracle.bindingDigest,
        leaseId: manifest.lease.leaseId, epoch: manifest.lease.epoch, expiresAt: manifest.lease.expiresAt,
        operatorSessionBindingDigest: manifest.lease.operatorSessionBindingDigest,
        operatorControl: true, operatorSession: true, dedicatedProfile: false, fictionalDataOnly: true,
      },
    };
  } else if (command === "perform" || command === "oracle") {
    if (request.kind !== command) throw new Error("OPERATOR_RESPONSE_KIND_MISMATCH");
    response = {
      schemaVersion: 1, requestId: request.requestId, ok: true,
      result: await privateJson(option("--result")) as Record<string, never>,
    };
  } else if (command === "cleanup") {
    if (request.kind !== "cleanup") throw new Error("OPERATOR_RESPONSE_KIND_MISMATCH");
    response = { schemaVersion: 1, requestId: request.requestId, ok: true, result: {} };
  } else throw new Error("OPERATOR_RESPONSE_COMMAND_INVALID");
  parseOperatorResponse(request, response);
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "OPERATOR_RESPONSE_FAILED"}\n`);
  process.exitCode = 1;
});
