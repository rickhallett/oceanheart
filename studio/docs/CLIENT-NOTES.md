# Private practical client notes

Precision `/app/clients` lets the practice owner expand **View private notes**,
edit plain text and explicitly save or clear it. Notes are limited to 4,000
JavaScript string characters. They are operational notes, not a clinical record
system. No assistant, outgoing message or client portal integration is added.

`clients.notes` and `clients.saveNotes` independently require owner membership
and verify that the selected client belongs to the selected tenant. The read
projection contains only `text` and `revision`. Notes never appear in client
list/search projections, contact search text, booking summaries or task links.
There is no viewer or client-facing notes endpoint.

Optional `clients.privateNotes` and `clients.notesRevision` fields default to
empty text/revision zero. This is additive schema only, with no row migration or
backfill. Notes have a separate revision from contact fields and archives;
those existing commands preserve notes. Archived clients retain editable notes.
Every changed save requires the current note revision. An identical retry is a
no-op; an old save cannot restore a note after a subsequent clear.

The editor loads on first expansion, retains drafts through hide/reopen, and
resets when practice or client changes. Clean forms adopt remote updates.
Dirty forms preserve their text, block stale saves and require **Use latest
notes** to replace the draft. Successful mutation revisions protect against
older subscription echoes; ordinary failures remain retryable. Loading and
access failures have explicit states.

Verification covers real-backend owner/viewer/foreign access, concurrent saves,
bounded content, independent contact revisions, archival, clear/retry and list
exclusion. UI tests cover lazy loading, dirty/clean remote updates, explicit
recovery, delayed subscription echoes and pending/error behaviour. Hosted
acceptance uses two real-auth browser pages in one synthetic practice, then
checks reload, contact edit, archive and clear at desktop/400/320.
