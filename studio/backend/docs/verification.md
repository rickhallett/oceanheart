# RIC-98 local verification

Verified 2026-09-08 on macOS Apple Silicon, Node 24, Convex npm package 1.45.0, using its downloaded native local backend. These are behavioural checks, not throughput or latency benchmarks.

Commands: `npm run typecheck` and `npm run test:integration` in `studio/backend`. Both pass. The final integration run reports 19 backend checks plus a descendant-cleanup regression test and keeps a JSON record under `.local/reports/` (ignored local evidence).

- Anonymous reads and writes rejected.
- Authenticated cross-tenant reads and writes rejected.
- Twelve independent HTTP clients concurrently retrying the same key receive one booking ID; storage contains one row.
- Reusing the same key with changed payload rejected.
- Twelve clients concurrently request one interval using different keys: one success, eleven explicit conflicts.
- An interval containing an existing booking and an interval contained by it both rejected.
- Exact adjacent interval accepted.
- Same time can be booked in another tenant or against another tenant-local practitioner key.
- Zero duration and duration above 24 hours rejected.
- Viewer can read, but cannot book or grant membership.
- Removing viewer membership revokes access using the same still-valid JWT.
- Wrong signature, issuer, audience and expired JWT each rejected by the actual backend.
- List uses start-within-window semantics, excluding a booking that began just before the window.
- A 201-booking dataset returns 200 items with explicit `hasMore:true` and `limit:200`.
- Generated TypeScript API/schema successfully deployed to the real local instance.

## Independent review changes incorporated

Functions and test code were formatted for maintainability. Silent list truncation was replaced with metadata. The runner uses `mkdtemp`, ensures distinct selected ports and waits for deployment config as well as network readiness. Auth setup is followed by an explicit completed code push, rather than trusting an earlier “ready” log. It fails before touching a known legacy anonymous-agent state directory. Only the runner's own local administrative credential is used to install code/config; behavioural checks use ordinary signed bearer tokens. Each run's signing key stays in memory and its database is deleted after shutdown.

No hosted Convex account, real identity-provider session, Next.js auth flow, AWS integration, calendar integration, production restore exercise or Postgres runtime was tested. RIC-101 user login is not implemented. RIC-119 owns the hosted account/provider gate.

## PR #20 follow-up

Membership creation and removal both reject blank, whitespace-only and padded identifiers without rewriting opaque claims. The integration runner checks the local deployment bound its requested ports before configuring authentication, aborts on unexpected CLI exit, and always cleans its detached process group even if the CLI parent exited first. A real child-process regression confirms a surviving descendant is terminated. Local port selection still has the operating-system bind race; an unexpected selected port fails safely rather than silently adopting another instance.
