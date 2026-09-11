import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { applicationReleaseId, verifyArtifact } from "./artifact.ts";
import { atomicWriteJson, readJson, withFileLock, writeImmutableJson } from "./files.ts";
import {
  compatible,
  inspectServedRelease,
  startApplication,
  startRouter,
  stopApplication,
  stopRouter,
} from "./runtime.ts";
import type {
  ApplicationArtifactManifest,
  ApplicationReleaseReceipt,
  ApplicationReleaseState,
  RunningApplication,
} from "./types.ts";

export type ApplicationRuntime = {
  startApplication: typeof startApplication;
  startRouter: typeof startRouter;
  stopApplication: typeof stopApplication;
  stopRouter: typeof stopRouter;
  inspectServedRelease: typeof inspectServedRelease;
};

const defaultRuntime: ApplicationRuntime = {
  startApplication, startRouter, stopApplication, stopRouter, inspectServedRelease,
};

function validState(state: ApplicationReleaseState, clientId: string) {
  if (
    state.schemaVersion !== 1 || state.clientId !== clientId ||
    !Number.isSafeInteger(state.generation) || state.generation < 0
  ) throw new Error("APPLICATION_RELEASE_STATE_INVALID");
  return state;
}

function failureMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : "UNKNOWN_RELEASE_FAILURE";
}

export class LocalApplicationReleaseController {
  readonly stateRoot: string;
  readonly clientId: string;
  private readonly runtime: ApplicationRuntime;
  private readonly now: () => string;

