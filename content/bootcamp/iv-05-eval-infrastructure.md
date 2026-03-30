+++
title = "Eval Infrastructure and Automation"
date = "2026-03-10"
description = "Eval-driven development, evals in CI/CD, regression testing, eval cost budgeting."
tags = ["evals", "infrastructure", "ci-cd", "bootcamp"]
step = 5
tier = 2
estimate = "4-5 hours"
bootcamp = 4
+++

Step 5 of 9 in Bootcamp IV: Evaluation & Adversarial Testing.

---

## Why This Step Exists

You can now design evals that measure what they claim to measure (Step 1). You can build
datasets that cover the distribution your system will face (Step 2). You can score model
output with code-graded checkers, LLM-as-judge rubrics, and multi-dimensional grading
schemes (Step 3). You can evaluate agents that use tools, plan across steps, and produce
trajectories through complex environments (Step 4).

And you are running all of this by hand.

You paste prompts into a notebook, eyeball the output, copy a score into a spreadsheet,
and call it done. Or you write a Python script that runs 20 samples, prints the accuracy,
and you decide whether the number looks better than last time based on memory. This does
not scale. It does not reproduce. It does not catch regressions. It does not tell you
whether last Tuesday's prompt change made things better or worse, because there is no
record of last Tuesday's run.

This step is about making evaluation a first-class part of your engineering workflow.
Not an afterthought. Not something you do before a release. Something that runs on every
pull request, blocks merges on regression, tracks results over time, and has a budget you
can forecast. The transition from "I run evals sometimes" to "evals run automatically and
I review the results" is the same transition the industry made from manual testing to CI
two decades ago. LLM development is currently where software was before continuous
integration: most teams know testing matters, few have automated it, and the ones who
have automated it ship faster with fewer defects.

> **FIELD MATURITY: EMERGING** - Eval infrastructure as a practice is emerging. Individual
> components exist - Inspect AI provides parallel execution, log viewing, and eval sets;
> Braintrust and LangSmith offer hosted platforms; GitHub Actions can run arbitrary
> pipelines. But the integration of these components into a disciplined eval-driven
> development workflow is not standardised. There is no established equivalent of "just
> use pytest and GitHub Actions" for LLM evaluation.

---

## Table of Contents

