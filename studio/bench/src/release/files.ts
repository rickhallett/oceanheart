import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

export async function readJson<T>(path: string): Promise<T | undefined> {
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

export async function atomicWriteJson(path: string, value: unknown) {
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

export async function writeImmutableJson(path: string, value: unknown) {
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

export async function withFileLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  let handle;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      handle = await open(path, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      let stale = false;
      try {
        const lock = JSON.parse(await readFile(path, "utf8")) as { pid?: number };
        if (Number.isSafeInteger(lock.pid) && (lock.pid ?? 0) > 0) {
          try { process.kill(lock.pid!, 0); }
          catch (probe) { stale = (probe as NodeJS.ErrnoException).code === "ESRCH"; }
        } else stale = Date.now() - (await stat(path)).mtimeMs > 30_000;
      } catch { stale = Date.now() - (await stat(path)).mtimeMs > 30_000; }
      if (!stale) throw new Error("APPLICATION_RELEASE_BUSY");
      await rm(path, { force: true });
      continue;
    }
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, at: new Date().toISOString() })}\n`);
    await handle.sync();
    break;
  }
  if (!handle) throw new Error("APPLICATION_RELEASE_BUSY");
  try { return await operation(); }
  finally {
    try { await handle.close(); }
    finally { await rm(path, { force: true }); }
  }
}
