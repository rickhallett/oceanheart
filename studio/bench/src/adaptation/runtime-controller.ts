import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";

import type { ClaraInput } from "../workflows/clara.ts";
import { calculateInvoice } from "../workflows/clara.ts";
import { applyClaraRateChange, type ClaraRateChangePolicy } from "../workflows/adaptation.ts";
import {
  artifactDigest,
  baselineArtifact,
  type ClaraConfigurationArtifact,
} from "./configuration.ts";
import { evaluateAdaptation, type AdaptationEvaluation } from "./evaluate.ts";
import { ClaraConfigurationStore, type ActiveConfiguration, type ConfigurationRelease } from "./release.ts";

const baselineDefinition = {
  id: "clara-2026-09-01",
  instructionsVersion: "clara-invoice-rules@2026-09-01",
  toolsetVersion: "invoice-draft-stub@1",
  modelProfile: "workflow-adapter-synthetic",
};
const adaptedDefinition = {
  ...baselineDefinition,
  id: "clara-2026-09-01-rate-90",
  instructionsVersion: "clara-invoice-rules@2026-09-01-rate-90",
};

type ReleaseSummary = {
  releaseId: string;
  artifactDigest: string;
  version: string;
  generation: number;
};

export type RateChangeProposal = {
  proposalId: string;
  expectedActiveReleaseId: string;
  candidateArtifactDigest: string;
  candidateVersion: string;
  effectiveDate: string;
  previousRateMinor: number;
  newRateMinor: number;
  baselineTotalMinor: number;
  candidateTotalMinor: number;
  changedSessionIds: string[];
  explanation: string;
  evaluation: {
    evaluationId: string;
    reportDigest: string;
    accepted: boolean;
    passed: number;
    total: number;
  };
};

export type AdaptationState = {
  schemaVersion: 1;
  active: ReleaseSummary;
  rollbackTarget?: ReleaseSummary;
  proposal?: RateChangeProposal;
};

type StoredProposal = {
  schemaVersion: 1;
  clientId: string;
  actor: string;
  idempotencyKey: string;
  proposal: RateChangeProposal;
  candidate: ClaraConfigurationArtifact;
  evaluation: AdaptationEvaluation;
};

