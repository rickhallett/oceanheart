# Draft data map

Status: Draft for review

## Principles

- Collect the minimum information needed for a named purpose.
- Keep identifying administration separate from clinical material.
- Use coded identifiers in operational logs and Calendar or Meet titles.
- Do not store payment-card details.
- Do not place real client information in Git, test fixtures, Linear, build
  output, application logs, or public web analytics.
- Treat transcripts and AI-derived material as clinical records.

## Proposed flows

| Stage | Information | Source | Destination | Access | Review or deletion trigger |
| --- | --- | --- | --- | --- | --- |
| Enquiry | Name, safe contact route, minimal request | Client | Admin record | Practitioner | Suitability decision |
| Suitability | Scope and decision, no detailed narrative | Practitioner | Admin record | Practitioner | Intake invitation or referral |
| Intake | Identity, contact, GP, emergency, practical and brief clinical data | Client Form | Response Sheet and Admin folder | Practitioner | Agreement preparation |
| Agreement | Terms, versions, signatures | Client and practitioner | Admin folder | Practitioner, client signer | Version change or closure |
| Payment | Invoice and payment status | Practitioner or payment provider | Admin record | Practitioner | Reconciliation and retention |
| Session | Coded event, time, Meet link | Practitioner | Calendar | Practitioner and client | Session or cancellation |
| Capture check | Consent version, per-session choices, approved purposes | Practitioner with client | System record | Practitioner | Each session |
| Transcript | Spoken words | Google Meet | Clinical folder | Practitioner | Transcript retention review |
| AI-supported draft | Approved record subset and purpose | Practitioner | Approved processor, then Clinical folder | Practitioner | Human review and retention |
| Shared work | Approved goals, diagrams, exercises, summaries | Practitioner and client | Shared folder | Practitioner and client | Closure export |
| Closure | Outcome, open actions, retention dates | Practitioner | Admin and Clinical records | Practitioner | Scheduled retention review |

## Processor register fields

For every processor or subprocessor, record:

- legal entity and product;
- purpose;
- data categories;
- contract or data-processing terms;
- model-training treatment;
- retention and deletion controls;
- geographic processing and transfer mechanism;
- access and authentication controls;
- incident-notification route;
- approval date and reviewer.

## Open decisions

- Final Article 6 lawful basis.
- Final Article 9 condition.
- Whether transcription is optional or integral to this service.
- Manual alternative or referral path when transcription or AI is declined.
- Administrative, clinical, and transcript retention periods.
- Workspace edition, Vault availability, and data-region controls.
- Final emergency and urgent-care wording.
- Final complaints and professional-body information.
