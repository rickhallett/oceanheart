#!/usr/bin/env node
import { readRecoveryKey, restoreEncryptedBackup } from "../../src/recovery/backup.ts";

const [clientId, archivePath, destinationStateRoot, keyPath] = process.argv.slice(2);
if (!clientId || !archivePath || !destinationStateRoot || !keyPath) {
  throw new Error(
    "Usage: restore-backup.ts <client-id> <archive> <new-state-root> <recovery-key-file>",
  );
}

const key = await readRecoveryKey(keyPath);
try {
  const receipt = await restoreEncryptedBackup({
    clientId,
    archivePath,
    destinationStateRoot,
    key,
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} finally {
  key.fill(0);
}
