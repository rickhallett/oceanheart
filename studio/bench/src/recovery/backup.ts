import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { constants as fsConstants, realpathSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { backup as sqliteBackup, DatabaseSync } from "node:sqlite";

import { ClaraConfigurationStore } from "../adaptation/release.ts";

const ARCHIVE_MAGIC = Buffer.from("OHBKP001", "ascii");
const ARCHIVE_IV_BYTES = 12;
const ARCHIVE_TAG_BYTES = 16;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 10_000;
const CURRENT_PI_VERSION = "0.85.1";
const CURRENT_STATE_SCHEMA_VERSION = 1;
const clientIdPattern = /^[a-zA-Z0-9_-]{1,64}$/;

type FileEntry = {
  path: string;
  size: number;
  sha256: string;
};

type ArchiveFile = FileEntry & {
  contentBase64: string;
};

export type BackupDatabaseReceipt = {
  path: "jobs.sqlite";
  sha256: string;
  integrityCheck: "ok";
  jobs: number;
  effects: number;
  reservations: number;
  traces: number;
};

export type BackupConfigurationReceipt = {
  activeReleaseId: string;
  artifactDigest: string;
  version: string;
  generation: number;
};

export type BackupManifest = {
  schemaVersion: 1;
  format: "oceanheart-studio-state";
  backupId: string;
  clientId: string;
  createdAt: string;
  piVersion: "0.85.1";
  stateSchemaVersion: 1;
  contentDigest: string;
  database: BackupDatabaseReceipt;
  configuration: BackupConfigurationReceipt | null;
  applicationReleaseState: { contentDigest: string } | null;
  files: FileEntry[];
};

type BackupEnvelope = {
  manifest: BackupManifest;
  files: ArchiveFile[];
};

export type BackupReceipt = Pick<
  BackupManifest,
  | "schemaVersion"
  | "backupId"
  | "clientId"
  | "createdAt"
  | "contentDigest"
  | "database"
  | "configuration"
  | "applicationReleaseState"
> & {
  archivePath: string;
  archiveSha256: string;
};

export type RestoreReceipt = BackupReceipt & {
  restoredAt: string;
  destinationStateRoot: string;
  restoredDatabaseSha256: string;
};

type DatabaseProgress = { totalPages: number; remainingPages: number };

type CreateBackupInput = {
  clientId: string;
  stateRoot: string;
  archivePath: string;
  key: Uint8Array;
  now?: () => string;
  databaseBackupRate?: number;
  onDatabaseBackupProgress?: (progress: DatabaseProgress) => void;
};

type RestoreBackupInput = {
  clientId: string;
  archivePath: string;
  destinationStateRoot: string;
  key: Uint8Array;
  compatibility?: { piVersion: string; stateSchemaVersion: number };
  now?: () => string;
};

type DatabaseValidation = {
  receipt: BackupDatabaseReceipt;
  sessionPaths: Map<string, string>;
};

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function validateClientId(clientId: string) {
  if (!clientIdPattern.test(clientId)) throw new Error("INVALID_CLIENT_ID");
}

function validateKey(key: Uint8Array) {
  if (key.byteLength !== 32) throw new Error("INVALID_RECOVERY_KEY");
  return Buffer.from(key);
}

function inside(root: string, candidate: string) {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function validateRelativePath(path: string, clientId: string) {
  if (
    !path ||
    path.includes("\\") ||
    isAbsolute(path) ||
    normalize(path) !== path ||
    path.split("/").includes("..")
  ) throw new Error("BACKUP_PATH_INVALID");
  const allowed =
    path === "jobs.sqlite" ||
    path.startsWith(`${clientId}/`) ||
    path.startsWith(`configurations/${clientId}/`) ||
    path.startsWith(`application-releases/${clientId}/`);
  if (!allowed) throw new Error("BACKUP_PATH_OUT_OF_SCOPE");
  const name = basename(path);
  if (
    name.endsWith(".lock") ||
    name.includes(".tmp-") ||
    name === "recovery-supervisor.log" ||
    name === "jobs.sqlite-wal" ||
    name === "jobs.sqlite-shm"
  ) throw new Error("BACKUP_EPHEMERAL_PATH");
}

async function assertCanonicalDirectory(path: string, code: string) {
  const resolved = resolve(path);
  let metadata;
  try {
    metadata = await lstat(resolved);
  } catch {
    throw new Error(code);
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(code);
  }
  return realpath(resolved);
}

async function ensurePrivateDirectory(path: string) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const resolved = await assertCanonicalDirectory(path, "BACKUP_DIRECTORY_INVALID");
  const metadata = await stat(resolved);
  if ((metadata.mode & 0o077) !== 0) throw new Error("BACKUP_DIRECTORY_NOT_PRIVATE");
  return resolved;
}

async function syncDirectory(path: string) {
  const handle = await open(path, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function stableRead(path: string) {
  const handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size > BigInt(MAX_FILE_BYTES)) {
      throw new Error("BACKUP_FILE_INVALID");
    }
    const content = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      BigInt(content.byteLength) !== after.size
    ) throw new Error("BACKUP_FILE_CHANGED");
    return content;
  } finally {
    await handle.close();
  }
}

