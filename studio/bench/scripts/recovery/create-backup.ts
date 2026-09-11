#!/usr/bin/env node
import { createEncryptedBackup, readRecoveryKey } from "../../src/recovery/backup.ts";

const [clientId, stateRoot, archivePath, keyPath] = process.argv.slice(2);
if (!clientId || !stateRoot || !archivePath || !keyPath) {
  throw new Error(
    "Usage: create-backup.ts <client-id> <state-root> <off-state-root-archive> <recovery-key-file>",
  );
}

const key = await readRecoveryKey(keyPath);
try {
  const receipt = await createEncryptedBackup({ clientId, stateRoot, archivePath, key });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} finally {
  key.fill(0);
}
