#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import { digest } from "../../src/runtime/store.ts";

function request(clientId: string) {
  return {
    clientId,
    actor: "synthetic-recovery-probe",
    idempotencyKey: `ric-136-${clientId}-restart-replay`,
    input: {
      schemaVersion: 1 as const,
      clientId,
      period: { from: "2026-09-01", to: "2026-09-30" },
      sessions: [
        {
          id: `${clientId}-restart-session`,
          clientId: `${clientId}-restart-person`,
          date: "2026-09-11",
          attendance: "attended" as const,
          rateMinor: 9100,
          rateRef: "synthetic-restart-v1",
        },
      ],
    },
  };
}

export function seedInterruptedDraft(clientId: string, stateRoot: string) {
  const runtime = new PiWorkflowRuntime({ root: stateRoot });
  try {
    const queued = runtime.store.enqueue(request(clientId));
    if (queued.status !== "queued") throw new Error("RECOVERY_PROBE_ALREADY_USED");
    const claimed = runtime.store.claim(clientId, queued.id, 1_000);
    const effect = runtime.store.effect(clientId, queued.id, claimed.token!);
    claimed.lease = 0;
    runtime.store.save(claimed);
    return { runId: queued.id, draftId: effect.draftId, resultHash: digest(effect) };
  } finally {
    runtime.close();
  }
}

export async function verifyRecoveredDraft(clientId: string, stateRoot: string) {
  const runtime = new PiWorkflowRuntime({ root: stateRoot });
  try {
    const job = await runtime.startRun(request(clientId));
    const counts = runtime.store.db
      .prepare("SELECT (SELECT count(*) FROM jobs) jobs, (SELECT count(*) FROM effects) effects, (SELECT count(*) FROM reservations) reservations")
      .get() as { jobs: number; effects: number; reservations: number };
    if (
      job.status !== "succeeded" ||
      job.result?.totalMinor !== 9100 ||
      counts.jobs !== 1 ||
      counts.effects !== 1 ||
      counts.reservations !== 1
    )
      throw new Error("RECOVERY_PROBE_FAILED");
    return {
      runId: job.id,
      draftId: job.result.draftId,
      resultHash: digest(job.result),
      ...counts,
    };
  } finally {
    runtime.close();
  }
}

async function main() {
  const [operation, clientId, stateRootArgument] = process.argv.slice(2);
  if (!/^c[0-9]{4,}$/.test(clientId ?? "") || !stateRootArgument)
    throw new Error("Usage: remote-recovery-smoke.ts seed|verify <cNNNN> <state-root>");
  const stateRoot = resolve(stateRootArgument);
  if (stateRoot !== `/var/lib/studio-pi-runtime/${clientId}-recovery-probe`)
    throw new Error("INVALID_STATE_ROOT");
  const result =
    operation === "seed"
      ? seedInterruptedDraft(clientId, stateRoot)
      : operation === "verify"
        ? await verifyRecoveredDraft(clientId, stateRoot)
        : (() => {
            throw new Error("INVALID_OPERATION");
          })();
  process.stdout.write(`${JSON.stringify({ operation, clientId, ...result })}\n`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main();
