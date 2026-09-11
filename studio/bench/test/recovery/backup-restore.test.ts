import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  artifactDigest,
  baselineArtifact,
  type ClaraConfigurationArtifact,
} from "../../src/adaptation/configuration.ts";
import type { AdaptationEvaluation } from "../../src/adaptation/evaluate.ts";
import { ClaraConfigurationStore } from "../../src/adaptation/release.ts";
import {
  createEncryptedBackup,
  readRecoveryKey,
  restoreEncryptedBackup,
} from "../../src/recovery/backup.ts";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import { scriptedProvider } from "../../src/runtime/transport.ts";
import type { ClaraInput } from "../../src/workflows/clara.ts";

const clientId = "c0001";
const fixture: ClaraInput = {
  schemaVersion: 1,
  clientId,
  period: { from: "2026-09-01", to: "2026-09-30" },
  sessions: [
    {
      id: "session-1",
      clientId: "person-1",
      date: "2026-09-11",
      attendance: "attended",
      rateMinor: 9100,
      rateRef: "synthetic-rate-v1",
    },
  ],
};
const request = {
  clientId,
  actor: "synthetic-restore-probe",
  idempotencyKey: "he12-restored-draft",
  configurationVersion: "clara-2026-10-01-rate-change",
  input: fixture,
};

async function activateConfiguration(root: string) {
  const baseline = baselineArtifact(
    {
      id: "clara-2026-09-01",
      instructionsVersion: "clara-invoice-rules@2026-09-01",
      toolsetVersion: "invoice-draft-stub@1",
      modelProfile: "workflow-adapter-synthetic",
    },
    clientId,
  );
  const candidate: ClaraConfigurationArtifact = {
    ...baseline,
    version: "clara-2026-10-01-rate-change",
    instructionsVersion: "clara-invoice-rules@2026-10-01",
  };
  const store = new ClaraConfigurationStore(root, clientId);
  const initial = await store.ensureBaseline(baseline, () => "2026-09-11T10:00:00.000Z");
  const reportDirectory = join(root, "evaluation-fixture");
  await mkdir(reportDirectory, { recursive: true, mode: 0o700 });
  const jsonPath = join(reportDirectory, "accepted.json");
  const htmlPath = join(reportDirectory, "accepted.html");
  const report = `${JSON.stringify({
    configurations: [{ id: baseline.version }, { id: candidate.version }],
    results: [{ pass: true }, { pass: true }],
  })}\n`;
  await writeFile(jsonPath, report, { mode: 0o600 });
  await writeFile(htmlPath, "<html></html>\n", { mode: 0o600 });
  const evaluation: AdaptationEvaluation = {
    schemaVersion: 1,
    evaluationId: "he12-evaluation",
    clientId,
    baselineArtifactDigest: artifactDigest(baseline),
    candidateArtifactDigest: artifactDigest(candidate),
    accepted: true,
    total: 2,
    passed: 2,
    reportDigest: `sha256:${createHash("sha256").update(report).digest("hex")}`,
    jsonPath,
    htmlPath,
    stateBoundary: "fresh-isolated-evaluation",
  };
  const activated = await store.activate(
    candidate,
    evaluation,
    initial.activeReleaseId,
    () => "2026-09-11T10:01:00.000Z",
  );
  return { initial, activated };
}