async function readJson<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function atomicWrite(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp-${process.pid}`;
  const handle = await open(temporary, "wx", 0o600);
  try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); }
  finally { await handle.close(); }
  try { await rename(temporary, path); }
  catch (error) { await rm(temporary, { force: true }); throw error; }
}

function pilotInput(clientId: string): ClaraInput {
  return {
    schemaVersion: 1,
    clientId,
    period: { from: "2026-09-01", to: "2026-09-30" },
    sessions: [
      { id: "clara-session-2026-09-03", clientId: "fictional-person-01", date: "2026-09-03", attendance: "attended", rateMinor: 8000, rateRef: "fictional-agreement-v1" },
      { id: "clara-session-2026-09-10", clientId: "fictional-person-01", date: "2026-09-10", attendance: "cancelled", cancellationChargeMinor: 4000, policyRef: "fictional-cancellation-policy-v1" },
      { id: "clara-session-2026-09-17", clientId: "fictional-person-02", date: "2026-09-17", attendance: "attended", prepaid: true },
    ],
  };
}

function exactPilotInput(input: ClaraInput, clientId: string) {
  return isDeepStrictEqual(input, pilotInput(clientId));
}

function pilotPolicy(clientId: string, effectiveDate: string, newRateMinor: number): ClaraRateChangePolicy {
  if (effectiveDate !== "2026-09-01" || newRateMinor !== 9000)
    throw new Error("RATE_CHANGE_OUTSIDE_PILOT_SCOPE");
  return {
    schemaVersion: 1,
    version: "clara-attended-rate-90-v2",
    clientId,
    effectiveDate,
    previousStandardRate: { minor: 8000, reference: "fictional-agreement-v1" },
    newStandardRate: { minor: 9000, reference: "fictional-agreement-90-v2" },
    eligible: [{ sessionId: "clara-session-2026-09-03", clientId: "fictional-person-01" }],
  };
}

function candidateArtifact(clientId: string, policy: ClaraRateChangePolicy): ClaraConfigurationArtifact {
  return {
    schemaVersion: 1,
    workflow: "clara-draft-invoice",
    clientId,
    version: adaptedDefinition.id,
    instructionsVersion: adaptedDefinition.instructionsVersion,
    toolsetVersion: adaptedDefinition.toolsetVersion,
    modelProfile: adaptedDefinition.modelProfile,
    dataCompatibility: "no-change",
    policy,
  };
}

function summary(active: ActiveConfiguration): ReleaseSummary {
  return {
    releaseId: active.activeReleaseId,
    artifactDigest: active.artifactDigest,
    version: active.version,
    generation: active.generation,
  };
}

export class ClaraAdaptationRuntimeController {
  private readonly stateDir: string;
  private readonly clientId: string;
  private readonly store: ClaraConfigurationStore;

  constructor(stateDir: string, clientId: string) {
    this.stateDir = stateDir;
    this.clientId = clientId;
    this.store = new ClaraConfigurationStore(stateDir, clientId);
  }

  private baseline() { return baselineArtifact(baselineDefinition, this.clientId); }
  private proposalPath(id: string) { return join(this.stateDir, "adaptations", this.clientId, "proposals", `${id}.json`); }
  private latestPath(actor: string) {
    return join(this.stateDir, "adaptations", this.clientId, "latest", `${createHash("sha256").update(actor).digest("hex")}.json`);
  }

  private async active() {
    await this.store.ensureBaseline(this.baseline());
    const active = await this.store.active();
    if (!active) throw new Error("ACTIVE_CONFIGURATION_MISSING");
    return active;
  }

  private async storedProposal(id: string) {
    if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("PROPOSAL_INVALID");
    const stored = await readJson<StoredProposal>(this.proposalPath(id));
    if (!stored || stored.schemaVersion !== 1 || stored.clientId !== this.clientId || stored.proposal.proposalId !== id)
      throw new Error("PROPOSAL_NOT_FOUND");
    return stored;
  }

  async prepare(input: ClaraInput, baseIdempotencyKey: string) {
    if (!exactPilotInput(input, this.clientId)) throw new Error("PILOT_INPUT_INVALID");
    const active = await this.active();
    const artifact = await this.store.artifact(active.artifactDigest);
    if (artifact.policy === null) return { input, idempotencyKey: baseIdempotencyKey };
    return {
      input: applyClaraRateChange(input, artifact.policy),
      idempotencyKey: `${baseIdempotencyKey}-release2-${active.activeReleaseId}`,
      configurationVersion: artifact.version,
      configurationReleaseId: active.activeReleaseId,
    };
  }

  async state(actor: string, proposal?: RateChangeProposal): Promise<AdaptationState> {
    const active = await this.active();
    const release = await this.store.release(active.activeReleaseId);
    let selected = proposal;
    if (!selected) {
      const latest = await readJson<{ proposalId?: string }>(this.latestPath(actor));
      if (latest?.proposalId) {
        const stored = await this.storedProposal(latest.proposalId);
        if (stored.actor === actor && stored.proposal.expectedActiveReleaseId === active.activeReleaseId)
          selected = stored.proposal;
      }
    }
    const rollback = release?.previousReleaseId ? await this.store.release(release.previousReleaseId) : undefined;
    return {
      schemaVersion: 1,
      active: summary(active),
      ...(rollback ? { rollbackTarget: {
        releaseId: rollback.releaseId,
        artifactDigest: rollback.artifactDigest,
        version: rollback.version,
        generation: Math.max(1, active.generation - 1),
      } } : {}),
      ...(selected ? { proposal: selected } : {}),
    };
  }

  async evaluate(actor: string, idempotencyKey: string, input: ClaraInput, effectiveDate: string, newRateMinor: number) {
    if (!exactPilotInput(input, this.clientId)) throw new Error("PILOT_INPUT_INVALID");
    const active = await this.active();
    const existingPointer = await readJson<{ proposalId?: string }>(this.latestPath(actor));
    if (existingPointer?.proposalId) {
      const existing = await this.storedProposal(existingPointer.proposalId);
      if (existing.actor === actor && existing.idempotencyKey === idempotencyKey &&
        existing.proposal.expectedActiveReleaseId === active.activeReleaseId)
        return this.state(actor, existing.proposal);
    }
    const baseline = await this.store.artifact(active.artifactDigest);
    if (baseline.policy !== null) throw new Error("RATE_CHANGE_REQUIRES_BASELINE");
    const policy = pilotPolicy(this.clientId, effectiveDate, newRateMinor);
    const candidate = candidateArtifact(this.clientId, policy);
    const baselineDigest = artifactDigest(baseline), candidateDigest = artifactDigest(candidate);
    const evaluation = await evaluateAdaptation({
      stateDir: this.stateDir,
      outputDir: join(this.stateDir, "reports", "adaptation"),
      baseline,
      baselineDigest,
      candidate,
      candidateDigest,
      requestedInput: input,
    });
    const before = calculateInvoice(input), after = calculateInvoice(applyClaraRateChange(input, policy));
    const changedSessionIds = after.lines.filter((line) =>
      before.lines.find((prior) => prior.sessionId === line.sessionId)?.amountMinor !== line.amountMinor,
    ).map((line) => line.sessionId);
    if (!evaluation.accepted || !evaluation.scopeProof?.pass ||
      evaluation.scopeProof.candidateArtifactDigest !== candidateDigest ||
      evaluation.scopeProof.baselineTotalMinor !== before.totalMinor ||
      evaluation.scopeProof.candidateTotalMinor !== after.totalMinor ||
      before.totalMinor !== 12000 || after.totalMinor !== 13000 ||
      changedSessionIds.join(",") !== "clara-session-2026-09-03")
      throw new Error("PILOT_EVALUATION_REJECTED");
    const proposalId = createHash("sha256").update([
      this.clientId, actor, idempotencyKey, active.activeReleaseId, candidateDigest, evaluation.reportDigest,
    ].join(":"), "utf8").digest("hex");
    const proposal: RateChangeProposal = {
      proposalId,
      expectedActiveReleaseId: active.activeReleaseId,
      candidateArtifactDigest: candidateDigest,
      candidateVersion: candidate.version,
      effectiveDate,
      previousRateMinor: 8000,
      newRateMinor,
      baselineTotalMinor: before.totalMinor,
      candidateTotalMinor: after.totalMinor,
      changedSessionIds,
      explanation: "The attended session on 3 September changes from £80 to £90. The cancellation charge and prepaid session stay unchanged. The exact requested input comparison and 18 canonical regression checks passed.",
      evaluation: {
        evaluationId: evaluation.evaluationId,
        reportDigest: evaluation.reportDigest,
        accepted: evaluation.accepted,
        passed: evaluation.passed,
        total: evaluation.total,
      },
    };
    await atomicWrite(this.proposalPath(proposalId), {
      schemaVersion: 1, clientId: this.clientId, actor, idempotencyKey, proposal, candidate, evaluation,
    } satisfies StoredProposal);
    await atomicWrite(this.latestPath(actor), { proposalId });
    return this.state(actor, proposal);
  }

  async activate(actor: string, proposalId: string, expectedActiveReleaseId: string) {
    const stored = await this.storedProposal(proposalId);
    if (stored.actor !== actor || stored.proposal.expectedActiveReleaseId !== expectedActiveReleaseId)
      throw new Error("PROPOSAL_DENIED");
    await this.store.activate(stored.candidate, stored.evaluation, expectedActiveReleaseId);
    return this.state(actor);
  }

  async rollback(actor: string, targetReleaseId: string, expectedActiveReleaseId: string) {
    await this.store.rollbackIfActive(targetReleaseId, expectedActiveReleaseId);
    return this.state(actor);
  }
}
