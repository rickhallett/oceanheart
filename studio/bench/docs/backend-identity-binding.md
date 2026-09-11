# Dedicated synthetic backend and identity binding

This controller-only adapter records one provider-inspected Convex/WorkOS binding for a synthetic client. It does not accept an application request's client ID as authority or expose an administrative endpoint. The concrete transport can create and reconcile a dedicated Convex development project/deployment plus a WorkOS sandbox environment, but only from an explicit private target registration.

## Binding contract

A ready binding contains:

- the opaque synthetic `clientId` and provider-controlled environment ID;
- an exact Convex deployment ID and HTTPS `*.convex.cloud` URL;
- an exact WorkOS environment ID, `https://api.workos.com/` issuer and client audience;
- the manifest hash, exact source SHA, deterministic operation ID and inspection time;
- `mode: synthetic`, `scope: dedicated`, `status: ready`; and
- only exact client-scoped `secretref://...` references for controller credentials.

The provider adapter returns an inspection attestation. The controller accepts it only when classification is `synthetic`, isolation is `dedicated`, the attested client matches, and the provider, identifiers and URLs pass the fixed Convex/WorkOS policy. A production, shared, foreign-client, partial or malformed observation cannot become ready.

The separate `SubjectBindingResolver` is initialized from server-controlled ready bindings and explicit verified-subject mappings. Its `resolve` input has only issuer, audience and subject; there is deliberately no caller-selected client or environment. A mapping must match the binding's configured WorkOS policy exactly. `ControllerBindingRegistryAdapter` checks the verified principal's environment and projects only the non-credential binding fields into the server contract; that boundary revalidates the result and derives its runtime client from it.

## Reconciliation and private state

`BackendIdentityBindingController.ensure` takes the validated synthetic provision manifest, its exact template source SHA, two credential references and an idempotency key. The private mode-0700 registry writes mode-0600 fsync-backed records under a per-client lock. It persists `pending` before create and inspects the provider again after create before recording a ready binding.

An ambiguous error or non-authoritative absence records only a fixed redacted `effect_uncertain` message. A retry must inspect first. Persisted pending or uncertain state never authorizes a second create from an absent result. A concrete partial result may resume only when the provider marks repair safe; the composite transport then re-inspects both components and creates only the missing registered resource. Only an explicit pre-effect provider rejection permits a new full create attempt. Conflicting ownership stays failed until operator resolution.

The provider interface receives credential references, never resolved token values. `ControllerProviderAuthorityResolver` resolves the Convex team token only inside the trusted HTTP transport callback and resolves WorkOS to an existing controller-owned CLI session. Its configuration contains an environment-variable name or absolute executable path, not a token. The command runner passes only a minimal process environment. Provider error/detail text is not written to the registry or returned in binding receipts. The registry rejects altered request hashes, invented states, cross-client values and non-reference credential material.

## Concrete transport

`ConvexManagementTransport` uses the official bearer-authenticated Management API to list/create one registered project and its exact non-default `dev/...` deployment. It re-lists by provider ID/reference after every write; an ambiguous project response is recoverable without another project create. `WorkosAccountTransport` uses the official authenticated CLI in JSON/CI mode, verifies the active team, exact parent project/environment and `sandbox: true`, creates only the registered sandbox name, then lists again. Production or mismatched observations are conflicts.

The standalone command is:

```sh
node scripts/provision/bind-provider.ts \
  --target /private/c0001.provider-target.json \
  --manifest /private/c0001.manifest.json \
  --registry /private/binding-registry \
  --idempotency-key binding:c0001:0001 \
  --convex-token-env BENCH_CONVEX_TEAM_TOKEN \
  --workos-cli /absolute/path/to/workos \
  [--inspect-only]
```

The mode-0600 target file binds the exact manifest hash/source SHA, client, Convex team/project/development reference, WorkOS team/project/parent environment/sandbox name and the two exact secret references. Unknown fields are rejected so the registration cannot carry a hidden credential. The command emits IDs/status only and reduces any failure to an error class.

## Current execution boundary

Bounded account inspection found an authenticated WorkOS team/project with its normal sandbox staging and production environments; neither is a dedicated `c0001` target. The CLI can create a new sandbox. Convex 1.45 supports the required project/deployment operations, but the clean controller has no selected target and no configured team-token resolver. No provider resource was created to avoid an orphan WorkOS environment while the Convex team target is unknown.

Live completion requires the controller operator to register the exact existing Convex team ID, client project/deployment reference, WorkOS team/project/parent sandbox IDs and supply a Convex Team Access Token through the named controller environment variable. That token remains absent from files, receipts, Pi and child processes. The existing WorkOS dashboard session may supply the sandbox write when its inspected team matches registration. The accepted Studio staging backend remains shared and is ineligible.

Focused transport tests exercise the actual HTTP/CLI request shapes with injected network/command seams: exact target creation/replay, lost Convex project response, lost WorkOS create response, safe partial repair, production/cross-target refusal, private registration modes and secret-canary redaction. This is executable transport contract evidence, not a live dedicated provider binding. No Studio application or backend schema changes are made.
