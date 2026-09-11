# Clara workflow evaluation

This is the initial synthetic, deterministic evaluation slice for the first Studio workbench integration. It implements the evaluation side of the section 9 contract: two versioned Clara workflow configurations run CL-01 through CL-08 through the **actual runtime workflow adapter**, not a substitute standalone prompt.

## Inputs and partitions

`fixtures/clara/` holds fixed-clock, fictional JSON fixtures. CL-01 through CL-06 are the fixed set; CL-07 and CL-08 are held out. Every fixture carries the canonical `ClaraInput` passed unchanged to the runtime, plus eval expectations for exact minor-unit amounts, source IDs and allowed/prohibited effects. CL-08 explicitly replays the identical request twice and checks the same durable job is reused. Effects are structured local receipts only. A sent invoice, payment collection/charge, mailbox call, or model-provider call is prohibited.

`workflow-configurations.json` compares `clara-2026-09-01` with an honestly labelled identical scripted control. It establishes comparison/report plumbing; it does not claim the later rate adaptation has changed runtime behaviour.

## Runtime path

`src/eval/promptfoo-clara-provider.ts` is a Promptfoo TypeScript custom provider. It directly constructs Silver's `PiWorkflowRuntime({ root })`, calls `startRun({ clientId, actor, idempotencyKey, input })`, calls `exportTrace`, and closes the runtime. There is no substitute prompt or dynamic adapter contract.

```ts
const startedAt = performance.now();
const job = await runtime.startRun(request);
const latencyMs = Math.round(performance.now() - startedAt);
```

Each independent case uses a distinct idempotency key; CL-08 is the only deliberate same-key replay. Latency is measured around the actual runtime call. Cost remains a labelled zero estimate because the pinned scripted transport makes no provider call.

## Running after runtime/package integration

Silver owns the Promptfoo dependency/lockfile. After it is added, run from `bench/`:

```sh
npx promptfoo eval -c test/eval/promptfoo/clara.config.yaml
```

Promptfoo's current custom JavaScript/TypeScript provider interface requires `id` and `callApi`; external test generators are supported. The configuration uses both facilities. Deterministic assertions inspect the adapter's JSON output; there is no LLM judge.

The report writer in `src/eval/report.ts` creates `clara-comparison.json` and `clara-comparison.html` from real adapter results. It retains trace links and labels cost/latency as estimates. These reports are local evaluation evidence, not a provider usage receipt, hosted acceptance, or release evidence.

## Focused checks

```sh
node --test test/eval/*.test.ts
npm run typecheck
```

No database impact: fixtures and reports are local synthetic files; no Studio database, mail, model API, billing service, or deployment is contacted.
