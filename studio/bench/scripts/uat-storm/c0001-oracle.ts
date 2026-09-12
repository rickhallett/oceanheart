#!/usr/bin/env node
import { resolve } from "node:path";

import { inspectClaraBaselineEffect } from "../../src/uat-storm/clara-oracle.ts";

const values = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index], value = process.argv[index + 1];
  if (!key?.startsWith("--") || value === undefined) process.exit(2);
  values.set(key, value);
}
const stateRoot = resolve(values.get("--state-root") ?? "");
const clientId = values.get("--client");
const runtimeActorDigest = values.get("--runtime-actor-digest");
if (stateRoot !== "/var/lib/studio-pi-runtime/c0001" || clientId !== "c0001" ||
  !runtimeActorDigest || !/^sha256:[0-9a-f]{64}$/.test(runtimeActorDigest)) process.exit(2);
try {
  const result = await inspectClaraBaselineEffect({
    stateRoot,
    clientId,
    runtimeActorDigest: runtimeActorDigest as `sha256:${string}`,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch {
  process.stderr.write("c0001 oracle failed closed; no job or identity data was emitted.\n");
  process.exitCode = 1;
}
