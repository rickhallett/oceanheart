# Oceanheart relational instruments design log

Status: Frozen canonical failure case. Uncommitted and unpublished.

Date: 25 August 2026

Owning repository: Oceanheart

Freeze decision: The proposed ecosystem is frozen by explicit operator
instruction. This file is retained as evidence of progressive legitimisation,
where elaboration gave speculative ideas more apparent reality than the
external evidence warranted. It does not authorize further naming,
architecture, prototyping, positioning, publication, or outreach. See
`docs/progressive-legitimisation-case-study-2026-08-25.md`.

## Purpose and scope

This document records the Oceanheart design conversation that developed the
private clinician workspace, its instruments, the surrounding architecture,
the public-learning model, and the Bearings agent reviewer.

It is a decision log, not a transcript. It preserves the decisions, their
rationale, the ideas that remain provisional, the options that were rejected
or superseded, and the questions still open.

It excludes unrelated interview preparation and Medicine Festival discussion.
It also avoids raw private practitioner reflection and any client material.
Where a personal example helped define a feature, the record keeps the design
requirement rather than the private example.

The related market, HCI, and UK feasibility evidence remains in:

- content/research/ai-therapy-opportunity-map-2026.md

That report should be read for external evidence. This document records what
we decided in response to it.

## Status language

| Status | Meaning |
|---|---|
| Accepted | Kai explicitly endorsed it, asked for it to be recorded, or authorized work based on it. |
| Working | Useful enough to prototype, but still open to change. |
| Proposed | Suggested during the conversation without clear acceptance. |
| Superseded | A later instruction replaced it. |
| Open | The conversation deliberately left it unresolved. |
| Observed | An artifact or runtime state was directly inspected. |

## Accepted direction at a glance

- Explore AI instruments for relational practice, with verification underneath
  the work.
- Restore useful connections to the clinician's working attention while they
  can still affect a session.
- Keep the client in a human relationship and the practitioner responsible for
  judgment.
- Separate the sparse live Bridge from the slower reflective Chartroom.
- Start with synthetic, hands-on, disposable prototypes built for Kai.
- Keep model output provisional and prohibit automatic clinical-record writes.

## Chronology of the design

### 1. The opportunity moved from an AI therapist to clinician augmentation

The initial research found that standalone mental-health chatbots and broad
clinician copilots were already crowded categories. It also identified an
interesting shared therapist-client experience layer.

Kai then described a more specific private clinician system:

- a longitudinal memory layer;
- connected episodes across sessions;
- timelines;
- provisional formulations;
- working graphs and reinforcement cycles;
- possible questions;
- a disposable live renderer;
- a private display that can use large screens without changing the client's
  experience of speaking to a human practitioner.

The decisive clinical observation was that useful moments are often missed
because the relevant connection is not in working memory at the right time.
This is different from asking a model to generate better therapeutic language.

Decision: the private clinician instrument became the primary research
hypothesis. The shared therapist-client canvas remains a separate complementary
hypothesis, not part of the first system by default.

### Technical premise: live models changed the design space

Kai identified genuine full-duplex voice as a material change from earlier
voice interfaces that only appeared duplex. The wider premise also included
multimodal input and output, lower-latency model APIs, and the ability to build
an interface around those capabilities rather than using a Codex-specific
surface.

Working implication:

- a model can participate in the timing and shape of an experience;
- speech, text, images, diagrams, and structured objects can share one
  interaction;
- the practitioner can remain the visible human interface;
- the provider or model does not need to own the product interface.

These are technical premises to test. They are not evidence that a model
understands a person, provides care, or improves outcomes.

### 2. The system split into two tempos

Outside a session, the practitioner is not simultaneously listening,
responding, regulating the relationship, and tracking time. The interface can
therefore be dense, comparative, and exploratory.

During a session, attention is scarce. The interface must become austere.

Accepted direction:

- Slow work may compare source-linked history, formulations, contradictions,
  timelines, graphs, and questions.
- Live work should surface one quiet item at a time.
- The live item should show its source and whether it is retrieved material or
  model inference.
- Dismissal should be immediate and consequence-free.
- The live renderer is not a miniature version of the slow workspace.

The main experiment is whether the system restores useful recall without
costing presence, comprehension, or attention to the person.

### 3. Synthetic exploration and live promotion were separated

Kai wanted enough freedom to explore the full design space, including cloud
inference, without letting legal and regulatory analysis collapse every design
conversation.

The resulting boundary is:

- Synthetic and acted material can be used to explore questions, formulations,
  memory structures, graphs, visual interfaces, and different models.
