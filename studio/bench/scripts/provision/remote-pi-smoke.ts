#!/usr/bin/env node
import { resolve } from "node:path";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";

const [clientId, stateRootArgument] = process.argv.slice(2);
if (!/^c[0-9]{4,}$/.test(clientId ?? "") || !stateRootArgument)
  throw new Error("Usage: remote-pi-smoke.ts <cNNNN> <absolute-state-root>");
const stateRoot = resolve(stateRootArgument);
if (!stateRoot.startsWith("/var/lib/studio-pi-"))
  throw new Error("Synthetic state root must be under /var/lib/studio-pi-*");
const runtime = new PiWorkflowRuntime({ root: stateRoot });
try {
  const result = await runtime.startRun({
    clientId,
    actor: "synthetic-operator",
    idempotencyKey: `ric-136-${clientId}-pi-0851`,
    input: {
      schemaVersion: 1,
      clientId,
      period: { from: "2026-09-01", to: "2026-09-30" },
      sessions: [
        {
          id: `${clientId}-session-1`,
          clientId: `${clientId}-person-1`,
          date: "2026-09-10",
          attendance: "attended",
          rateMinor: 8000,
          rateRef: "synthetic-agreement-v1",
        },
      ],
    },
  });
  process.stdout.write(
    `${JSON.stringify({
      clientId,
      status: result.status,
      totalMinor: result.result?.totalMinor,
      traceEvents: runtime.exportTrace(clientId, result.id).events.length,
    })}\n`,
  );
  if (result.status !== "succeeded" || result.result?.totalMinor !== 8000)
    process.exitCode = 1;
} finally {
  runtime.close();
}
