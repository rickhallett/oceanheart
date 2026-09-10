# WorkOS practice integration

`/practice` uses WorkOS AuthKit Next.js 4 and Convex. `/app` remains a separate
public browser-local prototype. No demo data, localStorage state or selected
persona is sent to the authenticated backend.

## Environment configuration

Set these only in the intended Vercel environment or an ignored `.env.local`:

| Variable | Purpose |
| --- | --- |
| `WORKOS_CLIENT_ID` | Staging WorkOS application client ID |
| `WORKOS_API_KEY` | Server-only API key for that WorkOS environment |
| `WORKOS_COOKIE_PASSWORD` | Unique random session encryption secret, at least 32 characters |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Exact allowlisted callback URL ending in `/callback` |
| `NEXT_PUBLIC_CONVEX_URL` | Intended hosted Convex deployment URL |

For staging, the callback is
`https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app/callback`.
Configure WorkOS Sign-in URL as the same origin plus `/sign-in`; configure Logout
URI as the same origin plus `/practice`. Canonical local development uses
`http://127.0.0.1:4331/callback`, `/sign-in` and `/practice` respectively; the
isolated enquiry acceptance worktree uses port 4343. The callback origin and port must
match the running server and WorkOS allowlist exactly. The environment example
includes the matching server command. Padded values and malformed WorkOS client
IDs are rejected before provider initialization.
Use a separate environment and cookie secret for production. See
[staging and release policy](STAGING-AND-RELEASE.md) for deployment authority.
The former Clerk variables are unused and must not be copied into staging.

The backend requires `STUDIO_AUTH_MODE=workos` and the same `WORKOS_CLIENT_ID`.
See [backend contract](../backend/docs/workos-rad.md) for JWT issuer/JWKS details
and deployment readiness. The API key and cookie password belong to Next.js;
Convex verifies JWT signatures and derives membership from verified identity.

AuthKit's `authkitProxy` maintains the session on `/practice`, `/sign-in` and
`/callback`. `handleAuth` validates the callback and returns to `/practice`.
The SDK seals its session in an HTTP-only cookie. The frontend adapts
`useAccessToken` to `ConvexProviderWithAuth`, including forced token refresh.
Data queries mount only after `useConvexAuth` confirms backend authentication.
No access token is included in server-rendered initial auth props. Sign-out
uses a server action and the configured origin's fixed `/practice` return URL.

A missing or invalid configuration renders an unavailable state without
contacting providers. Failed callback, token validation, query and mutation
states have distinct recovery UI; raw provider errors are not displayed.

## First live journey

Signed-in members can select their practices or explicitly create a practice.
Owners can add tasks and set completion; viewers can only read. Both practice
and task creates retain a request key after an uncertain response, so retries
with unchanged input do not duplicate a successful command. Completion sends
the desired boolean, and the list reflects saved query data. Switching practice
remounts task controls to discard unsaved input. Reload reads the backend anew.
The initial list is bounded at 200 newest tasks and reports when more exist.

Today is the default selected-practice view for owners and viewers. Its date is
derived by Convex from server time and the practice's saved IANA time zone; the
browser sends only a refresh key and cannot select the day or booking window.
It shows active tasks due on that practice date, including open and completed
work. Owners also see scheduled bookings overlapping the half-open local-day
window; viewers never start that private query or receive client-link fields.
Missing or invalid zones fail closed with an explicit setup state, and the
owner action opens Bookings, where the time zone is actually editable. Results
are bounded at 200 with visible truncation copy and refresh just after the
server-calculated next practice midnight.

## Verification

`npm run verify` includes a production build, TypeScript, isolated component
and API contract tests, and desktop/mobile Playwright checks. Component tests
exercise failure/retry semantics and view-only controls; they do not establish
real WorkOS token issuance or hosted persistence. Type-level tests compare the
small frontend references with the generated backend arguments and results.
Focused Today tests cover 23/25-hour London dates, owner/viewer mounting,
explicit setup states and rollover-timer cleanup. Native backend acceptance
adds task pre-limit selection, booking boundaries and permission/redaction
checks.

For secretless checks in a locally configured checkout, override the five auth
variables to empty for the whole command. Do not run the state-changing browser
suite against production. Hosted acceptance must separately demonstrate sign-in,
practice/task create and complete, reload persistence, and isolation between two
accounts, recording the exact app revision and backend target.

References: [WorkOS Next.js SDK](https://github.com/workos/authkit-nextjs),
[Convex's official Next.js AuthKit adapter](https://docs.convex.dev/auth/authkit/add-to-app).

The opt-in browser runner is `scripts/accept-workos-browser.mjs`. The backend
hosted acceptance runner creates a mode-0600 credentials file in a private
fixture directory. Run the browser check with
`STUDIO_ACCEPTANCE_BASE_URL=http://127.0.0.1:4343 node scripts/accept-workos-browser.mjs <fixture-directory>`
from `studio`, or set the stable staging origin for hosted frontend acceptance.
It reads synthetic owner/outsider credentials without printing them, uses fresh
browser contexts and real WorkOS sign-in, and records sanitized checks and
screenshots after authentication. It creates uniquely named synthetic practices
and tasks through the UI and checkpoints their actual tenant/task IDs in the
sanitized report for exact cleanup. The target allowlist excludes production. Never commit
the fixture, password screenshots, access tokens or saved browser sessions.

## Local application with hosted staging services: 9 September 2026

The real browser runner passed at `http://127.0.0.1:4341` against the staging
WorkOS environment and Convex `charming-albatross-632`. It demonstrated hosted
password sign-in, explicit practice creation, empty task state, task creation and
completion, reload persistence, sign-out, a fresh browser login reading saved
state, and a separate authenticated account unable to see the first practice.
The local evidence run is `rad-browser-2026-09-09T12-06-45-826Z`. Desktop 1440px,
400px and 320px populated screenshots were inspected: continuous white canvas,
34px input/action controls, readable wrapping and no horizontal overflow.

This verifies a local application against real hosted identity and persistence.
It does not establish the Vercel staging frontend revision or production release.
The same browser runner must pass at the stable staging URL after deployment.
No credential, token, browser storage state or sign-in password screenshot is
included in evidence.

The callback sets the SDK's `baseURL` to the configured redirect URI's origin.
Next.js can normalize an internal request hostname to `localhost`; trusting that
hostname would redirect a `127.0.0.1` session to a different cookie origin after
successful authentication. A route-level SDK contract test covers both local and
HTTPS staging origins while the request exposes an internal hostname.

Gmail uses the existing verified WorkOS actor and session, with a separate
Google consent flow. See [GMAIL.md](GMAIL.md) for the route proof, state binding,
staging-only configuration and human acceptance gate.
