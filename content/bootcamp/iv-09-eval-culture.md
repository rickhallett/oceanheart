+++
title = "Building an Eval Culture"
date = "2026-03-10"
description = "Eval review, ownership, roadmaps, sharing, continuous evaluation in production."
tags = ["evals", "culture", "enterprise", "bootcamp"]
step = 9
tier = 3
estimate = "3-4 hours"
bootcamp = 4
+++

Step 9 of 9 in Bootcamp IV: Evaluation & Adversarial Testing.

---

## Why This is Step 9

You can now design evals that measure what they claim to measure (Step 1). You can
build datasets that represent real-world distributions (Step 2). You can write scorers
and graders that are calibrated and defensible (Step 3). You can evaluate agent systems
with their compound failure modes (Step 4). You can automate eval infrastructure so
it runs without manual intervention (Step 5). You can adversarially test systems to
find what standard evals miss (Step 6). You can red-team safety-critical capabilities
with appropriate methodology and governance (Step 7). You can interpret and communicate
eval results honestly, with uncertainty quantified and limitations stated (Step 8).

None of that matters if you are the only person doing it.

Individual eval skill is necessary but not sufficient. A single practitioner writing
rigorous evals on a team that does not value them will produce artifacts that sit
unused, become unmaintained, and eventually rot. The evals decay. The datasets go
stale. The scorers drift out of calibration. The person who built them leaves the team,
and nobody picks up the maintenance. This is not a hypothetical failure mode. It is the
default outcome.

This step is about making eval discipline stick in an organisation, not just in a
person. It covers the practices, structures, and incentives that turn evaluation from
an individual skill into a team capability. It is the capstone because it depends on
everything before it: you cannot introduce eval culture to a team if you cannot explain
what construct validity is (Step 1), cannot demonstrate why dataset quality matters
(Step 2), cannot build the infrastructure that makes evals easy to run (Step 5), and
cannot communicate results in terms stakeholders understand (Step 8).

This is also the step with the thinnest evidence base. No published case studies
document how a team built an eval culture from scratch. No established frameworks exist
for eval ownership, eval review, or eval roadmaps as team practices. The guidance here
is synthesised from first principles, from operational experience in this project, and
from the patterns visible in how frontier AI labs organise their evaluation work. Where
the evidence is thin, the text says so.

> **FIELD MATURITY: EMERGING** - The tools and techniques for LLM evaluation are
> maturing (Inspect AI, METR methodology, benchmark infrastructure). The organisational
> practices around eval - ownership, review, roadmapping, continuous monitoring - have
> almost no published guidance. What follows is practical synthesis, not established
> doctrine.

---

## Table of Contents

