# Private Therapy Operations

This directory is the versioned source of truth for a low-overhead private
therapy operations workflow built around Google Workspace.

Everything here is either configuration, editable draft copy, deterministic
workflow code, or synthetic test evidence. Real client information must never
be committed to this repository.

## Current status

- Copy version: `v0.1.0`
- Copy status: `DRAFT_FOR_REVIEW`
- Data status: synthetic only
- Operational status: not approved for real client use
- Workspace deployment status: not provisioned
- Website status: review-only draft, excluded from the production build

## Intended workflow

1. Record an enquiry without clinical detail.
2. Confirm suitability manually.
3. Send the private intake form.
4. Generate the client document pack.
5. Record agreement signature and payment manually.
6. Create the first Google Meet session only when every gate passes.
7. Check capture consent at each session.
8. Use approved AI tools only for the purposes the client has agreed to.
9. Keep administrative, clinical, and client-visible records separate.
10. Close the record through an explicit retention review.

## Source layout

- `config/`: editable service and policy settings.
- `copy/`: versioned client-facing wording.
- `forms/`: declarative Google Form definitions.
- `schemas/`: states, transitions, and gate definitions.
- `docs/`: operating model, data map, and review notes.
- `apps-script/`: generated Google Apps Script deployment source.
- `tests/`: synthetic unit and end-to-end tests.
- `evidence/`: deterministic synthetic proof packets.

The optional public entry point is kept at `content/therapy.md`. It is a Hugo
draft with analytics, external fonts, indexing, and web forms disabled.

## Review boundary

Draft language is deliberately encapsulated outside the automation code.
Reviewers can change the Markdown and JSON sources without editing workflow
logic. A build step validates the sources and generates the Apps Script
catalog.

Before real use, the practitioner must approve the clinical model and obtain
any required professional, insurance, data-protection, and legal review.

## One-command local proof

```sh
npm run proof
```

This validates the source catalog, regenerates the Apps Script catalog, runs a
synthetic end-to-end onboarding and closure, writes the deterministic proof
packet, and runs the test suite. It does not call Google or use real client
data.
