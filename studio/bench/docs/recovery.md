# Durable state backup and restore

The HE-12 packet creates a client-bound, AES-256-GCM authenticated archive of the durable Pi state, the SQLite effect ledger, Clara configuration activation records and any client-scoped application-release records. The archive and its separate 32-byte recovery key are private operator material and stay outside Git.

## Consistency and replay boundary

The backup uses SQLite's online backup API, so committed WAL content is included and a concurrent database writer causes SQLite to restart the copy rather than produce a torn database. The resulting database must pass `PRAGMA integrity_check`; every job, reservation and trace must belong to the requested client, and orphaned effects or references are rejected.

Configuration and application release activation locks are held while their immutable records and active pointers are copied. Pi session files are read through no-follow file descriptors and rejected if they change during the read. The SQLite effect and reservation tables remain the authority: a restored completed request returns its original receipt without invoking Pi or creating another draft.

Archives include only:

- `jobs.sqlite`, normalized so saved Pi session paths are portable;
- `<clientId>/` Pi session state;
- `configurations/<clientId>/` Clara artifacts, releases, rollbacks and active pointer; and
- `application-releases/<clientId>/` controller state and receipts when present. Immutable application payloads are not recovery state and must be rebuilt or recovered separately from their exact source/digest.

Locks, temporary files, WAL sidecars and supervisor logs are excluded. Each included file has a size and SHA-256 digest; the manifest binds the format version, client, Pi version, state schema, database counts and active configuration. If application release state exists, backup verifies the referenced immutable artifact and records its client, source SHA, Studio tree, digest, version, runtime, data schema and target for both active and prior releases. Restore authenticates and validates the complete archive in a private temporary directory, rebases session paths, and creates only a previously absent destination. Corrupt, wrong-client, incompatible or existing-state targets fail closed.

## Operator commands

Use a raw 32-byte recovery-key file with mode `0600`; do not pass key material in arguments or store it beside the archive as the sole copy.

```sh
cd studio/bench
node scripts/recovery/create-backup.ts \
  c0001 /var/lib/studio-pi-runtime/c0001 \
  /private/off-vm/c0001.ohbackup /private/keys/c0001-recovery.key

node scripts/recovery/restore-backup.ts \
  c0001 /private/off-vm/c0001.ohbackup \
  /var/lib/studio-pi-runtime/c0001-restored /private/keys/c0001-recovery.key \
  --application-schema synthetic-v1 --data-target c0001-private-state
```

Keep the source task stopped for the full filesystem-consistency boundary when possible. The online SQLite backup remains safe with a concurrent database writer, but arbitrary application code that ignores the activation locks can still change non-database files and make the operation fail. A successful restore is not permission to start services: process IDs and absolute artifact paths in an archived HE-10 pointer describe the former host. Rebuild or recover the exact immutable payload, then explicitly activate it against the validated client/schema/data target. Never start the restored controller state as if it were a live process record.

No Studio application database migration is involved. This packet does not back up a managed backend, identity-provider configuration or external provider state.
