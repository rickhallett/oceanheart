+++
title = "The kernel design: ledger, loop, projection, adapters, ratchets"
date = "2026-08-09"
description = "The accepted design of the aos-kernel and the arguments behind each part, taken from the spec and the session it was argued in."
tags = ["agents", "agent-os", "engineering-judgment"]
draft = true
+++

Part 3 of 5. Scope: spec `aos-kernel-spec-2026-08-09-v1.0`, accepted
2026-08-09, and the reasoning that produced it.

Attribution, stated once and applying to everything below: agents
generated the implementation and drafted the spec text. The operator
specified, judged, authorized, and audited. Verbatim, on the
over-attribution that triggered the rule: "I don't think in typed
payload with validators. I talk to agents that think in typed payloads
validators." [Kai, verbatim, src: transcript c5e30d02]

## The two jobs, and the list of things it refuses to be

Two jobs only. Reorientation: answer "what is true, what is fixed, what
is the mission, what needs a decision" cheaply and accurately, on
demand. Safe consequential action: external effects through exact
accepted intent, a single write, verified readback, honest terminal
states. The kernel makes no model calls; it is the tool surface called
BY model agents, which are its expected operators. [src:
kernel-spec-v1.0 s1]

Permanent non-goals: scheduling and daemons, ambient ingestion,
transcript capture, multi-agent shared state, component registries or
blueprints, role directories, budget enforcement, receipts outside the
ledger, workflow generality, prediction or plan enforcement, and any
LLM-calling machinery. Admission rule for any future component: a named
incident it would have prevented, or a named consumer that reads it at
least weekly. Otherwise it goes to a banked-candidates file, not to
code. [src: kernel-spec-v1.0 s1]

## The ledger

One append-only, hash-chained SQLite database. WAL, `busy_timeout`,
every append inside `BEGIN IMMEDIATE`. Single writer assumed: the
timeout plus immediate transactions make concurrent invocation safe,
not fast. [src: kernel-spec-v1.0 s3]

Exactly eight event types: `proposed`, `accepted`, `dispatched`,
`observed`, `reconciled`, `decided`, `terminated_uncertain`, `noted`.
The load-bearing sentence: domains never add event types, they add
payload kinds. "This rule is what prevents a second store from ever
existing." [src: kernel-spec-v1.0 s3.1]

Two SQLite triggers abort UPDATE and DELETE at the database layer.
`UNIQUE (action_id, event_type)` is what holds the single-write
invariant even across a crashed process. [src: kernel-spec-v1.0 s3.1,
s4.4]

### Hashing, not encryption

The operator's first pass through this used the word encryption. The
corrected formulation is in the crib: "Hashing, never encryption:
SHA-256 is a one-way digest, no keys." [src: fluency-crib]

His own second pass, unprompted and graded: "The ledger is an
amend-only SQLite database that has mechanical triggers that fire on
update or delete rows. The forward chaining computational hash would
make all hashes after that row invalid. This is more than
tamper-resistant, this is tamper-evident. The aim here is to make
tampering publicly visible." [Kai, verbatim, src: transcript c5e30d02]

The layering, named as three distinct things rather than one claim
[src: decision ledger-integrity-alternatives]:

- Prevention: the triggers. Bypassable by anyone with SQL access.
- Detection: the chain. Catches any mutation short of a full forward
  rewrite.
- Residual: the full forward rewrite. Accepted under the threat model,
  which is drift and accident on an owned machine. The machine-owner
  adversary is explicitly out of scope.

### The HMAC branch, raised and rejected

Operator raised a keyed HMAC chain, key held in a password manager.
Rejected on four counts [src: decision ledger-integrity-alternatives]:

1. Barely moves the real threat: whoever holds the filesystem almost
   certainly holds the session that unlocks the password manager.
2. Couples the hottest write path to an app's unlock state. Every
   append needs the key, and the kernel must work headless from a
   phone session.
3. Kills anyone-can-verify. The chain audits today with `sqlite3` and
   `hashlib` alone. HMAC buys integrity through secrecy; this project
   wants integrity through publicity. Key loss makes the whole chain
   unverifiable.
4. Dominated on every axis by the alternative that arrived minutes
   later.

### The external witness