  constructor(input: {
    stateRoot: string;
    clientId: string;
    runtime?: ApplicationRuntime;
    now?: () => string;
  }) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(input.clientId)) throw new Error("INVALID_CLIENT_ID");
    this.stateRoot = resolve(input.stateRoot);
    this.clientId = input.clientId;
    this.runtime = input.runtime ?? defaultRuntime;
    this.now = input.now ?? (() => new Date().toISOString());
  }

  private statePath() { return join(this.stateRoot, "active.json"); }
  private lockPath() { return join(this.stateRoot, "release.lock"); }
  private receiptPath(receipt: ApplicationReleaseReceipt) {
    const id = createHash("sha256").update(JSON.stringify(receipt)).digest("hex");
    return join(this.stateRoot, "receipts", `${receipt.recordedAt.replaceAll(":", "-")}-${id.slice(0, 12)}.json`);
  }

  async state() {
    const state = await readJson<ApplicationReleaseState>(this.statePath());
    return state ? validState(state, this.clientId) : undefined;
  }

  private async ensureState(routerPort: number) {
    await mkdir(this.stateRoot, { recursive: true, mode: 0o700 });
    let state = await this.state();
    if (!state) {
      state = { schemaVersion: 1, clientId: this.clientId, generation: 0, router: null, active: null, previous: null, updatedAt: this.now() };
      await atomicWriteJson(this.statePath(), state);
    }
    if (state.router && state.router.port !== routerPort) throw new Error("ROUTER_PORT_CONFLICT");
    if (!state.router) {
      const router = await this.runtime.startRouter({ statePath: this.statePath(), stateRoot: this.stateRoot, clientId: this.clientId, port: routerPort, now: this.now });
      state = { ...state, router, updatedAt: this.now() };
      await atomicWriteJson(this.statePath(), state);
    }
    return state;
  }

  private assertPorts(state: ApplicationReleaseState, publicPort: number, applicationPort: number) {
    if (state.router?.port === publicPort || state.router?.port === applicationPort || publicPort === applicationPort)
      throw new Error("RELEASE_PORT_CONFLICT");
    if (state.active && (state.active.publicPort === publicPort || state.active.applicationPort === applicationPort || state.active.publicPort === applicationPort || state.active.applicationPort === publicPort))
      throw new Error("RELEASE_PORT_CONFLICT");
  }

  private receipt(input: {
    operation: ApplicationReleaseReceipt["operation"];
    state: ApplicationReleaseState;
    manifest: ApplicationArtifactManifest;
    releaseId: string;
    status: "ready" | "failed";
    served: ApplicationReleaseReceipt["served"];
    failure?: string;
  }): ApplicationReleaseReceipt {
    return {
      schemaVersion: 1,
      operation: input.operation,
      clientId: this.clientId,
      generation: input.state.generation,
      requestedReleaseId: input.releaseId,
      activeReleaseId: input.state.active?.releaseId ?? null,
      previousReleaseId: input.state.previous?.releaseId ?? null,
      sourceSha: input.manifest.sourceSha,
      artifactDigest: input.manifest.artifactDigest,
      version: input.manifest.version,
      compatibility: input.manifest.compatibility,
      status: input.status,
      activeProcess: input.state.active && input.state.router ? {
        pid: input.state.active.pid,
        routerPort: input.state.router.port,
        releasePort: input.state.active.publicPort,
        applicationPort: input.state.active.applicationPort,
      } : null,
      served: input.served,
      recordedAt: this.now(),
      ...(input.failure ? { failure: input.failure } : {}),
    };
  }

  private async record(receipt: ApplicationReleaseReceipt) {
    const path = this.receiptPath(receipt);
    await writeImmutableJson(path, receipt);
    return { receipt, receiptPath: path };
  }

  async activate(input: {
    manifestPath: string;
    routerPort: number;
    publicPort: number;
    applicationPort: number;
    timeoutMs?: number;
  }) {
    return withFileLock(this.lockPath(), async () => {
      const { manifest } = await verifyArtifact(input.manifestPath);
      if (manifest.clientId !== this.clientId) throw new Error("CROSS_CLIENT_APPLICATION_ARTIFACT");
      const releaseId = applicationReleaseId(manifest);
      let state = await this.ensureState(input.routerPort);
      this.assertPorts(state, input.publicPort, input.applicationPort);
      if (state.active && !compatible(await this.manifest(state.active), manifest)) throw new Error("APPLICATION_RELEASE_NOT_DATA_COMPATIBLE");
      let candidate: RunningApplication | undefined;
      try {
        candidate = await this.runtime.startApplication({
          manifestPath: input.manifestPath,
          publicPort: input.publicPort, applicationPort: input.applicationPort,
          stateRoot: this.stateRoot, releaseId, timeoutMs: input.timeoutMs, now: this.now,
        });
        const priorState = state;
        state = {
          ...state,
          generation: state.generation + 1,
          active: candidate,
          previous: state.active,
          updatedAt: this.now(),
        };
        await atomicWriteJson(this.statePath(), state);
        const served = await this.runtime.inspectServedRelease(state.router!.port);
        if (
          served.releaseId !== releaseId || served.sourceSha !== manifest.sourceSha ||
          served.artifactDigest !== manifest.artifactDigest || served.dataTarget !== manifest.compatibility.dataTarget
        ) {
          await atomicWriteJson(this.statePath(), priorState);
          throw new Error("ACTIVE_ROUTER_RELEASE_MISMATCH");
        }
        if (priorState.active) await this.runtime.stopApplication(priorState.active);
        return this.record(this.receipt({ operation: "activate", state, manifest, releaseId, status: "ready", served: {
          url: `http://127.0.0.1:${state.router!.port}`,
          sourceSha: String(served.sourceSha), artifactDigest: String(served.artifactDigest), dataTarget: String(served.dataTarget),
        } }));
      } catch (error) {
        if (candidate) await this.runtime.stopApplication(candidate);
        const unchanged = (await this.state()) ?? state;
        return this.record(this.receipt({ operation: "failed-activation", state: unchanged, manifest, releaseId, status: "failed", served: null, failure: failureMessage(error) }));
      }
    });
  }

  async rollback(input: {
    targetReleaseId: string;
    routerPort: number;
    publicPort: number;
    applicationPort: number;
    timeoutMs?: number;
  }) {
    return withFileLock(this.lockPath(), async () => {
      let state = await this.ensureState(input.routerPort);
      if (!state.active || !state.previous || state.previous.releaseId !== input.targetReleaseId)
        throw new Error("ROLLBACK_REQUIRES_EXACT_PRIOR_RELEASE");
      this.assertPorts(state, input.publicPort, input.applicationPort);
      const { manifest } = await verifyArtifact(state.previous.manifestPath);
      const currentManifest = await this.manifest(state.active);
      if (!compatible(currentManifest, manifest)) throw new Error("ROLLBACK_TARGET_NOT_DATA_COMPATIBLE");
      const candidate = await this.runtime.startApplication({
        manifestPath: state.previous.manifestPath,
        publicPort: input.publicPort, applicationPort: input.applicationPort,
        stateRoot: this.stateRoot, releaseId: input.targetReleaseId, timeoutMs: input.timeoutMs, now: this.now,
      });
      const priorState = state;
      state = { ...state, generation: state.generation + 1, active: candidate, previous: state.active, updatedAt: this.now() };
      try {
        await atomicWriteJson(this.statePath(), state);
        const served = await this.runtime.inspectServedRelease(state.router!.port);
        if (served.releaseId !== input.targetReleaseId || served.artifactDigest !== manifest.artifactDigest || served.dataTarget !== manifest.compatibility.dataTarget) {
          await atomicWriteJson(this.statePath(), priorState);
          throw new Error("ROLLBACK_ROUTER_RELEASE_MISMATCH");
        }
        await this.runtime.stopApplication(priorState.active!);
        return this.record(this.receipt({ operation: "rollback", state, manifest, releaseId: input.targetReleaseId, status: "ready", served: {
          url: `http://127.0.0.1:${state.router!.port}`,
          sourceSha: String(served.sourceSha), artifactDigest: String(served.artifactDigest), dataTarget: String(served.dataTarget),
        } }));
      } catch (error) {
        await this.runtime.stopApplication(candidate);
        throw error;
      }
    });
  }

  private async manifest(application: RunningApplication) {
    return (await verifyArtifact(application.manifestPath)).manifest;
  }

  async stop() {
    return withFileLock(this.lockPath(), async () => {
      const state = await this.state();
      if (!state) return { applications: 0, router: false };
      let applications = 0;
      if (state.active && await this.runtime.stopApplication(state.active)) applications += 1;
      if (state.previous && state.previous.pid !== state.active?.pid && await this.runtime.stopApplication(state.previous)) applications += 1;
      const router = state.router ? await this.runtime.stopRouter(state.router) : false;
      await atomicWriteJson(this.statePath(), { ...state, router: null, active: null, previous: null, updatedAt: this.now() });
      return { applications, router };
    });
  }
}
