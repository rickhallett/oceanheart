import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyArtifact } from "./artifact.ts";
import { studioRuntimeEnvironment } from "./environment.ts";
import type { ApplicationArtifactManifest, RunningApplication } from "./types.ts";

const scriptsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../scripts/release");

export function assertPrivatePort(port: number) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("INVALID_PRIVATE_PORT");
}

function ownerToken() { return randomBytes(24).toString("hex"); }

async function spawnDetached(script: string, args: string[], logPath: string, environment: NodeJS.ProcessEnv = {}) {
  await mkdir(dirname(logPath), { recursive: true, mode: 0o700 });
  const output = openSync(logPath, "a", 0o600);
  try {
    const child = spawn(process.execPath, [join(scriptsRoot, script), ...args], {
      detached: true,
      stdio: ["ignore", output, output],
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        TMPDIR: process.env.TMPDIR ?? "/tmp",
        ...environment,
      },
    });
    child.unref();
    if (!child.pid) throw new Error("PROCESS_START_FAILED");
    return child.pid;
  } finally { closeSync(output); }
}

async function pollJson(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      last = `${response.status} ${await response.text()}`;
      if (response.ok) return JSON.parse(last.slice(last.indexOf(" ") + 1)) as Record<string, unknown>;
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`PROCESS_READINESS_TIMEOUT:${last.slice(0, 240)}`);
}

async function pollHealth(url: string, status: number, contains: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  let last = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(2_000) });
      const body = await response.text();
      last = `${response.status} ${body.slice(0, 160)}`;
      if (response.status === status && body.includes(contains)) return;
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`APPLICATION_HEALTH_CHECK_FAILED:${last}`);
}

export async function startApplication(input: {
  manifestPath: string;
  publicPort: number;
  applicationPort: number;
  stateRoot: string;
  releaseId: string;
  timeoutMs?: number;
  now?: () => string;
}): Promise<RunningApplication> {
  assertPrivatePort(input.publicPort);
  assertPrivatePort(input.applicationPort);
  if (input.publicPort === input.applicationPort) throw new Error("APPLICATION_PORTS_MUST_DIFFER");
  const { manifest } = await verifyArtifact(input.manifestPath);
  const token = ownerToken();
  const pid = await spawnDetached("application-process.ts", [
    "--manifest", resolve(input.manifestPath),
    "--public-port", String(input.publicPort),
    "--application-port", String(input.applicationPort),
    "--owner-token", token,
  ], join(input.stateRoot, "logs", `${input.releaseId}.log`), studioRuntimeEnvironment(process.env));
  const running: RunningApplication = {
    releaseId: input.releaseId,
    manifestPath: resolve(input.manifestPath),
    artifactDigest: manifest.artifactDigest,
    sourceSha: manifest.sourceSha,
    version: manifest.version,
    compatibility: manifest.compatibility,
    pid,
    publicPort: input.publicPort,
    applicationPort: input.applicationPort,
    ownerToken: token,
    startedAt: (input.now ?? (() => new Date().toISOString()))(),
  };
  try {
    const metadata = await pollJson(`http://127.0.0.1:${input.publicPort}/__oceanheart_release`, input.timeoutMs ?? 60_000);
    if (
      metadata.ownerToken !== token || metadata.releaseId !== input.releaseId ||
      metadata.sourceSha !== manifest.sourceSha || metadata.artifactDigest !== manifest.artifactDigest ||
      metadata.dataTarget !== manifest.compatibility.dataTarget
    ) throw new Error("APPLICATION_PROCESS_IDENTITY_MISMATCH");
    await pollHealth(
      `http://127.0.0.1:${input.publicPort}${manifest.health.path}`,
      manifest.health.status,
      manifest.health.contains,
      input.timeoutMs ?? 60_000,
    );
    return running;
  } catch (error) {
    await stopApplication(running);
    throw error;
  }
}

export async function startRouter(input: {
  statePath: string;
  stateRoot: string;
  clientId: string;
  port: number;
  now?: () => string;
}) {
  assertPrivatePort(input.port);
  const token = ownerToken();
  const pid = await spawnDetached("router-process.ts", [
    "--state", resolve(input.statePath),
    "--client", input.clientId,
    "--port", String(input.port),
    "--owner-token", token,
  ], join(input.stateRoot, "logs", "router.log"));
  const metadata = await pollJson(`http://127.0.0.1:${input.port}/__oceanheart_router`, 10_000);
  if (metadata.ownerToken !== token || metadata.clientId !== input.clientId) throw new Error("ROUTER_IDENTITY_MISMATCH");
  return { pid, port: input.port, ownerToken: token, startedAt: (input.now ?? (() => new Date().toISOString()))() };
}

async function ownedEndpoint(port: number, path: string, token: string) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(1_000) });
    if (!response.ok) return false;
    return (await response.json() as { ownerToken?: string }).ownerToken === token;
  } catch { return false; }
}

export async function stopApplication(application: RunningApplication) {
  if (!(await ownedEndpoint(application.publicPort, "/__oceanheart_release", application.ownerToken))) return false;
  try { process.kill(application.pid, "SIGTERM"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  return true;
}

export async function stopRouter(router: NonNullable<import("./types.ts").ApplicationReleaseState["router"]>) {
  if (!(await ownedEndpoint(router.port, "/__oceanheart_router", router.ownerToken))) return false;
  try { process.kill(router.pid, "SIGTERM"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
  return true;
}

export async function inspectServedRelease(port: number) {
  return pollJson(`http://127.0.0.1:${port}/__oceanheart_active_release`, 5_000);
}

export function compatible(current: ApplicationArtifactManifest, target: ApplicationArtifactManifest) {
  return current.clientId === target.clientId &&
    current.compatibility.schemaVersion === target.compatibility.schemaVersion &&
    current.compatibility.dataTarget === target.compatibility.dataTarget &&
    target.compatibility.change !== undefined;
}
