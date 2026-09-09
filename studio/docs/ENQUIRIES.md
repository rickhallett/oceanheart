# Manual enquiries and unsent drafts

Owners can record an enquiry with contact details, subject and message, browse
open/resolved lists, save a reply draft, and resolve or reopen it. Drafts are
explicitly unsent: this slice has no mailbox provider, public capture endpoint,
email delivery or external messages. `/app` remains a separate local demo.

Conversion deliberately chooses an existing client or creates a separate client;
matching emails never merge contacts. An optional booking can be created from an
active service, or linked from scheduled bookings belonging to the chosen client.
Client/service pickers use explicit pagination. Existing booking selection uses a
one-hour timezone-aware query window and warns when its 200-row limit is reached;
move the window start to narrow incomplete results. Practice timezone and DST
rules are shared with Bookings.

The backend converts enquiry, client and booking in one transaction. An overlap
failure rolls back the new records and leaves form values available to correct.
Stable request keys make retries safe. Existing links cannot be reassigned, and
conversion does not resolve the enquiry automatically. Detail shows the linked
client and appointment time/status so the outcome is visible. Draft and status
changes use expected revisions; conflicts preserve edits and require reload.

Full reload still resets the selected practice to the first membership. Saved
enquiries stay in their original practice; acceptance reselects its exact ID.

## Verification

Focused tests cover manual capture retry keys, unsent draft conflicts, deliberate
same-email contacts, atomic conversion retry payloads, pending controls, pagination
and permission downgrade. Generated API contract checks cover all UI commands.
The opt-in WorkOS browser journey records an enquiry, saves a draft, rejects an
overlapping conversion, creates a separate client/booking, resolves/reopens and
checks visible linked details plus exact IDs in a fresh session. Reports record
created enquiry/client/booking IDs and screenshots without credentials or browser
storage. Root delivery evidence records hosted acceptance and database readiness.

The isolated local server uses port 4343, with exact WorkOS `/callback` and
`/practice` logout allowlisting. Canonical local development remains port 4331.
Production release requires explicit approval.

## Local acceptance receipt, 9 September 2026

The local 4343 application passed all 12 real WorkOS/staging Convex browser
checks in `rad-browser-2026-09-09T14-37-54-875Z`. It demonstrated overlap rejection
with retained conversion inputs, separate same-email client creation, visible
linked appointment details, explicit resolve/reopen, and saved draft/link IDs in
a fresh authenticated session. Desktop 1440px and mobile 400px screenshots were
inspected; 320px also passed the no-overflow assertion. No message was sent.

Full verification passed build, TypeScript, 58 unit and 56 browser checks.
UTC milestones: implementation started 14:27:56; focused enquiry and permission
tests passed 14:33:31; full verification ran 14:37:07–14:37:42; actual hosted
browser acceptance ran 14:37:54–14:38:38. Implementation and focused tests were
interleaved. These are wall-clock phase markers. Staging frontend acceptance is
still a separate root delivery gate; no production release was performed.