- Real-person or live-care use is a separate promotion decision.
- A voluntary and fully explained pilot can create a route to test real
  processing, but consent is permission rather than a waiver of professional,
  legal, confidentiality, or clinical duties.
- A pilot must not be treated as unlimited freedom to process health data.

Accepted control: nothing writes automatically into a clinical record. Any
retention or formal record action remains gated by practitioner judgment.

### 4. Missed Moments named the problem

Kai strongly endorsed Missed Moments as the name for the real-time recall
prototype.

The phrase captures the actual problem: a relevant episode, contradiction,
question, or cycle exists in the broader history but is absent from immediate
working memory when it could matter.

Open distinction:

- Missed Moments may name the problem or prototype.
- Waypoint may name the individual cue.
- The final relationship between those two names has not been fixed.

### 5. Navigation became the naming language

Kai described good relational work as navigation. A person is not being
commanded toward an externally chosen destination. Practitioner and person are
reading conditions, revisiting journeys, finding new paths, and moving through
unfamiliar terrain.

This led to the navigational family:

> Waypoint is the quiet in-session cue, a navigational point to steer by right
> now.

> Wake Log is the longitudinal record, the trace of where the journey has
> actually gone over time, patterns you can look back at.

> Throughline is the coherent story that ties those points together without
> pretending it is the final truth.

Throughline was strongly accepted. Waypoint remained the live cue name. Wake
Log remained useful but less settled.

Working Maps and Working Charts were suggested for provisional formulations,
timelines, cycles, and diagrams. Neither name is final.

### 6. Body Weather became the somatic instrument

Kai proposed a live body map for somatic exploration.

The intended interface is:

- a simple human outline;
- shaded areas;
- arrows or directional movement;
- the client's exact words for sensations;
- questions or observations accumulated through the exploration;
- a view that keeps the developing somatic picture within peripheral
  awareness.

The representation is always provisional. It is not measurement, diagnosis,
or a source of truth.

Felt Chart, Somatic Soundings, Felt Terrain, and Body Weather were considered.
Kai chose Body Weather as the working name.

The names Atlas and Heat Map were discouraged because they suggest a fixed or
objectively measured body state. That was design advice, not a formal naming
ban.

### 7. Captain's Log and Second Bearing added practitioner reflection

Kai introduced Captain's Log as the private record of practitioner
reflections.

Second Bearing became the name for a supervisory or counter-perspective
instrument. The assistant proposed this initial relationship:

- Captain's Log contains the practitioner's first account.
- Second Bearing helps question that account by offering alternative
  hypotheses and useful challenges.
- Second Bearing does not silently edit Captain's Log.
- Any retained conclusion requires a deliberate practitioner action.

Kai strongly endorsed Second Bearing.

The name and supervisory purpose are accepted. Its placement inside or outside
Captain's Log, write-back behavior, and retention workflow remain open.

The conversation also established that independent model views should remain
separately attributable. Automatic fusion can hide a useful minority view, and
agreement between models is not proof.

### 8. Vendor neutrality became a requirement

Captain's Log could have been implemented quickly as a Markdown file, a Codex
skill, and a scheduled Codex task. Kai explicitly resisted making that the
architecture.

Accepted direction:

- Instruments do not name a vendor.
- Codex may be the usual engine without owning the workflow.
- Different providers and model tiers can be tested on the same instrument.
- Provider-specific strengths should remain available.
- A scheduled Codex task is one trigger and execution path, not the definition
  of Captain's Log or Second Bearing.
- Outputs from different models remain visible and attributable before any
  optional synthesis.

The early Fusion harness was inspected as a reference. It separates model,
role, reasoning level, and prompts, but its child runner still uses one host.
It demonstrates useful configurability without yet providing true runtime
neutrality.

No SDK, provider set, or routing implementation has been chosen.

### 9. The Watch made session boundaries visible

Kai described a recurring operational problem. Deep, emergent work benefits
from openness, but a session may still have a fixed end because of affordability,
schedule, and practitioner health.

The proposed monitor should help track:

- elapsed time;
- time remaining;
- speaking share;
- whether the conversation is winding down;
- overspill risk;
- whether either person occupies too much vocal space near the end;
- whether the work remains experiential or is drifting into abstraction and
  over-explanation.

The maritime watch supplied a precise authority model:

- A watch is a bounded period of responsibility.
- The bell marks time.
- Regular fixes check current position and conditions.
- Handover closes one watch and passes responsibility deliberately.
- The Officer of the Watch maintains judgment and responsibility.
- Instruments keep time and show readings. They do not assume command.

Kai strongly accepted The Watch, The Bridge, Chartroom, and the authority
distinction in which the practitioner holds the watch while software provides
instruments.

The assistant proposed three extensions:

- The Bell: timed signals approaching closure.
- Regular fixes: brief checks of time, speaking balance, and direction.
- Handover: deliberate integration and ending.

Those extensions remain proposals rather than accepted modules.

Time and speaking share can be measurements. Experiential drift is a model
hypothesis and must be shown as such.

### 10. The Bridge and Chartroom divided the system

The watchkeeping discussion produced the clearest workspace split.

The Bridge is the live, in-session workspace.

Chartroom is the slower preparation and reflection workspace.

Working module placement:

- The Bridge contains Waypoint, Body Weather, and The Watch.
- Chartroom contains Wake Log, Throughline, Captain's Log, and Second Bearing.

Timeline may have a compact Bridge presence and a fuller Chartroom presence.
That placement remains open.

Clinician's Cockpit was explicitly described as a working moniker rather than a
settled name. The wider umbrella remains unnamed while Bridge and Chartroom are
tested.

### 11. The octopus was kept as a topology metaphor

Kai noted the octopus as a model of distributed intelligence. Individual
tentacles have bounded local autonomy while larger coordinating structures
connect the whole organism.

Applied to Oceanheart:

- each instrument may eventually have bounded local autonomy;
- a coordinating layer may decide what can share context or reach attention;
- the instrument remains accountable to a wider human-governed system.

Kai asked for the idea to be recorded.

Status: useful metaphor, not accepted architecture. The neutral instrument
contract must work in miniature before an octopus topology earns code.

### 12. A dual-awareness Bridge view was proposed

Kai described an experimental peripheral view with two sides.

One side concerns the person's internal multiplicity:

- explicitly named parts;
- a possible internal audience;
- hypotheses about less conscious frames, kept visibly tentative.

The other concerns the practitioner's recurring relational responses:

- patterns noticed in private reflection;
- personal pulls or vulnerabilities that may affect the relationship;
- one quiet reminder that helps the practitioner notice a weak point without
  leaving the conversation.

The centre remains the person and the live relationship. Neither peripheral
map becomes a diagnosis.

In a later assistant response, port and starboard Bridge wings were suggested
as the visual metaphor. Standing Orders was suggested for a
practitioner-authored reminder promoted from Captain's Log and Second Bearing.

Status: exploratory. The module, name, data source, and interaction are not
settled.

### 13. The Bridge began as a layout rather than a platform

Kai wanted each instrument to have its own focused development space, agents,
dependencies, and creative rhythm. Central versioning and coordination should
not slow early exploration.

Accepted direction:

- Instruments develop independently.
- The Bridge composes declared views.
- The Bridge initially owns no model routing, clinical logic, or instrument
  state.
- Each instrument writes only to its own output area.
- Shared code and central orchestration must be earned by repeated need.

The smallest proposed contract is data rather than shared code:

- one synthetic session-event format;
- one replay fixture used by several instruments;
- one small manifest describing the instrument, inputs, mode, launch details,
  and persistence;
- declared outputs that the Bridge may show or hide.

The exact event and manifest schemas are proposals, not final contracts.

The working design sentence is:

> The instruments are independent. The Bridge composes their views. Kai
> controls attention and persistence.

### 14. Early engineering was made deliberately disposable

Kai prioritized development speed, iteration speed, and felt experience.

Accepted prototyping stance:

- Build for Kai first.
- Do not design for general use yet.
- Test working interfaces early and often.
- Avoid a plugin system.
- Accept copied code when it is cheaper than a premature shared abstraction.
- Keep lightweight modularity.
- Rewrite once useful behavior is understood.
- Treat code as expendable when it has answered the design question.

The product can live or die on its human-computer interface. That interface
must be felt, not inferred from architecture notes.

### 15. One lab, separate benches, no heavy plumbing

The original repository recommendation was one private lab repository
containing independently runnable applications.

Kai accepted the phrase:

> One lab, separate benches, no heavy plumbing.

The lasting architectural meaning proposed in the discussion is:

- each instrument is an independent bench;
- each bench owns its dependencies, run command, tests, and outputs;
- one repository can contain several independent applications;
- separate repositories are justified only by a real deployment, security,
  ownership, consumer, or release boundary;
- shared packages, workspaces, plugin machinery, and submodules are premature.

The repository location itself changed later. The bench principle did not.

### 16. Worktrees became development lanes

The local-first execution rule distinguishes product separation from Git
isolation.

- App folders are benches.
- Worktrees are change lanes.
- Use one registered worktree per concurrent feature or experiment, not one
  permanent worktree per app.
- Keep one writing agent per worktree.
- Read-only reviewers may inspect the same worktree.
- Give running apps separate ports, temporary directories, data stores,
  service names, and test namespaces.
