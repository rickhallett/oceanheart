import { open } from "node:fs/promises";
import { join } from "node:path";

import type { StormEvent } from "./journal.ts";
import type { RunOutcome, StormManifest } from "./types.ts";

async function exclusiveWrite(path: string, text: string) {
  const handle = await open(path, "wx", 0o600);
  try { await handle.writeFile(text); await handle.sync(); }
  finally { await handle.close(); }
}

export function factualReport(manifest: StormManifest, events: StormEvent[], outcome: RunOutcome) {
  const attempted = events.filter((event) => event.kind === "action-intent");
  const effects = events.filter((event) => event.kind === "effect-present");
  const finalEffect = effects.at(-1);
  return {
    schemaVersion: 1,
    runId: manifest.runId,
    evidenceClass: manifest.mode === "live" ? "hosted-operator-driven" : "fixture",
    operatorSessionEvidence: manifest.mode === "live",
    realPractitionerOutcomeEvidence: false,
    autonomousBrowserEvidence: false,
    loadEvidence: false,
    personaEvidence: false,
    providerInference: false,
    target: {
      clientId: manifest.target.clientId,
      classification: manifest.target.classification,
      integrationSha: manifest.target.integrationSha,
      applicationSourceSha: manifest.target.applicationSourceSha,
      applicationReleaseId: manifest.target.applicationReleaseId,
      applicationArtifactDigest: manifest.target.applicationArtifactDigest,
      backendDeployment: manifest.target.backendDeployment,
    },
    operator: { actorId: manifest.identity.actorId, kind: manifest.identity.kind, role: manifest.identity.role },
    budget: { ...manifest.limits, actionsUsed: attempted.length },
    outcome,
    facts: {
      actionIntents: attempted.length,
      acknowledged: events.filter((event) => event.kind === "action-acknowledged").length,
      uncertainWrites: events.filter((event) => event.kind === "write-uncertain").length,
      effectObservations: effects.length,
      uniqueEffectCount: new Set(effects.map((event) => event.effectDigest).filter(Boolean)).size,
      invariantFailures: events.filter((event) => event.kind === "invariant-failed").length,
      finalEffectDigest: finalEffect?.effectDigest ?? null,
      finalReceiptDigest: finalEffect?.receiptDigest ?? null,
      finalTotalMinor: finalEffect?.totalMinor ?? null,
      finalTraceEvents: finalEffect?.traceEvents ?? null,
      cleanup: events.at(-1)?.kind === "cleanup-complete" ? "complete" : "failed",
    },
    evidenceRefs: events.map((event) => `events.jsonl#${event.sequence}`),
    limitations: manifest.mode === "live" ? [
      "An authorized operator drove one existing Chrome session; this is not autonomous browser execution.",
      "The run covers one fictional c0001 workflow and does not establish load, persona, accessibility or production behavior.",
      "The operator observation and read-only oracle are separately attributed by the broker and evidence receipts.",
    ] : [
      "Deterministic fixture only; no hosted application, browser session or backend was exercised.",
      "Fixture results cannot establish a product defect, usability outcome or production behavior.",
    ],
  };
}

export async function writeReport(directory: string, manifest: StormManifest, events: StormEvent[], outcome: RunOutcome) {
  const report = factualReport(manifest, events, outcome);
  const reportStem = `report-epoch-${manifest.lease.epoch}`;
  await exclusiveWrite(join(directory, `${reportStem}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    `# UAT storm: ${manifest.runId}`,
    "",
    `Evidence class: **${report.evidenceClass}**`,
    `Outcome: **${outcome.classification}** (${outcome.code})`,
    `Actions: ${report.facts.actionIntents}/${manifest.limits.maxActions}`,
    `Effect observations: ${report.facts.effectObservations}; unique effect digests: ${report.facts.uniqueEffectCount}`,
    `Uncertain writes observed: ${report.facts.uncertainWrites}`,
    `Cleanup: ${report.facts.cleanup}`,
    "",
    "## Limits",
    "",
    ...report.limitations.map((limit) => `- ${limit}`),
    "",
    "Raw structured evidence remains in `events.jsonl`; this report does not contain browser credentials, cookies or provider bodies.",
    "",
  ].join("\n");
  await exclusiveWrite(join(directory, `${reportStem}.md`), markdown);
  return report;
}
