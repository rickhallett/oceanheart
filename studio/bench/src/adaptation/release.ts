import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import { artifactDigest, type ClaraConfigurationArtifact } from "./configuration.ts";
import type { AdaptationEvaluation } from "./evaluate.ts";

export type ConfigurationRelease = {
  schemaVersion: 1;
  releaseId: string;
  clientId: string;
  workflow: "clara-draft-invoice";
  version: string;
  artifactDigest: string;
  previousReleaseId: string | null;
  dataCompatibility: "no-change";
  evaluation: {
    evaluationId: string;
    reportDigest: string;
    jsonPath: string;
    htmlPath: string;
  } | null;
  acceptedAt: string;
};

export type ActiveConfiguration = {
  schemaVersion: 1;
  clientId: string;
  workflow: "clara-draft-invoice";
  activeReleaseId: string;
  artifactDigest: string;
  version: string;
  generation: number;
  activatedAt: string;
};

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function syncDirectory(path: string) {
  const handle = await open(path, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writeImmutable(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  try {
    const handle = await open(path, "wx", 0o600);
    try { await handle.writeFile(content, "utf8"); await handle.sync(); }
    finally { await handle.close(); }
    await syncDirectory(dirname(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (await readFile(path, "utf8") !== content) throw new Error("IMMUTABLE_RECORD_MISMATCH");
  }
}

async function atomicWrite(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally { await handle.close(); }
  try {
    await rename(temporary, path);
    await syncDirectory(dirname(path));
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export class ClaraConfigurationStore {
  readonly root: string;
  readonly clientId: string;

  constructor(stateDir: string, clientId: string) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(clientId)) throw new Error("INVALID_CLIENT_ID");
    this.root = join(stateDir, "configurations", clientId);
    this.clientId = clientId;
  }

  private artifactPath(digest: string) { return join(this.root, "artifacts", `${digest.slice(7)}.json`); }
  private releasePath(id: string) { return join(this.root, "releases", `${id}.json`); }
  private activePath() { return join(this.root, "active.json"); }
  private lockPath() { return join(this.root, "activation.lock"); }

  async active(): Promise<ActiveConfiguration | undefined> {
    const active = await readJson<ActiveConfiguration>(this.activePath());
    if (!active) return undefined;
    if (
      active.schemaVersion !== 1 || active.clientId !== this.clientId ||
      active.workflow !== "clara-draft-invoice" ||
      !/^[0-9a-f]{64}$/.test(active.activeReleaseId) ||
      !/^sha256:[0-9a-f]{64}$/.test(active.artifactDigest) ||
      !Number.isSafeInteger(active.generation) || active.generation < 1
    ) throw new Error("ACTIVE_CONFIGURATION_INVALID");
    const release = await this.release(active.activeReleaseId);
    if (!release || release.artifactDigest !== active.artifactDigest || release.version !== active.version) {
      throw new Error("ACTIVE_CONFIGURATION_RELEASE_MISMATCH");
    }
    return active;
  }

  async release(id: string): Promise<ConfigurationRelease | undefined> {
    if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("INVALID_RELEASE_ID");
    const release = await readJson<ConfigurationRelease>(this.releasePath(id));
    if (!release) return undefined;
    const expected = this.releaseId(
      release.artifactDigest,
      release.previousReleaseId,
      release.evaluation?.reportDigest ?? null,
    );
    if (
      release.schemaVersion !== 1 || release.releaseId !== id || expected !== id ||
      release.clientId !== this.clientId || release.workflow !== "clara-draft-invoice" ||
      release.dataCompatibility !== "no-change" ||
      !/^sha256:[0-9a-f]{64}$/.test(release.artifactDigest) ||
      (release.previousReleaseId !== null && !/^[0-9a-f]{64}$/.test(release.previousReleaseId)) ||
      (release.evaluation !== null && !/^sha256:[0-9a-f]{64}$/.test(release.evaluation.reportDigest))
    ) throw new Error("CONFIGURATION_RELEASE_INVALID");
    return release;
  }

  async artifact(digest: string): Promise<ClaraConfigurationArtifact> {
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new Error("INVALID_ARTIFACT_DIGEST");
    const artifact = await readJson<ClaraConfigurationArtifact>(this.artifactPath(digest));
    if (!artifact || artifact.clientId !== this.clientId || artifactDigest(artifact) !== digest) {
      throw new Error("CONFIGURATION_ARTIFACT_NOT_FOUND_OR_INVALID");
    }
    return artifact;
  }

  private async locked<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    let handle;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        handle = await open(this.lockPath(), "wx", 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        let stale = false;
        try {
          const lock = JSON.parse(await readFile(this.lockPath(), "utf8")) as { pid?: number };
          if (!Number.isSafeInteger(lock.pid) || (lock.pid ?? 0) <= 0) stale = (Date.now() - (await stat(this.lockPath())).mtimeMs) > 30_000;
          else {
            try { process.kill(lock.pid!, 0); }
            catch (probeError) { stale = (probeError as NodeJS.ErrnoException).code === "ESRCH"; }
          }
        } catch { stale = (Date.now() - (await stat(this.lockPath())).mtimeMs) > 30_000; }
        if (!stale) throw new Error("CONFIGURATION_ACTIVATION_BUSY");
        await rm(this.lockPath(), { force: true });
        continue;
      }
      try {
        await handle.writeFile(`${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`, "utf8");
        await handle.sync();
        break;
      } catch (error) {
        await handle.close();
        handle = undefined;
        await rm(this.lockPath(), { force: true });
        throw error;
      }
    }
    if (!handle) throw new Error("CONFIGURATION_ACTIVATION_BUSY");
    try { return await operation(); }
    finally {
      try { await handle.close(); }
      finally { await rm(this.lockPath(), { force: true }); }
    }
  }

  async ensureBaseline(artifact: ClaraConfigurationArtifact, now = () => new Date().toISOString()) {
    if (artifact.clientId !== this.clientId || artifact.policy !== null) throw new Error("INVALID_BASELINE_ARTIFACT");
    return this.locked(async () => {
      const current = await this.active();
      if (current) return current;
      const digest = artifactDigest(artifact);
      const proposed = this.releaseRecord(artifact, digest, null, null, now());
      const release = await this.release(proposed.releaseId) ?? proposed;
      await writeImmutable(this.artifactPath(digest), artifact);
      if (release === proposed) await writeImmutable(this.releasePath(release.releaseId), release);
      const active = this.pointer(release, 1, now());
      await atomicWrite(this.activePath(), active);
      return active;
    });
  }

  async activate(
    artifact: ClaraConfigurationArtifact,
    evaluation: AdaptationEvaluation,
    expectedActiveReleaseId: string,
    now = () => new Date().toISOString(),
  ) {
    if (
      artifact.clientId !== this.clientId ||
      !evaluation.accepted ||
      evaluation.clientId !== this.clientId ||
      evaluation.candidateArtifactDigest !== artifactDigest(artifact)
    ) throw new Error("CONFIGURATION_EVALUATION_NOT_ACCEPTED");
    const report = await readFile(evaluation.jsonPath);
    if (`sha256:${createHash("sha256").update(report).digest("hex")}` !== evaluation.reportDigest) {
      throw new Error("CONFIGURATION_EVALUATION_REPORT_MISMATCH");
    }
    let parsed: { configurations?: Array<{ id?: string }>; results?: Array<{ pass?: boolean }>; scopeProof?: AdaptationEvaluation["scopeProof"] };
    try { parsed = JSON.parse(report.toString("utf8")); }
    catch { throw new Error("CONFIGURATION_EVALUATION_REPORT_INVALID"); }
    const passes = parsed.results?.filter((result) => result.pass === true).length ?? -1;
    if (
      !(evaluation.scopeProof
        ? evaluation.scopeProof.candidateVersion === artifact.version &&
          evaluation.scopeProof.candidateArtifactDigest === evaluation.candidateArtifactDigest &&
          evaluation.scopeProof.pass === true &&
          JSON.stringify(parsed.scopeProof) === JSON.stringify(evaluation.scopeProof)
        : parsed.configurations?.some((configuration) => configuration.id === artifact.version)) ||
      parsed.results?.length !== evaluation.total ||
      passes !== evaluation.passed || passes !== evaluation.total
    ) throw new Error("CONFIGURATION_EVALUATION_REPORT_REJECTED");
    return this.locked(async () => {
      const current = await this.active();
      if (!current) throw new Error("STALE_ACTIVE_CONFIGURATION");
      if (current.artifactDigest === evaluation.candidateArtifactDigest) {
        const release = await this.release(current.activeReleaseId);
        if (release?.previousReleaseId !== expectedActiveReleaseId ||
          release.evaluation?.reportDigest !== evaluation.reportDigest)
          throw new Error("STALE_ACTIVE_CONFIGURATION");
        return { active: current, release, reused: true };
      }
      if (current.activeReleaseId !== expectedActiveReleaseId) throw new Error("STALE_ACTIVE_CONFIGURATION");
      if (current.artifactDigest !== evaluation.baselineArtifactDigest) throw new Error("EVALUATION_BASELINE_STALE");
      const currentArtifact = await this.artifact(current.artifactDigest);
      if (!parsed.configurations?.some((configuration) => configuration.id === currentArtifact.version)) {
        throw new Error("CONFIGURATION_EVALUATION_BASELINE_MISSING");
      }
      const proposed = this.releaseRecord(artifact, evaluation.candidateArtifactDigest, current.activeReleaseId, evaluation, now());
      const release = await this.release(proposed.releaseId) ?? proposed;
      await writeImmutable(this.artifactPath(release.artifactDigest), artifact);
      if (release === proposed) await writeImmutable(this.releasePath(release.releaseId), release);
      const active = this.pointer(release, current.generation + 1, now());
      await atomicWrite(this.activePath(), active);
      return { active, release, reused: false };
    });
  }

  async rollback(targetReleaseId: string, now = () => new Date().toISOString()) {
    return this.rollbackInternal(targetReleaseId, undefined, now);
  }

  async rollbackIfActive(
    targetReleaseId: string,
    expectedActiveReleaseId: string,
    now = () => new Date().toISOString(),
  ) {
    if (!/^[0-9a-f]{64}$/.test(expectedActiveReleaseId)) throw new Error("INVALID_RELEASE_ID");
    return this.rollbackInternal(targetReleaseId, expectedActiveReleaseId, now);
  }

  private async rollbackInternal(
    targetReleaseId: string,
    expectedActiveReleaseId: string | undefined,
    now: () => string,
  ) {
    return this.locked(async () => {
      const current = await this.active();
      const currentRelease = current && await this.release(current.activeReleaseId);
      const target = await this.release(targetReleaseId);
      if (current && target && expectedActiveReleaseId !== undefined && current.activeReleaseId === target.releaseId) {
        const expectedRelease = await this.release(expectedActiveReleaseId);
        if (expectedRelease?.previousReleaseId !== target.releaseId)
          throw new Error("ROLLBACK_TARGET_NOT_COMPATIBLE_PRIOR_RELEASE");
        const rollbackId = createHash("sha256")
          .update(`rollback:${this.clientId}:${expectedActiveReleaseId}:${target.releaseId}:${current.generation}`)
          .digest("hex");
        return { rollbackId, active: current, target, reused: true };
      }
      if (
        !current || !currentRelease || !target ||
        (expectedActiveReleaseId !== undefined && current.activeReleaseId !== expectedActiveReleaseId) ||
        current.clientId !== this.clientId || target.clientId !== this.clientId ||
        currentRelease.previousReleaseId !== target.releaseId ||
        target.workflow !== current.workflow || target.dataCompatibility !== "no-change"
      ) throw new Error("ROLLBACK_TARGET_NOT_COMPATIBLE_PRIOR_RELEASE");
      await this.artifact(target.artifactDigest);
      const active = this.pointer(target, current.generation + 1, now());
      const rollbackId = createHash("sha256")
        .update(`rollback:${this.clientId}:${current.activeReleaseId}:${target.releaseId}:${active.generation}`)
        .digest("hex");
      await writeImmutable(join(this.root, "rollbacks", `${rollbackId}.json`), {
        schemaVersion: 1,
        rollbackId,
        clientId: this.clientId,
        fromReleaseId: current.activeReleaseId,
        targetReleaseId: target.releaseId,
        artifactDigest: target.artifactDigest,
        dataCompatibility: target.dataCompatibility,
        rolledBackAt: active.activatedAt,
      });
      await atomicWrite(this.activePath(), active);
      return { rollbackId, active, target, reused: false };
    });
  }

  private releaseRecord(
    artifact: ClaraConfigurationArtifact,
    digest: string,
    previousReleaseId: string | null,
    evaluation: AdaptationEvaluation | null,
    acceptedAt: string,
  ): ConfigurationRelease {
    const releaseId = this.releaseId(digest, previousReleaseId, evaluation?.reportDigest ?? null);
    return {
      schemaVersion: 1,
      releaseId,
      clientId: this.clientId,
      workflow: "clara-draft-invoice",
      version: artifact.version,
      artifactDigest: digest,
      previousReleaseId,
      dataCompatibility: artifact.dataCompatibility,
      evaluation: evaluation ? {
        evaluationId: evaluation.evaluationId,
        reportDigest: evaluation.reportDigest,
        jsonPath: evaluation.jsonPath,
        htmlPath: evaluation.htmlPath,
      } : null,
      acceptedAt,
    };
  }

  private releaseId(digest: string, previousReleaseId: string | null, reportDigest: string | null) {
    return createHash("sha256")
      .update(`${this.clientId}:${digest}:${previousReleaseId ?? "initial"}:${reportDigest ?? "baseline"}`)
      .digest("hex");
  }

  private pointer(release: ConfigurationRelease, generation: number, activatedAt: string): ActiveConfiguration {
    return {
      schemaVersion: 1,
      clientId: this.clientId,
      workflow: "clara-draft-invoice",
      activeReleaseId: release.releaseId,
      artifactDigest: release.artifactDigest,
      version: release.version,
      generation,
      activatedAt,
    };
  }
}
