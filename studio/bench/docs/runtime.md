# Pi workflow runtime — RIC-137/138

This standalone Node 24 ESM package pins `@earendil-works/pi-coding-agent` and `@earendil-works/pi-ai` **0.85.1** (npm metadata verified 11 September 2026). It does not use the Studio application's dependencies or backend. Install with `npm ci --ignore-scripts`; run `npm test` and `npm run typecheck` from `studio/bench`.

Official API reference: [Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md). Implementation checked against the installed pinned package declarations and implementation (`core/sdk`, `model-runtime`, `resource-loader`, `session-manager`) because main documentation can change. This release uses `ModelRuntime.registerNativeProvider`, `createAgentSession`, `SessionManager.create/open`, `session.prompt/subscribe/abort/dispose`. The Oceanheart methods below are our adapter interface.

## Interface for CLI and evaluation

`src/runtime/contract.ts` re-exports `ClaraInput`, `ClaraResult`, `calculateInvoice` and `validateInput` from `src/workflows/clara.ts`. `clientId` at the top level identifies the synthetic practice/runtime; session `clientId` identifies the person receiving supervision. Identity is never inferred from shared email. Inputs use ISO calendar dates and integer GBP minor units; each charge needs an explicit agreement or cancellation-policy reference. No attendance inference. Missing information produces `unresolved`; prepaid attended sessions and already-invoiced records are excluded from new charges. Payments describe existing invoice balances and never create a payment.

```ts
import { PiWorkflowRuntime } from './src/runtime/pi-adapter.ts';
const runtime = new PiWorkflowRuntime({root: '/private/synthetic-bench-state'});
const unsubscribe = runtime.subscribeEvents(event => { /* metadata only */ });
const job = await runtime.startRun({clientId: fixture.clientId, actor: 'synthetic-owner', idempotencyKey: 'CL-01-v1', input: fixture});
const trace = runtime.exportTrace(fixture.clientId, job.id);
// await runtime.resumeSession(fixture.clientId, job.id);
// await runtime.cancelRun(fixture.clientId, job.id);
unsubscribe(); runtime.close();
```

Run status is queued/running/waiting_for_input/succeeded/failed/cancelled. `effect_uncertain` is reserved for future reconciled external connectors, not fabricated for the current atomic local effect. An unresolved draft returns `waiting_for_input`; corrected input requires a new explicit request/version, not silently replacing the original receipt. The initial packet does not implement draft editing or releasing reservations. Use fresh fixture state for independent eval cases; repeated requests reuse the same idempotency key. Distinct keys attempting to reserve the same charged session fail closed.

## Isolation and limits

The workflow creates a dedicated per-client/per-job cwd, config and session directory under the supplied private state root. Explicit tools are exactly `prepare_invoice`; no bash/read/write defaults. Extensions, skills, prompt templates, themes and context-file discovery are disabled. Settings and credential storage are in-memory; model config files and initial catalog/network refresh are disabled. No user or global auth file is opened. The explicit provider is trusted operator code, not accepted from a practitioner request.

The default provider is **a deterministic in-process transport**, registered into the actual Pi SDK. Pi runs its real prompt/event/tool/session loop, invokes the tool and consumes its result. It is not paid inference, a model-quality evaluation or live provider integration. The model cannot supply amounts or arbitrary fixture paths: the zero-argument tool closes over the validated durable job. Resources are the fixed instructions and bound fixture, not arbitrary filesystem paths. No provider calls were made. A later real-model adapter needs separately approved credentials and a concrete request/token/cost cap.

Defaults: 30 seconds, four authorized tool calls, six turns, no retries or compaction. Elapsed timeout aborts the session; token-based fencing blocks effects after cancellation or lease loss. Persistent counters survive restart. A client has at most one unexpired running lease. Crashed workers become resumable after lease expiry; the initial lease spans the bounded run plus five seconds. No continuously renewed unbounded lease is needed. Subscriber exceptions do not break jobs.

SQLite WAL + FULL synchronous transactions persist jobs before execution and atomically record draft effects with session reservations. A crash after the effect but before job completion recovers the existing result without another model call. Session history is not the effect authority. Cancellation cannot undo an already recorded draft. There are no external side effects to reconcile in this packet. State is mode0700 and database0600; the root must be operator-controlled, not a client-supplied/symlinked path. File/process permissions remain the real boundary: this is not an OS sandbox against malicious installed SDK/provider code.

Trace exports contain ordered event metadata, input/result hashes and status, not raw model text, fixture contents, credentials or session files. Private job/session state contains the supplied synthetic records and must stay outside Git. No cloud trace exporter, service authentication, VM provisioning, production integration, backup system or real-client readiness is claimed.