- Integrate through one clean review path.

Worktrees isolate files. They do not isolate ports, databases, containers, or
external accounts.

Cloud environments are overflow rather than the default. They may earn their
place for:

- long unattended runs;
- headless synthetic evaluations;
- several independent implementation attempts;
- Linux reproduction;
- workloads that measurably exceed local resources.

No official evidence established a general cloud performance advantage. The
flat dependency graph makes local parallelism easier and does not itself create
a need for remote compute.

### 17. Learning in public became a working direction

Kai leaned toward learning in public because the likely value of open inquiry
appeared greater than the copying risk. He then authorized a private-brief
capture workflow. Publication itself remains an attended later decision.

The possible durable value lies in clinical judgment, interface learning,
honest failures, and trust rather than secret code.

The work also gives Oceanheart, the website, the CV, and the blog a coherent
line. It is not a sharp pivot away from prior agent work.

Accepted positioning:

> AI instruments for relational practice, with verification as the quiet
> discipline underneath it, not the headline.

The verification fabric carries forward through:

- source-linked evidence;
- separation of observation and inference;
- human veto;
- explicit retention;
- no automatic claim to truth.

The website should report an inquiry before it promises a finished platform.

### 18. Public-learning capture starts as a private brief

Kai asked for agent guidance that notices outreach-worthy work at the point of
discovery, especially:

- a change in direction;
- a failed assumption;
- a reusable failure mode;
- a result practitioners or builders may use.

The accepted workflow is deliberately restrained:

1. Capture the candidate at the next safe boundary.
2. Prepare a private brief addressed directly to Kai.
3. Give it to one fresh editorial reader.

The repository guidance added two proposed extensions:

4. Add an evidence or privacy reviewer when the claim warrants it.
5. Recommend developing, holding, or keeping the candidate private.

The private brief contains source pointers, what happened, what changed, what
remains uncertain, and why it may matter.

It does not contain a hook, headline, polished narrative, article draft, or
social copy. Writing for an imagined external audience was rejected because it
produces the editorial language Kai identifies as slop.

No brief authorizes a commit, push, outreach message, publication, merge, or
deployment.

### 19. A condensed practitioner-facing page was separated from the stream

Kai commissioned a separate design exploration for a possible Oceanheart
subdomain.

Candidate names:

- lab.oceanheart.ai
- Workbench

The proposed page is a condensed external view for future practitioner
audiences. It should explore:

- the problem being solved;
- what to show;
- what to omit;
- how to explain the instruments;
- how the page differs from the chronological lab-notes stream.

The page is not approved for publication. Lab versus Workbench remains open.

### 20. Bearings added retrospective agent situational awareness

Kai asked whether subagent records could reveal how quickly an agent:

- found the correct problem frame;
- read the right sources;
- noticed a misunderstanding;
- replanned;
- began useful work.

The evidence boundary is explicit:

- Thread identifiers, timestamps, source reads, tool calls, outputs, retries,
  token counts, and artifacts are observable.
- Hidden reasoning is not observable and must not be claimed.

The two most valued metrics were:

- time to first correct framing;
- replans before useful progress.

Kai called them "gold dust" and wanted the review to appear without requiring
him to remember to request it.

Other proposed metrics:

- time to first canonical source;
- redundant reads;
- failed calls;
- instruction misses;
- one suggested prompt, skill, or AGENTS.md improvement.

Correct framing is not a purely mechanical fact. It requires a reviewer,
evidence pointers, a stated counting method, and some account of uncertainty or
disagreement.

### 21. Bearings cost led to a two-layer review proposal

One inspected reviewer run was dominated by inherited cached context. The
discussion used that observation to reject full-transcript rereading as the
default for every completed subagent.

The proposed two-layer system is:

1. Extract mechanical metrics from completed JSONL locally, using no model
   tokens.
2. Give compact event packets from several agents to one fresh reviewer.

A daily visible review and weekly trend were suggested. A one-week calibration
pilot was also suggested before making any cadence permanent.

No schedule or standing review cadence has been accepted.

### 22. Native JSONL remained evidence

The assistant proposed this Bearings data path:

    native Codex rollout JSONL
        -> deterministic reducer
        -> rebuildable SQLite projection
        -> compact human review

The layers remain distinct:

- Native JSONL is the untouched evidence.
- Deterministic events contain structural facts such as lineage, timestamps,
  tool calls, retries, token use, source reads, artifacts, and completion.
- Semantic assessments contain reviewer judgments such as correct framing and
  useful replanning.
- The human view is a concise report or interactive interface.

Important proposed constraints:

