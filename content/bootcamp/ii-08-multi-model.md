+++
title = "Multi-Model Verification Strategies"
date = "2026-03-10"
description = "N-version programming for LLMs. Convergence, divergence, triangulation. The monoculture problem."
tags = ["multi-model", "verification", "triangulation", "bootcamp"]
step = 8
tier = 3
estimate = "3-4 hours"
bootcamp = 2
+++

Step 8 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This is Step 8

Step 6 built a verification pipeline - the Swiss Cheese Model with multiple independent
layers, each with holes, aligned so no single failure passes through all layers. Step 7
introduced L10 and L11: multi-agent (same model) and cross-model (different model families).
The critical observation from Step 7 was that L10 agreement is consistency, not validation.
Three instances of the same model agreeing is one observation reported three times.

This step operationalises that observation. The question is no longer theoretical - "are
same-model agents independent?" - but practical: "how do I build a verification workflow
that actually provides independent evidence about code quality, security, and correctness?"

The answer comes from an unexpected source. In 1985, Avizienis formalised N-version
programming for safety-critical software: have independent teams implement the same
specification, then vote on the output. The same principle applies to LLM verification, with
a critical modification. LLM "teams" from the same model family are not independent. They
share weights, training data, RLHF alignment, and systematic blind spots. Independence
requires crossing the model family boundary - moving from L10 to L11.

The cost is modest. Running three model families on the same review task costs roughly 3x a
single review. The asymmetric payoff justifies it: low cost when nothing is found, high
value when something is.

> **FIELD MATURITY: FRONTIER.** N-version programming (Avizienis 1985) is established in
> safety-critical systems with 40 years of deployment history. IV&V is standard practice
> in aerospace, defence, and regulated industries (IEEE 1012, NASA IV&V Facility).
> Multi-model comparison is discussed informally but lacks published structured pipelines.
> Novel from this project: the structured YAML format for ensemble review, the
> triangulation synthesis pattern, the staining concept applied to code review, and the
> observation that unanimous same-model agreement has the evidential weight of one
> observation (the "unanimous chorus" anti-pattern from the slopodar).

The goal: build a multi-model verification practice that provides genuinely independent
evidence, uses structured formats for systematic comparison, and is honest about its
limitations - bounded independence, not mathematical proof.

---

## Table of Contents

