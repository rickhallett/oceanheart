import { randomUUID } from "node:crypto";
import {
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { hashManifest, validateManifest } from "./manifest.ts";
import type { RegistryEntry } from "./types.ts";

export class RegistryBusyError extends Error {
  constructor(clientId: string) {
    super(`Provisioning is already locked for ${clientId}`);
    this.name = "RegistryBusyError";
  }
}

export class RegistryIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryIntegrityError";
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class FileRegistry {
  readonly root: string;

  constructor(root: string) {
    if (!root.startsWith("/"))
      throw new RegistryIntegrityError("Registry root must be an absolute private path");
    this.root = root;
  }

  private entryPath(clientId: string) {
    return join(this.root, `${clientId}.json`);
  }

  private lockPath(clientId: string) {
    return join(this.root, `${clientId}.lock`);
  }

  private async ensureRoot() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await chmod(this.root, 0o700);
  }

  async read(clientId: string): Promise<RegistryEntry | undefined> {
    await this.ensureRoot();
    let raw: string;
    try {
      raw = await readFile(this.entryPath(clientId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    let candidate: RegistryEntry;
    try {
      candidate = JSON.parse(raw) as RegistryEntry;
    } catch {
      throw new RegistryIntegrityError(`Registry entry for ${clientId} is not valid JSON`);
    }
    if (candidate.schemaVersion !== 1 || candidate.clientId !== clientId)
      throw new RegistryIntegrityError(`Registry entry identity mismatch for ${clientId}`);
    const manifest = validateManifest(candidate.manifest);
    if (hashManifest(manifest) !== candidate.manifestHash)
      throw new RegistryIntegrityError(`Registry manifest hash mismatch for ${clientId}`);
    return clone(candidate);
  }

  async write(entry: RegistryEntry): Promise<void> {
    await this.ensureRoot();
    if (entry.clientId !== entry.manifest.clientId)
      throw new RegistryIntegrityError("Registry and manifest client identities differ");
    const manifest = validateManifest(entry.manifest);
    if (hashManifest(manifest) !== entry.manifestHash)
      throw new RegistryIntegrityError("Refusing to persist a mismatched manifest hash");
    const destination = this.entryPath(entry.clientId);
    const temporary = `${destination}.tmp-${process.pid}-${randomUUID()}`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(entry, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, destination);
    await chmod(destination, 0o600);
  }

  async withClientLock<T>(clientId: string, operation: () => Promise<T>): Promise<T> {
    await this.ensureRoot();
    const path = this.lockPath(clientId);
    let handle;
    try {
      handle = await open(path, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new RegistryBusyError(clientId);
      throw error;
    }
    try {
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`,
        "utf8",
      );
      await handle.sync();
      return await operation();
    } finally {
      await handle.close();
      await rm(path, { force: true });
    }
  }

  async modes(clientId: string) {
    const [directory, entry] = await Promise.all([
      stat(this.root),
      stat(this.entryPath(clientId)),
    ]);
    return {
      directory: directory.mode & 0o777,
      entry: entry.mode & 0o777,
    };
  }
}