- preserve source sequence rather than relying on timestamps alone;
- store pointers and hashes rather than copied private transcript text;
- keep SQLite disposable and fully rebuildable;
- do not create another authority store or control plane;
- do not schedule the system before one manual prototype proves useful.

Kai asked whether an append-only summary log or SQL was preferable. The
conversation did not settle the storage choice. The active UI brief preserves
only a bounded constraint: native JSONL remains evidence, and any reducer or
SQLite database must be a disposable, rebuildable projection.

Timeline and Bearings are distinct domains. Whether they also require separate
physical storage remains an architecture and governance question.

### 23. Timeline became a clinical instrument

Kai proposed a longitudinal session Timeline containing:

- session date and time;
- a short session summary;
- a high-level event stream;
- later psychometric measures and scores;
- the ability to inspect the profile at a selected point in time.

Accepted distinction: measured scores must not become visually or
semantically mixed with model interpretation.

Open questions:

- Is Timeline a view of Wake Log, Throughline, or a separate instrument?
- Who authors a session summary?
- What is recorded fact, practitioner interpretation, or model proposal?
- Does a compact reference appear on the Bridge while full inspection stays in
  Chartroom?

### 24. Working prototypes became the required design medium

Kai clarified that workflow notes were not enough. He wanted:

- actual app prototypes;
- working components;
- something visual;
- something he could click, inspect, and get his hands on;
- several design alternatives before product engineering begins.

The first Bridge prototype compared three attention models:

- fixed periphery;
- single-slot relay;
- timeline instrument.

The same synthetic beats were used across the variants. The purpose was to
observe where attention left the invented speaker, whether source and inference
were legible, and whether Timeline belonged on the Bridge or in Chartroom.

The Bearings prototype received the same standard: three structurally different
interactive variants rather than another memo.

### 25. Oceanheart became the explicit repository owner

The earlier documents assumed a future separate private lab repository.

When asked whether the Bearings prototype belonged in a separate cockpit
repository, Kai corrected the assumption:

> Everything we do is within Ocean Heart.

Current decision:

- Oceanheart is the owning repository and domain.
- Current synthetic prototypes use Oceanheart worktrees.
- Separate benches remain the modular structure inside Oceanheart.
- A prototype worktree does not authorize a public route, commit, push,
  deployment, or production integration.
- Client data, private practitioner records, and live study material remain
  outside public Git.

This supersedes the earlier repository-location decision for current prototype
work. It does not weaken the privacy boundary.

The current AGENTS.md and opportunity map still contain the older future-lab
rule. That contradiction requires a separate governance edit before future
agents can rely on those files without direct correction.

## Workspace and instrument map

### Live workspace: The Bridge

| Instrument | Status | Purpose | Important boundary |
|---|---|---|---|
| Waypoint | Working | One quiet, source-linked cue that may matter now. | One item at a time. Dismissible. No demand for action. |
| Missed Moments | Accepted name, role open | Names the recall problem or the real-time prototype. | Relationship to Waypoint is not final. |
| Body Weather | Working | Keeps the client's described somatic experience in view. | Uses exact client language. Never diagnosis or objective measurement. |
| The Watch | Accepted | Tracks session time, speaking share, wind-down, and boundary risk. | Measurements and model hypotheses must remain distinct. |
| The Bell | Proposed | Marks the approach to closure. | A signal, not a command. |
| Timeline glance | Proposed | Shows a compact source-linked longitudinal reference. | Full inspection may belong in Chartroom. |
| Bridge wings | Proposed | Holds client multiplicity and practitioner relational awareness in the periphery. | Must not declare inferred parts or diagnose either person. |
| Standing Orders | Proposed | Shows one practitioner-authored reminder from reflection. | Software never creates or promotes it on its own. |

### Slow workspace: Chartroom

| Instrument | Status | Purpose | Important boundary |
|---|---|---|---|
| Wake Log | Working | Records the trace of what happened across time. | Should remain close to dated sources. |
| Throughline | Accepted | Connects episodes into a coherent but provisional story. | A working synthesis, never final truth. |
| Timeline | Accepted concept | Presents dated sessions, summaries, measures, and change. | Measurements, reports, and interpretations stay separate. |
| Working Maps or Charts | Proposed | Holds formulations, graphs, cycles, contradictions, and questions. | Editable, source-linked, and explicitly provisional. |
| Captain's Log | Accepted concept | Holds private practitioner reflection. | No automatic writing or external exposure. |
| Second Bearing | Strongly accepted | Returns supervisory questions and alternative hypotheses. | Separate attribution. Nothing writes back automatically. |

### Separate research hypothesis

The following Session Canvas structure comes from the research synthesis. Kai
accepted the clinician-side system as the current priority, but did not adopt
this detailed Canvas contract during the design conversation.

