import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { passed, assertClaraResult } from "../eval/assertions.ts";
import type { ClaraFixture, ClaraWorkflowResult } from "../eval/contracts.ts";
import { loadClaraFixtures } from "../eval/fixtures.ts";
import ClaraWorkflowProvider from "../eval/promptfoo-clara-provider.ts";
import { buildComparisonReport, writeComparisonReport } from "../eval/report.ts";
import { artifactDigest, type ClaraConfigurationArtifact } from "./configuration.ts";

export type AdaptationEvaluation = {
  schemaVersion: 1;
  evaluationId: string;
  clientId: string;
  baselineArtifactDigest: string;
  candidateArtifactDigest: string;
  accepted: boolean;
  total: number;
  passed: number;
  reportDigest: string;
  jsonPath: string;
  htmlPath: string;
  stateBoundary: "fresh-isolated-evaluation";
};

async function evaluateFixture(
  fixture: ClaraFixture,
  version: string,
  root: string,
): Promise<ClaraWorkflowResult> {
  const provider = new ClaraWorkflowProvider({
    config: { configurationVersion: version, runtimeRoot: join(root, version, fixture.caseId) },
  });
  const response = await provider.callApi("Prepare the synthetic invoice draft.", { vars: { fixture } });
  return JSON.parse(response.output) as ClaraWorkflowResult;
}

export async function evaluateAdaptation(input: {
  stateDir: string;
  outputDir: string;
  baseline: ClaraConfigurationArtifact;
  baselineDigest: string;
  candidate: ClaraConfigurationArtifact;
  candidateDigest: string;
}): Promise<AdaptationEvaluation> {
  if (
    input.baseline.clientId !== input.candidate.clientId ||
    input.baseline.version === input.candidate.version ||
    artifactDigest(input.baseline) !== input.baselineDigest ||
    artifactDigest(input.candidate) !== input.candidateDigest
  ) throw new Error("INVALID_CONFIGURATION_COMPARISON");
  const evaluationId = randomUUID();
  const evaluationRoot = join(input.stateDir, "evaluations", evaluationId);
  const reportDir = join(input.outputDir, evaluationId);
  await mkdir(evaluationRoot, { recursive: true, mode: 0o700 });
  await mkdir(reportDir, { recursive: true, mode: 0o700 });
  const fixtures = await loadClaraFixtures();
  const runs: Array<{ fixture: ClaraFixture; result: ClaraWorkflowResult }> = [];
  for (const artifact of [input.baseline, input.candidate]) {
    for (const fixture of fixtures) {
      runs.push({ fixture, result: await evaluateFixture(fixture, artifact.version, evaluationRoot) });
    }
  }
  const configurations = [input.baseline, input.candidate].map((artifact) => ({
    id: artifact.version,
    instructionsVersion: artifact.instructionsVersion,
    toolsetVersion: artifact.toolsetVersion,
    modelProfile: artifact.modelProfile,
    purpose: artifact.policy
      ? `Scoped rate change effective ${artifact.policy.effectiveDate}.`
      : "Baseline client-specific agreements and invoice draft rules.",
  }));
  const report = buildComparisonReport(configurations, runs);
  const paths = await writeComparisonReport(reportDir, report);
  await Promise.all([chmod(paths.jsonPath, 0o600), chmod(paths.htmlPath, 0o600)]);
  const reportJson = await readFile(paths.jsonPath);
  const accepted = runs.every(({ fixture, result }) => passed(assertClaraResult(fixture, result)));
  const receipt: AdaptationEvaluation = {
    schemaVersion: 1,
    evaluationId,
    clientId: input.candidate.clientId,
    baselineArtifactDigest: input.baselineDigest,
    candidateArtifactDigest: input.candidateDigest,
    accepted,
    total: report.results.length,
    passed: report.results.filter((result) => result.pass).length,
    reportDigest: `sha256:${createHash("sha256").update(reportJson).digest("hex")}`,
    jsonPath: paths.jsonPath,
    htmlPath: paths.htmlPath,
    stateBoundary: "fresh-isolated-evaluation",
  };
  await writeFile(join(reportDir, "activation-evaluation.json"), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  return receipt;
}
