# Practice settings

The authenticated `/practice` has a Settings section within the selected
practice, alongside Tasks and Services for every member. Owners edit; viewers
see the saved values read-only with a View-only access note. A changed tenant
or role remounts the view, clearing unsaved edits. `/app` stays a separate
public prototype.

Owners edit the practice name, tagline, contact email/phone and address, plus
the default weekly availability: seven weekdays, each closed or one open/close
interval written as exact `HH:MM` times in the practice time zone. The name and
time zone reuse the existing tenant storage; there is no second source of
truth. Availability is a declared default for future public scheduling, not an
enforced bookable slot: the manual booking flow neither reads nor writes it,
and existing bookings are unchanged.

Details and the whole week save atomically with one owner command. Edits send
the revision from the form's opening snapshot. The backend accepts an
already-applied identical desired state as a retry without bumping the
revision, but rejects a stale divergent update with `REVISION_CONFLICT`. The
form preserves entered values, disables another save and offers an explicit
reload; it never silently overwrites a concurrent edit. Blank optional values
are omitted and cleared fields are removed from persistence, matching record
conventions. Tenants created before this feature read safe defaults with
revision 0, so the first save never conflicts.

`npm run verify` includes the generated API contract checks, settings form
failure/pending/conflict tests, owner/viewer mounting and tenant/role view
resets. `npm run test:integration` in `backend/` runs the settings checks
against a real local backend: absent-legacy defaults, membership/owner/revoked
boundaries, field and interval validation, normalized persistence, no-op
retries, stale conflicts, single-winner concurrent writes and optional-field
clearing. The authenticated `/practice` browser journey stays an opt-in
credentialled run; the secretless browser suite guards the surrounding pages.

Database impact: five optional detail fields, one optional seven-day
availability object and one optional revision counter on the existing tenants
table, plus explicit `settings:get`/`settings:update` functions. All additive;
legacy tenant documents remain valid. Verify the intended staging
schema/functions and real hosted journey before accepting this slice.
Production still requires the separate release approval documented in
[STAGING-AND-RELEASE.md](STAGING-AND-RELEASE.md).