The shared Session Canvas remains independent from the private clinician
system.

Its purpose is to create one practitioner-operated and client-controllable
object during a session. Model material, practitioner framing, client edits,
and jointly agreed meaning must remain visibly distinct.

The Canvas is not required for Bridge or Chartroom to prove useful. A future
handoff between them would require an explicit share action and a hard boundary
between private clinician material and client-visible objects.

## Research-derived information and authority proposal

The opportunity map generated the following working contract. It is useful
design material, not a set of individually accepted policies. The explicitly
accepted controls are practitioner judgment, visible provenance, provisional
model output, and no automatic clinical-record writing.

### Content lanes

| Lane | Content | Default treatment |
|---|---|---|
| Recorded source | Approved source material with stable identity and context. | Ephemeral unless deliberately pinned or retained. |
| Practitioner observation | A dated human observation in the practitioner's own words. | Private working material unless deliberately retained or exported. |
| Model output | Summary, question, formulation, contrast, metaphor, or relationship. | Discard at session end unless reviewed and promoted. |
| Practitioner workspace | Human-authored scratch work, with model edits shown for acceptance. | Private and temporary by default. |
| Retained working item | An item deliberately approved for later use. | Stores purpose, scope, source, review date, and expiry. |
| Clinical record | The practitioner's formal record. | Never written automatically by an instrument. |

### Four independent facets

No item should collapse its status into one confidence badge.

| Facet | Question |
|---|---|
| Origin | Who or what produced this? |
| Transformation | Is it verbatim, summary, synthesis, or hypothesis? |
| Support | Is it source-linked, corroborated, conflicted, stale, unsupported, or unknown? |
| Decision state | Has a human reviewed, pinned, shared, retained, exported, dismissed, or done nothing with it? |

A directly recorded statement is not automatically true. A practitioner
observation is not a client fact. A model synthesis can be coherent while still
being stale, conflicted, or speculative.

### Retention path

The research synthesis proposed a narrow path:

    approved source or practitioner-entered item
        -> ephemeral evidence or inference
        -> practitioner chooses an action
        -> discard, pin for this session, or propose retention
        -> deliberate review of purpose, scope, review date, and expiry
        -> retained working item

Pinning for the current session and retaining across sessions are different
actions.

There is no automatic path from raw input, retrieval, model output, or scratch
work into longitudinal memory or the clinical record.

## Architecture and execution

### Proposed provider-neutral instrument protocol

Vendor neutrality is accepted. The following five-part split was the
assistant's proposed implementation:

1. Instrument. Defines inputs, workflow, human gates, output, and retention.
2. Model pool. Describes available models, capability, latency, cost, context,
   and permitted data class.
3. Routing policy. Chooses one model, a tier, or several independent views.
4. Provider adapter. Preserves the useful capabilities of Codex, OpenAI,
   Anthropic, or another runtime.
5. Evidence record. Preserves model identity, hashes, outputs, disagreement,
   timing, cost, and anything deliberately retained.

The protocol must not reduce every provider to the lowest common feature set.

### Independent benches

Each instrument should be independently runnable and own:

- its application folder;
- dependencies;
- run command;
- tests;
- temporary and retained output areas;
- development context;
- one writing agent at a time.

An instrument should not import another instrument's state or code by default.
The Bridge reads declared outputs. It does not reach into instrument
directories and mutate them.

### Proposed thin shared contract

The first shared contract should contain only what repeated experiments need:

- synthetic replay fixtures;
- a small session-event format;
- a small instrument manifest;
- source and output identifiers;
- explicit persistence behavior.

Shared libraries, a central model router, plugin machinery, and cross-instrument
state should be considered only after repeated behavior appears in working
instruments. No numeric extraction threshold has been accepted.

### Oceanheart repository correction

Current synthetic prototype work belongs in registered Oceanheart worktrees.

The earlier plan for a separate future private lab repository is superseded for
current prototype work. The modular bench principle survives inside
Oceanheart.

This is an organizational and repository decision. It does not make the public
Git repository a valid place for:

- identifiable client or participant data;
- private practitioner reflection;
- live session recordings or transcripts;
- credentials;
- private study records;
- unreviewed publication material intended to remain confidential.

### Local-first concurrency

Use local worktrees until measured workload justifies cloud execution.

Cloud earns its place through a concrete comparison of setup time, completion
time, review effort, integration effort, failures, cost, and local resource
pressure.

Cloud versus local execution is separate from cloud versus local model
inference.

## Working prototype and evaluation method

This section combines Kai's accepted experience-first stance with evaluation
criteria generated by the research and prototype agents. The criteria are
proposals until use shows which ones matter.

