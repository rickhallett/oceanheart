# Knowledge and workflow UI review — 10 September 2026

Owner: Flint. Branch: feat/studio-knowledge-ui. Base: dfaa1ef369c10c053ea6edd52c87d641182ee06d. Tracking: RIC-121.

## Design

Knowledge now separates Documents, Ask your library and Tasks. Document text is the main editing surface; file import and provenance are optional details. A plain “Use in answers” switch expresses the existing version approval contract. Answers retain source citations; exact task review remains explicit. IDs, hashes and model usage counters no longer compete with the workflow. Section navigation preserves an unsaved document draft.

Assistant opens the working answer interface. Support provides practical workflow guidance and contact links. Website, portal, shop, payments and roadmap destinations have useful contextual next actions instead of a generic disconnected message. These pages do not implement or imply new publishing, portal, commerce or live-payment capabilities.

Precision white, blue and neutral palette retained. No decorative cards, gradients, shadows or rotated text introduced.

## Mobbin research provenance

Silver performed genuine Mobbin MCP searches and inspected these references before the Captain transferred all implementation to Flint. Flint used this handoff; no claim of a separate root MCP search is made.

- [Dropbox document library](https://mobbin.com/screens/c8aa4f5f-a9e5-4ae1-8ae8-7f11da7ee922): document-first browsing.
- [Aboard documents](https://mobbin.com/screens/b38d9f42-f229-48ea-926d-de52bb6bbca4): clear document hierarchy.
- [Gemini Notebook](https://mobbin.com/screens/6c434e95-b9b4-47b3-b4ad-06a9b8e3192a): sources separate from question composition.
- [ChatGPT sources](https://mobbin.com/screens/73833b79-1dd5-4354-8fc4-a2e99c33a75e): supporting citations beside the answer.

## Local audit and evidence

Authenticated local app on port 4343, using existing staging backend. All live navigation destinations inspected. Today, enquiry list/detail, bookings, clients, tasks and services retain their existing refined layouts. Setup/Settings hours checkbox alignment and task-form spacing corrected. Knowledge, Assistant, Support and the five contextual destinations updated.

- Desktop rendered inspection: Knowledge list/editor/answer, Support, Today, enquiry detail and existing core screens. Remaining destination headings, content and document widths checked through the actual navigation.
- 320px visual inspection: Knowledge list, editor, answer composer, task completion and Support. Long real synthetic document title reproduced horizontal overflow; scoped wrapping correction verified visually. 400px Setup inspected, no overflow; hours checkbox confirmed as a row.
- Synthetic document save, Use in answers, matching-text query and source text exercised against staging. No AI request needed for this UI check. Existing synthetic demo practice only; no production data.
- Unsaved document title survived Documents → Ask your library → Documents; cancelled without saving.
- Focused source-library, cited-answer and task-approval tests: 23/23 PASS. Existing tenant/currentness, immutable payload, retry and approval assertions preserved.
- Production build and TypeScript PASS. Final focused typecheck recorded at handoff.
- CodeRabbit CLI 0.7.6 is signed out; no authentication or external review attempted. Flint reviewed the material diff directly. No delegated implementation or review.

## Environment and release boundaries

No database impact from this UI change: no backend source, schema, indexes or data migration changes. During local inspection, staging was missing the already-reviewed payments availability function; the unchanged accepted backend baseline was deployed to existing charming-albatross-632 and Bookings then loaded correctly. This is staging alignment, not a new UI backend contract.

Local preview: http://127.0.0.1:4343/app/knowledge . Production untouched. Captain visual review remains the release gate. This audit covers authenticated Precision; it does not claim a fresh exhaustive audit of the separate browser-demo dataset or every error combination.
