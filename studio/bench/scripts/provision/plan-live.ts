#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assessExeCapacity } from "../../src/provision/capacity.ts";
import { hashManifest, validateManifest } from "../../src/provision/manifest.ts";

const [manifestPath, capacityPath] = process.argv.slice(2);
if (!manifestPath || !capacityPath)
  throw new Error("Usage: plan-live.ts <manifest.json> <read-only-capacity.json>");
const manifest = validateManifest(
  JSON.parse(await readFile(resolve(manifestPath), "utf8")),
);
const capacity = assessExeCapacity(
  JSON.parse(await readFile(resolve(capacityPath), "utf8")),
);
process.stdout.write(
  `${JSON.stringify({
    executable: false,
    clientId: manifest.clientId,
    manifestHash: hashManifest(manifest),
    capacity,
    unresolvedPrerequisites: [
      "injectable live provider adapter",
      "private repository authority and ownership reconciliation",
      "isolated synthetic backend and identity plan",
      "secret-free Node 24 image or verified bootstrap",
      "provider-inspected readiness and HE acceptance oracle",
    ],
    requiredSequence: [
      "export-and-build-exact-source",
      "reconcile-private-repository",
      "reconcile-runtime-vm",
      "reconcile-development-vm",
      "reconcile-synthetic-backend",
      "bootstrap-without-secrets",
      "inspect-provider-state",
      "run-HE-01-HE-06-HE-10",
    ],
  })}\n`,
);