1. [Eval-Driven Development](#1-eval-driven-development) (~30 min)
2. [Running Evals at Scale](#2-running-evals-at-scale) (~30 min)
3. [Eval in CI/CD](#3-eval-in-cicd) (~35 min)
4. [Eval Datasets as Versioned Artifacts](#4-eval-datasets-as-versioned-artifacts) (~20 min)
5. [Eval Result Storage and Analysis](#5-eval-result-storage-and-analysis) (~30 min)
6. [Prompt Optimisation Using Evals](#6-prompt-optimisation-using-evals) (~20 min)
7. [Regression Testing for LLM Systems](#7-regression-testing-for-llm-systems) (~20 min)
8. [Eval Cost Budgeting](#8-eval-cost-budgeting) (~25 min)
9. [Key Concepts / Vocabulary](#9-key-concepts--vocabulary)
10. [Challenges](#10-challenges) (~90-120 min)
11. [Key Takeaways](#11-key-takeaways)
12. [Recommended Reading](#12-recommended-reading)
13. [What to Read Next](#13-what-to-read-next)

---

## 1. Eval-Driven Development

*Estimated time: 30 minutes*

The engineering loop in this project is: Read, Verify, Write, Execute, Confirm. Every
cycle produces a verifiable artifact. Eval-driven development maps the same loop onto
LLM system development: write eval, run eval, see failure, improve the system, run eval
again. The eval is the verification step. Without it, you are writing code and hoping.

This is not a metaphor. It is TDD for LLM systems. In test-driven development, you
write a failing test before you write the code that makes it pass. In eval-driven
development, you write a failing eval before you change the prompt, the model, or the
agent architecture. The eval defines what "better" means before you start trying to make
things better. Without that definition, you cannot distinguish improvement from noise.

### The Eval Loop

The eval-driven development loop has five steps:

1. **Define the criterion.** What does success look like for this change? Write it as a
   measurable eval - a dataset with expected outputs, a scoring function, a threshold.

2. **Run the baseline.** Evaluate the current system against your criterion. Record the
   result. If you do not have a baseline, you cannot measure improvement.

3. **Make the change.** Modify the prompt, swap the model, adjust the agent architecture.
   One change at a time. If you change multiple things, you cannot attribute the eval
   result to any specific change.

4. **Re-evaluate.** Run the exact same eval against the modified system. Same dataset,
   same scorer, same parameters.

5. **Compare.** Is the new score better, worse, or within noise? If better, keep the
   change. If worse, revert. If within noise, you need more samples or a more sensitive
   eval.

This loop should be fast. If running your eval suite takes 45 minutes, you will not run
it after every change. You will batch changes, lose the ability to attribute results, and
eventually stop running evals altogether. The rest of this step is about making the loop
fast, cheap, and automatic.

### Why Not Just Use Unit Tests?

Unit tests verify deterministic behaviour: given input X, the function returns Y. LLM
systems are non-deterministic. The same prompt can produce different outputs on successive
calls. This means eval-driven development requires infrastructure that traditional
testing does not:

- **Statistical comparison** instead of binary pass/fail. A 2% accuracy drop across 500
  samples might be noise. A 2% drop across 5,000 samples is probably real. You need
  enough samples and a principled threshold.

- **Baseline management** instead of expected values. Your baseline is a score
  distribution, not a set of assertions.

- **Cost awareness** as a first-class concern. Every eval run costs tokens. Running your
  full suite 50 times a day on GPT-4 as a grader might cost more than your compute budget.

- **Reproducibility with caveats.** You can version your eval code, your dataset, and
  your scoring function. You cannot version the model provider's API behaviour. Timestamp
  your baselines and accept that reproducibility is approximate.

> **AGENTIC GROUNDING:** Eval-driven development is the responsible way to iterate on
> agent systems. An agent that uses tools, plans across steps, and interacts with external
> services has a combinatorial space of possible behaviours. When you change an agent's
> system prompt, you are not changing a function signature - you are changing the
> probability distribution over all possible trajectories. Only systematic evaluation
> tells you whether that distribution shifted in the direction you intended.

### The Inner Loop and the Outer Loop

Eval-driven development operates at two timescales:

**The inner loop** runs on every change. It uses a small, fast eval subset - maybe 50-100
samples with code-graded scoring. The inner loop answers: "Did I break anything obvious?"
Its purpose is rapid feedback, not comprehensive evaluation.

**The outer loop** runs on milestones - before merge, before release, weekly. It uses the
full eval suite, including LLM-graded scoring and larger datasets. The outer loop answers:
"Is the system better than the last milestone?" Its purpose is confidence, not speed.

The inner loop should complete in under 5 minutes and cost less than a dollar. The outer
loop might take 30 minutes and cost $20. Both are eval-driven development. They serve
different purposes and should be budgeted separately.

---

## 2. Running Evals at Scale

*Estimated time: 30 minutes*

Running a single eval sample is straightforward: send a prompt, get a response, score it.
Running 5,000 samples across 3 models with LLM-graded scoring in a sandbox environment
is an infrastructure problem.

### Parallelisation

LLM API calls are I/O-bound. The model is not running on your machine - your code sends
a request, waits, and processes the response. Parallelisation is not about CPU cores but
about concurrent connections.

Inspect AI is built on an async architecture. When you run an eval with 1,000 samples,
Inspect manages a pool of concurrent requests, bounded by configurable limits:

```python
from inspect_ai import eval

logs = eval(
  "my_eval.py",
  model="anthropic/claude-sonnet-4-0",
  max_samples=50,       # max concurrent samples
  max_connections=10,    # max concurrent API connections
  max_sandboxes=8,       # max concurrent Docker containers
)
```

The `max_samples` parameter controls how many samples run simultaneously. Each sample may
involve multiple API calls (solver chain, scorer grading), so `max_connections` controls
the total API concurrency across all active samples. For sandboxed evals, `max_sandboxes`
limits container count (defaults to 2x your CPU count for Docker).

Start with conservative limits and increase until you hit rate limits or resource
constraints. Inspect provides real-time utilisation monitoring so you can see where the
bottleneck is.

### Rate Limiting

Every API provider imposes rate limits - requests per minute, tokens per minute, or both.
The options, in order of preference:

1. **Use your framework's built-in rate limiting.** Inspect AI handles rate limiting
   automatically via `max_connections` with exponential backoff on rate limit errors.

2. **Implement client-side throttling.** If building your own infrastructure, throttle
   requests to stay under the limit rather than hitting it and retrying. A token bucket
   or leaky bucket algorithm works.

3. **Use batch APIs.** Anthropic, OpenAI, and Google all offer batch processing endpoints
   that accept large volumes at reduced rates and deliver results asynchronously. Typically
   50% cheaper but results arrive hours later. Good for the outer loop, impractical for
   the inner loop.

Rate limit headroom matters. If your limit is 1,000 requests per minute and your eval
needs 1,000 requests, do not fill the entire limit. Target 70-80% to leave room for
retries and fluctuations.

### Caching

Many eval runs share significant work. If you change a prompt's system message but your
dataset is the same, some inputs remain identical. Inspect AI has built-in model output
caching:

```bash
inspect eval my_eval.py --model openai/gpt-4o --cache
```

Caching has a correctness caveat: it assumes deterministic behaviour for a given input.
With temperature=0, this is approximately true. With temperature > 0, the cache returns
one sample from a distribution. Use caching for the inner loop, not for final
measurements.

### Batch Mode

Batch APIs are the cost optimisation lever for large-scale evaluation. Anthropic's
Message Batches API accepts up to 10,000 requests per batch with 50% cost discount.
Turnaround is 1-24 hours.

Batch mode is appropriate for outer loop runs, baseline establishment, and multi-model
comparison. It is not appropriate for inner loop iteration or interactive debugging where
you need results in minutes.

### Cost Management

Every eval run has a cost determined by four factors: number of samples, tokens per
sample, model price, and scoring method (code-graded is free, LLM-graded doubles your
API calls). Section 8 covers cost budgeting in detail. The principle: **know what your
eval suite costs before you automate it.** A CI pipeline that runs a $50 eval suite on
every push to a feature branch will exhaust your budget in a week.

> **AGENTIC GROUNDING:** Agent evals are especially expensive because agent trajectories
> involve multiple tool calls, each generating additional API traffic. A single sample in
> an agent eval might involve 10-30 model calls. Multiply by 500 samples and an
> LLM-graded scorer, and a single agent eval run can cost $100+. Cost management is not
> optional for agent evaluation - it determines whether you can afford to iterate.

---

## 3. Eval in CI/CD

*Estimated time: 35 minutes*

The purpose of putting evals in your CI/CD pipeline is the same as putting tests there:
catch regressions before they reach production. The difference is that evals are slower,
more expensive, and non-deterministic.

### The Eval as a Quality Gate

In this project, the quality gate is:

```bash
pnpm run typecheck && pnpm run lint && pnpm run test
```

Three binary checks composed with logical AND. An eval gate extends this pattern:

```bash
pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run eval:check
```

The `eval:check` command runs the eval suite, compares to a stored baseline, and fails
if accuracy drops below a threshold. The gate stays binary (green/red), but the inputs
to the decision now include model evaluation.

> **NOVEL:** The quality gate concept in this project - "the hull is survival, everything
> else is optimisation" - predates this bootcamp. The project's Makefile pipeline already
> composes multiple verification steps (typecheck, lint, test, adversarial review) into a
> single gate. Adding eval regression checks follows the same pattern: another AND clause
> in a composite boolean.

### Make Targets for Eval Execution

Makefiles provide the glue between eval scripts and CI:

```makefile
# eval.mk - Eval targets for CI/CD integration

EVAL_DIR := evals
BASELINE_DIR := evals/baselines
RESULTS_DIR := evals/results
EVAL_MODEL ?= anthropic/claude-sonnet-4-0
EVAL_THRESHOLD ?= 0.02

.PHONY: eval-quick
eval-quick:
	inspect eval $(EVAL_DIR)/core_suite.py \
	  --model $(EVAL_MODEL) \
	  --limit 50 \
	  --log-dir $(RESULTS_DIR)/quick

.PHONY: eval-full
eval-full:
	inspect eval $(EVAL_DIR)/full_suite.py \
	  --model $(EVAL_MODEL) \
	  --log-dir $(RESULTS_DIR)/full

.PHONY: eval-check
eval-check: eval-quick
	python $(EVAL_DIR)/check_regression.py \
	  --baseline $(BASELINE_DIR)/latest.json \
	  --results $(RESULTS_DIR)/quick \
	  --threshold $(EVAL_THRESHOLD)

.PHONY: eval-baseline
eval-baseline: eval-full
	python $(EVAL_DIR)/update_baseline.py \
	  --results $(RESULTS_DIR)/full \
	  --output $(BASELINE_DIR)/latest.json
	@printf 'Baseline updated from full suite run\n'

.PHONY: eval-cost
eval-cost:
	python $(EVAL_DIR)/estimate_cost.py \
	  --suite $(EVAL_DIR)/full_suite.py \
	  --model $(EVAL_MODEL)
```

The structure: `eval-quick` for rapid feedback (50 samples). `eval-full` for
comprehensive evaluation. `eval-check` composes the quick run with regression comparison.
`eval-baseline` establishes the comparison point. `eval-cost` forecasts before committing
resources. The `EVAL_THRESHOLD` variable (default 2%) is a judgment call - too tight
produces false alarms from noise, too loose lets regressions through.

### GitHub Actions Integration

A workflow that runs evals on every pull request:

```yaml
# .github/workflows/eval.yml
name: Eval Suite

on:
  pull_request:
    branches: [main]
    paths:
      - 'prompts/**'
      - 'agents/**'
      - 'evals/**'

jobs:
  eval-quick:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Install dependencies
        run: pip install inspect-ai -r evals/requirements.txt
      - name: Run quick eval suite
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: make eval-check
      - name: Upload eval logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: eval-logs
          path: evals/results/
          retention-days: 30
```

Key design decisions:

**Path filtering.** The workflow only triggers when files in `prompts/`, `agents/`, or
`evals/` change. A CSS fix should not trigger a $5 eval run.

**Timeout.** The 15-minute timeout prevents infinite-cost CI runs when an API is down or
rate limiting is aggressive.

**Artifact upload.** Eval logs are uploaded regardless of pass/fail (`if: always()`).
When a regression is detected, you need the logs to diagnose which samples failed.

**Secrets management.** API keys stored as GitHub Actions secrets, not in the repository.

For the full eval suite, add a second job that triggers only on merge:

```yaml
  eval-full:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    if: github.event.pull_request.merged == true
    steps:
      # same setup...
      - run: make eval-full
```

### Full vs Subset Runs

The distinction between quick and full runs is about statistical power:

| Trigger | Suite | Samples | Est. cost | Est. time | Detectable regression |
|---------|-------|---------|-----------|-----------|----------------------|
| Every PR push | Quick | 50 | $0.50-2 | 2-5 min | > 10% |
| PR approval | Medium | 200 | $2-8 | 5-15 min | > 5% |
| Post-merge | Full | 1000+ | $10-50 | 15-45 min | > 2% |
| Weekly | Extended | 5000+ | $50-200 | 1-4 hours | > 1% |

Match the eval investment to the decision it supports. A PR push needs a quick sanity
check. A production release needs comprehensive evaluation.

> **AGENTIC GROUNDING:** Every CI pipeline that runs `typecheck && lint && test` is an
> eval pipeline with code-graded binary scorers. The extension to LLM evaluation adds
> non-deterministic, statistically-evaluated checks to the same pipeline. The gate
> concept does not change. The scorer complexity changes.

---

## 4. Eval Datasets as Versioned Artifacts

*Estimated time: 20 minutes*

An eval is only as good as its dataset. If the dataset changes without tracking, your
eval results are not comparable across runs. Eval datasets must be versioned with the
same discipline as source code.

### Git-Tracked JSONL

The simplest approach for datasets under 100MB: store JSONL files in your git repository
alongside the eval code.

```
evals/
  datasets/
    slopodar_detection.jsonl
    code_review_quality.jsonl
  scorers/
    slopodar_scorer.py
  baselines/
    latest.json
  full_suite.py
  core_suite.py
```

Each JSONL line is a complete sample:

```jsonl
{"input": "Classify the anti-pattern: 'The uncomfortable truth is that nobody talks about this.'", "target": "epistemic-theatre", "metadata": {"category": "prose", "difficulty": "easy"}}
{"input": "Classify the anti-pattern: 'We mapped 15 systems to 7 domains across 4 layers.'", "target": "tally-voice", "metadata": {"category": "prose", "difficulty": "easy"}}
{"input": "Classify the anti-pattern: 'The data suggests a possible trend.'", "target": "none", "metadata": {"category": "control", "difficulty": "medium"}}
```

Git gives you history (`git log`), diff (which samples changed), bisect (when did scores
drop), branching (experimental variants), and reproducibility (any commit hash gives the
exact dataset).

### Dataset Registries

A registry maps logical names to physical files. Inspect AI uses a function-based
pattern:

```python
from inspect_ai import Task, task
from inspect_ai.dataset import json_dataset
from inspect_ai.scorer import exact
from inspect_ai.solver import generate

@task
def slopodar_detection():
  return Task(
    dataset=json_dataset("evals/datasets/slopodar_detection.jsonl"),
    solver=generate(),
    scorer=exact(),
  )
```

The OpenAI Evals CLI uses a YAML registry:

```yaml
slopodar-detection:
  id: slopodar-detection.dev.v1
  metrics: [accuracy]
slopodar-detection.dev.v1:
  class: evals.elsuite.basic.match:Match
  args:
    samples_jsonl: slopodar/samples.jsonl
```

The registry pattern lets you swap datasets without changing eval code. A `--dataset`
flag or environment variable selects the variant.

### Schema Validation

Dataset bugs are eval bugs. A missing `target` field, malformed JSON, or empty `input`
will produce an error at eval time - or worse, a silent incorrect score. Validate before
running:

```python
#!/usr/bin/env python3
"""Validate eval dataset schema."""
import json, sys
from pathlib import Path

REQUIRED = {"input", "target"}

def validate(path: Path) -> list[str]:
  errors = []
  with open(path) as f:
    for n, line in enumerate(f, 1):
      if not line.strip():
        continue
      try:
        sample = json.loads(line)
      except json.JSONDecodeError as e:
        errors.append(f"Line {n}: invalid JSON - {e}")
        continue
      for field in REQUIRED:
        if field not in sample:
          errors.append(f"Line {n}: missing '{field}'")
  return errors

if __name__ == "__main__":
  errs = validate(Path(sys.argv[1]))
  for e in errs:
    print(f"ERROR: {e}", file=sys.stderr)
  sys.exit(1 if errs else 0)
```

Run this as a pre-commit hook or Make target. Catch dataset bugs before they become eval
bugs.

### When Git Is Not Enough

For datasets over 100MB, three options: **Git LFS** (pointer files in git, data in LFS
storage - the OpenAI Evals approach), **DVC** (git-like version control for data, stores
in S3/GCS), or **platform-managed** (Braintrust, LangSmith). For most eval datasets in
this bootcamp's scope (JSONL files under 10MB), plain git is the right choice.

> **SLOPODAR:** "Paper guardrail" - writing "all datasets must be validated" in a README
> without an actual validation script or pre-commit hook. If the only enforcement
> mechanism is a sentence in a document, it is paper. Add the script, add the hook, add
> the Make target.

---

## 5. Eval Result Storage and Analysis

*Estimated time: 30 minutes*

Running evals produces data. Where that data goes and how you analyse it determines
whether eval results inform decisions or disappear into log files nobody reads.

### Log Files

Inspect AI writes structured log files to `./logs/` by default. Each `.eval` file
contains task configuration, full conversation history for every sample, scores, aggregate
metrics, model usage statistics, and timing information. Read them programmatically:

```python
from inspect_ai.log import read_eval_log, list_eval_logs

logs = list_eval_logs("./logs/")
log = read_eval_log(logs[0].name)

print(f"Model: {log.eval.model}")
print(f"Accuracy: {log.results.scores[0].metrics['accuracy'].value}")
```

If you are not using Inspect, store results in structured JSON or JSONL. Every result
file should include: eval identifier, model, date, dataset version (git commit hash), and
aggregate metrics. Without these fields, comparisons are not meaningful.

### Dataframes for Analysis

Inspect AI provides a dataframe API that connects directly to the pandas and DuckDB
skills from Bootcamp III:

```python
log = read_eval_log("./logs/2026-03-10_my_eval.eval")
samples_df = log.results.scores[0].as_df()

# Filter to failing samples
failures = samples_df[samples_df["score"] == 0]

# Group by metadata category
by_category = samples_df.groupby("metadata.category")["score"].mean()
```

For analysis across multiple runs, DuckDB (Bootcamp III Step 4) handles aggregation:

```python
import duckdb
con = duckdb.connect()
con.execute("""
  SELECT date, model, accuracy,
    accuracy - LAG(accuracy) OVER (PARTITION BY model ORDER BY date) AS delta
  FROM read_json_auto('evals/results/*/metrics.json')
  ORDER BY date
""").fetchdf()
```

### Trend Analysis

Single eval results are snapshots. Trends tell the story. Tracking accuracy over time
reveals:

- **Regression** - a sudden drop after a specific commit.
- **Degradation** - a slow decline over weeks, invisible in any single run.
- **Improvement plateau** - accuracy stops improving despite continued prompt engineering.
- **Variance changes** - the mean stays the same but standard deviation increases.

A minimal approach: append results as JSONL records with timestamp, eval name, model,
accuracy, sample count, and commit hash. This is append-only, git-tracked, and readable
by any tool. You do not need a database until you have hundreds of runs.

### The Inspect Log Viewer

Inspect AI includes a web-based log viewer:

```bash
inspect view --log-dir ./logs/
```

This shows task summaries, individual sample results with conversation histories, score
distributions, and model usage. It updates automatically when new evals complete. For
sharing results, Inspect supports publishing log viewer bundles as static HTML.

> **NOVEL:** The catch-log pattern from this project (`docs/internal/weaver/catch-log.tsv`)
> is an alternative approach to eval result storage. It is an append-only TSV where each
> row records a single control firing event: date, which control fired, what it caught,
> which agent caught it, the outcome (logged, reviewed, blocked, fixed, scrubbed), and
> notes. This captures something structured eval logs do not: the results of continuous
> evaluation during normal work, not just during dedicated eval runs. Every slopodar
> detection, every darkcat finding, every L11/L12 catch is a data point. The catch-log
> turns operational quality control into a time series.

---

## 6. Prompt Optimisation Using Evals

*Estimated time: 20 minutes*

Anthropic's guidance on prompt engineering recommends starting with simple prompts and
optimising with comprehensive evaluation. In practice, this is where most teams encounter
Goodhart's law for the second time (the first being Step 1 of this bootcamp).

### The Optimisation Loop

1. **Baseline.** Run your eval suite with the current prompt. Record the score.
2. **Hypothesis.** Identify a specific weakness. Not "make it better" but "reduce
   incomplete code blocks" or "improve accuracy on multi-step reasoning samples."
3. **Change.** Modify the prompt to address the specific weakness. One change per
   iteration.
4. **Re-evaluate.** Run the same eval suite. Compare to baseline.
5. **Decision.** Keep if improvement exceeds noise. Revert if not.
6. **Update baseline.** The new score becomes the comparison point.

The difficulty is in step 2. Aggregate accuracy tells you the system underperforms but
not why. Failing samples cluster by property (length, topic, complexity). Identifying
these clusters is where the dataframe analysis from Section 5 earns its value.

### Avoiding Goodhart Hill-Climbing

Goodhart's law (Step 1, Section 7): when a measure becomes a target, it ceases to be a
good measure. In prompt optimisation, this manifests as:

- **Overfitting to the eval dataset.** After 20 iterations on 200 samples, your prompt is
  tailored to those 200 samples, not the general task.

- **Optimising for the scorer, not the task.** If your scorer rewards verbosity, your
  optimisation loop produces verbose output. The score improves. Quality does not.

- **Hill-climbing to a local maximum.** Incremental changes find the best version of the
  current approach but cannot discover fundamentally different approaches.

The controls:

**Hold-out sets.** Split your dataset into development (for iteration) and held-out (for
final evaluation). Never optimise against the held-out set. Report the held-out score.

**Multiple scorers.** If code-graded accuracy improves but LLM-graded quality drops, you
are optimising for the wrong thing.

**Human spot-checks.** Periodically review random outputs by hand. The aggregate score can
improve while output quality degrades in ways your scorer misses. This is the "not wrong"
problem from the slopodar.

**Iteration limits.** Five to ten iterations per prompt variant is a reasonable starting
point. If you see no improvement by iteration 10, the problem is not the prompt.

> **SLOPODAR:** "Analytical lullaby" - warm numbers with no caveats. "Accuracy improved
> from 78% to 84% across 15 iterations" sounds like progress until you learn that
> held-out accuracy went from 78% to 77%. Always report held-out performance alongside
> development set performance.

---

## 7. Regression Testing for LLM Systems

*Estimated time: 20 minutes*

A regression is when something that used to work stops working. In LLM systems,
regression testing is complex because the system is non-deterministic and "working" is a
statistical property, not a binary one.

### The Eval Suite as a Regression Suite

Your eval suite is your regression test suite. The samples that pass today define the
baseline. A regression is a statistically significant drop in accuracy.

But there is a subtlety traditional testing lacks: **natural variance.** Run the same eval
twice - you will not get identical results. Temperature > 0 introduces variance. Even
temperature=0 does not guarantee identical output across API versions.

You cannot treat every score drop as a regression. The threshold depends on sample size
(more samples, tighter confidence intervals), base accuracy (2% drop from 95% differs
from 2% drop from 55%), and acceptable risk (safety-critical evals need tighter
thresholds).

### Baseline Management

A baseline represents "the system working correctly." It must be versioned, timestamped,
and refreshable. A minimal baseline file:

```json
{
  "eval": "slopodar_detection",
  "model": "anthropic/claude-sonnet-4-0",
  "date": "2026-03-10",
  "commit": "a1b2c3d",
  "dataset_commit": "e4f5g6h",
  "accuracy": 0.87,
  "accuracy_stderr": 0.015,
  "samples": 500,
  "scores_by_category": {
    "prose": 0.92,
    "relationship": 0.84,
    "code": 0.85
  }
}
```

The `dataset_commit` field is critical. If the dataset changed between baseline and
current run, the comparison is invalid.

### Regression Detection

A simple regression check:

```python
#!/usr/bin/env python3
"""Check for regression against baseline."""
import json, sys, argparse
from pathlib import Path

def check(baseline_path, results_path, threshold=0.02):
  baseline = json.loads(Path(baseline_path).read_text())
  results = json.loads(Path(results_path).read_text())
  delta = results["accuracy"] - baseline["accuracy"]
  print(f"Baseline: {baseline['accuracy']:.3f} | "
        f"Current: {results['accuracy']:.3f} | Delta: {delta:+.3f}")
  if delta < -threshold:
    print(f"REGRESSION: dropped {abs(delta):.3f} "
          f"(threshold: {threshold:.3f})", file=sys.stderr)
    return False
  return True

if __name__ == "__main__":
  p = argparse.ArgumentParser()
  p.add_argument("--baseline", required=True)
  p.add_argument("--results", required=True)
  p.add_argument("--threshold", type=float, default=0.02)
  a = p.parse_args()
  sys.exit(0 if check(a.baseline, a.results, a.threshold) else 1)
```

A more sophisticated version would use statistical tests (two-proportion z-test),
check category-level regressions (overall accuracy can stay flat while one category
degrades), and track per-sample stability (which samples flipped from pass to fail).

> **AGENTIC GROUNDING:** Regression testing for agent systems has an additional dimension:
> trajectory regression. An agent might still reach the correct answer but via a worse
> path - more tool calls, more tokens, more time. If your eval only checks endpoints, you
> miss trajectory regressions. Include trajectory metrics in the baseline and comparison.

---

## 8. Eval Cost Budgeting

*Estimated time: 25 minutes*

Every LLM eval run costs money. Budgeting for eval infrastructure is a real engineering
constraint, not an afterthought.

### Cost Estimation Formula

```
cost = samples x (test_cost_per_sample + grader_cost_per_sample)

test_cost_per_sample  = (input_tokens x input_price) + (output_tokens x output_price)
grader_cost_per_sample = (grader_input_tokens x grader_input_price)
                       + (grader_output_tokens x grader_output_price)
```

For code-graded scoring, `grader_cost_per_sample` is zero.

### Realistic 2026 Pricing

Approximate pricing as of early 2026 (verify current rates):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|----------------------|
| Claude Haiku 3.5 | $0.80 | $4.00 |
| Claude Sonnet 4 | $3.00 | $15.00 |
| Claude Opus 4 | $15.00 | $75.00 |
| GPT-4o | $2.50 | $10.00 |
| GPT-4o mini | $0.15 | $0.60 |
| Gemini 2.5 Flash | $0.15 | $0.60 |

**Example: 500 samples, Claude Sonnet under test, 500 input / 50 output tokens avg.**

| Scoring method | Grader | Grader tokens | Test cost | Grader cost | Total |
|----------------|--------|---------------|-----------|-------------|-------|
| Code-graded | none | 0 | $1.13 | $0.00 | **$1.13** |
| LLM (cheap) | GPT-4o mini | 1000 in / 300 out | $1.13 | $0.17 | **$1.30** |
| LLM (frontier) | Claude Opus | 1000 in / 300 out | $1.13 | $18.75 | **$19.88** |

The difference between cheap and frontier grading is $18.58 per run. That is the cost
of using a frontier model as your grader. The question: is the grading quality difference
worth it?

### The Accuracy-Cost Tradeoff

**Code-graded (free).** Exact match, regex, includes, F1. Zero marginal cost. Perfect for
unambiguous correct answers. Cannot handle open-ended tasks or nuanced quality judgments.

**LLM-graded with cheap model ($0.10-$1 per 500 samples).** GPT-4o mini, Gemini Flash,
Claude Haiku. Good enough for many tasks with well-designed rubrics.

**LLM-graded with frontier model ($15-50 per 500 samples).** Claude Opus, GPT-4o. Highest
quality, especially for open-ended evaluation. Cost limits frequency.

The practical approach: **code-graded wherever possible, cheap LLM for the inner loop,
frontier LLM for the outer loop.**

### Budget Forecasting

```
monthly = (inner_cost x inner_runs/day x 22 working days)
        + (outer_cost x outer_runs/week x 4 weeks)
        + (extended_cost x extended_runs/month)

# Team of 3 engineers:
= ($1.30 x 15 x 22) + ($20 x 5 x 4) + ($100 x 2)
= $429 + $400 + $200
= $1,029/month
```

This is a real budget line item. For a solo developer, adjust: fewer runs, cheaper
graders, smaller datasets. The numbers should inform decisions, not prevent evaluation.

### Cost Optimisation Strategies

1. **Prefer code-graded scoring.** If the criterion is deterministic, do not pay for LLM
   grading.
2. **Batch APIs for the outer loop.** The 50% discount applies to both test and grader
   calls. A $20 run costs $10 in batch mode.
3. **Cache in the inner loop.** If iterating on the rubric but not the input, cache model
   responses and only re-run the scorer.
4. **Subsample for expensive graders.** Run all 1,000 samples through code scoring, but
   only 200 through the frontier grader (stratified by difficulty).
5. **Cheap grader as pre-filter.** Accept confident judgments from a cheap model, escalate
   uncertain samples to the frontier grader. Can reduce frontier usage by 60-80%.

> **NOVEL:** The cost modelling approach here connects to Bootcamp III Step 8 (cost
> modelling for data pipelines). The same dimensional analysis applies: identify cost
> drivers, estimate per-unit costs, multiply by volume, forecast the total. The
> application to eval infrastructure - where cost drivers are tokens and scoring methods
> rather than compute hours - is a natural extension.

> **AGENTIC GROUNDING:** Eval cost budgeting is a real constraint for agent development.
> When an agent eval involves 20+ tool calls per sample, 500 samples, and an LLM scorer,
> a single run can cost $100+. Daily, that is $2,200/month on eval alone. Cost awareness
> is not frugality - it is the difference between a sustainable eval practice and one that
> gets cancelled after the first invoice.

---

## 9. Key Concepts / Vocabulary

- **Eval-driven development.** Write eval before making changes. The LLM equivalent of
  TDD. Define "better" before trying to make things better.

- **Inner loop / outer loop.** Inner: fast, cheap, frequent (every change). Outer:
  comprehensive, expensive, periodic (milestones).

- **Quality gate.** A composite boolean check that must pass before a change is accepted.
  Extended with eval regression checks.

- **Eval registry.** A mapping from logical eval names to physical implementations.

- **Baseline.** Stored eval results representing "the system working correctly."
  Versioned, timestamped, refreshable.

- **Regression threshold.** Minimum accuracy drop that triggers failure. Too tight: false
  alarms. Too loose: real regressions slip through.

- **Dataset versioning.** Tracking eval datasets with the same discipline as source code.

- **Eval cost.** samples x (test_cost + grader_cost). Three tiers: code-graded (free),
  cheap LLM ($0.10-$1 per 500), frontier LLM ($15-50 per 500).

- **Batch mode.** Bulk API requests at reduced cost (50% discount, hours of latency).

- **Held-out set.** Samples reserved for final evaluation, never used during optimisation.

---

## 10. Challenges

*Estimated time: 90-120 minutes total*

These challenges build eval infrastructure. Each produces a working artifact.

---

### Challenge 1: Build a Makefile Target That Blocks on Regression

*Estimated time: 40-50 minutes*
*Type: Build*

Build a complete eval CI pipeline as a set of Makefile targets.

**Deliverable:** A Makefile with targets for running an eval suite, comparing results to
a baseline, failing if accuracy drops more than 2%, and updating the baseline.

**Design constraints:**
- Must have both `eval-quick` (fast subset) and `eval-full` (complete) targets
- `eval-check` must compose `eval-quick` with a regression check script
- `make eval-check` must exit non-zero on regression (suitable for CI gate)
- Regression threshold configurable via Make variable
- Use `printf` for output, never `echo`

**Evaluation criteria:**
- Does `make eval-check` correctly detect a 5% regression? Correctly pass a 1% drop?
- Does `make eval-baseline` update the stored baseline?
- Are targets properly declared `.PHONY`?

<details>
<summary>Design guidance</summary>

Start with the regression check script (reads two JSON files, compares accuracy, exits
non-zero if drop exceeds threshold). Then build Make targets around it. For testing
without API access, use a fake eval script that generates random accuracy around 0.85:

```python
import json, random, sys
results = {"eval": "test", "accuracy": 0.85 + random.uniform(-0.03, 0.03), "samples": 50}
with open(sys.argv[1] if len(sys.argv) > 1 else "results.json", "w") as f:
  json.dump(results, f, indent=2)
```

</details>

---

### Challenge 2: Eval Result Storage and Trend Analysis

*Estimated time: 30-40 minutes*
*Type: Analyse*

Set up eval result storage and build a trend analysis pipeline.

**Deliverable:** A JSONL history file with at least 5 eval run records, and a Python
script that reports: mean accuracy, standard deviation, trend direction
(improving/stable/degrading), and the commit with best and worst scores.

**Design constraints:**
- JSONL format, one record per line
- Each record: timestamp (ISO 8601), eval name, model, accuracy, sample count, commit
- Analysis script works with any number of records
- If you have matplotlib (Bootcamp III Step 5), produce a plot. Otherwise, text summary
- Connect to Bootcamp III: use pandas or DuckDB if you have those skills

**Evaluation criteria:**
- Consistent schema across all records?
- Correctly identifies trend direction?
- Handles edge cases (single record, zero variance)?

<details>
<summary>Design guidance</summary>

Generate 5 records by running a simulated eval with slight variation. For trend
detection, compute the linear regression slope of accuracy over time. Positive = improving,
near-zero = stable, negative = degrading.

```python
n = len(records)
x = list(range(n))
y = [r["accuracy"] for r in records]
slope = (n * sum(a*b for a, b in zip(x, y)) - sum(x) * sum(y)) / \
        (n * sum(a**2 for a in x) - sum(x)**2)
```

</details>

---

### Challenge 3: Eval Cost Calculator

*Estimated time: 20-30 minutes*
*Type: Analyse*

Calculate the cost of running your eval suite under three scoring methods.

**Deliverable:** A Python script that takes eval parameters (sample count, avg input/output
tokens, model, grader model) and outputs a cost comparison table for code-graded,
LLM-graded cheap, and LLM-graded frontier. Include monthly budget forecasts.

**Design constraints:**
- Realistic 2026 token prices (refer to Section 8 table)
- Include both test cost and grader cost
- Monthly cost assuming: 15 inner runs/day (22 days), 5 outer runs/week, 2 extended/month
- Include batch mode pricing (50% discount) as alternative for outer loop
- Formatted table output

**Evaluation criteria:**
- Mathematically correct cost calculations?
- Monthly forecast accounts for all three cadences?
- Clearly shows cost difference between grading tiers?
- Batch mode included as cost reduction option?

<details>
<summary>Design guidance</summary>

For grader input tokens, estimate: input_tokens + output_tokens + 300 (rubric overhead).
Structure the calculator around:

```
cost_per_sample = input_tokens * input_price + output_tokens * output_price
grader_per_sample = grader_in * grader_in_price + grader_out * grader_out_price
total = samples * (cost_per_sample + grader_per_sample)
```

</details>

---

## 11. Key Takeaways

Before moving to Step 6, you should be able to answer these questions without looking
anything up:

1. What is the eval-driven development loop, and how does it differ from running evals
   as an afterthought?

2. Why do you need separate inner loop and outer loop eval runs, and what determines
   which samples go in each?

3. What makes regression detection harder for LLM systems than for traditional software,
   and how do thresholds address this?

4. What are the three cost tiers for eval scoring, and when is each appropriate?

5. Why does prompt optimisation against a fixed eval dataset risk Goodhart's law, and
   what controls mitigate it?

6. What information must a baseline file contain to enable valid regression comparison?

7. How does batch mode reduce eval costs, and what tradeoff does it impose?

8. Why should eval datasets be versioned in git, and what field in a baseline file
   ensures dataset identity?

---

## 12. Recommended Reading

- **Inspect AI documentation** - https://inspect.ai-safety-institute.org.uk/. The most
  complete open-source eval framework. Sections on parallelism, eval sets, and log viewer
  are directly relevant. 100+ pre-built evals demonstrate dataset and eval packaging.

- **OpenAI Evals documentation** - https://platform.openai.com/docs/guides/evals. The
  trace grading guide covers agent-specific evaluation at the trajectory level. Note: the
  open-source `openai/evals` CLI is being superseded by this platform approach.

- **Anthropic prompt engineering guide** - The section on evaluation-driven prompt
  optimisation. The recommendation to "start with simple prompts, optimize with
  comprehensive evaluation."

- **Braintrust documentation** - https://www.braintrust.dev/. Demonstrates the "trace to
  dataset" workflow and the observe-evaluate-iterate loop from a platform perspective.

- **Hamel Husain, "Your AI Product Needs Evals"** - Widely cited practitioner guidance
  on building evals into the development workflow.

- **Bootcamp I Step 6** (Make/Just) - Build automation fundamentals underpinning the
  Makefile-based eval infrastructure.

- **Bootcamp III Step 4** (SQL and DuckDB) - Analytical tools for processing eval results
  at scale. DuckDB queries JSONL files directly.

- **Bootcamp III Step 8** (Cost Modelling) - Dimensional analysis for cost estimation,
  applied here to eval budgeting.

---

## What to Read Next

**Step 6: Adversarial Testing Methodology** - You now have infrastructure to run evals at
scale, track results, detect regressions, and manage costs. Step 6 applies this to a
specific and critical use case: adversarial testing. Where this step asked "is the system
still performing at baseline?", Step 6 asks "what happens when the system faces inputs
designed to break it?" Adversarial testing requires everything from this step - automated
pipelines, result storage, multi-model comparison - deployed against a different question.
The infrastructure is the same. The intent is different. And the field maturity shifts
from EMERGING to FRONTIER, because structured adversarial testing methodology for LLM
systems is where published best practices end and operational experience begins.

> **NOVEL:** The darkcat alley pipeline from this project is a worked example of
> adversarial eval automation. Three independent models (from different providers) review
> the same code snapshot using structured YAML output. The `bin/triangulate` script
> parses reviews, matches findings across models (0.3 * file_similarity + 0.7 *
> title_similarity, threshold 0.6), and computes convergence metrics. Convergence builds
> confidence. Divergence locates model-specific bias. This is eval infrastructure applied
> to adversarial review - the same principles from this step (automation, structured
> output, statistical comparison) deployed for a different purpose. Step 6 unpacks the
> methodology.

