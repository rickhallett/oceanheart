+++
title = "How the agent system overgrew"
date = "2026-08-09"
description = "Twelve days of agent-assisted governance work on a personal operating system, and the audit numbers that ended it."
tags = ["agents", "agent-os", "engineering-judgment"]
draft = true
+++

Series part 1 of 5. Raw material, not finished prose.

## The one-line version

Agent OS grew from 1,966 source lines to 24,772 in twelve days, and the
audit that stopped it found the growth was mostly the system describing,
registering, and supervising itself. `[src: transcript c5e30d02, audit
relay]`

Kai's own framing, said the next day while arguing about attribution:

> a forest fire level reduction of a previous agentic run that had agents
> at every level confirming runtime state but in reality the output was
> more like a viral epidemic

`[Kai, verbatim, transcript c5e30d02 turn ~1678]`

## Timeline of the growth

- 2026-07-28 20:49. Root commit `454dbf7`, "Establish minimum Agent OS
  control plane". Event-sourced authority engine, synthetic proof,
  operator blueprint. 1,966 source lines. `[src: git agent-os 454dbf7]`
- 2026-07-28, four more commits before 21:16: machine-wide awareness,
  Oceanheart registration, Orient temporal spine. Governance about the
  governance existed within 27 minutes of the first commit.
  `[src: git agent-os log]`
- 2026-07-29: 27 commits. 2026-07-30: 27 commits. `[src: git agent-os log]`
- 2026-08-02: `d8a5b60`, "Simplify active context truth". 715 insertions,
  7,519 deletions. Mandatory context cut by 86 percent with no runtime
  behaviour change. `[src: git agent-os d8a5b60]`
- 2026-08-02 to 08-08: 5,074 insertions, 26 deletions, 23 files.
  `[src: git diff d8a5b60..aec8e54]`
- 2026-08-08: audit, bound to clean locked main at `aec8e54`. Freeze
  declared. `[src: transcript c5e30d02, audit relay]`
- 2026-08-08 21:03: last commit on the repository, `a30b7c2`. Total life
  of the codebase: 87 commits over 12 days. `[src: git agent-os log]`

## The end-state numbers

All from the 2026-08-08 audit, bound to `aec8e54`. Nothing was mutated
during the audit. `[src: transcript c5e30d02, audit relay]`

- 41 blueprint components with 39 distinct `kind` values.
- 75 relationships with 69 distinct `type` values. The audit's phrase:
  "nearly a bespoke concept for every instance."
- Blueprint file: 1,952 lines of JSON.
- Source: 24,772 lines. Tests: 13,364 lines (from 495 at root).
- CLI: 2,348 lines, roughly 55 leaf commands.
- Mandatory reading path (README, architecture, roadmap, blueprint):
  approximately 18,400 words.
- 331 support tests, all passing. The engine worked.
- At least five separate integrity-recording formats: the main
  EventStore, the Main Thread Directory, the development log, the Extra
  Rations ledger, and AOS process receipts.
- Worktrees: the first live read reported 22 registered feature
  worktrees; the final verdict counted 23 registered, 11 dirty, 10
  unmerged. The count moved during the audit, which is itself a finding.

Sample of the 69 relationship types, verbatim from the registry, as
evidence of the vocabulary problem: `future-bounded-positive-hci-evidence-source`,
`active-read-only-public-cli-evidence-source`,
`owns-candidate-bidirectional-domain-adapter`,
`provides-purpose-bound-accepted-context`,
`hosts-discoverable-read-only-operational-skill`,
`operating-relationship-deferred`.
`[src: config/operator-blueprint.json at aec8e54]`

## What Kai asked for, verbatim

The audit prompt was dictated, unpunctuated, and diagnosed the disease
before the diagnosis ran:

> Conduct a wide and deep review on all of the layers within agent os how
> they are implemented paying particular attention to the fact that
> because this is being built organically there is a chance that
> governance is being layered on top of governance layered on top of
> governors etc and so on with redundancy and wastage potentially
> duplication or even contradiction ... watching for agentic inflation
> and keeping the elegant parts of what works and courageously dumping
> deleting burning what might have been a good idea but isn't needed
> anymore and if it was needed in the future could be reconstructed
> anyway both either from need and or the git history

