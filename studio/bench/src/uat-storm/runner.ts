import { digest } from "./manifest.ts";
import type { EventFacts, StormEvent } from "./journal.ts";
import { StormJournal } from "./journal.ts";
import type {
  AdapterInspection,
  ClaraObservation,
  OracleObservation,
  RunOutcome,
  StormAction,
  StormAdapter,
  StormManifest,
  StormStep,
} from "./types.ts";

const actions: StormAction[] = [
  { schemaVersion: 1, actionId: "status-before", step: "status", operation: "read", command: "clara-status" },
  { schemaVersion: 1, actionId: "prepare-draft", step: "prepare", operation: "write", command: "clara-prepare", effectKey: "clara-c0001-september-invoice" },
  { schemaVersion: 1, actionId: "inspect-after-prepare", step: "inspect", operation: "read", command: "clara-inspect" },
  { schemaVersion: 1, actionId: "retry-draft", step: "retry", operation: "write", command: "clara-retry", effectKey: "clara-c0001-september-invoice" },
  { schemaVersion: 1, actionId: "inspect-after-retry", step: "final-inspect", operation: "read", command: "clara-inspect" },
];

type Bindings = {
  manifestDigest: string;
  runBindingDigest: string;
  targetBindingDigest: string;
  identityBindingDigest: string;
};

class Stop extends Error {
  readonly outcome: RunOutcome;
  constructor(outcome: RunOutcome) { super(outcome.code); this.outcome = outcome; }
}

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("OPERATION_TIMEOUT")); }, milliseconds);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

function observationFacts(observation: ClaraObservation): Partial<EventFacts> {
  return {
    resultDigest: digest(observation),
    totalMinor: observation.totalMinor ?? undefined,
    traceEvents: observation.traceEvents ?? undefined,
    configurationVersion: observation.configurationVersion,
    configurationGeneration: observation.configurationGeneration,
  };
}

function validateBaselineObservation(observation: ClaraObservation | undefined) {
  if (!observation || observation.configurationVersion !== "clara-2026-09-01" ||
    observation.draftId === null || observation.totalMinor !== 12000 || observation.traceEvents !== 22)
    throw new Error("CLARA_BASELINE_MISMATCH");
}

function terminal(events: StormEvent[], actionId: string) {
  return events.findLast((event) => event.actionId === actionId && [
    "read-complete", "effect-present", "effect-absent", "effect-unknown", "invariant-failed",
  ].includes(event.kind));
}

export class ClaraStormRunner {
  private readonly manifest: StormManifest;
  private readonly bindings: Bindings;
  private readonly journal: StormJournal;
  private readonly adapter: StormAdapter;
  private readonly started = Date.now();
  private readonly deadlineAt: number;
  private baselineEffectDigest: string | null = null;
  private completedSteps: StormStep[] = [];

  constructor(manifest: StormManifest, bindings: Bindings, journal: StormJournal, adapter: StormAdapter) {
    this.manifest = manifest;
    this.bindings = bindings;
    this.journal = journal;
    this.adapter = adapter;
    this.deadlineAt = this.firstDeadline() ?? this.started + manifest.limits.maxSeconds * 1000;
  }

