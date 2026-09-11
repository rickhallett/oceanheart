import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { access, chmod, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

import type { ApplicationArtifactManifest, DataCompatibility } from "./types.ts";

const sha = /^[0-9a-f]{40}$/;
const digest = /^sha256:[0-9a-f]{64}$/;
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const execFile = promisify(execFileCallback);

async function hashTree(root: string) {
  const paths: string[] = [];
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) paths.push(relative(root, absolute).split(sep).join("/"));
      else throw new Error(`UNSUPPORTED_ARTIFACT_ENTRY:${relative(root, absolute)}`);
    }
  }
  await walk(root);
  const hash = createHash("sha256");
  for (const path of paths) {
    const content = await readFile(join(root, path));
    hash.update(`${Buffer.byteLength(path)}:${path}:${content.length}:`);
    hash.update(content);
  }
  return `sha256:${hash.digest("hex")}`;
}

function validateCompatibility(value: DataCompatibility) {
  if (!identifier.test(value.schemaVersion)) throw new Error("INVALID_DATA_SCHEMA_VERSION");
  if (!identifier.test(value.dataTarget)) throw new Error("INVALID_DATA_TARGET");
  if (value.change !== "none" && value.change !== "backward-compatible")
    throw new Error("INCOMPATIBLE_DATA_CHANGE");
}

export function validateManifest(manifest: ApplicationArtifactManifest) {
  if (manifest.schemaVersion !== 1 || manifest.kind !== "studio-application") throw new Error("INVALID_APPLICATION_MANIFEST");
  if (!identifier.test(manifest.clientId)) throw new Error("INVALID_CLIENT_ID");
  if (!sha.test(manifest.sourceSha) || !sha.test(manifest.studioTreeSha)) throw new Error("INVALID_SOURCE_IDENTITY");
  if (!digest.test(manifest.artifactDigest)) throw new Error("INVALID_ARTIFACT_DIGEST");
  if (!identifier.test(manifest.version)) throw new Error("INVALID_APPLICATION_VERSION");
  if (!/^v\d+\.\d+\.\d+$/.test(manifest.runtime.nodeVersion)) throw new Error("INVALID_NODE_VERSION");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.runtime.nextVersion)) throw new Error("INVALID_NEXT_VERSION");
  validateCompatibility(manifest.compatibility);
  if (!manifest.health.path.startsWith("/") || manifest.health.path.startsWith("//") || manifest.health.path.includes("#"))
    throw new Error("INVALID_HEALTH_PATH");
  if (!Number.isInteger(manifest.health.status) || manifest.health.status < 200 || manifest.health.status > 399)
    throw new Error("INVALID_HEALTH_STATUS");
  if (!manifest.health.contains || manifest.health.contains.length > 256) throw new Error("INVALID_HEALTH_CONTENT");
  return manifest;
}

export async function verifyArtifact(manifestPath: string) {
  const manifest = validateManifest(JSON.parse(await readFile(manifestPath, "utf8")) as ApplicationArtifactManifest);
  const root = resolve(manifestPath, "..");
  const payload = join(root, "payload");
  if (await hashTree(payload) !== manifest.artifactDigest) throw new Error("APPLICATION_ARTIFACT_DIGEST_MISMATCH");
  return { manifest, root, payload };
}

