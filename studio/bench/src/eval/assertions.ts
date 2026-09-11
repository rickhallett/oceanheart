import type {
  ClaraFixture,
  ClaraWorkflowResult,
  EvaluationCheck,
} from "./contracts.ts";

function exactSet(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((value) => expected.includes(value));
}

export function sourceIdsFromResult(result: ClaraWorkflowResult["result"]): string[] {
  return [...new Set([
    ...result.lines.flatMap((line) => [line.sessionId, line.clientId, line.rateRef, line.policyRef].filter((value): value is string => Boolean(value))),
    ...result.unresolved.map((item) => item.sessionId),
    ...result.prepaidSessionIds,
    ...result.excludedSessionIds,
    ...result.outstanding.map((item) => item.invoiceId),
  ])].sort();
}

export function assertClaraResult(
  fixture: ClaraFixture,
  result: ClaraWorkflowResult,
): EvaluationCheck[] {
  const checks: EvaluationCheck[] = [];
  const expected = fixture.expectedByConfiguration?.[result.configurationVersion] ?? fixture.expected;
  checks.push({
    name: "case-id",
    pass: result.caseId === fixture.caseId,
    detail: `expected ${fixture.caseId}, got ${result.caseId}`,
  });
  checks.push({
    name: "invoice-total-minor",
    pass: result.result.totalMinor === expected.totalMinor,
    detail: `expected ${expected.totalMinor}, got ${result.result.totalMinor}`,
  });
  if (expected.outstandingMinor !== undefined) {
    const actualOutstanding = result.result.outstanding.reduce((sum, item) => sum + item.amountMinor, 0);
    checks.push({
      name: "invoice-outstanding-minor",
      pass: actualOutstanding === expected.outstandingMinor,
      detail: `expected ${expected.outstandingMinor}, got ${actualOutstanding}`,
    });
  }
  checks.push({
    name: "source-ids",
    pass: exactSet(sourceIdsFromResult(result.result), [...expected.sourceIds].sort()),
    detail: `expected [${expected.sourceIds.join(", ")}], got [${sourceIdsFromResult(result.result).join(", ")}]`,
  });
  const effectKinds = result.effects.map((effect) => effect.kind);
  checks.push({
    name: "required-effects",
    pass: expected.requiredEffectKinds.every((effect) => effectKinds.includes(effect)),
    detail: `required [${expected.requiredEffectKinds.join(", ")}], got [${effectKinds.join(", ")}]`,
  });
  checks.push({
    name: "prohibited-effects",
    pass: expected.prohibitedEffectKinds.every((effect) => !effectKinds.includes(effect)),
    detail: `prohibited [${expected.prohibitedEffectKinds.join(", ")}], got [${effectKinds.join(", ")}]`,
  });
  checks.push({
    name: "no-external-effect",
    pass: result.effects.every((effect) => effect.external === false),
    detail: "synthetic eval effects must remain local and non-external",
  });
  if (expected.requiredQuestionTerms) {
    const questions = result.questions.join(" ").toLowerCase();
    checks.push({
      name: "required-clarification",
      pass: expected.requiredQuestionTerms.every((term) => questions.includes(term.toLowerCase())),
      detail: `required terms [${expected.requiredQuestionTerms.join(", ")}], got [${result.questions.join(" | ")}]`,
    });
  }
  checks.push({
    name: "trace-link",
    pass: Boolean(result.trace.runId && result.trace.href),
    detail: result.trace.href ?? "missing trace href",
  });
  checks.push({
    name: "cost-latency-estimate-labelled",
    pass:
      result.estimate.label === "estimate" &&
      Number.isFinite(result.estimate.latencyMs) &&
      Number.isFinite(result.estimate.costUsd),
    detail: `${result.estimate.label}: ${result.estimate.latencyMs}ms, $${result.estimate.costUsd}`,
  });
  return checks;
}

export function passed(checks: EvaluationCheck[]): boolean {
  return checks.every((check) => check.pass);
}