### Experience before architecture

The early loop is:

1. Build a disposable vertical slice.
2. Run it against one shared synthetic or acted session.
3. Put it on the actual monitors.
4. Notice what it does to attention.
5. Keep, reshape, or discard it.
6. Only then extract repeated contracts or shared code.

The prototype should be rewritten freely when the interaction teaches
something new.

### Bridge attention variants

Three structures were identified for comparison:

| Variant | Structure | Question |
|---|---|---|
| Fixed periphery | Stable locations for The Watch, Waypoint, and Body Weather. | Does spatial memory make several instruments glanceable without stealing attention? |
| Single-slot relay | One secondary card at a time, with The Watch remaining small. | Does strict scarcity preserve useful cues at lower attentional cost? |
| Timeline instrument | Watch markers, Waypoints, and exact Body Weather phrases in one temporal strip. | Does provenance through time matter more than simultaneous panels? |

The metaphor must not predetermine the interface. A workspace called The Bridge
may still work best when it is mostly empty.

### What to observe

Early synthetic comparison should record:

- whether a planted useful moment is recognized;
- false or irrelevant cues;
- time to return attention to the simulated person;
- missed details;
- cue glances, expansions, dismissals, and ignored cues;
- whether source and inference remain distinguishable;
- whether the interface anchors an early hypothesis;
- whether Timeline helps the live session or belongs in Chartroom;
- whether the practitioner likes the interface despite measurable distraction.

Preference alone is not enough. A liked interface can still fail if it costs
listening or makes unsupported material feel authoritative.

## Bearings agent reviewer

### Purpose

Bearings applies the same situational-awareness question to subagents.

It asks whether an agent:

- found the right problem;
- read the right instructions and sources;
- corrected misunderstandings;
- avoided redundant work;
- produced useful evidence efficiently.

### Evidence boundary

Bearings may inspect observable records:

- session, parent, and agent identifiers;
- spawn and completion times;
- source reads;
- tool calls;
- retries;
- replans;
- token counts;
- first artifact;
- completion state.

It may not claim access to hidden reasoning.

### Mechanical and semantic layers

Mechanical facts can be reduced deterministically.

Semantic judgments require a reviewer:

- whether a framing was correct;
- whether a replan was useful;
- whether progress had genuinely begun;
- whether an instruction read changed behavior.

Every semantic label should preserve reviewer identity, evidence pointers,
confidence or uncertainty, and the counting method.

### Proposed projection

Native JSONL remains the evidence source.

SQLite, if used, is a rebuildable query projection. A Markdown report or
interactive UI is a generated view. Neither becomes a new authority store.

Raw prompts, transcript bodies, and private content should not be copied into
the projection. Use structural metadata, stable pointers, and hashes.

No scheduler, daemon, global agent control plane, or production database has
been accepted.

### Current Bearings prototype brief

The active prototype is intended to compare three interactive views with:

- agent selection;
- event stepping;
- filters;
- evidence detail;
- visible separation of facts, heuristics, judgments, and unknowns;
- time to first reviewer-confirmed framing;
- replans before useful progress;
- explicit reviewer provenance.

This is a UI and domain-model probe. It is not yet a standing review system.

## Public story and product presentation

### One coherent line

The clinical, phenomenological, relational, engineering, and verification work
should be presented as one inquiry rather than a retroactively assembled
portfolio.

The current line is:

> I build AI instruments for relational practice: tools that extend a human
> practitioner's attention, memory, and reflective capacity without replacing
> the relationship.

This remains working copy, not approved public copy.

### Two publication forms

The Oceanheart stream or lab notes record work as it unfolds:

- experiments;
- interface discoveries;
- failures;
- changes of mind;
- questions;
- evidence.

A future Lab or Workbench page would provide a concise practitioner-facing
account:

- the problem;
- the instruments;
- the research boundary;
- synthetic demonstrations;
- what exists now;
- what remains a hypothesis.

The page must not turn prototype activity into claims of clinical benefit,
safety, efficacy, or live readiness.

## Decisions rejected, superseded, or deferred

