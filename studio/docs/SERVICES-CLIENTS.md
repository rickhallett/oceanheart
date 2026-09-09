# Practice services and clients

The authenticated `/practice` has Tasks, Services and Clients navigation within
the selected practice. Services are readable by all practice members and created
by owners. Client contacts are owner-only: viewers neither query client data nor
see its navigation. A changed tenant or role remounts the view, clearing private
results, unsaved forms and pagination. `/app` stays a separate public prototype.

Owners create a service with name, duration in whole minutes, GBP price and an
optional description. Decimal prices are converted to integer pence from digit
strings, allowing at most two decimal places and a maximum of £1,000,000. Client
creation accepts a name and optional email/phone; blank optional values are
omitted. The backend validates every command and derives membership from the
verified WorkOS session. Retry keys remain stable for the same normalized input
when the response is uncertain; pending form controls are disabled and errors
preserve entered values.

Both lists use Convex's native reactive pagination, initially 20 records, with an
explicit Load more control requesting another 20. The backend caps each requested
page at 50; result reactivity can change the number displayed. There are no total
count claims. Booking linkage remains separate work.

`npm run verify` includes the string-money boundary tests, generated API contract
checks, form failure/pending tests, paging controls, and tenant/role view resets.
The opt-in `scripts/accept-workos-browser.mjs` reuses private synthetic WorkOS
credentials and adds service/client create, list, reload and fresh-session checks
to the real browser journey. Reports checkpoint actual created IDs for cleanup.
It captures populated 1440/400/320px views without credentials or browser storage.

Database impact: new services/client tables and tenant/request indexes plus
explicit create/list functions. Verify the intended staging schema/functions and
real hosted journey before accepting this slice. Production still requires the
separate release approval documented in [STAGING-AND-RELEASE.md](STAGING-AND-RELEASE.md).

## Editing, archives and client search

Owners can edit, archive and restore records without changing their IDs. Active
and Archived are separate views. Edits send the revision from the form's opening
snapshot. The backend accepts an already-applied identical desired state as a
retry, but rejects a stale divergent update with `REVISION_CONFLICT`. The form
preserves entered values, disables another save and offers an explicit reload;
it never silently overwrites a concurrent edit. Archive and restore use the same
revision check and remain reversible.

Client search matches name or email using Convex full-text search with prefix
matching on the last term. Search supports up to 100 characters and 16 terms,
remains owner-only, and applies within the selected Active/Archived view. Changing
filter/search resets pagination and open forms. Clients sharing an email address
remain separate contacts; there is no uniqueness block or automatic merge.

Existing clients need the reviewed bounded backfill before list/search acceptance
because new status/search indexes require normalized fields. The coordinator
records the target, snapshot, migration completion and hosted checks. No browser
sample data is imported. The opt-in browser runner additionally verifies real
concurrent-edit conflict UI, email/name search, archive/restore and fresh-session
persistence while retaining created IDs for cleanup.
