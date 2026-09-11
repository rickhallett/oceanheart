# Private Studio application release switching — HE-10

This operator-only lane switches an immutable Studio application artifact. It is deliberately separate from Clara configuration activation: it does not select instructions, clear durable workflow state, migrate a backend or replay an effect.

## Source and scope

The implementation branch was created in a clean registered worktree from verified remote `studio/dev` `4623380ce496bed9388b6e9ca5db1f60b9495c24`. The recorded accepted staging deployment was `dpl_7K3QP6tJoYGf9RU3dQagiUUGT84u`, custom `staging`, from that SHA. Those deployment fields are inherited provider evidence in the workspace receipt, not a fresh authenticated hosted check by this slice.

Artifacts contain only the production standalone Studio server, traced runtime dependencies, static output and public assets. The packager requires the requested source SHA to be the checked-out HEAD, verifies the exact `studio` tree SHA, rejects application changes outside `studio/bench`, removes mutable build cache, hashes every payload path and byte, and seals the payload read-only. The manifest records:

- `clientId`, full `sourceSha`, exact `studioTreeSha`, `artifactDigest` and version;
- pinned Node and Next versions;
- explicit data `schemaVersion`, `dataTarget` and compatible change class; and
- an application HTTP health contract.

No command comes from the artifact manifest. The runtime always launches the fixed standalone `server.js` with Node, a minimal environment and `127.0.0.1` listeners. This local adapter provides no public ingress, credentials, backend configuration, migration, provider call or external effect.

## Build and operate

Build Studio without configuration, then package it from the repository root and exact Git identity:

```sh
NEXT_PRIVATE_STANDALONE=1 NEXT_TELEMETRY_DISABLED=1 npm run build
npm run app-release -- package \
  --repository-root /path/to/oceanheart --studio-root /path/to/oceanheart/studio \
  --destination /private/releases/1.1.0 --client clara-synthetic \
  --source-sha FULL_SHA --studio-tree STUDIO_TREE_SHA --version 1.1.0 \
  --schema synthetic-v1 --data-target clara-private-synthetic \
  --health-path '/app?demo=1' --health-status 200 --health-contains 'oceanheart Studio'
```

Activation uses three explicit private ports: the stable router, the release wrapper and the standalone application. State and logs belong in a client-private directory:

```sh
npm run app-release -- activate \
  --state /private/state --client clara-synthetic \
  --manifest /private/releases/1.1.0/release-manifest.json \
  --router-port 43740 --public-port 43745 --application-port 43746

npm run app-release -- rollback \
  --state /private/state --client clara-synthetic --release EXACT_PRIOR_RELEASE_ID \
  --router-port 43740 --public-port 43747 --application-port 43748

npm run app-release -- stop --state /private/state --client clara-synthetic
```

The candidate must report its manifest-bound source, digest and data target and pass its Studio HTTP check before the fsync-backed active file is renamed. The stable router reads that pointer per request. A candidate failure produces an immutable failed receipt without changing the pointer. Successful activation is verified through the stable router before the prior owned process is stopped. Rollback must name the recorded exact prior release and must match both client and schema/data target; otherwise it fails closed. Only processes that answer with their task-owned random token are signalled.

## Bounded local evidence

The private synthetic proof used `127.0.0.1:43740` with distinct candidate/application ports and the unconfigured built Studio demo route. The previous release remained a 200 response with a 62,122-byte rendered page while a deliberately impossible candidate health contract failed. A compatible candidate then became generation 2, and exact-prior rollback restored generation 3. The stable metadata endpoint reported the full source SHA, SHA-256 artifact digest and `clara-private-synthetic` target after both switches. Artifact verification still matched after runtime use, and all owned processes were stopped.

Receipts and HTTP headers are under `/tmp/oceanheart-he10-hale-20260911-final/`. This is local process/HTTP evidence, not private-VM, staging, authenticated practitioner or production acceptance. The proof's two accepted release records use different immutable versions of the same compiled payload digest; focused controller tests also exercise different payload digests. HE-12 backup/restore and infrastructure supervision remain Gates-owned work.
