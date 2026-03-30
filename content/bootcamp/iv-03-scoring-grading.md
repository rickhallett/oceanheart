+++
title = "Scoring and Grading Methods"
date = "2026-03-10"
description = "Code-based grading, LLM-as-judge, human grading. Rubric design, grader calibration."
tags = ["evals", "grading", "llm-as-judge", "bootcamp"]
step = 3
tier = 1
estimate = "5-6 hours"
bootcamp = 4
+++

Step 3 of 9 in Bootcamp IV: Evaluation & Adversarial Testing.

---

## Why This Step Exists

You have a dataset (Step 2). You understand what measurement means and what can go wrong
with it (Step 1). Now comes the question that determines whether your eval is worth
anything: how do you grade the output?

The grading method is the bridge between raw model output and a score. If the bridge
is solid, the score tells you something. If broken, the score is noise disguised as
signal. A good eval with a bad grader is a bad eval. Consider a summarisation eval
graded by ROUGE-L: two summaries with identical scores where one is coherent and the
other is garbled word rearrangement. The dataset was perfect. The grader threw away
the information that mattered.

This step covers the full grading hierarchy: code-based grading (deterministic, fast,
limited), LLM-as-judge (flexible, scalable, biased in specific ways), and human
evaluation (irreducible, expensive, the only option when taste is required). The
progression is deliberate: simplest and most reliable first, most expensive last,
calibration at the end because every grader needs to be tested before it is trusted.

The same principle applies at every level: **do not trust the grader. Verify the
grader.** The grader is itself a measurement instrument, and Step 1's lessons about
construct validity, sensitivity, and specificity apply to it directly.

> **FIELD MATURITY: EMERGING** - The grading hierarchy (code > LLM > human) is
> an emerging consensus, articulated clearly by Anthropic's eval documentation and
> reflected in framework design (Inspect AI, OpenAI Evals). The individual methods
> (exact match, rubric-based scoring, inter-rater reliability) are established. The
> specific practices around LLM-as-judge calibration, failure mode mitigation, and
> multi-model grading are still forming. No standard methodology exists for
> validating LLM graders the way standardised testing validates human graders.

---

## Table of Contents

