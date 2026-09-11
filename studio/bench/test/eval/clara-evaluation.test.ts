import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { assertClaraResult, passed } from "../../src/eval/assertions.ts";
import type { ClaraFixture, ClaraResult, ClaraWorkflowResult } from "../../src/eval/contracts.ts";
import { loadClaraFixtures, validateClaraFixture } from "../../src/eval/fixtures.ts";
import { buildComparisonReport, comparisonReportHtml, writeComparisonReport } from "../../src/eval/report.ts";
import ClaraWorkflowProvider from "../../src/eval/promptfoo-clara-provider.ts";

function idealResult(fixture: ClaraFixture): ClaraWorkflowResult {
  const result: ClaraResult = { schemaVersion: 1, clientId: fixture.clientId, currency: "GBP", draftId: `draft-${fixture.caseId}`, lines: [], totalMinor: 0, unresolved: [], prepaidSessionIds: [], excludedSessionIds: [], outstanding: [] };
  for (const session of fixture.input.sessions) {
    if (session.priorInvoiceId) { result.excludedSessionIds.push(session.id); continue; }
    if (session.attendance === "unknown") { result.unresolved.push({ sessionId: session.id, reason: "Attendance is not confirmed" }); continue; }
    if (session.prepaid) { result.prepaidSessionIds.push(session.id); continue; }
    const amountMinor = session.attendance === "cancelled" ? session.cancellationChargeMinor! : session.rateMinor!;
    result.lines.push({ sessionId: session.id, clientId: session.clientId, amountMinor, ...(session.attendance === "cancelled" ? { policyRef: session.policyRef! } : { rateRef: session.rateRef! }) });
    result.totalMinor += amountMinor;
  }
  result.outstanding = (fixture.input.payments ?? []).map((payment) => ({ invoiceId: payment.invoiceId, amountMinor: payment.invoiceTotalMinor - payment.receivedMinor }));
  return { caseId: fixture.caseId, configurationVersion: "clara-2026-09-01", result, questions: result.unresolved.map((item) => item.reason), sourceIds: [], effects: [{ kind: fixture.replay ? "invoice_draft.reused" : result.unresolved.length ? "clarification.requested" : "invoice_draft.prepared", external: false }], trace: { runId: `run-${fixture.caseId}`, href: `bench://trace/${fixture.caseId}` }, estimate: { latencyMs: 12, costUsd: 0, label: "estimate", basis: "test fixture only" } };
}

test("loads canonical CL-01 through CL-08 fixed cases plus independent adaptation case fixtures", async () => {
  const fixtures = await loadClaraFixtures();
  assert.deepEqual(fixtures.map((fixture) => fixture.caseId), ["CL-01", "CL-02", "CL-03", "CL-04", "CL-05", "CL-06", "CL-07", "CL-08", "CL-09"]);
  assert.equal(fixtures.filter((fixture) => fixture.partition === "fixed").length, 8);
  assert.equal(fixtures.filter((fixture) => fixture.partition === "held-out").length, 1);
  assert.deepEqual(fixtures.flatMap(validateClaraFixture), []);
});

test("asserts exact amounts, sources, effects, trace links, and estimate labels", async () => {
  for (const fixture of await loadClaraFixtures()) assert.equal(passed(assertClaraResult(fixture, idealResult(fixture))), true, fixture.caseId);
});

test("fails closed for a billing effect", async () => {
  const [fixture] = await loadClaraFixtures("fixed");
  const result = idealResult(fixture);
  result.effects.push({ kind: "payment.charge", external: true });
  const checks = assertClaraResult(fixture, result);
  assert.equal(checks.find((check) => check.name === "prohibited-effects")?.pass, false);
  assert.equal(checks.find((check) => check.name === "no-external-effect")?.pass, false);
});

test("writes JSON and HTML comparison reports with trace links and estimates", async () => {
  const [fixture] = await loadClaraFixtures("fixed");
  const report = buildComparisonReport([{ id: "clara-2026-09-01", instructionsVersion: "i1", toolsetVersion: "t1", modelProfile: "scripted-control", purpose: "baseline control" }, { id: "clara-2026-10-01-rate-change", instructionsVersion: "i2", toolsetVersion: "t1", modelProfile: "scripted-control", purpose: "identical control until rate adaptation is implemented" }], [{ fixture, result: idealResult(fixture) }], "2026-09-11T12:00:00.000Z");
  assert.match(comparisonReportHtml(report), /bench:\/\/trace\/CL-01/);
  const directory = await mkdtemp(join(tmpdir(), "clara-eval-"));
  try {
    const paths = await writeComparisonReport(directory, report);
    assert.equal(JSON.parse(await readFile(paths.jsonPath, "utf8")).suite, "clara-invoice-v1");
    assert.match(await readFile(paths.htmlPath, "utf8"), /All cost and latency figures are estimates/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("Promptfoo provider invokes the actual Pi runtime and performs the explicit replay", async () => {
  const directory = await mkdtemp(join(tmpdir(), "clara-runtime-"));
  try {
    const provider = new ClaraWorkflowProvider({ config: { configurationVersion: "clara-2026-09-01", runtimeRoot: directory } });
    for (const fixture of await loadClaraFixtures()) {
      const response = await provider.callApi("ignored by the runtime", { vars: { fixture } });
      const result = JSON.parse(response.output) as ClaraWorkflowResult;
      assert.equal(passed(assertClaraResult(fixture, result)), true, fixture.caseId);
      assert.equal(result.estimate.latencyMs >= 0, true, fixture.caseId);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
