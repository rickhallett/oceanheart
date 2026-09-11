#!/usr/bin/env node
import { lstatSync, realpathSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import type { Job } from "../../src/runtime/store.ts";

type RecoveryResult = {
  runId: string;
  status: string;
};

export type RecoveryReceipt = {
  schemaVersion: 1;
  clientId: string;
  inspected: number;
  recovered: RecoveryResult[];
  deferred: RecoveryResult[];
  errors: Array<{ runId: string; code: "RECOVERY_FAILED" }>;
};

function assertExistingStateRoot(stateRoot: string) {
  const root = resolve(stateRoot);
  if (realpathSync(root) !== root || !lstatSync(root).isDirectory())
    throw new Error("INVALID_STATE_ROOT");
  const database = `${root}/jobs.sqlite`;
  if (lstatSync(database).isSymbolicLink() || !lstatSync(database).isFile())
    throw new Error("INVALID_STATE_DATABASE");
  return root;
}

export async function recoverDurableJobs(
  clientId: string,
  stateRoot: string,
  now = Date.now(),
): Promise<RecoveryReceipt> {
  if (!/^c[0-9]{4,}$/.test(clientId)) throw new Error("INVALID_CLIENT_ID");
  const root = assertExistingStateRoot(stateRoot);
  const runtime = new PiWorkflowRuntime({ root });
  const recovered: RecoveryResult[] = [];
  const deferred: RecoveryResult[] = [];
  const errors: Array<{ runId: string; code: "RECOVERY_FAILED" }> = [];
  try {
    const rows = runtime.store.db
      .prepare("SELECT json FROM jobs WHERE client=? ORDER BY id")
      .all(clientId) as Array<{ json: string }>;
    for (const row of rows) {
      const job = JSON.parse(row.json) as Job;
      if (job.clientId !== clientId) throw new Error("CLIENT_SCOPE_MISMATCH");
      if (job.status !== "queued" && job.status !== "running") continue;
      if (job.status === "running" && job.lease > now) {
        deferred.push({ runId: job.id, status: job.status });
        continue;
      }
      try {
        const result = await runtime.resumeSession(clientId, job.id);
        recovered.push({ runId: result.id, status: result.status });
      } catch {
        errors.push({ runId: job.id, code: "RECOVERY_FAILED" });
      }
    }
    return {
      schemaVersion: 1,
      clientId,
      inspected: rows.length,
      recovered,
      deferred,
      errors,
    };
  } finally {
    runtime.close();
  }
}

async function main() {
  const [clientId, stateRoot] = process.argv.slice(2);
  if (!clientId || !stateRoot)
    throw new Error("Usage: recover-durable-jobs.ts <cNNNN> <state-root>");
  const expectedRoot = `/var/lib/studio-pi-runtime/${clientId}`;
  if (resolve(stateRoot) !== expectedRoot || basename(stateRoot) !== clientId)
    throw new Error("INVALID_STATE_ROOT");
  const receipt = await recoverDurableJobs(clientId, stateRoot);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  if (receipt.errors.length) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