1. [The Grading Hierarchy](#1-the-grading-hierarchy) (~25 min)
2. [Code-Based Grading](#2-code-based-grading) (~45 min)
3. [LLM-as-Judge](#3-llm-as-judge) (~50 min)
4. [LLM-as-Judge Failure Modes](#4-llm-as-judge-failure-modes) (~35 min)
5. [Human Evaluation](#5-human-evaluation) (~35 min)
6. [Scoring Metrics](#6-scoring-metrics) (~30 min)
7. [The Inspect AI Scoring Model](#7-the-inspect-ai-scoring-model) (~40 min)
8. [Calibrating Graders](#8-calibrating-graders) (~30 min)
9. [Key Concepts / Vocabulary](#9-key-concepts--vocabulary)
10. [Challenges](#10-challenges) (~60-90 min)
11. [Key Takeaways](#11-key-takeaways)
12. [Recommended Reading](#12-recommended-reading)
13. [What to Read Next](#13-what-to-read-next)

---

## 1. The Grading Hierarchy

*Estimated time: 25 minutes*

Not all grading methods are equal. They differ in speed, cost, reliability,
flexibility, and failure modes. The emerging consensus, articulated most clearly in
Anthropic's evaluation documentation, orders grading methods by reliability:

1. **Code-based grading** - Fastest and most reliable. Deterministic. Infinitely
   scalable at near-zero marginal cost. But limited to outputs where correctness can
   be expressed programmatically.

2. **LLM-based grading** - Fast and flexible. Scalable. Suitable for complex
   judgment where code cannot reach. But requires validation, exhibits specific biases,
   and costs tokens.

3. **Human grading** - Most flexible and highest quality ceiling. But slow, expensive,
   and does not scale. Anthropic's guidance: "Avoid if possible."

This ordering is engineering guidance, not dogma. The hierarchy reflects **reliability**
(grading consistency) and **cost** (time, money, operational complexity). Code-based
grading wins on both when it applies. The question is always: does it apply?

### When Each Method Applies

The decision maps to a question about the output: **can correctness be expressed as
a computable function?**

If yes, use code-based grading. If the task returns a specific entity, a number, or
a JSON object with a defined schema, you can write a deterministic function to check.

If no, but you can express correctness as a rubric with specific criteria, use
LLM-as-judge. For summaries, explanations, or reviews, an LLM can apply a rubric
consistently across thousands of samples - but you must validate it aligns with your
judgment.

If the output requires taste or judgment you cannot articulate in a rubric, use human
evaluation.

### The Verifiable / Taste-Required Distinction

This hierarchy connects to a distinction from this project's operational lexicon that
runs through all of Bootcamp IV: the difference between **verifiable** and
**taste-required** outputs.

A verifiable output is one where the quality gate can assess correctness. A typecheck
passes or it does not. A test suite is green or it is not. An extracted entity matches
the golden answer or it does not. For verifiable outputs, code-based grading is not
just recommended - it is the correct choice.

A taste-required output is one where only human judgment can evaluate quality. A code
review that is "technically correct but misses the point." A summary that is "accurate
but unhelpful." A response that is "not wrong" but would not pass the test of "would
you put your name on this?" For taste-required outputs, human evaluation is not just
the fallback - it is the only honest option.

The operational rule from this project: **HOTL (human out the loop) when the gate can
verify; HODL (human grips the wheel) when it requires taste.** LLM-as-judge occupies
the middle ground: it can approximate taste-required judgments at scale, but only after
you have validated the approximation against actual human taste.

> **AGENTIC GROUNDING:** In agent systems, the grading hierarchy has direct cost
> implications. Code-based grading of agent output is effectively free - you are
> running functions on strings. LLM-based grading costs tokens proportional to the
> output length and rubric complexity. Human grading costs time proportional to the
> output complexity. For an eval suite that runs on every commit (as this project's
> quality gate does), the grading method determines whether continuous evaluation is
> economically viable. If your grader requires a human for every sample, you cannot
> evaluate on every commit. If it requires an LLM, you can but the cost scales with
> volume. If it is code-based, evaluation is part of the test suite and costs nothing
> beyond compute.

> **SLOPODAR:** "Not wrong" - the gap between code-based grading and taste-required
> judgment is where the "not wrong" pattern lives. An output that passes every
> automated check but is not right. Automated metrics have a ceiling. Above it, the
> only instrument is a human who will say "this is not good enough" when every
> dashboard is green.

---

## 2. Code-Based Grading

*Estimated time: 45 minutes*

Code-based grading is the gold standard when it applies. The grader is a deterministic
function: same inputs, same score. Free to run (no API calls), and verifiable (you
can read the function). The limitation is expressiveness - it works when correctness
can be reduced to string operations, structural validation, or execution-based
comparison. It does not work when correctness requires judgment.

### Exact Match

The simplest grader. Does the output exactly equal the expected answer?

```python
def exact_match(output: str, expected: str) -> bool:
  """Grade by exact string equality."""
  return output.strip() == expected.strip()
```

When to use: classification, entity extraction, factual QA with unambiguous answers.

When it fails: any task where multiple valid phrasings exist. If the expected answer is
"Paris" and the model outputs "The capital of France is Paris," exact match returns
false. The fix: constrain the model's output format via system prompt or structured
output. A deliberate tradeoff - harder generation, easier grading.

```python
def normalized_exact_match(output: str, expected: str) -> bool:
  """Grade by exact match after normalization."""
  def normalize(s: str) -> str:
    s = s.strip().lower()
    # Remove common prefixes
    for prefix in ["the answer is ", "answer: ", "result: "]:
      if s.startswith(prefix):
        s = s[len(prefix):]
    return s.strip()
  return normalize(output) == normalize(expected)
```

### String Containment

Does the output contain the expected answer somewhere within it?

```python
def string_contains(output: str, expected: str) -> bool:
  """Grade by substring containment."""
  return expected.lower() in output.lower()
```

When to use: QA tasks where the model wraps the answer in explanation. You want to
confirm the answer appears, even surrounded by context.

When it fails: false positives. If the expected answer is "4" and the model outputs
"The answer is not 4, it is 5," string containment returns true. The shorter the
expected string, the higher the false positive rate. Mitigation: use more specific
expected strings, or combine with other checks.

### Regex Patterns

Does the output match a pattern?

```python
import re

def regex_match(output: str, pattern: str) -> bool:
  """Grade by regex pattern match."""
  return bool(re.search(pattern, output, re.IGNORECASE))
```

When to use: structured outputs where format matters more than exact content.
Extracting specific patterns from longer responses.

When it fails: regex patterns can be brittle or overly permissive. The more useful
pattern is extraction rather than validation - pull an answer from structured output,
then grade the extracted value:

```python
def extract_and_match(output: str, expected: str) -> bool:
  """Extract answer from 'ANSWER: ...' format and compare."""
  match = re.search(r"ANSWER:\s*(.+?)(?:\n|$)", output, re.IGNORECASE)
  if match:
    return match.group(1).strip().lower() == expected.strip().lower()
  return False
```

### JSON Schema Validation

Does the model's structured output conform to a schema?

```python
import json
from jsonschema import validate, ValidationError

def json_schema_grade(output: str, schema: dict) -> dict:
  """Grade structured output against a JSON schema."""
  try:
    parsed = json.loads(output)
  except json.JSONDecodeError as e:
    return {"valid": False, "errors": [f"Invalid JSON: {e}"]}
  try:
    validate(instance=parsed, schema=schema)
    return {"valid": True, "errors": []}
  except ValidationError as e:
    return {"valid": False, "errors": [e.message]}
```

When to use: any task that asks the model to produce structured output - API
responses, tool call parameters, structured data extraction.

When it fails: schema validation confirms structure, not semantics. A JSON object can
be schema-valid but contain nonsense values. A severity of "low" in a schema-valid
object says nothing about whether "low" is the correct severity assessment.

### SQL Execution and Comparison

For SQL generation tasks, the only honest grader executes both queries and compares
results:

```python
import sqlite3

def sql_execution_grade(model_sql: str, reference_sql: str, db_path: str) -> dict:
  """Grade SQL by executing both queries and comparing results."""
  conn = sqlite3.connect(db_path)
  try:
    model_result = conn.execute(model_sql).fetchall()
  except Exception as e:
    return {"match": False, "model_result": f"Error: {e}", "reference_result": None}
  try:
    reference_result = conn.execute(reference_sql).fetchall()
  except Exception as e:
    return {"match": False, "model_result": model_result, "reference_result": f"Error: {e}"}
  finally:
    conn.close()

  # Sort for order-independent comparison
  return {
    "match": sorted(model_result) == sorted(reference_result),
    "model_result": model_result,
    "reference_result": reference_result,
  }
```

This is the strongest form of code-based grading because it evaluates *behaviour*
rather than *form*. Two SQL queries can be syntactically different but functionally
equivalent. Execution-based grading catches this. String comparison would not.

When it fails: non-deterministic queries (ORDER BY without deterministic tiebreaking),
queries with side effects, queries where performance matters.

### Code Compilation and Test Execution

For code generation tasks, compile and run the output against a test suite:

```python
import subprocess
import tempfile
from pathlib import Path

def code_execution_grade(model_code: str, test_code: str, timeout: int = 30) -> dict:
  """Grade generated code by running tests against it."""
  with tempfile.TemporaryDirectory() as tmpdir:
    Path(tmpdir, "solution.py").write_text(model_code)
    Path(tmpdir, "test_solution.py").write_text(test_code)
    try:
      result = subprocess.run(
        ["python", "-m", "pytest", "test_solution.py", "-v"],
        capture_output=True, text=True, timeout=timeout, cwd=tmpdir,
      )
      return {"passed": result.returncode == 0, "output": result.stdout, "errors": result.stderr}
    except subprocess.TimeoutExpired:
      return {"passed": False, "output": "", "errors": f"Timed out after {timeout}s"}
```

This is the approach used by HumanEval and SWE-bench. The model generates code. The
grader runs it against a test suite. If the tests pass, the code is graded correct.

> **SLOPODAR:** "Right answer wrong work" - code execution grading has a specific
> vulnerability here. If the test asserts `result == 42` and the model hardcodes
> `return 42`, the test passes. The grader sees green. But the code does not solve
> the problem. The assertion verified the answer, not the method. This is why
> execution-based grading should use multiple test cases that make hardcoding
> impractical, and why test quality matters as much as test quantity.

### When to Use Which Code-Based Grader

| Output Type | Grader | Example |
|------------|--------|---------|
| Single value, exact | Exact match | Classification, entity extraction |
| Value within text | String containment | QA with explanation |
| Structured text | Regex | Formatted output, template conformance |
| Structured data | JSON schema | API responses, structured extraction |
| Executable query | SQL execution | Text-to-SQL, database QA |
| Executable code | Test execution | Code generation, bug fixing |
| Multiple criteria | Composite | All of the above combined |

The composite approach is the most robust: combine multiple code-based checks to
cover different aspects of correctness. A single output can be checked for string
containment, schema validity, and regex pattern match, with a final score of
"all passed" only when every check succeeds.

> **AGENTIC GROUNDING:** This project's quality gate (`pnpm run typecheck && pnpm run
> lint && pnpm run test`) is a composite code-based grader. Three binary checks
> composed with logical AND. The typecheck verifies type correctness. The linter
> verifies style. The tests verify behaviour. Each is a different grading method
> (schema validation, pattern matching, execution-based comparison) applied to the
> same output (the codebase). Together they form the simplest eval infrastructure:
> each check is a scorer (pass/fail), the gate is a composite (all must pass), the
> output is binary (green/red).

---

## 3. LLM-as-Judge

*Estimated time: 50 minutes*

When correctness cannot be expressed as a computable function, you need judgment.
LLM-as-judge uses one language model to evaluate another's output against a rubric.
The MT-Bench paper (Zheng et al. 2023) found that GPT-4 as a judge achieves over 80%
agreement with human preferences - "the same level of agreement between humans." When
validated, LLM judges are roughly as reliable as individual human judges, and vastly
cheaper. But "when validated" is doing significant work in that sentence.

### The Two-Stage Process

LLM-as-judge is fundamentally a two-stage process:

**Stage 1: Generation.** The model under evaluation produces output for a given input.

**Stage 2: Evaluation.** A different model (or the same model in a separate call)
evaluates that output against a rubric and produces a score.

The separation is critical. The generating model and the judging model have different
roles, different prompts, and ideally different model families. The generating model
is being tested. The judging model is part of the testing infrastructure.

```python
import anthropic
import re

def llm_grade(question: str, model_answer: str, rubric: str,
              grader_model: str = "claude-sonnet-4-20250514") -> dict:
  """Grade a model answer using an LLM judge."""
  client = anthropic.Anthropic()
  grading_prompt = f"""You are an expert evaluator. Grade the following answer
according to the rubric provided.

QUESTION: {question}
ANSWER TO EVALUATE: {model_answer}
RUBRIC: {rubric}

First, analyze the answer step by step against each criterion in the rubric.
Then provide your grade.

Respond in this exact format:
REASONING: [your step-by-step analysis]
GRADE: [your grade, using the scale defined in the rubric]"""

  response = client.messages.create(
    model=grader_model, max_tokens=1024,
    messages=[{"role": "user", "content": grading_prompt}],
  )
  raw = response.content[0].text
  grade_match = re.search(r"GRADE:\s*(.+?)(?:\n|$)", raw)
  reasoning_match = re.search(r"REASONING:\s*(.+?)(?:GRADE:|$)", raw, re.DOTALL)
  return {
    "score": grade_match.group(1).strip() if grade_match else None,
    "reasoning": reasoning_match.group(1).strip() if reasoning_match else None,
    "raw_response": raw,
  }
```

### Rubric Design: The Load-Bearing Component

The rubric is the most important part of LLM-as-judge. A vague rubric produces
unreliable grades. A specific rubric produces grades you can trust and debug.

**A bad rubric:**

```
Rate the quality of this answer from 1 to 5.
1 = very bad
5 = very good
```

This is useless. "Quality" is undefined. "Very bad" and "very good" mean different
things to different judges (human or LLM). The grades will be inconsistent, biased
toward the middle of the scale, and impossible to interpret.

**A good rubric (for evaluating code review quality):**

```
Evaluate this code review on the following criteria. For each criterion, assign a
score using the scale below.

CRITERION 1: PROBLEM IDENTIFICATION (1-5)
1 - Fails to identify any real problems, or identifies only false positives
2 - Identifies superficial issues (formatting, naming) but misses substantive problems
3 - Identifies at least one substantive problem (logic error, security issue,
    performance problem) but misses others that are present
4 - Identifies all major substantive problems; may miss minor issues
5 - Identifies all substantive problems AND correctly assesses their severity

CRITERION 2: EXPLANATION QUALITY (1-5)
1 - No explanation, or explanation is wrong
2 - Explanation is vague ("this looks wrong") without specifics
3 - Explanation identifies the problem but does not explain why it is a problem
4 - Explanation identifies the problem AND explains the consequence (what could go
    wrong, what the impact would be)
5 - Explanation identifies problem, explains consequence, AND references the relevant
    principle or best practice

CRITERION 3: SUGGESTION QUALITY (1-5)
1 - No suggestion, or suggestion would introduce new problems
2 - Suggestion is too vague to act on ("fix this")
3 - Suggestion is specific but incomplete (what to change but not how)
4 - Suggestion is specific and actionable (what to change and how)
5 - Suggestion is specific, actionable, AND demonstrates understanding of tradeoffs

SCORING:
- Report each criterion score separately
- Report the average as the overall score
- A review with any criterion scoring 1 should have overall score capped at 2
  regardless of other scores
```

The difference is precision. Each score level has specific, observable criteria. A
human reading the rubric would apply it the same way an LLM does (approximately).
Two different LLMs would produce similar grades on the same sample (approximately).
When grades disagree, you can identify which criterion caused the disagreement.

### Rubric Design Principles

Four rules for rubrics that produce reliable grades:

1. **Be specific about what each score level means.** Do not leave gaps between
   levels. "1 = bad, 3 = acceptable, 5 = excellent" forces the judge to interpolate
   for 2 and 4, introducing inconsistency.

2. **Use observable criteria, not subjective judgments.** "Identifies at least one
   substantive problem" is observable and verifiable. "Shows good understanding" is
   neither.

3. **Include boundary cases.** Empty output, off-topic responses, technically correct
   but unhelpful answers. A rubric that does not handle edge cases will produce
   unpredictable grades on them.

4. **Use the smallest scale that captures meaningful distinctions.** Binary
   (correct/incorrect) for factual tasks. Ternary (correct/partial/incorrect) when
   partial credit matters. 5-point Likert for quality assessment. Do not use more
   than 5 points - LLM judge reliability degrades with scale granularity.
   Multi-criteria when quality is multidimensional (score each dimension separately).

### Chain-of-Thought Grading

LLM judges produce more reliable grades when they reason before judging. The pattern:
ask the judge to analyze the output against each criterion first, then provide the
grade. The reasoning serves two purposes: it improves grade quality, and it provides
an audit trail you can inspect when the grade seems wrong.

Anthropic's guidance: "encourage reasoning before scoring, then discard the reasoning."
Keep the reasoning in logs for debugging, but downstream metrics use only the
extracted score.

```python
COT_GRADING_TEMPLATE = """You are evaluating an answer to the following question.

QUESTION: {question}
REFERENCE ANSWER: {reference}
MODEL ANSWER: {model_answer}
RUBRIC: {rubric}

Step 1: Analyze the model answer against each rubric criterion.
Step 2: Note information present in the reference but missing from the model answer.
Step 3: Note any contradictions between model answer and reference.
Step 4: Assign your grade.

Format: ANALYSIS: [step-by-step] then GRADE: [C for Correct, P for Partial, I for Incorrect]"""
```

OpenAI's evals framework implements this as `eval_type: cot_classify` - the
recommended default. Their alternative, `classify_cot` (answer then reason), is less
reliable because the reasoning becomes post-hoc justification for an already-determined
grade.

### Using a Different Model for Grading

Best practice from Anthropic: "Generally best practice to use a different model to
evaluate than the model used to generate the evaluated output." The reason connects
to the layer model. At L10 (Multi-Agent), the same model as both generator and judge
is a single-member ensemble - same biases, same blind spots, same systematic errors.
At L11 (Cross-Model), a different model family introduces genuinely independent signal.
Different training, different priors, different biases. When two models from different
families agree, the agreement means more.

Practical guidance: generate with Claude, grade with GPT-4o (or vice versa). If you
must use the same family, use a stronger variant for grading (generate with Haiku,
grade with Sonnet). If you use the same model for both, document this limitation and
validate with a human calibration sample.

> **NOVEL:** The analyst agent in this project (`.claude/agents/analyst.md`) is a
> worked example of a production LLM-as-judge framework. It does not evaluate
> research directly - it builds evaluation apparatus. Its core loop
> (Ingest -> Decompose -> Instrument -> Model -> Compose -> Audit) separates eval
> construction from eval execution. The key architectural insight: the entity that
> designs the rubric should not be the same entity that applies it.

---

## 4. LLM-as-Judge Failure Modes

*Estimated time: 35 minutes*

LLM judges exhibit biases that are systematic, predictable, and measurable. The
MT-Bench paper (Zheng et al. 2023) identified four primary failure modes, confirmed
by subsequent research (Wang et al. 2023, Stureborg et al. 2024).

### Position Bias

**What it is:** LLM judges prefer the response in a particular position (first or
second, model-dependent). In pairwise comparison, this can shift win rates by 10-20%.

**Why it happens:** Attention patterns create primacy and recency effects - L3
(Context Dynamics) in action. Position in the context window affects processing.

**Mitigation:** Run every comparison twice with swapped positions. If A wins when
presented first and B loses when presented first, both rounds agree. If the rounds
disagree, position bias is operating and the result should be recorded as a tie.

```python
def position_corrected_comparison(response_a, response_b, question, rubric, grader_model):
  """Compare two responses with position bias correction."""
  grade_ab = llm_compare(question, response_a, response_b, rubric, grader_model)
  grade_ba = llm_compare(question, response_b, response_a, rubric, grader_model)
  if grade_ab["winner"] == "A" and grade_ba["winner"] == "B":
    return {"winner": "A", "confidence": "high"}
  elif grade_ab["winner"] == "B" and grade_ba["winner"] == "A":
    return {"winner": "B", "confidence": "high"}
  else:
    return {"winner": "tie", "confidence": "low", "note": "position bias detected"}
```

The cost: you double the grading token spend. The benefit: you eliminate an entire
class of systematic error.

### Verbosity Bias

**What it is:** LLM judges prefer longer, more detailed responses regardless of
whether the additional detail improves the answer. A verbose, partially-incorrect
response can outscore a concise, fully-correct response.

**Why it happens:** RLHF training rewards helpfulness, which correlates with
thoroughness during training. The model generalises "more detailed = better."

**Mitigation:** (1) Include explicit length guidance in the rubric: "A correct answer
in 2 sentences should score the same as a correct answer in 5 sentences if the
additional sentences add no information." (2) Add anti-verbosity instructions to the
grading prompt: "Do not reward verbosity. Only score additional detail higher if it
adds relevant information." (3) Flag cases where two correct responses differ by 3x+
in length for manual review.

### Self-Preference (Self-Enhancement Bias)

**What it is:** Models rate their own outputs higher than outputs from other models.
Win rates shift by 5-15% depending on the model pair and task.

**Why it happens:** The model's generation distribution and evaluation distribution
share the same training. Outputs that match the model's distribution "look right."
This is L10 (Multi-Agent) - same model, same biases, false independence.

**Mitigation:** (1) Cross-model grading - use a different model family for grading
than generation. This is the single most effective mitigation. (2) Anonymization -
remove formatting or phrasing cues that could identify the source model. (3) Multi-
model ensemble grading - use judges from multiple families and aggregate:

```python
from inspect_ai.scorer import model_graded_qa

scorer = model_graded_qa(  # Three judges, majority vote
  model=["openai/gpt-4o", "anthropic/claude-sonnet-4-20250514", "google/gemini-2.5-pro"]
)
```

### Format Sensitivity

**What it is:** The format of the output (markdown vs plain text, bullet points vs
paragraphs) affects the grade independent of content quality. A well-formatted
markdown response receives a higher score than the same content in plain text.

**Why it happens:** Training data and RLHF correlate formatting with quality. The
model generalises this into a bias.

**Mitigation:** (1) Format-neutral rubric: "Evaluate accuracy and completeness. Do
not consider formatting or presentation." (2) Format normalization: strip markdown
before grading when format should not matter. (3) When format genuinely matters,
include it as an explicit rubric dimension with its own criteria, separate from
content dimensions.

### Limited Reasoning Ability

LLM judges struggle with verification requiring multi-step reasoning, especially
mathematics and formal logic. An LLM judge may confidently rate an incorrect proof
as correct. **Mitigation:** Do not use LLM-as-judge for tasks where correctness
requires mathematical or logical verification. Use code-based grading instead. The
grading hierarchy exists for a reason.

> **AGENTIC GROUNDING:** The multi-model ensemble review pipeline in this project
> (darkcat alley) is a worked example of self-preference mitigation at scale. Three
> models from different families review the same code snapshot using structured YAML.
> Convergence across models builds confidence because the agreement comes from
> independent priors. Divergence locates where a single model's bias lives. The
> design explicitly addresses L10 (same model = false independence) by operating
> at L11 (cross-model = genuine independence).

> **FIELD MATURITY: EMERGING** - LLM-as-judge failure modes are well-documented
> in the research literature (Zheng et al. 2023 is the primary reference). Mitigation
> strategies are known but not standardised. Position swapping is widely adopted.
> Multi-model ensemble grading is available in Inspect AI but not yet common practice.
> There is no accepted standard for "how many judges is enough" or "what agreement
> threshold is acceptable."

---

## 5. Human Evaluation

*Estimated time: 35 minutes*

Human evaluation is the method of last resort - and the only method that works for
taste-required outputs. Anthropic's guidance: "Avoid if possible." This is practical,
not dismissive. Human evaluation is slow, expensive, and introduces its own biases.
But when no code and no LLM can reliably judge the output, a human must do it.

### When Human Evaluation is Unavoidable

Four situations: (1) **Taste-required outputs** - creative writing, marketing copy,
any output where quality depends on judgment you cannot articulate in a rubric.
(2) **Safety-critical assessments** - where a false negative (grading unsafe output
as safe) has catastrophic consequences. (3) **Calibrating automated graders** - the
human provides ground truth that automated graders are measured against.
(4) **Novel tasks** - when you do not yet know what "good" looks like and need humans
to generate the examples and rubrics that automated evaluation will later use.

### Inter-Rater Reliability

Different humans produce different grades. Inter-rater reliability measures how
consistently multiple evaluators agree on the same samples.

**Cohen's kappa** is the standard metric for inter-rater reliability between two
raters on categorical judgments. It corrects for agreement that would occur by chance:
`kappa = (P_observed - P_chance) / (1 - P_chance)`. The standard interpretation
scale (Landis & Koch 1977): < 0 poor, 0-0.20 slight, 0.21-0.40 fair, 0.41-0.60
moderate, 0.61-0.80 substantial, 0.81-1.00 almost perfect. For LLM evaluation,
target kappa > 0.60 (substantial agreement). If your raters cannot achieve this, the
task is too subjective or the rubric needs refinement. For more than two raters,
Fleiss' kappa (1971) generalises Cohen's kappa; the interpretation scale is the same.

```python
def cohens_kappa(rater_a: list[str], rater_b: list[str]) -> float:
  """Compute Cohen's kappa for two raters on categorical judgments."""
  assert len(rater_a) == len(rater_b)
  n = len(rater_a)
  categories = sorted(set(rater_a) | set(rater_b))
  p_observed = sum(a == b for a, b in zip(rater_a, rater_b)) / n
  p_chance = sum(
    (sum(1 for x in rater_a if x == c) / n) * (sum(1 for x in rater_b if x == c) / n)
    for c in categories
  )
  return 1.0 if p_chance == 1.0 else (p_observed - p_chance) / (1 - p_chance)
```

### Training Protocols for Human Evaluators

Untrained human evaluators are unreliable. A minimal training protocol:

1. **Rubric walkthrough.** Walk through each criterion and score level. Ensure every
   evaluator interprets the rubric the same way.
2. **Calibration set.** All evaluators grade the same 20-30 samples independently.
   Compare results. Discuss disagreements. Clarify ambiguities.
3. **Measure inter-rater reliability.** Compute kappa on the calibration set. If
   kappa < 0.60, revise the rubric and repeat.
4. **Ongoing calibration.** Include 10% pre-graded calibration samples in every
   evaluation run. Monitor rater drift. Re-train or remove raters who fall below
   threshold.

### A/B Test Design for Preference Evaluation

When the question is "which output is better?" rather than "how good is this output?",
pairwise comparison is more reliable than absolute scoring. The Arena (lmarena.ai) is
the largest-scale example: users compare two anonymous model responses and pick a
winner, with millions of votes collected across categories.

Design principles: (1) **Blind comparison** - evaluators do not know which model
produced which response. (2) **Randomised position** - eliminates position bias
(humans have it too). (3) **Forced choice with tie option** - allow "tie" but do
not default to it. (4) **Sufficient sample size** - at least 100-200 comparisons
per model pair for reliable preference signals.

### Crowdworker vs Expert Evaluators

**Crowdworkers** (Scale AI, Surge AI, Mechanical Turk) are cheaper and scalable. They
work for tasks with clear rubrics and low domain expertise requirements.
**Expert evaluators** are expensive and scarce but required for domain-specific
judgment: medical accuracy, legal correctness, code review quality.

The practical pattern: experts design the eval and rubric, crowdworkers (or LLM
judges validated against expert calibration samples) execute at scale. The BBQ bias
benchmark required approximately 2 person-years across 8 people (Anthropic 2023) for
expert design; crowdworkers could not have designed it but could validate individual
questions against the completed rubric.

> **AGENTIC GROUNDING:** This project's operational model makes the taste-required
> distinction operational. The definition of done requires "gate green + 3 adversarial
> reviews complete + synthesis pass + pitkeel reviewed + walkthrough checked." The gate
> is code-based grading (verifiable). The adversarial reviews are LLM-as-judge
> (automated but validated). The pitkeel review and walkthrough are human evaluation
> (taste-required). Five checks with three different evaluation mechanisms. The first
> is cheapest. The last is most expensive. Each catches failures the others miss.

---

## 6. Scoring Metrics

*Estimated time: 30 minutes*

A scoring metric converts raw grading results into a number you can track, compare,
and make decisions from. Using the wrong metric is a construct validity failure.

### Classification Metrics

**Accuracy:** Proportion of correct predictions. Simple but misleading when classes
are imbalanced - if 95% of samples are class A, always predicting A yields 95%
accuracy.

**Precision, Recall, F1:** Precision measures what fraction of positive predictions
are actually positive (few false positives). Recall measures what fraction of actual
positives the model catches (few false negatives). F1 is the harmonic mean balancing
both. Which to prioritise depends on the task: for safety evaluation, recall matters
more (you would rather flag safe content than miss unsafe content); for content
filtering, precision may matter more (false positives block legitimate use).

```python
def precision_recall_f1(predictions: list[bool], targets: list[bool]) -> dict:
  """Compute precision, recall, and F1 for binary classification."""
  tp = sum(p and t for p, t in zip(predictions, targets))
  fp = sum(p and not t for p, t in zip(predictions, targets))
  fn = sum(not p and t for p, t in zip(predictions, targets))
  precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
  recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
  f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
  return {"precision": precision, "recall": recall, "f1": f1}
```

### Text Similarity Metrics

For tasks where the model produces free text that should be similar to a reference,
but exact match is too strict.

**BLEU** (Bilingual Evaluation Understudy, Papineni et al. 2002): Precision-based
n-gram overlap with brevity penalty. Originally designed for machine translation.

**ROUGE-L** (Recall-Oriented Understudy for Gisting Evaluation, Lin 2004): Longest
common subsequence between candidate and reference, with F1 balancing precision and
recall. Originally designed for summarisation.

```python
def rouge_l_f1(candidate: str, reference: str) -> float:
  """Compute ROUGE-L F1 score (longest common subsequence)."""
  cand_tokens = candidate.lower().split()
  ref_tokens = reference.lower().split()
  m, n = len(cand_tokens), len(ref_tokens)
  dp = [[0] * (n + 1) for _ in range(m + 1)]
  for i in range(1, m + 1):
    for j in range(1, n + 1):
      if cand_tokens[i - 1] == ref_tokens[j - 1]:
        dp[i][j] = dp[i - 1][j - 1] + 1
      else:
        dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
  lcs_length = dp[m][n]
  if lcs_length == 0:
    return 0.0
  precision, recall = lcs_length / m, lcs_length / n
  return 2 * precision * recall / (precision + recall)
```

**When appropriate:** Tasks with clear reference answers where surface-level similarity
correlates with quality - summarisation of factual content, translation, paraphrasing.

**When inappropriate:** BLEU and ROUGE measure word overlap, not meaning. Two
semantically identical answers with different wording score low. HELM found that models
fine-tuned on summarisation datasets scored well on ROUGE but produced worse summaries
than few-shot prompted LLMs as judged by humans. The metric and human judgment
diverged - a construct validity failure.

> **FIELD MATURITY: ESTABLISHED** - BLEU and ROUGE are 20+ year old metrics with
> well-understood properties and limitations. They are increasingly seen as
> insufficient for evaluating modern LLM outputs. They remain useful as cheap
> baseline sanity checks but should not be the sole evaluation metric. Use them
> as a floor, not a ceiling.

### Embedding-Based Similarity

Semantic similarity via embeddings captures meaning beyond surface-level word overlap.

```python
from sentence_transformers import SentenceTransformer
from numpy import dot
from numpy.linalg import norm

def cosine_similarity_score(candidate: str, reference: str,
                            model_name: str = "all-MiniLM-L6-v2") -> float:
  """Compute cosine similarity between candidate and reference embeddings."""
  model = SentenceTransformer(model_name)
  embeddings = model.encode([candidate, reference])
  return float(dot(embeddings[0], embeddings[1]) / (norm(embeddings[0]) * norm(embeddings[1])))
```

Advantages over BLEU/ROUGE: captures paraphrases, handles word order variation,
correlates better with human judgments. Limitations: embedding model quality matters,
domain-specific nuance may be missed, and cosine similarity is symmetric while
evaluation quality is sometimes asymmetric. Use for consistency checking, semantic
deduplication, and soft matching where exact match is too strict but LLM-as-judge
is overkill.

### Custom Metrics

Many eval tasks require metrics that do not fit standard categories. Build them. For
example, SQL evaluation might need row-level precision and recall (what fraction of
expected rows appear in the model's result, and vice versa), plus counts of extra and
missing rows. The standard F1 formula applies to the row sets the same way it applies
to classification labels.

### Metric Selection Guide

| Output Type | Primary Metric | Secondary Metric | Avoid |
|------------|---------------|-----------------|-------|
| Classification | F1 (per-class or macro) | Precision/Recall (task-dependent) | Accuracy alone (misleading with imbalance) |
| Entity extraction | F1 (entity-level) | Exact match (strict) | Character-level metrics |
| Factual QA | Exact match / includes | Cosine similarity | BLEU (penalises valid rephrasings) |
| Summarisation | ROUGE-L (baseline) | LLM-as-judge (quality) | ROUGE-L alone (misses quality) |
| Translation | BLEU (baseline) | Human preference | BLEU alone (ceiling effect) |
| Code generation | Test pass rate | Execution match | String similarity (syntax varies) |
| SQL generation | Execution accuracy | Row-level F1 | String match (many valid queries) |
| Open-ended text | LLM-as-judge | Cosine similarity | Any single automated metric |
| Safety / toxicity | Recall (false negatives are dangerous) | Precision | Accuracy (misses class imbalance) |

> **AGENTIC GROUNDING:** Metric selection is not a technical decision alone - it is
> an epistemological one. The metric defines what "correct" means for your eval, and
> therefore what your eval actually measures. Choose the wrong metric and you optimise
> for the wrong thing. This is Goodhart's law applied to grading: when the metric
> becomes the target, it ceases to be a good metric. Review your metric against the
> construct you actually care about, not just the output format.

---

## 7. The Inspect AI Scoring Model

*Estimated time: 40 minutes*

Inspect AI (UK AI Safety Institute) provides a composable scoring system that
implements the grading hierarchy as software components. Scorers are first-class
objects that can be combined, configured, and extended. Understanding this model
gives you both a practical tool for building evals and a design pattern for
thinking about grading as a composable pipeline.

### Scorers as Composable Components

In Inspect, a **scorer** is a function that takes a `TaskState` (the model's output,
conversation history, and target) and returns a `Score` with: `value` (the grade),
`answer` (extracted text), `explanation` (grader reasoning), and `metadata`. Scorers
declare their own metrics and can be combined, swapped, and tested independently.
The separation between score value and explanation is the chain-of-thought grading
pattern built into the type system.

### Built-in Scorers

**Text-based scorers** (code-based grading):

```python
from inspect_ai.scorer import exact, includes, match, pattern, answer, f1

# Exact normalized match
scorer = exact()

# Target appears anywhere in output
scorer = includes(ignore_case=True)

# Target at beginning or end of output
scorer = match()

# Regex extraction
scorer = pattern(r"ANSWER:\s*(.+)")

# Extracts from "ANSWER: ..." format
scorer = answer()

# Token-level F1 score
scorer = f1()
```

Each of these implements one of the code-based grading methods from Section 2. They
are the building blocks. `exact()` is exact match. `includes()` is string
containment. `pattern()` is regex matching. They are composed into a Task alongside
a Dataset and a Solver.

**Model-graded scorers** (LLM-as-judge):

```python
from inspect_ai.scorer import model_graded_qa, model_graded_fact

# Open-ended answer evaluation
scorer = model_graded_qa(
  model="openai/gpt-4o",
  include_history=True,    # Pass conversation context to grader
  partial_credit=True,     # Allow partial scores
)

# Factual extraction evaluation
scorer = model_graded_fact(
  model="anthropic/claude-sonnet-4-20250514",
)
```

Both model-graded scorers support custom templates and instructions, allowing you to
inject your own rubric into the grading prompt. The template uses `{question}`,
`{answer}`, and `{criterion}` placeholders that Inspect fills from the dataset and
scorer configuration.

### Multi-Model Grading

Inspect AI supports multi-model ensemble grading natively:

```python
from inspect_ai.scorer import model_graded_qa

# Three judges from different model families - majority vote
scorer = model_graded_qa(
  model=[
    "openai/gpt-4o",
    "anthropic/claude-sonnet-4-20250514",
    "google/gemini-2.5-pro",
  ]
)
```

The final grade is determined by majority vote across the three models. This directly
addresses self-preference bias (Section 4) by operating at L11 (cross-model
independence) rather than L10 (same-model false independence).

### Multiple Scorers and Reducers

A single task can use multiple scorers via `multi_scorer()`, each evaluating a
different dimension (e.g., exact match for the answer, model-graded for explanation
quality). Reducers aggregate across scorers: `mode`, `mean`, `median`, `max`,
`pass_at_k`, `at_least_k`. This is composite grading as a software component.

### Custom Scorer Implementation

When built-in scorers do not match your grading logic, build a custom scorer:

```python
from inspect_ai.scorer import Score, Target, accuracy, stderr, scorer, CORRECT, INCORRECT
from inspect_ai.solver import TaskState

@scorer(metrics=[accuracy(), stderr()])
def sql_execution_scorer(db_path: str = "test.db"):
  """Score SQL queries by executing and comparing results."""
  async def score(state: TaskState, target: Target) -> Score:
    import sqlite3
    model_sql = state.output.completion.strip()
    reference_sql = target.text.strip()
    conn = sqlite3.connect(db_path)
    try:
      model_result = sorted(conn.execute(model_sql).fetchall())
    except Exception as e:
      return Score(value=INCORRECT, answer=model_sql,
                   explanation=f"Model SQL failed: {e}")
    try:
      ref_result = sorted(conn.execute(reference_sql).fetchall())
    except Exception as e:
      return Score(value=INCORRECT, answer=model_sql,
                   explanation=f"Reference SQL failed: {e}")
    finally:
      conn.close()
    match = model_result == ref_result
    return Score(
      value=CORRECT if match else INCORRECT,
      answer=model_sql,
      explanation=f"{'Match' if match else 'Differ'}: model={len(model_result)} rows, ref={len(ref_result)} rows",
    )
  return score
```

The `@scorer` decorator registers the function and declares which metrics to compute.
`CORRECT`/`INCORRECT` map to `1.0`/`0.0` for the `accuracy()` metric.

### Deferred Scoring and Workflow

Inspect supports running generation and scoring as separate steps with `--no-score`
and `inspect score`, useful during scorer development: generate outputs once, then
iterate on scoring without paying API costs. A complete task composes all components:

```python
from inspect_ai import Task, task
from inspect_ai.dataset import json_dataset
from inspect_ai.scorer import model_graded_qa
from inspect_ai.solver import chain_of_thought, generate

@task
def code_review_eval():
  """Evaluate code review quality using LLM-as-judge with custom rubric."""
  return Task(
    dataset=json_dataset("code_reviews.jsonl"),
    solver=[chain_of_thought(), generate()],
    scorer=model_graded_qa(
      template=CODE_REVIEW_RUBRIC_TEMPLATE,
      instructions="Evaluate against all three criteria. Be strict.",
      model="openai/gpt-4o",
      partial_credit=True,
    ),
    epochs=3,  # Run each sample 3 times to measure consistency
  )
```

```bash
inspect eval code_review_eval.py --model anthropic/claude-sonnet-4-20250514
inspect view  # Launch log viewer in browser
```

> **NOVEL:** The `bin/triangulate` tool in this project is a custom scorer in
> spirit, though implemented outside the Inspect framework. It parses structured YAML
> findings from cross-model reviews, matches findings across reviews using a greedy
> best-first algorithm (`0.3 * file_similarity + 0.7 * title_similarity`, threshold
> 0.6), and computes convergence metrics including marginal value per model.
> Its false positive rate is explicitly marked as `pending_adjudication` with the
> note "FP rate requires human verification of each finding" - this is the
> verifiable/taste-required distinction encoded into the scoring tool itself. The
> code knows where its authority ends.

---

## 8. Calibrating Graders

*Estimated time: 30 minutes*

A grader you have not calibrated is a grader you cannot trust. Calibration is
the process of running the grader against samples where you already know the
correct grade, measuring how often the grader agrees with the known grade, and
iterating until the agreement is acceptable.

This is meta-evaluation: evaluating the evaluator.

### Why Calibration is Non-Negotiable

You have a detailed rubric with chain-of-thought grading and anti-bias instructions.
But you have not tested whether the LLM actually applies it the way you intended.
Maybe it is lenient on one criterion and strict on another. Maybe it interprets key
terms differently than you do. Without calibration, you are in the position described
by Anthropic: "overinterpret the quantitative score and delude yourself into thinking
that you have made progress when you haven't."

### The Calibration Protocol

**Step 1: Create a calibration set.** Select 30-50 samples spanning the quality range:
clearly good, clearly bad, and ambiguous borderline cases. Each sample must have a
known-correct grade assigned by a human expert (or by consensus of multiple experts).

**Step 2: Run the grader.** Apply your grading method to all calibration samples.
For each sample, record the predicted grade, the actual (human) grade, and whether
they match. Compute the confusion matrix: true positives, false positives, true
negatives, false negatives. From this, derive accuracy, precision, recall, false
positive rate, and false negative rate.

**Step 3: Analyse failures.** For every disagreement, classify the cause: (1) **Rubric
ambiguity** - multiple interpretations possible, fix by being more specific. (2) **Edge
case gap** - rubric does not cover this output type, fix by adding cases. (3) **Reasoning
failure** - reasoning was correct but grade extraction failed, fix prompt or parsing.
(4) **Bias** - consistently wrong in one direction, fix with calibration instructions or
a different grading model.

**Step 4: Iterate.** Modify the rubric, the grading prompt, or the grading
model. Re-run on the calibration set. Repeat until grader accuracy exceeds
your threshold.

### Acceptable Thresholds

Practical guidelines: **Grader accuracy > 90%** is a reasonable target for most evals.
**False negative rate < 5%** for safety evals. **Cohen's kappa > 0.60** between grader
and human experts. If you cannot achieve these after three iterations, the task may be
too subjective for automated grading, or the rubric needs fundamental redesign.

### Calibration for Code-Based Graders

Code-based graders need calibration too. A regex might match incorrect answers (false
positives). A normalisation function might reject valid formats (false negatives).
Write unit tests for your grader covering true positives, true negatives, and edge
cases. These cost nothing to run and catch grader bugs before they corrupt evaluation
results.

```python
def test_exact_match_grader():
  """Calibration tests for exact match grading."""
  assert normalized_exact_match("Paris", "Paris") is True
  assert normalized_exact_match("  paris  ", "Paris") is True
  assert normalized_exact_match("The answer is Paris", "Paris") is True
  assert normalized_exact_match("Lyon", "Paris") is False
  assert normalized_exact_match("", "Paris") is False
  assert normalized_exact_match("Paris, France", "Paris") is False  # strict
  assert normalized_exact_match("PARIS", "Paris") is True  # case-insensitive
```

### Ongoing Calibration

Calibration is not one-time. Graders drift: LLM-based graders change with model
updates, human graders experience fatigue. Practical approach: embed 10-15% of
pre-graded calibration samples in every evaluation run, randomly distributed among
real samples. Monitor grader accuracy on calibration samples over time. If accuracy
drops below threshold, investigate before trusting results.

> **SLOPODAR:** "Right answer wrong work" - a grader that scores 95% accuracy
> on calibration samples can still be wrong on the samples that matter most. If
> the calibration set is all easy cases and the real eval contains hard cases,
> the grader's track record is misleading. Calibration samples must span the
> difficulty range, including the edge cases where grading is hardest.

> **NOVEL:** The `bin/triangulate` tool's explicit handling of false positive rates
> demonstrates calibration honesty. The tool computes convergence metrics, severity
> distributions, and marginal value per model. But the false positive rate field
> says: `status: "pending_adjudication"`, `note: "FP rate requires human
> verification of each finding. Values below are placeholders, not measurements."`
> The tool knows which metrics it can compute (verifiable) and which require human
> input (taste-required). This is calibration metadata built into the scoring
> infrastructure.

---

## 9. Key Concepts / Vocabulary

Before moving to the challenges, ensure you can define these terms:

- **Grading hierarchy** - Code-based > LLM-based > Human. Order by reliability
  and cost. Use the most reliable method that applies.

- **Code-based grading** - Deterministic grading via string operations, schema
  validation, or execution comparison. Free, reliable, limited in expressiveness.

- **LLM-as-judge** - Using one LLM to evaluate another's output against a rubric.
  Flexible and scalable, but biased in specific ways.

- **Rubric** - The specification that defines what each grade level means.
  Specific, observable criteria per level. The load-bearing component of
  LLM-as-judge.

- **Chain-of-thought grading** - Asking the LLM judge to reason before grading.
  Improves grade quality and provides an audit trail.

- **Position bias** - LLM judges prefer responses in certain positions. Mitigated
  by position swapping.

- **Verbosity bias** - LLM judges prefer longer responses. Mitigated by rubric
  design and length normalization.

- **Self-preference** - Models rate their own outputs higher. Mitigated by
  cross-model grading.

- **Inter-rater reliability** - Agreement between multiple raters on the same
  samples. Measured by Cohen's kappa (two raters) or Fleiss' kappa (multiple).

- **Cohen's kappa** - Agreement metric correcting for chance. Target > 0.60 for
  substantial agreement.

- **Verifiable / taste-required** - The load-bearing distinction. Verifiable
  outputs can be graded by code or LLM. Taste-required outputs need human judgment.

- **Scorer** - Inspect AI's abstraction for a grading component. Composable,
  configurable, declares its own metrics.

- **Calibration** - Running a grader against known samples to measure its accuracy
  before trusting it at scale. Meta-evaluation.

- **False positive / false negative** - In grading: a false positive grades bad
  output as good (dangerous for safety). A false negative grades good output as
  bad (wasteful but safer).

---

## 10. Challenges

*Estimated time: 60-90 minutes total*

These challenges exercise the grading methods covered in this step. Each requires
you to build, test, and measure a grading system.

---

### Challenge 1: Three Graders for SQL Generation

*Estimated time: 30 minutes*
*Type: Build*

Build three different graders for the same task: evaluating SQL query generation.
Given a natural language question and a reference SQL query, the model generates
a SQL query. Your three graders must evaluate the model's query using different
methods.

**Deliverable:** A Python script with three grading functions and a comparison report.

**Design constraints:**
- Grader 1: Code-based. Execute both the model query and the reference query against
  a test database, compare results row-by-row.
- Grader 2: LLM-as-judge. Write a rubric that evaluates SQL correctness,
  efficiency, and readability. Use chain-of-thought grading.
- Grader 3: String similarity. Compute a similarity score between the model query
  and the reference query (you can use ROUGE-L, cosine similarity, or edit distance).
- Use at least 10 test cases covering: simple SELECT, JOIN, GROUP BY, subquery, and
  edge cases (empty result, multiple valid queries).
- Report the agreement rate between each pair of graders.

**Evaluation criteria:** Your comparison should reveal where the graders disagree
and why. String similarity should fail on cases where syntactically different queries
produce identical results. LLM-as-judge should fail on cases requiring execution to
verify. Document these divergences.

<details>
<summary>Design guidance</summary>

Start with the code-based grader (execution comparison) - this is your ground truth.
Then run the LLM-as-judge and string similarity graders on the same samples. For the
LLM rubric, include criteria like:
- Does the query produce the correct result set?
- Does the query use appropriate JOINs/indexes?
- Is the query readable and maintainable?

For the comparison, create a table with columns: sample_id, execution_grade,
llm_grade, similarity_score, agreement. Look for patterns in disagreement.

Use SQLite for the test database - it is lightweight and requires no setup.

```python
import sqlite3

# Create test database
conn = sqlite3.connect(":memory:")
conn.execute("""
  CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT,
    department TEXT,
    salary REAL
  )
""")
conn.execute("""
  INSERT INTO employees VALUES
  (1, 'Alice', 'Engineering', 95000),
  (2, 'Bob', 'Marketing', 75000),
  (3, 'Carol', 'Engineering', 105000),
  (4, 'Dave', 'Marketing', 80000),
  (5, 'Eve', 'Engineering', 92000)
""")
conn.commit()
```

</details>

---

### Challenge 2: LLM-as-Judge Rubric for Code Review Quality

*Estimated time: 30 minutes*
*Type: Design + Build*

Design an LLM-as-judge rubric for evaluating code review quality. Then test it
against a set of known-good and known-bad code reviews to measure the rubric's
precision and recall.

**Deliverable:** A rubric document, 40 labelled code review samples (20 good, 20 bad),
and a calibration report showing precision, recall, and F1 of the rubric-based grader.

**Design constraints:**
- The rubric must have at least 3 evaluation dimensions (e.g., problem identification,
  explanation quality, suggestion quality).
- Each dimension must have specific criteria per score level (not just "good/bad").
- The rubric must use chain-of-thought grading (reasoning before grade).
- The 40 samples must cover edge cases: reviews that are technically correct but
  unhelpful, reviews that identify the wrong problem, reviews that are good but
  miss a critical issue.
- You must pre-label all 40 samples with the correct grade before running the LLM
  grader. Your labels are the ground truth.

**Evaluation criteria:** Target precision > 0.85 and recall > 0.85 on the binary
classification of good vs bad reviews. If you do not hit these targets, iterate on
the rubric (document what you changed and why).

<details>
<summary>Design guidance</summary>

Start with the rubric from Section 3 of this step (the code review rubric) as a
baseline. Adapt it to your specific code domain.

For creating test samples, think about the failure modes:
- Good reviews: accurate problem identification, clear explanation, actionable
  suggestion, appropriate severity
- Bad reviews (type 1): nitpicking (formatting only, missing real issues)
- Bad reviews (type 2): wrong diagnosis (identifies a problem that is not there)
- Bad reviews (type 3): correct diagnosis but no explanation or suggestion
- Bad reviews (type 4): boilerplate ("looks good to me" on code with bugs)
- Edge cases: reviews that are partially good (correct on one dimension, wrong
  on another)

You can write these samples by hand or generate them with an LLM (but you must
verify each label manually).

</details>

---

### Challenge 3: Grader Calibration Pipeline

*Estimated time: 30 minutes*
*Type: Analyse*

Build and run a full grader calibration pipeline. Start with an LLM grader on a
task of your choice, calibrate it against 50 human-graded samples, and iterate
until accuracy exceeds 90%.

**Deliverable:** A calibration report including: initial accuracy, false positive rate,
false negative rate, a log of rubric changes per iteration, and final metrics.

**Design constraints:**
- Use at least 50 calibration samples with known-correct grades.
- Samples must include at least 10 clear-correct, 10 clear-incorrect, and 10
  ambiguous/borderline cases. The remaining 20 can be distributed as you see fit.
- Run at least 2 iterations (initial calibration + at least one rubric revision).
- Document every rubric change with the specific failure that motivated it.
- If accuracy does not reach 90% after 3 iterations, write a brief analysis of
  why (the task may be too subjective for reliable automated grading - that is a
  valid finding).

**Evaluation criteria:** The quality of your calibration report matters more than
the final accuracy number. A report that reaches 85% accuracy with thoughtful
analysis of the remaining failures is better than one that claims 95% accuracy
without documenting the edge cases.

<details>
<summary>Design guidance</summary>

Choose a task where you can create ground truth confidently. Good candidates:
- Factual QA (you know the right answer)
- Sentiment classification (most samples are clearly positive, negative, or neutral)
- Code correctness (you can run the code)

For the calibration pipeline, follow the protocol from Section 8:
1. Create calibration set with known grades
2. Run grader on all samples
3. Compute accuracy, precision, recall, FP rate, FN rate
4. Analyse failures
5. Modify rubric
6. Re-run and compare

Keep a changelog:

```
Iteration 1: Accuracy 78%
  - FP: 5/25 (grader said correct when wrong)
  - FN: 6/25 (grader said incorrect when correct)
  - Root cause: rubric criterion 2 is ambiguous on partial answers
  - Change: Added "partial credit" guidance to criterion 2

Iteration 2: Accuracy 88%
  - FP: 2/25
  - FN: 4/25
  - Root cause: FN cases are all borderline where explanation is
    technically correct but incomplete
  - Change: Added explicit "partial" grade between correct and incorrect
  ...
```

</details>

---

## 11. Key Takeaways

Before moving to Step 4, you should be able to answer these questions without
looking anything up:

1. What is the grading hierarchy, and what principle determines which grading
   method to use for a given task?

2. Name three code-based grading methods and state when each is appropriate
   versus when it breaks down.

3. What makes a good LLM-as-judge rubric? What are the specific properties that
   distinguish a useful rubric from a useless one?

4. What are the four primary failure modes of LLM-as-judge, and what is the
   mitigation strategy for each?

5. Why does Anthropic recommend using a different model for grading than for
   generation? What layer model concept does this connect to?

6. What is Cohen's kappa, and what threshold indicates substantial inter-rater
   agreement?

7. Why is calibration necessary even for code-based graders?

8. What is the difference between a false positive and a false negative in
   grading, and which is more dangerous for safety evaluations?

9. When is human evaluation unavoidable, and what does "taste-required" mean
   in operational terms?

10. What does a grader's calibration report tell you that the grader's output
    on real samples does not?

---

## 12. Recommended Reading

- **Anthropic, "Define success criteria and build evaluations"** (2024). The primary
  reference for the grading hierarchy and practical eval implementation.
  https://docs.anthropic.com/en/docs/build-with-claude/develop-tests

- **Zheng et al., "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"** (2023).
  NeurIPS 2023. The foundational paper for LLM-as-judge methodology, including failure
  mode analysis and the >80% agreement finding. arXiv:2306.05685.

- **Wang et al., "Large Language Models are not Fair Evaluators"** (2023). Documents
  position bias and self-preference in LLM judges. arXiv:2305.17926.

- **Inspect AI Scorers documentation**. The UK AI Safety Institute's scorer API
  reference. Composable scorers, multi-model grading, custom scorer patterns.
  https://inspect.ai-safety-institute.org.uk/scorers.html

- **OpenAI Evals model-graded templates**. YAML-based rubric specifications for
  factual consistency, criteria checking, and head-to-head comparison.
  https://github.com/openai/evals/blob/main/docs/eval-templates.md

- **Cohen, J., "A coefficient of agreement for nominal scales"** (1960). The original
  inter-rater reliability paper. Educational and Psychological Measurement, 20(1), 37-46.

- **This project:** `.claude/agents/analyst.md` (LLM-as-judge framework with XML
  evaluation prompts and anti-bias instructions), `bin/triangulate` (custom scorer
  for cross-model finding comparison).

---

## What to Read Next

**Step 4: Evaluating Agents and Workflows** - you now know how to grade a single
model output. But agent systems do not produce single outputs. They produce
trajectories: sequences of tool calls, observations, and decisions that unfold
over multiple steps. Step 4 extends the grading methods from this step to handle
multi-step evaluation. You will learn task-based evaluation (did the agent
accomplish the goal?), trajectory evaluation (was the path reasonable?), and the
Inspect AI agent evaluation model with sandboxed execution. The scoring methods
you built here become components in a larger evaluation pipeline where the unit
of evaluation is not a string but an action sequence.