Operator, unprompted, mid-walkthrough:

"Also, if it is pushed to a repository So the current chain hash is
outside the database and me via another account or another machine
fork that repository Would they become time stamped proofs? The person
who has file system can falsify my ledger. We would know by comparing
the current head hash and its history against the fork?" [Kai,
verbatim, src: transcript c5e30d02]

He then reversed a standing project decision on the spot:

"Before I do, pushing it to a private repository is so trivially simple
that the decision to not do that now even at project start is
indefensible and I want it changed." [Kai, verbatim, src: transcript
c5e30d02]

What that reversed: spec v0.1 had no remote. The no-remote default was
inherited caution from earlier auto-deploy incidents on a public site
repo, and it did not apply to a fresh private repo with no deploy
wiring. [src: decision ledger-integrity-alternatives; src:
kernel-spec-v0.1 s2]

What it bought, in the accepted spec: a private git remote from project
start, treated as tamper witness and backup, not publication. A
`Ledger-Head: <hash>` trailer on every commit from the end of slice 1,
so each push anchors the chain outside the machine. [src:
kernel-spec-v1.0 s2, s11]

Honest scope, recorded rather than glossed [src: decision
ledger-integrity-alternatives]:

- A private remote reachable from the same machine session is a weak
  witness against an attacker who owns that session.
- Server-side force-push protection narrows silent rewrite but does not
  eliminate it.
- The full witness, a fork held under an independent account, stays
  banked until publication or an incident earns it.
- The operator's own refinement: anchors in independently held git
  history are existence-and-order proofs, not clock proofs.

His articulation of what the witness catches, from the walkthrough:
restore a week-old backup and `aos verify` will tell you the file in
front of it is internally valid and uncorrupted. "What it cannot tell
you is that a whole week of history was wiped out, because to a local
verification check, a restored week-old log looks identical to a system
that simply ran no actions for seven days unless you compare it against
an offsite fork witness." [Kai, verbatim, src: transcript c5e30d02]

### The 403, recorded in the spec

Slice 0 attempted branch protection with force-push disabled. GitHub
gates branch protection on private repositories behind a paid plan. The
attempt was refused with a 403. The spec now says so, inline, in the
same paragraph that claims the protection: the lock "activates at no
cost the moment the repo goes public, or earlier with a plan upgrade.
Until then the remote append-only rule is convention plus the server
reflog, not enforcement." [src: kernel-spec-v1.0 s2]

The spec's integrity claim was the first place the project could have
quietly overstated itself. It is instead the first recorded
imperfection.

### Transcripts stay out

Four edges [src: decision transcripts-out-of-ledger]: meaning
(recording what was said reintroduces the ambiguity validation theater
grows in), publishability (typed events can be shown publicly,
transcripts never can), scale (dialogue would bury the decisions and
baselines the projection lives on), and ownership (dialogue already has
a bounded, consent-governed home elsewhere). Cost accepted: the ledger
does not carry the conversational why. The operator found the gap that
creates, that ledger-to-corpus auditing degrades to fuzzy time-window
matching, and the fix landed pre-acceptance: one optional `session_ref`
field, refs only, never content. [src: kernel-spec-v1.0 s4.2]

## The action loop

One state machine, no variants. An action is the set of ledger events
sharing an `action_id`. Transitions [src: kernel-spec-v1.0 s4.1]:

    proposed  -> accepted | decided(rejected) | terminated_uncertain
    accepted  -> dispatched | terminated_uncertain
    dispatched -> observed
    observed  -> reconciled
    reconciled -> decided | terminated_uncertain

Terminal states: `decided`, `terminated_uncertain`. Nothing exits a
terminal state. Uncertainty never authorizes retry, correction,
replacement, or client communication. "There is no continuation
subsystem." [src: kernel-spec-v1.0 s4.1]

The operator's own account of the human pause: "the human is the judge
and the machine is only the clerk. The human must read the exact
rendered payload and explicitly authorize it before anything is allowed
to touch the outside world." [Kai, verbatim, src: transcript c5e30d02]

Two gates sit on the accepted-to-dispatched edge and guard different
things. His distinction:

