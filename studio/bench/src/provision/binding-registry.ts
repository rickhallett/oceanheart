import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import type { BindingRegistryEntry } from "./binding-types.ts";
import { hashBindingRequest, validateBinding, validateBindingRequest } from "./binding-validation.ts";

export class BindingRegistryIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindingRegistryIntegrityError";
  }
}

async function syncDirectory(path: string) {
  const handle = await open(path, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

export class PrivateBindingRegistry {
  readonly root: string;

  constructor(root: string) {
    if (resolve(root) !== root || dirname(root) === root)
      throw new BindingRegistryIntegrityError("Binding registry root must be a specific absolute directory");
    this.root = root;
  }

  private assertClientId(clientId: string) {
    if (!/^c[0-9]{4,}$/.test(clientId))
      throw new BindingRegistryIntegrityError("Binding registry client ID is invalid");
  }

  private entryPath(clientId: string) {
    this.assertClientId(clientId);
    return join(this.root, `${clientId}.binding.json`);
  }
  private lockPath(clientId: string) {
    this.assertClientId(clientId);
    return join(this.root, `${clientId}.binding.lock`);
  }

  private async ensureRoot() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const metadata = await lstat(this.root);
    if (metadata.isSymbolicLink() || !metadata.isDirectory())
      throw new BindingRegistryIntegrityError("Binding registry root is not a private directory");
    await chmod(this.root, 0o700);
  }

  private validate(entry: BindingRegistryEntry, expectedClientId: string) {
    const states = new Set(["planned", "pending", "effect_uncertain", "failed", "ready"]);
    if (
      entry.schemaVersion !== 1 || entry.clientId !== expectedClientId ||
      !states.has(entry.state) ||
      !Number.isSafeInteger(entry.attempts) || entry.attempts < 0 ||
      !/^[0-9a-f]{64}$/.test(entry.operationId) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(entry.idempotencyKey) ||
      !Number.isFinite(Date.parse(entry.createdAt)) ||
      !Number.isFinite(Date.parse(entry.updatedAt))
    ) throw new BindingRegistryIntegrityError("Binding registry identity is invalid");
    const request = validateBindingRequest(entry.request);
    if (request.clientId !== expectedClientId || hashBindingRequest(request) !== entry.requestHash)
      throw new BindingRegistryIntegrityError("Binding registry request is invalid");
    if (entry.state === "ready") {
      if (!entry.binding) throw new BindingRegistryIntegrityError("Ready binding is missing");
      validateBinding(entry.binding, request);
    } else if (entry.binding) {
      throw new BindingRegistryIntegrityError("Unready binding cannot contain a ready value");
    }
    if (
      (entry.state === "effect_uncertain" && entry.failure?.code !== "BINDING_EFFECT_UNCERTAIN") ||
      (entry.state === "failed" && !["BINDING_CONFLICT", "BINDING_CREATE_REJECTED"].includes(entry.failure?.code ?? "")) ||
      ((entry.state === "planned" || entry.state === "pending" || entry.state === "ready") && entry.failure)
    ) throw new BindingRegistryIntegrityError("Binding registry failure state is invalid");
    return structuredClone(entry);
  }

  async read(clientId: string) {
    await this.ensureRoot();
    let content;
    try {
      const metadata = await lstat(this.entryPath(clientId));
      if (metadata.isSymbolicLink() || !metadata.isFile() || (metadata.mode & 0o077) !== 0)
        throw new BindingRegistryIntegrityError("Binding registry entry is not private");
      content = await readFile(this.entryPath(clientId), "utf8");
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    try { return this.validate(JSON.parse(content) as BindingRegistryEntry, clientId); }
    catch (error) {
      if (error instanceof BindingRegistryIntegrityError) throw error;
      throw new BindingRegistryIntegrityError("Binding registry content is invalid");
    }
  }

  async write(entry: BindingRegistryEntry) {
    await this.ensureRoot();
    this.validate(entry, entry.clientId);
    const destination = this.entryPath(entry.clientId);
    const temporary = `${destination}.tmp-${process.pid}-${randomUUID()}`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(`${JSON.stringify(entry, null, 2)}\n`); await handle.sync(); }
    finally { await handle.close(); }
    try { await rename(temporary, destination); await syncDirectory(dirname(destination)); }
    catch (error) { await rm(temporary, { force: true }); throw error; }
    await chmod(destination, 0o600);
  }

  async withClientLock<T>(clientId: string, operation: () => Promise<T>) {
    await this.ensureRoot();
    const path = this.lockPath(clientId);
    let handle;
    try { handle = await open(path, "wx", 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("BINDING_REGISTRY_BUSY");
      throw error;
    }
    try { return await operation(); }
    finally { await handle.close(); await rm(path, { force: true }); }
  }

  async modes(clientId: string) {
    const [directory, entry] = await Promise.all([stat(this.root), stat(this.entryPath(clientId))]);
    return { directory: directory.mode & 0o777, entry: entry.mode & 0o777 };
  }
}
