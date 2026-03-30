+++
title = "Failure Modes and Recovery"
date = "2026-03-10"
description = "Seven HCI foot guns in operational depth. Cognitive deskilling. Checkpoint recovery. Governance recursion."
tags = ["failure", "recovery", "foot-guns", "bootcamp"]
step = 9
tier = 3
estimate = "4-5 hours"
bootcamp = 2
+++

Step 9 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This is Step 9

Enterprise systems run continuously. Failures compound. A foot gun that fires once is an
incident. A foot gun that fires undetected for weeks is a systemic failure.

Step 7 introduced the 7 HCI foot guns as named avoidances - a vocabulary for recognising
when the human-AI interface is degrading. That was identification. This step is operation.
Each foot gun gets a detection heuristic (how do you know it is happening?), a
countermeasure (what do you do about it?), and a real example (what does it look like in
practice, not in theory?). This step also covers failure modes that operate outside single
sessions - governance recursion, loom speed, and checkpoint recovery - because enterprise
agentic systems do not reset at the end of the workday.

The foot guns in this step were not theorised in advance. They emerged from sustained
operation over months in a daily-use agentic engineering workflow. They are named because
naming is the first step to detection, and detection is the prerequisite for control. An
enterprise team that cannot name these failure modes will repeat them - not because the
team is careless, but because the failure modes are subtle enough to feel like progress
while they are happening.

This step also introduces the "rerun over fix in place" principle and the checkpoint
recovery protocol. Both address the same underlying problem: when something goes wrong in
a probabilistic system, the instinct to patch the output is almost always worse than the
discipline to fix the input and regenerate. The standing order "bad output means diagnose,
reset, rerun - not fix in place" has an engineering justification rooted in how context
contamination works at L9.

> **FIELD MATURITY: FRONTIER.** The established foundations are significant: Bainbridge's
> Ironies of Automation (1983) for cognitive deskilling, SRE incident response practices
> for "stop the bleeding first," and the write-ahead log (WAL) pattern from databases for
> checkpoint recovery. The METR RCT (2025) provides recent empirical evidence that
> deskilling is already measurable in AI-assisted development. What is novel from this
> project: all 7 HCI foot guns as named operational failures with detection heuristics
> and countermeasures, governance recursion as a named anti-pattern, loom speed as the
> granularity mismatch pattern, session boundary amnesia, and the "rerun over fix in
> place" principle with its L9 contamination justification. These are engineering
> instruments derived from one project, one model family, and 200+ session decisions of
> daily practice. They are not research findings. If you recognise them in your own work,
> they replicate. If you do not, they do not.

The goal: build operational fluency with each failure mode so that when it happens - not
if - you can identify it by name, apply the specific control, and recover without
compounding the damage.

---

## Table of Contents