function excludedFile(name: string) {
  return (
    name.endsWith(".lock") ||
    name.includes(".tmp-") ||
    name === "recovery-supervisor.log" ||
    name === "jobs.sqlite-wal" ||
    name === "jobs.sqlite-shm"
  );
}

async function collectTree(
  stateRoot: string,
  relativeRoot: string,
  clientId: string,
  output: ArchiveFile[],
) {
  const root = join(stateRoot, relativeRoot);
  let rootMetadata;
  try {
    rootMetadata = await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error("BACKUP_TREE_INVALID");
  }

  async function visit(directory: string, relativeDirectory: string) {
    const before = await stat(directory, { bigint: true });
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (excludedFile(entry.name)) continue;
      const absolutePath = join(directory, entry.name);
      const relativePath = join(relativeDirectory, entry.name).split(sep).join("/");
      validateRelativePath(relativePath, clientId);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        const content = await stableRead(absolutePath);
        output.push({
          path: relativePath,
          size: content.byteLength,
          sha256: sha256(content),
          contentBase64: content.toString("base64"),
        });
        if (output.length > MAX_FILES) throw new Error("BACKUP_FILE_LIMIT");
      } else {
        throw new Error("BACKUP_SPECIAL_FILE");
      }
    }
    const after = await stat(directory, { bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.mtimeNs !== after.mtimeNs) {
      throw new Error("BACKUP_TREE_CHANGED");
    }
  }

  await visit(root, relativeRoot);
}

