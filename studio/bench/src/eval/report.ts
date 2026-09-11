import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { assertClaraResult, passed } from "./assertions.ts";
import type { ClaraFixture, ClaraWorkflowResult, EvaluationCheck } from "./contracts.ts";

export type WorkflowConfiguration = {
  id: string;
  instructionsVersion: string;
  toolsetVersion: string;
  modelProfile: string;
  purpose: string;
};

export type EvaluationRun = {
  fixture: ClaraFixture;
  result: ClaraWorkflowResult;
};

export type ComparisonReport = {
  schemaVersion: 1;
  suite: "clara-invoice-v1";
  generatedAt: string;
  configurations: WorkflowConfiguration[];
  results: Array<{
    caseId: string;
    partition: ClaraFixture["partition"];
    configurationVersion: string;
    pass: boolean;
    checks: EvaluationCheck[];
    trace: ClaraWorkflowResult["trace"];
    latency: ClaraWorkflowResult["estimate"];
  }>;
  limits: string[];
};

export function buildComparisonReport(
  configurations: WorkflowConfiguration[],
  runs: EvaluationRun[],
  generatedAt = new Date().toISOString(),
): ComparisonReport {
  return {
    schemaVersion: 1,
    suite: "clara-invoice-v1",
    generatedAt,
    configurations,
    results: runs.map(({ fixture, result }) => {
      const checks = assertClaraResult(fixture, result);
      return {
        caseId: fixture.caseId,
        partition: fixture.partition,
        configurationVersion: result.configurationVersion,
        pass: passed(checks),
        checks,
        trace: result.trace,
        latency: result.estimate,
      };
    }),
    limits: [
      "Synthetic fixtures only; no customer data.",
      "No billing, mail, or model calls are permitted by the evaluation adapter contract.",
      "Cost and latency values are labelled estimates, not provider receipts.",
      "A trace link identifies a workflow audit record; it is not a hosted acceptance receipt.",
    ],
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function comparisonReportHtml(report: ComparisonReport): string {
  const rows = report.results
    .map((result) => {
      const trace = result.trace.href
        ? `<a href="${escapeHtml(result.trace.href)}">${escapeHtml(result.trace.runId)}</a>`
        : escapeHtml(result.trace.runId);
      return `<tr><td>${escapeHtml(result.caseId)}</td><td>${escapeHtml(result.partition)}</td><td>${escapeHtml(result.configurationVersion)}</td><td>${result.pass ? "PASS" : "FAIL"}</td><td>${trace}</td><td>${result.latency.label}: ${result.latency.latencyMs} ms; $${result.latency.costUsd.toFixed(4)} (${escapeHtml(result.latency.basis)})</td></tr>`;
    })
    .join("\n");
  const limits = report.limits.map((limit) => `<li>${escapeHtml(limit)}</li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Clara evaluation comparison</title><style>body{font-family:system-ui,sans-serif;margin:2rem;color:#18212b}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccd3db;padding:.55rem;text-align:left;vertical-align:top}th{background:#eef3f7}</style></head><body><h1>Clara invoice workflow comparison</h1><p>Generated ${escapeHtml(report.generatedAt)}. All cost and latency figures are estimates.</p><h2>Configurations</h2><ul>${report.configurations.map((configuration) => `<li><strong>${escapeHtml(configuration.id)}</strong>: ${escapeHtml(configuration.purpose)} (instructions ${escapeHtml(configuration.instructionsVersion)}, toolset ${escapeHtml(configuration.toolsetVersion)}, model profile ${escapeHtml(configuration.modelProfile)})</li>`).join("")}</ul><table><thead><tr><th>Case</th><th>Set</th><th>Configuration</th><th>Result</th><th>Trace</th><th>Cost and latency</th></tr></thead><tbody>${rows}</tbody></table><h2>Limits</h2><ul>${limits}</ul></body></html>`;
}

export async function writeComparisonReport(
  directory: string,
  report: ComparisonReport,
): Promise<{ jsonPath: string; htmlPath: string }> {
  await mkdir(directory, { recursive: true });
  const jsonPath = join(directory, "clara-comparison.json");
  const htmlPath = join(directory, "clara-comparison.html");
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(htmlPath, comparisonReportHtml(report), "utf8"),
  ]);
  return { jsonPath, htmlPath };
}
