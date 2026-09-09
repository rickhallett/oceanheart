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
count claims. Editing, archival, search and booking linkage are separate work.

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
