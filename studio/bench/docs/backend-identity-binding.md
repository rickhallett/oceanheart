# Dedicated synthetic backend and identity binding

This controller-only adapter records one provider-inspected Convex/WorkOS binding for a synthetic client. It does not accept an application request's client ID as authority, resolve secrets, configure a provider, or expose an administrative endpoint.

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

An ambiguous error, partial environment or non-authoritative absence records only a fixed redacted `effect_uncertain` message. A retry must inspect and find the exact owned binding; persisted pending or uncertain state never authorizes a second create from an absent result. Only an explicit pre-effect provider rejection permits a later create attempt. Conflicting ownership stays failed until operator resolution.

The provider interface receives credential references, never resolved token values. Provider error/detail text is not written to the registry or returned in binding receipts. The registry rejects altered request hashes, invented states, cross-client values and non-reference credential material.

## Current execution boundary

No dedicated Convex project/deployment or WorkOS environment was selected or created in this packet. The accepted staging deployment remains a shared application environment and is therefore ineligible. A live adapter requires a concrete separately isolated synthetic Convex deployment, synthetic WorkOS environment/client, controller-only credential resolver, and provider inspection capable of attesting client ownership and dedicated/test classification. Account/plan capacity and any provider write must be established without reusing staging or production credentials.

The implementation is executable with an injected provider adapter and deterministic synthetic provider tests. A combined test carries a controller-inspected registry record through authenticated Clara start/replay/read, proves one durable effect, ignores a forged request client and denies the other configured client. The identity verifier and provider are still local doubles, so this is not hosted WorkOS token or Convex tenant-isolation evidence. No Studio application or backend schema changes are made.