async function acquireLock(path: string, clientId: string) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({
      schemaVersion: 1,
      operation: "backup",
      clientId,
      pid: process.pid,
    })}\n`);
    await handle.sync();
    return handle;
  } catch (error) {
    await handle?.close();
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("BACKUP_BUSY");
    throw error;
  }
}

async function withBackupLocks<T>(stateRoot: string, clientId: string, operation: () => Promise<T>) {
  const paths = [
    join(stateRoot, ".he12-backup.lock"),
    join(stateRoot, "configurations", clientId, "activation.lock"),
    join(stateRoot, "application-releases", clientId, "activation.lock"),
  ];
  const acquired: Array<{ path: string; handle: Awaited<ReturnType<typeof open>> }> = [];
  try {
    for (const path of paths) acquired.push({ path, handle: await acquireLock(path, clientId) });
    return await operation();
  } finally {
    for (const lock of acquired.reverse()) {
      try {
        await lock.handle.close();
      } finally {
        await rm(lock.path, { force: true });
      }
    }
  }
}

function tableNames(database: DatabaseSync) {
  return new Set(
    (database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>)
      .map((row) => row.name),
  );
}

function count(database: DatabaseSync, sql: string, ...parameters: string[]) {
  const row = database.prepare(sql).get(...parameters) as { value: number } | undefined;
  return Number(row?.value ?? -1);
}

function validateDatabase(
  database: DatabaseSync,
  clientId: string,
  options: { sourceRoot?: string; restoreRoot?: string },
): DatabaseValidation {
  const required = ["jobs", "reservations", "effects", "traces"];
  const names = tableNames(database);
  if (required.some((name) => !names.has(name))) throw new Error("BACKUP_DATABASE_SCHEMA_INVALID");
  const integrityRows = database.prepare("PRAGMA integrity_check").all() as Array<Record<string, unknown>>;
  if (integrityRows.length !== 1 || Object.values(integrityRows[0] ?? {})[0] !== "ok") {
    throw new Error("BACKUP_DATABASE_CORRUPT");
  }
  if (
    count(database, "SELECT count(*) value FROM jobs WHERE client<>?", clientId) !== 0 ||
    count(database, "SELECT count(*) value FROM reservations WHERE client<>?", clientId) !== 0
  ) throw new Error("BACKUP_CLIENT_SCOPE_MISMATCH");
  if (
    count(database, "SELECT count(*) value FROM effects e LEFT JOIN jobs j ON j.id=e.job WHERE j.id IS NULL") !== 0 ||
    count(database, "SELECT count(*) value FROM reservations r LEFT JOIN jobs j ON j.id=r.job WHERE j.id IS NULL") !== 0 ||
    count(database, "SELECT count(*) value FROM traces t LEFT JOIN jobs j ON j.id=t.job WHERE j.id IS NULL") !== 0
  ) throw new Error("BACKUP_DATABASE_REFERENCES_INVALID");

  const sessionPaths = new Map<string, string>();
  const jobs = database.prepare("SELECT id,client,json FROM jobs ORDER BY id").all() as Array<{
    id: string;
    client: string;
    json: string;
  }>;
  const update = database.prepare("UPDATE jobs SET json=? WHERE id=? AND client=?");
  for (const row of jobs) {
    let job: {
      id?: string;
      clientId?: string;
      request?: { clientId?: string; input?: { clientId?: string } };
      sessionFile?: string;
    };
    try {
      job = JSON.parse(row.json) as typeof job;
    } catch {
      throw new Error("BACKUP_JOB_INVALID");
    }
    if (
      row.client !== clientId ||
      job.id !== row.id ||
      job.clientId !== clientId ||
      job.request?.clientId !== clientId ||
      job.request.input?.clientId !== clientId
    ) throw new Error("BACKUP_CLIENT_SCOPE_MISMATCH");
    if (job.sessionFile !== undefined) {
      if (options.sourceRoot) {
        let absolute;
        try {
          absolute = realpathSync(resolve(job.sessionFile));
        } catch {
          throw new Error("BACKUP_SESSION_PATH_INVALID");
        }
        if (!inside(options.sourceRoot, absolute)) throw new Error("BACKUP_SESSION_PATH_INVALID");
        const portable = relative(options.sourceRoot, absolute).split(sep).join("/");
        validateRelativePath(portable, clientId);
        job.sessionFile = `backup://${portable}`;
        sessionPaths.set(row.id, portable);
        update.run(JSON.stringify(job), row.id, clientId);
      } else if (options.restoreRoot) {
        if (!job.sessionFile.startsWith("backup://")) throw new Error("BACKUP_SESSION_PATH_INVALID");
        const portable = job.sessionFile.slice("backup://".length);
        validateRelativePath(portable, clientId);
        job.sessionFile = join(options.restoreRoot, portable);
        sessionPaths.set(row.id, portable);
        update.run(JSON.stringify(job), row.id, clientId);
      }
    }
  }

  const traces = database.prepare("SELECT json FROM traces").all() as Array<{ json: string }>;
  for (const row of traces) {
    try {
      if ((JSON.parse(row.json) as { clientId?: string }).clientId !== clientId) {
        throw new Error("BACKUP_CLIENT_SCOPE_MISMATCH");
      }
    } catch (error) {
      if ((error as Error).message === "BACKUP_CLIENT_SCOPE_MISMATCH") throw error;
      throw new Error("BACKUP_TRACE_INVALID");
    }
  }

  return {
    receipt: {
      path: "jobs.sqlite",
      sha256: "",
      integrityCheck: "ok",
      jobs: jobs.length,
      effects: count(database, "SELECT count(*) value FROM effects"),
      reservations: count(database, "SELECT count(*) value FROM reservations"),
      traces: traces.length,
    },
    sessionPaths,
  };
}

