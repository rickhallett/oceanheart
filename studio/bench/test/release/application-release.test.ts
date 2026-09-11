import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { applicationReleaseId, packageStudioApplication, verifyArtifact } from "../../src/release/artifact.ts";
import { LocalApplicationReleaseController, type ApplicationRuntime } from "../../src/release/controller.ts";
import type { ApplicationReleaseState, RunningApplication } from "../../src/release/types.ts";

async function artifact(root: string, clientId: string, sourceSha: string, version: string, schema = "synthetic-v1") {
  const build = join(root, `build-${clientId}-${version}-${schema}`);
  await mkdir(join(build, ".next", "standalone"), { recursive: true });
  await mkdir(join(build, ".next", "static"), { recursive: true });
  await mkdir(join(build, "public"));
  await writeFile(join(build, ".next", "BUILD_ID"), version);
  await writeFile(join(build, ".next", "standalone", "server.js"), "// synthetic standalone\n");
  await writeFile(join(build, ".next", "standalone", "package.json"), JSON.stringify({ dependencies: { next: "16.3.4" } }));
  await writeFile(join(build, ".next", "static", "marker.js"), version);
  await writeFile(join(build, "public", "marker.txt"), version);
  await writeFile(join(build, "next.config.ts"), "export default {};\n");
  await writeFile(join(build, "package.json"), JSON.stringify({ dependencies: { next: "16.3.4" } }));
  return packageStudioApplication({
    builtStudioRoot: build,
    destinationRoot: join(root, `artifact-${clientId}-${version}`),
    clientId,
    sourceSha,
    studioTreeSha: sourceSha,
    version,
    compatibility: { schemaVersion: schema, dataTarget: "private-synthetic-db", change: "none" },
    health: { path: "/health", status: 200, contains: version },
    now: () => "2026-09-11T15:00:00.000Z",
  });
}

function runtime(statePath: string) {
  let pid = 100;
  let failNext = false;
  const stopped: string[] = [];
  const implementation: ApplicationRuntime = {
    startRouter: async ({ port, now }) => ({ pid: pid++, port, ownerToken: "r".repeat(48), startedAt: (now ?? (() => "now"))() }),
    startApplication: async ({ manifestPath, publicPort, applicationPort, releaseId, now }) => {
      if (failNext) { failNext = false; throw new Error("synthetic candidate unhealthy"); }
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      return {
        releaseId, manifestPath, artifactDigest: manifest.artifactDigest, sourceSha: manifest.sourceSha,
        version: manifest.version, compatibility: manifest.compatibility, pid: pid++, publicPort, applicationPort,
        ownerToken: "a".repeat(48), startedAt: (now ?? (() => "now"))(),
      } as RunningApplication;
    },
    stopApplication: async (application) => { stopped.push(application.releaseId); return true; },
    stopRouter: async () => true,
    inspectServedRelease: async () => {
      const state = JSON.parse(await readFile(statePath, "utf8")) as ApplicationReleaseState;
      assert.ok(state.active);
      return {
        releaseId: state.active.releaseId, sourceSha: state.active.sourceSha,
        artifactDigest: state.active.artifactDigest, dataTarget: state.active.compatibility.dataTarget,
      };
    },
  };
  return { implementation, stopped, fail: () => { failNext = true; } };
}

test("failed candidate health leaves the prior application active", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-app-release-failure-"));
  const stateRoot = join(root, "state");
  const fake = runtime(join(stateRoot, "active.json"));
  const controller = new LocalApplicationReleaseController({ stateRoot, clientId: "clara-synthetic", runtime: fake.implementation });
  const prior = await artifact(root, "clara-synthetic", "a".repeat(40), "1.0.0");
  const candidate = await artifact(root, "clara-synthetic", "b".repeat(40), "1.1.0");
  const first = await controller.activate({ manifestPath: prior.manifestPath, routerPort: 43000, publicPort: 43001, applicationPort: 43002 });
  fake.fail();
  const failed = await controller.activate({ manifestPath: candidate.manifestPath, routerPort: 43000, publicPort: 43003, applicationPort: 43004 });
  assert.equal(failed.receipt.status, "failed");
  assert.match(failed.receipt.failure ?? "", /unhealthy/);
  assert.equal((await controller.state())?.active?.releaseId, first.receipt.activeReleaseId);
  assert.deepEqual(failed.receipt.activeProcess, { pid: 101, routerPort: 43000, releasePort: 43001, applicationPort: 43002 });
});

