# Foundation delivery and worktree contract

Linear project: https://linear.app/tinyrick/project/oceanheart-studio-8ed48b4b1722

## First batch

| Issue | Ownership | Integration condition |
| --- | --- | --- |
| RIC-98 | `backend/`: architecture, domain contracts, backend runtime and tests | Protected reads/writes and concurrent booking behaviour demonstrated against a real backend |
| RIC-99 | Workspace typography and its visual evidence | App typography passes desktop/mobile checks; marketing retains its typography |
| RIC-100 | Frontend package tooling, browser tests, CI and app TypeScript exclusion | Fresh install, production build, typecheck and isolated browser checks pass |
| Coordinator | Integration, this document, PR and release evidence | Combined changes pass together; backend and frontend guarantees are reported separately |

Start at three implementation worktrees. Shared files have one owner during a batch. A clean Git merge does not prove contracts agree. Incorporate merged dependencies promptly and validate the combined result. Isolate database instances, ports, queues and provider fixtures as well as checkout directories.

## Current product boundary

`src/components/workspace/context.tsx` is a demo state container. Its `update(draft)` callback lets the browser mutate an entire practice and is not a production API. Do not expose that callback as a generic server mutation, upload the whole localStorage state, or treat locally selected personas as authenticated actors.

The public mock stays usable while backend foundations are developed. Backend verification does not establish that the mock has become a secure multi-user application. Replacing persistence is RIC-102, after RIC-101 authentication and authorisation.

## Migration rules

- Replace demo writes with explicit, authorised business commands, one journey at a time. Keep demo fixtures and live data in separate modes and stores.
- Derive the actor from verified server identity. A supplied practice ID selects a context; it never grants membership.
- Keep private practitioner notes out of client-facing projections rather than hiding them with CSS.
- Store booking instants and a practice time zone; the mock's `day`/`time` strings are presentation data. Decide DST and availability rules before importing them.
- Store monetary amounts in integer minor units with currency. Snapshot service terms on bookings so future price changes cannot rewrite history.
- Approval records bind a specific command and relevant version. Recheck authorisation and current conditions at execution time.
- Provider identity mappings and execution records belong on the backend. Demo connection toggles never establish account connectivity.
- Do not automatically import the sample practice or browser contents into a real account. Real onboarding starts from explicit validated input.

## Verification and reporting

Use independently reviewed acceptance expectations. Distinguish browser smoke tests, unit tests, local backend tests, hosted deployment checks and real external provider contracts in reports. A local privileged identity override may test authorisation; it does not verify production token issuance or validation.

Every completed issue links a commit/PR, commands and results, relevant deployment or screenshots, and remaining limitations. `In Review` means evidence is being checked. `Done` means the integrated acceptance criteria have been demonstrated.

Human gates should name the exact missing account action or decision and the work already completed. Never ask for credentials to be pasted into a chat. Continue independent local work before presenting the gate.