- The drift gate re-reads external state and catches the world moving.
- The 24-hour acceptance expiry catches human intent moving. "A payload
  accepted yesterday was approved under yesterday's calendar, energy,
  and priorities. Even if the external system state hasn't drifted by a
  single byte in twenty-four hours, the human context surrounding that
  action has expired." [Kai, verbatim, src: transcript c5e30d02]

Why no retry, compressed: a retry executes a stale yes, compounds
ambiguity, and is judgment delegated to a loop. "The system recovers by
looking, never by re-doing." Also: "Two yeses wrap one write; every
write is followed by a read; the only exit from confusion is death."
And at reconciliation, the machine compares while the human accepts the
comparison: eyeballs spent on judgment, never on diffing. [src:
fluency-crib]

Class rule, simplified during the muster: non-self effect is
`protected`, self-only is `standard`. Adapter schemas are the concrete
authority. Agents do not escalate standard to protected by keyword
matching. Ambiguous class is stated in the readback and settled by the
operator's acceptance. [src: kernel-spec-v1.0 s4.2]

Scope bound, added as muster item M1 and the most dangerous line that
was NOT in the draft spec: the lifecycle governs external effects at
runtime only; development work on the kernel is ordinary engineering.
Left unbounded, agents pattern-match and start proposing and accepting
for code edits, which is exactly the disease the project exists to
document. [src: transcript c5e30d02; src: kernel-spec-v1.0 s4]

## The projection

`aos now [--audit] [--as-of TIMESTAMP]`. Derived fresh every call.
Four sections: TRUE NOW, FIXED, MISSIONS, DECISIONS. Writes nothing.
[src: kernel-spec-v1.0 s7]

Spec line worth lifting whole: the projection "must always be cheaper
to discard and rebuild than to edit." [src: kernel-spec-v1.0 s7]

Operator, on why storage is forbidden: "storing a projection creates a
second source of truth, and that is how systems go to shit. The moment
you write derived state to a file, you introduce cache invalidation
nightmares and open the door for someone to edit the view instead of
the history." [Kai, verbatim, src: transcript c5e30d02]

Three crib formulations that carry more than the spec text does [src:
fluency-crib]:

- "The ledger remembers, the projection looks. Anything that does both
  eventually lies."
- "For agents, context is execution: a stored projection is a log that
  gets executed as belief." (Kai's, polished in session.)
- "The system makes no assumptions about the size of the external
  world, and therefore none about how fast it changes." (Kai's, on why
  the projection commits to no refresh rate.)

Worked probe from the walkthrough: the calendar shows a dinner the
ledger has not observed. The answer is not to patch the view. The
adapter runs `read_state`, hands the evidence to the kernel, and the
projection reflects it on the next call. "You don't guess, and you
don't hack the view." [Kai, verbatim, src: transcript c5e30d02]

## Adapters

Five methods, stateless, one per domain [src: kernel-spec-v1.0 s5]:

    read_state(ref) -> dict
    render_readback(payload) -> str
    execute(payload) -> dict
    read_back(payload, write_result) -> dict
    compare(payload, observed) -> list[str]

The operator's definition, verbatim and now the line the spec is
described with: "An adapter is the kernel's hands and eyes in one
domain, and never its brain." [Kai, verbatim, src: transcript c5e30d02]

His compression of the contract: "an adapter can be wrong, but it
cannot be sneaky." Adapters hold no state, never touch the ledger,
never loop, never retry, never write outside the single `execute`.
Deleting an adapter deletes no history. [Kai, verbatim, src: transcript
c5e30d02; src: kernel-spec-v1.0 s5]

`compare` returns mismatched fields and makes zero decisions on that
data. His reason, two barrels [src: fluency-crib]:

1. Decoupling and single authority: the kernel core changes without
   touching adapters, and there is "a single authority that is never
   distributed against things that change outside the system."
2. Containment: the component exposed to the untrusted outside gets the
   least authority. A compromised adapter can lie in one action's
   evidence but cannot rewrite history.

Four layers catch a silently wrong adapter, in his walkthrough order:
`render_readback` at the human pause, the drift gate before execution,
`read_back` plus `compare` after it, and the kernel declaring
reconciliation failed and halting without retry. Blast radius is one
action; history is untouchable because adapters have no ledger access.
[src: transcript c5e30d02]

