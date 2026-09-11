# Clara attended-rate adaptation

The private Clara instance supports one explicit, synthetic rule change: update the standard rate for eligible attended sessions from an effective date. It is not a natural-language or general agent configuration surface. Negotiated rates, earlier sessions, cancellations, prepaid sessions, issued invoices and other clients remain unchanged.

For the first UAT scenario, the server-owned fixture changes the eligible 3 September attended session from GBP 80 to GBP 90 effective 1 September 2026. The GBP 40 cancellation and prepaid session remain unchanged, so the draft comparison is GBP 120 to GBP 130.

## Browser bridge contract

All requests use the existing same-origin `POST /api/private/clara` route. The route requires the current WorkOS session, forwards its access token only to the exact IPv4 loopback runtime, and never accepts `clientId`, actor, artifact paths, digests or arbitrary rules from the browser.

- `{operation:"adaptation-status"}` returns the active immutable release and its compatible prior rollback target when one exists.
- `{operation:"adaptation-evaluate",effectiveDate:"YYYY-MM-DD",newRateMinor:INTEGER}` requests a fresh, isolated evaluation. The Studio route adds an actor-stable idempotency key. The runtime returns a persisted immutable proposal, sanitized explanation, before/after totals, changed session IDs and evaluation counts/digests. Evaluation never activates a configuration.
- `{operation:"adaptation-activate",proposalId,expectedActiveReleaseId}` reauthorizes the actor and atomically activates only the exact stored artifact whose accepted evaluation is bound to the proposal and expected active release.
- `{operation:"adaptation-rollback",targetReleaseId,expectedActiveReleaseId}` reauthorizes the actor and atomically restores only the exact compatible prior release.

Every response has `schemaVersion:1`. Release and proposal IDs are lowercase SHA-256 hex; artifact and report digests use `sha256:<hex>`. The runtime must reject stale active pointers, failed or mismatched evaluations, cross-client records and unsupported policy changes without changing the active configuration. Studio displays only bounded, parsed response fields and generic transport errors.

Runtime invoice preparation resolves the active artifact server-side. Its durable idempotency identity must include actor, immutable input and active release: retrying within a release returns the same run, activation creates one new evaluated run, and rollback returns the prior release's result without replaying its old effect. Existing draft/session state is never reset to conceal conflicts.

The HTML/JSON comparison report remains a private operational artifact; this UI shows its signed digest and focused pass count rather than exposing filesystem paths or raw traces.
