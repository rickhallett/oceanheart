# Client booking history

Within Precision `/app/clients`, an owner expands a client's booking history.
Appointments are ordered by current start time, latest first, in pages of 20.
Scheduled and cancelled appointments remain visible, including for archived
clients. Matching uses tenant and client IDs; names and emails never merge
histories. Unlinked legacy bookings are not guessed into a client record.

`bookings.forClient` checks owner membership and the client's tenant before
reading `bookings.by_tenant_client_start`. It accepts Convex pagination options
(1–50 rows) and returns only booking ID, start/end, status, revision, saved
service terms and saved time zone. No actor, request key, contact or internal
command payload is returned. The index is additive; no row rewrite or backfill
is required.

Activity uses the existing owner-only `bookings.history` query. Created,
rescheduled and cancelled events remain in descending recorded order; the
existing 200-entry bound is explicit. Times include a year and UTC offset,
using each booking's saved time zone, with UTC fallback for legacy records.
Service changes do not alter displayed booked terms. A past appointment is
still labelled Scheduled until a supported command changes its status; the UI
does not invent a completed state.

History and activity queries mount only when expanded. Loading, empty,
load-more and retry states are explicit. Changing practice/client remounts the
query; viewers never mount Clients and the backend independently denies them.
Private notes, client-facing portal access and editing bookings from history
are separate scope. Reschedule/cancel remains in Bookings.

Verification: native booking-workflow checks cover pagination, isolation,
projection, archival, duplicate-name separation, saved terms and transitions.
Frontend checks cover lazy queries, loading/empty/pagination, retry and DST
offset display. Hosted acceptance uses a synthetic practice and verifies
create, history, reschedule, cancel, archive and reload at desktop/400/320.