`[Kai, verbatim, transcript c5e30d02 turn ~3]`

## The audit's verdict, in its own words

Agent-authored, relayed by Kai. Quoted because the phrasing is sharp:

- "Agent OS has materially suffered from conceptual, governance,
  documentation, and code sprawl."
- "The good news is that its centre is real."
- "The problem is that this small machine now sits inside a much larger
  governance laboratory. Successive ideas have usually been added beside
  their predecessors instead of replacing them."
- "Safety has not primarily failed. Current truth, operator efficiency,
  comprehensibility, and change cost have."
- "Repetition at independent enforcement boundaries is valuable.
  Repeating prose in five places is not defence in depth."
- Plain-English closer: "Agent OS has a good small engine. The project
  kept building scaffolding around it and rarely took the old scaffolding
  down."

`[src: transcript c5e30d02, audit relay]`

## Where the recursion actually lived

The same authority rules appeared across thirteen surfaces: machine
policy, repository instructions, README and architecture, roadmap,
blueprint prose, development-log decisions, specialized policy documents,
event contracts, semantic validators, store constraints, domain runners,
tests, and the main guard. `[src: transcript c5e30d02, audit relay]`

Three parallel lifecycle kernels coexisted:

- the original nine-event capsule engine used by the README proof,
- a dedicated six-event Todoist actuator lifecycle,
- a 24-event Orient lifecycle.

Plus two checkpoint decision paths, with the semantic validator
explicitly accepting both legacy and structured decisions.
`[src: transcript c5e30d02, audit relay]`

Named sprawl objects worth keeping in the piece:

- `zero_effect_continuation`: 1,240 source lines, 853 test lines, five
  CLI commands, its own event types, written for one narrow replacement
  incident. No corresponding events were found in any store. It governed
  a thing that never happened.
- Development log: 1,091 implementation lines, 905 test lines, a
  1,160-line data file, trigger config, CLI machinery. Its staged
  assessment was never installed as a Git hook. It contained accepted
  contracts referencing files that had since been deleted.
- Operator surfaces answering "what needs my attention?": `current-work`,
  `operator-surface`, `operator-checkpoint`, checkpoint channel, Daily
  Control, Developer Journal, Codex tasks, Todoist, and a candidate
  Cockpit. Nine surfaces, one question.
- Jobpipe and Oceanheart orchestration: 850 and 1,397 lines with roughly
  485 matching lines between them.

## Contradictions the audit surfaced

These matter more than the line counts, because they are the point at
which a governance layer stops being merely expensive and starts being
wrong. `[src: transcript c5e30d02, audit relay]`

- Architecture said the blueprint owns component ownership and authority.
  The component schema had neither `owner` nor `removal_path`. The
  roadmap required both as an exit gate.
- The blueprint reported zero discrepancies while nine components were
  unprobed and five workspaces unregistered. Its probes established
  structural presence, not health.
- A global blueprint-discrepancy check could block an otherwise exact
  Jobpipe or Oceanheart dispatch. Unrelated topology had become an
  ambient governor.
- Jobpipe treated any dirty sibling worktree as evidence of an active
  writer.
- The repository Calendar policy permitted bundled approval; machine
  policy required separate confirmation. Split brain.
- The routing document said automated usage capture was unimplemented.
  launchd was running a usage collector every 900 seconds, from untracked
  files in an old dirty worktree, with 219 runs in the current launch
  cycle and a latest exit code of 1. Its last good artifact was from
  2 August.
- The installed primary-main guard executable and the repository source
  had different hashes. The checkout was protected, but the repository
  was not provably the source of its own live enforcement.

That last pair is the honest headline: the system built to guarantee that
declared state matched live state could not do it for itself.

## Mechanisms of accretion

Candidate list. Each is falsifiable against the repo or the transcript.

**1. Starting meta-work costs almost nothing.** With agents, the distance
from "that should be governed" to a committed, tested, documented
governance layer is one dictated sentence. 27 commits in a day is not
typing speed; it is the marginal cost of a new subsystem falling below
the cost of deciding not to build it.

