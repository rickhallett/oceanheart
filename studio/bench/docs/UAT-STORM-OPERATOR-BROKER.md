# UAT storm operator broker

This broker is the private, hosted-operator-driven transport for the bounded
Clara c0001 UAT workflow. It is not an unattended browser worker and it does not
claim a dedicated browser profile.

## Boundary

- The broker listens on `operator.sock` (`0600`) inside an operator-owned state
  directory (`0700`). Requests and responses are newline-delimited JSON capped
  at 64 KiB. The broker accepts one pending request at a time.
- `pending.json` and `response.json` are `0600`. `pending` prints the validated
  request; `respond` accepts a validated response envelope from stdin or a file.
- The operator uses the existing Captain-authorized Chrome tab. Exactly one
  operator owns that tab for the pending request, confirms that it remains on
  the private fictional c0001 surface, performs only the requested command, and
  then supplies the observation. No concurrent manual use is allowed.
- Live inspection must report `executionMode: "hosted-operator-driven"`,
  `operatorControl: true`, `operatorSession: true`, and
  `dedicatedProfile: false`. The manifest-bound target, identity, oracle, lease,
  expiry, epoch and operator-session binding digests remain authoritative.
- Cookies, tokens, raw identity claims, model input/output and secrets are not
  transport fields and are rejected as extra JSON properties. The broker does
  not read or attach to Chrome itself.
- The durable Clara oracle is a separate request bound only to
  `clara-c0001-september-invoice`; an operator acknowledgement is not effect
  proof.

## Operator commands

From `studio/bench`:

```sh
node scripts/uat-storm/operator-broker.ts serve --state-dir /absolute/private/state --timeout-ms 120000
node scripts/uat-storm/operator-broker.ts pending --state-dir /absolute/private/state
node scripts/uat-storm/operator-broker.ts respond --state-dir /absolute/private/state --file /absolute/private/response.json
```

Without `--file`, `respond` reads JSON from stdin. Response envelopes carry the
pending request ID and either `ok: true` with the kind-specific result, or
`ok: false` with one fixed broker code. Mismatched, stale, duplicate, oversized
and shape-invalid responses fail closed.

The broker defaults to a 120-second operator deadline (configurable from 50 ms
to 15 minutes). Shutdown returns `BROKER_SHUTDOWN` to an active caller and
removes broker-owned pending/response/socket files. Timeout returns
`OPERATOR_TIMEOUT` and retains no actionable pending request.

## Integration limit

The engine-side Unix socket adapter must use a configurable response timeout at
least as long as this operator deadline and no longer than the enclosing run
deadline. A hard-coded 15-second adapter timeout cannot support a reliable
human-driven Chrome observation cycle; until aligned, the transport is locally
proven but the live storm run is not ready.
