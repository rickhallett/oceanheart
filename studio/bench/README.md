# Studio bench

A local operator CLI for the dedicated Studio harness pilot. It uses Pi 0.85.1 with an explicit invoice tool, fictional Clara records and a deterministic in-process model transport. The package is separate from the Studio application and its backend.

## Start

Use Node.js 24 or later:

```sh
cd studio/bench
npm ci
npm run bench -- --help
npm run bench -- run clara --fixture CL-01
npm run bench -- inspect c-clara-synthetic
npm run bench -- eval clara
npm run bench -- adapt clara --fixture CL-09 --effective-date 2026-10-01 --new-rate-minor 9000
# Use the previousReleaseId from that receipt:
npm run bench -- rollback clara --release RELEASE_ID
```

`run` records the request before execution and returns the result plus a private JSON trace path. Repeating the same fixture/configuration request reuses its idempotency key and durable draft. `waiting_for_input` is an expected result when attendance or an agreed rate is unknown. `eval` isolates each case/configuration in a fresh run directory and writes a comparison report with local trace links.

State defaults to `~/.local/state/oceanheart-bench`. Use `--state-dir` to select a task-owned directory. Keep it and generated reports outside Git. `inspect` reads existing metadata without creating a state directory. A run does not send an invoice or collect money.

`adapt` evaluates the reviewed Clara baseline and scoped rate-change configuration in fresh, independent evaluation state. It writes the existing JSON/HTML comparison report, then atomically activates the digest-addressed configuration only when all cases pass. Ordinary `run` uses the active version while retaining the existing durable jobs, drafts and session reservations; an already-drafted session therefore still fails closed under a different configuration. `rollback` accepts only the exact compatible prior release ID and switches the configuration pointer without clearing or replaying runtime effects.

## Template and resource planning

```sh
npm run bench -- plan /absolute/path/to/synthetic-manifest.json
npm run bench -- export-template \
  --source-repo /absolute/path/to/oceanheart-worktree \
  --sha FULL_ACCEPTED_SOURCE_SHA \
  --output-dir /absolute/path/to/new-template-directory
```

The plan command validates a secret-reference-only manifest and lists resource operations. It does not allocate resources. The exporter reads an exact committed Studio tree, preserves source provenance and rejects an existing destination. Neither command deploys the application.

## Checks and evidence

```sh
npm run typecheck
npm test
```

Read [implementation status](docs/IMPLEMENTATION-STATUS.md) for source provenance and the overall evidence boundary, and [runtime notes](docs/runtime.md) for adapter capabilities and limits. The full environment requirements remain in [the specification](../docs/HARNESS-ENVIRONMENT-SPEC.md).

The synthetic transport exercises the real Pi session and tool path. It does not measure an inference provider's quality, cost or availability. Hosted client isolation, actual credential rotation, provider provisioning, backup restoration and production release require their own evidence. The initial bench does not change the Studio UI or existing Convex schema/functions.