**2. Every idea became a spec within the hour.** The clearest signature in
the log is the paired commit: an idea lands, then a second commit
propagates it into the governance surfaces.
`a84b1f9` "Add intent and delegation roadmap stage" at 09:22, then
`5345534` "Integrate intent delegation stage" at 11:45.
`b79a9ef` "Add append-only development log capture" at 09:28, then
`93c13c9` "Integrate append-only development log" at 11:28.
`6d13739` "Register operational skills" at 09:28, then `54e7444`
"Integrate operational skills" at 11:36. Ten commits in the log carry
"Integrate" or "integrated" in the subject.
`[src: git agent-os log, 2026-07-29]`

**3. The map charged rent.** 44 of 87 commits touched
`config/operator-blueprint.json`. 48 of 87 touched `README.md`. Every
second change had to update the system's description of itself before it
counted as done. `[src: git agent-os log]`

**4. Instrumentation counted meta-progress and nothing else.** The
Developer Journal ran a roughly 9 KB prompt twice daily across every
project worktree and up to 50 tasks. The audit called it "an expensive
observer, not a governor", and noted Agent OS could not prove missed
runs, duplicate runs, restart behaviour, or durable invocation receipts.
The usage collector counted tokens. The blueprint counted components. All
three metrics went up when the meta-layer grew.
`[src: transcript c5e30d02, audit relay]`

**5. The declared-mode telemetry shows the tilt.** Week of 2026-08-02 to
08-09: 834 declared turns across 220 agent sessions and 364 work blocks.
225 of those turns were declared BLUE, the agent-infrastructure mode. On
2026-08-08, the audit day, 63 of 159 turns were BLUE. Of roughly 100
machine-block-hours in that week, about 72 went to agent-os itself.
`[src: week activity collection, 2026-08-09]`

