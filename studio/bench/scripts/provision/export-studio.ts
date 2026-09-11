#!/usr/bin/env node
import { exportStudioAtSha, verifyExport } from "../../src/provision/export.ts";

const [repositoryRoot, sourceRepository, sourceSha, destination] = process.argv.slice(2);
if (!repositoryRoot || !sourceRepository || !sourceSha || !destination)
  throw new Error(
    "Usage: export-studio.ts <repository-root> <owner/repository> <full-sha> <destination>",
  );
const receipt = await exportStudioAtSha({
  repositoryRoot,
  sourceRepository,
  sourceSha,
  destination,
});
await verifyExport(destination, receipt);
process.stdout.write(`${JSON.stringify(receipt)}\n`);
