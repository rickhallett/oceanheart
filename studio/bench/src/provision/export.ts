import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";

const execFile = promisify(execFileCallback);
const fullSha = /^[0-9a-f]{40}$/;
const repositorySlug = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const secretPath =
  /(^|\/)(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?)$|\.(?:pem|key|p12|pfx|sqlite|sqlite3|db)$/i;
const credentialMaterial =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:sk|rk)_live_[A-Za-z0-9]+|\bgh[pousr]_[A-Za-z0-9]+|\bgithub_pat_[A-Za-z0-9_]+/i;
const syntheticCanaryMaterial = /\bsecret[-_ ]?canary[A-Za-z0-9._~-]*/i;
const explicitSyntheticCredential = /\b(?:sk|rk)_live_forbidden\b/gi;

export const studioExporterVersion = "1.0.0";

export type ExportProvenance = {
  schemaVersion: 1;
  exporterVersion: string;
  sourceRepository: string;
  sourceSha: string;
  studioTreeSha: string;
  contentDigest: string;
  fileCount: number;
  totalBytes: number;
  exportedAt: string;
};

type ExportOptions = {
  repositoryRoot: string;
  sourceRepository: string;
  sourceSha: string;
  destination: string;
  now?: () => string;
};

async function output(command: string, args: string[], cwd: string) {
  const result = await execFile(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return result.stdout.trim();
}

async function assertMissing(path: string) {
  try {
    await access(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Export destination already exists: ${path}`);
}

async function archiveStudio(repositoryRoot: string, sourceSha: string, destination: string) {
  await new Promise<void>((resolvePromise, reject) => {
    const archive = spawn("git", ["archive", "--format=tar", sourceSha, "studio"], {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const extract = spawn(
      "tar",
      ["-xf", "-", "-C", destination, "--strip-components", "1"],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let archiveError = "";
    let extractError = "";
    archive.stderr.on("data", (chunk) => (archiveError += String(chunk)));
    extract.stderr.on("data", (chunk) => (extractError += String(chunk)));
    archive.on("error", reject);
    extract.on("error", reject);
    archive.stdout.pipe(extract.stdin);
    let archiveExit: number | null = null;
    let extractExit: number | null = null;
    const finish = () => {
      if (archiveExit === null || extractExit === null) return;
      if (archiveExit !== 0 || extractExit !== 0)
        reject(
          new Error(
            `Studio archive failed (git ${archiveExit}, tar ${extractExit}): ${archiveError || extractError}`,
          ),
        );
      else resolvePromise();
    };
    archive.on("close", (code) => {
      archiveExit = code;
      finish();
    });
    extract.on("close", (code) => {
      extractExit = code;
      finish();
    });
  });
}

function isSecretLikePath(path: string) {
  return path !== ".env.example" && secretPath.test(path);
}

async function digestDirectory(
  root: string,
  ignoredPaths: ReadonlySet<string> = new Set(),
) {
  const paths: string[] = [];
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        const path = relative(root, absolute).split(sep).join("/");
        if (!ignoredPaths.has(path)) paths.push(path);
      }
      else throw new Error(`Unsupported exported entry: ${relative(root, absolute)}`);
    }
  }
  await walk(root);
  const hash = createHash("sha256");
  let totalBytes = 0;
  for (const path of paths) {
    const content = await readFile(join(root, path));
    const canContainSyntheticCanary =
      /(^|\/)tests?\//.test(path) || /(^|\/)docs?\//.test(path) || path.endsWith(".md");
    const text = content.toString("utf8");
    const credentialScanText = canContainSyntheticCanary
      ? text.replace(explicitSyntheticCredential, "")
      : text;
    if (
      credentialMaterial.test(credentialScanText) ||
      (!canContainSyntheticCanary && syntheticCanaryMaterial.test(text))
    )
      throw new Error(`Export rejects secret material in tracked file: ${path}`);
    totalBytes += content.length;
    hash.update(`${Buffer.byteLength(path)}:${path}:${content.length}:`);
    hash.update(content);
  }
  return {
    contentDigest: `sha256:${hash.digest("hex")}`,
    fileCount: paths.length,
    totalBytes,
  };
}

export async function exportStudioAtSha(options: ExportOptions): Promise<ExportProvenance> {
  if (!fullSha.test(options.sourceSha)) throw new Error("sourceSha must be a full lowercase Git SHA");
  if (!repositorySlug.test(options.sourceRepository))
    throw new Error("sourceRepository must be an owner/repository slug");
  const repositoryRoot = resolve(options.repositoryRoot);
  const destination = resolve(options.destination);
  if (destination === repositoryRoot || destination.startsWith(`${repositoryRoot}${sep}`))
    throw new Error("Export destination must be outside the source repository");
  await assertMissing(destination);
  const actualRoot = await output("git", ["rev-parse", "--show-toplevel"], repositoryRoot);
  if ((await realpath(actualRoot)) !== (await realpath(repositoryRoot)))
    throw new Error("repositoryRoot must identify the Git worktree root exactly");
  const resolvedSha = await output(
    "git",
    ["rev-parse", "--verify", `${options.sourceSha}^{commit}`],
    repositoryRoot,
  );
  if (resolvedSha !== options.sourceSha)
    throw new Error("sourceSha did not resolve to the exact requested commit");
  const studioTreeSha = await output(
    "git",
    ["rev-parse", "--verify", `${options.sourceSha}:studio`],
    repositoryRoot,
  );
  const tree = await output(
    "git",
    ["ls-tree", "-r", options.sourceSha, "studio"],
    repositoryRoot,
  );
  const paths = tree
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = /^(\d+)\s+\w+\s+[0-9a-f]+\t(.+)$/.exec(line);
      if (!match) throw new Error("Unexpected Git tree output");
      return { mode: match[1], path: match[2] };
    });
  if (!paths.length) throw new Error("The requested commit has no tracked studio tree");
  for (const entry of paths) {
    if (entry.mode === "120000" || entry.mode === "160000")
      throw new Error(`Export rejects links and submodules: ${entry.path}`);
    const relativePath = entry.path.replace(/^studio\//, "");
    if (isSecretLikePath(relativePath))
      throw new Error(`Export rejects tracked secret-like path: ${entry.path}`);
  }

  const parent = dirname(destination);
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, `.${basename(destination)}-${randomUUID()}-`));
  try {
    await archiveStudio(repositoryRoot, options.sourceSha, temporary);
    const digest = await digestDirectory(temporary);
    if (digest.fileCount !== paths.length)
      throw new Error("Exported file count does not match the tracked Studio tree");
    const provenance: ExportProvenance = {
      schemaVersion: 1,
      exporterVersion: studioExporterVersion,
      sourceRepository: options.sourceRepository,
      sourceSha: options.sourceSha,
      studioTreeSha,
      ...digest,
      exportedAt: (options.now ?? (() => new Date().toISOString()))(),
    };
    await writeFile(
      join(temporary, "studio-export-provenance.json"),
      `${JSON.stringify(provenance, null, 2)}\n`,
      { encoding: "utf8", mode: 0o644, flag: "wx" },
    );
    await rename(temporary, destination);
    return provenance;
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyExport(destination: string, expected: ExportProvenance) {
  const root = resolve(destination);
  const provenance = JSON.parse(
    await readFile(join(root, "studio-export-provenance.json"), "utf8"),
  ) as ExportProvenance;
  const digest = await digestDirectory(
    root,
    new Set(["studio-export-provenance.json"]),
  );
  if (
    JSON.stringify(provenance) !== JSON.stringify(expected) ||
    digest.contentDigest !== expected.contentDigest ||
    digest.fileCount !== expected.fileCount ||
    digest.totalBytes !== expected.totalBytes
  )
    throw new Error("Export provenance or content digest mismatch");
  return provenance;
}
