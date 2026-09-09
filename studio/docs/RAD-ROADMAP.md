# RAD feature sequence

Start from the accepted UI. Optimise for the smallest useful end-to-end increment, not the largest number of mock screens. Estimates below are relative effort, not delivery promises; reassess after the first live slice.

## Development order

| Order | Slice | Effort | Dependencies | Done means |
| --- | --- | --- | --- | --- |
| 0 | Establish development baseline | Small | Accepted UI | Canonical checkout, guide, branch and build/browser checks |
| 1 | Identity + one practice + one persisted task | Medium | Hosted identity decision/configuration | Sign in, create/select practice, add/complete task, reload/second device retains it; another tenant cannot access it |
| 2 | Clients and services | Small–medium | 1 | Create/edit/archive client and service; validated prices/durations; tenant isolation; explicit empty/error states |
| 3 | Practitioner booking workflow | Medium | 2, existing atomic booking backend | Create/reschedule/cancel against real records; conflict handling, timezone/DST, retry idempotency, service snapshot |
| 4 | Enquiries to client/booking | Medium | 2–3 | Capture enquiry, convert without duplication, track resolution; outbound delivery only after provider configured |
| 5 | Publish basic practice website | Medium | Services, practice settings | Draft/preview/publish with durable version; live booking entry point only when booking workflow ready |
| 6 | Client portal | Medium–large | Identity and bookings | Client-specific access to own bookings; safe change requests; no practitioner-private notes in responses |
| 7 | Payments | Medium–large | Stable booking/service model | Hosted checkout, verified webhooks, minor-unit accounting, retries/reconciliation; refund permission checks |
| 8 | Knowledge and supported assistant answers | Medium–large | Identity, document CRUD | Saved sources, audience enforcement, source versions/citations, clear unsupported-answer path, retrieval evaluation |
| 9 | Assistant actions and integrations | Large | Reliable underlying commands | Proposal/approval/execution lifecycle, revalidation, idempotency and audit evidence; no duplicate sends/refunds |
| 10 | Shop and additional commerce | Large | Evidence of actual demand, payments | Inventory/orders/provider reconciliation justified by users |

## Fast wins to batch around the foundation

- Task edit/delete and open/completed filtering.
- Client search and clear empty results; simple client import preview before writing.
- Service ordering, visibility and duration defaults.
- Practice details and default availability.
- Useful loading, validation and retry states for each new persisted feature.

These are genuinely quick only after shared persistence and permissions exist. Avoid building a second temporary persistence model to claim an early win.

## Reuse and boundaries

The existing `backend/` implements tenant membership and atomic booking create/list, overlap detection and request-key idempotency. Extend this rather than replacing it without evidence. The reviewed `/app` currently updates a whole local state object; replace writes incrementally with explicit authorised commands. Do not expose generic whole-state mutation on the server.

WorkOS AuthKit and the persisted Convex task foundation are accepted. Service and client create/list, revision-safe editing, reversible archives and client name/email search are accepted. This batch adds manual owner scheduling with active client/service linkage, immutable booked terms, explicit practice timezone and conflict-safe reschedule/cancel. Clients are owner-only; services are readable by practice members. Keep external sends, charges and refunds separate from UI simulation.

## RAD delivery loop

For each slice: define one user outcome and acceptance example; implement UI + server + permissions together; use synthetic fixtures; test happy path plus the consequential failure (tenant isolation, conflict, duplicate delivery); review desktop/mobile; merge to development. Release intentionally after acceptance. Stop adding polish unrelated to the current outcome unless it violates the canonical guide.

Booking scope is one calendar lane per practice. Weekly availability, public slots, reminders and external sends remain separate future work. Client contacts sharing an email stay distinct.