async function validateConfiguration(stateRoot: string, clientId: string) {
  const activePath = join(stateRoot, "configurations", clientId, "active.json");
  try {
    const metadata = await lstat(activePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("BACKUP_CONFIGURATION_INVALID");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const active = await new ClaraConfigurationStore(stateRoot, clientId).active();
  if (!active) throw new Error("BACKUP_CONFIGURATION_INVALID");
  return {
    activeReleaseId: active.activeReleaseId,
    artifactDigest: active.artifactDigest,
    version: active.version,
    generation: active.generation,
  } satisfies BackupConfigurationReceipt;
}

function fileDigest(files: Array<Pick<FileEntry, "path" | "size" | "sha256">>) {
  const hash = createHash("sha256");
  for (const file of [...files].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(file.path).update("\0").update(String(file.size)).update("\0").update(file.sha256).update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function applicationReleaseState(files: ArchiveFile[], clientId: string) {
  const prefix = `application-releases/${clientId}/`;
  const selected = files.filter((file) => file.path.startsWith(prefix));
  return selected.length ? { contentDigest: fileDigest(selected) } : null;
}

function encryptEnvelope(envelope: BackupEnvelope, key: Buffer) {
  const plaintext = Buffer.from(JSON.stringify(envelope), "utf8");
  if (plaintext.byteLength > MAX_ARCHIVE_BYTES) throw new Error("BACKUP_SIZE_LIMIT");
  const iv = randomBytes(ARCHIVE_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: ARCHIVE_TAG_BYTES });
  cipher.setAAD(ARCHIVE_MAGIC);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  plaintext.fill(0);
  return Buffer.concat([ARCHIVE_MAGIC, iv, tag, ciphertext]);
}

function decryptEnvelope(archive: Buffer, key: Buffer): BackupEnvelope {
  if (
    archive.byteLength < ARCHIVE_MAGIC.byteLength + ARCHIVE_IV_BYTES + ARCHIVE_TAG_BYTES + 2 ||
    archive.byteLength > MAX_ARCHIVE_BYTES ||
    !archive.subarray(0, ARCHIVE_MAGIC.byteLength).equals(ARCHIVE_MAGIC)
  ) throw new Error("BACKUP_AUTHENTICATION_FAILED");
  const ivStart = ARCHIVE_MAGIC.byteLength;
  const tagStart = ivStart + ARCHIVE_IV_BYTES;
  const ciphertextStart = tagStart + ARCHIVE_TAG_BYTES;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      archive.subarray(ivStart, tagStart),
      { authTagLength: ARCHIVE_TAG_BYTES },
    );
    decipher.setAAD(ARCHIVE_MAGIC);
    decipher.setAuthTag(archive.subarray(tagStart, ciphertextStart));
    const plaintext = Buffer.concat([
      decipher.update(archive.subarray(ciphertextStart)),
      decipher.final(),
    ]);
    try {
      return JSON.parse(plaintext.toString("utf8")) as BackupEnvelope;
    } finally {
      plaintext.fill(0);
    }
  } catch {
    throw new Error("BACKUP_AUTHENTICATION_FAILED");
  }
}

function validateEnvelope(envelope: BackupEnvelope, expectedClientId: string) {
  if (!envelope || typeof envelope !== "object" || !Array.isArray(envelope.files)) {
    throw new Error("BACKUP_MANIFEST_INVALID");
  }
  const manifest = envelope.manifest;
  if (
    !manifest ||
    manifest.schemaVersion !== 1 ||
    manifest.format !== "oceanheart-studio-state" ||
    manifest.clientId !== expectedClientId ||
    manifest.piVersion !== CURRENT_PI_VERSION ||
    manifest.stateSchemaVersion !== CURRENT_STATE_SCHEMA_VERSION ||
    !/^sha256:[0-9a-f]{64}$/.test(manifest.contentDigest) ||
    !/^[0-9a-f]{64}$/.test(manifest.backupId) ||
    !Number.isFinite(Date.parse(manifest.createdAt)) ||
    !Array.isArray(manifest.files)
  ) {
    if (manifest?.clientId !== expectedClientId) throw new Error("BACKUP_CLIENT_MISMATCH");
    throw new Error("BACKUP_MANIFEST_INVALID");
  }
  if (envelope.files.length !== manifest.files.length || envelope.files.length > MAX_FILES) {
    throw new Error("BACKUP_MANIFEST_INVALID");
  }
  const seen = new Set<string>();
  let total = 0;
  for (let index = 0; index < envelope.files.length; index += 1) {
    const archived = envelope.files[index];
    const declared = manifest.files[index];
    if (!archived || !declared || archived.path !== declared.path || seen.has(archived.path)) {
      throw new Error("BACKUP_MANIFEST_INVALID");
    }
    validateRelativePath(archived.path, expectedClientId);
    seen.add(archived.path);
    let content;
    try {
      content = Buffer.from(archived.contentBase64, "base64");
    } catch {
      throw new Error("BACKUP_CONTENT_INVALID");
    }
    if (
      archived.size !== declared.size ||
      archived.sha256 !== declared.sha256 ||
      content.byteLength !== archived.size ||
      sha256(content) !== archived.sha256
    ) throw new Error("BACKUP_CONTENT_INVALID");
    total += content.byteLength;
    if (total > MAX_ARCHIVE_BYTES) throw new Error("BACKUP_SIZE_LIMIT");
  }
  if (!seen.has("jobs.sqlite") || fileDigest(manifest.files) !== manifest.contentDigest) {
    throw new Error("BACKUP_CONTENT_INVALID");
  }
  const databaseFile = manifest.files.find((file) => file.path === "jobs.sqlite");
  const database = manifest.database;
  if (
    !databaseFile ||
    !database ||
    database.path !== "jobs.sqlite" ||
    database.integrityCheck !== "ok" ||
    database.sha256 !== databaseFile.sha256 ||
    ![database.jobs, database.effects, database.reservations, database.traces]
      .every((value) => Number.isSafeInteger(value) && value >= 0)
  ) throw new Error("BACKUP_DATABASE_MANIFEST_INVALID");
  if (
    manifest.configuration !== null &&
    (
      !/^[0-9a-f]{64}$/.test(manifest.configuration.activeReleaseId) ||
      !/^sha256:[0-9a-f]{64}$/.test(manifest.configuration.artifactDigest) ||
      typeof manifest.configuration.version !== "string" ||
      !Number.isSafeInteger(manifest.configuration.generation) ||
      manifest.configuration.generation < 1
    )
  ) throw new Error("BACKUP_CONFIGURATION_INVALID");
  if (
    manifest.applicationReleaseState !== null &&
    !/^sha256:[0-9a-f]{64}$/.test(manifest.applicationReleaseState.contentDigest)
  ) throw new Error("BACKUP_APPLICATION_RELEASE_INVALID");
  const expectedBackupId = sha256(
    `${manifest.clientId}:${manifest.createdAt}:${manifest.piVersion}:${manifest.stateSchemaVersion}:${manifest.contentDigest}`,
  );
  if (expectedBackupId !== manifest.backupId) throw new Error("BACKUP_MANIFEST_INVALID");
  const appState = applicationReleaseState(envelope.files, expectedClientId);
  if (JSON.stringify(appState) !== JSON.stringify(manifest.applicationReleaseState)) {
    throw new Error("BACKUP_APPLICATION_RELEASE_INVALID");
  }
  return manifest;
}

async function writeArchive(path: string, content: Buffer) {
  let handle;
  try {
    handle = await open(path, "wx", 0o600);
    await handle.writeFile(content);
    await handle.sync();
  } catch (error) {
    if (handle) await rm(path, { force: true });
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("BACKUP_ARCHIVE_EXISTS");
    throw error;
  } finally {
    await handle?.close();
  }
  await chmod(path, 0o600);
  await syncDirectory(dirname(path));
}

async function writeStagedFiles(root: string, files: ArchiveFile[], clientId: string) {
  for (const file of files) {
    validateRelativePath(file.path, clientId);
    const target = join(root, file.path);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const content = Buffer.from(file.contentBase64, "base64");
    const handle = await open(target, "wx", 0o600);
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
      content.fill(0);
    }
  }
}

