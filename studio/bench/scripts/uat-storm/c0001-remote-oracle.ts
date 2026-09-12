#!/usr/bin/env node
import { execFile } from "node:child_process";
import { lstat, open, readFile } from "node:fs/promises";
import { promisify } from "node:util";

import { parseOperatorResponse } from "../../src/uat-storm/operator-contract.ts";
import type { StormManifest } from "../../src/uat-storm/types.ts";

const execute = promisify(execFile);

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error("REMOTE_ORACLE_OPTION_REQUIRED");
  return value;
}

async function privateManifest(path: string): Promise<StormManifest> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 64 * 1024 || (info.mode & 0o077) !== 0)
    throw new Error("REMOTE_ORACLE_MANIFEST_UNSAFE");
  return JSON.parse(await readFile(path, "utf8")) as StormManifest;
}

async function main(): Promise<void> {
  const output = option("--output");
  const manifest = await privateManifest(option("--manifest"));
  if (manifest.mode !== "live" || manifest.target.clientId !== "c0001" ||
    manifest.target.origin !== "https://studio-c0001-runtime.exe.xyz" ||
    manifest.target.backendDeployment !== "harmless-goldfish-558") throw new Error("REMOTE_ORACLE_TARGET_INVALID");
  const remoteArgs = [
    "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "HostKeyAlias=exe.dev",
    "-o", "UpdateHostKeys=no", "studio-c0001-runtime.exe.xyz", "/usr/local/bin/node",
    "/opt/oceanheart/uat-storm/studio/bench/scripts/uat-storm/c0001-oracle.ts",
    "--state-root", "/var/lib/studio-pi-runtime/c0001", "--client", "c0001",
    "--runtime-actor-digest", manifest.identity.runtimeActorDigest,
  ];
  let stdout: string;
  try { ({ stdout } = await execute("ssh", remoteArgs, { encoding: "utf8", maxBuffer: 64 * 1024 })); }
  catch { throw new Error("REMOTE_ORACLE_TRANSPORT_FAILED"); }
  let result: unknown;
  try { result = JSON.parse(stdout); } catch { throw new Error("REMOTE_ORACLE_RESPONSE_INVALID"); }
  parseOperatorResponse(
    { schemaVersion: 1, requestId: "oracle-validation", kind: "oracle", effectKey: "clara-c0001-september-invoice" },
    { schemaVersion: 1, requestId: "oracle-validation", ok: true, result },
  );
  const handle = await open(output, "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(result)}\n`); await handle.sync(); }
  finally { await handle.close(); }
  process.stdout.write(`${output}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "REMOTE_ORACLE_FAILED"}\n`);
  process.exitCode = 1;
});
