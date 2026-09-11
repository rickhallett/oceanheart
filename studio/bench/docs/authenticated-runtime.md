# Authenticated client/environment runtime boundary

This server-side library is the first narrow bridge from a verified Studio identity to the existing durable Clara runtime. It does not add a login system, browser UI, public RPC endpoint, queue, backend deployment or model provider.

## Binding contract

The controller-owned registry resolves a cryptographically verified principal to one ready record:

```ts
{
  clientId, environmentId,
  backend: { provider, deploymentId, url },
  identity: { provider, environmentId, audience, issuer },
  provenance: { sourceSha, source, observedAt },
  status
}
```

Credential references may accompany a future controller record but credential values must never cross this interface. The request contains no authoritative client or environment selection. `AuthenticatedClaraRuntime` receives its environment, audience, issuer and provider policy from server configuration, asks the injected identity adapter to verify the session, then asks the private registry to resolve that verified subject. It independently checks the returned identity/backend binding before selecting a runtime.

Hosted mode requires WorkOS identity, a controller-inspected binding and an HTTPS Convex target. The deterministic synthetic adapter and `synthetic://` backend are accepted only when the boundary is explicitly constructed in `synthetic-test` mode. The selected durable runtime must independently report the same client, environment and backend deployment IDs as the registry binding. There is no production fallback, shared default client or permissive unconfigured state.

## Runtime behavior

`startClara` accepts an authorization value, idempotency key and Clara input without a trusted top-level client ID. It constructs the runtime request with the registry-bound client and a one-way hashed actor identity. Existing Pi/SQLite enqueue, lease, session reservation and draft-effect idempotency remain authoritative. The result returns a durable run ID and `runs/<id>` inspection reference; it is a library reference, not a new public route.

Every run, draft and trace read repeats authentication, binding validation, client lookup and initiating-actor ownership. Unknown runs, another actor and another client share the same redacted `REQUEST_DENIED` surface. Missing runtime/backend configuration returns only `SERVICE_UNAVAILABLE`. Identity adapter, registry and runtime exceptions do not expose token, issuer, audience, backend URL or record-existence details.

## Evidence and remaining hosted prerequisite

Focused synthetic integration uses two independent private SQLite roots and the actual scripted Pi runtime. It proves auth-free, issuer/audience/environment, actor and cross-client denials; server replacement of a supplied top-level client ID; one durable effect across an authorized retry; and authenticated run/draft/trace reads. No network or external inference is used.

The controller-owned private binding registry and its subject resolver are now connected to this server interface in deterministic tests. Hosted acceptance remains blocked on a concrete dedicated synthetic Convex deployment and WorkOS environment plus a server adapter that verifies real WorkOS sessions under the intended issuer/audience. Until those provider-controlled targets and configuration exist, this is a test-only library boundary and not hosted client isolation evidence.
