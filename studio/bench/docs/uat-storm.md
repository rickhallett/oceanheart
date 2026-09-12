# Bounded c0001 UAT storm engine

This is a single-workflow operator harness, not a load platform. It runs one fixed fictional Clara journey against an exact private c0001 release:

1. inspect the active baseline;
2. prepare the September invoice draft;
3. inspect the durable draft;
4. retry the same release-safe request; and
5. inspect again and require the same single effect.

The pilot permits at most five actions and 180 seconds. Model decisions, model cost, provider calls and faults are fixed at zero. Production origins and the production Convex deployment are rejected. No command accepts browser selectors, task text, credentials, client IDs or arbitrary operations from a model or manifest.

## Evidence and execution boundary

A live manifest is executable only when `enabled:true` and five private receipts—authorization, target, operator identity, lease and read-only oracle—are regular mode-0600 files whose SHA-256 and typed binding digest match the manifest. The lease binds an exact operator-owned Chrome tab/session handoff. Kai is the operator acting on fictional c0001 data; the harness does not invent a synthetic user or clone a browser profile.

The engine connects only to a mode-0600 Unix socket inside a mode-0700 directory. The operator broker owns the existing authenticated browser session, displays one typed pending action, and accepts a schema-checked result record. Browser observation and the independently obtained read-only durable oracle result remain distinct. No cookie, bearer token, WorkOS key or browser profile crosses the socket contract.

The current evidence class is `hosted-operator-driven`. It is not autonomous browser, load, persona, accessibility or real-user proof. A future unattended adapter must separately establish its own dedicated-profile boundary; this pilot does not claim one.

## Broker protocol

Each connection carries one newline-delimited JSON request and one response, each at most 64KiB.

- Request envelope: `{schemaVersion:1,requestId,kind}`.
- `perform` adds `action` with a fixed step/command from the journey above.
- `oracle` adds only `effectKey:"clara-c0001-september-invoice"`.
- Success: `{schemaVersion:1,requestId,ok:true,result}`.
- Failure: `{schemaVersion:1,requestId,ok:false,code}`. Free-form error bodies are ignored.

`inspect.result` supplies exact target, identity, oracle, lease and operator-session binding digests plus `executionMode:"hosted-operator-driven"`, `operatorSession:true`, `operatorControl:true`, `fictionalDataOnly:true`. `perform.result` is `{acknowledged:true,observation?}`. `oracle.result` is `{status,count,effectDigest,receiptDigest,observation?}`. Observations contain only configuration version/generation, fictional draft ID, total minor units and trace-event count.

## Recovery

`events.jsonl` is mode 0600, hash-chained and fsynced after every append. A write intent is durable before the broker sees it. A lost acknowledgement becomes uncertain and invokes the oracle; it is never blindly replayed. `present/count=1` may advance, duplicates are an invariant failure, and absent or unknown stops the run for operator disposition. Resume requires the same run/target/identity/oracle/budget binding, a higher lease epoch and the original deadline. A pending write is reconciled before any later step.

Reports are factual, retain partial runs, and are immutable per lease epoch (`report-epoch-N.json` and `.md`). Outcomes are `complete`, `policy_blocked`, `harness_failure`, `effect_uncertain` or `invariant_failed`. Fixture reports always say `fixture`; they can test the engine but never establish hosted behavior.

## Commands

From `studio/bench` on Node 24:

```sh
node scripts/uat-storm/run.ts fixture --run fixture-one --artifacts /private/uat-storm
node scripts/uat-storm/run.ts validate --manifest /private/uat-storm/live-manifest.json
node scripts/uat-storm/run.ts live --manifest /private/uat-storm/live-manifest.json \
  --artifacts /private/uat-storm --socket /private/operator-broker/operator.sock \
  --response-timeout-ms 180000
node scripts/uat-storm/run.ts live --resume --manifest /private/uat-storm/resume-manifest.json \
  --artifacts /private/uat-storm --socket /private/operator-broker/operator.sock \
  --response-timeout-ms 180000
```

The committed example remains disabled. Private run artifacts and real evidence receipts stay outside Git under the canonical operations vault.

## Selective legacy provenance

The older `/Users/oai/work/oceanheart/uat-storm` checkout remains owned by `wZ:p1`, dirty and untouched at `docs/uat-storm-design` `9c4a0ed10077dd794ab512f5aec5f0286e51794b`. This implementation did not merge or copy that tree wholesale. It selectively reimplemented these reviewed ideas in strict TypeScript on accepted `studio/dev` `430c09d538b4721f499852fe1002b43ef8b82941`:

- fsynced hash-chain journal and uncertain-write reconciliation from legacy `runtime.mjs` SHA-256 `3663ee7a5051114bef13b02535bb13adc9065f52de245b61421751b3f52d52c9`;
- live-evidence fail-closed gates from `preflight.mjs` SHA-256 `83836bc51e43f214c00dee96c7e55867b12db4b5bace5a3069df24aa80efc853`;
- closed driver/oracle boundary from `worker-adapter.mjs` SHA-256 `795e0a04ccaed97f53870ba188cf138515362a9f142d0f94c676a5f697d8c601`; and
- evidence language from `EVIDENCE.md` SHA-256 `a5993261c1e755a588462a7098b7bc25eec5d17b12d7c3a08f48500f077dd13d`.

The old staging task recipe, three-persona plan, fault scheduler, workerctl lease code and disabled pilot manifest were not imported. Their target and identity assumptions are stale for this c0001 operator pilot.
