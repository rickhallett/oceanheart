# Operating model

Status: Draft for review

## Objective

Provide a repeatable Google Workspace workflow for UK adult remote individual
therapy without building a clinical portal or custom database.

The first operational target is one real client after professional approval.
The first technical target is a fully synthetic end-to-end rehearsal.

## Authority boundaries

### Deterministic automation owns

- identifier generation;
- folder and document creation;
- state-transition checks;
- consent-version and agreement-version recording;
- payment and scheduling status;
- access-control requests;
- transcript registration and retention dates;
- audit events;
- synthetic verification.

### AI-assisted workflows may propose

- intake summaries;
- provisional formulation drafts;
- treatment-plan drafts;
- progress-review drafts;
- report and letter drafts;
- client-visible summaries, diagrams, and exercises;
- questions arising from missing or contradictory information.

### The practitioner always owns

- suitability;
- clinical formulation and treatment decisions;
- diagnosis;
- risk and safeguarding decisions;
- confidentiality and disclosure decisions;
- approval of notes, reports, letters, and shared material;
- consent conversations;
- exceptions, complaints, and closure;
- final deletion approval.

## Record separation

Each client receives a generated coded identifier. Names do not appear in
Calendar titles, Meet titles, clinical filenames, or audit summaries.

The proposed client record contains:

1. `Admin`: identifiable intake, agreement, invoice, payment, and contact data.
2. `Clinical`: notes, transcripts, formulations, risk records, and private
   professional drafts.
3. `Shared`: material deliberately shared with the client.

The automation must not copy from `Clinical` to `Shared` without an explicit
practitioner approval.

## Copy and configuration

Client-facing language is versioned in `copy/<version>/`. Service-specific
values are stored in `config/service.json`.

The workflow code consumes a generated catalog. It must not contain independent
copies of the agreement, privacy notice, consent wording, or intake questions.
This keeps later review and editing tractable.

## Audit model

Audit events contain:

- timestamp;
- coded client identifier;
- action;
- previous and next state where relevant;
- copy or consent version;
- actor type;
- result;
- non-clinical reason code.

Audit events must not contain names, addresses, intake answers, transcripts,
clinical summaries, risk narratives, or secrets.

## Human-in-the-loop gates

The system fails closed when a required field, decision, version, consent,
processor, purpose, or approval is missing.

Automated reminders may be sent, but clinical communications, disclosures,
file sharing, and deletion require practitioner approval.

## Operational approval checklist

Before real use:

- professional status and service scope confirmed;
- supervision arrangement confirmed;
- insurer confirms remote therapy, transcription, and proposed AI use;
- legal and data-protection bases confirmed;
- retention periods confirmed;
- approved processor schedule completed;
- Workspace edition and administrator controls verified;
- copy placeholders resolved;
- synthetic end-to-end evidence passes;
- practitioner signs the release checklist.
