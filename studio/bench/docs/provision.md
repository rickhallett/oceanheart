# Studio bench provisioning packet

Status: local implementation evidence for RIC-136, 11 September 2026. This packet does not create a repository, VM, backend, identity, secret, deployment or release.

## Delivered boundary

The standalone TypeScript modules in `src/provision` provide:

- strict schema-v1 validation for synthetic, opaque client manifests, including client-scoped repository, runtime, backend and `secretref` values;
- canonical manifest hashes and stable per-resource idempotency keys;
- a private filesystem registry (directory `0700`, receipts `0600`, atomic replacement and one client lock);
- reconcile-before-create provisioning through an injected provider interface;
- fail-closed crash recovery: `pending` and `uncertain` effects cannot be recreated after a non-authoritative absence result;
- controller-owned durable errors so provider detail and secret canaries are not persisted;
- exact-SHA export of the tracked `studio/` tree, with secret-like tracked paths, links and submodules rejected, and immutable provenance verified without modifying the export;
- pure release and rollback plans that become ready only after provider inspection confirms the exact artifact digest; and
- a read-only exe.dev capacity assessment. `fitsObservedLimits` is evidence only, never permission or proof that provisioning is executable.

There is deliberately no live provider adapter. `ProvisionController` cannot affect a provider without an explicitly injected implementation. Release helpers emit plans and verify observations; they do not deploy or switch traffic.

## Local commands

Run the focused contracts with Node 24:

```sh
cd studio/bench
node --test test/provision/*.test.ts
npx tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --strict --allowImportingTsExtensions --skipLibCheck src/provision/*.ts test/provision/*.ts scripts/provision/*.ts
```

Validate a candidate manifest without contacting a provider:

```sh
node studio/bench/scripts/provision/validate-manifest.ts /absolute/path/manifest.json
```

Export and immediately verify an accepted Studio source revision into a destination outside the source repository:

```sh
node studio/bench/scripts/provision/export-studio.ts \
  /absolute/path/oceanheart \
  rickhallett/oceanheart \
  <full-accepted-sha> \
  /absolute/private/output/studio
```

The export includes tracked test fixtures, which may contain explicitly synthetic canary strings. It rejects credential-bearing path names and recognizable private keys or live-token forms everywhere, including documentation and tests. Canary strings are tolerated only in recognizable test/documentation paths. `.env.example` is allowed as a value-free configuration template. This is a repository export guard, not a substitute for a dedicated secret scanner or artifact review before a real-client release.

Bootstrap a clean Ubuntu 24.04 x86-64 guest as either a runtime or builder:

```sh
sudo studio/bench/scripts/provision/bootstrap-node24.sh runtime
sudo studio/bench/scripts/provision/bootstrap-node24.sh builder
```

The idempotent script installs checksum-pinned Node `24.20.0`, creates a role-specific unprivileged service user and private state directories, and adds build tooling only to builders. It accepts no secrets. After installing the bench package from an exact-SHA export, verify the pinned Pi dependency and run the offline synthetic adapter smoke with:

```sh
node studio/bench/scripts/provision/verify-pi-install.ts /absolute/path/to/studio/bench
sudo -u studio-runtime node studio/bench/scripts/provision/remote-pi-smoke.ts \
  c0001 /var/lib/studio-pi-runtime/c0001
```

Create a non-executable plan from a separately captured read-only capacity snapshot:

```sh
node studio/bench/scripts/provision/plan-live.ts \
  /absolute/path/manifest.json \
  /absolute/private/path/exedev-capacity.json
```

`plan-live` always reports `executable:false` in this packet. It lists unresolved provider, repository, backend/identity, image and acceptance prerequisites rather than inferring readiness from quota.

## Exact export evidence

The exporter was exercised against accepted Studio source `8a0003a43fea562a5488124f5d131b93fe34b93a` from `rickhallett/oceanheart`:

- Studio tree: `47c17894623dbcfefce83983f267d11951ff4cd0`
- content digest: `sha256:1e59fb5e6043b2f8409d442f10935823e0273b6245b58c030d05d47a2622b806`
- tracked files: 281; bytes: 2,262,231
- isolated `npm ci`: passed with zero vulnerabilities reported
- isolated, environment-cleared `npm run build`: passed; Next.js 16.3.4 compiled, typechecked and generated all routes

The disposable build directory was under `/tmp`; it is evidence of source portability, not a release artifact or hosted acceptance.

## Read-only exe.dev finding

Current account inspection found enough shared CPU, memory, VM-count and disk headroom for a bounded three-host pilot after authorized idle-spare cleanup. Clean Ubuntu 24.04 guests provide tar, SHA-256 tooling and systemd but require the checksum-pinned Node bootstrap above. Capacity fit is a point-in-time observation, not approval authority or practitioner readiness. Detailed inventory, host identifiers and usage receipts are retained privately rather than in this repository.

The private pilot uses clean images and operator-only access; it does not clone workers, expose public shares, configure credentials or change the subscription. Its remote runtime evidence is recorded separately from this reusable packet.

## Executable next live-synthetic plan

The next operator-owned packet should proceed only after the concrete blockers are resolved, using the same manifest and original operation key throughout:

1. Capture a fresh read-only exe.dev inventory and decide how the existing disk overage is handled without assuming new spend or capacity.
2. Approve a private synthetic repository target and an isolated synthetic backend/identity target. Confirm neither resolves to staging or production.
3. Build a secret-free Node 24 image or a checksum-pinned bootstrap in a disposable existing environment; verify Pi `0.85.1`, Studio build/start and service supervision.
4. Implement an exe.dev adapter whose `reconcileResource` uses authoritative provider IDs/ownership metadata and whose create operation reports only explicit pre-effect rejection as retryable. Timeouts, transport loss, malformed responses and persisted `pending` receipts remain uncertain.
5. Run `plan-live`; inspect that it remains non-executable until the controller has explicit readiness inputs rather than only quota data.
6. In one bounded synthetic run, reconcile then create the private repository, runtime VM, development VM and synthetic backend. Persist each returned provider ID; never derive SSH identity from a requested name.
7. Bootstrap from the verified export by digest with no secrets in arguments, images, Git or receipts. Add scoped references only after the secret resolver boundary exists.
8. Prove HE-01 (timeout/retry creates no duplicate), HE-06 (canary absent from every durable surface) and HE-10 (exact digest, failed release leaves prior serving, compatible rollback). Inspect provider state independently before marking ready.
9. Record usage delta and tear-down/retention ownership. Do not generalize one synthetic result to real-client readiness.

Database impact in this packet: none. Hosted/provider acceptance: not run and not claimed.
