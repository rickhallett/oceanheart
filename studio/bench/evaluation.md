# Clara workflow evaluation

This is the initial synthetic, deterministic evaluation slice for the first Studio workbench integration. It implements the evaluation side of the section 9 contract: two versioned Clara workflow configurations run CL-01 through CL-08 through the **actual runtime workflow adapter**, not a substitute standalone prompt.

## Inputs and partitions

`fixtures/clara/` holds fixed-clock, fictional JSON fixtures. CL-01 through CL-08 are the fixed set; CL-09 is a separate adaptation case with independent expected totals. Every fixture carries the canonical `ClaraInput` passed to the runtime after the selected explicit rate policy, if any, plus eval expectations for exact minor-unit amounts, source IDs and allowed/prohibited effects. CL-08 explicitly replays the identical request twice and checks the same durable job is reused. Effects are structured local receipts only. A sent invoice, payment collection/charge, mailbox call, or model-provider call is prohibited.

`workflow-configurations.json` compares the baseline with `clara-2026-10-01-rate-change`. The candidate applies only the reviewed fixture policy. CL-09 totals GBP 230 at baseline and GBP 240 after adaptation; its historical GBP 80 session and negotiated GBP 70 agreement remain unchanged. The old eight cases retain their original expected results. This is a versioned local transformation, not a conversational UI or hosted release.

## Runtime path

`src/eval/promptfoo-clara-provider.ts` is a Promptfoo TypeScript custom provider. It directly constructs Silver's `PiWorkflowRuntime({ root })`, calls `startRun({ clientId, actor, idempotencyKey, input })`, calls `exportTrace`, and closes the runtime. There is no substitute prompt or dynamic adapter contract.

```ts
const startedAt = performance.now();
const job = await runtime.startRun(request);
const latencyMs = Math.round(performance.now() - startedAt);
```

Every provider invocation creates a fresh private execution directory, including uncached repeats; CL-08 is the deliberate same-key replay within one invocation. Relative runtime roots resolve under the operator state directory, not the Git checkout. Latency is measured around the actual runtime call. Cost remains a labelled zero estimate because the pinned scripted transport makes no provider call.

## Running after runtime/package integration

Promptfoo 0.123.0 was exercised through the real CLI. Keep it optional, outside the runtime dependency tree. From `bench/`:

```sh
PROMPTFOO_DISABLE_TELEMETRY=1 PROMPTFOO_DISABLE_UPDATE=1 \
  npm exec --yes --package=promptfoo@0.123.0 -- promptfoo eval \
  -c test/eval/promptfoo/clara.config.yaml --no-cache --max-concurrency 1 --no-table
```

Promptfoo's current custom JavaScript/TypeScript provider interface requires `id` and `callApi`; external test generators are supported. The configuration uses both facilities. Deterministic assertions inspect the adapter's JSON output; there is no LLM judge.

The report writer in `src/eval/report.ts` creates `clara-comparison.json` and `clara-comparison.html` from real adapter results. It retains trace links and labels cost/latency as estimates. These reports are local evaluation evidence, not a provider usage receipt, hosted acceptance, or release evidence.

## Focused checks

```sh
node --test test/eval/*.test.ts
npm run typecheck
```

No database impact: fixtures and reports are local synthetic files; no Studio database, mail, model API, billing service, or deployment is contacted.
