#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const [rootArgument] = process.argv.slice(2);
if (!rootArgument) throw new Error("Usage: verify-pi-install.ts <bench-root>");
const root = resolve(rootArgument);
const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8"));
const lockRaw = await readFile(`${root}/package-lock.json`);
const lock = JSON.parse(lockRaw.toString("utf8"));
const names = ["@earendil-works/pi-coding-agent", "@earendil-works/pi-ai"];
const versions: Record<string, string> = {};
for (const name of names) {
  const requested = packageJson.dependencies?.[name];
  if (requested !== "0.85.1") throw new Error(`${name} is not pinned to 0.85.1`);
  const locked = lock.packages?.[`node_modules/${name}`];
  if (locked?.version !== requested || typeof locked.integrity !== "string")
    throw new Error(`${name} lock entry does not match its exact request`);
  const installed = JSON.parse(
    await readFile(`${root}/node_modules/${name}/package.json`, "utf8"),
  );
  if (installed.version !== requested) throw new Error(`${name} installed version mismatch`);
  versions[name] = installed.version;
}
process.stdout.write(
  `${JSON.stringify({
    valid: true,
    versions,
    packageLockSha256: createHash("sha256").update(lockRaw).digest("hex"),
  })}\n`,
);