export async function verifyStudioSource(repositoryRoot: string, sourceSha: string, studioTreeSha: string) {
  if (!sha.test(sourceSha) || !sha.test(studioTreeSha)) throw new Error("INVALID_SOURCE_IDENTITY");
  const root = resolve(repositoryRoot);
  const output = async (args: string[]) => (await execFile("git", args, { cwd: root, encoding: "utf8" })).stdout.trim();
  if (await output(["rev-parse", "--show-toplevel"]) !== root) throw new Error("REPOSITORY_ROOT_MISMATCH");
  if (await output(["rev-parse", "HEAD"]) !== sourceSha) throw new Error("SOURCE_SHA_IS_NOT_CHECKED_OUT_HEAD");
  if (await output(["rev-parse", `${sourceSha}:studio`]) !== studioTreeSha) throw new Error("STUDIO_TREE_SHA_MISMATCH");
  try {
    await execFile("git", ["diff", "--quiet", sourceSha, "--", "studio", ":(exclude)studio/bench"], { cwd: root });
  } catch { throw new Error("STUDIO_APPLICATION_SOURCE_DIRTY"); }
  const status = await output(["status", "--porcelain=v1", "--untracked-files=all", "--", "studio"]);
  const outsideBench = status.split("\n").filter(Boolean).filter((line) => {
    const path = line.slice(3).replace(/^"|"$/g, "");
    return !path.startsWith("studio/bench/");
  });
  if (outsideBench.length) throw new Error("STUDIO_APPLICATION_SOURCE_DIRTY");
}

async function sealTree(root: string) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) { await sealTree(path); await chmod(path, 0o500); }
    else if (entry.isFile()) await chmod(path, 0o400);
  }
  await chmod(root, 0o500);
}

export async function packageStudioApplication(input: {
  builtStudioRoot: string;
  destinationRoot: string;
  clientId: string;
  sourceSha: string;
  studioTreeSha: string;
  version: string;
  compatibility: DataCompatibility;
  health: ApplicationArtifactManifest["health"];
  now?: () => string;
}) {
  if (resolve(input.destinationRoot).startsWith(`${resolve(input.builtStudioRoot)}${sep}`))
    throw new Error("ARTIFACT_DESTINATION_INSIDE_BUILD");
  const packageJson = JSON.parse(await readFile(join(input.builtStudioRoot, "package.json"), "utf8")) as {
    dependencies?: { next?: string };
  };
  if (!packageJson.dependencies?.next || !/^\d+\.\d+\.\d+$/.test(packageJson.dependencies.next))
    throw new Error("PINNED_NEXT_VERSION_REQUIRED");
  const payload = join(input.destinationRoot, "payload");
  await mkdir(resolve(input.destinationRoot, ".."), { recursive: true, mode: 0o700 });
  await mkdir(input.destinationRoot, { recursive: false, mode: 0o700 });
  await mkdir(payload, { recursive: false, mode: 0o700 });
  const standalone = join(input.builtStudioRoot, ".next", "standalone");
  try { await access(join(standalone, "server.js")); }
  catch { throw new Error("STANDALONE_STUDIO_BUILD_REQUIRED"); }
  await cp(standalone, payload, { recursive: true, dereference: true, errorOnExist: false });
  await mkdir(join(payload, ".next"), { recursive: true });
  await cp(join(input.builtStudioRoot, ".next", "static"), join(payload, ".next", "static"), { recursive: true, dereference: true, errorOnExist: true });
  await cp(join(input.builtStudioRoot, "public"), join(payload, basename("public")), { recursive: true, dereference: true, errorOnExist: true });
  await rm(join(payload, ".next", "cache"), { recursive: true, force: true });
  const artifactDigest = await hashTree(payload);
  const manifest: ApplicationArtifactManifest = validateManifest({
    schemaVersion: 1,
    kind: "studio-application",
    clientId: input.clientId,
    sourceSha: input.sourceSha,
    studioTreeSha: input.studioTreeSha,
    artifactDigest,
    version: input.version,
    runtime: { nodeVersion: process.version, nextVersion: packageJson.dependencies.next },
    compatibility: input.compatibility,
    health: input.health,
    createdAt: (input.now ?? (() => new Date().toISOString()))(),
  });
  const manifestPath = join(input.destinationRoot, "release-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await sealTree(payload);
  await verifyArtifact(manifestPath);
  return { manifest, manifestPath };
}

export function applicationReleaseId(manifest: ApplicationArtifactManifest) {
  return createHash("sha256")
    .update(`${manifest.clientId}:${manifest.sourceSha}:${manifest.artifactDigest}:${manifest.version}:${manifest.compatibility.schemaVersion}:${manifest.compatibility.dataTarget}`)
    .digest("hex");
}