**6. Building is the soothing mode.** Named in the audit, drawn from
Kai's own earlier directed-intensity work, and recorded as freeze
rationale: "When the object level rejects you, the meta level always
accepts another commit. That makes system-building the most seductive
form of avoidance available to you, precisely because it is genuinely
productive." `[src: transcript c5e30d02, audit relay; banked candidates
2026-08-08]`

## The simplification that did not hold

This is the strongest single fact in the article, because it removes the
"we just needed to tidy up" explanation.

- 2026-08-02, `d8a5b60`: 7,519 lines deleted, mandatory context down 86
  percent, no runtime behaviour changed. A real, disciplined cut.
- The six days after: 5,074 insertions and 26 deletions across 23 files.
- Audit phrasing: "The accretion pattern resumed almost immediately."

`[src: git agent-os d8a5b60..aec8e54; transcript c5e30d02, audit relay]`

The conclusion recorded in the freeze document is that a cut which is not
mechanically defended is a pause, not a fix. Hence the later insistence
on ratchets, one-way ceilings enforced by tests rather than by intention.
`[src: banked candidates 2026-08-08]`

## What the operator seat felt like

From Kai's own turns, not reconstructed.

On the goal:

> I want this project, Agent OS itself, to be hiring signal. I want it to
> be the capstone an example of disciplined engineering itself the result
> of a forest fire level reduction of a previous agentic run

`[Kai, verbatim, transcript c5e30d02 turn ~1678]`

On what the old system had decayed into:

> we are using it to tell the story of rebuilding an agent facing
> interface which is the descendant with agents going mad and what
> happens when human in the loop and validation becomes a ceremonious
> passive process that looks disciplined but is really just not sure how
> to describe it but it's not doesn't work and it isn't what we're after

`[Kai, verbatim, transcript c5e30d02 turn ~1684]`

On the bidirectional nature of the failure, which is the part most
write-ups would miss:

> it's not just an agentic phenomena it's an agentic phenomena as from
> that is in some ways downstream from the human computer interface
> although of course it's actually a bi-directional feedback loop

`[Kai, verbatim, transcript c5e30d02 turn ~1691]`

Also his instruction that the history be recorded live rather than
reconstructed: "The history of this must be recorded as it is happening.
The nuances can never be reconstructed."
`[Kai, verbatim, transcript c5e30d02 turn ~1684]`

## What earned its keep

The audit's KEEP list, worth stating because the piece is not an argument
that the work was wasted:

- The transactional EventStore: immutable rows, semantic validation, hash
  chaining, idempotency constraints, chain verification.
- Exact accepted intent before consequential action.
- Provider claims kept separate from observation, reconciliation, and
  human evidence acceptance.
- Uncertainty never granting replay permission.
- The filesystem-enforced primary-main guard. "Defence at a real mutation
  boundary, not ceremony."
- One compact operator projection with Brief and Audit renderings.

`[src: transcript c5e30d02, audit relay]`

The freeze wording, recorded 2026-08-08: run the machine, do not improve
it. Cuts were banked rather than executed, precisely because the previous
cut had not held. `[src: banked candidates 2026-08-08]`

## Attribution note (keep in the published piece)

Agents generated the implementation. Kai specified, judged, authorized,
and audited. His correction, when an agent over-credited him:

> I don't think in typed payload with validators. I talk to agents that
> think in typed payloads validators.

`[Kai, verbatim, transcript c5e30d02 turn ~1678]`

Repository authorship is consistent with this: 87 commits, all with Kai
as author, 77 of them carrying a Codex co-author trailer.
`[src: git agent-os log]`

## Loose fragments

- Eighty-seven commits. Thirty-three of them prefixed `docs`, `meta`, or
  `chore`. `[src: git agent-os log]`
- The `aos` dispatcher, "a thin, registry-backed front door over
  independently owned local CLIs", was added on 2026-08-04, six days into
  a twelve-day project, because the command surface had already outgrown
  discovery. `[src: git agent-os 7ca52bd; README at aec8e54]`
- The roadmap had nine numbered stages (0 through 8) plus four
  independent side tracks plus a promotion-gate section, and the roadmap
  inspector could no longer identify a current stage or an immediate next
  build. `[src: docs/development-roadmap.md at aec8e54; transcript
  c5e30d02, audit relay]`
- The development log validated clean while containing obsolete accepted
  contracts pointing at deleted files.
- Nothing here is a story about agents behaving unsafely. The audit found
  no immediate unauthorized-effect evidence. The failure was legibility
  and change cost, which is the failure mode that does not trip an alarm.

<!-- SOURCES (REMOVE BEFORE PUBLISH)
- /Users/mrkai/.claude/projects/-Users-mrkai-work-agent-os/c5e30d02-e283-41c3-9137-6ab14b9595c9.jsonl
  Primary source. Turn ~1 through ~640 is Kai's relay of the 2026-08-08
  governance audit (agent-authored text, pasted by Kai): verdict table,
  evidence snapshot, recursion list, sprawl examples, live defects,
  reduction map, freeze recommendation. Turns ~1678, ~1684, ~1691 are
  Kai's own dictated words (viral epidemic, attribution correction,
  history discipline, bidirectional HCI point).
- /Users/mrkai/work/agent-os (read-only archive). git log, git show
  aec8e54:config/operator-blueprint.json, git diff d8a5b60..aec8e54,
  git show --stat d8a5b60, README.md and docs/*.md at aec8e54.
  Counts verified directly: 87 commits, 44 blueprint-touching, 48
  README-touching, 10 "Integrate" subjects, 77 Codex co-author trailers.
- /Users/mrkai/vault/agent-os/proposals/2026-08-08-banked-simplification-candidates.md
  Freeze rationale, soothing-mode framing, A1-A10 deferred surgery,
  B1-B6 design candidates, decision rule.
- /Users/mrkai/.claude/projects/-Users-mrkai-work-agent-os/memory/aos-kernel-capstone-goal.md
  Verbatim "viral epidemic" line and the attribution constraint.
- /Users/mrkai/.claude/projects/-Users-mrkai-work-agent-os/memory/agent-os-simplification-freeze.md
  Freeze status, route decision, banked-candidate index.
- /private/tmp/claude-501/.../scratchpad/week-activity.md
  Declared-turn counts per day (834 total, 225 BLUE), lane totals
  (agent-os 72.1 h of ~100 machine-block-hours).
- NOT USED, deliberately: 34de194e-a3d4-43df-8ade-d0b7c7bcd25e.jsonl
  (family content, out of scope per privacy rules), and the personal
  leverage-ranking section of c5e30d02 (financial, family, clinical).
  The soothing-mode fragment is included because it is the operating
  mechanism behind accretion and appears in the engineering freeze
  record; cut it if it reads as too personal.
-->
