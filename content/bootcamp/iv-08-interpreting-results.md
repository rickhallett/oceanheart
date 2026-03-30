+++
title = "Interpreting and Communicating Eval Results"
date = "2026-03-10"
description = "Confidence intervals, honest model comparison, eval limitations, avoiding eval theatre."
tags = ["evals", "statistics", "communication", "bootcamp"]
step = 8
tier = 3
estimate = "3-4 hours"
bootcamp = 4
+++

Step 8 of 9 in Bootcamp IV: Evaluation & Adversarial Testing.

---

## Why This Step Exists

You can now design, build, and run evaluations (Steps 1-7). Each skill produces data.
None produces a decision.

The gap between an eval score and a deployment decision is where most eval misuse lives.
85% accuracy is data. Whether 85% is good enough is a judgment. Whether the 85% is
stable or might really be 78% is a statistical question. Whether it means anything for
your use case is a validity question. Whether the report reader understands all this
determines whether the eval leads to a good decision or a bad one.

This step is Step 8 because interpretation requires all prior steps: construct validity
(Step 1), dataset design (Step 2), scoring methods (Step 3), and the safety frameworks
from Steps 6 and 7.

The goal is a reliable toolkit for three questions about any eval result: Is this number
stable? What does it mean in context? And what does it fail to tell us?

---

## Table of Contents

