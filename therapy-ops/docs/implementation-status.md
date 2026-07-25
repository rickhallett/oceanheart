# Implementation status

Updated: 2026-07-25

## Practical state

The local system is implemented and synthetically proven. It remains
`DRAFT_FOR_REVIEW`, `NOT_APPROVED`, and unsuitable for real client data.

No public website route, Google intake Form, calendar invitation, email, shared
client artifact, or AI processor has been activated.

## Proof commits

| Commit | Scope |
| --- | --- |
| `54165ad` | Versioned operating model, configuration, intake definition, and editable client copy |
| `81c2535` | Fail-closed Google Apps Script provisioning and workflow source |
| `0788c73` | Deterministic synthetic client journey and audit evidence |
| `6c513e7` | Privacy-isolated website draft, browser proof, and stale-output protection |

## Verification completed

- Five client-facing drafts validate as one versioned copy set.
- The intake definition contains 27 items.
- The workflow contains eight state transitions.
- The deterministic proof contains 20 audit events.
- Seven automated tests pass.
- The synthetic journey reaches `CLOSED`.
- Unsafe calendar, capture, AI, sharing, activation, and deletion actions are
  rejected.
- The proof performs no external calls and contains no real client data.
- The normal Hugo build excludes `/therapy/`.
- The draft route checker proves no audience analytics, external Google fonts,
  ordinary public-site script, GitHub link, or web form is present.
- Desktop and 390 px mobile browser checks pass with no console errors or
  horizontal overflow.
- The normal build now cleans its destination so stale draft output cannot
  survive a later production build.

## External systems

### Linear

The `Private Therapy Client Operations` project is active as the audit and
approval backlog. Four completed issues map to the proof commits. Eleven
backlog issues contain the remaining practitioner and live-system gates.

See `linear-backlog.md` for the issue map.

### Google Workspace

The connected Drive and Apps Script profile was confirmed as
`kai@oceanheart.ai`.

The disabled draft was provisioned and live-read back on 2026-07-25:

- one private Apps Script project containing six pushed source files;
- five template Docs;
- one system Sheet and one restricted response Sheet;
- one intake Form that visibly reports it is not accepting responses;
- owner-only Drive permissions with no external collaborators; and
- one coded synthetic client with separate Admin, Clinical, and Shared
  folders.

The live rehearsal reached `CLOSED` and recorded 19 audit events. It proved the
urgent-safety, invitation, transcription, AI, sharing, and deletion gates
without sending a Calendar invitation, sharing a file, invoking an AI
processor, or deleting a record. The Clinical folder and AI request table
remain empty.

After evidence capture, the coded client folder was moved to Drive Trash and
all 19 synthetic audit rows plus the synthetic client row were purged. The
live system Sheets are back to header-only state. The draft Form, templates,
system folders, and provisioning source remain available for review.

Deployment identifiers are stored only in ignored local state. The
non-identifying proof packet is
`evidence/live-workspace-rehearsal-proof.json`.

RIC-13 and RIC-14 are complete. The system remains
`NOT_APPROVED_FOR_REAL_CLIENT_USE`; the next work is practitioner approval and
the eSignature, payment, Meet transcription, and processor verification gates.

## Known tooling limitation

The repository build passes with pinned Hugo `0.159.1`. Local
`vercel build --prod` cannot currently complete because Vercel CLI `54.20.1`
expects a macOS Hugo tar archive, while the selected Hugo releases publish a
macOS package. The configuration was left unchanged after confirming this is a
local installer incompatibility. No deployment was attempted.