export async function readRecoveryKey(path: string) {
  const resolved = resolve(path);
  const metadata = await lstat(resolved);
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error("RECOVERY_KEY_INVALID");
  if ((metadata.mode & 0o077) !== 0) throw new Error("RECOVERY_KEY_PERMISSIONS");
  const key = await readFile(resolved);
  if (key.byteLength !== 32) throw new Error("INVALID_RECOVERY_KEY");
  return key;
}

export async function createEncryptedBackup(input: CreateBackupInput): Promise<BackupReceipt> {
  validateClientId(input.clientId);
  const key = validateKey(input.key);
  const stateRoot = await assertCanonicalDirectory(input.stateRoot, "BACKUP_STATE_ROOT_INVALID");
  const archiveParent = await ensurePrivateDirectory(dirname(resolve(input.archivePath)));
  const archivePath = join(archiveParent, basename(input.archivePath));
  if (inside(stateRoot, archivePath)) throw new Error("BACKUP_ARCHIVE_MUST_BE_OFF_STATE_ROOT");
  try {
    await lstat(archivePath);
    throw new Error("BACKUP_ARCHIVE_EXISTS");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return withBackupLocks(stateRoot, input.clientId, async () => {
    const temporary = await mkdtemp(join(tmpdir(), "studio-he12-backup-"));
    await chmod(temporary, 0o700);
    try {
      const snapshotPath = join(temporary, "jobs.sqlite");
      const sourceDatabase = new DatabaseSync(join(stateRoot, "jobs.sqlite"), { readOnly: true });
      try {
        await sqliteBackup(sourceDatabase, snapshotPath, {
          rate: input.databaseBackupRate ?? 64,
          progress: input.onDatabaseBackupProgress,
        });
      } finally {
        sourceDatabase.close();
      }

      const snapshotDatabase = new DatabaseSync(snapshotPath);
      let databaseValidation;
      try {
        snapshotDatabase.exec("BEGIN IMMEDIATE");
        try {
          databaseValidation = validateDatabase(snapshotDatabase, input.clientId, { sourceRoot: stateRoot });
          snapshotDatabase.exec("COMMIT");
        } catch (error) {
          snapshotDatabase.exec("ROLLBACK");
          throw error;
        }
        snapshotDatabase.exec("PRAGMA journal_mode=DELETE");
      } finally {
        snapshotDatabase.close();
      }

      const files: ArchiveFile[] = [];
      const databaseContent = await stableRead(snapshotPath);
      const databaseEntry: ArchiveFile = {
        path: "jobs.sqlite",
        size: databaseContent.byteLength,
        sha256: sha256(databaseContent),
        contentBase64: databaseContent.toString("base64"),
      };
      databaseContent.fill(0);
      files.push(databaseEntry);
      await collectTree(stateRoot, input.clientId, input.clientId, files);
      await collectTree(stateRoot, `configurations/${input.clientId}`, input.clientId, files);
      await collectTree(stateRoot, `application-releases/${input.clientId}`, input.clientId, files);
      files.sort((left, right) => left.path.localeCompare(right.path));
      for (const portable of databaseValidation.sessionPaths.values()) {
        if (!files.some((file) => file.path === portable)) throw new Error("BACKUP_SESSION_FILE_MISSING");
      }
      const totalBytes = files.reduce((total, file) => total + file.size, 0);
      if (totalBytes > MAX_ARCHIVE_BYTES) throw new Error("BACKUP_SIZE_LIMIT");

      const validationRoot = join(temporary, "validation-state");
      await mkdir(validationRoot, { mode: 0o700 });
      await writeStagedFiles(validationRoot, files, input.clientId);
      const configuration = await validateConfiguration(validationRoot, input.clientId);
      const manifestFiles = files.map(({ path, size, sha256: digest }) => ({
        path,
        size,
        sha256: digest,
      }));
      const contentDigest = fileDigest(manifestFiles);
      const createdAt = (input.now ?? (() => new Date().toISOString()))();
      if (!Number.isFinite(Date.parse(createdAt))) throw new Error("BACKUP_TIME_INVALID");
      const backupId = sha256(
        `${input.clientId}:${createdAt}:${CURRENT_PI_VERSION}:${CURRENT_STATE_SCHEMA_VERSION}:${contentDigest}`,
      );
      const database = {
        ...databaseValidation.receipt,
        sha256: databaseEntry.sha256,
      };
      const manifest: BackupManifest = {
        schemaVersion: 1,
        format: "oceanheart-studio-state",
        backupId,
        clientId: input.clientId,
        createdAt,
        piVersion: CURRENT_PI_VERSION,
        stateSchemaVersion: CURRENT_STATE_SCHEMA_VERSION,
        contentDigest,
        database,
        configuration,
        applicationReleaseState: applicationReleaseState(files, input.clientId),
        files: manifestFiles,
      };
      const encrypted = encryptEnvelope({ manifest, files }, key);
      await writeArchive(archivePath, encrypted);
      return {
        schemaVersion: 1,
        backupId,
        clientId: input.clientId,
        createdAt,
        contentDigest,
        database,
        configuration,
        applicationReleaseState: manifest.applicationReleaseState,
        archivePath,
        archiveSha256: sha256(encrypted),
      };
    } finally {
      key.fill(0);
      await rm(temporary, { recursive: true, force: true });
    }
  });
}

export async function restoreEncryptedBackup(input: RestoreBackupInput): Promise<RestoreReceipt> {
  validateClientId(input.clientId);
  const key = validateKey(input.key);
  const archivePath = resolve(input.archivePath);
  const archiveMetadata = await lstat(archivePath);
  if (
    archiveMetadata.isSymbolicLink() ||
    !archiveMetadata.isFile() ||
    (archiveMetadata.mode & 0o077) !== 0 ||
    archiveMetadata.size > MAX_ARCHIVE_BYTES
  ) throw new Error("BACKUP_ARCHIVE_INVALID");
  const requestedDestination = resolve(input.destinationStateRoot);
  try {
    await lstat(requestedDestination);
    throw new Error("BACKUP_DESTINATION_EXISTS");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const parent = await ensurePrivateDirectory(dirname(requestedDestination));
  const destination = join(parent, basename(requestedDestination));
  const archive = await readFile(archivePath);
  const archiveSha256 = sha256(archive);
  let envelope;
  try {
    envelope = decryptEnvelope(archive, key);
  } finally {
    key.fill(0);
  }
  const manifest = validateEnvelope(envelope, input.clientId);
  const compatibility = input.compatibility ?? {
    piVersion: CURRENT_PI_VERSION,
    stateSchemaVersion: CURRENT_STATE_SCHEMA_VERSION,
  };
  if (
    compatibility.piVersion !== manifest.piVersion ||
    compatibility.stateSchemaVersion !== manifest.stateSchemaVersion
  ) throw new Error("BACKUP_INCOMPATIBLE");

  const temporary = await mkdtemp(join(parent, `.he12-restore-${input.clientId}-`));
  await chmod(temporary, 0o700);
  const stagedState = join(temporary, "state");
  await mkdir(stagedState, { mode: 0o700 });
  let destinationCreated = false;
  try {
    await writeStagedFiles(stagedState, envelope.files, input.clientId);
    const stagedDatabasePath = join(stagedState, "jobs.sqlite");
    const database = new DatabaseSync(stagedDatabasePath);
    let validation;
    try {
      database.exec("BEGIN IMMEDIATE");
      try {
        validation = validateDatabase(database, input.clientId, { restoreRoot: destination });
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      database.exec("PRAGMA journal_mode=DELETE");
    } finally {
      database.close();
    }
    const counts = validation.receipt;
    if (
      counts.jobs !== manifest.database.jobs ||
      counts.effects !== manifest.database.effects ||
      counts.reservations !== manifest.database.reservations ||
      counts.traces !== manifest.database.traces
    ) throw new Error("BACKUP_DATABASE_COUNTS_MISMATCH");
    for (const portable of validation.sessionPaths.values()) {
      const sessionMetadata = await lstat(join(stagedState, portable));
      if (!sessionMetadata.isFile() || sessionMetadata.isSymbolicLink()) {
        throw new Error("BACKUP_SESSION_FILE_MISSING");
      }
    }
    const configuration = await validateConfiguration(stagedState, input.clientId);
    if (JSON.stringify(configuration) !== JSON.stringify(manifest.configuration)) {
      throw new Error("BACKUP_CONFIGURATION_MISMATCH");
    }

    await mkdir(destination, { mode: 0o700 });
    destinationCreated = true;
    for (const entry of await readdir(stagedState)) {
      await rename(join(stagedState, entry), join(destination, entry));
    }
    await syncDirectory(destination);
    await syncDirectory(parent);
    const restoredDatabase = await stableRead(join(destination, "jobs.sqlite"));
    const restoredDatabaseSha256 = sha256(restoredDatabase);
    restoredDatabase.fill(0);
    const restoredAt = (input.now ?? (() => new Date().toISOString()))();
    return {
      schemaVersion: 1,
      backupId: manifest.backupId,
      clientId: input.clientId,
      createdAt: manifest.createdAt,
      restoredAt,
      contentDigest: manifest.contentDigest,
      database: manifest.database,
      configuration: manifest.configuration,
      applicationReleaseState: manifest.applicationReleaseState,
      archivePath,
      archiveSha256,
      destinationStateRoot: destination,
      restoredDatabaseSha256,
    };
  } catch (error) {
    if (destinationCreated) await rm(destination, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
