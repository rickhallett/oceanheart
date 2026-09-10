# Owner-only source library (RIC-130 / RIC-112 child)

Precision `/app/knowledge` stores explicit owner-supplied plain text or Markdown,
up to 32 KiB UTF-8 per version. `.txt` and `.md` imports are read locally and
submitted as text. No parser, remote URL fetch, Notion, retrieval or AI provider
is involved. Markdown is displayed as text; HTML is never executed. Only
synthetic examples were used for development and validation.

`knowledgeSources` owns tenant, owner-only audience, current version, approval,
archive state and revision. `knowledgeVersions` preserves immutable content,
title, provenance, SHA-256 hash, sequential version number and creator identity.
Hashes and receipt deduplication are source/tenant-scoped; there is no global
content deduplication. Source creation plus first version is one mutation.
Editing creates a new version atomically and removes approval. Invalid or failed
writes cannot publish a partial version. Source/history reads and every write
require current owner membership, including direct IDs and receipt retries.

Approval binds the exact current version and source revision. Revocation clears
approval; archive clears approval and removes the source from the active index.
Archived content/history stays private to owners for audit; archive is not a
physical erasure claim. Old approval requests cannot reactivate a later revoked
or archived source. Retry receipts return original IDs without changing current
state. Concurrent edits share the source revision, so only one can win. Dirty
UI drafts survive subscription changes and require explicit latest-version
recovery; tenant/role changes remount the owner boundary.

## Dependency contract

Future RIC-131 retrieval may use a source only when its tenant is authorised,
`audience === owner`, `archived === false`, and `approvedVersionId === currentVersionId`.
Recheck these conditions at answer publication and citation opening. Historical
versions remain inspectable by owners but are not automatically eligible for
answers. The retrieval implementation and eligibility query are intentionally
outside this child. No private client notes or browser demo data are imported.

## Validation / release boundary

Focused native local Convex checks: real HTTP/JWT owner, viewer, outsider and
anonymous boundaries; hashes; concurrent create/edit; original receipt retry;
immutable history; stale approval; revoke/archive; invalid size/content; foreign
version IDs; indexed active/archive listing and bounded history.

Run `STUDIO_INTEGRATION_SLICE=source-library node scripts/integration.mjs` from
`studio/backend`. Default integration still includes the library checks.
Focused UI checks cover failed-write retry identity, draft conflict recovery,
archive blocking, owner-only mounting and text/byte boundaries. Rendered editor
verification uses synthetic mocked query data; it is local visual evidence,
not authenticated hosted acceptance.

Database impact: two additive tables with tenant/archive, tenant/request,
source/version and source/request indexes; `sourceLibrary` queries/mutations.
No existing tables or records are rewritten. Merge alongside payment tables,
API declarations and the payment integration slice by unioning additions.
No production writes. Gates independent review and hosted staging acceptance
remain separate gates before this child can be marked Done.

Review correction: editor payloads explicitly pick title/provenance/format/content
from Convex documents on initial load, recovery and submission. Backend current
version resolution fails closed for absent, foreign-tenant or wrong-source
pointers before read/save/approval. A malformed-pointer adapter exists only in
the disposable native-test checkout and is excluded from generated API checks;
it is never part of the deployed backend source. Focused regression totals:
6 UI tests, 7 grouped native outcomes.
