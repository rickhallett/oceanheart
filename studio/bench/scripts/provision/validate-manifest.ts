#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashManifest, validateManifest } from "../../src/provision/manifest.ts";

const [path] = process.argv.slice(2);
if (!path) throw new Error("Usage: validate-manifest.ts <manifest.json>");
const manifest = validateManifest(JSON.parse(await readFile(resolve(path), "utf8")));
process.stdout.write(
  `${JSON.stringify({ valid: true, clientId: manifest.clientId, manifestHash: hashManifest(manifest) })}\n`,
);
