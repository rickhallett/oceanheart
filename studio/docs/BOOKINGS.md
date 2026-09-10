# Manual practitioner bookings

The authenticated `/app` Bookings view is owner-only. One practice has one
calendar lane. Confirm an IANA practice timezone explicitly before scheduling;
Europe/London is a suggestion. `/practice` redirects to this same workspace.

Choose an active client and service using searchable client results and explicit
load-more controls. The backend stores client/service IDs and snapshots the
service name, duration, integer GBP price and practice timezone. Later catalogue
or timezone edits do not rewrite booked terms. Same-email contacts remain
separate records.

Local date/time conversion uses `@js-temporal/polyfill`: round-trip validation
rejects clock-forward gaps; a repeated hour requires an explicit earlier/later
UTC-offset choice. Agenda boundaries follow the practice timezone, including
23/25-hour days. Overnight bookings appear on each overlapping day with dates
on both ends. The bounded agenda reports when more than 200 bookings overlap.

Creation retains a request key across retries. Reschedule and cancellation use
expected revisions; conflicts preserve entered values and require a reload.
Cancellation retains the booking and frees its slot. Legacy bookings can be
cancelled but cannot be rescheduled through this linked workflow. The backend
records create/reschedule/cancel transitions. No hard deletes, availability
promises, public slots, reminders or external messages are included.

Saved weekly hours are optional and enforcement defaults off. When an owner
enables it, `bookings:createLinked`, retained legacy `bookings:create`, linked
reschedule and booking creation during enquiry conversion all read the current
tenant setting inside their mutation. The complete half-open elapsed interval
must fit one continuous allowed segment; checking only the submitted endpoint
wall times is insufficient. Adjacent appointments ending exactly at close are
allowed. Closed days and intervals crossing local midnight are denied.

On a repeated-hour day, ambiguous opening and closing times apply to each real
occurrence. An appointment may use either occurrence only when its whole
elapsed interval remains allowed; crossing a disallowed fold segment is denied.
If a saved opening or closing time does not exist on a clock-forward day, that
local day fails closed. Existing appointments are not revalidated or changed.
Exact original create and conversion receipts are resolved before current
hours or time-zone checks, so safe retries remain replayable after settings
change. New writes use current settings and fail `OUTSIDE_PRACTICE_HOURS`.

The default Today view gives owners a compact read-only summary through the
separate `bookings:today` query. That query derives `[day start,next day start)`
from server time and the tenant's stored zone, includes prior-day bookings that
still overlap, and excludes cancelled rows and either exclusive boundary.
Callers provide no date bounds. The existing `bookings:list` agenda contract is
unchanged. Viewers do not start the Today booking query.

## Verification

Unit tests cover DST gaps/folds, local day boundaries, invalid agenda query
suppression, retry/pending controls, revision conflicts, overnight display and
owner-only mounting. Generated API contract checks cover every booking command.
Native Today checks cover overlap boundaries, cancellation, legacy scheduled
rows, tenant isolation and the explicit 200-row `hasMore` signal.
Focused native hours checks cover default-off compatibility, every authoritative
write path, whole-interval DST folds/gaps, atomic conversion rollback, tenant
isolation and receipt replay after settings changes.
`npm run verify` performs the standard build, TypeScript, unit and browser checks.
The opt-in real WorkOS runner also creates a linked booking, rejects overlap,
reschedules overnight, cancels and verifies persistence in a fresh session. It
records created IDs and desktop/mobile screenshots without storing browser
sessions or credentials. Root delivery records hold actual hosted results.

The isolated booking acceptance server uses `http://127.0.0.1:4342`; its exact
`/callback` and `/practice` logout URLs must be allowlisted by WorkOS. Canonical
local development remains port 4331. Backend deployment readiness is required
before running the real browser journey; production release requires approval.

Current practice selection resets to the first available membership after a full
page reload. Saved records remain in their original practice; select that
practice again to view them. Acceptance explicitly reselects its created practice
and verifies the exact saved booking ID after reload and fresh login.

## Local acceptance receipt, 9 September 2026

The local 4342 application passed the real WorkOS/staging Convex browser journey
in `rad-browser-2026-09-09T14-24-14-183Z`: 11 checks, including linked booking
creation, overlap rejection, overnight reschedule, cancellation, exact-ID reload
and fresh-session persistence. The 1440px, 400px and 320px agenda screenshots
were inspected; dates and controls wrap without horizontal overflow. The first
run's failed report retains its created IDs for cleanup; its reload assertion
was corrected to reselect the practice explicitly.

Full verification passed build, TypeScript, 48 unit and 56 browser checks.
Three subsequent error-mapping cases passed in the focused 11-test booking file,
and TypeScript passed again. Staging frontend acceptance remains a separate
root delivery gate. No production release was performed.

UTC milestones: implementation started 14:10:06; initial booking tests passed
14:18:12; full verification started 14:21:37 and completed before 14:22:22;
real browser acceptance completed 14:24:45. Implementation and focused tests
were interleaved; these are wall-clock phase markers, not isolated CPU timings.
