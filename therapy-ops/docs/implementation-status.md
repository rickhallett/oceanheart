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

The connected Drive profile was confirmed as `kai@oceanheart.ai`.

Live draft provisioning did not proceed because:

- the current Google Drive connection lacks write scope;
- the local machine has no Google Apps Script authentication file; and
- the available connector does not create Google Forms or Apps Script
  projects.

One attempted creation of a clearly marked draft root folder was rejected by
Google before any Drive artifact was created. No repeated or alternative write
attempt was made.

The next operational action is RIC-13: authorize the intended Workspace
provisioning route, create the draft artifacts with intake disabled, then
complete the synthetic rehearsal in RIC-14.

## Known tooling limitation

The repository build passes with pinned Hugo `0.159.1`. Local
`vercel build --prod` cannot currently complete because Vercel CLI `54.20.1`
expects a macOS Hugo tar archive, while the selected Hugo releases publish a
macOS package. The configuration was left unchanged after confirming this is a
local installer incompatibility. No deployment was attempted.