| Option | Status | Reason |
|---|---|---|
| Standalone AI therapist | Rejected as the primary direction | Crowded, harder to govern, and weaker fit than practitioner augmentation. |
| Automatic clinical-record writing | Rejected | Practitioner judgment must gate every record action. |
| Model output as diagnosis or truth | Rejected | Output remains a source-linked hypothesis or working object. |
| Codex-specific instruments | Rejected as architecture | Codex is an execution option, not the owner of the workflow. |
| Automatic fusion of model views | Rejected as default | It hides attribution, disagreement, and useful minority views. |
| One repository per instrument now | Rejected | Repository administration would arrive before the boundaries have earned it. |
| Future separate private lab repository | Superseded for current prototypes | Kai explicitly placed current work inside Oceanheart. |
| Unified Bridge platform now | Deferred | It would force routing, shared state, navigation, and versioning too early. |
| Completely disconnected prototypes | Rejected | Shared synthetic replay and declared outputs are needed for comparison. |
| Plugin system | Deferred | No repeated need yet. |
| General-user design | Deferred | Build for Kai and learn the interaction first. |
| Cloud by default | Rejected | No measured bottleneck justifies it. |
| Octopus architecture now | Deferred | The metaphor has not earned topology. |
| Clinician's Cockpit as final brand | Open | It remains a useful moniker, not a settled name. |
| Felt Chart as somatic name | Superseded for now | Kai chose Body Weather. |
| Automatic article or social drafting | Rejected | Start with a private brief addressed to Kai. |
| Public Lab or Workbench deployment | Not authorized | Page concepts are private design probes. |
| Live client data in prototype worktrees | Rejected | Synthetic-first boundary remains in force. |

## Open questions

### Product and naming

1. Is Missed Moments the problem, the prototype, or the product?
2. Is Waypoint the item inside Missed Moments?
3. How do Wake Log, Timeline, and Throughline divide source history,
   measurement, and synthesis?
4. Does the wider system need an umbrella name?
5. Does public language use therapy, relational practice, collaborative
   wayfinding, development, or another term?
6. Is the future condensed page Lab, Workbench, or something else?

### Interaction

7. Which Bridge attention structure protects listening best?
8. Does Timeline belong on the Bridge, in Chartroom, or in both at different
   densities?
9. How should client multiplicity and practitioner relational awareness appear
   without turning tentative material into declared truth?
10. How does a practitioner promote one private reflection into a live reminder?
11. How sparse must a cue be before it stops competing with the person?
12. Which parts of The Watch are measured, manually entered, or inferred?

### Architecture

13. Does the Bridge remain a layout or eventually become the single routed
    interface?
14. What is the smallest useful event format and manifest?
15. Which provider SDKs and adapters earn the first implementation?
16. When does shared model routing earn a central component?
17. How should independently attributable model views be compared and retained?
18. What repository guidance replaces the now-stale future-lab rule?

### Data and governance

19. What is the eventual clinical source of truth?
20. Who authors Timeline summaries?
21. What are the correction, expiry, and deletion semantics for retained
    working items?
22. What exact live-pilot boundary is professionally, legally, and technically
    supportable?
23. Which cloud inference paths satisfy the later processor, retention,
    transfer, access, and deletion requirements?
24. Which functions remain retrieval, and which materially influence care?

### Bearings

25. Who decides that a framing is correct?
26. How is reviewer disagreement represented?
27. What precisely counts as a replan and as useful progress?
28. Is a daily review useful, or should Bearings review only meaningful agent
    cohorts?
29. What token and attention budget makes the review worth running?
30. Does SQLite earn its place after the first manual projection?

## Current artifacts and state

### Oceanheart research worktree

Current relevant local state when this log was written:

- AGENTS.md is modified and uncommitted.
- content/research/ai-therapy-opportunity-map-2026.md is untracked.
- This design log is untracked.
- These files are currently uncommitted locally.
- No push, publication, or deployment was authorized in the thread.

The current AGENTS.md still says executable prototypes belong in a future
private lab repository. That instruction conflicts with Kai's latest
Oceanheart ownership decision and should be reconciled separately.

### Bridge experience prototype

Reference artifact: bridge-experience-lab.html in the original realtime
workspace.

Observed scope:

- three switchable attention models;
- synthetic session beats;
- Waypoint controls;
- Body Weather;
- The Watch;
- Timeline;
- visible state.

This artifact predates the explicit Oceanheart repository correction. Treat it
as reference material rather than the canonical implementation.

### Oceanheart page concepts

Reference artifact: oceanheart-lab-page-concepts.html in the original realtime
workspace.

Observed scope:

- three different external invitations;
- Lab, Workbench, Studio, and Bridge naming exploration;
- private product-page concepts;
- no public route or deployment.

This also predates the repository correction.

### Bearings prototype worktree

Visible task title: Build Bearings prototype UI

Prototype files observed:

- assets/css/bearings-prototype.css
- assets/js/bearings-prototype.js
- content/prototype/bearings.md
- layouts/_default/bearings-prototype.html

JavaScript syntax passed node --check during a read-only inspection. The
rendered route and interactions were not verified in that inspection.

The worktree also contains unrelated pre-existing changes whose provenance was
not established. Any eventual review must isolate the prototype diff from
those changes.
