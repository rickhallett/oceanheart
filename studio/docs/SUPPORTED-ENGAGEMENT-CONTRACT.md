# Supported Engagement Knowledge contract

## Authority and scope

A Studio tenant is the customer engagement or practitioner organisation. It is
not a patient/contact row from `clients`. A verified tenant owner may upload,
version, approve, revoke and delete that tenant's documents. An owner may grant
an exact verified identity `read` or `contribute` access to Knowledge only.
Those grants do not confer tenant administration or access to bookings, clients,
payments or mail. Every API call resolves the authenticated identity server-side;
`tenantId`, source IDs and upload IDs are selectors, never authority. Agents use
their own WorkOS-backed Studio identity and a narrow grant, not copied cookies or
backend/admin secrets. The supported first engagement is attended agent use in
the existing signed-in Studio browser. Unattended API access is not ready and
would require a configured WorkOS machine identity/server verifier; copied human
cookies are never an acceptable substitute.

## API and state

- `knowledgeAccess.status/grant/revoke`: inspect access and owner-manage an exact
  identity's `read` or `contribute` grant. Approval always remains owner-only.
- `knowledgeIngestionActions.upload`: accepts at most 5 MiB only after
  `contribute` authorization, stores bytes server-side, and binds the new object,
  metadata and idempotency key to that tenant/actor. Callers cannot adopt an
  arbitrary existing storage ID. It returns an immutable upload ID.
- `knowledgeIngestionActions.process`: extracts and validates the registered object,
  then atomically creates a new source/version or replacement version. Status is
  `pending | processing | ready | failed`; public errors are only
  `UNSUPPORTED_FORMAT | FILE_TOO_LARGE | INVALID_TEXT | UNREADABLE_SCAN |
  EXTRACTION_FAILED`.
- Existing `sourceLibrary` list/get/history/create/save reads accept `read` and
  writes accept `contribute`; approve/revoke/archive remains owner-only. A new
  version clears approval. Archive/delete clears approval before content becomes
  ineligible. Retrieval requires the exact current version to remain approved.
  Delete first tombstones the source, then removes every immutable content version
  and bound upload blob in the same mutation; only non-content source audit metadata
  remains. Archive is the separate history-retaining operation.
- Existing `citedAnswers.search/resolve` accepts `read`; external `ask` remains
  disabled for real customer documents until provider/data handling is approved.
  Local lexical matches are evidence candidates, not proof of semantic quality.

TXT/Markdown are decoded as UTF-8. PDF extraction reads a text layer; a document
with no usable text fails `UNREADABLE_SCAN` and is never represented as OCR'd.
DOCX extraction reads document text only. Embedded files, macros, external
relationships and HTML are not executed. All extracted content is untrusted data,
never system instructions, code, a tool request or an authorization input.

## Readiness checklist

- [ ] Cross-tenant, viewer, revoked-grant and direct-ID access fail closed.
- [ ] Client owner and scoped contributor uploads are idempotent; reader cannot write.
- [ ] TXT, Markdown, text PDF and DOCX succeed within limits; corrupt, oversize and
      scanned/no-text documents fail with typed errors and no partial source.
- [ ] Replacement clears approval; revoke/archive/delete excludes stale versions
      from search/citation resolution immediately while preserving audit history.
- [ ] Public DTOs omit grant administration metadata, raw parser errors and secrets.
- [ ] Hosted database schema/functions/indexes are verified before UI acceptance.
- [ ] Real-document provider use has explicit data-handling, retention, spend and
      tenant enablement approval; until then only local lexical retrieval is usable.
