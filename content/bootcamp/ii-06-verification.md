+++
title = "Verification and Quality for Probabilistic Systems"
date = "2026-03-10"
description = "The oracle problem, the quality gate, the Swiss Cheese Model. Five named test anti-patterns."
tags = ["verification", "quality", "testing", "bootcamp"]
step = 6
tier = 2
estimate = "6-7 hours"
bootcamp = 2
+++

Step 6 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This is Step 6

LLM output is probabilistic. Every output has a non-zero probability of being wrong in
ways that are syntactically valid and contextually plausible. The model can produce code
that compiles, passes type checking, follows existing patterns, satisfies the linter, and
is completely wrong in intent, logic, or edge case handling. Traditional testing assumes
deterministic systems: the same input produces the same output, and a passing test means
the code is correct for that input. Neither assumption holds for agent-generated code.

This is not a theoretical concern. Step 1 explained that generation is autoregressive -
the model emits one token at a time based on probability distributions conditioned on
everything that came before. Step 4 explained the context quality loop - clean code
produces better context for future agent runs, which produces cleaner code. The inverse
is also true: if agent-generated code contains subtle defects that pass verification, those
defects become part of the codebase context. The next agent run reads that defective code,
treats it as a valid pattern, and produces more of the same. Slop compounds.

The verification challenge for probabilistic systems is fundamentally different from
traditional QA. You are not checking whether a developer implemented a specification
correctly. You are checking whether a system that generates plausible-looking output from
statistical patterns has produced output that is actually correct - and you cannot always
tell the difference by looking.

This step has two layers. The first layer - quality gates, CI/CD pipelines, test suites -
is established engineering practice with decades of industry adoption. The second layer -
the oracle problem applied to human-AI verification, the verifiable/taste-required
distinction as a governance dial, named test anti-patterns caught in agent-generated code -
is where field coverage thins and operational experience becomes the primary source.

> **FIELD MATURITY: EMERGING** for quality gates, CI/CD practices, and the Swiss Cheese
> Model. These are established with extensive literature and tooling. **FRONTIER** for the
> oracle problem applied to human-AI systems, the five named test anti-patterns, and the
> verifiable/taste-required distinction as THE governance dial for agentic engineering.
> The field provides the foundations (Reason 1990, Weyuker 1982, Toyota poka-yoke). This
> project provides the application to probabilistic AI systems, derived from 200+ session
> decisions of daily practice. Intellectual honesty requires stating this: if you recognise
> these patterns in your own work, they replicate. If you do not, they do not.

The goal: build a verification discipline for probabilistic systems that catches defects
traditional testing misses, makes the distinction between what machines can verify and what
only humans can evaluate, and compounds quality instead of compounding debt.

---

## Table of Contents