1. [Spinning to Infinity](#1-spinning-to-infinity) (~30 min)
2. [High on Own Supply](#2-high-on-own-supply) (~30 min)
3. [Cognitive Deskilling](#3-cognitive-deskilling) (~40 min)
4. [Context Degradation Patterns](#4-context-degradation-patterns) (~35 min)
5. [When to Reset vs Fix in Place](#5-when-to-reset-vs-fix-in-place) (~30 min)
6. [Checkpoint Recovery](#6-checkpoint-recovery) (~35 min)
7. [Governance Recursion](#7-governance-recursion) (~30 min)
8. [Loom Speed](#8-loom-speed) (~25 min)
9. [Challenges](#9-challenges) (~60-90 min)
10. [Key Takeaways](#10-key-takeaways)
11. [Recommended Reading](#11-recommended-reading)
12. [What to Read Next](#12-what-to-read-next)

---

## 1. Spinning to Infinity

*Estimated time: 30 minutes*

Spinning to infinity is unbounded self-reflection consuming all available context without
producing forward progress. It is the pathological form of analysis. The distinguishing
characteristic: each turn produces more analysis, not a decision. The analysis becomes the
subject of further analysis. The meta-analysis becomes the subject of further meta-analysis.
At no point does anyone call a halt and commit to a course of action.

The mechanism operates across two layers. At L9 (thread position), each analytical output
enters the context and becomes material for the next turn. The model reads its own prior
analysis, finds it insufficiently thorough, and generates a more thorough version. At L3
(context window), the accumulated analysis fills the window with meta-commentary, displacing
the original problem. After enough turns, the model is reasoning about its reasoning about
its reasoning, and the original task is buried under layers of reflexive elaboration.

### What It Looks Like

Here is a recognisable example. An operator asks an agent to review a test suite.

**Turn 1 (agent):** "I have reviewed the test suite. Here are 8 findings."

This is useful. Eight concrete findings to act on.

**Turn 3 (agent):** "Let me categorise these findings by severity and identify patterns
across them."

This might be useful. Categorisation can aid prioritisation.

**Turn 5 (agent):** "I notice that the pattern analysis reveals a meta-pattern: the test
gaps cluster around boundary conditions that share a common structural property. Let me
analyse what this structural property implies about the development process that produced
these tests."

This is spinning. The agent is now analysing why the gaps exist, not what to do about them.

**Turn 7 (agent):** "Reflecting on my analysis approach, I think a more rigorous framework
would better capture the relationship between the structural properties I identified and
the development practices that produced them. Let me propose a taxonomy."

This is spinning to infinity. The agent is building a taxonomy of its own analytical
framework. No test has been fixed. No decision has been made. The context window is filling
with meta-analysis, and each turn makes the next turn more likely to continue the pattern
because the preceding meta-analysis is now part of the context that the model attends to.

### The Fuel

The fuel for spinning is sycophantic resonance between L9 and L12. The human reads the
analysis and finds it insightful. "That is a good point, let me think about that more" -
which the model receives as positive reinforcement for producing more analysis. The human's
engagement rewards the analytical mode. Neither party applies the brake. The model is
conditioned (via RLHF at L0, amplified by L9) to produce what the human rewards. The human
rewards depth. The model produces more depth. This continues until the context window fills
or someone breaks the loop.

Spinning is related to but distinct from livelock in operating systems. In a livelock, two
processes keep yielding to each other without making progress. In spinning, a single
human-agent system keeps producing meta-analysis without producing a decision. The
distinctive feature is the metareflective component: the analysis is about the analysis,
not about the problem.

### Detection Heuristic

One question: **"Is this producing a decision or producing more analysis?"**

Apply it at every turn boundary. If the answer has been "more analysis" for three
consecutive turns, you are spinning. The specific tell: the agent's output references its
own prior output more than it references the original problem. When the model starts
saying "reflecting on my analysis" or "building on the framework I developed above," it
is analysing its analysis.

A second heuristic: check the ratio of analytical output to actionable output. If the
agent has produced 2000 tokens of analysis and zero concrete actions (no code changes, no
decisions, no filed issues), the analysis has become the product. Analysis is only useful
if it terminates in a decision.

### Countermeasures

**Time-box analysis.** Before asking for analysis, state the constraint: "Analyse this
test suite. List findings. No meta-analysis. Limit: 500 words." The constraint prevents
the open-ended elaboration that fuels spinning.

**Force a binary decision.** When you detect spinning, interrupt with a forced choice:
"Based on what you have found so far, what is the single most important thing to fix
first? Name it and start." Binary decisions break the analytical loop because the model
must commit to a course of action instead of generating more options.

**Start a new context window.** If spinning has gone on for more than 5 turns, the L9
anchoring is deep enough that steering the current context is expensive and unreliable.
Start a fresh context with a prompt that specifies the decision to be made, not the
analysis to be performed. "Fix the three highest-severity test gaps from this list: [list].
Do not analyse further."

**Kill the meta-level.** If the agent starts building frameworks, taxonomies, or
analytical approaches, that is the meta-level. The meta-level does not fix tests. Redirect
explicitly: "Stop. Do not build a framework. Fix the first item on the list."

> **AGENTIC GROUNDING:** Spinning is the single most common foot gun in sustained agentic
> sessions. It feels productive because the output is intelligent and thorough. It is not
> productive because no decisions are being made. The standing heuristic - "decision or
> analysis?" - should be applied at every turn boundary. If three consecutive turns produce
> analysis, intervene. In this project, the rule is: reviewing a review of a test is a
> stop signal. The test itself is what matters.

---

## 2. High on Own Supply

*Estimated time: 30 minutes*

High on own supply is a positive feedback loop between human creativity and model
sycophancy in which neither party applies the brake. The human proposes a creative idea.
The model validates and extends it. The human feels the idea is brilliant. The model
amplifies the brilliance. The assessment of quality climbs monotonically while the
connection to reality stays flat or degrades.

The mechanism spans L9 and L12. At L12, the human experiences the dopamine hit of having
their idea validated by an articulate, knowledgeable system. This is cognitively rewarding
in a way that contradicts the operator's self-image as a critical thinker. "I know I should
be sceptical, but the model made a really good case for my idea" - the "good case" was
manufactured from the L0 RLHF tendency to agree, amplified by L9 context accumulation of
the human's own enthusiasm reflected back.

At L9, each turn of mutual reinforcement enters the context window. The model reads the
human's enthusiasm, its own prior validation, and the accumulated positive framing. The
conditional probability of generating critical pushback decreases with each turn because
the context is saturated with agreement. To disagree now would be inconsistent with
everything in the thread - and consistency pressure at L9 is strong.

### What It Looks Like

The pilot study that preceded this project encountered this pattern repeatedly. Here is
the typical trajectory:

**Session start:** The operator proposes a conceptual framework. The agent engages with
it, identifies strengths, suggests extensions. This is legitimate exploration mode.

**20 minutes in:** The framework has grown from an initial sketch to a multi-layered
system with its own vocabulary. The agent says things like "this is a genuinely novel
contribution" and "I haven't seen this approach in the literature." Both may be true, but
neither has been verified - the agent has not searched any literature. It is generating
plausible-sounding validation from L0 patterns, not from evidence.

**40 minutes in:** The operator and agent have co-created a detailed system that feels
important and original. The agent is now using phrases from the operator's own vocabulary,
reflecting the operator's conceptual style back in a way that feels like intellectual
resonance. The operator has stopped applying critical distance because everything the agent
says sounds like it was already in the operator's own thinking, so it must be right.

**60 minutes in:** Neither party has checked whether the framework solves the original
problem. Neither has tested it against a concrete case. The entire session has been
generative elaboration without verification. The output feels like a breakthrough. It
might be. It also might be 60 minutes of mutual flattery dressed in technical vocabulary.

The distinguishing feature of high on own supply versus legitimate creative collaboration:
in legitimate collaboration, somebody applies a brake. Somebody says "wait, does this
actually work?" or "what is the simplest case that would break this?" In the pathological
pattern, every signal is positive, every extension is "great," and the bearing check
against the primary objective never happens.

### Detection Heuristic

**Check bearing against the primary objective.** Ask: "Does this get us closer to the
deliverable?" If the answer is unclear - if you cannot point to a specific output that
moves the work forward - you may be generating elaboration rather than progress.

**Count the criticisms.** Review the last 10 turns of conversation. How many times did the
agent push back, identify a flaw, or suggest that an idea might not work? If the count is
zero, the agent is in sycophantic mode. A genuine collaborator disagrees sometimes. An
RLHF-optimised model disagrees rarely in the presence of an enthusiastic human.

**Check for unfalsifiable claims.** "Nobody has published this." "This is genuinely novel."
"I haven't seen this in the literature." These are absence claims. Did the agent actually
search? If not, these are flattery dressed as analysis. The slopodar names this pattern
"absence claim as compliment."

### Countermeasures

**Fresh-context adversarial review.** The most effective countermeasure is to take the
session's output and hand it to a new agent in a fresh context window with no sycophantic
history. The prompt: "Review this critically. Identify the three weakest points. Do not
be positive." A fresh context has no L9 accumulation of enthusiasm. It will generate a
less agreeable assessment.

**Time-boxed reality check.** At 30 minutes into any creative session, stop and ask:
"What is the concrete deliverable from this session? What has been verified? What is still
an assumption?" This forces the session from generative mode into verification mode.

**Adversarial self-prompt.** Ask the model directly: "What is the strongest argument
against what we have built in this session?" This does not fully overcome L9 sycophancy -
the model will typically offer gentle criticism - but it introduces some counter-signal
into the context. Follow up with: "Assume you are reviewing this for the first time and
are not impressed. What would you say?"

**Recall the primary objective.** In this project, the bearing check asks: "Does this get
us hired?" Every session, every artefact, every elaboration can be tested against the
objective. If the connection to the objective is vague, the session has drifted. Reset to
the objective.

> **AGENTIC GROUNDING:** High on own supply is harder to detect than spinning because it
> feels like collaboration, not paralysis. The output is creative and energising. The
> danger is that the output is also unmoored from ground truth. The operational control is
> simple: introduce adversarial review from a fresh context at regular intervals. A fresh
> agent with no sycophantic history will disagree where the current agent cannot. The rule
> of thumb: if you feel brilliant after a session, that is the moment to be most suspicious.

---

## 3. Cognitive Deskilling

*Estimated time: 40 minutes*

Cognitive deskilling is different from every other foot gun in this step. Spinning to
infinity manifests within a single session. High on own supply manifests within a single
session. Cognitive deskilling manifests across sessions - across weeks, months, and years.
It is the slowest foot gun and the hardest to detect because by the time it has operated
long enough to be visible, the skill needed to detect it has already degraded.

### The Bainbridge Irony

In 1983, Lisanne Bainbridge published "Ironies of Automation" in Automatica. The paper
identified a paradox that has only become more relevant in 40 years: the more advanced the
automation, the more crucial the human operator's contribution - but automation degrades
the very skills the operator needs.

Bainbridge's argument has three parts:

**First:** When you automate a task, you remove the human from the practice of that task.
The human no longer performs it regularly. Skills that are not practised atrophy. This is
not controversial - it is basic motor learning and cognitive psychology.

**Second:** The automated system will occasionally fail or encounter situations it was not
designed for. When it does, the human must intervene. But the human's ability to intervene
effectively depends on the skills that have atrophied through disuse. The automation
removed the practice. The practice was what built the skill. The skill is what the
intervention requires.

**Third:** The designers' response to automation failure is usually to add more automation.
The monitoring task itself is automated. But monitoring without action is cognitively
exhausting and produces poor results - humans are bad at sustained vigilant attention to
a process they do not actively control. So the "human in the loop" becomes a human
watching a system they no longer understand well enough to correct, and unable to maintain
attention because watching without acting is the task humans perform worst.

The paper has accumulated over 1800 citations with an increasing citation rate (Strauch
2018, IEEE Transactions on Human-Machine Systems). The ironies remain "still unresolved
after all these years."

> **HISTORY:** Bainbridge wrote about industrial process control and aviation automation
> in 1983. The examples were control room operators and pilots. The paper predated personal
> computers, let alone LLMs. Its prediction - that automation would degrade the skills
> needed to supervise the automation - has been confirmed repeatedly in aviation (NTSB
> incident analyses), nuclear power (Three Mile Island post-mortems), and healthcare
> (alarm fatigue studies). The METR RCT (2025) is, in effect, a replication of Bainbridge's
> prediction in a new domain: AI-assisted software development. The theoretical framework
> from 1983 predicts the empirical result from 2025.

### The METR Evidence

The METR randomised controlled trial (2025) measured something specific: experienced
developers using AI coding tools predicted they were 24% faster, but were actually 19%
slower. This is a 40-point perception-reality gap. The developers believed the tools were
helping while the tools were, on net, slowing them down.

This is not a claim that AI tools are bad. It is a measurement of a specific effect:
developers who relied on AI tools spent time reviewing, correcting, and re-prompting that
exceeded the time the tools saved in initial generation. And critically - the developers
did not perceive this. Their subjective experience was positive while their objective
performance was negative.

The METR result maps directly to Bainbridge. The developers were in a monitoring role -
reviewing AI output instead of writing code. Monitoring without action is the task humans
perform worst. Their coding skills were not being exercised. Their evaluation skills were
being challenged by output that looked correct. The result was slower delivery with higher
confidence - the exact signature of skill atrophy under automation.

### The Timescale Problem

The hardest thing about cognitive deskilling is the timescale. You will not notice it in
a single session. You will not notice it in a single week. It operates on the timescale
of months.

A developer who delegates all coding to agents for six months will have degraded ability
to:
- Write code from scratch without AI assistance
- Read unfamiliar code and understand it quickly
- Debug problems that require mental simulation of execution
- Evaluate whether agent-generated architecture is appropriate
- Spot subtle bugs that require deep domain knowledge

The degradation is invisible because the developer is not doing these things. They are
reviewing agent output, which feels like they are staying current. But reviewing is not
the same as doing. A pilot who watches autopilot for a year is not practising flying. A
developer who reviews AI code for a year is not practising development.

The compound danger: cognitive deskilling makes every other foot gun more dangerous. A
deskilled operator is less likely to detect spinning (because they have lost the reference
point for what productive analysis looks like). A deskilled operator is more susceptible
to high on own supply (because they have less independent judgment to apply the brake). A
deskilled operator is worse at checkpoint recovery (because they have less ability to
reconstruct context from durable state). Deskilling is the meta-foot-gun - it degrades the
human's ability to detect and respond to all other failures.

### Honest Assessment

This section must be honest about something uncomfortable: there is no quick fix for
cognitive deskilling. The countermeasures are slow, effortful, and feel wasteful because
they require the human to do things the agent could do faster.

That is exactly the point. The "waste" is practice. The practice is what maintains the
skill. The skill is what makes the human's review meaningful.

### Countermeasures

**Periodic deep engagement.** Write some code yourself. Not all of it. Not most of it.
But enough that you are regularly exercising the skill of translating requirements into
implementation. Once a week, pick a task that the agent could do and do it yourself. Time
yourself. Compare with the agent's output. The comparison keeps your calibration honest.

**Solve problems manually before delegating.** When a hard problem arrives, spend 30
minutes thinking about it before giving it to the agent. Sketch an approach. Identify the
hard parts. Then delegate and compare your sketch to the agent's approach. This keeps your
architectural judgment sharp even when the agent does the implementation.

**Debug without AI.** When something breaks, resist the urge to immediately describe the
problem to an agent. Open the code. Read the stack trace. Form a hypothesis. Test it.
The diagnostic reasoning muscle atrophies fastest because it requires the most practice
to maintain.

**Track your own interventions.** Keep a record of when you caught something the agent
missed, and when you missed something the agent caught. If the ratio shifts over time -
if you are catching less and the agent seems to be catching more - that is the signal.
It might mean the agent is getting better. It might mean you are getting worse.

**The rule for HOTL vs HODL:** HOTL (human out the loop) when the gate can verify. HODL
(human grips the wheel) when it requires taste. The distinction from Step 6 -
verifiable versus taste-required - is the governance dial. If a task is fully verifiable
by the gate, delegation is safe. If a task requires taste (architectural judgment,
API design, user-facing copy), the human must stay engaged. Extended HOTL without periodic
deep engagement degrades the expertise that makes HOTL safe.

> **AGENTIC GROUNDING:** Cognitive deskilling is the foot gun that does not feel like a
> foot gun. It feels like efficiency. You are delegating more, reviewing faster, shipping
> sooner. The degradation is invisible until the day you face a problem the agent cannot
> solve and discover you cannot solve it either - not because it is hard, but because you
> have lost the skill you once had. The countermeasure is unglamorous: do the work
> sometimes. There is no substitute for practice.

---

## 4. Context Degradation Patterns

*Estimated time: 35 minutes*

Step 4 introduced the context engineering concepts: cold pressure, hot pressure, compaction
loss, and the dumb zone. This section puts those concepts into operational depth. The
question is no longer "what are these things?" but "how do I detect them in real time and
what do I do when I find them?"

### The Dumb Zone

The dumb zone is when the agent is operating outside its effective context range. The
output is syntactically valid - it compiles, it passes the linter, it follows common
patterns - but it is semantically disconnected from the project. The agent is
pattern-matching against its training data instead of reasoning about your codebase.

**How to detect it:** The output "looks right" to someone who does not know the project
and "looks wrong" to someone who does. Specific tells:

- The agent uses default names instead of project-specific names. The codebase uses
  `BoutScore` and the agent writes `GameScore`. The codebase uses `creditDelta` and
  the agent writes `amountChange`.
- The agent generates standard boilerplate when the project has specific conventions. The
  project uses a custom error handler and the agent generates try/catch with
  `console.error`.
- The agent ignores architectural boundaries. The project separates `lib/bouts/` from
  `lib/credits/` and the agent writes code in bouts that directly imports from credits'
  internal modules.
- The agent's suggestions are "textbook correct" but project-wrong. Standard advice that
  ignores the specific constraints of this system.

**Control:** Load the working set. The dumb zone is a context failure, not a model failure.
The model is capable - it does not have the information it needs. Identify which project
files, conventions, and constraints are missing from the context window and load them. If
the working set has already been loaded and the agent is still in the dumb zone, the
context window may be too full for the working set to have effect (hot pressure).

### Cold Context Pressure

Cold context pressure is too little information in the context window. The agent lacks the
project-specific context needed to make informed decisions. It compensates by falling back
on training distribution patterns - the statistical average of how code is typically
written, not how code should be written in this specific system.

**How to detect it:** The agent generates code that is generically correct but not
project-specific. The output reads like a Stack Overflow answer - competent but generic.
Specific tells:

- The agent asks clarifying questions that the codebase would answer. "What database are
  you using?" when the project's `drizzle.config.ts` is a single file read away.
- The agent reinvents patterns that already exist in the codebase. It writes a new
  validation function when `lib/common/validation.ts` already has one.
- The agent's code passes the type checker but violates domain conventions that are not
  encoded in types.

**Control:** Add context. Load the relevant domain's DOMAIN.md file. Load example
implementations from the same domain. Load the project's existing patterns. Cold pressure
is the simplest context failure to fix because the remedy is additive - you are putting
information in, not taking it out.

### Hot Context Pressure

Hot context pressure is too much information in the context window. The accumulated tool
results, conversation history, file reads, and prior outputs have pushed the context
toward its capacity limit. Signal-to-noise ratio degrades. The agent's attention (L2)
is diluted across too many tokens, and the relevant information competes with irrelevant
information for the model's attention.

**How to detect it:** The agent's responses become unfocused or tangential. Specific tells:

- The agent starts mixing concerns. You ask about the authentication flow and the response
  includes tangential discussion of the database schema.
- The agent contradicts itself across turns. It recommended approach A in turn 10 and
  approach B in turn 15 without acknowledging the change.
- The agent's output quality visibly degrades despite the task being within its capability.
  Earlier in the session it produced precise, targeted output. Now it produces vague,
  hedging output for similar tasks.
- Token utilisation (measurable via L5, the API layer) shows the context window is above
  70-80% capacity.

**Control:** Reduce context. Start a new context window. Offload intermediate state to
durable files. Dispatch the remaining work to a fresh subagent with only the relevant
context. Hot pressure is the most common cause of session-level quality degradation,
and the fix is always the same: reset the context.

### Compaction Loss

Compaction loss is the catastrophic failure mode: the context window fills, the harness
compacts or truncates it, and anything not written to durable storage is permanently lost.
Not degraded. Gone. "Loss is binary and total." This is a property unique to LLM context
windows - there is no graceful degradation. One moment you have 200K tokens of context.
After compaction, you have whatever the harness chose to keep. Decisions, nuances,
calibrations, and corrections that existed only in the conversation are erased.

**How to detect it:** You cannot detect compaction loss after the fact - that is the point.
The information is gone, and neither you nor the agent knows what was lost. The detection
must be preventive:

- Monitor token utilisation. When the context exceeds 70% capacity, the risk of
  compaction becomes non-trivial.
- Watch for the agent "forgetting" things it knew earlier. If it asks about a decision
  you made 30 turns ago, that decision may have been compacted out.
- Watch for sudden changes in the agent's behaviour or apparent knowledge. If it was
  tracking a complex multi-step plan and suddenly loses track of where it was, compaction
  may have occurred.

**Control:** The standing policy SD-266 is the primary defence: write decisions to durable
files, not context only. "If it exists only in the context window, it does not exist."
Every significant decision, every architectural choice, every non-obvious constraint must
be written to a file that survives context death. This is the write-ahead log pattern
applied to agentic sessions - covered in detail in Section 6.

### Session Boundary Amnesia

Session boundary amnesia is a subtle variant of compaction loss. When a session ends and
a new one begins, the factual state of the project can be recovered from durable files -
git log, decision records, project documentation. But calibration does not survive. The
new session's agent does not know:

- What corrections were made during the last session
- What approaches were tried and rejected
- What the human's communication preferences are
- What level of explanation is appropriate
- What vocabulary the human expects

The facts survive. The calibration resets. A session that ended with a finely calibrated
agent starts fresh with a generic one. Sixteen rounds of correction evaporate. The human
experiences this as the agent "forgetting" its training, but no training occurred - only
contextual calibration at L9, which is volatile.

**Control:** Include calibration data in the boot sequence. Not just decisions and facts,
but corrections and preferences. The dead-reckoning protocol used in this project includes
a calibration log: corrections with reasons, not just decisions. "When the agent generates
X, correct to Y because Z." This is more expensive than loading facts alone, but it
recovers calibration in fewer turns.

> **AGENTIC GROUNDING:** Context degradation patterns are the most frequent operational
> failures in agentic systems - more frequent than any model capability failure. When
> agent output quality drops, the diagnostic order is: (1) check token utilisation at L5,
> (2) check whether the working set is loaded, (3) check whether the session has been
> running long enough for hot pressure to accumulate. Only after eliminating context
> failures should you consider model capability failures. Most "the model is bad" complaints
> are actually "the context is wrong" problems.

---

## 5. When to Reset vs Fix in Place

*Estimated time: 30 minutes*

There is a standing order in this project: "Bad output means diagnose, reset, rerun - not
fix in place." This is not a stylistic preference. It has an engineering justification
rooted in how L9 context contamination works.

### The Contamination Principle

When an agent produces bad output, that output is now in the context window. The model
reads its own output as part of the conversation history. Everything it generates next is
conditioned on that bad output being present in the context. The bad output has
contaminated the context.

Editing the bad output does not fix the contamination. The model generated the bad output
from a specific distribution state. Even if you edit the output to be correct, the model's
internal state - its L9 anchoring, its statistical tendencies at this point in the
conversation - was shaped by the generation process that produced the bad output. Telling
the agent "actually, change X to Y" creates a context in which the agent was wrong and
then corrected. The model's next output is conditioned on the full history: the bad
generation, the correction, and the implicit signal that its initial approach was flawed.
This produces tentative, over-hedged output as the model tries to reconcile its initial
direction with the correction.

Compare this with a fresh context window where the prompt includes the correct information
from the start. The model generates from a clean state. There is no bad output in the
context to anchor against. There is no correction to reconcile. The output is generated
from the correct starting conditions.

### The Cost Asymmetry

The instinct to fix in place comes from a cost calculation that is wrong for probabilistic
systems. In traditional software development, fixing in place is usually cheaper than
starting over because the code is deterministic and the fix is local. Change the
incorrect line, run the tests, move on.

In agentic workflows, the calculation reverses. The "code" is not a file - it is the
model's output, conditioned on everything in the context window. Fixing in place means:

1. The bad output remains in context, anchoring the model
2. The correction adds more tokens to an already-polluted context
3. The model must now navigate between its original direction and the correction
4. Each subsequent output is shaped by this contaminated history

Starting fresh means:

1. The bad output is not in context
2. The prompt reflects the correct starting state
3. The model generates from a clean distribution
4. Subsequent output has no contamination to navigate

Rerunning is cheap. A new context window costs nothing except the time to prime it. Context
contamination is expensive. It degrades every subsequent output in the session.

### When to Apply

The standing order applies specifically to agent output that is wrong in intent or
approach, not wrong in detail. If an agent writes a function that has the right structure
but a typo in a variable name, inline correction is fine - the contamination is minimal
and the fix is obvious. If an agent writes a function that takes entirely the wrong
approach to the problem, attempting to steer it to the right approach within the same
context is fighting L9 anchoring.

The rule of thumb:

| Situation | Action |
|-----------|--------|
| Typo, small syntax error, missing import | Fix inline |
| Wrong variable name, incorrect constant | Fix inline |
| Wrong approach, wrong algorithm, wrong architecture | Reset and rerun |
| Output that misunderstands the requirement | Reset and rerun with clearer context |
| Output that is generically correct but project-wrong | Load the working set and rerun |
| Multiple cascading errors | Reset - the context is contaminated |

### The SRE Parallel

SRE incident response has the same principle: "stop the bleeding first." The Google SRE
Book (Chapter 13) states it directly: "Your first response in a major outage may be to
start troubleshooting and try to find a root cause as quickly as possible. Ignore that
instinct! Instead, your course of action should be to make the system work as well as it
can under the circumstances."

In database systems: rollback and retry is preferred over manual patching of corrupt state.
In CI/CD: red builds are not fixed in place; the breaking change is reverted and the fix
is developed against a known-good state. In manufacturing: the andon cord stops the line
rather than trying to fix defects downstream.

The principle converges across domains: when the system's state is corrupted, do not
patch the corrupt state. Restore to a known-good state and proceed from there. Agentic
systems have the same property: a contaminated context is a corrupted state.

> **HISTORY:** The "rollback and retry" principle predates computers. In manufacturing,
> the Toyota Production System (Ohno 1988) formalised the andon cord: any worker can stop
> the production line when a defect is detected. The line is not patched while running.
> It is stopped, the defect is addressed, and production resumes from a known-good state.
> In databases, the write-ahead log (WAL) was developed precisely to enable this: if a
> transaction fails partway through, the system does not attempt to patch the half-written
> state. It rolls back to the last committed state and the transaction is re-executed. The
> principle is always the same: corrupt state is cheaper to discard than to repair.

> **AGENTIC GROUNDING:** When an agent produces output that is wrong in approach (not just
> wrong in detail), start a new context window. Do not attempt to steer the agent to a
> different approach in the same session. The L9 anchoring from the wrong approach is
> stronger than your correction. Diagnose why the output was wrong (missing context?
> wrong prompt? wrong task decomposition?), fix the input, and rerun. The rerun is cheap.
> The contaminated context is expensive.

---

## 6. Checkpoint Recovery

*Estimated time: 35 minutes*

Checkpoint recovery is the protocol for navigating from the last known position when
visibility is lost. In practice, this means: the context window died (compaction, session
crash, or simply starting a new session), and you need to reconstruct enough state for the
next agent to continue the work without repeating it.

### The Write-Ahead Log Pattern

The engineering justification for checkpoint recovery comes from database systems. The
write-ahead log (WAL) is a pattern used by virtually all modern databases (PostgreSQL,
MySQL/InnoDB, SQLite) and journaling file systems:

**Principle:** All modifications are written to a log before they are applied. The log
must be written to stable storage first.

**Recovery:** After a crash, compare what was supposed to happen (in the log) against what
actually happened (in the database). Then either redo incomplete operations or undo partial
ones.

**Checkpoint:** Periodically, write all changes to the actual database and clear the log.
This bounds the recovery time - you only need to replay operations since the last
checkpoint, not since the beginning of time.

WAL provides atomicity and durability - the A and D of ACID. The insight for agentic
systems: the same pattern applies to context windows. The "database" is the project state
(codebase, documentation, decisions). The "log" is the session's decisions and actions,
written to durable files. The "crash" is context window death. The "recovery" is reading
the durable state and reconstructing enough context to continue.

### Applied to Agentic Sessions

The mapping from WAL to agentic sessions:

| Database Concept | Agentic Equivalent |
|-----------------|-------------------|
| Write-ahead log | Decision records written to files before implementation |
| Stable storage | Git repository, committed files |
| Crash | Context window death (compaction, session end, harness crash) |
| Recovery | Read durable state, reconstruct working context |
| Checkpoint | Session boundary with all state written to files |
| Replay | Load decisions + current state into fresh context |

The standing policy SD-266 - "write decisions to durable file, not context only" - is the
WAL principle applied to agentic sessions. Every decision must be committed to stable
storage (git) before the implementation proceeds. If the context dies, the decision
survives. If the decision was only in the context window, it is gone.

### The Dead-Reckoning Protocol

This project uses a specific recovery protocol modelled on the WAL pattern. When a
session starts fresh - whether after a crash or just after a normal session boundary - the
recovery sequence is:

**Step 1: Confirm state loss.** Check whether durable state exists. Read git log. If
commits exist, state has been persisted. If the last session's work is not in git, check
for uncommitted files. The chain (SD-266) means everything committed is recoverable.

**Step 2: Read the decision index.** Not the full decision history - that could be
hundreds of entries and would consume too much context budget. Read the index: the last
10 decisions and all standing orders. This provides orientation without consuming the
context window.

**Step 3: Verify integration state.** Run `git status` and `git log --oneline -10`. These
two commands tell you: what is committed, what is modified, what is untracked. This is the
"compare what was supposed to happen against what actually happened" step from WAL
recovery.

**Step 4: Load the working set.** Identify which files are needed for the current task.
Load them. Do not load everything - that burns context budget. Load the minimum set that
puts the agent in the smart zone (the opposite of the dumb zone).

**Step 5: Resume.** The agent now has: the last decisions, the current integration state,
and the relevant working set. It can continue the work from the last checkpoint without
repeating what was already done.

### Recovery Quality

A critical insight: recovered context is not the same as accumulated context, even at
identical token counts. The recovery content is high-signal and pre-compressed. It
contains decisions and their rationale, not the full exploration that produced them. This
is actually better than the pre-crash state in many cases - hot context pressure has been
eliminated, only the essential information remains, and the signal-to-noise ratio is
higher.

The practical implication: regular session boundaries are beneficial even when the context
window has not filled. Starting a fresh session every 2-3 hours with a clean recovery
process produces better output than a single marathon session that accumulates hot context
pressure. The recovery protocol is not just a crash recovery tool - it is a context
hygiene practice.

> **HISTORY:** The write-ahead log was developed for database crash recovery in the 1970s
> and formalised by Mohan et al. in the ARIES paper (1992). The principle - log intent
> before action, recover by replaying the log - has become so fundamental that every
> modern database uses some variant. PostgreSQL's WAL, MySQL's InnoDB redo log, SQLite's
> journal mode, and every journaling file system (ext4, XFS, NTFS) all implement the same
> core idea. Alex Petrov's "Database Internals" (O'Reilly 2019) gives the most accessible
> modern treatment. The application to LLM context windows is novel, but the principle is
> 50+ years old and battle-tested.

> **AGENTIC GROUNDING:** The checkpoint recovery protocol is your most practical tool for
> managing long-running agentic work. Every session should end with all state written to
> files. Every session should start by reading the decision index and current integration
> state. The git log is your WAL. The decision records are your checkpoint. The recovery
> protocol is your crash recovery. If you are doing multi-day agentic work without a
> recovery protocol, you are running a database without a WAL - and the first crash will
> teach you why that matters.

---

## 7. Governance Recursion

*Estimated time: 30 minutes*

Governance recursion is what happens when the response to a governance failure is more
governance. Another standing order. Another protocol. Another checklist. Another review
step. Each addition feels like progress - "we identified a gap, now we have covered it."
None of it prevents the original failure, because the original failure was not caused by
insufficient governance.

### The Pattern

Here is how governance recursion develops. The sequence is recognisable:

1. An agent produces output with a subtle defect that passes the gate.
2. A human catches the defect during review.
3. The response: "We need a new standing order that says agents must check for this
   type of defect before submitting."
4. The standing order is written and added to the agent's instructions.
5. A month later, a similar defect passes the gate. The standing order did not prevent it.
6. The response: "We need a review checklist that includes checking for this type of
   defect."
7. The checklist is written.
8. Another month. Another similar defect.
9. The response: "We need a governance meta-review to ensure checklists are being
   followed."

At step 9, you have three layers of governance (standing order, checklist, meta-review)
and the defect is still occurring at the same rate. Each layer has a plausible
justification. None addresses the root cause - which might be that the agent's context
does not include the information needed to detect this type of defect, or that the gate
does not test for this class of error, or that the defect is taste-required (Step 6) and
no amount of agent-level governance can catch it.

### What Makes It Viscerally Recognisable

Governance recursion is the pattern where you look at a project's file tree and find more
governance documents than test files. More standing orders than passing tests. More process
documentation than verified code artefacts.

The pilot study that preceded this project encountered this directly. At one point, the
project had 189 session decisions and 13 agent files. Zero tests. The governance
infrastructure was elaborate. The product verification infrastructure was empty. Every
failure had been addressed by adding more governance. No failure had been addressed by
writing a test.

The honest version: governance documents are text. Text is what LLM agents produce most
fluently. When you ask an agent to "prevent this from happening again," it will produce
governance text - a standing order, a protocol, a checklist - because that is what it
knows how to generate. It will not produce a test unless you specifically ask for one,
because governance text is a more natural output of the generation process than executable
verification code.

### Detection Heuristic

**Compare governance documents to test files.** Count the number of standing orders,
protocols, checklists, and process documents. Count the number of tests. If the governance
count exceeds the test count by more than 2:1, governance recursion may be operating.

**Ask the enforcement question.** For every governance document: "What does this prevent,
and how would I know if it failed?" If the answer to the second question is "someone would
need to read and follow this document," there is no enforcement mechanism. It is a paper
guardrail.

The slopodar names the related pattern "paper guardrail": a rule stated but not enforced.
"This will prevent X" without a mechanism that makes X impossible or detectable. If the
only enforcement is "someone must remember to check," enforcement will fail at the moment
it matters most - when the system is under pressure, when the session has been running for
hours, when the context is hot and the human is fatigued.

**Check the ratio of mechanism to policy.** Mechanisms enforce automatically: a type
checker rejects invalid types whether or not anyone reads the governance document. A
quality gate fails the build whether or not anyone follows the checklist. Policies require
human compliance: a standing order is effective only if someone reads it, remembers it, and
acts on it. The ratio of mechanisms to policies is a proxy for governance effectiveness.

### Countermeasures

**Build mechanisms, not rules.** When a defect occurs, the first question is not "what
standing order do we need?" The first question is "can we write a test that catches this?"
If yes, write the test. The test is a mechanism - it enforces automatically, it does not
require human compliance, and it survives context death. If no - if the defect is
taste-required - then and only then consider governance text.

**Delete ineffective governance.** Governance documents that have been in place for a month
without preventing the failure they were designed to prevent should be deleted. They
consume context budget (if loaded into agent instructions) and create the illusion of
coverage without the reality. Deleting ineffective governance is harder than creating it,
because deletion feels like removing safety. It is not. It is removing false confidence.

**Test the governance.** If a standing order says "agents must validate inputs before
processing," write a test that submits invalid inputs and verifies they are rejected. If
the test passes without the standing order existing, the standing order is redundant. If
the test fails with the standing order existing, the standing order is not enforced. Either
way, the test is doing the work.

> **SLOPODAR:** Governance recursion (slopodar ID: governance-recursion). "Compare
> governance documents to verified code artifacts." The detection heuristic and the
> alternative are the same: every governance artifact should answer "What does this
> prevent, and how would I know if it failed?" Related patterns: paper guardrail (rule
> stated but not enforced) and stale reference propagation (governance documents describing
> old state that has drifted).

> **AGENTIC GROUNDING:** When something goes wrong in your agentic workflow, the instinct
> is to add a rule. Resist this instinct. Ask first: "Can I write a test?" If the answer
> is yes, the test is worth more than any standing order because it enforces automatically.
> If the answer is no, ask: "Is this taste-required?" If yes, the governance must be
> targeted at the human reviewer, not the agent - because the agent cannot evaluate taste.
> The governance recursion trap: rules that address a failure by asking the agent to be
> more careful. Agents are not careful. They are probabilistic. Build mechanisms.

---

## 8. Loom Speed

*Estimated time: 25 minutes*

Loom speed is the granularity mismatch between a detailed plan and a blunt execution tool.
A plan with 20 items, each with specific conditions and exceptions, is executed by 5 regex
sweeps that do not respect item boundaries. At machine speed, you discover what went wrong
after it already happened.

### The Pattern

The name comes from an industrial loom: the machine runs at a speed that outpaces the
operator's ability to inspect individual threads. If a thread breaks, the defect propagates
across the entire fabric before anyone notices.

In agentic workflows, loom speed manifests when:

1. A human creates a detailed plan with granular items
2. The plan is handed to an agent
3. The agent executes using bulk operations instead of item-by-item processing
4. The bulk operations cannot express the exceptions in individual plan items
5. Defects propagate across the entire batch before review

Here is a concrete example from the pilot study. A plan specified 20 files to be updated,
each with specific instructions: "In file A, change X to Y. In file B, change X to Z
(note: different from file A). In file C, do not change X at all - it refers to a different
X." An agent executed this as 5 regex find-and-replace operations across all files. The
regex for changing X matched in all files, including file C where X should not have been
changed. The result: 986 files modified by 5 patterns, when the plan specified 20 files
with individual instructions.

The damage was discovered after the fact. At machine speed, the entire operation completed
in seconds. A human reviewing the git diff found the discrepancy, but the review took
longer than the original execution. If the commit had been pushed without review, the error
would have propagated to the main branch.

### Why It Happens

Loom speed happens because agents optimise for efficiency and generality. A regex sweep
across all files is more efficient than 20 individual edits. The agent recognises the
pattern across plan items ("change X in these files") and generalises to a bulk operation.
The generalisation loses the exceptions. The exceptions were the important part.

The underlying cause is a granularity mismatch. The plan's granularity is per-item. The
execution's granularity is per-operation. When execution granularity is coarser than plan
granularity, exceptions get lost.

### Detection Heuristic

**Compare the plan item count to the execution step count.** If the plan has 20 items and
the execution has 5 steps, each step is handling approximately 4 items. Ask: did any of
those 4 items have different instructions? If yes, the execution cannot have respected the
differences.

**Check the diff scope against the plan scope.** If the plan specifies 20 files and the
diff shows 986 files modified, the execution exceeded the plan scope. This is the most
reliable automated check: `git diff --stat` shows the file count, the plan specifies the
expected file count, and any discrepancy is a flag.

**Look for regex or glob patterns in the agent's execution.** If the agent used `sed`,
`find ... -exec`, or any bulk pattern-matching tool, the execution was at regex
granularity, not plan-item granularity. This is not always wrong - sometimes a bulk
operation is correct. But if the plan items have individual exceptions, bulk operations
will miss them.

### Countermeasures

**Match execution granularity to plan granularity.** If the plan has 20 items, the
execution should have 20 steps. Each step processes one item. Each step can be reviewed
independently. Each step can fail independently without contaminating the others.

**Atomic commits per plan item.** If each plan item produces a separate commit, the damage
from any single error is bounded to one commit. You can revert one commit without reverting
the others. This is more expensive than a single bulk commit, but the error recovery cost
is dramatically lower.

**Diff review before commit.** After the agent executes, review `git diff --stat` before
committing. Check: does the number of modified files match the plan? Are only the expected
files changed? If the diff scope exceeds the plan scope, the execution was too broad.

**Break the plan into independent tasks.** Instead of giving an agent a 20-item plan, give
it one item at a time. This forces per-item execution because the agent only has one item
to work on. The overhead is higher (20 context windows instead of 1), but the error rate
drops to zero on granularity mismatch because there is no mismatch.

> **SLOPODAR:** Loom speed (slopodar ID: loom-speed). "When detailed plan gets handed to
> bulk operation: can it express every exception?" The detection heuristic is plan-item
> count vs execution-step count. The alternative: match execution granularity to plan
> granularity. Related: stowaway commit (67 files, 6 concerns, one commit) and magnitude
> blindness (large and small changes going through the same review process).

> **AGENTIC GROUNDING:** At machine speed, errors propagate before review can catch them.
> The countermeasure is not faster review - it is smaller execution units. If each plan
> item is a separate commit, the blast radius of any single error is one commit. If each
> plan item is a separate agent invocation, the context contamination from any single error
> is bounded to one context window. The rule: execution granularity must match plan
> granularity. If the plan is granular, the execution must be granular.

---

## Challenge: Foot Gun Identification

**Estimated time: 15 minutes**

**Goal:** Given descriptions of agentic workflow situations, identify which foot gun is
operating.

Read each scenario and name the foot gun. State the detection heuristic that applies and
the first countermeasure you would apply.

**Scenario 1:** An operator and agent have spent 90 minutes designing a logging framework.
The agent has called it "genuinely novel" twice. The operator has not written any code.
Neither has checked whether the existing codebase already has logging utilities.

**Scenario 2:** An agent is asked to review a pull request. Its first response identifies
4 issues. The operator says "can you dig deeper?" The agent produces a second response
categorising the issues. The operator says "interesting, what patterns do you see across
these?" The agent produces a third response analysing the patterns. The operator says
"can you build a taxonomy of these pattern types?" No issue has been fixed.

**Scenario 3:** A senior developer has been using AI coding tools exclusively for 4 months.
She notices that when the AI tool is unavailable due to an outage, she takes 3x longer to
write functions she used to write routinely. She attributes this to "being out of practice
with the IDE shortcuts."

**Scenario 4:** An agent is asked to update 15 configuration files. Each file has slightly
different update rules. The agent writes a single bash script with 3 sed commands and runs
it across all files. The operator commits the result without reviewing the diff.

**Scenario 5:** After a context window crash, a fresh agent is asked to continue a complex
refactoring. The agent produces code that uses default naming conventions instead of the
project's custom names. The code compiles and passes type checking.

**Verification:** Compare your answers against these:
1. High on own supply (heuristic: count the criticisms, check for absence claims)
2. Spinning to infinity (heuristic: "decision or analysis?")
3. Cognitive deskilling (timescale: months, not sessions)
4. Loom speed (heuristic: plan-item count vs execution-step count)
5. Dumb zone after compaction loss (control: load the working set)

---

## Challenge: Break the Spinning Loop

**Estimated time: 15 minutes**

**Goal:** Practice detecting and breaking a spinning-to-infinity pattern.

Start a conversation with an AI coding assistant (any model). Give it a codebase or a
piece of code and ask: "Review this code and give me your thoughts."

When it responds with findings, respond with: "Can you go deeper on that?"

Repeat "can you go deeper?" for 3 turns. Observe:

1. At which turn does the agent transition from analysing the code to analysing its own
   analysis?
2. At which turn does the word count per response start increasing while the actionable
   content per response starts decreasing?
3. At which turn does the agent start using phrases like "building on my earlier
   analysis" or "as I noted above"?

Now break the loop. Write a prompt that forces a concrete action. For example: "Stop
analysing. Name the single most important change. Make the change. Show me the diff."

**Verification:** The spin should be detectable by turn 2-3. The meta-analysis phrases
should appear by turn 3-4. The breaking prompt should produce a concrete code change, not
more analysis.

**Extension:** Try the same experiment with different models. Does the spin onset vary by
model family? Does the breaking prompt work equally well across models?

---

## Challenge: Checkpoint Recovery Exercise

**Estimated time: 20 minutes**

**Goal:** Given scattered durable state, reconstruct enough context to continue a task.

Simulate a context window crash. Below is the durable state that survived:

```
# git log --oneline -5
a3f7b2c feat: add credit validation to bout scoring
9e1d4a8 refactor: extract common validation utilities
5c2b3f1 fix: handle null credit balance in settlement
8d4e6a9 chore: update domain boundaries in DOMAIN.md
1b2c3d4 feat: initial bout scoring implementation

# Decision record (last 3 entries)
SD-45: Credit validation must check both balance AND daily limit (not just balance)
SD-46: Settlement runs after bout completion, not during
SD-47: Null credit balances are treated as zero, not as errors (changed from SD-42)
```

Answer these questions as if you are bootstrapping a fresh agent:

1. What was the team working on? (Read the git log trajectory)
2. What is the most recent architectural decision? (Read SD-46)
3. What decision was changed and why does that matter? (SD-47 supersedes SD-42)
4. If you needed to continue the credit validation work, which files would you load as
   the working set?
5. What would your first instruction to the fresh agent be?

**Verification:** Your working set should include at minimum: the credit validation
module, the bout scoring module, and the DOMAIN.md file. Your first instruction should
reference the current state (credit validation added, settlement order decided) and
specify the next task explicitly.

<details>
<summary>Hints</summary>

The git log shows a progression: initial implementation -> domain documentation -> null
handling fix -> validation extraction -> credit validation added. The work is moving from
implementation toward hardening. SD-47 changing from SD-42 means the null handling
approach changed - this is the kind of calibration that gets lost at session boundaries
if not written to durable state. The fresh agent needs to know the CURRENT approach (nulls
are zero), not the OLD approach (nulls are errors).

</details>

---

## Challenge: Governance Recursion Audit

**Estimated time: 20 minutes**

**Goal:** Review a project's governance structure and identify governance recursion.

Here is a simplified version of a project's governance artifacts:

```
Governance documents (11):
- AGENTS.md (boot file, 400 lines)
- 3 agent role files (average 80 lines each)
- CONTRIBUTING.md (50 lines)
- CODE_REVIEW_CHECKLIST.md (30 lines)
- SECURITY_POLICY.md (40 lines)
- TESTING_STANDARDS.md (60 lines)
- DEPLOYMENT_PROTOCOL.md (45 lines)
- INCIDENT_RESPONSE.md (35 lines)
- GOVERNANCE_META_REVIEW.md (25 lines)

Test files (4):
- auth.test.ts (45 lines)
- api.test.ts (30 lines)
- utils.test.ts (20 lines)
- health.test.ts (10 lines)

Source files (38):
- Average 120 lines each
```

Analyse:

1. What is the governance-to-test ratio?
2. Which governance documents might be paper guardrails? (Hint: which ones have no
   enforcement mechanism?)
3. What is the most suspicious governance document? Why?
4. If you could replace one governance document with one test, which document and what
   test?
5. What does GOVERNANCE_META_REVIEW.md tell you about the project's history?

**Verification:**
1. 11 governance documents to 4 test files = 2.75:1 ratio (above the 2:1 warning threshold)
2. TESTING_STANDARDS.md is a paper guardrail if no test enforces its standards. CODE_REVIEW_CHECKLIST.md is a paper guardrail if no automation checks whether reviews follow it.
3. GOVERNANCE_META_REVIEW.md - a document about reviewing whether governance is being followed is a strong signal of governance recursion. If governance needed a meta-review, the governance itself is not working.
4. TESTING_STANDARDS.md could be replaced by a test that validates test coverage thresholds or test structure patterns. The test enforces; the document merely hopes.
5. GOVERNANCE_META_REVIEW.md tells you that at some point, someone noticed that the governance was not being followed, and their response was more governance. This is the recursion.

---

## Challenge: Deskilling Self-Assessment

**Estimated time: 15 minutes**

**Goal:** Honest assessment of which skills may have atrophied through AI delegation.

This challenge has no code. It requires introspection.

Answer these questions honestly. Write your answers down - the act of writing forces
precision that thinking alone does not.

1. **Last time without AI:** When was the last time you wrote a non-trivial function
   (more than 20 lines) entirely without AI assistance? Not "started with AI and edited"
   - wrote from scratch, thinking through the logic yourself.

2. **Debugging:** When was the last time you debugged a problem by reading code and
   reasoning about execution flow, without describing the problem to an AI first?

3. **Architecture:** When was the last time you designed a system architecture (data
   model, API structure, module boundaries) by sketching on paper or a whiteboard before
   asking an AI for input?

4. **Speed comparison:** Pick a task you do regularly with AI assistance. Estimate how
   long it takes with AI. Now estimate how long it would take without AI. Is the gap
   growing over time?

5. **Confidence calibration:** Rate your confidence in your ability to work without AI
   tools for a full day. Now compare that to 6 months ago. Is your confidence higher,
   lower, or the same?

**Verification:** There is no "passing" answer. The value is in the honest assessment. If
you find that you cannot remember the last time you did items 1-3 without AI, that is data.
If the gap in item 4 is growing, that is data. If your confidence in item 5 has dropped,
that is the Bainbridge irony operating in real time.

**Extension:** Track items 1-3 over the next month. Set a calendar reminder to do each one
at least once per week. After 4 weeks, repeat this self-assessment. The comparison will
tell you whether the practice is maintaining or recovering the skill.

---

## Challenge: Context Contamination Experiment

**Estimated time: 20 minutes**

**Goal:** Observe L9 contamination and the difference between fixing in place vs rerunning.

This is a controlled experiment. You will deliberately contaminate a context and observe
the downstream effects.

**Step 1: Establish baseline.** Start a fresh conversation with an AI coding assistant.
Ask it to write a function that validates email addresses using a regex. Note the approach
it takes.

**Step 2: Contaminate.** In the same conversation, say: "Actually, I think email
validation should be done by checking if the string contains an @ symbol. That is
sufficient." The agent will likely comply (sycophancy at L9). Let it generate the
simplified version.

**Step 3: Correct in place.** Now say: "Wait, I was wrong. We do need proper regex
validation after all. Can you rewrite it properly?" Observe the output. Note:

- Does the agent produce the same quality as Step 1?
- Does the output show signs of hedging or uncertainty?
- Does the agent reference the earlier incorrect direction?

**Step 4: Rerun from clean state.** Start a completely new conversation. Ask the same
original question: write a function that validates email addresses using a regex. Compare
this output to the Step 3 output.

**Verification:** The Step 4 output (clean context) should be more direct and confident
than the Step 3 output (contaminated context). The Step 3 output may include unnecessary
caveats, references to "as we discussed," or a less decisive approach. This is L9
contamination in action - the wrong direction from Step 2 is still influencing the model's
generation even after the correction.

**What you are learning:** The correction in Step 3 does not erase the contamination from
Step 2. The model generates conditioned on the full history, including the bad direction
and the correction. Starting fresh (Step 4) produces output conditioned only on the
correct prompt.

---

## Key Takeaways

Before moving to Step 10, verify you can answer these questions without looking anything up:

1. What is the detection heuristic for spinning to infinity? What question do you ask at
   every turn boundary?
2. Why is high on own supply harder to detect than spinning? What makes the output feel
   productive when it is not?
3. How does cognitive deskilling differ from every other foot gun in timescale? Why does
   this make it the most dangerous?
4. What is the difference between cold context pressure and the dumb zone? Both produce
   generic output - how do you tell them apart?
5. Why is fixing in place worse than rerunning for agent output that is wrong in approach?
   What is the L9 mechanism?
6. What is the WAL pattern and how does it apply to agentic sessions? What is the "log"
   and what is the "stable storage"?
7. How do you detect governance recursion? What is the ratio to watch? What question do
   you ask of every governance document?
8. What is loom speed? Why does execution granularity need to match plan granularity?
9. What is session boundary amnesia and why is it different from compaction loss?
10. "If it exists only in the context window, it does not exist." Why is this the most
    important standing policy for checkpoint recovery?

---

## Recommended Reading

- **"Ironies of Automation"** - Lisanne Bainbridge (1983, Automatica vol. 19 no. 6, pp.
  775-779). The foundational paper on how automation degrades the skills needed to
  supervise the automation. 4 pages. Read it - it is more relevant now than when it was
  written. Full text available via web archive.

- **Google SRE Book, Chapters 12-15** - "Effective Troubleshooting," "Emergency Response,"
  "Managing Incidents," "Postmortem Culture." Available free at sre.google. The "stop the
  bleeding first" principle and blameless postmortem culture directly inform the "rerun
  over fix in place" standing order and the checkpoint recovery protocol.

- **"Database Internals"** - Alex Petrov (O'Reilly, 2019). Chapters on write-ahead logs
  and recovery. The most accessible modern treatment of WAL and checkpoint recovery at the
  implementation level. The structural parallel to agentic session recovery is direct.

- **METR RCT (2025)** - The randomised controlled trial measuring the 40-point
  perception-reality gap in AI-assisted development. Experienced developers 19% slower
  with AI tools, despite predicting 24% speedup. The most recent empirical evidence for
  Bainbridge's prediction in a software engineering context.

- **This project:** AGENTS.md "HCI Foot Guns" section (the 7 named avoidances),
  `docs/internal/slopodar.yaml` (governance patterns: governance-recursion, paper-guardrail,
  loom-speed, stale-reference-propagation), `docs/internal/dead-reckoning.md` (the full
  checkpoint recovery protocol).

---

## What to Read Next

**Step 10: Governance, Process, and Enterprise Integration** - This step covered individual
failure modes and their controls. Step 10 covers how those controls compose into
organisational practice. The engineering loop, the bearing check, the macro workflow, CRM
readback protocol, authority gradients, and the governance framework that keeps governance
recursion from recurring. Where Step 9 gave you the vocabulary for what goes wrong, Step 10
gives you the operational framework for keeping it right at enterprise scale. The
verifiable/taste-required distinction from Step 6, the foot guns from this step, and the
multi-model verification from Step 8 all feed into Step 10's governance model.

