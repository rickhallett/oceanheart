import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { exportStudioAtSha, verifyExport } from "../../src/provision/export.ts";

const execFile = promisify(execFileCallback);

async function git(cwd: string, ...args: string[]) {
  const result = await execFile("git", args, { cwd, encoding: "utf8" });
  return result.stdout.trim();
}

test("exports only the exact tracked Studio tree with immutable provenance", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "studio-export-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await mkdir(join(repo, "studio"), { recursive: true });
  await mkdir(join(repo, "website"), { recursive: true });
  await git(repo, "init", "-q");
  await git(repo, "config", "user.email", "synthetic@example.invalid");
  await git(repo, "config", "user.name", "Synthetic Test");
  await writeFile(join(repo, "studio", "app.ts"), "export const version = 1;\n");
  await writeFile(join(repo, "studio", ".env.example"), "MODEL_API_KEY=\n");
  await mkdir(join(repo, "studio", "bench", "test"), { recursive: true });
  await writeFile(
    join(repo, "studio", "bench", "test", "provider-fixture.ts"),
    'export const fake = "secretcanary provider fixture";\n',
  );
  await writeFile(join(repo, "website", "private-note.txt"), "not exported\n");
  await git(repo, "add", ".");
  await git(repo, "commit", "-qm", "first");
  const firstSha = await git(repo, "rev-parse", "HEAD");
  await writeFile(join(repo, "studio", "app.ts"), "export const version = 2;\n");
  await git(repo, "commit", "-qam", "second");

  const destination = join(root, "export");
  const receipt = await exportStudioAtSha({
    repositoryRoot: repo,
    sourceRepository: "oceanheart/synthetic",
    sourceSha: firstSha,
    destination,
    now: () => "2026-09-11T12:00:00.000Z",
  });
  assert.equal(await readFile(join(destination, "app.ts"), "utf8"), "export const version = 1;\n");
  await assert.rejects(readFile(join(destination, "website", "private-note.txt")));
  assert.equal((await verifyExport(destination, receipt)).sourceSha, firstSha);

  await writeFile(join(destination, "app.ts"), "tampered\n");
  await assert.rejects(verifyExport(destination, receipt), /digest mismatch/);
});

test("rejects tracked credential paths and recognizable secret material", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "studio-export-secret-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, "repo");
  await mkdir(join(repo, "studio"), { recursive: true });
  await git(repo, "init", "-q");
  await git(repo, "config", "user.email", "synthetic@example.invalid");
  await git(repo, "config", "user.name", "Synthetic Test");
  await writeFile(join(repo, "studio", ".env"), "TOKEN=not-even-a-real-token\n");
  await git(repo, "add", ".");
  await git(repo, "commit", "-qm", "secret path");
  const pathSha = await git(repo, "rev-parse", "HEAD");
  await assert.rejects(
    exportStudioAtSha({
      repositoryRoot: repo,
      sourceRepository: "oceanheart/synthetic",
      sourceSha: pathSha,
      destination: join(root, "path-export"),
    }),
    /secret-like path/,
  );

  await rm(join(repo, "studio", ".env"));
  await writeFile(join(repo, "studio", "config.txt"), "AUTH=Bearer secretcanarytoken123\n");
  await git(repo, "add", "-A");
  await git(repo, "commit", "-qm", "secret content");
  const contentSha = await git(repo, "rev-parse", "HEAD");
  await assert.rejects(
    exportStudioAtSha({
      repositoryRoot: repo,
      sourceRepository: "oceanheart/synthetic",
      sourceSha: contentSha,
      destination: join(root, "content-export"),
    }),
    /secret material/,
  );

  await rm(join(repo, "studio", "config.txt"));
  await mkdir(join(repo, "studio", "docs"), { recursive: true });
  const privateKeyHeader = ["-----BEGIN OPENSSH", "PRIVATE KEY-----"].join(" ");
  await writeFile(
    join(repo, "studio", "docs", "operator.md"),
    `${privateKeyHeader}\nsynthetic-but-recognizable\n`,
  );
  await git(repo, "add", "-A");
  await git(repo, "commit", "-qm", "credential in documentation");
  const documentationSha = await git(repo, "rev-parse", "HEAD");
  await assert.rejects(
    exportStudioAtSha({
      repositoryRoot: repo,
      sourceRepository: "oceanheart/synthetic",
      sourceSha: documentationSha,
      destination: join(root, "documentation-export"),
    }),
    /secret material.*docs\/operator\.md/,
  );
});