Roster at v1.0: calendar (protected when attendees extend beyond self),
Todoist (always standard, full CRUD, delete still requiring its own
accepted proposal), jobpipe (always protected). Ceiling 6, ratcheted.
Calendar first for the richest verification semantics. `artifact_hash`
on a jobpipe dispatch extends the drift gate from state to content: the
accepted message is provably the sent message. [src: kernel-spec-v1.0
s5, s6; src: fluency-crib]

Word correction from the walkthrough, recorded because it was wrong the
first time: readback is deterministic (same payload, same text,
INV-09). Idempotent means safe to repeat, a different property. [src:
fluency-crib]

## Ratchets

A ratchet is a ceiling enforced by a test that only moves down. Raising
one requires a dated decision file in the vault, referenced in the
raising commit. His formulation: "Growth must ask permission in
writing." [src: fluency-crib; src: kernel-spec-v1.0 s10]

The seven, shipped in the genesis commit before any kernel code existed
[src: git aos-kernel c824659; src: aos-kernel tests/test_ratchets.py]:

    event types            == 8
    payload kinds          <= 16   (7 used)
    CLI leaf commands      <= 12   (10 used)
    adapters               <=  6   (3 used)
    kernel source lines    <= 3000
    third-party imports    ==  0
    README words           <= 2500

Implementation detail that makes them honest: ceilings whose module
does not exist yet skip visibly rather than passing. At genesis the
suite ran 7 tests, 3 passing and 4 skipping, and the skips shrink as
slices land. A silent pass would have been a lie. [src: aos-kernel
tests/test_ratchets.py; src: git aos-kernel c824659]

Genesis commit, Decision field, verbatim from the history: "Ratchet
tests ship in the first commit, not retrofitted, so growth asks
permission in writing from the first line of code. Rejected:
bootstrapping code first and adding discipline later, which is how the
ancestor died." [src: git aos-kernel c824659]

Ten invariant tests, each named in its test, INV-01 through INV-10.
Rule attached: "A test that guards no invariant and no fixed bug does
not merge." [src: kernel-spec-v1.0 s10]

## Stdlib only, and the Pydantic question

The operator raised it directly during the muster: "One thing bugging
me is a lack of typing in Python, who says standard library for a
reason. But I think programming purity is practically a meme at this
point. Do we really lose anything? By something like Pydantic?" [Kai,
verbatim, src: transcript c5e30d02]

What it would have bought, stated before the rejection: declarative
schema classes, rich validation errors, coercion, serialization,
roughly fifty lines of hand-rolled validator removed, and lingua-franca
status in current AI tooling, which has hiring-signal value. Rejected
on four counts [src: decision typing-without-pydantic]:

1. The validation surface is tiny: seven flat schemas with one level of
   nesting. Pydantic's power is priced for problems this kernel
   deliberately does not have.
2. Pydantic v2's core is compiled Rust. Adopting it trades "clone and
   run anywhere Python exists" for a platform-coupled binary
   dependency. The capstone's strongest single statement is a kernel
   with an empty dependency list that a stranger can audit and run with
   the standard library.
3. Supply chain and upgrade treadmill. The v1-to-v2 migration is the
   cautionary tale in living memory.
4. Behaviour governs types. Enforcement belongs at real boundaries, and
   this kernel has exactly two: the payload validator and the SQLite
   constraints. Both enforce at runtime, which is more than annotations
   or model classes guarantee by themselves.

Adopted instead: full annotations and stdlib dataclasses throughout,
with **ty** (Astral) as a dev-time checker. Never imported, so the
zero-dependency ratchet counts imports and not tooling. Exact-pinned,
gradual-typing friendly, fast enough to run on every test invocation.
Its docs state no stability tier, so it is treated as swappable:
pyright or mypy substitutes with zero code changes, because the code's
only obligations are annotations plus the two runtime boundaries. The
honest loss, stated rather than omitted: nicer error messages, and
about fifty lines of validator now owned. Accepted. [src: decision
typing-without-pydantic]

The validator does real work beyond shape. The calendar schema
cross-checks weekday against date and UTC offset against timezone, "so
an internally inconsistent time cannot even be recorded." The
protected-event readback discipline lives inside the validator. [src:
kernel-spec-v1.0 s6]