test("payload mutation invalidates the immutable artifact identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-app-release-digest-"));
  const packaged = await artifact(root, "clara-synthetic", "a".repeat(40), "1.0.0");
  const marker = join(root, "artifact-clara-synthetic-1.0.0", "payload", "public", "marker.txt");
  await chmod(marker, 0o600);
  await writeFile(marker, "mutated");
  await assert.rejects(verifyArtifact(packaged.manifestPath), /DIGEST_MISMATCH/);
});

test("activation and rollback switch only to the exact compatible prior release", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-app-release-rollback-"));
  const stateRoot = join(root, "state");
  const fake = runtime(join(stateRoot, "active.json"));
  const controller = new LocalApplicationReleaseController({ stateRoot, clientId: "clara-synthetic", runtime: fake.implementation });
  const prior = await artifact(root, "clara-synthetic", "a".repeat(40), "1.0.0");
  const candidate = await artifact(root, "clara-synthetic", "b".repeat(40), "1.1.0");
  const first = await controller.activate({ manifestPath: prior.manifestPath, routerPort: 43100, publicPort: 43101, applicationPort: 43102 });
  const second = await controller.activate({ manifestPath: candidate.manifestPath, routerPort: 43100, publicPort: 43103, applicationPort: 43104 });
  await assert.rejects(controller.rollback({ targetReleaseId: "f".repeat(64), routerPort: 43100, publicPort: 43105, applicationPort: 43106 }), /EXACT_PRIOR/);
  const rollback = await controller.rollback({ targetReleaseId: first.receipt.activeReleaseId!, routerPort: 43100, publicPort: 43105, applicationPort: 43106 });
  assert.equal(rollback.receipt.status, "ready");
  assert.equal(rollback.receipt.activeReleaseId, first.receipt.activeReleaseId);
  assert.equal(rollback.receipt.previousReleaseId, second.receipt.activeReleaseId);
  assert.ok(fake.stopped.includes(second.receipt.activeReleaseId!));
});

test("cross-client and incompatible-schema artifacts cannot change either active pointer", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-app-release-scope-"));
  const claraState = join(root, "clara-state");
  const amiraState = join(root, "amira-state");
  const claraRuntime = runtime(join(claraState, "active.json"));
  const amiraRuntime = runtime(join(amiraState, "active.json"));
  const clara = new LocalApplicationReleaseController({ stateRoot: claraState, clientId: "clara-synthetic", runtime: claraRuntime.implementation });
  const amira = new LocalApplicationReleaseController({ stateRoot: amiraState, clientId: "amira-synthetic", runtime: amiraRuntime.implementation });
  const claraV1 = await artifact(root, "clara-synthetic", "a".repeat(40), "1.0.0");
  const amiraV1 = await artifact(root, "amira-synthetic", "c".repeat(40), "1.0.0");
  const incompatible = await artifact(root, "clara-synthetic", "d".repeat(40), "2.0.0", "synthetic-v2");
  const claraReceipt = await clara.activate({ manifestPath: claraV1.manifestPath, routerPort: 43200, publicPort: 43201, applicationPort: 43202 });
  const amiraReceipt = await amira.activate({ manifestPath: amiraV1.manifestPath, routerPort: 43300, publicPort: 43301, applicationPort: 43302 });
  await assert.rejects(clara.activate({ manifestPath: amiraV1.manifestPath, routerPort: 43200, publicPort: 43203, applicationPort: 43204 }), /CROSS_CLIENT/);
  await assert.rejects(clara.activate({ manifestPath: incompatible.manifestPath, routerPort: 43200, publicPort: 43205, applicationPort: 43206 }), /NOT_DATA_COMPATIBLE/);
  assert.equal((await clara.state())?.active?.releaseId, claraReceipt.receipt.activeReleaseId);
  assert.equal((await amira.state())?.active?.releaseId, amiraReceipt.receipt.activeReleaseId);
  assert.equal(applicationReleaseId(amiraV1.manifest), amiraReceipt.receipt.activeReleaseId);
});
