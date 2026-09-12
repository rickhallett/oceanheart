import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { digest } from "./manifest.ts";
import type { ClaraObservation, OracleObservation } from "./types.ts";

const sha256 = /^sha256:[0-9a-f]{64}$/;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const rawDigest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

export async function inspectClaraBaselineEffect(input: {
  stateRoot: string;
  clientId: "c0001";
  runtimeActorDigest: `sha256:${string}`;
}): Promise<OracleObservation> {
  if (!sha256.test(input.runtimeActorDigest)) throw new Error("ORACLE_ACTOR_INVALID");
  const active = JSON.parse(await readFile(join(input.stateRoot, "configurations", input.clientId, "active.json"), "utf8")) as unknown;
  if (!record(active) || active.version !== "clara-2026-09-01" ||
    !Number.isSafeInteger(active.generation) || Number(active.generation) < 1)
    throw new Error("ORACLE_CONFIGURATION_MISMATCH");
  const database = new DatabaseSync(join(input.stateRoot, "jobs.sqlite"), { readOnly: true });
  try {
    const jobs = database.prepare("select id,json from jobs order by rowid limit 1001").all() as Array<{ id: string; json: string }>;
    const effects = database.prepare("select job,json from effects order by rowid limit 1001").all() as Array<{ job: string; json: string }>;
    if (jobs.length > 1000 || effects.length > 1000) throw new Error("ORACLE_SCAN_LIMIT");
    const effectByJob = new Map(effects.map((row) => [row.job, row.json]));
    const matches: Array<{ jobId: string; effect: Record<string, unknown> }> = [];
    for (const row of jobs) {
      let job: unknown;
      try { job = JSON.parse(row.json); } catch { throw new Error("ORACLE_STATE_INVALID"); }
      if (!record(job) || job.clientId !== input.clientId || job.status !== "succeeded" ||
        typeof job.actor !== "string" || rawDigest(job.actor) !== input.runtimeActorDigest || !record(job.result) ||
        job.result.totalMinor !== 12000 || typeof job.result.draftId !== "string") continue;
      const encodedEffect = effectByJob.get(row.id);
      if (!encodedEffect) throw new Error("ORACLE_STATE_INVALID");
      let effect: unknown;
      try { effect = JSON.parse(encodedEffect); } catch { throw new Error("ORACLE_STATE_INVALID"); }
      if (!record(effect) || effect.clientId !== input.clientId || effect.draftId !== job.result.draftId || effect.totalMinor !== 12000)
        throw new Error("ORACLE_STATE_INVALID");
      matches.push({ jobId: row.id, effect });
    }
    if (matches.length === 0) return { status: "absent", count: 0, effectDigest: null, receiptDigest: null };
    const effectDigest = digest(matches.map((match) => match.effect));
    const receiptDigest = digest(matches.map((match) => ({ jobId: match.jobId, draftId: match.effect.draftId, totalMinor: match.effect.totalMinor })));
    if (matches.length !== 1) return { status: "present", count: matches.length, effectDigest, receiptDigest };
    const match = matches[0]!;
    const lines = Array.isArray(match.effect.lines) ? match.effect.lines : [];
    const amounts = lines.map((line) => record(line) ? line.amountMinor : undefined);
    const prepaid = Array.isArray(match.effect.prepaidSessionIds) ? match.effect.prepaidSessionIds : [];
    const traceEvents = Number((database.prepare("select count(*) as count from traces where job = ?").get(match.jobId) as { count: number }).count);
    if (amounts.length !== 2 || amounts[0] !== 8000 || amounts[1] !== 4000 ||
      prepaid.length !== 1 || prepaid[0] !== "clara-session-2026-09-17" || traceEvents !== 22)
      throw new Error("ORACLE_BASELINE_INVARIANT_FAILED");
    const observation: ClaraObservation = {
      configurationVersion: String(active.version),
      configurationGeneration: Number(active.generation),
      draftId: String(match.effect.draftId),
      totalMinor: 12000,
      traceEvents,
    };
    return { status: "present", count: 1, effectDigest, receiptDigest, observation };
  } finally { database.close(); }
}
