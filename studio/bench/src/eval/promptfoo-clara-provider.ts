import { createHash, randomUUID } from "node:crypto";

import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

import { configuredClaraInput } from "./configuration.ts";

import { PiWorkflowRuntime } from "../runtime/pi-adapter.ts";

import type { ClaraFixture, ClaraWorkflowResult } from "./contracts.ts";

export type PromptfooProviderConfig = {
  configurationVersion: string;
  runtimeRoot: string;
  actor?: string;
  traceBaseHref?: string;
  estimatedLatencyMs?: number;
  estimatedCostUsd?: number;
};

function fixtureFrom(value: unknown): ClaraFixture {
  if (typeof value === "string") return JSON.parse(value) as ClaraFixture;
  if (value && typeof value === "object") return value as ClaraFixture;
  throw new Error("Promptfoo fixture variable is required");
}

function keyFor(fixture: ClaraFixture, configurationVersion: string): string {
  return createHash("sha256")
    .update(`${fixture.caseId}:${configurationVersion}:${JSON.stringify(fixture.input)}`)
    .digest("hex");
}

/** Promptfoo custom provider that invokes PiWorkflowRuntime, the actual workflow path. */
export default class ClaraWorkflowProvider {
  readonly config: PromptfooProviderConfig;

  constructor(options: { config?: PromptfooProviderConfig }) {
    if (!options.config?.configurationVersion || !options.config.runtimeRoot) {
      throw new Error("configurationVersion and runtimeRoot are required");
    }
    this.config = options.config;
  }

  id = (): string => `studio-clara-workflow:${this.config.configurationVersion}`;

  callApi = async (
    _prompt: string,
    context: { vars?: Record<string, unknown> },
  ): Promise<{ output: string; metadata: Record<string, unknown> }> => {
    const fixture = fixtureFrom(context.vars?.fixture);
    const baseRoot = isAbsolute(this.config.runtimeRoot) ? this.config.runtimeRoot : join(homedir(), ".local/state/oceanheart-bench/promptfoo", this.config.runtimeRoot);
    const executionRoot = join(baseRoot, randomUUID());
    const runtime = new PiWorkflowRuntime({ root: executionRoot });
    const startedAt = performance.now();
    try {
      const job = await runtime.startRun({
        clientId: fixture.clientId,
        actor: this.config.actor ?? "promptfoo-synthetic-eval",
        idempotencyKey: keyFor(fixture, this.config.configurationVersion),
        configurationVersion: this.config.configurationVersion,
        input: configuredClaraInput(fixture, this.config.configurationVersion),
      });
      if (!job.result) throw new Error(`Pi workflow did not produce a receipt: ${job.status}`);
      const replay = fixture.replay
        ? await runtime.startRun({
            clientId: fixture.clientId,
            actor: this.config.actor ?? "promptfoo-synthetic-eval",
            idempotencyKey: keyFor(fixture, this.config.configurationVersion),
            configurationVersion: this.config.configurationVersion,
        input: configuredClaraInput(fixture, this.config.configurationVersion),
          })
        : undefined;
      if (replay && replay.id !== job.id) throw new Error("same-request replay created a second job");
      const trace = runtime.exportTrace(fixture.clientId, job.id);
      const tracePath = join(executionRoot, "trace.json");
      await writeFile(tracePath, JSON.stringify(trace, null, 2) + "\n", {mode: 0o600});
      const result: ClaraWorkflowResult = {
        caseId: fixture.caseId,
        configurationVersion: this.config.configurationVersion,
        result: job.result,
        questions: job.result.unresolved.map((item) => item.reason),
        sourceIds: [],
        effects: [{ kind: replay ? "invoice_draft.reused" : job.status === "waiting_for_input" ? "clarification.requested" : "invoice_draft.prepared", external: false, idempotencyKey: job.request.idempotencyKey }],
        trace: { runId: job.id, href: pathToFileURL(tracePath).href },
        estimate: { latencyMs: Math.round(performance.now() - startedAt), costUsd: this.config.estimatedCostUsd ?? 0, label: "estimate", basis: "measured local scripted Pi workflow; no provider usage receipt" },
      };
      return { output: JSON.stringify(result), metadata: { trace, traceHref: result.trace.href, costLatency: result.estimate } };
    } finally {
      runtime.close();
    }
  };
}
