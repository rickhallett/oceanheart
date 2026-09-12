import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { inspectClaraBaselineEffect } from "../../src/uat-storm/clara-oracle.ts";

async function stateFixture() {
  const root = await mkdtemp(join(tmpdir(), "storm-oracle-"));
  const configuration = join(root, "configurations", "c0001");
  await mkdir(configuration, { recursive: true });
  await writeFile(join(configuration, "active.json"), JSON.stringify({ version: "clara-2026-09-01", generation: 7 }));
  const database = new DatabaseSync(join(root, "jobs.sqlite"));
  database.exec("create table jobs(id text, json text); create table effects(job text, json text); create table traces(seq integer, job text, json text)");
  const actor = "actor:verified-c0001";
  const effect = {
    schemaVersion: 1, clientId: "c0001", draftId: "draft-baseline", totalMinor: 12000,
    lines: [{ amountMinor: 8000 }, { amountMinor: 4000 }], prepaidSessionIds: ["clara-session-2026-09-17"],
  };
  const add = (id: string) => {
    database.prepare("insert into jobs values(?,?)").run(id, JSON.stringify({
      id, clientId: "c0001", actor, status: "succeeded", result: { draftId: effect.draftId, totalMinor: 12000 },
    }));
    database.prepare("insert into effects values(?,?)").run(id, JSON.stringify(effect));
    const trace = database.prepare("insert into traces values(?,?,?)");
    for (let sequence = 1; sequence <= 22; sequence++) trace.run(sequence, id, "{}");
  };
  add("job-1");
  const runtimeActorDigest = `sha256:${createHash("sha256").update(actor).digest("hex")}` as const;
  return { root, database, add, runtimeActorDigest };
}

test("read-only Clara oracle returns one baseline effect without raw actor data", async () => {
  const fixture = await stateFixture();
  const result = await inspectClaraBaselineEffect({ stateRoot: fixture.root, clientId: "c0001",
    runtimeActorDigest: fixture.runtimeActorDigest });
  assert.equal(result.status, "present");
  assert.equal(result.count, 1);
  assert.equal(result.observation?.totalMinor, 12000);
  assert.equal(result.observation?.traceEvents, 22);
  assert.equal(JSON.stringify(result).includes("actor:verified"), false);
  fixture.database.close();
});

test("duplicate matching drafts remain an explicit invariant signal", async () => {
  const fixture = await stateFixture();
  fixture.add("job-2");
  const result = await inspectClaraBaselineEffect({ stateRoot: fixture.root, clientId: "c0001",
    runtimeActorDigest: fixture.runtimeActorDigest });
  assert.equal(result.status, "present");
  assert.equal(result.count, 2);
  assert.equal(result.observation, undefined);
  fixture.database.close();
});