## The muster, and the guard moving late

The operator's instruction, verbatim: "Identify every line in the new
spec that could be interpreted as overcautious agent specification. And
then present them back to me as a muster so I know this time I'm not
going in to a situation where agents are going to make life harder for
themselves and everybody else for the sake of processes that the code
owner doesn't care about." [Kai, verbatim, src: transcript c5e30d02]

Eleven items came back, six with a recommended change and five defended
with the lever named. He ruled on each by number. [src: transcript
c5e30d02]

M2 is the one that reshaped the build. The draft had the guard early
and demanded worktree-and-lock discipline from the first commit of an
empty repo, registered with machinery that did not exist yet. His
ruling, verbatim: "Guard should not be from day one. If anything it
should come later in the roadmap. I would prefer we had efficiency of
process governing that rather than mechanical lock and key. This is the
reason is I have lots of memories of agents being kind of suffocated by
tool calls it creates a lot of API rounds." [Kai, verbatim, src:
transcript c5e30d02]

Result: ten slices, ledger first, guard at slice 8, taking its post
just before cutover when the repo becomes the live system's home.
During the build the controls are process discipline, the remote's
force-push protection, and the narrative history itself. Worktrees
optional until the guard stands, mandatory after. [src:
kernel-spec-v1.0 s2, s13]

The reasoning generalizes into the README's design law: friction only
where consequences live, and during the build the consequences do not
live in the repo yet. That is the same rule applied recursively to the
project's own construction. [src: aos-kernel README]

Other rulings [src: transcript c5e30d02; src: kernel-spec-v1.0]:

- M3: `Operator.State` in commits mandatory only when it CHANGES.
  Fifteen consecutive identical "operator absent" lines would be ritual
  noise contradicting the project's own boilerplate prohibition.
  Accepted cost: a tool call to look up the previous State.
- M4: nine slice gates cut to six, per novel component rather than per
  slice. Three walkthroughs of three near-identical adapters is how a
  gate becomes a rubber stamp, "and a rubber-stamped fluency gate is
  validation theater wearing your own invention."
- M5: `note.baseline` no longer requires `method`. A phone capture
  rejected for a missing field means the data dies for tidiness.
- M6: no keyword-driven escalation from standard to protected.
  Verbatim: "I actually don't want the system to be worrying about data
  protection health and legal consequences I just know from experience
  that's just asking for rabbit holes and I don't want them."
- M7, M8, M10 defended: 24-hour expiry, no-retry even for trivial solo
  operations, permanently visible fumbles in public history.

## The guard itself, and the gate quote

The old guard is not ported. It is rewritten in the kernel's own
philosophy, and specifically NOT validated by golden-master parity
against the deprecated implementation. His reasoning, recorded as his
decision rather than the coach's: invariant tests assert properties
derived from the spec and are implementation-independent; parity tests
diff new against old and inherit the old code's accidents. The spec,
not the old code, is the reference. Accepted residual, stated:
protection the old guard provided only through undocumented behavior
does not transfer. [src: fluency-crib; src: kernel-spec-v1.0 s9]

What the guard actually is, his words: "a door, not a vault." Git hooks
fire on every invocation and "don't require the agent to remember."
Anomalies are loud because the kernel owns no daemons, so anything
moving in the dark is visible. Friction economics, refined in session:
agents follow efficiency gradients, so making the wrong path longer
than the right one is real defense against stochastic actors. And his
reframe of the boot contract, adopted: "policy as prior." A shared
contract does not bind a stochastic actor, it shifts the whole
distribution of agent behavior; enforcement handles the tail. [Kai,
verbatim via fluency-crib; src: transcript c5e30d02]

The quote everyone will pull, with its actual context recorded honestly:
it is not about the primary-checkout guard. It closes the exchange
about the fluency gate. Four of six components had graded at hit in the
spec walkthrough; loop and projection were partial. The proposal was to
amend the gate on the record, folding the two re-sweeps into their own
build gates at slices 3 and 4, rather than silently rolling a gate the
moment it bit. His reply opens:

"Spot on call. A gate that folds under pressure is just an expensive
illusion." [Kai, verbatim, src: transcript c5e30d02]

