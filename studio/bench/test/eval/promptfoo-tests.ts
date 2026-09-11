import { loadClaraFixtures } from "../../src/eval/fixtures.ts";

const deterministicAssertion = `
const result = typeof output === "string" ? JSON.parse(output) : output;
const expected = vars.fixture.expected;
const sameSet = (actual, wanted) => actual.length === wanted.length && actual.every((item) => wanted.includes(item));
const effectKinds = result.effects.map((effect) => effect.kind);
const questionText = result.questions.join(" ").toLowerCase();
const sourceIds = [...new Set([
  ...result.result.lines.flatMap((line) => [line.sessionId, line.clientId, line.rateRef, line.policyRef].filter(Boolean)),
  ...result.result.unresolved.map((item) => item.sessionId),
  ...result.result.prepaidSessionIds,
  ...result.result.excludedSessionIds,
  ...result.result.outstanding.map((item) => item.invoiceId),
])].sort();
return result.caseId === vars.fixture.caseId &&
  result.result.totalMinor === expected.totalMinor &&
  (expected.outstandingMinor === undefined || result.result.outstanding.reduce((sum, item) => sum + item.amountMinor, 0) === expected.outstandingMinor) &&
  sameSet(sourceIds, expected.sourceIds.slice().sort()) &&
  expected.requiredEffectKinds.every((kind) => effectKinds.includes(kind)) &&
  expected.prohibitedEffectKinds.every((kind) => !effectKinds.includes(kind)) &&
  result.effects.every((effect) => effect.external === false) &&
  (!expected.requiredQuestionTerms || expected.requiredQuestionTerms.every((term) => questionText.includes(term.toLowerCase()))) &&
  Boolean(result.trace?.runId && result.trace?.href) &&
  result.estimate?.label === "estimate";
`;

export default async function promptfooTests() {
  const fixtures = await loadClaraFixtures();
  return fixtures.map((fixture) => ({
    description: `${fixture.caseId} ${fixture.partition}`,
    vars: { fixture },
    metadata: { caseId: fixture.caseId, partition: fixture.partition },
    options: { disableVarExpansion: true, runSerially: true },
    assert: [{ type: "javascript", value: deterministicAssertion }],
  }));
}