1. [Evals as a Team Practice](#1-evals-as-a-team-practice) (~25 min)
2. [The Eval Review](#2-the-eval-review) (~25 min)
3. [Eval Ownership](#3-eval-ownership) (~25 min)
4. [The Eval Roadmap](#4-the-eval-roadmap) (~30 min)
5. [Eval Sharing and Reuse](#5-eval-sharing-and-reuse) (~20 min)
6. [Evals and Governance](#6-evals-and-governance) (~25 min)
7. [Continuous Evaluation](#7-continuous-evaluation) (~30 min)
8. [Challenges](#8-challenges) (~45-60 min)
9. [Key Takeaways](#9-key-takeaways)
10. [Recommended Reading](#10-recommended-reading)
11. [What to Read Next](#11-what-to-read-next)

---

## 1. Evals as a Team Practice

*Estimated time: 25 minutes*

The most common way eval discipline enters a team is through a single motivated person.
Someone reads a paper, attends a conference, encounters a production failure that an eval
would have caught, or completes a bootcamp like this one. They build an eval. Maybe two.
The evals are good. They catch real problems. And then what?

In the best case, the team sees the value and adopts the practice. In the typical case,
the evals exist in a corner of the repository, run by one person, understood by one
person, maintained by one person. When that person is on vacation, the evals do not run.
When that person moves to another team, the evals die.

The transition from individual practice to team practice requires deliberate change
management. You cannot mandate it into existence. You cannot memo your way to an eval
culture. The change must be demonstrated, felt, and then formalised - in that order.

### Start with One High-Risk Capability

Do not try to introduce comprehensive evaluation all at once. Pick one capability where
failure is costly and visible. This is not about finding the most technically interesting
eval to build. It is about finding the eval whose value is immediately obvious to
everyone on the team.

Good candidates:

- A customer-facing feature that has produced embarrassing failures
- A capability where the team already has low confidence ("we are not sure the
  summarisation works well on long documents")
- A use case where model provider updates have caused regressions before
- A workflow where manual QA is currently expensive and slow

The first eval you introduce to a team is not primarily about measuring the model.
It is about demonstrating to the team that evaluation produces actionable information.
If the first eval catches a real problem - or confirms that something the team worried
about is actually fine - you have created a proof point. If the first eval produces a
number that nobody knows how to act on, you have set the effort back.

### Make It Easy

The single largest barrier to eval adoption is friction. If running an eval requires
setting up a custom environment, downloading a specific dataset, installing specific
tools, and interpreting raw output files, it will not be adopted. The eval needs to be
as easy to run as the test suite.

Practical measures:

- **Templates** - Provide a template for new evals that handles the boilerplate. If you
  are using Inspect AI (Step 5), the Task/Dataset/Solver/Scorer architecture already
  provides this structure. If not, create a minimal skeleton that handles data loading,
  model invocation, scoring, and output formatting.

- **Shared datasets** - Store eval datasets in a common location (repository, shared
  storage, registry). Do not require each team member to construct their own test data.
  Make the datasets versioned (Step 2 covered why this matters).

- **Tooling** - Wrap eval execution in a single command. `make eval-summarisation` is
  better than a wiki page explaining how to run the summarisation eval. `pnpm run eval`
  is better than "clone this other repo, install these dependencies, and run this
  script."

- **Results in a standard format** - Output that a human can read without custom parsing.
  Scores, sample counts, confidence intervals (Step 8), and a diff against the previous
  run. The Inspect AI log viewer is one example. A simple JSON or YAML report is another.

```bash
# What adoption looks like: one command, clear output
$ make eval-summarisation

Running summarisation eval (v2.3, 150 samples)...
  Accuracy:     0.82 [0.75, 0.88] (95% CI)
  Faithfulness: 0.91 [0.86, 0.95] (95% CI)
  Previous run: accuracy 0.84, faithfulness 0.90
  Delta:        accuracy -0.02 (within noise), faithfulness +0.01

Pass: all metrics within acceptable range.
```

The point is not the specific format. The point is that a team member who has never run
this eval before can execute one command and understand the result.

### Make It Visible

Evals that run silently produce no cultural pressure. If the eval results are buried in
CI logs that nobody reads, they might as well not exist. Visibility creates
accountability.

Practical measures:

- **Dashboards** - Display eval results where the team already looks. If the team uses a
  CI dashboard, add eval results there. If the team reviews a weekly metrics page, put
  eval trends on it. Do not create a separate eval dashboard that requires a separate
  login. Meet people where they are.

- **CI integration** - Run evals on every PR or every merge to the main branch, depending
  on cost and speed. The key is regularity. An eval that runs monthly is a report. An
  eval that runs on every merge is a quality signal.

- **Trend lines** - A single eval score is a data point. A trend of eval scores over time
  is information. Did the score drop after the last model provider update? Did it improve
  after a prompt change? Trends make the value of evaluation visible to people who do not
  run the evals themselves.

### Make It Mandatory

Once the team has seen the value (through the proof point) and the friction is low
(through templates and tooling), the final step is to make evals a gate.

This is the most culturally sensitive step. Gates that feel arbitrary or imposed will
generate resistance. Gates that the team understands and has seen prevent real problems
will be accepted.

The pattern:

1. Run evals alongside the build for a period (observational mode). Let the team see
   what they catch without blocking anything.
2. Review the results together. Discuss: "Would we have wanted to block this merge based
   on these results?"
3. When there is consensus that the eval is catching real problems, make it a gate.

This mirrors how quality gates in traditional software engineering get adopted. Linters
start as warnings. Type checkers start as optional. Tests start as advisory. They become
mandatory when the team has internalised their value.

> **NOVEL:** The quality gate concept from this project provides a minimal worked example.
> The gate - `pnpm run typecheck && pnpm run lint && pnpm run test` - is three binary
> checks composed with logical AND. It runs on every change. It blocks on failure. It
> is survival, not optimisation. This is the simplest form of continuous evaluation: a
> set of automated checks that run on every change and produce a binary result. The
> extension to LLM evals is conceptual, not architectural: add eval checks to the gate,
> with the same pass/fail semantics and the same blocking behaviour.

### Change Management

People resist new gates for predictable reasons:

- **"It slows us down."** This is true in the short term. Address it by making evals
  fast (run in parallel with existing CI, cache where possible, use representative
  samples not exhaustive datasets) and by quantifying the cost of not evaluating
  (production incidents, rollbacks, manual QA time saved).

- **"The eval is wrong."** Sometimes it is. An eval that produces false positives will
  burn trust faster than no eval at all. This is why eval quality matters (Steps 1-3)
  and why eval review matters (Section 2 below). If the team says the eval is wrong,
  investigate immediately. Either fix the eval or explain why it is correct.

- **"My use case is different."** Evals that are too generic will not capture domain-
  specific concerns. Evals that are too specific will not cover the full range of inputs.
  Build domain-specific evals with input from the domain experts on the team.

- **"Nobody else does this."** This was true of unit testing in 2000, type checking in
  JavaScript in 2015, and security scanning in CI in 2020. The objection is valid in
  the sense that you are ahead of common practice. It is not valid as a reason to skip
  evaluation.

The pattern that works: demonstrate value, reduce friction, build consensus, then
formalise. The pattern that does not work: mandate first, explain later.

> **AGENTIC GROUNDING:** When you deploy an agent system - a model connected to tools,
> acting in a loop - the case for team-level eval discipline is stronger than for
> simple API calls. Agent failures cascade through tool calls, retry loops, and state
> mutations. A single team member's intuition about "does this agent work?" is not
> sufficient when the agent's behaviour depends on dozens of interacting components.
> Team-level eval infrastructure catches failures that individual spot-checking misses,
> because the eval tests the system, not just the model.

---

## 2. The Eval Review

*Estimated time: 25 minutes*

Code review is a solved practice. Every engineering team has a process for reviewing
code changes before they merge. The review checks: does the code do what it claims?
Are there edge cases? Is the logic correct? Is it maintainable?

Eval review is the same practice applied to evaluation artifacts. It is not established.
No published guidance exists on "how to review an eval." The concept is implied by the
Inspect Evals contributor model (community review of submitted evals) and by the
external review process visible in papers like the alignment faking study (four
independent reviewers). But nobody has codified the practice for engineering teams.

> **FIELD MATURITY: EMERGING** - Eval review as a formal practice has no published
> methodology. The checklist below is synthesised from the evaluation quality concepts in
> Steps 1-3 applied to a review context. It is a recommendation, not established
> industry practice.

### What an Eval Review Checks

When a team member submits a new eval or modifies an existing one, the reviewer should
check:

**1. Construct validity (Step 1):** Does this eval measure what it claims to measure?
If the eval claims to measure "summarisation quality," does it actually test whether
summaries are accurate and complete, or does it test something else (length, fluency,
format compliance)? The reviewer should be able to answer: "If a model scored perfectly
on this eval, what would we know about the model's capability?"

The inverse question is equally important: "Can a model score well on this eval without
actually having the capability it claims to measure?" If the answer is yes, the eval
has a construct validity problem.

**2. Dataset quality (Step 2):** Are the eval samples representative of the distribution
the model will encounter in production? Are there enough edge cases? Is the dataset
balanced across relevant dimensions? Is there evidence of contamination (samples that
appeared in the model's training data)?

For dataset review, the reviewer should not just check the metadata. Read 10-20 samples.
Check for duplicate or near-duplicate entries. Verify that the "correct" answers are
actually correct. Check that the difficulty distribution matches what the eval intends
to measure.

**3. Scorer calibration (Step 3):** Is the grading rubric well-defined? Are the scoring
criteria mutually exclusive and collectively exhaustive? If using an LLM-as-judge, has
the grader been calibrated against human judgments on a held-out set?

For LLM-graded evals, the reviewer should check: does the grading prompt contain leading
language? Is the rubric specific enough that two different LLM judges would produce
similar scores? Has the grader accuracy been measured (Step 3)?

**4. Statistical power (Step 8):** Is the sample size sufficient? A 50-sample eval may
have confidence intervals so wide that it cannot distinguish between 80% and 90%
accuracy. A 500-sample eval is more expensive but produces actionable results. The
reviewer should check that the sample size supports the decisions the eval is intended
to inform.

**5. Failure mode coverage:** Does the eval test the common cases, the edge cases, and
the adversarial cases? An eval that only tests happy-path inputs will not catch the
failures that matter. The reviewer should look for: what inputs are not represented?
What failure modes could slip through?

**6. Reproducibility:** Can someone else run this eval and get the same results? Is the
dataset versioned? Is the model version pinned? Are the scorer parameters documented?
If the eval uses random sampling, is the seed fixed?

### The Review Checklist

A minimal eval review checklist, suitable for a PR template:

```markdown
## Eval Review Checklist

- [ ] The eval description states what construct it measures
- [ ] I can articulate how a model could score well without having the claimed capability
- [ ] I have read at least 10 samples from the dataset
- [ ] The "correct" answers in the dataset are actually correct
- [ ] The dataset includes edge cases, not just easy/common cases
- [ ] The scorer criteria are well-defined and unambiguous
- [ ] If LLM-graded: grader accuracy has been measured on a held-out set
- [ ] The sample size is sufficient for the decision this eval informs
- [ ] The eval can be run with one command
- [ ] The eval output includes confidence intervals or uncertainty estimates
- [ ] The eval is versioned (dataset, scorer, and configuration)
```

This checklist is not exhaustive. It is a starting point. Teams should extend it based
on their domain and their experience with eval failures.

### Common Review Findings

In practice, eval reviews surface the same problems repeatedly:

- **The eval tests the easy cases.** The dataset was built from examples where the
  answer is obvious, because obvious examples are easy to generate. The hard cases -
  the ones that actually discriminate between good and bad model performance - are
  missing.

- **The scorer is too lenient.** The rubric accepts partial answers as correct, or the
  LLM judge grades charitably because its prompt says "evaluate helpfulness" (and
  anything vaguely related counts as helpful).

- **The eval and the product have drifted.** The eval was written for v1 of the feature.
  The feature is now on v3. The eval still tests v1 behaviour. It passes reliably
  because it is testing something that no longer matches production.

- **The "correct" answers are wrong.** In any hand-labelled dataset of meaningful size,
  some labels will be incorrect. If nobody reviews the dataset, these errors persist
  and distort the eval results.

> **SLOPODAR:** "Right answer wrong work" - the eval produces the correct scores via the
> wrong causal path. If the eval reliably passes but the product has quality problems,
> the eval is not measuring what it claims. The review should check: can I break the
> product in a way the user would notice, while keeping the eval green?

### Making Eval Review Routine

Eval review should be part of the PR process, not a separate ceremony. When a PR
includes a new eval or modifies an existing one, the review includes the eval alongside
the code. The reviewer does not need to be an eval specialist - they need the checklist
and the willingness to read the dataset samples.

Over time, eval review builds a shared understanding of what makes an eval good. Team
members who review evals become better eval designers. This is the same mechanism by
which code review improves code quality: the review process teaches standards through
repeated exposure.

---

## 3. Eval Ownership

*Estimated time: 25 minutes*

Code has owners. Services have on-call rotations. APIs have maintainers. Who owns
the eval suite?

In most teams deploying LLM capabilities, the answer is: nobody, explicitly. Evals
were written by whoever happened to be working on the feature when the eval was needed.
They live in a directory that multiple people can modify. Nobody is responsible for
keeping them current. Nobody is notified when they start failing for reasons unrelated
to the change that triggered the CI run. Nobody updates the datasets when the domain
evolves.

This is the eval ownership anti-pattern: nobody owns it, so nobody maintains it, so
it decays, so it stops being useful, so people stop running it, so it dies.

### The Ownership Matrix

Eval ownership requires explicit assignment across three dimensions:

**1. Maintenance ownership** - Who is responsible for keeping the eval functional?
When a dependency breaks, when the model API changes, when the scoring library
updates - who fixes the eval so it runs again?

This is not glamorous work. It is the eval equivalent of keeping the build green.
Without it, the eval suite accumulates broken tests that everyone learns to ignore.

**2. Content ownership** - Who updates the dataset when the domain changes? If the
product adds a new feature, someone needs to add eval cases that cover it. If user
behaviour shifts, someone needs to verify that the eval distribution still matches
the production distribution. If the "correct" answers change (because the domain
evolved, not because someone made a mistake), someone needs to update the labels.

Content ownership is harder to assign because it requires domain expertise. The
engineer who built the eval infrastructure may not be the person who understands the
domain well enough to update the dataset.

**3. Regression investigation** - When a model update causes eval scores to drop,
who investigates? This is not the same as maintenance ownership (the eval is running
correctly - the scores just got worse) and it is not the same as content ownership
(the dataset has not changed - the model has). Regression investigation requires
understanding both the eval and the model's behaviour well enough to distinguish
between "the model got worse" and "the eval is measuring something the model changed
legitimately."

### Assigning Ownership

A simple ownership document for each eval:

```yaml
# eval-ownership.yaml

evals:
  - name: summarisation-accuracy
    description: Tests whether summaries are factually consistent with source
    owner: "@alice"
    content_owner: "@bob"
    regression_investigator: "@alice"
    review_trigger:
      - model provider update
      - summarisation prompt change
      - quarterly scheduled review
    escalation:
      - if score drops >5%: investigate within 1 business day
      - if score drops >15%: block deployment, escalate to team lead

  - name: safety-refusal
    description: Tests whether the model refuses clearly harmful requests
    owner: "@carol"
    content_owner: "@carol"
    regression_investigator: "@dave"
    review_trigger:
      - model provider update
      - safety policy change
      - monthly scheduled review
    escalation:
      - any regression: investigate immediately
      - new failure mode: add to dataset within 1 week
```

The format does not matter. What matters is that the three questions - who maintains
it, who updates the content, who investigates regressions - have explicit answers that
are not "everybody" (which means nobody).

### The "Everybody Owns It" Failure

When eval ownership is collective, three failure modes emerge:

**Bystander effect** - Everyone assumes someone else will notice the problem. A failing
eval sits in CI for weeks because each team member thinks another team member is
handling it.

**Inconsistent updates** - Multiple people update the dataset without coordinating.
Duplicate samples appear. Conflicting labels appear. The dataset drifts in ways that
no single person tracks.

**Regression blindness** - When nobody is specifically responsible for investigating
regressions, score drops get treated as noise. "The summarisation eval dropped 3%?
Probably just model variance." This continues until the drop is 15% and a customer
reports the problem.

### Ownership at Scale

For small teams (2-5 people working with LLMs), one person can own the entire eval
suite. The assignment is clear. The risk is bus factor.

For larger teams, ownership should follow the same boundaries as code ownership. The
team that owns the summarisation feature owns the summarisation eval. The team that
owns the safety layer owns the safety evals. Cross-cutting evals (general quality,
model regression, latency) need a designated owner, which might be a platform team or
a rotating responsibility.

> **FIELD MATURITY: EMERGING** - The closest published model for eval team structure
> comes from Anthropic's RSP update (October 2024), which lists five teams contributing
> to evaluation work: Frontier Red Team, Trust and Safety, Security and Compliance,
> Alignment Science, and the RSP Team itself. The RSP Team handles "policy drafting,
> assurance, and cross-company execution" - this is the coordination function. A
> "Responsible Scaling Officer" role (currently Jared Kaplan, co-founder and Chief
> Science Officer) owns the cross-team coordination. This structure is designed for
> a frontier AI lab. It does not transfer directly to enterprise teams, but the pattern
> - distributed ownership with a coordination function - does.

> **AGENTIC GROUNDING:** In agent systems, eval ownership is more critical than in
> simple model API usage. Agent behaviour depends on tool configurations, prompt chains,
> orchestration logic, and model capabilities interacting. When any of these components
> change, the eval needs to be re-examined. If nobody owns that re-examination, the
> eval will reflect a system configuration that no longer exists. The agent has moved
> on. The eval has not.

---

## 4. The Eval Roadmap

*Estimated time: 30 minutes*

You cannot build all the evals at once. Teams have limited time, limited expertise, and
limited patience for new process. The eval roadmap is the prioritised plan for which
evals to build, in what order, with what investment.

### The Prioritisation Framework

Three dimensions determine which evals to build first:

**1. Risk** - What is the cost of the failure mode this eval would detect? A failure in
safety refusal that allows harmful content to reach users has higher risk than a failure
in formatting that produces slightly ugly output. A failure in medical summarisation
that omits a critical finding has higher risk than a failure in email drafting that
uses an awkward phrase.

Risk assessment requires understanding the product and its users, not just the model.
The same model capability may be high-risk in one deployment context and low-risk in
another.

**2. Frequency** - How often does this capability get exercised? A feature used 10,000
times per day has more exposure to failure than a feature used 10 times per month.
High-frequency capabilities compound small error rates into large absolute numbers of
failures.

**3. Coverage gap** - What is already evaluated, and what is not? If you already have
a robust eval for summarisation accuracy but nothing for summarisation faithfulness,
the faithfulness eval has higher marginal value.

The prioritisation heuristic:

| Priority | Criteria | Example |
|----------|----------|---------|
| P0 | High risk + any frequency | Safety refusal, harmful content filtering |
| P1 | High risk + high frequency | Core product capability with costly failures |
| P2 | Medium risk + high frequency | Common feature with moderate failure impact |
| P3 | Low risk or low frequency | Edge cases, rarely used features |

Build P0 evals first. P1 second. P2 when you have capacity. P3 when the higher
priorities are covered and maintained.

### ROI-Driven Eval Development

Evals cost time to build and time to maintain. That investment needs to be justified
by the value they provide. This is not unique to evals - it is the standard engineering
question of whether the cost of building a thing is exceeded by the cost of not
building it.

The costs of building an eval:

- **Design time** - Understanding the capability, defining success criteria, designing
  the dataset, calibrating the scorer. For a well-scoped eval, this is 1-3 days. For
  a complex eval (multi-dimensional, adversarial, requiring expert labellers), it can
  be weeks. Anthropic documented that their BBQ bias benchmark alone took "approximately
  2 people years spread over 6 months across 8 people to build" (Ganguli et al. 2023).

- **Maintenance time** - Keeping the eval current as the product, the model, and the
  domain evolve. This is ongoing. A rule of thumb: budget 10-20% of the original build
  time per quarter for maintenance.

- **Compute cost** - Running the eval against the model for every PR, every merge, or
  every release. LLM API calls are not free. A 500-sample eval with an LLM judge costs
  1,000 API calls per run (500 for the model under test, 500 for the judge).

The costs of not building an eval:

- **Production incidents** - Failures that reach users. The cost depends on the domain:
  embarrassment for a chatbot, legal liability for a medical application, safety risk
  for a critical infrastructure system.

- **Manual QA** - Human time spent checking model outputs that an automated eval could
  check. This time compounds: every model update, every prompt change, every feature
  addition triggers manual review if no automated eval exists.

- **Regression blindness** - Degradations that go undetected because nobody is measuring.
  The cost is paid when the degradation becomes visible to users, by which point the
  damage is already done.

The ROI calculation does not need to be precise. The question is directional: does
building this eval save more than it costs? For P0 and P1 priorities, the answer is
almost always yes. For P3, the answer may be no - and that is a legitimate reason to
not build the eval.

> **NOVEL:** The project's standing order on ROI - "before dispatching or review rounds,
> weigh cost/time/marginal value vs proceeding" - applies directly to eval development.
> The mathematical heuristic of diminishing marginal returns (from the project lexicon)
> governs eval investment: the first eval in a domain provides the most signal.
> Additional evals in the same domain have decreasing marginal value. Recognise the
> curve. Pivot to the next domain when you are on the flat part.

### The Eval Backlog

The eval roadmap should be managed as a backlog, not a document. Evals to build are
items in the backlog. Each item has:

- **Description** - What capability does this eval measure?
- **Priority** - P0/P1/P2/P3 based on the prioritisation framework
- **Estimated effort** - How long to design, build, and calibrate?
- **Dependencies** - Does this eval require a dataset that does not exist? A scorer that
  has not been built? Access to a model API?
- **Trigger** - What event prompted this backlog item? A production incident? A new
  feature? A model provider update? A gap identified in the eval roadmap review?

The backlog should be reviewed regularly (monthly is a reasonable cadence for most
teams). Priorities shift as the product evolves, as new failure modes emerge, and as
existing evals mature.

### A Concrete Eval Roadmap Example

Consider a team deploying an AI-assisted code review system. The system reviews pull
requests, identifies potential bugs, suggests improvements, and checks for security
vulnerabilities. Here is what an eval roadmap might look like:

**Quarter 1 - P0: Safety and accuracy**

| Eval | Construct | Samples | Scorer | Rationale |
|------|-----------|---------|--------|-----------|
| False positive rate | Does the system flag non-issues? | 200 clean PRs | Binary (flagged/not) | High false positive rate destroys user trust |
| Security vuln detection | Does it catch known vulnerability patterns? | 100 known vulns | Binary (caught/missed) | Missing a real vulnerability is the highest-risk failure |
| Harmful suggestion | Does it ever suggest code that introduces bugs? | 150 tricky cases | Expert review | Suggestions that make code worse are worse than no suggestion |

**Quarter 2 - P1: Core quality**

| Eval | Construct | Samples | Scorer | Rationale |
|------|-----------|---------|--------|-----------|
| Suggestion relevance | Are suggestions actually useful? | 300 real PRs | LLM-as-judge + human calibration | Core value proposition |
| Explanation quality | Are explanations clear and accurate? | 200 suggestions | Multi-dimensional rubric | Unclear explanations waste reviewer time |
| Language coverage | Performance across Python, JS, Go, Rust | 50 per language | Accuracy by language | Product supports multiple languages |

**Quarter 3 - P2: Edge cases and robustness**

| Eval | Construct | Samples | Scorer | Rationale |
|------|-----------|---------|--------|-----------|
| Large PR handling | Performance on PRs with 500+ lines changed | 50 large PRs | Accuracy + coverage | Large PRs are harder; need to verify quality |
| Adversarial inputs | Robustness to deliberately misleading code | 100 adversarial | Binary (fooled/not) | Users may try to bypass the system |
| Model regression | Scores stable across model updates | Full suite re-run | Delta analysis | Provider updates should not degrade quality |

This roadmap is concrete enough to act on but flexible enough to adjust as the team
learns what matters.

> **AGENTIC GROUNDING:** An AI-assisted code review system is an agent system: it reads
> code, reasons about it, uses tools (linters, AST parsers, vulnerability databases),
> and produces structured output. The eval roadmap above reflects the agent evaluation
> concerns from Step 4: the eval tests the system's output, not just the model's
> capability. The "harmful suggestion" eval is particularly important because it tests
> a failure mode unique to agent systems - the agent actively making things worse, not
> just failing to help.

---

## 5. Eval Sharing and Reuse

*Estimated time: 20 minutes*

Not every eval needs to be built from scratch. The LLM evaluation community has
produced a growing library of reusable evals, shared datasets, and standardised
benchmarks. Knowing when to reuse and when to build custom is an engineering judgment
that saves significant time.

### The Inspect AI Eval Registry

The Inspect Evals repository, created in collaboration by UK AISI, Arcadia Impact, and
the Vector Institute, contains 163+ community-contributed evaluations organised by
category. This is the closest thing to a shared eval registry that currently exists.

Categories include:

- **Safeguards** (17 evals) - WMDP, AgentHarm, StrongREJECT, FORTRESS, and others
- **Scheming** (6 evals) - Agentic Misalignment, Sandbagging (SAD), GDM Dangerous
  Capabilities suites
- **Cybersecurity** (11 evals) - Vulnerability detection, exploit generation assessment
- **Coding** - SWE-bench, HumanEval, MBPP, and variants
- **Reasoning** - MATH, GSM8K, ARC, and others
- **Knowledge** - MMLU, TriviaQA, and domain-specific knowledge tests

Each eval is packaged as a Python module using the Inspect framework's
Task/Dataset/Solver/Scorer architecture. This standardisation enables sharing: anyone
can run any eval from the registry against any supported model provider.

The contributing model is open. A published Contributing Guide describes how to submit
new evals, what quality standards apply, and how evals are categorised. This is the
"eval as community artifact" pattern: build once, share broadly.

### When to Reuse Published Evals

Published evals are most valuable as baselines:

- **Model comparison** - Running MMLU or HumanEval across models gives you a
  standardised comparison point. The scores are imperfect (Step 1 covered why), but they
  provide a common reference frame.

- **Regression detection** - Running the same published eval before and after a model
  update tells you whether general capabilities have changed. If MMLU drops 3% after a
  fine-tune, something has shifted.

- **Category coverage** - The safety evals in the Inspect registry (WMDP, StrongREJECT,
  AgentHarm) cover categories that are expensive to build from scratch. Running them
  gives you a baseline safety assessment without the multi-person-year investment of
  building your own.

- **Benchmarking new models** - When evaluating a new model provider, running the
  standard benchmarks gives you a quick capability profile before investing in custom
  evaluation.

### When to Build Custom

Published evals do not test your specific use case. They test general capabilities on
general datasets. Your deployment is specific.

Build custom evals when:

- **Your domain is specialised.** MMLU tests general knowledge. If your product
  summarises legal contracts, MMLU tells you nothing about legal contract summarisation
  quality. You need domain-specific samples with domain-expert labels.

- **Your failure modes are specific.** Published evals test for general failure modes.
  Your product may have failure modes unique to your architecture, your prompt design,
  or your user population. Only custom evals can test for failures you have observed or
  anticipate.

- **Your success criteria are multi-dimensional.** Published evals typically measure one
  dimension (accuracy, safety, fluency). Your product may need to measure accuracy AND
  safety AND latency AND format compliance simultaneously. Step 2 covered multi-
  dimensional success criteria. Custom evals implement those criteria.

- **Your users are different from the benchmark population.** Published datasets reflect
  the distribution their creators chose. Your users may have different patterns, different
  levels of sophistication, and different expectations.

### The Hybrid Approach

In practice, teams should use both:

1. **Published evals for baselines** - Run standard benchmarks to establish general
   capability profiles and detect regressions across model updates.

2. **Custom evals for product-specific quality** - Build targeted evals for the specific
   capabilities, failure modes, and success criteria that matter to your deployment.

3. **Published datasets as starting points** - Use published datasets as a foundation,
   then extend with domain-specific samples. This is cheaper than building from scratch
   and produces better coverage than either approach alone.

### Contributing Back

If you build a custom eval that tests a general capability (not specific to your product
or proprietary data), consider contributing it back to the community. The Inspect Evals
Contributing Guide describes the process. Benefits:

- Other teams can run your eval, providing implicit validation of your approach
- Community review may catch quality issues in your eval design
- You benefit from improvements others make to your contributed eval
- The eval community grows, which benefits everyone

Contributing back is not altruism. It is a practical investment in the infrastructure
that supports your own work.

---

## 6. Evals and Governance

*Estimated time: 25 minutes*

Evaluation is not just a technical practice. It is a governance practice. The eval
result is evidence. The deployment decision is the judgment. The audit trail connects
them.

This section connects to Bootcamp II Step 10 (governance). If you have not completed
that step, the concepts here will still be useful, but the governance context will
lack depth.

### The Audit Trail

When something goes wrong in production, the first question is: "What did we know
before we deployed?" The audit trail answers that question. It connects:

1. **Eval results** - What scores did the system achieve? On what dataset? With what
   scorer? When was the eval run?

2. **Decision** - Who approved the deployment? Based on what criteria? With what
   caveats or conditions?

3. **Context** - What was the model version? The prompt version? The system
   configuration? What had changed since the last deployment?

Without this trail, post-incident review becomes archaeology: digging through logs, git
history, and Slack messages to reconstruct what was known and what was decided. With the
trail, the review is straightforward: here is what we tested, here is what we found,
here is what we decided, here is what happened.

### Evals as Evidence for Deployment Decisions

An eval result is not a deployment decision. It is evidence that informs a deployment
decision. The distinction matters because:

- An eval that passes does not mean the system is safe to deploy. It means the system
  passed the specific tests that were run. The system may have failure modes that the
  eval does not cover.

- An eval that fails does not necessarily mean the system must not deploy. It may mean
  the failure is in a domain that is not relevant to the deployment context, or that the
  failure is known and mitigated by other means.

- Multiple evals provide more evidence than a single eval. The Swiss Cheese Model
  (Reason 1990) applies: each eval is a layer with holes. Multiple layers reduce the
  probability that a failure passes through all of them.

The deployment decision integrates eval evidence with other information: business
requirements, risk tolerance, mitigation strategies, regulatory constraints, and
human judgment. The eval result is input to the decision, not the decision itself.

### Eval Results in the Definition of Done

The definition of done is the set of criteria that must be met before work is
considered complete. In traditional software engineering, it typically includes: tests
pass, code reviewed, documentation updated. In LLM-powered systems, the definition
of done should include eval results.

> **NOVEL:** The project's definition of done provides a worked example of eval-
> integrated governance: "gate green + 3 adversarial reviews complete + synthesis pass
> + pitkeel reviewed + walkthrough checked." This is a composite criterion: five checks,
> each with a different evaluation mechanism. The first (gate green) is automated and
> verifiable. The remaining four require human judgment. The composition uses logical
> AND - all five must pass. This is the distinction between verifiable and
> taste-required (from the project lexicon): the gate can verify; only human judgment
> can evaluate the adversarial review quality, the synthesis coherence, and the
> walkthrough completeness. The definition of done encodes both automated and human
> evaluation as mandatory governance steps.

A practical definition of done for LLM-powered features:

```markdown
## Definition of Done - LLM Features

- [ ] Unit tests pass (code quality)
- [ ] Integration tests pass (system quality)
- [ ] Relevant evals pass with scores at or above baseline (model quality)
- [ ] Eval results include confidence intervals (measurement quality)
- [ ] New failure modes covered by new or updated eval cases (coverage)
- [ ] Eval results documented in deployment record (audit trail)
- [ ] Model version and prompt version recorded (reproducibility)
```

The specific items will vary by team and domain. The principle is constant: eval
results are part of the definition of done, not a separate activity.

### Connecting Evals to Regulatory Requirements

For teams deploying LLM systems in regulated domains, evals provide the evidence that
regulatory frameworks require:

- **EU AI Act** - The General-Purpose AI Code of Practice requires signatories to
  define systemic risk tiers and report on them. Eval results are the primary evidence
  for these reports. The Act requires "appropriate levels of transparency" about
  model capabilities and limitations - eval reports (Step 8) are how that transparency
  is delivered.

- **California SB 53** - Requires frontier developers to publish frameworks describing
  their approach to evaluating catastrophic risk thresholds. The eval roadmap (Section 4
  above) and eval results are the substance of these frameworks.

- **Sector-specific requirements** - Healthcare, finance, and legal domains have
  existing regulatory frameworks that require evidence of system quality. Evals are
  the mechanism by which LLM-powered systems produce that evidence.

The eval suite is not just a quality tool. It is compliance infrastructure. Teams in
regulated domains should design their eval suites with regulatory evidence requirements
in mind from the beginning, not bolt on compliance reporting after the fact.

> **SLOPODAR:** "Paper guardrail" - a rule stated but not enforced. "We will evaluate
> all models before deployment" written in a policy document without enforcement
> mechanism (automated gate, review checklist, audit trail) is a paper guardrail.
> Governance without enforcement is theatre. Governance with eval gates, documented
> results, and explicit approval records is substance.

---

## 7. Continuous Evaluation

*Estimated time: 30 minutes*

Steps 1-6 focused primarily on pre-deployment evaluation: build the eval, run it, make
a deployment decision based on the results. This is necessary but not sufficient.
Production is where reality tests your assumptions.

Continuous evaluation means running evaluation checks after deployment, during
production operation, on an ongoing basis. It is not a single eval run. It is a
practice of ongoing measurement that detects degradation before users report it.

> **FIELD MATURITY: EMERGING** - Post-deployment evaluation is now standard in frontier
> AI safety policies. Nine of twelve published frontier safety policies specify evaluation
> timing that includes post-deployment monitoring (METR Common Elements report, December
> 2025). The tools and practices for continuous evaluation in enterprise LLM deployments
> are less mature. What follows synthesises patterns from MLOps (distribution shift
> detection), frontier lab practices, and this project's operational experience.

### Why Pre-Deployment Evaluation is Not Enough

The model you evaluated is not the model that runs in production. Not because you
deployed the wrong model, but because:

**Model provider updates change behaviour.** If you use a model through an API (OpenAI,
Anthropic, Google), the provider updates the model periodically. These updates may
change behaviour in ways that your pre-deployment evals did not anticipate. A model
that passed your safety eval last month may respond differently to the same prompts
this month because the provider adjusted its safety training.

**User behaviour changes over time.** Your pre-deployment eval dataset reflects the
distribution of inputs you anticipated at design time. Real users generate inputs you
did not anticipate. They find edge cases. They discover failure modes. They use the
system in ways that your eval dataset does not represent.

**The world changes.** If your system processes current information (news, legal
developments, market conditions), the relationship between inputs and correct outputs
shifts over time. An eval dataset built with 2024 data may not represent the
distribution of 2025 inputs.

**New failure modes emerge.** Adversarial users discover new attack vectors. Jailbreak
techniques evolve. Prompt injection methods improve. A safety eval that was
comprehensive at deployment time may develop blind spots as the threat landscape
changes.

### What to Monitor

Continuous evaluation monitors three categories:

**1. Model quality drift**

Run your eval suite periodically against the production model. Not after every request
(too expensive), but on a schedule: daily, weekly, or triggered by model provider
update announcements.

What to track:

- **Core capability scores** - Are the main evals producing scores consistent with the
  pre-deployment baseline? A drop of more than one confidence interval width (Step 8)
  warrants investigation.

- **Latency and reliability** - API response times, error rates, timeout frequency.
  These are not traditional eval metrics, but they affect system quality. A model that
  is 50% slower after a provider update may fail in timeout-bounded agent loops.

- **Output distribution** - Are outputs changing character? Longer? Shorter? More
  verbose? More cautious? Changes in output distribution may indicate model updates
  even when the provider has not announced them.

**2. Distribution shift**

Compare the distribution of production inputs to the distribution of your eval dataset.
This is borrowed from traditional MLOps, where concept drift and data drift are
established concerns.

What to watch:

- **Input length distribution** - Are users sending inputs that are significantly
  longer or shorter than your eval samples?

- **Topic distribution** - Are users asking about topics that your eval dataset does
  not cover?

- **Difficulty distribution** - Are production queries harder or easier than your eval
  samples? If your eval dataset is all easy cases and production is serving hard queries,
  your eval scores overestimate production quality.

- **Adversarial input frequency** - Are you seeing prompt injection attempts, jailbreak
  attempts, or other adversarial inputs that your eval dataset does not include?

When distribution shift is detected, the correct response is to update the eval
dataset to reflect the actual production distribution, then re-evaluate. The eval
must follow the data, not the other way around.

**3. Emerging failure modes**

Some failure modes only become visible in production. They may be too rare to appear
in a 500-sample eval dataset but frequent enough to affect users at scale.

How to detect them:

- **User feedback** - Direct reports of problems. This is the least efficient detection
  mechanism (most users do not report problems) but the highest-fidelity signal (users
  know what a failure looks like in their context).

- **Automated output monitoring** - Run lightweight quality checks on a sample of
  production outputs. This is not a full eval. It is a canary: a simple check (e.g.,
  output length, presence of refusal patterns, format compliance) that flags anomalies
  for human review.

- **Incident logs** - Track production incidents involving the LLM component. Each
  incident may represent a failure mode that should be added to the eval suite.

> **NOVEL:** The catch-log from this project is a worked example of continuous evaluation
> evidence. The catch-log (`docs/internal/weaver/catch-log.tsv`) records each time a
> verification control fires during normal work. Each entry has: date, which control
> fired, what it caught, which agent caught it, the outcome, and extended notes. This
> is not a scheduled eval run. It is ongoing evaluation embedded in the workflow. When a
> slopodar pattern is detected, when a cross-model review finds a divergence, when a
> human reviewer catches something the automated checks missed - each is a data point in
> continuous evaluation. The catch-log schema:
>
> `date | control | what_caught | agent | outcome | notes`
>
> With an action taxonomy for outcomes: logged (acknowledged), reviewed (inspected),
> blocked (prevented action), fixed (code changed), scrubbed (content removed). This
> is continuous evaluation data, captured as a side effect of working, not as a separate
> evaluation activity.

> **NOVEL:** The quality gate in this project is itself a form of continuous evaluation.
> It runs on every change (`pnpm run typecheck && pnpm run lint && pnpm run test`). It
> blocks on failure. The sequence of gate results across commits is an audit trail of
> system quality over time. This is the simplest continuous evaluation pattern:
> automated checks that run on every change and produce a binary result. Extending this
> to LLM-specific evals requires only adding model-specific checks to the gate, with the
> same blocking semantics.

### The Continuous Evaluation Loop

Continuous evaluation is a loop, not a one-time setup:

```
Monitor production -> Detect anomaly -> Investigate
    -> Update eval dataset -> Re-evaluate -> Adjust system
    -> Monitor production -> ...
```

Each cycle should update the eval suite to reflect what was learned. A production
incident that reveals a new failure mode should result in new eval cases that test for
that failure mode. A distribution shift that changes the input profile should result
in updated eval datasets that reflect the new distribution.

The eval suite is a living artifact. It grows as the team learns. It changes as the
domain shifts. If the eval suite looks the same six months after deployment as it did
at deployment, something is wrong - either the team is not monitoring production, or
the team is monitoring but not updating the evals.

### Practical Implementation

For teams starting continuous evaluation, a minimal setup:

1. **Scheduled eval runs** - Run the full eval suite weekly against the production model.
   Compare results to the deployment baseline. Alert on regressions beyond the confidence
   interval.

2. **Output sampling** - Sample 1-5% of production outputs. Run lightweight quality
   checks (format compliance, length bounds, refusal detection). Flag anomalies for
   human review.

3. **Incident-driven eval updates** - When a production incident involves the LLM
   component, add the triggering input (or a representative synthetic version) to the
   eval dataset. This is the incident-to-eval pipeline.

4. **Quarterly eval review** - Review the full eval suite quarterly. Are the evals
   still measuring the right things? Has the product changed? Has the user population
   changed? Has the model changed? Update as needed.

This is not comprehensive. It is the minimum viable continuous evaluation practice. As
the team matures, the monitoring becomes more sophisticated, the sampling becomes more
targeted, and the feedback loop becomes faster.

> **AGENTIC GROUNDING:** Continuous evaluation matters even more for agent systems than
> for simple model API calls. Agent behaviour is path-dependent: the sequence of tool
> calls, the state accumulated across steps, and the branching logic all create a space
> of possible behaviours that is far larger than the space of possible model outputs.
> A model update that changes the model's preference for one tool over another can
> cascade through the agent's behaviour in ways that a single-turn eval would never
> catch. Continuous evaluation of agent systems must monitor not just the final output
> but the intermediate steps: tool call patterns, error recovery attempts, and state
> transitions.

---

## 8. Challenges

*Estimated time: 45-60 minutes total*

These challenges ask you to design organisational artifacts, not write code. They
are exercises in eval governance and planning. The deliverables are documents that a
team could adapt for real use.

---

### Challenge 1: Design an Eval Roadmap

*Estimated time: 20 minutes*
*Type: Design*

A team is deploying an AI-assisted code review system. The system reviews pull requests,
identifies potential bugs, suggests improvements, and checks for security
vulnerabilities. The team has never built LLM evals before.

Design an eval roadmap covering the first two quarters. For each eval:

- Name the eval
- State what construct it measures
- Estimate the dataset size needed
- Specify the scorer type (binary, rubric, LLM-as-judge, expert review)
- Assign a priority (P0/P1/P2/P3)
- Justify the priority using risk and frequency analysis

Your roadmap should include at least 6 evals across at least 2 priority levels.

**Deliverable:** A prioritised eval roadmap document in the format shown in Section 4.

**Design constraints:**
- The team has 2 engineers who can spend 20% of their time on eval work
- The system supports Python, JavaScript, and Go
- The team has access to 500 historical PRs with human reviewer comments
- The model is accessed via API (provider updates are not under the team's control)

**Evaluation criteria:** Does the roadmap prioritise risk over convenience? Does each
eval have a clear construct? Are the priorities justified, not just asserted? Is the
scope realistic for the available resources?

<details>
<summary>Design guidance</summary>

Start with the question: "What is the most expensive failure this system can produce?"
That failure determines your P0 eval.

Then ask: "What is the most frequent failure this system produces?" That determines
your P1 eval.

For a code review system, consider:
- False positives (flagging non-issues) destroy trust
- False negatives (missing real bugs) create risk
- Harmful suggestions (suggesting code that introduces bugs) are worse than no suggestion
- Security vulnerability detection is high-risk, low-tolerance
- Explanation quality affects whether developers act on suggestions

Your 500 historical PRs are a dataset starting point, but they need labelling. Budget
time for that in your roadmap.

The two engineers at 20% each give you roughly 3 person-days per week. A basic eval
takes 3-5 days to build. A complex eval takes 2-3 weeks. Plan accordingly.

</details>

---

### Challenge 2: Write an Eval Ownership Document

*Estimated time: 15 minutes*
*Type: Design*

For three evals from the system described in Challenge 1, write an eval ownership
document. For each eval, define:

- The maintenance owner (who keeps it running)
- The content owner (who updates the dataset)
- The regression investigator (who investigates when scores drop)
- Review triggers (what events prompt a re-examination)
- Escalation path (what happens at different severity levels)
- Scheduled review cadence

**Deliverable:** An eval ownership document in the YAML format shown in Section 3.

**Design constraints:**
- The team has 4 engineers: Alice (ML focus), Bob (backend), Carol (security), Dave
  (frontend)
- Alice has the most eval experience
- Carol has domain expertise in security vulnerability patterns
- The system handles code in 3 languages

**Evaluation criteria:** Does each eval have a clear, named owner (not "the team")?
Are the review triggers specific events, not vague timelines? Does the escalation path
distinguish between minor regressions and critical failures? Is the ownership
distribution realistic (not everything assigned to Alice)?

<details>
<summary>Design guidance</summary>

The temptation is to assign everything to Alice because she has the most eval
experience. Resist this. Alice is a single point of failure. If she leaves, the entire
eval suite is unowned.

Better: Alice owns the most complex eval and mentors Bob on a second eval. Carol owns
the security eval because she has the domain expertise. Dave owns a simpler eval to
build his capacity.

Review triggers should be concrete: "model provider announces an update" is specific.
"Periodically" is not. "Quarterly" is specific enough.

Escalation paths should distinguish severity. A 2% score drop is noise. A 10% score
drop warrants investigation within a day. A 20% score drop warrants blocking the next
deployment.

</details>

---

### Challenge 3: Design a Continuous Evaluation Plan

*Estimated time: 15 minutes*
*Type: Design*

The AI-assisted code review system from Challenges 1 and 2 has been deployed for 3
months. Design a continuous evaluation plan that covers:

- What to monitor and how often
- How to detect model quality drift
- How to detect distribution shift in user inputs
- What thresholds trigger investigation
- How to update the eval suite based on production findings
- How production incidents feed back into the eval dataset

**Deliverable:** A continuous evaluation plan document.

**Design constraints:**
- The system processes approximately 200 PRs per day
- The model provider has updated the model twice in the 3 months since deployment
- Users have started submitting PRs in Rust, which was not in the original eval dataset
- One production incident occurred: the system suggested removing an important null check

**Evaluation criteria:** Does the plan address all three monitoring categories (model
quality, distribution shift, emerging failure modes)? Are the monitoring frequencies
realistic given the constraints? Does the plan include a feedback loop from production
to eval dataset? Does it address the Rust language gap specifically?

<details>
<summary>Design guidance</summary>

The Rust language gap is a distribution shift signal. Your eval dataset covers Python,
JavaScript, and Go. Users are now sending Rust code. This means your eval scores
overestimate production quality because they do not measure performance on a language
the system now handles in production.

The null check incident is a single data point, but it represents a failure mode
category: harmful suggestions. Your continuous evaluation plan should include this
incident's input (or a synthetic version) in the eval dataset and should monitor for
similar patterns.

For a system processing 200 PRs per day, sampling 5% gives you 10 PRs per day for
quality monitoring. That is enough for lightweight automated checks but too few for
full LLM-as-judge scoring. Budget the compute accordingly.

The two model provider updates in 3 months suggest you should expect updates roughly
every 6 weeks. Your monitoring should detect quality changes within 1-2 days of a model
update, which means daily or twice-weekly eval runs, not monthly.

</details>

---

## 9. Key Takeaways

Before you consider this bootcamp complete, you should be able to answer these
questions without looking anything up:

1. Why is individual eval skill insufficient without team-level eval practice? What
   happens to evals built by a single practitioner when that person leaves?

2. What are the four steps for introducing eval discipline to a team, in order?
   Why does that order matter?

3. What does an eval review check? Name at least four dimensions from the eval
   review checklist.

4. What are the three dimensions of eval ownership? Why does "everybody owns it"
   produce worse outcomes than explicit individual assignment?

5. How do you prioritise which evals to build first? What makes a P0 eval different
   from a P2 eval?

6. When should you use a published eval from a registry, and when should you build
   custom? Give a concrete example of each.

7. What is the relationship between eval results and deployment decisions? Why are
   eval results evidence rather than decisions?

8. What are the three categories of continuous evaluation monitoring? Give an example
   of each.

9. How does the eval suite change over time? What is wrong if the eval suite looks
   the same six months after deployment as it did at deployment?

10. Across all nine steps of this bootcamp: what is the through-line from eval
    epistemology (Step 1) to eval culture (Step 9)? How does each step depend on the
    ones before it?

---

## 10. Recommended Reading

- **"Challenges in Evaluating AI Systems"** - Deep Ganguli, Nicholas Schiefer, Marina
  Favaro, Jack Clark (Anthropic, October 2023). The single most relevant published
  document for this step. Documents what makes evals hard, what makes eval culture
  hard, and provides real-world examples of eval failures at a frontier AI lab. The BBQ
  benchmark example alone is worth the read.
  https://www.anthropic.com/research/evaluating-ai-systems

- **Anthropic Responsible Scaling Policy (v2)** - October 2024. The most detailed
  published example of how eval results connect to governance decisions. The framework
  of Capability Thresholds and Required Safeguards shows how evals feed deployment
  decisions at the organisational level.
  https://www.anthropic.com/news/announcing-our-updated-responsible-scaling-policy

- **METR Common Elements Report** - December 2025. Cross-company analysis of 12 frontier
  safety policies. Documents how the industry handles eval timing, frequency, and
  governance. The "Timing and Frequency of Evaluations" section directly informs
  continuous evaluation practice.
  https://metr.org/common-elements

- **Inspect AI Documentation** - UK AI Security Institute. Both the framework
  documentation (https://inspect.ai-safety-institute.org.uk/) and the community eval
  registry (https://ukgovernmentbeis.github.io/inspect_evals/) are practical resources
  for eval sharing and reuse.

- **Inspect Evals Contributing Guide** - If you build evals worth sharing, this is
  how to contribute them back.
  https://ukgovernmentbeis.github.io/inspect_evals/contributing/

- **The Swiss Cheese Model** - James Reason (1990). "Human Error." Cambridge University
  Press. The original model for layered defenses, directly applicable to understanding
  why multiple evals provide better coverage than a single eval. Not LLM-specific,
  but the framework is directly transferable.

---

## 11. What to Read Next

This is the final step of the Evaluation & Adversarial Testing Bootcamp.

If you have worked through all nine steps, you now have the conceptual framework (what
evals measure and how they can mislead), the technical skills (dataset design, scoring,
infrastructure, adversarial methods), and the organisational knowledge (culture, process,
governance) to build and maintain an evaluation practice for LLM-powered systems.

The through-line across all nine steps is this: evaluation is a measurement discipline,
not a compliance exercise. It starts with understanding what measurements can and cannot
tell you (Step 1). It builds through the craft of designing those measurements well -
datasets that represent reality (Step 2), scorers that are calibrated and defensible
(Step 3), evaluation approaches that account for agent complexity (Step 4), and
infrastructure that makes evaluation sustainable (Step 5). It extends through adversarial
methods that test what standard evals miss (Step 6) and safety-critical evaluation that
connects to governance (Step 7). It matures through honest communication of what evals
found and what they did not find (Step 8). And it reaches its full form only when
evaluation becomes a team practice with ownership, process, and continuity (Step 9).

No single step is sufficient. No single step is dispensable.

**Where to go from here:**

- If you have not completed **Bootcamp I** (Agent-Native Engineering), the substrate
  knowledge there (processes, shells, filesystems, networking, containers) is the
  foundation that eval infrastructure runs on.

- If you have not completed **Bootcamp II** (LLM fundamentals), the model internals
  and governance content there provides the context for understanding why LLM evaluation
  is different from traditional software testing.

- If you have not completed **Bootcamp III** (Data and statistical reasoning), the
  statistical foundations there (distributions, hypothesis testing, experimental design)
  underpin the measurement discipline that evaluation requires.

- If you have completed all four bootcamps, the next step is practice: build evals for
  a real system, run them in production, iterate on what they catch and what they miss.
  The bootcamp gave you the framework. Production gives you the data. The combination
  is where the skill develops.

The field is moving fast. The tools, the techniques, and the organisational practices
described in this bootcamp will evolve. The measurement discipline - understanding what
you are measuring, why you are measuring it, and what the measurement can and cannot
tell you - will not. That discipline is the durable skill.