  private firstDeadline() {
    const value = this.journal.events.find((event) => event.kind === "bound")?.deadlineAt;
    const parsed = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private async append(facts: EventFacts) { return this.journal.append(facts); }

  private async inspectAdapter(signal?: AbortSignal): Promise<AdapterInspection> {
    const seen = await this.adapter.inspect(signal);
    const liveOperator = this.manifest.mode === "live" && seen.executionMode === "hosted-operator-driven" &&
      seen.operatorSession === true && seen.operatorControl === true;
    const fixture = this.manifest.mode === "fixture" && seen.executionMode === "fixture" &&
      seen.operatorSession === false && seen.operatorControl === false;
    if (seen.mode !== this.manifest.mode || (!liveOperator && !fixture) || seen.fictionalDataOnly !== true ||
      seen.targetBindingDigest !== this.bindings.targetBindingDigest ||
      seen.identityBindingDigest !== this.bindings.identityBindingDigest ||
      seen.oracleBindingDigest !== this.manifest.oracle.bindingDigest ||
      seen.leaseId !== this.manifest.lease.leaseId || seen.epoch !== this.manifest.lease.epoch ||
      seen.operatorSessionBindingDigest !== this.manifest.lease.operatorSessionBindingDigest ||
      seen.expiresAt !== this.manifest.lease.expiresAt || Date.parse(seen.expiresAt) <= Date.now())
      throw new Error("ADAPTER_BINDING_MISMATCH");
    return seen;
  }

  private async guard(reinspect: boolean, signal?: AbortSignal) {
    if (Date.now() >= this.deadlineAt) throw new Error("RUN_DEADLINE_EXCEEDED");
    if (this.journal.events.filter((event) => event.kind === "action-intent").length > this.manifest.limits.maxActions)
      throw new Error("ACTION_BUDGET_EXCEEDED");
    if (reinspect) await this.inspectAdapter(signal);
  }

  private stop(classification: RunOutcome["classification"], code: string): never {
    throw new Stop({ classification, code, completedSteps: [...this.completedSteps], effectDigest: this.baselineEffectDigest as `sha256:${string}` | null });
  }

  private async reconcile(action: StormAction, signal?: AbortSignal) {
    const observed = await this.adapter.oracle(action.effectKey!, signal);
    const facts: EventFacts = {
      epoch: this.manifest.lease.epoch,
      kind: observed.status === "present" && observed.count === 1 ? "effect-present"
        : observed.status === "present" && observed.count !== 1 ? "invariant-failed"
          : observed.status === "absent" ? "effect-absent" : "effect-unknown",
      step: action.step,
      actionId: action.actionId,
      operation: action.operation,
      effectCount: observed.count ?? undefined,
      effectDigest: observed.effectDigest ?? undefined,
      receiptDigest: observed.receiptDigest ?? undefined,
      ...(observed.observation ? observationFacts(observed.observation) : {}),
    };
    await this.append(facts);
    if (observed.status === "present" && observed.count !== 1) this.stop("invariant_failed", "DUPLICATE_EFFECT");
    if (observed.status === "absent") this.stop("effect_uncertain", "EFFECT_AUTHORITATIVELY_ABSENT");
    if (observed.status !== "present" || !observed.effectDigest || !observed.observation)
      this.stop("effect_uncertain", "EFFECT_UNRESOLVED");
    try { validateBaselineObservation(observed.observation); }
    catch { this.stop("invariant_failed", "CLARA_BASELINE_MISMATCH"); }
    if (this.baselineEffectDigest && observed.effectDigest !== this.baselineEffectDigest)
      this.stop("invariant_failed", "RETRY_EFFECT_CHANGED");
    this.baselineEffectDigest = observed.effectDigest;
    return observed;
  }

  private async execute(action: StormAction) {
    const priorTerminal = terminal(this.journal.events, action.actionId);
    if (priorTerminal?.kind === "effect-present" || priorTerminal?.kind === "read-complete") {
      if (priorTerminal.effectDigest) this.baselineEffectDigest = priorTerminal.effectDigest;
      this.completedSteps.push(action.step);
      return;
    }
    if (priorTerminal) this.stop(priorTerminal.kind === "invariant-failed" ? "invariant_failed" : "effect_uncertain", "PRIOR_STEP_NOT_RECOVERABLE");
    // The initial binding probe covers reads. Re-probe immediately before each
    // write; the single broker and exclusive lease bind the intervening reads.
    await this.guard(action.operation === "write");
    const priorIntent = this.journal.events.find((event) => event.kind === "action-intent" && event.actionId === action.actionId);
    if (!priorIntent) {
      if (this.journal.events.filter((event) => event.kind === "action-intent").length >= this.manifest.limits.maxActions)
        this.stop("policy_blocked", "ACTION_BUDGET_EXCEEDED");
      await this.append({
        epoch: this.manifest.lease.epoch,
        kind: "action-intent",
        step: action.step,
        actionId: action.actionId,
        operation: action.operation,
      });
    }
    if (priorIntent && action.operation === "write") {
      await this.reconcile(action);
      this.completedSteps.push(action.step);
      return;
    }
    let acknowledgement;
    try {
      acknowledgement = await bounded(
        (signal) => this.adapter.perform(action, signal),
        Math.max(1, this.deadlineAt - Date.now()),
      );
    }
    catch {
      if (action.operation === "write") {
        await this.append({ epoch: this.manifest.lease.epoch, kind: "write-uncertain", step: action.step,
          actionId: action.actionId, operation: action.operation, code: "ADAPTER_RESPONSE_UNCERTAIN" });
        try { await this.reconcile(action); }
        catch (error) { if (error instanceof Stop) throw error; this.stop("effect_uncertain", "ORACLE_FAILED"); }
        this.completedSteps.push(action.step);
        return;
      }
      this.stop("harness_failure", "READ_ADAPTER_FAILED");
    }
    await this.append({ epoch: this.manifest.lease.epoch, kind: "action-acknowledged", step: action.step,
      actionId: action.actionId, operation: action.operation,
      ...(acknowledgement.observation ? observationFacts(acknowledgement.observation) : {}) });
    if (action.operation === "write") {
      // The write has crossed the boundary. Reconcile it even if the next
      // ownership probe would fail; never misclassify a possible effect as a
      // pre-dispatch policy stop.
      await this.reconcile(action);
    } else {
      try { validateBaselineObservation(acknowledgement.observation); }
      catch { this.stop("invariant_failed", "CLARA_BASELINE_MISMATCH"); }
      await this.append({ epoch: this.manifest.lease.epoch, kind: "read-complete", step: action.step,
        actionId: action.actionId, operation: action.operation, ...observationFacts(acknowledgement.observation!) });
    }
    this.completedSteps.push(action.step);
  }

  async run(): Promise<RunOutcome> {
    await this.journal.claim();
    let outcome: RunOutcome;
    try {
      const priorBindings = this.journal.events.filter((event) => event.kind === "bound");
      if (priorBindings.some((event) => event.runBindingDigest !== this.bindings.runBindingDigest))
        this.stop("policy_blocked", "RESUME_BINDING_MISMATCH");
      const priorEpoch = Math.max(0, ...priorBindings.map((event) => event.epoch));
      if (priorBindings.length > 0 && this.manifest.lease.epoch <= priorEpoch)
        this.stop("policy_blocked", "RESUME_EPOCH_STALE");
      await this.inspectAdapter();
      await this.append({
        epoch: this.manifest.lease.epoch,
        kind: "bound",
        manifestDigest: this.bindings.manifestDigest,
        runBindingDigest: this.bindings.runBindingDigest,
        targetBindingDigest: this.bindings.targetBindingDigest,
        identityBindingDigest: this.bindings.identityBindingDigest,
        deadlineAt: new Date(this.deadlineAt).toISOString(),
      });
      for (const action of actions) await this.execute(action);
      outcome = { classification: "complete", code: "CLARA_PILOT_COMPLETE",
        completedSteps: [...this.completedSteps], effectDigest: this.baselineEffectDigest as `sha256:${string}` };
      await this.append({ epoch: this.manifest.lease.epoch, kind: "run-complete", code: outcome.code });
    } catch (error) {
      outcome = error instanceof Stop ? error.outcome : {
        classification: "policy_blocked", code: "RUN_GUARD_FAILED",
        completedSteps: [...this.completedSteps], effectDigest: this.baselineEffectDigest as `sha256:${string}` | null,
      };
      await this.append({ epoch: this.manifest.lease.epoch, kind: "run-stopped", code: outcome.code });
    } finally {
      try {
        await bounded((signal) => this.adapter.cleanup(signal), 5_000);
        await this.append({ epoch: this.manifest.lease.epoch, kind: "cleanup-complete" });
      } catch { await this.append({ epoch: this.manifest.lease.epoch, kind: "cleanup-failed" }); }
      await this.journal.close();
    }
    return outcome;
  }
}

export function fixtureBindings(manifest: StormManifest): Bindings {
  return {
    manifestDigest: digest(manifest),
    runBindingDigest: digest({ runId: manifest.runId, fixture: true }),
    targetBindingDigest: digest({ clientId: "c0001", target: "fixture" }),
    identityBindingDigest: digest({ actorId: "fixture-operator", clientId: "c0001" }),
  };
}