1. [The Gap Between Scores and Decisions](#1-the-gap-between-scores-and-decisions) (~20 min)
2. [Confidence Intervals for Eval Results](#2-confidence-intervals-for-eval-results) (~35 min)
3. [Comparing Models Honestly](#3-comparing-models-honestly) (~35 min)
4. [Communicating Eval Limitations](#4-communicating-eval-limitations) (~25 min)
5. [Eval Reports as Decision Documents](#5-eval-reports-as-decision-documents) (~30 min)
6. [Avoiding Eval Theatre](#6-avoiding-eval-theatre) (~25 min)
7. [Key Concepts / Vocabulary](#7-key-concepts--vocabulary)
8. [Challenges](#8-challenges) (~60-90 min)
9. [Key Takeaways](#9-key-takeaways)
10. [Recommended Reading](#10-recommended-reading)
11. [What to Read Next](#11-what-to-read-next)

---

## 1. The Gap Between Scores and Decisions

*Estimated time: 20 minutes*

A model scores 85% accuracy. Is that good?

The answer depends entirely on context. Consider three scenarios using that same number:

**Scenario A: Medical diagnosis triage.** 85% accuracy means 15% of findings are missed
or falsely flagged. If the errors are concentrated in misses, patients with real
pathology go unreviewed. In this context, 85% is dangerous.

**Scenario B: Content classification.** 85% accuracy means 15% of support tickets are
misrouted. They get rerouted manually at a cost of minutes per ticket. In this context,
85% is probably acceptable.

**Scenario C: Code generation.** 85% of generated functions pass the test suite. But if
the 15% failures are subtle logic errors that pass the linter, the cost is high. If they
are syntax errors caught by tooling, the cost is low. Same score, different risk.

The score is identical. The decision is different in each case.

### Context Determines Sufficiency

The missing piece in every eval score is a sufficiency threshold. Sufficiency depends on:

- **Cost of error.** A chatbot mistake is an inconvenience. A medical mistake is a
  potential injury.
- **Error distribution.** 85% overall with 99% on easy cases and 30% on hard cases
  is different from 85% uniformly distributed. The hard cases usually matter most.
- **Fallback mechanisms.** Human-supervised deployment tolerates lower accuracy than
  autonomous deployment.
- **Baseline.** 85% is poor vs. a 92% predecessor, excellent vs. 70%, meaningless
  with no baseline.

None of these factors are captured in the score. All are required for a decision.

### The Accuracy Number Hides Structure

A single accuracy number is a summary statistic that discards information. Consider a
model evaluated on 200 code generation tasks: 170 correct (85% accuracy), 20 with
syntax errors (caught by linter), 7 with logic errors (caught by test suite), 3 with
subtle correctness bugs (not caught by any automated check).

The summary says 85%. The structure says: 3 failures out of 200 slip through all
automated checks. The decision-relevant fact is those 3 uncaught failures, not the
85% headline. If your eval only measures whether code runs without errors, you are
measuring syntax correctness, not logical correctness (Step 1, construct validity).

> **AGENTIC GROUNDING:** When evaluating an agent system, the gap between score and
> decision is wider than for a standalone model. The agent's accuracy depends on the
> model, the tools, the prompt chain, the retry logic, and the environment. An eval
> score describes performance in one configuration. A deployment decision applies to a
> configuration that will inevitably differ. The question is not "did the agent score
> well?" but "will the agent score well in the conditions it will actually encounter?"

---

## 2. Confidence Intervals for Eval Results

*Estimated time: 35 minutes*

When someone reports "our model scores 85% accuracy," they are presenting a point
estimate as if it were a fact. It is not a fact. It is a sample statistic computed from
a finite dataset. If you ran the eval on a different sample of the same difficulty, you
would get a different number. The question is: how different?

### Why Eval Scores Are Noisy

Suppose you evaluate a model on 100 test cases and it gets 85 correct. Your point
estimate of accuracy is 85%. But if the model's true accuracy (on the full population
of possible test cases) is actually 82%, you would not be surprised to see 85 out of
100 correct in one sample. You also would not be surprised to see 79 or 88. The sample
is too small to pin down the true accuracy precisely.

This is not theoretical. Many evals use small datasets: human preference (100-500
samples), safety (50-200), domain-specific (100-300). Even published benchmarks break
into subtasks with 50-200 samples each. With 100 samples and 85% accuracy, the true
accuracy could plausibly be anywhere from 77% to 91%. Reporting just "85%" claims a
precision the data does not support.

> **FIELD MATURITY: ESTABLISHED** - Confidence intervals are standard statistical
> methodology (Efron & Tibshirani 1993). Their application to LLM evaluation reporting
> is not yet standard practice, which is why this is an EMERGING step despite using
> ESTABLISHED techniques. Most published benchmark results still report point estimates
> without confidence intervals.

### Bootstrap Confidence Intervals

The bootstrap method (Bootcamp III Step 4) gives you confidence intervals without
requiring distributional assumptions. This matters for eval scores because the
distribution of correct/incorrect answers is often not normal, especially at the extremes
(very high or very low accuracy) or when the dataset contains clusters of difficulty.

The procedure:

1. You have n eval results (correct/incorrect for each sample).
2. Resample n results with replacement. Some samples appear twice, some are omitted.
3. Compute accuracy on the resampled set.
4. Repeat steps 2-3 many times (typically 10,000).
5. The 2.5th and 97.5th percentiles of the resampled accuracies form the 95%
   confidence interval.

Here is a runnable implementation:

```python
import numpy as np

def bootstrap_ci(results, n_bootstrap=10000, ci=0.95, seed=42):
  """Compute bootstrap confidence interval for accuracy.
  results: array of 0/1 (incorrect/correct) for each eval sample.
  Returns (point_estimate, lower_bound, upper_bound)."""
  rng = np.random.default_rng(seed)
  results = np.asarray(results)
  n = len(results)
  point_estimate = results.mean()

  # Generate all bootstrap samples at once for efficiency
  boot_indices = rng.integers(0, n, size=(n_bootstrap, n))
  boot_means = results[boot_indices].mean(axis=1)

  alpha = (1 - ci) / 2
  lower = np.percentile(boot_means, 100 * alpha)
  upper = np.percentile(boot_means, 100 * (1 - alpha))
  return point_estimate, lower, upper


# Example: 85 correct out of 100
results = np.array([1] * 85 + [0] * 15)
acc, lower, upper = bootstrap_ci(results)
print(f"Accuracy: {acc:.1%} (95% CI: [{lower:.1%}, {upper:.1%}])")
# Output: Accuracy: 85.0% (95% CI: [77.0%, 92.0%])
```

The output tells you: "Our model scores 85.0% +/- ~7.5% (95% CI)." That is a
fundamentally different statement from "our model scores 85%." The first tells you
what you know and what you do not know. The second tells you only what you want to hear.

### What the CI Tells You (and Does Not)

The 95% CI [77%, 92%] means: if you repeated this evaluation on many random samples
of the same size, 95% of computed intervals would contain the true accuracy. It does
not mean there is a 95% probability the true accuracy falls in this range (that is a
Bayesian credible interval).

What the CI does not tell you: (1) whether your dataset is representative - a tight CI
around a biased estimate is precisely wrong; (2) whether you are measuring the right
construct; (3) whether performance is stable over time - model updates can shift results
outside the CI.

### Sample Size Guidance

How many eval samples do you need for useful precision? Here is a practical reference
table, assuming the true accuracy is near the observed accuracy:

| Sample Size | Observed 85% | Approximate 95% CI Width |
|-------------|-------------|--------------------------|
| 50          | 85%         | +/- 10% (75%-95%)        |
| 100         | 85%         | +/- 7% (78%-92%)         |
| 200         | 85%         | +/- 5% (80%-90%)         |
| 500         | 85%         | +/- 3% (82%-88%)         |
| 1,000       | 85%         | +/- 2% (83%-87%)         |
| 5,000       | 85%         | +/- 1% (84%-86%)         |

The CI width scales roughly as 1/sqrt(n). To halve the CI width, you need four times
as many samples. This means going from "roughly right" (n=100, +/-7%) to "precisely
right" (n=1000, +/-2%) requires 10x the data, which may mean 10x the cost.

For practical eval design:

- **Screening** (worth investigating?): 50-100 samples. Wide CIs are acceptable.
- **Comparison** (A better than B?): 200-500 samples for meaningful differences.
- **Deployment** (safe enough for production?): 500-2000 samples. Worst-case CI
  bound must meet your sufficiency threshold.
- **Safety-critical** (could cause serious harm?): as many as possible plus
  qualitative analysis. Dangerous cases are rare by definition.

```python
from scipy import stats

def samples_for_ci_width(target_width, estimated_accuracy=0.85, ci=0.95):
  """Estimate sample size needed for a target CI width.
  Uses the normal approximation for a proportion."""
  z = stats.norm.ppf((1 + ci) / 2)
  p = estimated_accuracy
  # Width = 2 * z * sqrt(p*(1-p)/n), solve for n
  return int(np.ceil((2 * z / target_width) ** 2 * p * (1 - p)))

# How many samples for +/- 3% at 85% accuracy?
print(f"Samples needed for +/- 3%: {samples_for_ci_width(0.06)}")
# Output: Samples needed for +/- 3%: 545
```

> **AGENTIC GROUNDING:** Agent evaluations often have small sample sizes because each
> eval run is expensive: the agent may need minutes of compute, tool calls, and
> environment setup per sample. A 50-sample agent eval with 80% task completion
> means the 95% CI is roughly [67%, 90%]. Reporting "80% task completion" without
> the CI gives a false impression of certainty. Including the CI forces honesty about
> what you actually know.

---

## 3. Comparing Models Honestly

*Estimated time: 35 minutes*

Model A scores 87% on your eval. Model B scores 85%. Is Model A better?

The instinctive answer is yes. The honest answer is: it depends on whether the 2%
difference is larger than what you would expect from sampling noise alone.

### When Is a Difference Meaningful?

With 100 samples, Model A's 95% CI is roughly [79%, 93%] and Model B's is [77%, 91%].
These overlap substantially - the 2% gap is well within sampling noise. With 1,000
samples, the CIs narrow to [85%, 89%] and [83%, 87%] - still overlapping, but a formal
test can assess significance. With 5,000 samples, CIs of [86%, 88%] and [84%, 86%]
barely overlap, and the difference is more likely real.

The lesson: the same observed difference can be meaningful or meaningless depending on
your sample size. Never compare point estimates without considering their uncertainty.

### Statistical Testing for Eval Comparisons

When comparing two models on the same eval dataset, you want to test whether the
observed difference is statistically significant. The appropriate test depends on
your setup:

**Paired comparison (recommended).** If both models are evaluated on the exact same
test cases, use a paired test. For each test case, record whether Model A got it right
and whether Model B got it right. McNemar's test is appropriate for paired binary
outcomes:

```python
from scipy.stats import chi2
import numpy as np

def mcnemar_test(model_a_correct, model_b_correct):
  """McNemar's test for paired binary outcomes."""
  a = np.asarray(model_a_correct)
  b = np.asarray(model_b_correct)

  # Count discordant pairs: cases where models disagree
  b01 = np.sum((a == 1) & (b == 0))  # A right, B wrong
  b10 = np.sum((a == 0) & (b == 1))  # A wrong, B right
  n_discordant = b01 + b10

  if n_discordant == 0:
    return 0.0, 1.0, 0

  # McNemar's test with continuity correction
  statistic = (abs(b01 - b10) - 1) ** 2 / (b01 + b10)
  p_value = 1 - chi2.cdf(statistic, df=1)
  return statistic, p_value, n_discordant


# Example: 500 shared test cases, models disagree on 20
# Model A: 87% (435/500), Model B: 85% (425/500)
# Of 20 discordant pairs: A right/B wrong = 15, A wrong/B right = 5
stat, p, n_disc = mcnemar_test(
  np.array([1]*420 + [1]*15 + [0]*5 + [0]*60),  # Model A
  np.array([1]*420 + [0]*15 + [1]*5 + [0]*60),  # Model B
)
print(f"Discordant pairs: {n_disc}, p-value: {p:.4f}")
# Discordant pairs: 20, p-value: 0.0442
# At p<0.05, the 2% difference IS significant with paired samples
```

The paired test is more powerful than unpaired comparison because it focuses on the
cases where the models disagree. If two models agree on 96% of cases but disagree on
4%, the comparison is really about those 4% of cases. The paired test captures this.

**Unpaired comparison.** If the models are evaluated on different test samples, you
need an unpaired test. A two-proportion z-test works:

```python
from scipy import stats

def two_proportion_z_test(n_a, k_a, n_b, k_b):
  """Two-proportion z-test for comparing accuracy rates."""
  p_a, p_b = k_a / n_a, k_b / n_b
  p_pooled = (k_a + k_b) / (n_a + n_b)
  se = np.sqrt(p_pooled * (1 - p_pooled) * (1/n_a + 1/n_b))
  z = (p_a - p_b) / se
  return z, 2 * (1 - stats.norm.cdf(abs(z)))

z, p = two_proportion_z_test(500, 435, 500, 425)
print(f"z = {z:.2f}, p = {p:.4f}")
# z = 0.84, p = 0.4028
# NOT significant when unpaired.
```

The same 2% gap (87% vs 85%) is significant with McNemar's paired test (p=0.04) but
not with the unpaired test (p=0.40). The paired test exploits the correlation between
model responses on the same samples. Always prefer paired comparisons when possible.

### The Multiple Comparisons Problem

You evaluate 5 models on your benchmark and find three "significant" comparisons (p<0.05
each). Should you report all three? No. With 5 models you make 10 pairwise comparisons.
At p<0.05, you expect ~0.5 false positives by chance. Across 20 benchmarks with 5
models: 200 comparisons, ~10 expected false positives.

This matters because teams report the comparisons their model wins and omit the rest,
creating selection bias in published results.

**Bonferroni correction.** Divide your significance threshold by the number of tests.
10 comparisons at alpha=0.05: use p < 0.005 for each test.

```python
# Bonferroni: divide alpha by number of tests
# 5 models = 10 pairwise comparisons
alpha_corrected = 0.05 / 10  # = 0.005 per comparison

# 5 models x 4 benchmarks = 40 comparisons
alpha_corrected_multi = 0.05 / 40  # = 0.00125 per comparison
```

Bonferroni is conservative (reduces power). Alternatives like Holm-Bonferroni or
Benjamini-Hochberg FDR are less conservative. For eval reporting, Bonferroni's
simplicity is usually worth the trade-off.

> **FIELD MATURITY: ESTABLISHED** - Statistical testing and multiple comparison
> corrections are established methodology from decades of experimental science. Their
> routine application to LLM evaluation is not yet standard practice. Most published
> model comparison papers do not apply multiple comparison corrections, which means
> some reported improvements are likely noise.

### Practical Guidance

1. **Use paired comparisons** when you have the same test set.
2. **Report CIs**, not just p-values. A significant 0.3% difference may not matter.
3. **Distinguish statistical from practical significance.** 1% improvement at 10x
   cost is not worth deploying.
4. **Count your comparisons.** 5 models on 8 benchmarks = 80 comparisons.
5. **Pre-register comparisons** before running evals, eliminating selection bias.

> **AGENTIC GROUNDING:** Multi-model ensemble review in this project uses three
> independent models reviewing the same code. The convergence/divergence analysis
> (bin/triangulate) is a structured comparison across models. When all three models
> flag the same finding, confidence is high. When only one model flags something,
> you cannot conclude it is a false positive - it might be the only model that caught
> a real issue. The statistical framework here applies directly: how do you know
> whether convergence is evidence of a real finding vs. shared bias?

---

## 4. Communicating Eval Limitations

*Estimated time: 25 minutes*

Every eval has blind spots. Reporting eval results without reporting limitations is
like reporting a medical test result without reporting the conditions under which the
test was conducted. The number is meaningless without the context.

### What the Eval Does Not Test

The most important section of any eval report describes what was not tested. It is also
the section most often omitted. Every eval excludes something, and the reader may not
share your mental model of what is covered.

Less obvious exclusions:

- **Distribution mismatch.** Your eval tests formal English; your users write in broken
  English with typos. The eval says nothing about production performance.
- **Difficulty stratification.** If 80% of cases are easy, the headline accuracy hides
  poor performance on hard cases.
- **Temporal coverage.** Domains change. An eval built in 2024 may not represent 2026.
- **Prompt format dependence.** A different prompt format might produce different scores.

### The HELM Observation

Anthropic's 2023 paper documented a telling example. Claude models scored differently on
HELM (Holistic Evaluation of Language Models) than on internally formatted versions of
the same questions. The cause: HELM uses a standardised prompting format that does not
match Claude's Human/Assistant dialogue format, producing "uncharacteristic responses."

The broader finding: simple formatting changes - switching (A) to (1), adding a space -
can cause ~5% accuracy changes on MMLU. The eval measures prompt format compatibility as
much as capability. "Methods that work well for evaluating other providers' models do not
necessarily work well for our models, and vice versa."

When comparing models across benchmarks, ask: Were models evaluated with the same prompt
format? Was the format natural for each model? Were elicitation methods (few-shot,
chain-of-thought) applied consistently? If any answer is "no," the comparison is
unreliable.

> **SLOPODAR:** "Construct drift" applies directly here. When a benchmark claims to
> measure "language understanding" but actually measures "prompt format compatibility,"
> the label on the measurement has drifted from what it actually measures. The number
> is real. The interpretation is wrong.

### Population Mismatch

The eval dataset samples from one population; the model serves another. Common
mismatches:

| Eval Population | Production Population | Risk |
|----------------|----------------------|------|
| English only | Multilingual users | Non-English performance unknown |
| Clean, well-formed queries | Noisy, abbreviated input | Model may fail on real patterns |
| Curated by ML engineers | Domain expert/end user queries | Domain edge cases missed |
| Academic tasks | Business-specific tasks | Academic scores may not transfer |

State explicitly which population your eval samples from and which it will serve. If
they differ, the eval score is a lower bound on uncertainty.

### How to Write an Honest Limitations Section

A limitations section should include:

1. **Scope boundaries.** What capabilities were tested and what was excluded.
2. **Population description.** Where the eval data came from and how it was selected.
3. **Known blind spots.** Specific failure modes you know the eval does not cover.
4. **Prompt format sensitivity.** Whether you tested with multiple prompt formats.
5. **Temporal validity.** When the eval was created and whether the domain has changed.
6. **Sample size and confidence.** How many samples, and the resulting CI width.
7. **Scorer limitations.** Whether the scoring method has known biases (Step 3).

The Anthropic alignment faking paper provides a good model: "Our results don't
demonstrate a model developing malicious goals, let alone acting on any such goals."
This states clearly what the research does not show, preventing overinterpretation.

> **NOVEL:** The connection between population mismatch and the oracle problem (AGENTS.md
> lexicon): if the eval designer's understanding of the production population is wrong,
> even an honestly reported eval propagates the error. This is the oracle problem applied
> to eval interpretation - the eval designer is the oracle, and their error has no layer
> above L12 to catch it. The limitation section is the only control available: by
> explicitly stating assumptions about the population, you give the reader enough
> information to detect the mismatch themselves.

---

## 5. Eval Reports as Decision Documents

*Estimated time: 30 minutes*

Most eval reports are written by ML engineers for other ML engineers. Most deployment
decisions are made by people who are not ML engineers: product managers, security
reviewers, compliance officers, executives. The eval report is the bridge between
technical measurement and business decision. If the bridge is poorly constructed, the
decision is poorly informed.

### Structure for Non-ML Stakeholders

An eval report for a deployment decision should contain five sections. Each serves a
specific function in the reader's decision process.

**1. Summary (one paragraph, no jargon).** A reader who reads only this paragraph
should understand whether the model is ready, not ready, or ready with conditions.

Example summary:

> We evaluated CodeAssist v2.3 on 500 production pull requests. It detected 78% of
> known defects with a 12% false positive rate. Suitable as a first-pass reviewer with
> human oversight, but not as a sole reviewer. Security-critical code was not tested.

**2. Methodology.** Precise enough to reproduce: model version and config, dataset
(size, source, selection, difficulty), scoring method, evaluation date.

**3. Results (with confidence intervals).** Tables with uncertainty bounds:

| Metric | Score | 95% CI | Threshold | Status |
|--------|-------|--------|-----------|--------|
| Defect detection rate | 78% | [74%, 82%] | > 70% | Pass |
| False positive rate | 12% | [9%, 15%] | < 15% | Pass |
| Security defect detection | Not tested | - | > 90% | Unknown |

**4. Limitations (what was NOT tested).** Not optional. Follow the structure from
Section 4.

**5. Recommendations (conditional).** Not verdicts - decision support:

> - **Non-security Python review with human oversight:** meets thresholds. Pilot with
>   monitoring.
> - **Security-critical code:** do not deploy until security eval completed.
> - **Autonomous review without human oversight:** do not deploy (12% FP rate).

### Enterprise Eval Report Template

The following template is designed for enterprise procurement and deployment decisions.
It can be used directly as a starting point for any model evaluation report.

```markdown
# Evaluation Report: [Model/System Name] for [Use Case]

**Date:** [YYYY-MM-DD] | **Evaluator:** [Team/Person]
**Model version:** [Exact version identifier] | **Report version:** [1.0]

## 1. Executive Summary
[One paragraph. What was tested, what was found, what we recommend.
Written for a reader who will read only this section.]

## 2. Methodology
- **System under test:** [model name, version, provider, config, deployment mode]
- **Dataset:** [source, size, selection method, difficulty distribution, date range]
- **Scoring:** [primary metric, mechanism (exact match/code execution/model-graded/human)]
- **Conditions:** [eval date, prompt format, number of runs, compute cost]

## 3. Results
| Metric | Score | 95% CI | Target | Status |
|--------|-------|--------|--------|--------|
| [metric] | [X%] | [Y%-Z%] | [threshold] | [Pass/Fail/Unknown] |

[Performance by category if applicable. Failure analysis with examples.]

## 4. Limitations
- **Scope exclusions:** [what was not tested and why]
- **Population representativeness:** [how eval data relates to production data]
- **Known blind spots:** [failure modes not covered]
- **Scorer limitations:** [if model-graded: known biases]
- **Temporal validity:** [how long results remain valid]

## 5. Recommendations
[Conditional recommendations. Each specifies the conditions under
which it applies. Not verdicts - decision support.]

## Appendix A: Raw Results
## Appendix B: Example Outputs
```

> **AGENTIC GROUNDING:** This template is not theoretical. In production agent
> deployments, evaluation reports are the primary mechanism by which engineering teams
> communicate model readiness to security, compliance, and product teams. A report that
> omits the Limitations section or presents results without confidence intervals
> gives stakeholders a false basis for their decision. The structure here is designed
> to make the right information hard to skip and the wrong interpretation harder to
> reach.

---

## 6. Avoiding Eval Theatre

*Estimated time: 25 minutes*

Eval theatre is the practice of running evaluations for the appearance of rigor rather
than for genuine insight. The term draws on Bruce Schneier's "security theatre" concept:
evaluation procedures exist, reports are produced, scores are cited, but the evaluations
do not actually inform decisions. They exist to satisfy a compliance requirement or to
provide a number for a slide deck.

### The Rubber Stamp Eval

An eval that always passes is not an eval. It is a rubber stamp.

Your team runs an eval suite on every model update. The model has scored above 90% for
six months. The eval has saturated (Step 1, Section 4) - it no longer discriminates
between model versions. But the team keeps running it because the process requires it.
The score would be the same whether the model improved, stayed the same, or degraded on
dimensions that matter. It produces confidence. It protects no one.

The fix: notice when an eval has stopped providing signal and replace it with one that
discriminates. If your eval always passes, either your threshold is too low, your test
cases are too easy, or you need harder tests.

> **SLOPODAR:** "Paper guardrail" - a rule stated but not enforced. "Every model update
> will be evaluated before deployment" sounds like a control. But if the evaluation
> always passes regardless of model quality, the control is paper. The enforcement
> mechanism (the eval) exists but does not function. The guardrail exists to satisfy
> governance requirements, not to prevent deployment of inadequate models. To detect:
> ask whether the eval has ever blocked a deployment. If the answer is never, the
> guardrail is paper.

### The Analytical Lullaby in Eval Reporting

The analytical lullaby is warm numbers that sound impressive but obscure reality.

Consider: "Our model achieves 95.2% accuracy across 10,000 evaluation samples,
demonstrating strong performance across all tested categories."

This sounds rigorous. But what might be hidden:

- The 10,000 samples are 80% easy cases and 20% hard cases. Performance on easy: 99%.
  Performance on hard: 80%. The headline is dominated by easy cases.

- "All tested categories" hides that three categories were excluded because early
  results showed poor performance.

- The 95.2% is a point estimate with no CI. On hard cases (2,000 samples at 80%),
  the CI is [78%, 82%]. On excluded categories, performance is unknown.

The lullaby pattern: present the biggest number first, bury caveats in a footnote, use
language that frames results as "demonstrating" rather than "suggesting." The reader
feels confident. The reader should not.

> **SLOPODAR:** "Analytical lullaby" - the lullaby in data form. The numbers are real
> but what they prove is not what they look like they prove. Detect: when an agent
> presents quantitative results that favour the conclusion, check whether the limitations
> were disclosed before or after the flattering finding. If the caveats are buried and
> the headline is prominent, the lullaby is playing. Instead: lead with what is wrong
> with the comparison.

### The BBQ Example

Anthropic's 2023 paper documents a concrete case. The BBQ (Bias Benchmark for QA) tests
model bias. Claude received a bias score near 0 - apparent success. Investigation
revealed the model was achieving the low score by refusing to answer, not by answering
unbiasedly. The eval measured refusal rate, not bias.

The authors' observation: "All evaluations are subject to the failure mode where you
overinterpret the quantitative score and delude yourself into thinking that you have
made progress when you haven't."

This happened to a major AI lab evaluating their own model. The score was real. The
interpretation was wrong. It looked exactly like success.

### How to Detect Eval Theatre

Six questions that expose eval theatre:

1. **Has this eval ever blocked a deployment?** If never, the eval is documentation,
   not a gate.
2. **What score would make you NOT deploy?** If no one can answer, the eval has no
   sufficiency threshold.
3. **What were the hardest cases?** If no one can describe failures, no one is learning
   from the eval.
4. **Were categories or samples excluded?** If exclusion criteria correlate with poor
   performance, the eval is selecting for success.
5. **Is the score trending?** A flat line on a score that should change is evidence of
   saturation, not stability.
6. **Who reads the full report?** If only the headline number is consumed, the
   limitations section is inert.

### The Oracle Problem Connection

The deepest form of eval theatre is invisible: when the eval designer has a flawed
understanding of what should be measured, even an honest, rigorous eval propagates the
error. This is the oracle problem applied to evaluation: "L12 error propagates through
all verification layers because no layer has authority above L12" (AGENTS.md lexicon).
The eval designer is at L12. If the oracle is wrong, no statistical rigour can fix it.

The controls are organizational: have domain experts review eval design (not just
results), have someone other than the designer interpret results, and compare eval
findings against production incident data.

> **NOVEL:** The paper guardrail pattern from the slopodar applied to evaluation:
> an eval that is stated as a deployment gate but never actually blocks deployment
> is a paper guardrail. The eval exists as governance documentation, not as a
> functioning control. This extends the slopodar's governance pattern to evaluation
> practice - the mechanism is the same (rule without enforcement), but the domain
> is eval design rather than code review or policy. Detection: check whether the
> eval has a defined sufficiency threshold and whether that threshold has ever been
> triggered.

> **NOVEL:** The analytical lullaby pattern from the slopodar applied to eval
> reporting: presenting eval results with flattering headline numbers, burying
> limitations, and using language that implies proof rather than estimation. This
> extends the slopodar's relationship pattern to eval communication. The numbers
> are real. The framing makes them misleading. Detection: check whether the
> limitations are presented before or after the headline finding, and whether
> excluded categories are disclosed prominently.

---

## 7. Key Concepts / Vocabulary

- **Point estimate** - a single number (e.g., 85%) computed from a sample. Not the
  true value; a sample statistic.
- **Confidence interval (CI)** - range quantifying sampling uncertainty. 95% CI: if
  repeated many times, 95% of intervals would contain the true value.
- **Bootstrap** - resampling method for CIs without distributional assumptions.
- **Statistical significance** - p-value: probability the observed difference would
  occur by chance if no true difference exists.
- **McNemar's test** - paired comparison test focusing on discordant pairs (cases
  where models disagree).
- **Multiple comparisons problem** - more tests = more false positives by chance.
- **Bonferroni correction** - divide significance threshold by number of tests.
- **Sufficiency threshold** - minimum score for deployment. Context-dependent.
- **Eval theatre** - evaluations for compliance optics rather than genuine insight.
- **Eval report** - decision document: results, methodology, limitations,
  recommendations.
- **Population mismatch** - gap between eval sample population and production
  population.

---

## 8. Challenges

*Estimated time: 60-90 minutes total*

These challenges exercise the interpretation and communication skills from this step.
Each produces a document, not code. The code tools from Sections 2 and 3 support the
analysis, but the deliverable is the interpretation.

---

### Challenge 1: The Honest Report vs The Lullaby

*Estimated time: 30-40 minutes*
*Type: Analyse*

You are given the following eval results for an LLM-based customer support assistant.
Write two reports: one that commits the analytical lullaby, and one that communicates
honestly. Then compare them.

**Eval data:**

| Category | Samples | Correct | Accuracy |
|----------|---------|---------|----------|
| Account billing | 300 | 285 | 95.0% |
| Password reset | 250 | 240 | 96.0% |
| Shipping status | 200 | 188 | 94.0% |
| Product returns | 150 | 120 | 80.0% |
| Warranty claims | 50 | 30 | 60.0% |
| Escalation routing | 50 | 28 | 56.0% |
| **Overall** | **1000** | **891** | **89.1%** |

Additional context:
- The model will be deployed to handle all six categories
- Product returns, warranty claims, and escalation routing are the categories
  customers care most about (highest frustration, highest churn risk)
- The eval dataset was created by ML engineers, not by customer support staff
- No confidence intervals were computed

**Deliverable:** Two reports (each 150-300 words) and a 100-word comparison paragraph
identifying the specific differences.

**Evaluation criteria:**
- The lullaby report should be plausible, not a strawman.
- The honest report should include bootstrap CIs per category, acknowledge the
  difficulty distribution, and address the population mismatch.
- The comparison should name the specific lullaby techniques used.

<details>
<summary>Design guidance</summary>

Lullaby: lead with 89.1% headline and 1,000 sample count. Emphasise high-volume
categories. Minimise or omit the warranty/escalation performance.

Honest: compute bootstrap CIs per category. The 50-sample categories have wide CIs.
Note that worst-performing categories are highest customer impact. Note the eval was
designed by ML engineers, not domain experts.

Compare: which numbers emphasised vs. suppressed? Limitations before or after
headline? Language implies proof ("demonstrates") or estimation ("suggests")?

</details>

---

### Challenge 2: Statistical Significance Across Benchmarks

*Estimated time: 20-30 minutes*
*Type: Analyse*

Three models evaluated on five benchmarks (500 paired samples per benchmark):

| Benchmark | Model X | Model Y | Model Z |
|-----------|---------|---------|---------|
| Coding    | 82.4%   | 80.2%   | 83.0%   |
| Reasoning | 71.8%   | 73.4%   | 70.6%   |
| Knowledge | 88.2%   | 87.6%   | 89.0%   |
| Safety    | 94.0%   | 93.2%   | 91.8%   |
| Style     | 76.4%   | 78.0%   | 75.2%   |

Discordant pairs average 8% of samples per comparison.

**Deliverable:** One-page analysis answering: (1) How many pairwise comparisons?
(2) Bonferroni-corrected threshold? (3) Which differences are significant given
sample size? (4) Which would you report as meaningful? (5) How do conclusions
change with only 100 samples?

**Evaluation criteria:** Correct Bonferroni application, honest reasoning about
power, recognition that most differences are probably noise.

<details>
<summary>Design guidance</summary>

3 pairs x 5 benchmarks = 15 comparisons. Bonferroni: 0.05/15 = 0.0033.

With 500 samples and ~8% discordant pairs (40 pairs), a split of 24/16 gives
chi-squared = 1.225, p = 0.27. Most differences will NOT be significant even before
Bonferroni. The honest conclusion: these models perform similarly given the evidence.
With 100 samples, even less power - you cannot distinguish them.

</details>

---

### Challenge 3: Enterprise Eval Report

*Estimated time: 30-40 minutes*
*Type: Design*

Write a complete eval report using the Section 5 template for this scenario:

**Scenario:** Evaluate "ReviewBot" (AI code review assistant) for your 40-engineer
team. ReviewBot examines PRs and comments on bugs, style violations, and security
issues. Your company handles financial data (PCI-DSS).

**Eval data:** 400 PRs from production history, three human reviewers labelled each.

| Metric | Score | Notes |
|--------|-------|-------|
| Bug detection | 72% | 89 of 124 known bugs |
| Security detection | 45% | 9 of 20 known issues |
| Style detection | 91% | 201 of 221 violations |
| False positive rate | 18% | 87 of 484 comments on correct code |
| Actionable comments | 74% | 358 of 484 comments |

Additional context: current review turnaround 24h, ReviewBot responds in 3min.
Not evaluated on Go or Rust (team uses both). Eval run March 2026; new security
framework adopted January 2026, partially represented.

**Deliverable:** Complete eval report (all five sections). Recommendations must
include conditional guidance for at least three deployment scenarios.

**Evaluation criteria:** Bootstrap CIs for all metrics. Security detection
highlighted as concern. Language gap stated as limitation. Conditional
recommendations. Executive summary readable by non-technical stakeholders.

<details>
<summary>Design guidance</summary>

Key tensions: (1) Fast and good at style but weak on security (45%) for a financial
company. (2) Security sample is small (20 issues) - CI for 45% on 20 samples is
roughly [24%, 68%]. (3) Language gap: Go/Rust not evaluated. (4) Temporal: new
security framework only partially represented. Conditional recs: style review with
human follow-up = suitable; security on financial code = not suitable; Go/Rust = no
data; autonomous without oversight = not suitable.

</details>

---

## 9. Key Takeaways

Before moving to Step 9, you should be able to answer these questions without looking
anything up:

1. Why does the same accuracy score mean different things in different deployment
   contexts? What factors determine whether a score is "good enough"?

2. Given 100 eval samples with 85% accuracy, what is the approximate 95% confidence
   interval? Why does reporting the CI matter more than reporting the point estimate?

3. When comparing two models evaluated on the same test set, why is a paired test
   (McNemar's) more powerful than an unpaired test? What does it focus on that the
   unpaired test ignores?

4. If you compare 5 models on 4 benchmarks, how many pairwise comparisons are you
   making? What is the Bonferroni-corrected significance threshold for alpha=0.05?

5. What is the most important section of an eval report, and why is it the section
   most often omitted?

6. How do you detect whether an eval is functioning as a genuine deployment gate or
   as a rubber stamp? What question exposes the difference?

7. What is the analytical lullaby in eval reporting? How do you detect it in your own
   work?

---

## 10. Recommended Reading

- **"Challenges in Evaluating AI Systems"** - Ganguli et al., Anthropic (October
  2023). anthropic.com/research/evaluating-ai-systems. The single most useful
  reference for this step. Covers prompt sensitivity, benchmark limitations, the BBQ
  example. Read the full paper.

- **"An Introduction to the Bootstrap"** - Efron & Tibshirani (1993). Chapman &
  Hall/CRC. Chapters 1-6 cover the resampling ideas used in this step.

- **METR Evaluation Reports** - evaluations.metr.org. Published reports for frontier
  models. The de facto standard for honest safety eval reporting. Study the structure.

- **"Alignment Faking in Large Language Models"** - Greenblatt et al. (December
  2024). arxiv.org/abs/2412.14093. Read the caveats section for a model of honest
  limitation reporting.

- **Anthropic Responsible Scaling Policy** - anthropic.com/rsp. Eval results driving
  deployment decisions at organizational level.

---

## What to Read Next

**Step 9: Building an Eval Culture.** You now know how to design evals, run them,
interpret the results honestly, and communicate findings to stakeholders. Step 9
addresses the organizational question: how do you embed this practice into a team
that currently does not have it?

Individual skill is necessary but not sufficient. An engineer who writes excellent eval
reports matters only if someone reads them and acts on findings. Step 9 covers eval
ownership, eval review as team practice, continuous evaluation, and the connection
between eval results and governance.

The connection is direct: honest interpretation is the foundation of eval culture. A
team that reports results with limitations and conditional recommendations makes good
decisions. A team that reports headline numbers without context is performing eval
theatre regardless of technical sophistication.

