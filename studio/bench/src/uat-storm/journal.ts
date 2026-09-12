import { open, lstat, mkdir, readFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";

import { digest } from "./manifest.ts";
import type { StormOperation, StormStep } from "./types.ts";

export type StormEventKind =
  | "bound"
  | "action-intent"
  | "action-acknowledged"
  | "read-complete"
  | "write-uncertain"
  | "effect-present"
  | "effect-absent"
  | "effect-unknown"
  | "invariant-failed"
  | "run-complete"
  | "run-stopped"
  | "cleanup-complete"
  | "cleanup-failed";

export type StormEvent = {
  schemaVersion: 1;
  runId: string;
  sequence: number;
  previousHash: string;
  hash: string;
  at: string;
  epoch: number;
  kind: StormEventKind;
  step?: StormStep;
  actionId?: string;
  operation?: StormOperation;
  code?: string;
  manifestDigest?: string;
  runBindingDigest?: string;
  targetBindingDigest?: string;
  identityBindingDigest?: string;
  deadlineAt?: string;
  effectCount?: number;
  effectDigest?: string;
  receiptDigest?: string;
  resultDigest?: string;
  totalMinor?: number;
  traceEvents?: number;
  configurationVersion?: string;
  configurationGeneration?: number;
};

export type EventFacts = Omit<StormEvent, "schemaVersion" | "runId" | "sequence" | "previousHash" | "hash" | "at">;

async function privatePath(path: string, kind: "directory" | "file") {
  const info = await lstat(path);
  const correctKind = kind === "directory" ? info.isDirectory() : info.isFile();
  if (!correctKind || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error("UNSAFE_JOURNAL_PATH");
}

export class StormJournal {
  readonly directory: string;
  readonly eventsPath: string;
  readonly events: StormEvent[];
  private readonly runId: string;
  private handle: Awaited<ReturnType<typeof open>>;
  private lock: Awaited<ReturnType<typeof open>> | undefined;

  private constructor(runId: string, directory: string, handle: Awaited<ReturnType<typeof open>>, events: StormEvent[]) {
    this.runId = runId;
    this.directory = directory;
    this.eventsPath = join(directory, "events.jsonl");
    this.handle = handle;
    this.events = events;
  }

  static async create(root: string, runId: string) {
    if (!/^[a-z][a-z0-9-]{2,63}$/.test(runId)) throw new Error("RUN_ID_INVALID");
    await mkdir(root, { recursive: true, mode: 0o700 });
    await privatePath(root, "directory");
    const directory = join(resolve(root), runId);
    await mkdir(directory, { mode: 0o700 });
    const handle = await open(join(directory, "events.jsonl"), "wx", 0o600);
    await handle.sync();
    return new StormJournal(runId, directory, handle, []);
  }

  static async resume(root: string, runId: string) {
    if (!/^[a-z][a-z0-9-]{2,63}$/.test(runId)) throw new Error("RUN_ID_INVALID");
    const directory = join(resolve(root), runId);
    const eventsPath = join(directory, "events.jsonl");
    await privatePath(root, "directory");
    await privatePath(directory, "directory");
    await privatePath(eventsPath, "file");
    const raw = await readFile(eventsPath, "utf8");
    if (raw !== "" && !raw.endsWith("\n")) throw new Error("JOURNAL_TRUNCATED");
    let events: StormEvent[];
    try { events = raw.trimEnd() ? raw.trimEnd().split("\n").map((line) => JSON.parse(line) as StormEvent) : []; }
    catch { throw new Error("JOURNAL_CORRUPT"); }
    let previousHash = "genesis";
    for (const [index, event] of events.entries()) {
      const { hash, ...body } = event;
      if (event.schemaVersion !== 1 || event.runId !== runId || event.sequence !== index + 1 ||
        event.previousHash !== previousHash || digest(body) !== hash) throw new Error("JOURNAL_CORRUPT");
      previousHash = hash;
    }
    return new StormJournal(runId, directory, await open(eventsPath, "a", 0o600), events);
  }

  async claim() {
    this.lock = await open(join(this.directory, "coordinator.lock"), "wx", 0o600);
    const raw = await readFile(this.eventsPath, "utf8");
    if (raw !== this.events.map((event) => `${JSON.stringify(event)}\n`).join("")) throw new Error("JOURNAL_CHANGED");
  }

  async append(facts: EventFacts): Promise<StormEvent> {
    if (!this.lock) throw new Error("JOURNAL_NOT_CLAIMED");
    const body = {
      schemaVersion: 1 as const,
      runId: this.runId,
      sequence: this.events.length + 1,
      previousHash: this.events.at(-1)?.hash ?? "genesis",
      at: new Date().toISOString(),
      ...facts,
    };
    const event: StormEvent = { ...body, hash: digest(body) };
    await this.handle.writeFile(`${JSON.stringify(event)}\n`);
    await this.handle.sync();
    this.events.push(event);
    return event;
  }

  async close() {
    await this.handle.close();
    if (this.lock) {
      await this.lock.close();
      await unlink(join(this.directory, "coordinator.lock"));
      this.lock = undefined;
    }
  }
}