1. [The Monoculture Problem](#1-the-monoculture-problem) (~30 min)
2. [N-Version Programming Applied](#2-n-version-programming-applied) (~25 min)
3. [The Multi-Model Ensemble Review Pattern](#3-the-multi-model-ensemble-review-pattern) (~35 min)
4. [When Models Disagree](#4-when-models-disagree) (~20 min)
5. [The Adversarial Review Pattern](#5-the-adversarial-review-pattern) (~25 min)
6. [Model Selection per Task Type](#6-model-selection-per-task-type) (~20 min)
7. [Limitations and Bounded Independence](#7-limitations-and-bounded-independence) (~25 min)
8. [Challenges](#8-challenges) (~60-90 min)
9. [Key Takeaways](#9-key-takeaways)
10. [Recommended Reading](#10-recommended-reading)
11. [What to Read Next](#11-what-to-read-next)

---

## 1. The Monoculture Problem

*Estimated time: 30 minutes*

Most teams using AI for code review run one model. Some teams, aware that a single review
might miss things, run the same model multiple times. An organisation might have eleven
Claude agents review the same pull request and report that "11/11 agents agree the code is
correct." This sounds like overwhelming evidence. It is not.

The intuition is agricultural, not computational. A monoculture is a field planted with a
single crop variety. Every plant has the same genetics, the same disease susceptibility,
the same pest vulnerability. If a blight can kill one plant, it can kill every plant in the
field. Diversity is not a luxury - it is the defence against correlated failure.

LLM model families are monocultures. Every instance of Claude shares the same weights (L0),
the same tokenisation (L1), the same attention architecture (L2), the same RLHF alignment,
and the same training data distribution. When eleven Claude instances review a piece of
code, they are eleven plants of the same variety. They will find the same bugs. They will
miss the same bugs. The bugs they miss are invisible not because they are hard to find, but
because the model's training distribution does not equip it to see them.

### Precision vs Accuracy

The distinction that makes this concrete is from measurement science. **Precision** is how
consistently a measurement system produces the same reading. **Accuracy** is how close that
reading is to the true value. A bathroom scale that always reads 73.2 kg when the true
weight is 77.0 kg is highly precise and inaccurate. Running it ten times gives you ten
readings of 73.2 kg. Additional measurements do not fix systematic error.

Same-model multi-agent review increases precision: the outputs converge. It does not
increase accuracy: the systematic blind spots remain. All eleven agents will consistently
identify the same surface-level issues. All eleven will consistently miss the same deep
structural problems.

This is L10 in the layer model: "Same model does not mean independent; precision without
accuracy. Unanimous agreement is consistency, not validation. Systematic bias compounds,
not cancels."

### The Unanimous Chorus

The project's anti-pattern taxonomy (the slopodar) names this pattern: **unanimous chorus**.
The trigger is multi-agent agreement cited as evidence when all agents share a model family.
The detection heuristic: when you see "N/N agreement," check whether the agents share a
model family. If they do, the N-fold agreement has the evidential weight of one observation.

```yaml
# Anti-pattern: unanimous chorus
finding: "Security review complete. 5/5 agents agree: no vulnerabilities found."
problem: All 5 agents are Claude Sonnet 4
actual_evidence: One model family's assessment, reported 5 times
fix: Run at least one agent from a different model family
```

### Self-Review is the Degenerate Case

The most common form of same-model review is an agent reviewing its own output. When an
agent says "I have reviewed my work and confirmed it is correct," this is the N=1 ensemble.
The review shares every bias, every blind spot, and every training distribution gap of the
generation step. Self-review catches typos and obvious errors. It does not catch systematic
failures.

> **AGENTIC GROUNDING:** When you see an agent declare "I have verified my output," treat
> this as a consistency check, not a correctness check. The diagnostic question is not "did
> the agent find errors?" but "could the agent have found the class of error you are worried
> about?" If the error class involves the model's systematic blind spots, same-model review
> will not catch it regardless of how many instances you run.

---

## 2. N-Version Programming Applied

*Estimated time: 25 minutes*

The monoculture problem is not new. Software engineering encountered the same issue in
safety-critical systems decades before LLMs existed.

### The Original Pattern

In 1977, Chen and Avizienis proposed **N-version programming**: have N independent teams
implement the same specification, then use a decision algorithm (typically majority vote) to
select the output. If implementations are developed independently, the probability of
identical faults in two or more versions is very low. A flight control system with three
independently developed implementations can tolerate one faulty version because the other
two will outvote it.

The mature formulation (1985) was deployed in flight control software, railway switching
systems, electronic voting systems, and zero-day exploit detection.

> **HISTORY:** Avizienis's work at UCLA grew out of fault-tolerant hardware design. The
> insight was that redundancy principles protecting against hardware failures - triple
> modular redundancy, voting circuits - could be applied to software. The critical
> difference: hardware failures tend to be random (a transistor fails), while software
> failures tend to be systematic (a logic error). Random failures cancel with redundancy.
> Systematic failures do not - unless the redundant implementations are genuinely
> independent.

### The Independence Problem

In 1986, Knight and Leveson challenged the central assumption. They had N independent teams
implement the same specification and measured whether their failures were statistically
independent. The result: "the assumption of independence of failures in N-version programs
failed statistically." Different teams made correlated mistakes because they shared the same
specification, similar educational backgrounds, and common algorithmic approaches.

This does not mean N-version programming is useless. It means the protection it provides is
less than the theoretical maximum. If teams are 100% independent, it eliminates correlated
failure entirely. If 0% independent, it provides no protection at all.

The same spectrum applies to LLM model families. Different families (Claude, GPT, Gemini,
Llama) are not 100% independent - they share training data overlap from Common Crawl,
Wikipedia, arXiv, and GitHub. They are also not 0% independent - they have different
architectures, different RLHF approaches, different proprietary training data, and different
alignment philosophies. The independence is partial and bounded.

### The LLM Application

| N-Version Programming | LLM Multi-Model Review |
|----------------------|----------------------|
| Independent teams | Independent model families |
| Same specification | Same review prompt |
| Majority vote | Convergence/divergence analysis |
| Shared spec = correlated bugs | Shared training data = correlated blind spots |
| Works for implementation bugs, not spec bugs | Works for model-specific biases, not prompt bugs |

The key difference: in traditional N-version programming, the decision algorithm votes.
In LLM verification, the output is natural language that may be partially right, partially
wrong, or right for the wrong reasons. The "decision algorithm" is not a vote but a
synthesis that examines convergence and divergence. This shift from voting to synthesis is
covered in Section 4.

> **AGENTIC GROUNDING:** When building a multi-model review pipeline, do not implement
> majority voting ("2 out of 3 say it is correct, so it is correct"). Implement
> convergence/divergence analysis. The third model disagreeing tells you something different
> and often more important than the two that agree. The disagreement locates the boundary
> between what models can assess from their training distributions and what requires human
> judgment.

---

## 3. The Multi-Model Ensemble Review Pattern

*Estimated time: 35 minutes*

The practical operationalisation of multi-model verification is a structured pipeline with
three phases: independent review, structured output, and synthesis.

### The Pipeline

Three independent models review the same code snapshot. Each produces output in a
consistent structured format (YAML). A synthesis step compares the reviews to identify
convergence and divergence. Human attention goes to the divergence points.

```
  Code Under Review
        |
  +-----+-----+-----+
  |           |           |
Model A   Model B   Model C
  |           |           |
YAML      YAML      YAML
  |           |           |
  +-----+-----+-----+
        |
  Synthesis (convergence / divergence)
        |
  Human Attention (focused on divergence)
```

### The Structured YAML Review Format

The schema enforces structure without constraining the reviewer's assessment. Each model
fills in the same fields, enabling field-by-field comparison.

```yaml
review:
  model: "claude-opus-4"
  model_family: "anthropic"       # Family for independence tracking
  timestamp: "2026-03-10T14:22:00Z"
  target: "lib/bouts/scoring.ts"

  findings:
    - id: "F001"
      severity: "high"            # critical / high / medium / low / info
      category: "logic"           # logic / security / performance / style / architecture
      location: "lib/bouts/scoring.ts:42-58"
      summary: "Score accumulator resets on each iteration"
      detail: |
        The loop at line 42 initialises totalScore = 0 inside the for-loop body.
        Each iteration overwrites the accumulator. Returns only the final round's score.
      confidence: "high"          # high / medium / low
      evidence: "Line 42: `let totalScore = 0` inside `for (const round of rounds)`"
      suggested_fix: "Move `let totalScore = 0` before the for-loop"

  summary:
    total_findings: 1
    by_severity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 }
    overall_assessment: "Accumulator bug produces incorrect results for multi-round bouts."
    areas_not_covered: "Performance, credits integration, SPEC.md alignment."
```

Four deliberate design choices in this schema:

**`model_family` is explicit.** Every review declares its family. Three reviews all marked
`"anthropic"` tells the synthesis step this is L10 (consistency check), not L11 (independent
evidence).

**`confidence` is per-finding.** A model may be highly confident about a logic error it can
trace and low-confidence about an architectural concern. Per-finding confidence enables
weighted synthesis.

**`areas_not_covered` is mandatory.** What the reviewer did NOT assess prevents the
assumption that silence means approval. Silence on security is not evidence of security.

**`evidence` is mandatory.** Every finding must cite specific code. If the evidence field
points to code that does not contain the claimed issue, the finding is a false positive
regardless of how reasonable the summary sounds.

> **AGENTIC GROUNDING:** The schema is the control mechanism. A loosely structured prompt
> ("review this code for bugs") produces free-form text that is hard to compare across
> models. A schema-constrained prompt ("fill in this YAML structure") produces outputs
> that can be compared field-by-field. The schema does not constrain what the reviewer
> finds - it constrains how findings are reported.

### The Review Prompt

The prompt must: (1) provide the code in full, (2) provide and require the YAML schema,
(3) specify review scope, (4) state what context the model does NOT have, and (5) instruct
the model to report what it did NOT review.

```
You are performing a code review. Output findings as YAML conforming to the schema
provided. Every finding must include specific line-number evidence. Do not speculate
about code you cannot see. State areas you could not assess in areas_not_covered.

Context you DO have: The complete source file. TypeScript, Next.js, Drizzle, Neon Postgres.
Context you DO NOT have: Product specification. Other codebase files. Historical context.
Review scope: logic correctness, security, error handling.

[YAML SCHEMA]
(insert schema)

[CODE TO REVIEW]
(insert code)
```

The prompt tells the model what it does not know, reducing confabulated findings based on
assumptions about unseen code.

### The Synthesis Step

The synthesis step takes N structured YAML reviews and produces a convergence/divergence
analysis. The core logic groups findings by code location and classifies them:

```python
#!/usr/bin/env python3
"""Minimal multi-model review synthesiser."""
import sys
import yaml
from collections import defaultdict


def synthesise(reviews: list[dict]) -> dict:
  all_locations = defaultdict(list)
  families = set()

  for review in reviews:
    r = review.get("review", {})
    family = r.get("model_family", "unknown")
    families.add(family)
    for finding in r.get("findings", []):
      loc = finding.get("location", "unknown")
      all_locations[loc].append({
        "family": family,
        "severity": finding.get("severity"),
        "summary": finding.get("summary"),
      })

  convergent, divergent, unique = {}, {}, {}
  for loc, findings in all_locations.items():
    reporting = {f["family"] for f in findings}
    if len(reporting) == len(families):
      convergent[loc] = findings
    elif len(reporting) == 1:
      unique[loc] = findings
    else:
      divergent[loc] = findings

  return {
    "independence": "cross-model (L11)" if len(families) > 1 else "same-model (L10)",
    "convergent_count": len(convergent),
    "divergent_count": len(divergent),
    "unique_count": len(unique),
    "convergent": convergent,
    "divergent": divergent,
    "unique": unique,
  }


if __name__ == "__main__":
  reviews = [yaml.safe_load(open(p)) for p in sys.argv[1:]]
  print(yaml.dump(synthesise(reviews), default_flow_style=False))
```

```bash
python3 synthesise.py review-claude.yaml review-gpt4.yaml review-gemini.yaml
```

The output classifies every finding as:
- **Convergent:** All families flagged it. High confidence the finding is real.
- **Divergent:** Some families flagged it. Human attention goes here.
- **Unique:** One family only. May be noise, or may be a family-specific insight.

The `independence` field is the automated honesty check. If all reviews come from the same
family, the output states "same-model (L10)" - convergence is consistency, not validation.

> **AGENTIC GROUNDING:** The synthesis step is the value proposition. Without it, a human
> must manually compare three reports. With it, the human reads: "all three agreed on the
> SQL injection at line 71; only Claude flagged the accumulator reset." That single sentence
> tells the human exactly where to look.

---

## 4. When Models Disagree

*Estimated time: 20 minutes*

Most multi-model pipeline designers focus on convergence: "if all three agree, the finding
is real." This is useful but misses the more valuable signal. Divergence - where models
disagree - is more informative than convergence.

### The Divergence Taxonomy

**Full convergence.** All families flag the same finding with similar severity. The issue is
visible from multiple training distributions - typically a clear defect rather than a
judgment call.

**Partial divergence.** Two families converge; one does not flag it. This tells you one of
three things: (1) the finding is real but one model's training data does not equip it to
see it, (2) the finding is a false positive from two models sharing a common bias, or (3)
the finding is in a grey area where reasonable reviewers disagree - a taste-required
judgment that automated verification cannot resolve. All three interpretations are
actionable.

**Full divergence.** All three families flag different things or disagree on severity. The
question is ambiguous, the domain lacks strong training data, or the assessment is genuinely
taste-required. Full divergence says: "A human must evaluate this."

### Example: Divergence in Practice

Three reviews of an authentication module:

```yaml
# Claude: localStorage XSS (high), token refresh race condition (medium)
# GPT-4:  localStorage XSS (high), magic number 3600 (low)
# Gemini: localStorage XSS (critical), missing CSRF on refresh (medium)
```

| Finding | Claude | GPT-4 | Gemini | Classification |
|---------|--------|-------|--------|---------------|
| localStorage XSS (line 34) | high | high | critical | **Convergent** |
| Token refresh race (line 67) | medium | - | - | **Unique** (Claude) |
| Magic number (line 12) | - | low | - | **Unique** (GPT-4) |
| CSRF on refresh (line 89) | - | - | medium | **Unique** (Gemini) |

A single-model review finds the localStorage issue plus one other. The multi-model approach
found all four. The human's job is now focused: verify whether the race condition and CSRF
issue are real. Two focused investigations instead of a full code review.

> **AGENTIC GROUNDING:** Resist the instinct to dismiss unique findings as noise. A finding
> flagged by only one family could be a false positive, a true positive only one model's
> training equips it to see, or a grey area needing human judgment. The asymmetric payoff
> favours investigation: the cost of checking is low, and the cost of missing a real
> finding is high.

---

## 5. The Adversarial Review Pattern

*Estimated time: 25 minutes*

Multi-model ensemble review asks three models the same open question: "what is wrong with
this code?" The adversarial review pattern asks a different question: "given this specific
diagnostic, what does this code reveal?"

### Staining

The term **staining** comes from laboratory diagnostics. A biologist applies a chemical
stain to a tissue sample. The stain does not change the tissue - it makes specific
structures visible that were invisible under normal light. Different stains reveal different
structures.

Adversarial code review works the same way. The code does not change. The diagnostic
changes. A security-focused diagnostic reveals security-relevant structures. A
performance-focused diagnostic reveals performance-relevant structures. The slopodar's
anti-pattern taxonomy reveals specific agent-generated defect patterns.

An adversarial review differs from standard review in three ways: (1) it specifies the
diagnostic - what patterns to look for, (2) it is read-only - no fixes, only findings, and
(3) it applies one lens per pass.

> **HISTORY:** Red teaming originated in military strategy - a "red team" argues the
> adversary's position to test the blue team's assumptions. Adopted by security
> (penetration testing), reliability engineering (FMEA), and AI safety teams. The common
> principle: the reviewer's job is to find what the author missed, not to confirm what
> the author believes.

### Example: Adversarial Review with Diagnostic

```
You are performing an adversarial review. Look specifically for these anti-patterns:

1. RIGHT ANSWER, WRONG WORK: Test passes via a different causal path than claimed.
   Can you change the implementation to break claimed behaviour while keeping test green?

2. PHANTOM LEDGER: Audit trail does not match actual operation. Trace value from
   computation through to audit record - same variable or independently computed?

3. SHADOW VALIDATION: Validation covers simple cases but the critical route is
   hand-rolled. After introducing a validation pattern, does the most complex route use it?

For each finding, cite specific code lines and which anti-pattern it matches.
If you find no instances, state that explicitly. Do not report other categories.

[CODE TO REVIEW]
```

### Building Diagnostic Rulesets

| Ruleset | What it Stains For | Example Patterns |
|---------|-------------------|-----------------|
| Security (OWASP-aligned) | Injection, auth flaws, data exposure | SQL injection, XSS, CSRF |
| Agent code defects | AI-generated code patterns | Right answer wrong work, phantom ledger, mock castle |
| Architecture | Coupling, domain violations | Cross-domain imports, circular dependencies |
| Compliance | Regulatory requirements | PII handling, audit logging, data retention |

Each ruleset is a different stain. The adversarial reviewer applies one per pass. This
keeps the model focused and reduces generic, ungrounded findings.

### Combining Both Patterns

The most thorough approach: multiple models, each applying the same diagnostic. This
provides cross-model independence (L11) and diagnostic focus. Expensive (3 models x N
passes), justified for security audits and critical path code. For routine review, a single
multi-model pass with an open-ended prompt is sufficient.

> **AGENTIC GROUNDING:** The diagnostic is the control, not the model. Two models applying
> the same diagnostic produce more similar output than two models applying different
> diagnostics. Build rulesets from observed failures in your codebase, not from generic
> checklists. The slopodar was built from patterns caught in the wild over 200+ sessions -
> it finds patterns that generic checklists do not cover.

---

## 6. Model Selection per Task Type

*Estimated time: 20 minutes*

Not all models are appropriate for all review tasks. Selection criteria should match task
requirements, not default to the most expensive model.

### Three Selection Axes

**Reasoning depth.** Tasks requiring multi-step logical reasoning - tracing data flow,
evaluating edge cases, assessing consistency guarantees - need reasoning models (Claude
Opus, GPT o-series, Gemini deep think). The inference cost buys analysis faster models
cannot perform.

**Speed and cost.** Classification tasks - style compliance, docstring presence, domain
boundary checks - are pattern-matching where smaller models (Haiku, GPT-4o-mini, Gemini
Flash) perform comparably at a fraction of the cost.

**Family diversity.** For adversarial review, the primary criterion is different families.
Claude + GPT + Gemini provides three training distributions. Claude Opus + Sonnet + Haiku
provides three capability tiers from one distribution - useful for cost comparison, not
for independence.

### Selection Matrix

| Task Type | Recommended Approach |
|-----------|---------------------|
| Logic correctness | One reasoning model per family, 2-3 families |
| Security audit | 3 families, security diagnostic, structured YAML |
| Style compliance | One fast model, single pass |
| Architecture review | 2-3 reasoning models from different families |
| Routine PR review | One reasoning + one fast model, different families |

### Cost-Performance

Approximate costs for reviewing a 500-line file (2000 tokens in, 1000 out):

| Model Tier | Cost per Review | Use Case |
|-----------|----------------|----------|
| Frontier reasoning | $0.03-0.15 | Complex logic, security |
| Mid-tier | $0.005-0.03 | General review |
| Fast | $0.001-0.005 | Classification, style |

A three-model review using mid-tier models costs $0.01-0.09 per file. For a 50-file PR:
$0.50-4.50. The cost of a security vulnerability reaching production is orders of magnitude
higher.

> **SLOPODAR:** The **monoculture analysis** anti-pattern: "Who checked this? If the same
> system that produced it also checked it, the check is not independent." Minimum bar: two
> distinct model families. Three is the recommended default. Five provides diminishing
> returns.

---

## 7. Limitations and Bounded Independence

*Estimated time: 25 minutes*

This section is as important as the method sections. Multi-model verification is an
engineering heuristic, not a statistical guarantee.

### What It Provides

**Reduced correlated blind spots.** Crossing model families means some blind spots are
compensated by other families. The net effect: fewer correlated blind spots than any single
model, but not zero.

**Focused human attention.** Instead of reviewing all code equally, the human focuses on
divergence points. Not a replacement for human review - a triage mechanism.

**Explicit uncertainty.** Divergence surfaces disagreement. A single-model review produces
confident output even when wrong. Multi-model review makes uncertainty visible.

### What It Does Not Provide

**Statistical independence.** Knight and Leveson (1986) demonstrated that N-version
programming does not achieve statistical independence of failures. LLM families share
training data (Common Crawl, Wikipedia, GitHub), evaluation benchmarks, and collective
biases about "good code." Cross-model review reduces correlation. It does not eliminate it.

**Coverage of unknown unknowns.** If all families share a blind spot, multi-model review
will not find it. The monoculture is at the level of "LLMs trained on internet text" rather
than one specific family. The defence is human review (L12), not more models.

**A substitute for domain expertise.** Multi-model review finds bugs visible in the code:
logic errors, security vulnerabilities, type mismatches. It does not find bugs requiring
business context: whether the scoring algorithm matches the specification, whether the
credit amount is correct. These are taste-required judgments.

**Proof of correctness.** Three models agreeing does not prove correctness. If the code
contains a subtle timing bug none of the three models have training data for, all three
will miss it with high confidence.

### The Independence Spectrum

```
No independence                          Full independence
|------|------------|-----------|------|
0%    Self-review   Same-model  Cross-   Human
      (N=1)        ensemble    model    + LLM
                   (L10)      (L11)    (L12+L11)
```

- **Self-review (0%):** Zero additional information.
- **Same-model ensemble (~10-20%):** Some variation from sampling, same systematic biases.
- **Cross-model ensemble (~40-70%):** Substantial but bounded. Shared training data limits
  the upper bound.
- **Human + LLM (~80-95%):** Genuinely independent information from domain knowledge and
  project history. The human also has blind spots (fatigue, cognitive load) that LLMs do
  not share.

The percentages are illustrative, not measured. No published research quantifies cross-model
independence. The ordering is defensible; the exact values are unknown.

### Diminishing Returns

Going from one family to two is a large gain. Two to three is meaningful. Three to four is
small. Four to five is near-zero. Three families is the practical sweet spot: enough
diversity for meaningful triangulation, not so many that synthesis overhead exceeds
information gain.

> **HISTORY:** IV&V (Independent Verification and Validation) as codified in IEEE 1012
> recognises bounded independence. The "independent" in IV&V means performed by a
> disinterested third party. But even IV&V acknowledges that independence is structural,
> not absolute. The independent verifier shares the same specification, domain conventions,
> and industry standards. The key engineering judgment is not "is this independent?"
> (binary) but "how independent is this, and is the degree sufficient for the stakes?"
> (continuous).

### The Honest Position

Multi-model verification is one Swiss Cheese slice. Its holes:

- Misses bugs that all families share blind spots for
- Misses bugs requiring domain context the models lack
- Generates false positives that waste human attention
- Provides false security when all models converge on an incorrect assessment

The defence is not making this layer hole-free. It is aligning it with other layers - the
quality gate, human review, adversarial review, the definition of done - so no single
failure passes through all layers.

If you treat multi-model convergence as proof of correctness, you will eventually ship a
defect all three models missed. If you treat it as one source of evidence among several,
with known limitations, you will use it correctly.

> **AGENTIC GROUNDING:** When reporting results to stakeholders, include limitations
> alongside findings. "Three families converged on zero critical findings" is different
> from "Three families converged on zero critical findings. The review did not cover
> business logic, performance under load, or payment integration. These require domain
> expertise the models do not have." The first implies safety. The second reports evidence
> with stated boundaries.

---

## 8. Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: The Monoculture Demonstration

**Estimated time: 15 minutes**

**Goal:** Demonstrate that same-model agents produce correlated findings by sending the
same review prompt to the same model three times.

Use this code (or a real file from your project):

```typescript
export function calculateScore(rounds: Round[]): number {
  for (const round of rounds) {
    let totalScore = 0;  // Bug: resets inside loop
    totalScore += round.points * round.multiplier;
    if (round.bonus) {
      totalScore += 10;  // Magic number
    }
  }
  return totalScore;  // Returns only last round's score
}

export async function saveScore(userId: string, score: number) {
  const result = await db.query(
    `UPDATE users SET score = ${score} WHERE id = '${userId}'`  // SQL injection
  );
  console.log("Score saved: " + score);  // Console.log in production
  return result;
}
```

Send the same review prompt (with the YAML schema from Section 3) to the same model API
three times with temperature > 0.

**Verification:**
- Compare the three YAML outputs field by field
- Count convergent findings (appear in all three) and divergent findings (1-2 only)
- Expected: 80-95% convergence. Same model reliably finds and misses the same things.

**Extension:** Send the same prompt once to a different model family. Compare its unique
findings against the three same-model runs.

---

## Challenge: Cross-Model Comparison

**Estimated time: 20 minutes**

**Goal:** Compare findings from different model families on the same code to identify
family-specific blind spots.

Send the same review prompt with the YAML schema to at least two different model families
(three if you have access). Use API calls or chat interfaces - format YAML manually if
needed.

**Verification:** Create a comparison table:

```yaml
comparison:
  accumulator_bug:
    claude: "found, high"
    gpt4: "found, high"
    gemini: "found, critical"
    classification: convergent
  sql_injection:
    claude: "found, high"
    gpt4: "found, high"
    gemini: "found, high"
    classification: convergent
  magic_number:
    claude: "not found"
    gpt4: "found, low"
    gemini: "not found"
    classification: unique_to_gpt4
```

Answer: (1) How many convergent findings? (2) How many unique to one family? (3) Did any
family find a real issue the others missed? (4) Did any family report a false positive?

**What you are learning:** Cross-model review finds a superset of what any single model
finds. The unique findings represent the blind spots you would miss with a single model.

---

## Challenge: Convergence Analysis

**Estimated time: 15 minutes**

**Goal:** Given three pre-written reviews, produce a convergence/divergence analysis by
hand.

```yaml
# Review A (anthropic): password == comparison (high), error reveals username vs
#   password (medium), unused crypto import (low)
# Review B (openai): timing attack vulnerability (critical), no rate limiting (medium),
#   dead crypto import (info)
# Review C (google): non-constant-time comparison (high), username enumeration (high),
#   Math.random() for session token (medium)
```

Produce: (1) a convergence/divergence table, (2) the `human_attention` recommendation,
(3) which unique finding is most likely real.

<details>
<summary>Expected Analysis</summary>

| Finding | A | B | C | Classification |
|---------|---|---|---|---------------|
| Timing attack (line 23) | high | critical | high | **Convergent** |
| Error message enumeration (line 45) | medium | - | high | **Divergent** (2/3) |
| Unused import (line 78) | low | info | - | **Divergent** (2/3) |
| No rate limiting (line 60) | - | medium | - | **Unique** (OpenAI) |
| Weak RNG for sessions (line 92) | - | - | medium | **Unique** (Google) |

Human attention: the rate limiting and weak RNG findings. The weak RNG finding is more
likely real - it describes a specific, verifiable code issue. Rate limiting may be
implemented in middleware, not in the handler.

</details>

---

## Challenge: Build a Triangulation Pipeline

**Estimated time: 25 minutes**

**Goal:** Build a working pipeline that sends code to multiple models and synthesises
results.

Write a script that: (1) takes a source file path, (2) constructs a review prompt with the
YAML schema, (3) sends to at least two model APIs (or simulates with saved responses), (4)
saves each YAML response, (5) runs the synthesis to produce convergence/divergence output.

```bash
#!/usr/bin/env bash
# Triangulation pipeline skeleton
SOURCE_FILE="$1"
if [ -z "$SOURCE_FILE" ]; then
  printf 'Usage: triangulate.sh <source-file>\n' >&2
  exit 1
fi

# In production, replace with actual API calls:
# curl -s https://api.anthropic.com/v1/messages ... > review-claude.yaml
# curl -s https://api.openai.com/v1/chat/completions ... > review-gpt4.yaml

printf 'Sending to Model A...\n'
printf 'Sending to Model B...\n'

# Synthesise
python3 synthesise.py review-claude.yaml review-gpt4.yaml
```

**Verification:** Pipeline runs end-to-end. Review files contain valid YAML. Synthesis
correctly classifies findings. The `independence` field correctly reports L10 or L11.

---

## Challenge: Design an Adversarial Diagnostic

**Estimated time: 15 minutes**

**Goal:** Design a custom diagnostic ruleset for a specific domain.

Choose: web authentication, financial calculations, or API endpoint handlers. Write a
diagnostic with at least 5 named patterns:

```yaml
diagnostic:
  name: "Financial Calculations"
  patterns:
    - id: "P001"
      name: "Floating Point Currency"
      detection_heuristic: |
        Number type for money, parseFloat on currency, arithmetic on
        JavaScript Number type representing currency values
      severity_if_found: "high"
      example_trigger: "const total = price * quantity;  // price is a float"
    # ... 4 more patterns
```

**Verification:** Each pattern has a detection heuristic specific enough for a model to
apply it. Test by using it as a review prompt on actual code in that domain.

**What you are learning:** The diagnostic determines review quality more than the model
does. Well-designed diagnostics from observed failures find what generic checklists miss.

---

## 9. Key Takeaways

Before moving on, verify you can answer these without looking anything up:

1. Why does 11/11 same-model agreement have the evidential weight of one observation?

2. What is the difference between L10 and L11? Why is L11 strictly more informative?

3. What did Knight and Leveson (1986) demonstrate about N-version programming?

4. What are the three phases of the multi-model ensemble review pipeline?

5. Why is divergence more informative than convergence? Name the three interpretations of
   a finding flagged by only one family.

6. What is staining in adversarial review? How does it differ from standard review?

7. What is the primary selection criterion for adversarial review models?

8. Name three things multi-model review does NOT provide.

9. Why do diminishing returns set in after three model families?

10. How does multi-model review fit into the Swiss Cheese Model? What holes does this
    layer have?

---

## 10. Recommended Reading

- **Chen, L. and Avizienis, A.** "N-Version Programming: A Fault-Tolerance Approach to
  Reliability of Software Operation." Originally 1977; mature formulation in *Fault-Tolerant
  Computing*, IEEE, 1985/1995. The foundational work on independent implementation as fault
  tolerance.

- **Knight, J.C. and Leveson, N.G.** "An Experimental Evaluation of the Assumption of
  Independence in Multi-Version Programming." *IEEE TSE*, SE-12(1), January 1986. The
  empirical challenge to the independence assumption. Essential for understanding bounded
  evidence.

- **IEEE 1012-2016** "Standard for System, Software, and Hardware Verification and
  Validation." IV&V codified as standard practice.

- **Reason, J.** *Human Error.* Cambridge University Press, 1990. The Swiss Cheese Model.
  Multi-model review is one slice; this book explains the full model.

- **This project: `docs/internal/slopodar.yaml`** - The `monoculture-analysis` and
  `unanimous-chorus` entries. Code patterns (`right-answer-wrong-work`, `phantom-ledger`)
  as examples of adversarial diagnostic rulesets.

---

## 11. What to Read Next

**Step 9: Failure Modes and Recovery** - Multi-model review reduces the probability of
undetected defects but does not eliminate it. Step 9 covers what happens when verification
fails: failure modes specific to agentic systems (context loss, sycophantic drift, stale
reference propagation), recovery protocols (checkpoint recovery, rerun over fix-in-place),
and governance patterns that detect verification failures. Where Step 8 builds a better
defence, Step 9 prepares for when the defence is breached.

