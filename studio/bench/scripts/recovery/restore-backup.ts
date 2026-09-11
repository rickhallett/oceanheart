#!/usr/bin/env node
import { readRecoveryKey, restoreEncryptedBackup } from "../../src/recovery/backup.ts";

const [clientId, archivePath, destinationStateRoot, keyPath, ...options] = process.argv.slice(2);
if (!clientId || !archivePath || !destinationStateRoot || !keyPath) {
  throw new Error(
    "Usage: restore-backup.ts <client-id> <archive> <new-state-root> <recovery-key-file> [--application-schema <version> --data-target <target>]",
  );
}
const values = new Map<string, string>();
for (let index = 0; index < options.length; index += 2) {
  const name = options[index];
  const value = options[index + 1];
  if (!name || !value || !name.startsWith("--")) throw new Error("Invalid restore option");
  values.set(name, value);
}
const applicationSchema = values.get("--application-schema");
const dataTarget = values.get("--data-target");
if (Boolean(applicationSchema) !== Boolean(dataTarget)) {
  throw new Error("Both --application-schema and --data-target are required together");
}

const key = await readRecoveryKey(keyPath);
try {
  const receipt = await restoreEncryptedBackup({
    clientId,
    archivePath,
    destinationStateRoot,
    key,
    compatibility: {
      piVersion: "0.85.1",
      stateSchemaVersion: 1,
      ...(applicationSchema && dataTarget
        ? { application: { schemaVersion: applicationSchema, dataTarget } }
        : {}),
    },
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} finally {
  key.fill(0);
}