test("online SQLite backup restores Pi/config state and replay cannot duplicate a committed effect", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "studio-he12-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const source = join(workspace, "source");
  const offVm = join(workspace, "off-vm");
  const restored = join(workspace, "clean-restore");
  await mkdir(offVm, { mode: 0o700 });
  const archivePath = join(offVm, "c0001.ohbackup");
  const key = randomBytes(32);

  const configuration = await activateConfiguration(source);
  const runtime = new PiWorkflowRuntime({ root: source });
  const original = await runtime.startRun(request);
  assert.equal(original.status, "succeeded");
  assert.equal(original.result?.totalMinor, 9100);
  for (let index = 0; index < 160; index += 1) {
    runtime.store.event(original, "backup-wal-fixture", { index, padding: "x".repeat(512) });
  }
  assert.equal((await stat(`${source}/jobs.sqlite-wal`)).isFile(), true);
  let concurrentWriteObserved = false;
  const backup = await createEncryptedBackup({
    clientId,
    stateRoot: source,
    archivePath,
    key,
    databaseBackupRate: 1,
    onDatabaseBackupProgress: () => {
      if (concurrentWriteObserved) return;
      concurrentWriteObserved = true;
      runtime.store.event(original, "concurrent-backup-writer");
    },
    now: () => "2026-09-11T11:00:00.000Z",
  });
  runtime.close();
  assert.equal(concurrentWriteObserved, true);
  assert.equal(backup.database.integrityCheck, "ok");
  assert.equal(backup.database.effects, 1);
  assert.equal(backup.database.reservations, 1);
  assert.equal((await stat(archivePath)).mode & 0o777, 0o600);
  assert.equal((await readFile(archivePath)).includes(Buffer.from(clientId)), false);

  const receipt = await restoreEncryptedBackup({
    clientId,
    archivePath,
    destinationStateRoot: restored,
    key,
  });
  assert.equal(receipt.backupId, backup.backupId);
  assert.equal(receipt.configuration?.activeReleaseId, configuration.activated.active.activeReleaseId);

  let providerCalls = 0;
  const recovered = new PiWorkflowRuntime({
    root: restored,
    provider: scriptedProvider(() => {
      providerCalls += 1;
    }),
  });
  const replay = await recovered.startRun(request);
  assert.equal(replay.id, original.id);
  assert.equal(replay.result?.draftId, original.result?.draftId);
  assert.equal(providerCalls, 0);
  assert.equal(replay.sessionFile?.startsWith(`${receipt.destinationStateRoot}/`), true);
  assert.deepEqual(
    {
      ...recovered.store.db
        .prepare("SELECT (SELECT count(*) FROM jobs) jobs, (SELECT count(*) FROM effects) effects, (SELECT count(*) FROM reservations) reservations")
        .get(),
    },
    { jobs: 1, effects: 1, reservations: 1 },
  );
  recovered.close();

  const restoredConfiguration = new ClaraConfigurationStore(restored, clientId);
  assert.deepEqual(await restoredConfiguration.active(), configuration.activated.active);
  const rolledBack = await restoredConfiguration.rollback(
    configuration.initial.activeReleaseId,
    () => "2026-09-11T11:05:00.000Z",
  );
  assert.equal(rolledBack.active.version, "clara-2026-09-01");
});

test("restore rejects wrong-client, corrupt, incompatible and existing destinations", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "studio-he12-negative-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const source = join(workspace, "source");
  const offVm = join(workspace, "off-vm");
  await mkdir(offVm, { mode: 0o700 });
  const archivePath = join(offVm, "backup.ohbackup");
  const key = randomBytes(32);
  const runtime = new PiWorkflowRuntime({ root: source });
  await runtime.startRun(request);
  runtime.close();
  await createEncryptedBackup({ clientId, stateRoot: source, archivePath, key });

  await assert.rejects(
    restoreEncryptedBackup({
      clientId: "c0002",
      archivePath,
      destinationStateRoot: join(workspace, "wrong-client"),
      key,
    }),
    /BACKUP_CLIENT_MISMATCH/,
  );
  await assert.rejects(
    restoreEncryptedBackup({
      clientId,
      archivePath,
      destinationStateRoot: join(workspace, "incompatible"),
      key,
      compatibility: { piVersion: "0.84.0", stateSchemaVersion: 1 },
    }),
    /BACKUP_INCOMPATIBLE/,
  );

  const corrupted = join(offVm, "corrupted.ohbackup");
  const bytes = await readFile(archivePath);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(corrupted, bytes, { mode: 0o600 });
  await assert.rejects(
    restoreEncryptedBackup({
      clientId,
      archivePath: corrupted,
      destinationStateRoot: join(workspace, "corrupt"),
      key,
    }),
    /BACKUP_AUTHENTICATION_FAILED/,
  );

  const existing = join(workspace, "existing");
  await mkdir(existing, { mode: 0o700 });
  await writeFile(join(existing, "preserve"), "user-state", { mode: 0o600 });
  await assert.rejects(
    restoreEncryptedBackup({ clientId, archivePath, destinationStateRoot: existing, key }),
    /BACKUP_DESTINATION_EXISTS/,
  );
  assert.equal(await readFile(join(existing, "preserve"), "utf8"), "user-state");
});

test("backup rejects cross-client databases and loose recovery-key files", async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), "studio-he12-scope-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const source = join(workspace, "source");
  const offVm = join(workspace, "off-vm");
  await mkdir(offVm, { mode: 0o700 });
  const runtime = new PiWorkflowRuntime({ root: source });
  runtime.store.enqueue(request);
  runtime.store.enqueue({
    ...request,
    clientId: "c0002",
    idempotencyKey: "foreign",
    input: { ...fixture, clientId: "c0002" },
  });
  runtime.close();
  await assert.rejects(
    createEncryptedBackup({
      clientId,
      stateRoot: source,
      archivePath: join(offVm, "foreign.ohbackup"),
      key: randomBytes(32),
    }),
    /BACKUP_CLIENT_SCOPE_MISMATCH/,
  );

  const keyPath = join(workspace, "recovery.key");
  await writeFile(keyPath, randomBytes(32), { mode: 0o600 });
  assert.equal((await readRecoveryKey(keyPath)).length, 32);
  await chmod(keyPath, 0o644);
  await assert.rejects(readRecoveryKey(keyPath), /RECOVERY_KEY_PERMISSIONS/);
});