The same message contains the acceptance by name,
`aos-kernel-spec-2026-08-09-v1.0`, and slice 0 authorization. [src:
transcript c5e30d02; src: kernel-spec-v1.0 s16]

## The single stated assumption

On a single-operator machine, the machine cannot tell the operator's
hands from an agent's process. Every mechanism exists to make that one
gap small, visible, and expensive to abuse: hash-bound content,
perishable authority, mandatory evidence, anomaly-loud surroundings.
[src: fluency-crib]

The defensible general form: a single stated trust assumption is
auditable and upgradeable; distributed implicit trust assumptions are
neither. The operator cut the rhetorical contrast that originally
accompanied this ("instead of scattering pretend solutions across 13
documents") on the grounds that it reads as coincidence with the
project's own history rather than as an argument. His edit, accepted.
[src: fluency-crib; src: transcript c5e30d02]

Related: operator identity is itself a stated machine-trust assumption.
The kernel proves sequence, timing, exact content, and hash integrity
of what was accepted, not which human typed it. The mechanical upgrade,
authority from outside the machine (phone-side approval, independent
fork witness), is priced, banked, and waiting for an incident to earn
it. [src: kernel-spec-v1.0 s4.3; src: fluency-crib]

## Loose fragments not yet placed

- Ownership classification: every artifact is exactly one of canonical
  record (the ledger), disposable projection (`now` output, stdout
  only), domain evidence (domain repositories, referenced by path), or
  accepted synthesis (dated decision files). [src: kernel-spec-v1.0 s2]
- Acceptance must be reachable from a phone. "Nothing in the acceptance
  path may require a desktop-only surface: the kernel is a singular
  interface into a life and must meet the operator's actual cadence."
  [src: kernel-spec-v1.0 s4.3]
- Ten CLI leaf commands against a ceiling of twelve. Exit codes: 0
  success, 1 refusal naming the guard that fired, 2 integrity failure.
  [src: kernel-spec-v1.0 s8]
- Settled vocabulary: "Validation theater: approval present, judgment
  absent. Counter: a yes that is scarce, bound, and perishable." [src:
  fluency-crib]

<!-- SOURCES (REMOVE BEFORE PUBLISH)
Accepted spec (canonical):
  /Users/mrkai/vault/agent-os/proposals/2026-08-09-kernel-spec-v1.0.md
Superseded draft used for the before/after on the remote and guard:
  /Users/mrkai/vault/agent-os/proposals/2026-08-08-kernel-spec-v0.1.md
Decision files:
  /Users/mrkai/vault/agent-os/kernel/decisions/2026-08-09-ledger-integrity-alternatives.md
  /Users/mrkai/vault/agent-os/kernel/decisions/2026-08-09-typing-without-pydantic.md
  /Users/mrkai/vault/agent-os/kernel/decisions/2026-08-09-transcripts-out-of-ledger.md
Fluency crib (operator formulations, (K) marks his coinages):
  /Users/mrkai/vault/agent-os/kernel/fluency-crib.md
Transcript (all verbatim operator quotes above, extracted from user turns):
  /Users/mrkai/.claude/projects/-Users-mrkai-work-agent-os/c5e30d02-e283-41c3-9137-6ab14b9595c9.jsonl
  Muster instruction and rulings: user turns around the spec-muster exchange.
  External-witness reasoning and "indefensible" reversal: ledger walkthrough.
  "Spot on call. A gate that folds under pressure is just an expensive illusion."
    appears in the SAME message as the spec acceptance readback; its context is
    the fluency-gate amendment (loop and projection re-sweeps folded into slices
    3 and 4), NOT the primary-checkout guard. Recorded accurately in the body.
Repo (new kernel):
  /Users/mrkai/work/aos-kernel  README.md, tests/test_ratchets.py
  git log: c824659 genesis, 7da15d3 docs copies
Memory:
  /Users/mrkai/.claude/projects/-Users-mrkai-work-agent-os/memory/aos-kernel-capstone-goal.md
    (attribution rule and its origin quote)
Not used but adjacent: banked-simplification-candidates, bounded-cut-slice,
  wayfinder kernel-map-handoff, house-rules draft.
-->