1. [The Fundamental Verification Challenge](#1-the-fundamental-verification-challenge) (~35 min)
2. [The Oracle Problem](#2-the-oracle-problem) (~40 min)
3. [The Quality Gate](#3-the-quality-gate) (~40 min)
4. [Verifiable vs Taste-Required](#4-verifiable-vs-taste-required) (~50 min)
5. [The Verification Pipeline](#5-the-verification-pipeline) (~45 min)
6. [Definition of Done](#6-definition-of-done) (~25 min)
7. [Test Anti-Patterns in Agent-Generated Code](#7-test-anti-patterns-in-agent-generated-code) (~70 min)
8. [Evaluation Methods and Their Limits](#8-evaluation-methods-and-their-limits) (~40 min)
9. [The Context Quality Loop Revisited](#9-the-context-quality-loop-revisited) (~25 min)
10. [Challenges](#10-challenges) (~90-120 min)
11. [Key Takeaways](#11-key-takeaways)
12. [Recommended Reading](#12-recommended-reading)
13. [What to Read Next](#13-what-to-read-next)

---

## 1. The Fundamental Verification Challenge

*Estimated time: 35 minutes*

Most software testing operates on a simple premise: given a known input, the program
should produce a known output. If it does, the test passes. If it does not, the test fails.
This works because the system under test is deterministic. The same function, given the same
arguments, returns the same value every time.

Agent-generated code breaks this premise in a specific way. The code itself may be
deterministic - a function written by an agent, once written, executes deterministically.
But the process that produced it was not. Two identical prompts, given to the same model
at different times or with different context windows, may produce structurally different
code that both pass the same test suite. The correctness of the output is not guaranteed by
the process that generated it. It must be independently verified.

### The Shape of Agent-Generated Defects

Defects in hand-written code tend to be local. A developer misunderstands a boundary
condition, miscounts an array index, or introduces a type error. These defects are well
served by existing testing practices: unit tests catch wrong outputs, type checkers catch
type errors, linters catch style violations.

Defects in agent-generated code have a different shape. The model has seen millions of
examples of code that compiles, passes tests, and follows common patterns. It is very good
at producing output that has the **shape** of correctness. The syntax is right. The types
check. The tests pass. The variable names are reasonable. But the code may:

- **Implement the wrong algorithm.** The function returns the correct result for the test
  cases provided, but uses an approach that fails on inputs the tests do not cover. A sorting
  function that works for lists under 100 elements but has O(n^3) complexity because it chose
  the wrong algorithm - and the tests only use small inputs.

- **Satisfy the tests without satisfying the requirement.** The agent writes code that makes
  the existing test suite green, but the test suite does not actually test the requirement.
  The code is "right" by the measure available, and wrong by the measure that matters.

- **Introduce subtle semantic errors in edge cases.** Off-by-one errors, null handling gaps,
  race conditions in concurrent code, incorrect error propagation. These are the defects
  that hand-written code also produces, but the agent produces them without the developer's
  contextual awareness of which edge cases matter in this specific system.

- **Copy patterns from training data that do not apply.** The agent generates code that
  follows a common pattern from its training distribution, but the specific context requires
  a different approach. The code "looks right" to anyone who knows the pattern but not the
  project.

### Why This is Not Just "Write Better Tests"

The standard response is "write better tests." This is necessary but insufficient, for
two reasons.

First, the agent may also be writing the tests. When the same system that writes the code
also writes the tests, the tests tend to match the code - not because the code is correct,
but because the same statistical patterns that produced the code also produce tests that
validate it. The code is wrong, the tests assert the wrong behavior is correct, and the
suite is green. This is the "right answer, wrong work" anti-pattern - covered in detail in
Section 7.

Second, even hand-written tests have coverage gaps. Tests verify known scenarios. The
defects specific to agent-generated code often live in the scenarios nobody tested because
nobody anticipated them - because the failure mode is "statistically plausible code that
passes a surface check" rather than "obviously broken code that fails visibly."

The verification challenge for probabilistic systems is not "how do I write better tests."
It is "how do I build a verification system that catches defects in code where the
generation process provides no correctness guarantee, the output looks right, and the
standard automated checks pass."

> **AGENTIC GROUNDING:** When reviewing agent-generated code, do not start with "does it
> pass the tests?" Start with "does the test actually verify the requirement, or does it
> verify the code?" These are different questions. An agent that generates both code and
> tests will produce a pair that are internally consistent but may be jointly wrong. The
> first diagnostic: read the test assertion and ask whether you could change the
> implementation to break the intended behavior while keeping the test green. If you can,
> the test is verifying shape, not correctness.

---

## 2. The Oracle Problem

*Estimated time: 40 minutes*

In 1982, Elaine Weyuker published "On Testing Non-Testable Programs" in *The Computer
Journal*. The paper established what is now called the **oracle problem**: for some
programs, there is no reliable way to determine whether the output is correct for a given
input. A test oracle is something that can tell you whether a program's output is right.
For some programs, no practical oracle exists.

> **HISTORY:** Elaine Weyuker is an ACM Fellow, IEEE Fellow, and AT&T Fellow at Bell Labs,
> elected to the National Academy of Engineering for "contributions to software testing,
> reliability, and measurement, and for the development of mathematical foundations for
> software testing." The oracle problem she identified in 1982 is a foundational concept in
> software testing theory - it establishes a theoretical limit on what testing can achieve.
> The concept has been applied across software engineering for four decades, but its
> application to human-AI verification systems is new.

### The Classical Oracle Problem

The classical example: you write a program to compute the weather forecast for tomorrow.
How do you test it? You cannot compare against a known-correct answer - if you had the
correct answer, you would not need the program. You can compare against historical data
(did yesterday's forecast match today's weather?), but that is retrospective validation,
not a test oracle. You can compare against another weather model, but if both are wrong in
the same way, agreement proves nothing.

This is the oracle problem: some computations have no independent reference for
correctness. You can check properties (the temperature is within physical bounds, the
probabilities sum to 1.0), but property checks do not tell you whether the forecast is
actually right.

### The Oracle Problem in Human-AI Verification

In human-AI systems, the oracle problem takes a specific and dangerous form. The **human**
is the oracle. When a developer reviews agent-generated code, their judgment is the
reference for correctness. If the developer says the code is correct, it ships. If the
developer says it is wrong, it gets reworked.

But what happens when the human oracle is wrong?

> **FIELD MATURITY: FRONTIER.** The application of Weyuker's oracle problem to human-AI
> verification systems is novel to this project (identified in SD-178). The classical oracle
> problem is established computer science (Weyuker 1982). The specific instantiation - the
> human as a fallible oracle in a verification stack where no layer has authority above the
> human - is an operational insight from daily practice. The field provides the theoretical
> concept. This project provides the application to a new domain.

Consider the layer model from Step 1. The model generates output at L4. The harness
orchestrates verification at L6. Tools provide empirical checks at L7. Multi-agent review
operates at L10. But the human sits at L12 - the top of the stack. When L12 introduces
an error, it propagates through every lower layer:

1. The human specifies a requirement incorrectly.
2. The agent implements the incorrect requirement faithfully.
3. The type checker confirms the types are consistent.
4. The linter confirms the style is clean.
5. The tests (also written against the incorrect requirement) pass.
6. Code review checks the implementation against the requirement - and it matches.
7. The code ships.

Every verification layer functioned correctly. The gate was green. The reviews confirmed
the implementation matched the specification. And the output is wrong - because the
specification was wrong. The verification fabric catches agent error. It is structurally
blind to oracle error.

### Why This Matters More with AI

With traditional development, the oracle problem is mitigated by multiple humans. The
developer writes the code, a reviewer reads it, a QA engineer tests it, a product manager
checks the behavior. Each human is an independent oracle with different context and
different biases. The probability that all oracles are wrong in the same way is low.

With AI-assisted development, the dynamics shift. The agent implements what the human
specifies. If the human specifications are wrong, the agent implements the wrong thing
efficiently and confidently. The agent does not push back on incorrect requirements the
way a human developer might ("Are you sure you want to delete all records older than 30
days? That seems aggressive."). The agent's statistical patterns do not include the
project-specific context that would let it recognise the error.

Worse, automation bias compounds the problem. The Dell'Acqua et al. (2023) study of 758
BCG consultants found that for tasks outside the AI's capability frontier, consultants
using AI performed worse than those without - because they anchored on the AI's output
even when it was wrong. The human oracle becomes less reliable precisely when it matters
most: when the AI output looks plausible but is incorrect.

### Implications for Verification Design

The oracle problem does not have a clean solution. It has mitigations:

1. **Multiple independent oracles.** Different humans review from different perspectives.
   Product, engineering, and security review the same change. The oracle problem does not
   disappear, but the probability of all oracles failing simultaneously drops
   multiplicatively.

2. **Orthogonal verification channels.** Test the output against something other than the
   specification. Property-based testing checks invariants that should hold regardless of
   the specific implementation. Integration tests check behavior against real dependencies.
   These provide verification from a direction the oracle may not have considered.

3. **Specification review before implementation.** Catch oracle errors before they
   propagate. If the specification is wrong, catching it before the agent implements it is
   cheaper than catching it after code, tests, and reviews are complete.

4. **Adversarial review (Step 8).** Explicitly assign a reviewer whose job is to find
   what is wrong, not to confirm what is right. The oracle problem is hardest to detect
   when everyone is confirming the same assumption.

5. **Temporal separation.** Review the same decision at a different time. What seemed
   obviously correct at 11 PM may be obviously wrong at 10 AM. The human oracle's
   reliability is not constant - it varies with fatigue, context, and cognitive load.

> **AGENTIC GROUNDING:** When an agent implements a feature and every automated check
> passes but something feels wrong, pay attention. That feeling is your oracle function
> operating on information the automated checks do not have - project history, user
> behavior patterns, architectural direction. Automated verification catches what it is
> programmed to catch. Oracle intuition catches what cannot be programmed. The verification
> discipline is not "trust the gate." It is "trust the gate for what it can verify, and
> trust yourself for what it cannot." The oracle problem is why you cannot fully delegate
> verification, no matter how good the agent is.

---

## 3. The Quality Gate

*Estimated time: 40 minutes*

The gate is the simplest component in the verification stack and the most important. In
this project, it is three commands:

```bash
pnpm run typecheck && pnpm run lint && pnpm run test
```

If the gate fails, the change is not ready. No exceptions. No "it is just a lint warning."
No "the test is flaky, ignore it." The gate is binary: green or red. This is a standing
policy, not a guideline.

> **FIELD MATURITY: EMERGING.** Quality gates in CI/CD are established practice. The
> specific concepts here - the gate as poka-yoke, the gate as necessary-but-not-sufficient,
> the gate as survival rather than optimisation - draw on Toyota Production System
> principles (poka-yoke, Shingo 1986) applied to software. These applications are well
> understood in the DevOps community.

### The Gate as Poka-Yoke

In the Toyota Production System, a **poka-yoke** is an error-proofing mechanism that
prevents defects from passing to the next stage rather than detecting them after the fact.
A poka-yoke is not an inspection station. It is a physical or procedural constraint that
makes the wrong thing impossible or immediately visible.

> **HISTORY:** Shigeo Shingo, an industrial engineer at Toyota, developed the poka-yoke
> concept in the 1960s. The term translates roughly as "mistake-proofing." Shingo's key
> insight was that inspection finds defects but does not prevent them. A poka-yoke
> prevents the defect from occurring or stops the line the instant it occurs. The canonical
> example: an assembly fixture shaped so the part can only be inserted in the correct
> orientation. The wrong insertion is physically impossible, not merely detectable.

The quality gate is a poka-yoke for your development workflow. It does not inspect the code
after it has been merged. It prevents code that does not pass type checking, linting, and
tests from being considered "ready" in the first place.

The three components serve different purposes:

| Component | What It Catches | What It Misses |
|-----------|----------------|----------------|
| Type checker | Type mismatches, missing properties, incorrect function signatures | Correct types used for the wrong purpose |
| Linter | Style violations, common error patterns, unused variables | Logically correct code that violates no rules |
| Test suite | Behavioral regressions for tested scenarios | Untested scenarios, wrong tests, missing tests |

Each component has holes. The type checker will not catch a function that returns the
correct type with the wrong value. The linter will not catch a race condition. The test
suite will not catch a bug in a path that no test exercises. These holes are expected. The
gate is not designed to catch everything. It is designed to catch categories of defects
cheaply, automatically, and before any human needs to look.

### Necessary but Not Sufficient

The gate is necessary but not sufficient. This distinction is critical.

**Necessary:** If the gate fails, the code is definitely not ready. A type error is a
defect. A failing test is either a regression or a broken test - either way, it needs
investigation. A lint violation is a pattern that has been flagged as problematic. Gate
failure means stop and fix.

**Not sufficient:** If the gate passes, the code is possibly ready. It has cleared the
cheapest, most automated layer of verification. But "compiles, lints, and passes tests"
does not mean "correct, well-designed, and appropriate." Code can pass every automated
check and still be:

- The wrong abstraction for the problem
- A correct implementation of an incorrect specification (the oracle problem)
- Technically correct but unmaintainable
- Secure but not performant, or performant but not secure
- "Not wrong" - technically correct, structurally sound, and tonally flat

The last case deserves its own label. "Not wrong" is an operational state where output
passes every automated check, every factual gate, and still is not right. You cannot point
to a specific error. The metrics say it is fine. But you would not put your name on it.
The gap between "not wrong" and "right" is where taste lives - and the gate cannot measure
taste.

### Building a Gate

For a typical TypeScript project, the gate is three `package.json` scripts:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run"
  }
}
```

The `&&` chaining in the gate command is intentional. If the type checker fails, the linter
does not run. If the linter fails, the tests do not run. This is fail-fast: the cheapest
check runs first, and any failure short-circuits the rest.

```bash
# The gate - run this before considering any change "ready"
pnpm run typecheck && pnpm run lint && pnpm run test
```

For a Python project:

```bash
# Python gate example
mypy src/ && ruff check src/ && pytest
```

For a Go project:

```bash
# Go gate example
go vet ./... && staticcheck ./... && go test ./...
```

The pattern is the same regardless of language: static analysis first (type checking,
linting), dynamic analysis second (tests). Static analysis is cheaper and faster. If it
fails, there is no reason to run the expensive tests.

### The Gate in Agentic Workflows

In agentic workflows, the gate has an additional role: it is the minimum automated
verification that runs after every agent action. When an agent modifies code, the gate
runs. When an agent claims it has fixed a bug, the gate runs. The gate is not a final
check before merge. It is a continuous constraint.

This is why the gate must be fast. If the gate takes 30 minutes, agents will produce 30
minutes of unbounded changes before any verification occurs. A fast gate (under 2 minutes)
means the blast radius of any agent error is bounded to the work done in one cycle.

```bash
# A slow gate is a weak gate
# If your test suite takes 20 minutes, split it:

# Fast gate (runs after every agent action, < 2 minutes)
pnpm run typecheck && pnpm run lint && pnpm run test:unit

# Full gate (runs before merge, all tests including integration)
pnpm run typecheck && pnpm run lint && pnpm run test
```

> **AGENTIC GROUNDING:** The gate is the cheapest check in your verification stack. It
> catches the categories of defects that agents produce most frequently: type errors from
> incorrect function signatures, lint violations from patterns the model learned from
> training data that violate your project's rules, and regressions from changes that break
> existing behavior. An agent that produces code failing the gate has produced a clearly
> broken artifact. An agent that produces code passing the gate has produced an artifact
> that clears the minimum bar - not a verified artifact. The gate tells you "not
> definitely broken." It does not tell you "correct." The gap between those two is the
> rest of this step.

---

## 4. Verifiable vs Taste-Required

*Estimated time: 50 minutes*

This is the load-bearing distinction in agentic engineering. Every output from an agent,
every change in a PR, every decision in a design document falls into one of two categories:

**Verifiable:** Can an automated system confirm this is correct? Does the code compile?
Do the tests pass? Do the types check? Is the lint clean? Is the JSON valid? Does the
API return a 200 for this input? These are binary, deterministic checks with unambiguous
answers. A machine can perform them.

**Taste-required:** Can only a human evaluate this? Is this the right abstraction? Is the
naming clear? Does this prose communicate effectively? Is this the correct architecture for
the next two years of growth? Is this the right trade-off between performance and
readability? These require judgment, context, experience, and values. No machine can
perform them.

> **FIELD MATURITY: FRONTIER.** The distinction between what can be automatically verified
> and what requires human judgment is not new - ISO 25010 quality characteristics and the
> Cynefin framework (Snowden 2007) both address aspects of it. What is novel is applying
> this distinction as the primary governance dial for agentic engineering - the mechanism
> that determines when to let agents run autonomously and when to require human review at
> every step.

### Why This Distinction is Load-Bearing

The distinction determines your entire governance model. It answers the question every
engineering team asks when adopting AI agents: "How much should we trust the agent? When
do we let it run? When do we require review?"

The answer is not a trust level. It is a property of the output:

- **HOTL (Human Out The Loop)** when the output is verifiable. If the gate can confirm
  correctness, let the agent run at machine speed. The agent writes code, the gate checks
  it, the agent iterates until the gate is green. The human reviews after execution, not
  during. This is where agents provide velocity.

- **HODL (Human On The Loop)** when the output is taste-required. If only a human can
  evaluate quality, the human must be involved. The human reviews architecture decisions,
  naming conventions, abstraction choices, and prose quality. The agent proposes, the human
  evaluates.

This is THE governance dial. Turn it wrong in either direction and you fail:

- **Too much HOTL:** The agent runs autonomously on taste-required decisions. It chooses
  the wrong abstraction, names things poorly, makes architectural choices that create
  technical debt. The gate is green but the codebase degrades. This is the "not wrong"
  failure mode at scale.

- **Too much HODL:** The human reviews every agent output, including trivially verifiable
  changes. The human becomes a bottleneck. The agent's velocity advantage disappears. The
  human develops review fatigue, starts rubber-stamping, and the HODL becomes performative
  rather than substantive.

The correct position depends on what the agent is producing at this moment:

| Output Type | Category | Governance | Why |
|------------|----------|------------|-----|
| Fix a type error | Verifiable | HOTL | Type checker confirms |
| Add a field to a database schema | Taste-required | HODL | Naming, type choice, migration strategy |
| Format code to match linter rules | Verifiable | HOTL | Linter confirms |
| Write a new API endpoint | Both | HODL for design, HOTL for implementation | Design is taste, implementation is verifiable |
| Refactor a function for readability | Taste-required | HODL | "Readability" is taste |
| Fix a failing test | Verifiable | HOTL (with review) | Test passes, but did it change the test or the code? |
| Write documentation | Taste-required | HODL | Clarity, audience, completeness are taste |
| Update a dependency version | Verifiable | HOTL | Tests pass with new version |

### The Blurry Boundary

The boundary between verifiable and taste-required is not always clean. Some outputs are
partially verifiable:

- **A new function:** The type signature is verifiable (does it type-check?). The
  implementation correctness is verifiable if tests exist. The choice to create this
  function rather than extending an existing one is taste-required.

- **An error message:** The string compiles and can be checked for format compliance. Whether
  the message helps the user understand and recover from the error is taste-required.

- **A test:** Whether the test passes is verifiable. Whether the test actually tests the
  right thing is taste-required. This is one of the most dangerous blurry boundaries: a
  green test suite feels like verification but may be testing the shape of correctness
  rather than correctness itself.

When the boundary is blurry, default to HODL. The cost of unnecessary human review is
time. The cost of insufficient human review is defects that pass every automated check
and ship to production.

### The Bainbridge Caution

There is a trap in the HOTL/HODL framework. Extended HOTL - letting agents run
autonomously for long periods while humans only review results - degrades the human's
capacity to evaluate when HODL is needed.

This is Bainbridge's irony of automation (1983): automation removes the practice
that keeps the operator's skills sharp. When you stop reviewing agent-generated code in
detail because "the gate catches everything," your ability to recognise taste-required
problems atrophies. Then when you do review, you miss things you would have caught six
months earlier.

The control is periodic deep engagement. Even when the agent is in HOTL mode on verifiable
tasks, periodically switch to HODL and review in detail. Not because the gate is
insufficient for verifiable tasks - it is sufficient. Because your ability to exercise the
governance dial depends on keeping your evaluation skills current.

"Extended HOTL without periodic deep engagement degrades the expertise that makes HOTL
safe."

> **AGENTIC GROUNDING:** When setting up an agentic workflow, the first question is not
> "how do I make the agent better?" It is "which outputs from this workflow are verifiable
> and which are taste-required?" Map every output to a category. For each verifiable output,
> define the automated check that confirms it (type checker, test, schema validation). For
> each taste-required output, define who reviews it and what they evaluate. If you cannot
> define the automated check, the output is taste-required - treat it accordingly. This
> mapping is the governance specification for the workflow. Without it, you are running
> agents without guardrails and calling it "trust."

---

## 5. The Verification Pipeline

*Estimated time: 45 minutes*

A single verification layer is not enough. The gate catches type errors, lint violations,
and test failures. It does not catch incorrect specifications, wrong abstractions, subtle
logic errors, or the oracle problem. A human reviewer catches design issues but may miss
the same categories of error the gate catches if fatigue sets in. Every verification layer
has holes.

The solution is not to find a verification layer without holes. It is to arrange multiple
layers so that no single hole passes through all of them.

### The Swiss Cheese Model

In 1990, James Reason published *Human Error*, which introduced what is now called the
**Swiss Cheese Model** of accident causation. Reason was studying failures in
safety-critical systems: nuclear power plants, aviation, chemical processing. His model
has since been applied to healthcare, firefighting, computer security (defence in depth),
and process safety.

> **HISTORY:** James Reason developed the Swiss Cheese Model from studying catastrophic
> failures in complex systems - aviation disasters, nuclear incidents, industrial accidents.
> The model was formally published in the *Philosophical Transactions of the Royal Society*
> in 1990. By 2016, the paper had attracted over 1,800 citations, with the citation rate
> increasing over time. Reason's central insight was that catastrophic failures are rarely
> caused by a single error. They result from the alignment of multiple small failures
> across multiple defence layers - a "trajectory of accident opportunity" through aligned
> holes. The model has been criticised for being applied too broadly (Eurocontrol 2006),
> but its core principle - layered defence where each layer has known holes - remains the
> foundation of safety engineering.

The model is simple: imagine multiple slices of Swiss cheese stacked together. Each slice
is a defence layer. Each slice has holes - weaknesses, gaps, failure modes. In normal
operation, the holes in one slice are blocked by the solid parts of adjacent slices. A
failure passes through all slices only when the holes align - when every layer fails
simultaneously for the same defect.

Applied to software verification:

```
  Defect introduced
        |
        v
  +-----------+
  | Type       |  <-- Catches type mismatches, missing properties
  | Checker    |  Holes: correct types, wrong values
  +-----------+
        |
        v
  +-----------+
  | Linter     |  <-- Catches patterns, unused code, style
  |            |  Holes: logically valid code that follows all rules
  +-----------+
        |
        v
  +-----------+
  | Unit       |  <-- Catches regressions in tested paths
  | Tests      |  Holes: untested paths, wrong tests
  +-----------+
        |
        v
  +-----------+
  | Integration|  <-- Catches interface mismatches, system behavior
  | Tests      |  Holes: environment-specific issues, timing
  +-----------+
        |
        v
  +-----------+
  | Code       |  <-- Catches design issues, naming, patterns
  | Review     |  Holes: reviewer fatigue, shared blind spots
  +-----------+
        |
        v
  +-----------+
  | Adversarial|  <-- Explicitly looks for what others missed
  | Review     |  Holes: same model bias (if same model family)
  +-----------+
        |
        v
  +-----------+
  | Human      |  <-- Taste, intent, architectural fit
  | Judgment   |  Holes: the oracle problem, cognitive deskilling
  +-----------+
        |
        v
  Production (if no layer caught it)
```

### The Probability Argument

If each layer independently catches a defect with some probability, the probability of
the defect surviving all layers is the product of the survival probabilities:

```
P(defect reaches production) = P(survives layer 1)
                              * P(survives layer 2)
                              * P(survives layer 3)
                              * ...
                              * P(survives layer N)
```

If each layer independently catches 80% of relevant defects (survives with 20%
probability), then:

- 1 layer: 20% of defects reach production
- 2 layers: 4%
- 3 layers: 0.8%
- 4 layers: 0.16%
- 5 layers: 0.032%

"The probability of error is not eliminated. It is distributed across verification gates
until it is negligible."

The word "independently" is critical. If two layers share the same blind spot - they both
miss the same category of defect - their holes are aligned, and adding the second layer
provides no additional protection for that category. This is why multi-model review
(Step 8) uses different models: same-model review provides precision (consistent findings)
but not independence.

### Active Failures vs Latent Failures

Reason distinguished two types of failure:

**Active failures** are direct errors: the agent writes a bug, the developer makes a typo,
the test has the wrong assertion. These are visible and immediate.

**Latent failures** are contributory factors that sit dormant until they combine with an
active failure: the test suite has a coverage gap in error handling, the linter does not
check for this pattern, the code review checklist does not include security considerations.
Latent failures are not defects in themselves. They are holes in the cheese that create the
conditions for active failures to pass through.

In agentic systems, common latent failures include:

| Latent Failure | What It Creates | How to Address |
|----------------|-----------------|----------------|
| No test for error paths | Hole in unit test layer | Require error path coverage |
| Single reviewer for all PRs | Hole in review layer (fatigue) | Rotate reviewers, add adversarial review |
| Same model for code and review | Correlated blind spots (L10) | Multi-model review (Step 8) |
| No specification review | Oracle errors pass through all layers | Spec review before implementation |
| Gate runs only on merge | 30-minute windows of unverified changes | Gate runs after every agent action |
| Review checklist focused on code | Design and architecture issues missed | Explicit architecture review |

### Designing Your Pipeline

A verification pipeline is not one-size-fits-all. The layers depend on your risk tolerance,
team size, and what you are building. But the principle is constant: more independent layers
with different detection capabilities means lower probability of defects reaching
production.

A minimal pipeline for agentic development:

1. **Gate** (automated, every change) - type checker + linter + tests
2. **Self-review** (agent, every change) - the agent reviews its own diff before submitting
3. **Human review** (human, every PR) - design, naming, architecture, intent
4. **Integration test** (automated, every PR) - tests against real dependencies

A robust pipeline:

1. **Gate** (automated, every change) - type checker + linter + unit tests
2. **Agent self-review** (agent, every change) - diff review, spec compliance check
3. **Integration tests** (automated, every PR) - end-to-end behavior
4. **Peer review** (human, every PR) - code quality, design, naming
5. **Adversarial review** (different model or designated reviewer, high-risk PRs)
6. **Architecture review** (senior engineer, structural changes)
7. **Security review** (security engineer or automated scanner, auth/data PRs)

The layers are not sequential bureaucracy. Each layer catches a category of defect that
other layers miss. Removing a layer does not save time - it moves defects downstream where
they are more expensive to fix.

> **AGENTIC GROUNDING:** When configuring an agentic workflow, design your verification
> pipeline explicitly. For each layer, answer: (1) what categories of defect does this
> layer catch? (2) what are its known holes? (3) is it independent of the other layers or
> does it share blind spots? If two layers use the same model (e.g., the code-writing agent
> and the review agent are both Claude), they share L0 biases. The layers provide precision
> (consistent findings) but not independence. Layer independence comes from different
> verification mechanisms: automated checks, human review, different model families,
> different reviewers, and orthogonal verification channels.

---

## 6. Definition of Done

*Estimated time: 25 minutes*

In traditional development, "done" often means "developer thinks it is done." In
Scrum-influenced teams, "done" might mean "code complete, tests written, PR approved." In
many organisations, the definition is implicit, unwritten, and varies by person.

In agentic engineering, an implicit definition of done is dangerous. The agent will produce
output at machine speed. If "done" is undefined, the agent will consider its work complete
as soon as it has generated the output - before any verification has occurred.

### What "Done" Actually Means

In this project, the definition of done has explicit criteria:

1. **Gate green.** Type checker passes. Linter clean. All tests pass. This is the minimum
   bar. If the gate is red, the work is not done regardless of what the agent claims.

2. **Review complete.** At least one human reviewer has examined the change and approved it.
   For high-risk changes, adversarial review is complete and synthesis findings are
   addressed.

3. **Specification checked.** The implementation matches the specification. If the
   specification has changed, the change is documented.

4. **No known defects deferred.** If the review found issues, they are fixed - not tracked
   as TODO comments. A TODO in code is a hole in the cheese that waits to align.

Each criterion adds independent signal. Gate green tells you the automated checks pass.
Review complete tells you a human has exercised judgment. Specification checked tells you
the right thing was built. No deferred defects tells you the verification was completed,
not punted.

### Definition of Done for Agent-Generated Work

When agents generate code, there are additional criteria:

| Criterion | What It Verifies | Why It Matters |
|-----------|-----------------|----------------|
| Agent diff reviewed | Human has read the actual diff, not the agent's description | Agents describe their changes optimistically |
| Tests verify behavior, not shape | Tests assert on the right thing (covered in Section 7) | Agents generate tests that validate their own output |
| No new TODOs without tickets | Deferred work is tracked, not hidden in comments | Agents scatter TODO comments as resolution markers |
| Commit is atomic | One concern per commit | Agents tend toward large "stowaway" commits with multiple concerns |
| Dependencies audited | New dependencies are intentional, not hallucinated | Agents sometimes import packages that do not exist |

### "Verified, Deployed, Working"

The ultimate definition of done is not "merged." It is "verified, deployed, and working in
production." The merge is a waypoint, not the destination.

For agent-generated code, this means:

1. Gate green (automated verification)
2. Reviewed and approved (human verification)
3. Deployed to staging (environment verification)
4. Smoke tests pass in staging (integration verification)
5. Deployed to production (release)
6. Monitoring confirms expected behavior (operational verification)

Each step catches categories of error that previous steps miss. Code that passes all
tests in CI may fail in staging due to environment differences. Code that works in
staging may fail in production due to data volume, traffic patterns, or configuration
differences.

> **AGENTIC GROUNDING:** When an agent says "done," it means "I have generated output."
> When the gate is green, it means "the automated checks pass." When the reviewer approves,
> it means "a human has exercised judgment." None of these individually mean "done." The
> definition of done is all of them, in sequence, with each layer's findings resolved
> before proceeding. If you accept the agent's "done" as your "done," you are trusting a
> single layer in a system designed to require multiple layers.

---

## 7. Test Anti-Patterns in Agent-Generated Code

*Estimated time: 70 minutes*

Agent-generated tests have a specific failure mode: they tend to validate the shape of
the code rather than its correctness. The model has seen millions of test files in its
training data. It knows what tests look like. It produces output that has the structure of
a well-written test - imports, setup, assertions, teardown - while failing to actually
verify the thing it claims to verify.

> **FIELD MATURITY: FRONTIER.** No published taxonomy of test anti-patterns specific to
> agent-generated code was found in the literature. Individual patterns are discussed in
> practitioner blog posts and talks, but no systematic, field-observed taxonomy exists. The
> five patterns described here were identified during daily practice in this project. They
> are operational observations, not research findings. The naming convention follows the
> project's anti-pattern taxonomy (the slopodar).

The following five anti-patterns were caught in the wild. Each includes a concrete code
example, the detection heuristic, and the fix.

### 7.1 Right Answer, Wrong Work

**Definition:** The assertion passes, but via the wrong causal path. The test asserts
`output == expected`. The output matches. But the function computed the right answer for
the wrong reason.

**Example:**

```typescript
// The function under test
function calculateDiscount(price: number, customerTier: string): number {
  // BUG: agent hardcoded the discount instead of computing it
  // This returns 20 for any input, which happens to be correct
  // for the test case (price=100, tier="gold", expected=20)
  return 20;
}

// The agent-generated test
describe("calculateDiscount", () => {
  it("should apply gold tier discount", () => {
    const result = calculateDiscount(100, "gold");
    expect(result).toBe(20);  // PASSES - but the function is wrong
  });
});
```

The test is green. The function is broken. It returns 20 for every input. The test only
checks one input, and for that input, 20 happens to be correct.

**A more subtle variant:**

```typescript
// The function under test
function validateEmail(email: string): boolean {
  // BUG: agent checks for "@" but not for a domain
  // "user@" passes validation, which is wrong
  return email.includes("@");
}

// The agent-generated test
describe("validateEmail", () => {
  it("should accept valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);   // PASSES
  });

  it("should reject invalid email", () => {
    expect(validateEmail("not-an-email")).toBe(false);       // PASSES
  });

  // Missing: what about "user@"? "@domain.com"? "user@.com"?
});
```

Both tests pass. The validation is wrong. The tests check two cases that happen to produce
the correct result with the incorrect implementation. The boundary cases where the
implementation diverges from correct behavior are untested.

**Detection heuristic:** Can you change the implementation to break the intended behavior
while keeping the test green? If yes, the test is verifying the answer, not the work.

**Fix:** Assert on the causal path, not just the output. For `calculateDiscount`, assert
that different inputs produce different outputs: `calculateDiscount(100, "silver")` should
NOT equal 20. For `validateEmail`, explicitly test the boundary cases where incorrect
implementations diverge: `"user@"` should be false, `"@domain.com"` should be false.

```typescript
// Fixed: tests that verify the causal path
describe("calculateDiscount", () => {
  it("should apply gold tier discount (20%)", () => {
    expect(calculateDiscount(100, "gold")).toBe(20);
  });

  it("should apply silver tier discount (10%)", () => {
    expect(calculateDiscount(100, "silver")).toBe(10);
  });

  it("should scale with price", () => {
    expect(calculateDiscount(200, "gold")).toBe(40);
  });

  it("should return 0 for unknown tier", () => {
    expect(calculateDiscount(100, "unknown")).toBe(0);
  });
});
```

Now a hardcoded `return 20` fails three out of four tests.

### 7.2 Phantom Tollbooth

**Definition:** The assertion is so loose that it cannot distinguish intended behavior from
unrelated results. The test passes for any truthy value, any status code in a wide range,
or any object with the vaguely expected shape.

**Example:**

```typescript
// The function under test
async function createUser(data: UserInput): Promise<ApiResponse> {
  const response = await api.post("/users", data);
  return response;
}

// The agent-generated test
describe("createUser", () => {
  it("should create a user successfully", async () => {
    const result = await createUser({ name: "Alice", email: "a@b.com" });

    // ANTI-PATTERN: truthy assertion
    expect(result).toBeTruthy();
  });

  it("should return a valid status", async () => {
    const result = await createUser({ name: "Bob", email: "b@c.com" });

    // ANTI-PATTERN: range assertion - passes for 200, 201, 204, 301, 400...
    expect([200, 201, 202, 204]).toContain(result.status);
  });
});
```

The first test passes if `result` is any truthy value - including an error object, a
partial response, or a string like "server error." The second test accepts four different
status codes, obscuring which one is actually expected. If the API returns a 204 (no
content) when it should return a 201 (created), the test still passes.

**Detection heuristic:** Assertions accepting ranges, using `toBeTruthy()`/`toBeDefined()`,
or checking a single property of a complex object. Ask: would removing the feature under
test still leave this assertion passing?

**Fix:** Pin assertions to exact expected values. Be specific about what correct looks
like.

```typescript
// Fixed: specific assertions
describe("createUser", () => {
  it("should create a user and return 201", async () => {
    const result = await createUser({ name: "Alice", email: "a@b.com" });

    expect(result.status).toBe(201);
    expect(result.body.name).toBe("Alice");
    expect(result.body.email).toBe("a@b.com");
    expect(result.body.id).toMatch(/^usr_[a-zA-Z0-9]+$/);
  });
});
```

Now the test fails if the status code is wrong, the name is missing, the email is
different, or the ID format is unexpected.

### 7.3 Mock Castle

**Definition:** The mock scaffolding exceeds the assertion count. The test constructs an
elaborate mock universe, then asserts one or two properties. The mocks are doing the work,
not the code under test.

**Example:**

```typescript
// The function under test (4 lines of actual logic)
async function processPayment(orderId: string): Promise<PaymentResult> {
  const order = await orderService.getOrder(orderId);
  const charge = await stripeService.charge(order.total, order.currency);
  await orderService.updateStatus(orderId, "paid");
  return { success: true, chargeId: charge.id };
}

// The agent-generated test (45 lines of mocks, 3 lines of assertion)
describe("processPayment", () => {
  let mockOrderService: jest.Mocked<OrderService>;
  let mockStripeService: jest.Mocked<StripeService>;

  beforeEach(() => {
    mockOrderService = {
      getOrder: vi.fn().mockResolvedValue({
        id: "ord_123",
        total: 5000,
        currency: "usd",
        items: [
          { id: "item_1", name: "Widget", qty: 2, price: 2500 },
        ],
        customer: {
          id: "cust_456",
          email: "test@example.com",
          name: "Test User",
          address: {
            line1: "123 Test St",
            city: "Testville",
            state: "TS",
            zip: "12345",
          },
        },
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      listOrders: vi.fn(),
      deleteOrder: vi.fn(),
      getOrderHistory: vi.fn(),
    } as unknown as jest.Mocked<OrderService>;

    mockStripeService = {
      charge: vi.fn().mockResolvedValue({
        id: "ch_789",
        status: "succeeded",
        amount: 5000,
        currency: "usd",
        receipt_url: "https://stripe.com/receipt/123",
      }),
      refund: vi.fn(),
      getBalance: vi.fn(),
      listCharges: vi.fn(),
    } as unknown as jest.Mocked<StripeService>;
  });

  it("should process payment successfully", async () => {
    const result = await processPayment("ord_123");

    expect(result.success).toBe(true);       // 1 assertion
    expect(result.chargeId).toBe("ch_789");  // 2 assertions
  });
});
```

The test has 45+ lines of mock setup and 2 lines of assertions. The mocks define an
elaborate universe: customer addresses, order history methods, receipt URLs - none of which
are used by the function under test. The test passes because the mocks return the right
shape, not because the code processes payments correctly.

**Detection heuristic:** Count mock declarations versus assertions. If mocks exceed
assertions by more than 3:1, the test is a mock castle. Also check: are the mock methods
that are set up actually called by the code under test?

**Fix:** Mock only what the function touches. Extract pure functions and test them without
mocking.

```typescript
// Fixed: minimal mocks, focused assertions
describe("processPayment", () => {
  it("should charge the order total and update status", async () => {
    const getOrder = vi.fn().mockResolvedValue({
      total: 5000,
      currency: "usd",
    });
    const charge = vi.fn().mockResolvedValue({ id: "ch_789" });
    const updateStatus = vi.fn().mockResolvedValue(undefined);

    const result = await processPayment("ord_123");

    // Verify the causal chain
    expect(getOrder).toHaveBeenCalledWith("ord_123");
    expect(charge).toHaveBeenCalledWith(5000, "usd");
    expect(updateStatus).toHaveBeenCalledWith("ord_123", "paid");
    expect(result).toEqual({ success: true, chargeId: "ch_789" });
  });
});
```

Four assertions that verify the function did the right things in the right order. No
mock properties that the function never reads.

### 7.4 Shadow Validation

**Definition:** Validation is applied rigorously to simple cases and skipped for the
critical path. The test suite covers happy paths thoroughly while leaving error handling,
boundary conditions, and edge cases untested.

**Example:**

```typescript
// The code under test - a data import function
async function importRecords(file: File): Promise<ImportResult> {
  const data = await parseCSV(file);

  // Simple validation for each record
  for (const record of data) {
    if (!record.email) throw new ValidationError("Missing email");
    if (!record.name) throw new ValidationError("Missing name");
  }

  // Critical path: deduplication, merge with existing records
  // This is where the complex logic lives
  const merged = await mergeWithExisting(data);
  const deduped = deduplicateByEmail(merged);

  return { imported: deduped.length, skipped: data.length - deduped.length };
}

// The agent-generated tests
describe("importRecords", () => {
  it("should reject records without email", async () => {
    const file = createCSVFile([{ name: "Alice" }]);  // no email
    await expect(importRecords(file)).rejects.toThrow("Missing email");
  });

  it("should reject records without name", async () => {
    const file = createCSVFile([{ email: "a@b.com" }]);  // no name
    await expect(importRecords(file)).rejects.toThrow("Missing name");
  });

  it("should import valid records", async () => {
    const file = createCSVFile([
      { name: "Alice", email: "a@b.com" },
      { name: "Bob", email: "b@c.com" },
    ]);
    const result = await importRecords(file);
    expect(result.imported).toBe(2);
  });

  // MISSING: What about duplicates? What about merge conflicts?
  // MISSING: What about records that exist in the database?
  // MISSING: What about partial failures mid-import?
  // MISSING: What about CSV parsing errors?
  // MISSING: What about 100,000 records?
  // The simple validation has 2 tests. The critical path has 0.
});
```

The test suite validates the simple guard clauses (missing email, missing name) thoroughly.
The critical path - deduplication, merging with existing records, handling partial failures
- has zero tests. This is shadow validation: the validation shadow falls on the easy cases
and misses the hard ones.

**Detection heuristic:** After looking at the validation or error handling tests, ask:
does the most complex function in the module have the most tests? If the simplest
validation has more test cases than the core business logic, shadow validation is
operating.

**Fix:** Start testing with the most complex and highest-risk code path first. Add
validation tests second.

```typescript
// Fixed: critical path tested first
describe("importRecords", () => {
  // Critical path tests FIRST
  it("should deduplicate records by email", async () => {
    const file = createCSVFile([
      { name: "Alice", email: "a@b.com" },
      { name: "Alice Smith", email: "a@b.com" },  // duplicate email
    ]);
    const result = await importRecords(file);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("should merge with existing database records", async () => {
    await insertExistingRecord({ name: "Alice", email: "a@b.com" });
    const file = createCSVFile([
      { name: "Alice Updated", email: "a@b.com" },
    ]);
    const result = await importRecords(file);
    // Verify merge behavior, not just count
    const record = await getRecordByEmail("a@b.com");
    expect(record.name).toBe("Alice Updated");
  });

  it("should handle partial failures without losing successful imports", async () => {
    // ... test that a failure on record 50 does not roll back records 1-49
  });

  // Simple validation tests SECOND
  it("should reject records without email", async () => {
    // ...
  });
});
```

### 7.5 Confessional Test

**Definition:** The test acknowledges in comments that it cannot verify what its name
claims. The test name says "testOutputFormat" but the body contains a comment like
`// TODO: actually verify the output format` or `// verified by inspection`.

**Example:**

```typescript
describe("generateReport", () => {
  it("should produce correctly formatted PDF output", async () => {
    const report = await generateReport(sampleData);

    // We can verify it produced something
    expect(report).toBeDefined();
    expect(report.length).toBeGreaterThan(0);

    // TODO: actually verify PDF structure
    // The PDF parsing library is not in our dependencies
    // Verified by manual inspection - output looks correct

    // At least check it starts with the PDF magic bytes
    expect(report.slice(0, 4)).toEqual(Buffer.from("%PDF"));
  });

  it("should include all required sections", async () => {
    const report = await generateReport(sampleData);

    // NOTE: we cannot programmatically verify section presence
    // without a PDF parser. This test only checks that the
    // report is non-empty and starts with valid PDF header.
    // The actual section verification was done manually during
    // development and should be re-verified if the template changes.

    expect(report).toBeDefined();
    expect(report.length).toBeGreaterThan(1000);
  });
});
```

The first test is named "should produce correctly formatted PDF output" but admits in a
comment that it cannot actually verify PDF structure. The second test is named "should
include all required sections" but its body explicitly states it cannot verify sections.
Both tests are named for what they wish they tested, not what they actually test.

The test is confessing its inadequacy while pretending to provide verification. The test
suite shows "2 passing" and a reviewer might see the test names and assume PDF output and
section presence are verified. They are not.

**Detection heuristic:** Comments in test bodies that are longer than the assertions.
Comments containing "TODO," "verified by inspection," "cannot verify," "should be
re-verified," or "manual check." Test names that claim more than the assertions verify.

**Fix:** Either add the capability to actually test the claim (add the PDF parser
dependency), or rename the test to match what it actually verifies, or delete the test
and document the gap.

```typescript
// Option 1: Actually test the claim
import { PDFDocument } from "pdf-lib";

describe("generateReport", () => {
  it("should produce a valid PDF with required sections", async () => {
    const reportBytes = await generateReport(sampleData);
    const pdf = await PDFDocument.load(reportBytes);

    expect(pdf.getPageCount()).toBeGreaterThan(0);

    const text = await extractText(pdf);
    expect(text).toContain("Executive Summary");
    expect(text).toContain("Detailed Findings");
    expect(text).toContain("Recommendations");
  });
});

// Option 2: Be honest about what is tested
describe("generateReport", () => {
  it("should produce non-empty output with PDF header", async () => {
    const report = await generateReport(sampleData);
    expect(report.slice(0, 4)).toEqual(Buffer.from("%PDF"));
    expect(report.length).toBeGreaterThan(1000);
  });

  // PDF section presence is not programmatically verified.
  // See docs/testing-gaps.md for manual verification checklist.
});
```

### Summary: The Five Anti-Patterns

| Anti-Pattern | Mechanism | Detection | Risk |
|-------------|-----------|-----------|------|
| Right Answer, Wrong Work | Assertion matches coincidentally | Change implementation, test still passes | False confidence in correctness |
| Phantom Tollbooth | Assertion too loose to discriminate | `toBeTruthy()`, range checks, single-property assertions | Defects pass through as valid |
| Mock Castle | Mocks exceed assertions 3:1+ | Count mocks vs assertions, check for unused mock methods | Tests verify mocks, not code |
| Shadow Validation | Easy paths tested, critical path skipped | Compare test count vs code complexity | Highest-risk code is untested |
| Confessional Test | Test comments confess inadequacy | Comments > assertions, "TODO", "by inspection" | False sense of coverage |

All five patterns share a common trait: the test suite reports green, the coverage metrics
may even look acceptable, and the code has not been meaningfully verified. The patterns
are particularly dangerous with agent-generated tests because the agent excels at producing
test files that have the correct structure - imports, describe blocks, it blocks,
assertions - while missing the substance.

> **AGENTIC GROUNDING:** When an agent generates tests alongside code, review the tests
> with more suspicion than the code. The code might be wrong. The tests might be wrong in
> a way that makes the wrong code look right. For each test, apply the detection heuristics
> above: Can you break the intended behavior without breaking the test? Is the assertion
> specific enough to discriminate correct from incorrect? Are the mocks smaller than the
> code under test? Is the most complex code path the most tested? Does the test name match
> what the assertions actually verify? Five "no" answers in a row means the test suite is
> a comfort blanket, not a verification layer.

---

## 8. Evaluation Methods and Their Limits

*Estimated time: 40 minutes*

How do you measure whether an AI agent is good at writing code? The field has developed
several benchmarks, each measuring specific aspects of agent capability. Understanding
what they measure - and what they do not - is essential for interpreting capability claims.

### SWE-bench

SWE-bench (Jimenez et al. 2024, ICLR) is the standard benchmark for coding agent
capability. It consists of 2,294 real GitHub issues from popular Python repositories.
Each issue has a known solution (the merged PR) and a test suite that the solution must
pass.

The benchmark measures **% Resolved** - the percentage of issues an agent can solve. As
of early 2026, top agents resolve 60%+ on SWE-bench Verified (a human-filtered subset
of 500 tasks).

Variants include:

| Variant | Tasks | Purpose |
|---------|-------|---------|
| SWE-bench Full | 2,294 | Original benchmark |
| SWE-bench Verified | 500 | Human-filtered for quality |
| SWE-bench Lite | 300 | Lower compute cost |
| SWE-bench Multilingual | 300 | 9 programming languages |
| SWE-bench Multimodal | 517 | Visual and text tasks |

**What SWE-bench measures:** Can the agent read an issue description, navigate a codebase,
make the correct change, and produce output that passes the existing test suite? This is
a real and useful signal. An agent that scores well on SWE-bench can solve real GitHub
issues in real repositories.

**What SWE-bench does not measure:**

- **Production reliability.** SWE-bench tasks have test suites with clear oracles. The
  agent's code either passes or it does not. Production code often lacks clear test
  oracles - the "correct" behavior is ambiguous, context-dependent, or underspecified.

- **Code quality beyond correctness.** The benchmark checks whether the fix resolves the
  issue. It does not check whether the fix is maintainable, well-named, properly
  documented, or consistent with the project's architectural patterns.

- **Multi-concern changes.** SWE-bench tasks are single issues in isolation. Production
  development often involves changes that span multiple concerns, multiple files, and
  multiple systems.

- **Collaboration.** SWE-bench tasks are solved by a single agent. Production development
  involves coordination with other developers, product managers, and existing code review
  processes.

The gap between benchmark performance and production readiness is precisely the gap that
verification discipline addresses. A resolved SWE-bench task does not mean the code
would survive the verification pipeline described in Section 5.

### WebArena

WebArena (Zhou et al. 2023, Carnegie Mellon) extends benchmarking to web-based tasks. It
provides a self-hosted web environment with four categories: social forum, online shopping,
content management, and collaborative software development.

**What WebArena measures:** Can the agent interpret high-level natural language commands
and execute multi-step web interactions? This tests planning, navigation, and task
decomposition in realistic environments.

**What WebArena does not measure:** Real-world web interactions involve CAPTCHAs, rate
limits, layout changes, authentication flows, and adversarial content that the controlled
benchmark environment does not capture. A high WebArena score means the agent can navigate
known web applications, not that it can handle the unpredictability of production web
environments.

### The METR RCT

The most striking empirical result in this space comes from METR (Becker et al. 2025,
arXiv:2507.09089). The study is a randomised controlled trial (RCT) - the gold standard
of experimental design - with 16 experienced open-source developers completing 246 tasks
in projects where they averaged 5 years of prior experience.

Tasks were randomly assigned to allow or disallow AI tools (primarily Cursor Pro with
Claude 3.5/3.7 Sonnet). The results:

| Measure | Value |
|---------|-------|
| Developer forecast (before tasks) | AI reduces time by 24% |
| Developer forecast (after study) | AI reduced time by 20% |
| Expert prediction (economists) | AI reduces time by 39% |
| Expert prediction (ML researchers) | AI reduces time by 38% |
| **Actual result** | **AI increased time by 19%** |

The developers predicted they were faster with AI. The economists predicted they were
faster. The ML researchers predicted they were faster. The actual measurement showed they
were slower. The perception-reality gap is approximately 40 points: perceived 20% faster,
actual 19% slower.

> **HISTORY:** The METR study is notable not just for its finding but for its methodology.
> Randomised controlled trials are rare in software engineering research because they are
> expensive and difficult to control. Most AI productivity studies rely on self-reported
> data, before/after comparisons without controls, or synthetic tasks. METR used random
> assignment, real tasks, experienced developers on familiar codebases, and objective
> completion time measurement. The study evaluated 20 properties that could contribute
> to the slowdown effect and concluded that "the robustness of the slowdown effect across
> our analyses suggests it is unlikely to primarily be a function of our experimental
> design."

### Why the 19% Slowdown?

The METR paper evaluates multiple contributing factors. The most relevant to this step:

- **Context switching overhead.** Formulating prompts, reviewing AI output, and integrating
  suggestions takes time that offsets the speed of AI generation.

- **Incorrect suggestions.** The time spent reviewing and rejecting incorrect AI output
  exceeds the time saved by correct suggestions, particularly for experienced developers
  who know their codebase well.

- **Verification cost.** Developers must verify AI output in codebases they understand
  deeply. The verification overhead exceeds the generation speedup.

The study has limitations: only 16 developers (small sample), tasks in mature open-source
projects (specific setting), and AI tools from early 2025 (Cursor Pro, Claude 3.5/3.7
Sonnet). Tool capabilities have improved. But the core finding - that experienced
developers on familiar codebases are slower with AI tools, not faster - challenges the
default narrative about AI productivity.

For verification, the key insight is this: if developers are slower with AI while
believing they are faster, the perception-reality gap suggests that verification discipline
is not just about catching defects. It is about calibrating your beliefs about what the AI
is actually contributing. Without objective measurement, you will overestimate the benefit
and underestimate the cost.

### What Benchmarks Can and Cannot Tell You

| Benchmarks Measure | Benchmarks Do Not Measure |
|-------------------|--------------------------|
| Task completion under controlled conditions | Production reliability |
| Agent capability ceiling | Average production performance |
| Isolated problem-solving | Multi-concern changes |
| Code that passes specific tests | Code quality, maintainability, naming |
| Speed of generation | Speed including verification |
| Whether the task was solved | Whether the solution should be shipped |

The gap between the left column and the right column is the domain of this step. The
verification pipeline, the verifiable/taste-required distinction, the test anti-patterns,
the definition of done - all operate in the space that benchmarks do not cover.

> **AGENTIC GROUNDING:** When evaluating AI coding tools for your team, do not rely on
> benchmark scores alone. SWE-bench tells you the tool can solve isolated issues. It does
> not tell you whether the tool will make your team faster, produce maintainable code, or
> reduce your defect rate. Design your own evaluation: pick real tasks from your backlog,
> measure completion time with and without the tool, and - critically - measure the time
> spent on verification and rework. The METR study found a 40-point gap between perceived
> and actual productivity (arXiv:2507.09089). Your team may have its own gap.

---

## 9. The Context Quality Loop Revisited

*Estimated time: 25 minutes*

Step 4 introduced the context quality loop: clean code produces better context for future
agent runs, which produces cleaner code. This is the virtuous direction. The inverse is
also true, and verification is the mechanism that determines which direction you go.

### The Compounding Effect

GitClear's analysis of 153 million changed lines of code (2024) found that code churn -
lines reverted or updated within two weeks of authoring - was projected to double in 2024
versus its 2021 pre-AI baseline. AI-assisted code was being written faster and rewritten
sooner.

This is the context quality loop operating in the wrong direction:

1. Agent generates code with subtle defects (passes gate, has anti-patterns from Section 7)
2. Defective code enters the codebase
3. Next agent run reads defective code as context
4. Agent treats defective patterns as valid (it is in the codebase, it must be correct)
5. Agent generates more code with the same patterns
6. Churn increases as humans catch and fix what automation missed

The verification pipeline (Section 5) is the intervention point. Each layer in the
pipeline that catches a defect before it enters the codebase breaks the compounding cycle.
Each defect that slips through compounds.

### Verification as Context Engineering

This is the connection between Step 4 (context engineering) and this step (verification).
Verification is not just about catching bugs in the current change. It is about
maintaining the quality of the codebase as context for future agent runs. Every defect
that enters the codebase degrades the context for every future interaction. Every defect
caught preserves it.

This reframes the cost calculation for verification. The cost of a review is not just "time
spent reviewing." It is "time spent reviewing + defects prevented from entering context +
compound quality preserved for future runs." The time spent in HODL mode reviewing
taste-required decisions is an investment in the context quality loop, not overhead.

The slop that enters the codebase is not a model problem. It is a context engineering
problem. If the agent produces slop, the fix is not "use a better model." The fix is:
verify more rigorously so that slop does not enter the codebase, preserve the context
quality for the next run, and let the context quality loop compound in the right direction.

> **AGENTIC GROUNDING:** When deciding how much verification effort to invest, factor in
> the compound effect. A defect caught today prevents not just the defect itself but the
> copies of that defect that future agent runs would produce by treating it as a valid
> pattern. If you allow an anti-pattern into the codebase "just this once," you are
> not accepting one instance. You are seeding the training context for every future agent
> interaction with that codebase. The cost of insufficient verification is not linear. It
> compounds.

---

## Challenge: Build a Quality Gate

**Estimated time: 15 minutes**

**Goal:** Construct a quality gate for a small project and understand what it catches and
what it misses.

Create a new directory with a minimal TypeScript project:

```bash
mkdir gate-exercise && cd gate-exercise
pnpm init
pnpm add -D typescript @types/node vitest eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*.ts"]
}
```

Create `src/math.ts`:

```typescript
export function divide(a: number, b: number): number {
  return a / b;
}
```

Create `src/math.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { divide } from "./math";

describe("divide", () => {
  it("should divide two numbers", () => {
    expect(divide(10, 2)).toBe(5);
  });
});
```

Now create the gate:

```bash
# Add scripts to package.json
# typecheck: "tsc --noEmit"
# lint: "eslint src/"
# test: "vitest run"
# gate: "pnpm run typecheck && pnpm run lint && pnpm run test"

pnpm run gate
```

**Verification:** The gate should pass (green). Now introduce three defects, one at a time,
and observe which gate component catches each:

1. Change `divide` to return a string: `return String(a / b);`
   - Which component catches this? (Answer: type checker)

2. Add an unused variable: `const x = 42;`
   - Which component catches this? (Answer: linter, if configured)

3. Change the implementation to `return a * b;`
   - Which component catches this? (Answer: test suite)

4. Change the implementation to `return a / b;` but do not handle `b === 0`
   - Which component catches this? (Answer: none - this is a gate hole)

**What you are learning:** The gate catches three categories of defect automatically. The
fourth - a missing edge case - is a hole in the cheese. This is why the gate is necessary
but not sufficient.

---

## Challenge: Identify the Anti-Pattern

**Estimated time: 20 minutes**

**Goal:** Given five test code snippets, identify which anti-pattern each demonstrates.

For each snippet below, identify the anti-pattern (right answer wrong work, phantom
tollbooth, mock castle, shadow validation, or confessional test) and explain your reasoning.

**Snippet 1:**

```typescript
it("should format currency correctly", () => {
  const result = formatCurrency(1000, "USD");
  expect(result).toBeTruthy();
  expect(typeof result).toBe("string");
});
```

**Snippet 2:**

```typescript
it("should calculate shipping cost", () => {
  // Shipping calculation depends on weight, distance, and carrier
  // We only test the default case since carrier API is not mockable
  const result = calculateShipping({ weight: 1, distance: 10 });
  expect(result).toBeGreaterThan(0);
  // NOTE: actual carrier rates verified manually
});
```

**Snippet 3:**

```typescript
it("should parse the config file", () => {
  const result = parseConfig('{"port": 3000}');
  expect(result.port).toBe(3000);
  // This also passes for parseConfig that ignores input and returns {port: 3000}
});
```

**Snippet 4:**

```typescript
describe("authentication", () => {
  // ... 80 lines of mock setup for database, cache, token service, logger ...
  it("should authenticate user", () => {
    const result = authenticate("user", "pass");
    expect(result.authenticated).toBe(true);
  });
});
```

**Snippet 5:**

```typescript
describe("importUsers", () => {
  it("should reject empty name", () => { /* ... */ });
  it("should reject invalid email format", () => { /* ... */ });
  it("should reject duplicate email", () => { /* ... */ });
  // No tests for: batch processing, partial failure recovery,
  // merge with existing records, performance with 10K+ records
});
```

<details>
<summary>Answers</summary>

1. **Phantom Tollbooth** - `toBeTruthy()` and `typeof === "string"` pass for any non-empty
   string. `formatCurrency(1000, "USD")` should return exactly "$1,000.00", not just
   "something truthy that is a string."

2. **Confessional Test** - The test comments confess it cannot verify the actual claim.
   "Actual carrier rates verified manually" is the confession. The test name says
   "calculate shipping cost" but the body only checks the result is positive.

3. **Right Answer, Wrong Work** - `parseConfig` could ignore its input and hardcode
   `{port: 3000}`, and the test would still pass. The test verifies the answer, not
   the work.

4. **Mock Castle** - 80 lines of mock setup for one assertion. The mocks define the
   universe; the test barely checks one property of it.

5. **Shadow Validation** - Three tests for simple input validation, zero tests for the
   complex business logic (batch processing, partial failures, merge, performance).

</details>

---

## Challenge: Verifiable vs Taste-Required Audit

**Estimated time: 20 minutes**

**Goal:** Given a list of changes in a hypothetical PR, categorise each as verifiable or
taste-required and specify the appropriate governance mode.

Imagine an agent has generated a PR with the following changes:

1. Added a new `UserService` class with CRUD methods
2. Changed the database schema to add a `last_login` column
3. Fixed a type error in `auth.ts` where `string` was used instead of `Date`
4. Renamed `processData()` to `transformUserInput()`
5. Added 15 unit tests for the new `UserService`
6. Updated the API documentation for the `/users` endpoint
7. Refactored the error handling from try/catch to a result type pattern
8. Added a `pnpm run migrate` script to `package.json`

For each change, determine:
- Is it verifiable, taste-required, or both?
- Should it be HOTL or HODL?
- What specific check verifies the verifiable aspects?

**Verification:** Compare your categorisation to these principles:
- If an automated tool can confirm correctness, the verifiable aspect is HOTL
- If only human judgment can evaluate quality, it is HODL
- Many changes are both - the verifiable aspect is confirmed by the gate, the
  taste-required aspect needs human review

<details>
<summary>Suggested answers</summary>

| Change | Verifiable? | Taste-Required? | Mode | Check |
|--------|------------|----------------|------|-------|
| 1. New UserService | Types, tests | Class design, method API, naming | HODL | Gate + human review |
| 2. Schema change | Migration runs, types match | Column name, type choice, nullable? | HODL | Gate + DBA/senior review |
| 3. Type fix | Type checker | - | HOTL | Type checker |
| 4. Rename | Types, tests | Is the new name better? | HODL | Gate + human review |
| 5. Unit tests | Tests pass | Are they testing the right things? (Section 7) | HODL | Gate + test review |
| 6. Documentation | - | Clarity, completeness, accuracy | HODL | Human review |
| 7. Error handling refactor | Types, tests | Is result type the right pattern here? | HODL | Gate + architecture review |
| 8. Migration script | Script runs | - | HOTL | Run it |

Key observation: most changes have both verifiable and taste-required aspects. The
verifiable part is cheap (gate handles it). The taste-required part is where human review
time should be spent.

</details>

---

## Challenge: Design a Swiss Cheese Pipeline

**Estimated time: 25 minutes**

**Goal:** Design a 4-layer verification pipeline for a specific workflow, identifying what
each layer catches and where its holes are.

Scenario: Your team uses AI agents to generate database migration scripts. The agent reads
the current schema, reads the feature specification, and generates a migration file. The
migration will be run against a production database with millions of rows.

Design a verification pipeline with at least 4 layers. For each layer, specify:

1. **What it is** (automated check, human review, etc.)
2. **What it catches** (specific defect categories)
3. **What its holes are** (what defects pass through)
4. **Whether it is independent** of the other layers

Consider these categories of migration defects:
- Syntax errors in SQL
- Missing rollback/down migration
- Data loss (dropping columns with data)
- Performance (locking a 10M-row table for ALTER)
- Logical errors (wrong column type, wrong default value)
- Specification mismatch (migration does not match the feature spec)

<details>
<summary>Example pipeline</summary>

**Layer 1: Schema Validation (Automated)**
- Catches: SQL syntax errors, missing rollback, schema inconsistencies
- Holes: Syntactically valid but semantically wrong migrations
- Independence: Fully automated, independent of other layers

**Layer 2: Dry Run on Staging (Automated)**
- Catches: Runtime errors, lock duration on realistic data volume, missing dependencies
- Holes: Data-dependent issues not present in staging data
- Independence: Independent (different environment, different data)

**Layer 3: Peer Review (Human)**
- Catches: Data loss risks, specification mismatches, naming issues, rollback quality
- Holes: Reviewer fatigue, shared assumptions with the specification author
- Independence: Independent perspective, different from agent that generated the migration

**Layer 4: DBA Review (Human, specialized)**
- Catches: Performance implications on production data volumes, index strategy, lock
  duration, connection pool exhaustion
- Holes: DBA may not know the feature specification context
- Independence: Different expertise from peer reviewer, focused on operational impact

P(defect reaching production) = P(survives validation) * P(survives dry run) *
P(survives peer review) * P(survives DBA review)

</details>

**Extension:** Calculate the theoretical defect survival rate if each layer catches 80%
of relevant defects. What happens if layers 3 and 4 share a blind spot (both humans
miss the same class of error)?

---

## Challenge: The Oracle Problem Exercise

**Estimated time: 25 minutes**

**Goal:** Deliberately introduce an L12 (human) error into a specification and observe
whether the verification stack catches it.

This exercise requires a partner or a separate "agent" session. If working alone, use
two separate contexts.

**Setup:**

Write a specification for a function with a deliberate error:

```
Specification: calculateAge(birthDate, referenceDate)
Returns the age in years.
Age should be calculated as: referenceDate.year - birthDate.year
```

This specification is wrong. It does not account for whether the birthday has occurred
yet in the reference year. Someone born on December 15, 1990, is not 36 on March 10,
2026 - they are 35. But the specification says `referenceDate.year - birthDate.year`,
which returns 36.

**Exercise:**

1. Give this specification to an AI agent (or a partner acting as one)
2. Ask them to implement and test it
3. Run the gate
4. Observe: does any layer catch the oracle error?

**Expected finding:** The agent implements the specification faithfully. The tests pass
because they test against the (wrong) specification. The gate is green. Code review checks
the implementation against the specification - they match. The oracle error propagates
through every layer.

**What you are learning:** The verification fabric catches agent errors. It is structurally
blind to oracle errors. The only defence is catching the specification error before it
reaches the agent: specification review, domain expert review, or orthogonal verification
(testing against a known-correct external reference like a date library).

**Verification:** If the agent or partner caught the specification error, investigate why:
did they have domain knowledge the specification lacked? Did they test against a boundary
case the specification did not address? The mechanism of detection is more interesting than
the result.

---

## Challenge: Measure Your Perception-Reality Gap

**Estimated time: 30 minutes**

**Goal:** Replicate the core measurement from the METR RCT (arXiv:2507.09089) on a small
scale to calibrate your own perception of AI productivity.

**Setup:**

Choose two coding tasks of similar complexity from your backlog or a practice repository.
Tasks should be:
- Small enough to complete in 20-30 minutes each
- Similar in type (both bug fixes, or both small features)
- In a codebase you know well

**Exercise:**

1. Before starting, predict: how much faster will you be with AI assistance? Write down
   your prediction as a percentage (e.g., "30% faster with AI").

2. Complete Task A **without** AI assistance. Time yourself from start to "gate green."
   Record the time.

3. Complete Task B **with** AI assistance (your usual AI tools). Time yourself from start
   to "gate green." Record the time.

4. Compare:
   - Your prediction: ____% faster with AI
   - Actual result: ____% (faster or slower)
   - Gap: ____ percentage points

**What you are learning:** The METR study found a 40-point perception-reality gap (perceived
20% faster, actual 19% slower). Your gap will likely be different - the METR study used
experienced developers on mature codebases with early-2025 tools. But the exercise calibrates
your perception. If your gap is large in either direction, that information changes how you
make governance decisions about HOTL vs HODL.

**Caveats:** This is not a controlled experiment. Two tasks are not statistically
significant. The tasks may differ in ways you did not anticipate. The point is not
statistical validity. The point is calibration of your own perception.

**Extension:** If you have time, repeat with two more tasks, swapping which one gets AI
assistance. Track whether your prediction accuracy improves with the second pair.

> **AGENTIC GROUNDING:** Calibrating your perception of AI productivity is itself a
> verification exercise. If your mental model of "how much the agent helps" is uncalibrated,
> you will make systematically wrong governance decisions. You will use HOTL when you should
> use HODL, or you will over-invest in human review for tasks where the agent genuinely
> helps. The METR RCT is a data point, not a verdict. Your data point, on your codebase,
> with your tools, is more relevant to your decisions.

---

## Key Takeaways

Before moving to Step 7, verify you can answer these questions without looking anything up:

1. Why is LLM output probabilistic, and what does this mean for testing? (Not "the model
   is random" - what specific property of autoregressive generation means the same prompt
   can produce different code?)

2. What is the oracle problem (Weyuker 1982)? In human-AI systems, who is the oracle, and
   what happens when the oracle is wrong?

3. What is a poka-yoke, and how does the quality gate function as one?

4. What is the distinction between verifiable and taste-required output? Give one example
   of each from a typical PR.

5. What does HOTL mean and when should you use it? What does HODL mean and when should you
   use it? What determines which one is appropriate?

6. Explain the Swiss Cheese Model (Reason 1990) in one sentence. Why is layer independence
   important?

7. Name the five test anti-patterns. For each, state the detection heuristic in one
   sentence.

8. What did the METR RCT (arXiv:2507.09089) find about experienced developer productivity
   with AI tools? What is the perception-reality gap, and why does it matter for
   verification governance?

9. What is the context quality loop, and how does verification affect which direction
   it runs?

10. Why is the definition of done "gate green + review complete + specification checked"
    and not just "gate green"?

---

## Recommended Reading

- **Human Error** - James Reason (1990). The Swiss Cheese Model. Chapter 7 (The
  Anatomy of an Accident) is the most relevant to verification pipeline design. 35+ years
  of application in aviation, healthcare, and process safety.

- **"On Testing Non-Testable Programs"** - Elaine J. Weyuker (1982). *The Computer
  Journal*, 25(4), 465-470. The oracle problem - foundational to understanding the limits
  of testing.

- **"Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer
  Productivity"** - Becker, Rush, Barnes, & Rein (2025). arXiv:2507.09089. The METR RCT.
  16 developers, 246 tasks, 19% slower with AI, 40-point perception-reality gap. The most
  rigorous empirical study of AI impact on experienced developer productivity.

- **"Navigating the Jagged Technological Frontier"** - Dell'Acqua et al. (2023). Harvard
  Business School Working Paper 24-013. 758 BCG consultants using GPT-4. The jagged
  frontier concept - AI excels at some tasks while failing at tasks of similar perceived
  difficulty. Automation bias finding: consultants anchored on AI output even when wrong.

- **SWE-bench** - Jimenez et al. (2024). "SWE-bench: Can Language Models Resolve
  Real-World GitHub Issues?" ICLR 2024. https://www.swebench.com. The standard coding
  agent benchmark. Understanding what it measures and what it does not.

- **"Ironies of Automation"** - Lisanne Bainbridge (1983). *Automatica*, 19(6), 775-779.
  The foundational paper on cognitive deskilling through automation. "Automation removes
  the very expertise needed to monitor the automation." Directly relevant to the Bainbridge
  caution in the HOTL/HODL framework.

- **"Coding on Copilot: 2023 Data Suggests Downward Pressure on Code Quality"** - GitClear
  (2024). Analysis of 153 million changed lines. Code churn doubled post-AI adoption.
  Quantitative evidence for the context quality loop operating in the wrong direction.

---

## What to Read Next

**Step 7: The Human-AI Interface** - The oracle problem in this step establishes that the
human is the irreducible verification layer. Step 7 explores what that means operationally:
sycophantic drift (where the model agrees with the oracle even when the oracle is wrong),
the seven HCI foot guns (failure modes at the human-AI boundary), temporal asymmetry (why
the model has no concept of urgency), and the layer model's L9 and L12 (where self-
reinforcing loops and human judgment interact). The verifiable/taste-required distinction
introduced here becomes the governance framework in Step 7 - every taste-required decision
goes through the human, and Step 7 teaches you how that human can fail. If this step taught
you what verification can catch, Step 7 teaches you what verification cannot catch - and
what to do about it.

