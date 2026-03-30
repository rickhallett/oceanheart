+++
title = "Statistical Testing for Practitioners"
date = "2026-03-10"
description = "t-tests, Mann-Whitney, chi-squared, effect size, multiple comparisons. Is the change real or noise?"
tags = ["statistics", "testing", "bootcamp"]
step = 4
tier = 2
estimate = "3-4 hours"
bootcamp = 3
+++

Step 4 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

The Operator asks: "We changed the darkcat review instructions last week. Are the
models finding more real issues now?"

Descriptive statistics can tell you the mean finding count went from 8.2 to 9.7. That
is a difference. But is it a real improvement, or is it noise? If you ran the same
prompt again tomorrow, would the number still be higher? Or did you just get lucky on
the sample of code files you happened to review?

Statistical testing answers exactly this question. Not "is there a difference" - your
eyes can see a difference. The question is: "should I believe this difference will
persist?" A p-value of 0.03 means: if nothing actually changed, you would see a
difference this large or larger only 3% of the time. That is a reason to believe the
change is real.

But statistical significance is not the whole story. With enough data, a 0.1%
improvement becomes statistically significant. The second question - the one most
people skip - is: "is this difference big enough to care about?" That is effect size,
and it is the punchline of this step.

This step teaches you to pick the right test, run it, interpret the output, and then
ask the question that actually matters: does the size of this effect justify changing
our process?

---

## Table of Contents

1. [The Logic of Hypothesis Testing](#1-the-logic-of-hypothesis-testing) (~20 min)
2. [Choosing the Right Test](#2-choosing-the-right-test) (~10 min)
3. [t-tests: Comparing Two Means](#3-t-tests-comparing-two-means) (~30 min)
4. [Mann-Whitney U: The Non-Parametric Alternative](#4-mann-whitney-u-the-non-parametric-alternative) (~25 min)
5. [Chi-Squared: Testing Categorical Data](#5-chi-squared-testing-categorical-data) (~25 min)
6. [Effect Size: The Question That Actually Matters](#6-effect-size-the-question-that-actually-matters) (~30 min)
7. [Multiple Comparisons: The Accidental Discovery Problem](#7-multiple-comparisons-the-accidental-discovery-problem) (~20 min)
8. [Practical Significance vs Statistical Significance](#8-practical-significance-vs-statistical-significance) (~20 min)
9. [Bootstrap Confidence Intervals](#9-bootstrap-confidence-intervals) (~20 min)
10. [Challenges](#10-challenges) (~60-90 min)
11. [Key Takeaways](#key-takeaways)
12. [Recommended Reading](#recommended-reading)
13. [What to Read Next](#what-to-read-next)

---

## 1. The Logic of Hypothesis Testing

*Estimated time: 20 minutes*

Most introductions to hypothesis testing start with the math. We are going to start
with the decision.

You have two sets of numbers. One set comes from the old prompt. The other comes from
the new prompt. The new prompt's numbers look higher. You need to decide: change the
production prompt, or keep the old one.

The logic of hypothesis testing is a structured way to make that decision. It works
in four steps:

**Step 1: Assume nothing changed.** This is the **null hypothesis**. It says: "the
old prompt and the new prompt produce the same results, and whatever difference I see
is just random variation in the data." You start here because it is the conservative
position. It protects you from chasing noise.

**Step 2: Pick a surprise threshold.** This is the **significance level**, written as
**alpha**. The standard value is 0.05, which means: "I am willing to be wrong 5% of
the time." If you want to be more careful, use 0.01. If you are doing exploratory
analysis and can tolerate more false leads, 0.10 is acceptable. You pick alpha
before looking at the data. Not after.

**Step 3: Measure how surprising the data is.** Run the test. It produces a **p-value**.
The p-value answers one specific question: "If the null hypothesis is true - if nothing
actually changed - how often would I see a difference this large or larger, just by
chance?" A p-value of 0.03 means: 3% of the time. A p-value of 0.42 means: 42% of the
time. That is not surprising at all.

**Step 4: Compare and decide.** If the p-value is less than alpha, you reject the null
hypothesis. The difference is statistically significant - meaning it is unlikely to be
pure noise. If the p-value is greater than alpha, you fail to reject. You do not accept
the null hypothesis. You just say: "the evidence is not strong enough to conclude
anything changed."

That is the entire logic. Everything else in this step is about choosing the right test
for your data and interpreting the results correctly.

### What a p-value is NOT

A p-value of 0.03 does **not** mean "there is a 97% chance the new prompt is better."
It does not measure the probability that your hypothesis is correct. It measures the
probability of seeing your data if nothing changed. This distinction matters. A small
p-value tells you the data is surprising under the null hypothesis. Whether the new
prompt is actually better depends on effect size, your prior knowledge, and the cost
of being wrong.

> **AGENTIC GROUNDING:** When an agent reports "the results are statistically
> significant," check what test it used, what alpha it assumed, and whether it
> corrected for multiple comparisons. Agents routinely run a t-test, see p < 0.05,
> and declare victory without checking whether the data meets the test's assumptions
> or whether the effect size is meaningful. The p-value is the beginning of
> interpretation, not the end.

---

## 2. Choosing the Right Test

*Estimated time: 10 minutes*

Before running any test, answer two questions about your data. The answers tell you
which test to use.

```
What kind of data are you comparing?
|
+-- Continuous (numbers on a scale: finding counts, token usage,
|   match confidence scores, convergence rates)
|   |
|   +-- Are you comparing two groups?
|   |   |
|   |   +-- Are the groups independent (different samples)?
|   |   |   |
|   |   |   +-- Data approximately normal, n > 20 per group?
|   |   |   |   -> Independent t-test (ttest_ind)
|   |   |   |
|   |   |   +-- Skewed, small sample, or ordinal?
|   |   |       -> Mann-Whitney U (mannwhitneyu)
|   |   |
|   |   +-- Are the groups paired (same items, before/after)?
|   |       |
|   |       +-- Differences approximately normal?
|   |       |   -> Paired t-test (ttest_rel)
|   |       |
|   |       +-- Not sure about normality?
|   |           -> Mann-Whitney U on the differences,
|   |              or bootstrap CI
|   |
|   +-- Are you measuring correlation between two variables?
|       |
|       +-- Linear relationship, no extreme outliers?
|       |   -> Pearson (pearsonr)
|       |
|       +-- Monotonic relationship, or ordinal data?
|           -> Spearman (spearmanr)
|
+-- Categorical (labels: severity levels, model names,
    outcome categories like "fixed"/"blocked"/"scrubbed")
    |
    +-- Comparing distributions across groups?
        -> Chi-squared (chi2_contingency)
```

A practical rule: when in doubt between a t-test and Mann-Whitney, use Mann-Whitney.
It makes fewer assumptions and works on a wider range of data shapes. You lose a
small amount of statistical power when the data is truly normal, but you avoid getting
a misleading result when it is not.

> **HISTORY:** The t-test was developed by William Sealy Gosset in 1908 while working
> at the Guinness brewery in Dublin. He published under the pseudonym "Student" because
> Guinness did not allow employees to publish research (they feared competitors would
> learn they were using statistics for quality control). The "Student's t-test" name
> stuck. Gosset needed a test that worked with small samples - brewery batches were
> expensive, so he could not run thousands of trials. This is the same constraint you
> face with agent evaluations: runs are expensive, samples are small.

---

## 3. t-tests: Comparing Two Means

*Estimated time: 30 minutes*

A t-test answers: "are these two groups different enough that the difference is
unlikely to be noise?"

There are two variants, and using the wrong one is a common mistake.

### Independent Samples t-test

Use this when the two groups are separate samples with no natural pairing. Example:
you ran 20 reviews with the old prompt and 25 reviews with the new prompt on
different codebases.

```python
import numpy as np
from scipy.stats import ttest_ind

# Simulated finding counts from two prompt versions
old_prompt = np.array([6, 8, 7, 5, 9, 11, 7, 8, 6, 10,
                       7, 9, 8, 6, 7, 8, 10, 5, 9, 7])
new_prompt = np.array([9, 11, 10, 8, 12, 14, 10, 11, 9, 13,
                       10, 12, 11, 9, 10, 8, 13, 9, 11, 10,
                       12, 11, 9, 10, 11])

# Use equal_var=False (Welch's t-test) as the safe default
result = ttest_ind(old_prompt, new_prompt, equal_var=False)

print(f"t-statistic: {result.statistic:.4f}")
print(f"p-value: {result.pvalue:.4f}")
# t-statistic: -5.3841
# p-value: 0.0000
```

The `equal_var=False` parameter is important. It runs Welch's t-test, which does not
assume both groups have the same variance. The default (`equal_var=True`) assumes equal
variances, which is rarely justified in practice. Welch's test is valid even when
variances are equal - it just loses a tiny amount of power. The reverse mistake -
assuming equal variances when they differ - produces unreliable p-values.

### Interpreting the Result

The t-statistic is negative because the old prompt has a lower mean. The p-value is
effectively zero: if both prompts produced the same distribution, you would almost
never see a difference this large by chance. Reject the null hypothesis.

But how many more findings? The p-value does not tell you. Section 6 does.

### Paired Samples t-test

Use this when each observation in one group has a natural partner in the other. Example:
you ran both prompts on the same 15 code files. File 1 got 6 findings with the old
prompt and 9 findings with the new prompt. File 2 got 8 and 11. The pairing matters
because some files are inherently harder to review.

```python
from scipy.stats import ttest_rel

# Same 15 code files, reviewed with both prompts
old_findings = np.array([6, 8, 5, 9, 7, 11, 8, 6, 10, 7, 9, 8, 5, 7, 6])
new_findings = np.array([9, 11, 7, 12, 10, 14, 10, 8, 13, 10, 11, 10, 8, 9, 9])

result = ttest_rel(old_findings, new_findings)

print(f"t-statistic: {result.statistic:.4f}")
print(f"p-value: {result.pvalue:.4f}")
# t-statistic: -7.6830
# p-value: 0.0000
```

The paired test is more powerful here because it removes the file-to-file variation.
Instead of asking "are the overall distributions different?", it asks "are the
individual differences (new minus old) consistently different from zero?" With paired
data, always use `ttest_rel`. Using `ttest_ind` on paired data throws away the
pairing information and reduces your ability to detect real differences.

### When NOT to Use a t-test

The t-test assumes approximately normal data. For large samples (n > 30 per group),
the central limit theorem helps. For small samples, non-normal data produces
unreliable results. Use Mann-Whitney U instead for: token counts (right-skewed),
severity ratings (ordinal), response times (long-tailed), or counts with many zeros.

> **AGENTIC GROUNDING:** When comparing agent performance across prompt versions, the
> choice between independent and paired t-test depends on your experimental design.
> If you ran each prompt version on different code repositories, the samples are
> independent. If you ran both versions on the same repository and compared
> file-by-file, the samples are paired. Getting this wrong does not just reduce
> power - it can change the conclusion. A paired comparison that shows significance
> might become non-significant when you incorrectly treat it as independent.

---

## 4. Mann-Whitney U: The Non-Parametric Alternative

*Estimated time: 25 minutes*

The Mann-Whitney U test does not assume your data follows any particular distribution.
It works by ranking all the values from both groups together, then checking whether
one group's ranks are systematically higher than the other's.

This makes it the right choice when:
- The data is skewed (token counts, latency measurements)
- The sample size is small (under 20 per group)
- The data is ordinal (severity ratings: low, medium, high, critical)
- You are not sure whether the normality assumption holds

### Running the Test

```python
from scipy.stats import mannwhitneyu

# Severity scores (1=low, 2=medium, 3=high, 4=critical) from two models
model_a_severity = np.array([2, 3, 2, 1, 3, 4, 2, 3, 2, 3, 1, 2])
model_b_severity = np.array([3, 4, 3, 2, 4, 3, 3, 4, 3, 2, 3, 4, 3, 3])

result = mannwhitneyu(model_a_severity, model_b_severity, alternative='two-sided')

print(f"U statistic: {result.statistic:.1f}")
print(f"p-value: {result.pvalue:.4f}")
# U statistic: 38.0
# p-value: 0.0098
```

Always specify `alternative='two-sided'` explicitly. In older versions of scipy, the
default was one-sided, which is almost never what you want. Being explicit avoids a
silent error that halves your p-value.

### Interpreting the Result

The p-value of 0.0098 is below 0.05. Model B assigns systematically higher severity
ratings than Model A. This is what the triangulate severity calibration metric is
trying to detect - are the models calibrated differently?

A common misunderstanding: Mann-Whitney does not compare medians. It tests whether
values from one group tend to be larger than values from the other (stochastic
dominance). Two groups can have the same median but different Mann-Whitney results
because the shapes of their distributions differ.

### Comparing t-test and Mann-Whitney on the Same Data

When data is normal, both tests give similar results. When it is not, they can disagree:

```python
from scipy.stats import ttest_ind, mannwhitneyu

# Skewed data: token counts from two agent configurations
config_a = np.array([120, 150, 180, 200, 250, 310, 800, 1200, 1500])
config_b = np.array([200, 220, 280, 350, 400, 500, 600, 900, 2000, 2500])

t_result = ttest_ind(config_a, config_b, equal_var=False)
u_result = mannwhitneyu(config_a, config_b, alternative='two-sided')

print(f"t-test p-value:       {t_result.pvalue:.4f}")
print(f"Mann-Whitney p-value: {u_result.pvalue:.4f}")
# t-test p-value:       0.2392
# Mann-Whitney p-value: 0.1052
```

Report both when you are unsure about the distribution. Let the reader see the
convergence or divergence.

> **AGENTIC GROUNDING:** The severity ratings in darkcat alley findings are ordinal
> data - "high" is more severe than "medium," but the distance between "medium" and
> "high" is not necessarily the same as between "low" and "medium." When comparing
> severity distributions across models, Mann-Whitney is the correct test. A t-test
> on severity ratings treats the gap between low (1) and medium (2) as identical to
> the gap between high (3) and critical (4), which is not justified.

---

## 5. Chi-Squared: Testing Categorical Data

*Estimated time: 25 minutes*

The chi-squared test answers a different question from the t-test or Mann-Whitney.
Instead of "are these numbers higher or lower?", it asks: "is the distribution of
categories different across groups?"

Example: three models review the same code. You count how many findings each model
classified as low, medium, high, and critical. Are the models distributing severity
the same way, or are some models more aggressive?

### Building the Contingency Table

The input to chi-squared is a contingency table - a grid of counts. Rows are one
categorical variable (model), columns are another (severity). Cells contain the
count of observations in that combination.

```python
import pandas as pd
import numpy as np
from scipy.stats import chi2_contingency

# Findings by model and severity
data = {
    'model': (['Claude'] * 30 + ['GPT-4'] * 35 + ['Gemini'] * 28),
    'severity': (
        ['low'] * 5 + ['medium'] * 12 + ['high'] * 10 + ['critical'] * 3 +
        ['low'] * 10 + ['medium'] * 15 + ['high'] * 8 + ['critical'] * 2 +
        ['low'] * 3 + ['medium'] * 8 + ['high'] * 12 + ['critical'] * 5
    )
}
df = pd.DataFrame(data)

# Build the contingency table
table = pd.crosstab(df['model'], df['severity'])
print(table)
# severity  critical  high  low  medium
# model
# Claude           3    10    5      12
# GPT-4            2     8   10      15
# Gemini           5    12    3       8
```

### Running the Test

```python
chi2, p, dof, expected = chi2_contingency(table)

print(f"Chi-squared statistic: {chi2:.4f}")
print(f"p-value: {p:.4f}")
print(f"Degrees of freedom: {dof}")
# Chi-squared statistic: 10.5241
# p-value: 0.1045
# Degrees of freedom: 6
```

The function returns four values (not a named tuple - unpack all four):
1. `chi2` - the test statistic
2. `p` - the p-value
3. `dof` - degrees of freedom, which equals (rows - 1) times (columns - 1)
4. `expected` - the frequencies you would expect if the two variables were independent

### Interpreting the Result

The p-value of 0.1045 is above 0.05. We cannot conclude that the severity distributions
are significantly different across models. The apparent differences (Gemini rates things
more severely, GPT-4 rates things less severely) could be noise.

### Checking the Assumptions

Chi-squared becomes unreliable when expected cell frequencies are below 5. Always
check:

```python
print("Expected frequencies:")
print(np.round(expected, 1))
# Check for cells below 5
print(f"\nCells with expected freq < 5: {(expected < 5).sum()}")
```

If any expected cell is below 5, you have two options: merge categories (combine "low"
and "medium" into "low-medium") or use Fisher's exact test for 2x2 tables
(`scipy.stats.fisher_exact`). For larger tables with small expected counts, there is
no clean alternative - merge categories.

Also: the input must be raw counts. Not percentages, not proportions. If you feed in
percentages, the chi-squared statistic will be meaningless.

> **AGENTIC GROUNDING:** The triangulate severity calibration metric already does a
> version of this comparison informally - it checks whether converged findings have
> the same severity rating across models. The chi-squared test formalizes it across
> all findings, not just converged ones. When the Operator asks "are the models
> calibrated the same way?", the chi-squared test on a severity-by-model crosstab is
> the answer. If the result is significant, investigate which cells deviate most from
> expected - that tells you which model and which severity level are misaligned.

---

## 6. Effect Size: The Question That Actually Matters

*Estimated time: 30 minutes*

This is the most important section in this step.

A p-value tells you whether a difference is likely to be real. It does not tell you
whether the difference is large enough to matter. These are different questions, and
confusing them is the single most common mistake in applied statistics.

Here is why: the p-value is a function of both the size of the difference and the
size of the sample. With a large enough sample, any difference - no matter how tiny -
becomes statistically significant. If you compare the old and new prompts across
10,000 reviews, a mean improvement of 0.1 findings per review (practically useless)
will have p < 0.001 (highly significant).

The p-value says: "this is not noise." Effect size says: "this is worth caring about."

### Cohen's d for Continuous Data

Cohen's d expresses the difference between two group means in units of standard
deviations. A d of 0.5 means the groups differ by half a standard deviation.

```python
import numpy as np

def cohens_d(group1, group2):
  """Compute Cohen's d for two independent groups."""
  n1, n2 = len(group1), len(group2)
  var1 = np.var(group1, ddof=1)
  var2 = np.var(group2, ddof=1)
  pooled_std = np.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2))
  return (np.mean(group1) - np.mean(group2)) / pooled_std
```

Use `ddof=1` for sample variance. Using `ddof=0` (population variance) systematically
underestimates the pooled standard deviation with small samples, which inflates d.

### Interpretation Thresholds

Cohen (1988) proposed these benchmarks:

| Absolute value of d | Interpretation |
|---------------------|----------------|
| Less than 0.2       | Negligible     |
| Around 0.2          | Small effect   |
| Around 0.5          | Medium effect  |
| Around 0.8          | Large effect   |
| Greater than 1.2    | Very large     |

These are not rigid boundaries. They are calibration points. A d of 0.3 is between
small and medium. What matters is whether the size of the effect justifies the cost
of the change.

### Full Example: Test Plus Effect Size

```python
from scipy.stats import ttest_ind

old_prompt = np.array([6, 8, 7, 5, 9, 11, 7, 8, 6, 10,
                       7, 9, 8, 6, 7, 8, 10, 5, 9, 7])
new_prompt = np.array([9, 11, 10, 8, 12, 14, 10, 11, 9, 13,
                       10, 12, 11, 9, 10, 8, 13, 9, 11, 10,
                       12, 11, 9, 10, 11])

result = ttest_ind(old_prompt, new_prompt, equal_var=False)
d = cohens_d(new_prompt, old_prompt)

print(f"Old prompt mean: {old_prompt.mean():.1f} findings")
print(f"New prompt mean: {new_prompt.mean():.1f} findings")
print(f"p-value: {result.pvalue:.6f}")
print(f"Cohen's d: {d:.2f}")
# Old prompt mean: 7.6 findings
# New prompt mean: 10.6 findings
# p-value: 0.000005
# Cohen's d: 1.98
```

The report to the Operator: "The new prompt produces significantly more findings
(p < 0.001), with a very large effect size (d = 1.98). The improvement is approximately
3 findings per review, or about 2 standard deviations."

That is a complete statement. The p-value establishes that the difference is real. The
effect size establishes that the difference is substantial. The plain-language
translation makes it actionable.

### Cramer's V for Categorical Data

Cramer's V is the effect size measure for chi-squared tests. It ranges from 0 (no
association) to 1 (perfect association).

```python
from scipy.stats import chi2_contingency

def cramers_v(contingency_table):
  """Compute Cramer's V from a contingency table."""
  chi2, p, dof, expected = chi2_contingency(contingency_table)
  n = np.sum(np.asarray(contingency_table))
  min_dim = min(np.asarray(contingency_table).shape) - 1
  return np.sqrt(chi2 / (n * min_dim))
```

| Value of V    | Interpretation     |
|---------------|--------------------|
| Less than 0.1 | Negligible         |
| 0.1 to 0.3   | Small to medium    |
| Greater than 0.3 | Medium to large |

### Full Example: Chi-Squared Plus Effect Size

```python
table = pd.crosstab(df['model'], df['severity'])
chi2, p, dof, expected = chi2_contingency(table)
v = cramers_v(table)

print(f"Chi-squared: {chi2:.4f}, p-value: {p:.4f}")
print(f"Cramer's V: {v:.4f}")
# Chi-squared: 10.5241, p-value: 0.1045
# Cramer's V: 0.2378
```

The report: "The severity distributions across models are not significantly different
(p = 0.10), and the association is small-to-medium (V = 0.24). The models are
roughly calibrated."

Even though the chi-squared test was not significant, computing V is still informative.
It tells you the association is weak, which reinforces the conclusion rather than
leaving you wondering whether you just lacked statistical power.

### Always Compute Effect Size

This is the rule: every time you run a statistical test, compute the corresponding
effect size. A significant p-value without an effect size is an incomplete answer.
A non-significant p-value with a large effect size means you probably need more data.

| Test | Effect size measure |
|------|-------------------|
| Independent t-test | Cohen's d |
| Paired t-test | Cohen's d on the differences |
| Mann-Whitney U | Cohen's d (on the raw data, as approximation) |
| Chi-squared | Cramer's V |
| Pearson correlation | r itself is the effect size |
| Spearman correlation | rho itself is the effect size |

> **AGENTIC GROUNDING:** When the Operator asks "did the prompt change improve
> quality?", the answer is not "yes, p = 0.03." The answer is "yes, the improvement
> is statistically significant (p = 0.03) with a medium effect size (d = 0.55),
> corresponding to about 2 additional findings per review." Agents will give you
> the first form. Your job is to demand the second. The effect size is what turns
> a statistical result into an operational decision.

---

## 7. Multiple Comparisons: The Accidental Discovery Problem

*Estimated time: 20 minutes*

You run the new prompt and decide to check everything: finding count, convergence rate,
severity distribution, match confidence, false positive rate, token usage, latency,
cost, unique finding count, and cross-model agreement. That is 10 tests.

At alpha = 0.05, each test has a 5% chance of producing a false positive (rejecting
the null when nothing actually changed). If you run 10 independent tests, the
probability of at least one false positive is approximately:

```python
# Probability of at least one false positive in 10 tests
alpha = 0.05
n_tests = 10
prob_at_least_one = 1 - (1 - alpha) ** n_tests
print(f"Probability of at least one false positive: {prob_at_least_one:.2%}")
# Probability of at least one false positive: 40.13%
```

A 40% chance of finding something "significant" when nothing changed. If you test 20
metrics, it rises to 64%. This is why "we tested everything and found one significant
result" is not convincing.

### Bonferroni Correction

The simplest fix: divide your alpha by the number of tests. If you are running 10
tests at alpha = 0.05, your corrected threshold is 0.005.

```python
alpha = 0.05
n_tests = 10
bonferroni_alpha = alpha / n_tests

# Check each test against the corrected threshold
test_results = [
    ("finding_count", 0.003),
    ("convergence_rate", 0.042),
    ("severity_dist", 0.105),
    ("match_confidence", 0.001),
    ("false_positive_rate", 0.087),
    ("token_usage", 0.220),
    ("latency", 0.015),
    ("cost", 0.310),
    ("unique_findings", 0.008),
    ("cross_model_agreement", 0.550),
]

print(f"Bonferroni-corrected alpha: {bonferroni_alpha}")
print()
for name, p in test_results:
    significant = p < bonferroni_alpha
    print(f"{name:25s}  p={p:.4f}  {'SIGNIFICANT' if significant else '-'}")
# Bonferroni-corrected alpha: 0.005
#
# finding_count              p=0.0030  SIGNIFICANT
# convergence_rate           p=0.0420  -
# severity_dist              p=0.1050  -
# match_confidence           p=0.0010  SIGNIFICANT
# false_positive_rate        p=0.0870  -
# token_usage                p=0.2200  -
# latency                    p=0.0150  -
# cost                       p=0.3100  -
# unique_findings            p=0.0080  -
# cross_model_agreement      p=0.5500  -
```

Before correction, four tests (finding count, convergence rate, latency, unique
findings) would have been called significant at 0.05. After correction, only two
survive: finding count and match confidence. Those are the results you can trust.

### Holm-Bonferroni: A Better Default

Bonferroni is conservative. With many tests, it becomes too conservative - it may miss
real effects. The Holm method is strictly more powerful (it always finds at least as
many significant results as Bonferroni, usually more) while still controlling the
false positive rate.

```python
from statsmodels.stats.multitest import multipletests

pvals = [p for _, p in test_results]
names = [name for name, _ in test_results]

reject, pvals_corrected, _, _ = multipletests(pvals, alpha=0.05, method='holm')

for name, raw_p, adj_p, sig in zip(names, pvals, pvals_corrected, reject):
    print(f"{name:25s}  raw={raw_p:.4f}  adjusted={adj_p:.4f}  {'SIGNIFICANT' if sig else '-'}")
```

The `multipletests` function from statsmodels handles the correction for you. Use
`method='holm'` as the default. It is better than Bonferroni in every case.

### When to Correct

Correct whenever you run multiple tests on the same dataset. This includes:
- Testing multiple metrics after a prompt change
- Comparing every pair of models
- Running the same test on different subsets of the data

Do not correct when the tests address genuinely different research questions that were
planned independently.

> **HISTORY:** The multiple comparisons problem was formalized by Olive Jean Dunn in
> 1961, building on work by Carlo Emilio Bonferroni. Dunn showed that the probability
> of a false positive grows predictably with the number of tests, and that dividing
> alpha by the number of tests controls this growth. The method is simple enough to do
> by hand, which is why it persists as the default correction 60 years later, even
> though better methods exist.

> **AGENTIC GROUNDING:** If you ask an agent to "analyze how the prompt change affected
> all metrics," it will happily run 15 tests and report every one with p < 0.05 as a
> "finding." Without correction, roughly one of those will be a false positive. When
> reviewing agent-generated analysis, count the number of tests and check whether
> correction was applied. If it was not, apply Holm-Bonferroni yourself before
> trusting any individual result.

---

## 8. Practical Significance vs Statistical Significance

*Estimated time: 20 minutes*

Statistical significance means: the difference is unlikely to be noise.
Practical significance means: the difference is large enough to justify action.

These are independent properties. A result can be:

| | Practically significant | Practically insignificant |
|---|---|---|
| **Statistically significant** | Act on it | Ignore it (the trap) |
| **Not statistically significant** | Get more data | No change needed |

The dangerous cell is the upper right: statistically significant but practically
meaningless. This happens more often than people expect, especially as sample sizes
grow.

### A Concrete Example

You run 500 reviews with each prompt version. The new prompt produces a mean of 8.32
findings per review. The old prompt produces 8.15. The t-test gives p = 0.04.

```python
old = np.random.normal(loc=8.15, scale=2.0, size=500)
new = np.random.normal(loc=8.32, scale=2.0, size=500)

result = ttest_ind(old, new, equal_var=False)
d = cohens_d(new, old)

print(f"p-value: {result.pvalue:.4f}")
print(f"Cohen's d: {d:.2f}")
print(f"Mean difference: {new.mean() - old.mean():.2f} findings")
# p-value: ~0.04 (varies with random seed)
# Cohen's d: ~0.09
# Mean difference: ~0.17 findings
```

The p-value says: significant. Cohen's d says: negligible (d = 0.09, well below
the 0.2 threshold for a "small" effect). The mean difference is 0.17 findings per
review.

Is it worth changing the production prompt, retraining the team on the new
instructions, and updating the documentation for 0.17 extra findings per review?
Almost certainly not.

### Define the Minimum Effect Before Testing

The discipline is: before running the test, decide what the smallest meaningful
difference would be. For finding counts, maybe 2 extra findings per review is
worth a prompt change. For convergence rate, maybe 5 percentage points. For false
positive rate, maybe a 10% reduction.

Then after the test, check both: is the p-value below alpha, AND is the observed
effect above your minimum threshold?

```python
# Define minimum meaningful effect before looking at results
MIN_EFFECT_FINDINGS = 2.0  # at least 2 more findings per review to justify change
MIN_EFFECT_D = 0.5         # at least a medium effect size

# After running the test
mean_diff = new_prompt.mean() - old_prompt.mean()
d = cohens_d(new_prompt, old_prompt)

if result.pvalue < 0.05 and abs(mean_diff) >= MIN_EFFECT_FINDINGS:
    print(f"RECOMMEND CHANGE: significant (p={result.pvalue:.4f}), "
          f"meaningful difference ({mean_diff:.1f} findings, d={d:.2f})")
elif result.pvalue < 0.05:
    print(f"STATISTICALLY SIGNIFICANT but practically small "
          f"({mean_diff:.1f} findings, d={d:.2f}). Not worth the cost of change.")
else:
    print(f"NOT SIGNIFICANT (p={result.pvalue:.4f}). No evidence of improvement.")
```

### The Relationship Between Sample Size, Effect Size, and Significance

These three quantities are connected:
- **Large effect, small sample:** often significant (easy to detect big differences)
- **Small effect, large sample:** often significant (enough data to detect tiny differences)
- **Small effect, small sample:** usually not significant (not enough power)
- **Large effect, large sample:** always significant (the obvious case)

The lesson: when a result is significant, always check the effect size. When a result
is not significant, consider whether you had enough data to detect the effect you care
about. A non-significant result with n = 8 per group does not mean "no effect" - it
means "not enough data to tell."

> **AGENTIC GROUNDING:** In the project's multi-model ensemble review (SD-318), three
> models review the same code. Small differences in finding count between models may
> be statistically significant with enough reviews, but operationally irrelevant.
> What matters is whether the models find different categories of issues (which
> justifies the cost of running three models) versus slightly different counts of the
> same issues (which does not). Effect size and the qualitative nature of the
> difference are what drive the decision, not the p-value.

---

## 9. Bootstrap Confidence Intervals

*Estimated time: 20 minutes*

Every test in this step makes assumptions about the data: normality, equal variances,
minimum sample sizes. Bootstrap makes almost no assumptions. It works by resampling.

The idea: you have one sample of data. You cannot go collect more. But you can simulate
what other samples might look like by randomly drawing observations from your data
with replacement. Do this thousands of times, compute the statistic each time, and look
at the distribution of results. The middle 95% of that distribution is your 95%
confidence interval.

### The Complete Pattern

This is the full implementation. Five lines of core logic.

```python
import numpy as np

def bootstrap_ci(data, statistic_fn=np.mean, n_bootstrap=10000, ci=95):
  """Bootstrap confidence interval for any statistic."""
  rng = np.random.default_rng(seed=42)
  data = np.asarray(data)
  boot_stats = np.array([
      statistic_fn(rng.choice(data, size=len(data), replace=True))
      for _ in range(n_bootstrap)
  ])
  lower = (100 - ci) / 2
  upper = 100 - lower
  return tuple(np.percentile(boot_stats, [lower, upper]))
```

Key details:
- `rng.choice(data, size=len(data), replace=True)` draws a sample the same size as
  the original, with replacement. Some observations will appear multiple times, some
  will be missing. This is what creates the variation.
- `np.percentile(boot_stats, [2.5, 97.5])` takes the 2.5th and 97.5th percentiles
  for a 95% CI.
- `np.random.default_rng(seed=42)` makes the result reproducible. Use the Generator
  API, not the legacy `np.random.seed()`.
- 10,000 iterations is the standard. Use 1,000 for quick exploration.

### Using It

```python
# Match confidence scores from a triangulate run
match_confidence = np.array([0.72, 0.85, 0.91, 0.68, 0.77, 0.83,
                             0.79, 0.88, 0.65, 0.93, 0.71, 0.86])

# 95% CI for the mean
lower, upper = bootstrap_ci(match_confidence)
print(f"Mean match confidence: {match_confidence.mean():.3f}")
print(f"95% CI: [{lower:.3f}, {upper:.3f}]")
# Mean match confidence: 0.798
# 95% CI: [0.745, 0.855]

# 95% CI for the median
lower, upper = bootstrap_ci(match_confidence, statistic_fn=np.median)
print(f"Median: {np.median(match_confidence):.3f}")
print(f"95% CI: [{lower:.3f}, {upper:.3f}]")
```

### When to Use Bootstrap

Bootstrap is the fallback when you do not know which parametric test to use, or when
the assumptions of parametric tests are clearly violated. It works for any statistic
you can compute from a sample: mean, median, 90th percentile, standard deviation,
Cohen's d, a custom metric.

The tradeoff: bootstrap requires more data points than parametric tests to achieve
the same precision. With n = 5, the bootstrap distribution will be lumpy and the CI
wide. With n = 30+, it works well.

> **HISTORY:** Bradley Efron introduced the bootstrap in 1979 at Stanford. The name
> comes from the phrase "pulling yourself up by your bootstraps" - the method creates
> information about sampling variability from the sample itself, without any
> assumptions about the population. It was controversial initially because
> statisticians trained on parametric methods found it suspiciously simple. But it
> works, and it has become one of the most widely used tools in applied statistics
> precisely because it avoids the distributional assumptions that practitioners
> routinely violate.

> **AGENTIC GROUNDING:** Bootstrap is particularly useful for the project's metrics
> because the sample sizes are small (5-28 records across the data sources) and the
> distributions are unknown. When reporting the mean convergence rate from triangulate
> runs, a bootstrap CI gives you honest error bars without assuming normality. The
> Operator gets: "Mean convergence rate is 0.42, 95% CI [0.31, 0.55]" instead of
> a single number that implies false precision.

---

## 10. Challenges

*Estimated time: 60-90 minutes total*

---

### Challenge 1: Before and After a Prompt Change

**Estimated time: 20 minutes**

**Goal:** Run a t-test and Mann-Whitney U test on simulated before/after data, compute
effect size, and write a one-paragraph report.

Set up the data:

```python
import numpy as np
from scipy.stats import ttest_ind, mannwhitneyu

rng = np.random.default_rng(seed=42)

# Old prompt: mean 8 findings, std 2.5
old_prompt = rng.normal(loc=8.0, scale=2.5, size=25)

# New prompt: mean 10 findings, std 2.5 (a real improvement)
new_prompt = rng.normal(loc=10.0, scale=2.5, size=30)
```

Steps:

1. Run `ttest_ind` with `equal_var=False`. Record the p-value.
2. Run `mannwhitneyu` with `alternative='two-sided'`. Record the p-value.
3. Compute Cohen's d using the function from section 6.
4. Write a one-paragraph report that includes: which test(s) you ran, the p-value(s),
   the effect size with interpretation (small/medium/large), the mean difference in
   plain language, and your recommendation.

**Verification:** Both tests should find significance (p < 0.05). Cohen's d should be
approximately 0.8 (large effect). Your report should mention both the statistical
significance and the practical meaning of the difference.

<details>
<summary>Hints</summary>

The report structure: "The new prompt produces significantly more findings than the
old prompt (t-test p=X, Mann-Whitney p=Y). The effect is large (d=Z), corresponding
to approximately N more findings per review. Recommendation: adopt the new prompt."

</details>

---

### Challenge 2: Severity Calibration Across Models

**Estimated time: 20 minutes**

**Goal:** Test whether three models distribute severity ratings differently, using a
chi-squared test with effect size.

Set up the data:

```python
import pandas as pd
import numpy as np
from scipy.stats import chi2_contingency

# Simulated finding severities from three models
# Model C tends to rate things higher
data = {
    'model': (['Model_A'] * 40 + ['Model_B'] * 45 + ['Model_C'] * 38),
    'severity': (
        ['low'] * 8 + ['medium'] * 18 + ['high'] * 11 + ['critical'] * 3 +
        ['low'] * 12 + ['medium'] * 20 + ['high'] * 10 + ['critical'] * 3 +
        ['low'] * 3 + ['medium'] * 10 + ['high'] * 16 + ['critical'] * 9
    )
}
df = pd.DataFrame(data)
```

Steps:

1. Build a contingency table with `pd.crosstab`.
2. Run `chi2_contingency`. Record chi-squared, p-value, and degrees of freedom.
3. Check that all expected cell frequencies are at least 5.
4. Compute Cramer's V.
5. Write a one-sentence conclusion: are the models calibrated differently?

**Verification:** The chi-squared test should find significance (p < 0.05). Cramer's V
should indicate a small-to-medium association. Model C's severity distribution should
visibly differ from the others in the crosstab.

---

### Challenge 3: Sample Size and Power

**Estimated time: 25 minutes**

**Goal:** Demonstrate how sample size affects the ability to detect a real but small
difference.

```python
import numpy as np
from scipy.stats import ttest_ind

rng = np.random.default_rng(seed=42)

# The true improvement is small: 0.5 findings more per review
true_effect = 0.5
base_mean = 8.0
std = 2.5

for n in [10, 30, 50, 100, 200, 500]:
    significant_count = 0
    for trial in range(1000):
        old = rng.normal(loc=base_mean, scale=std, size=n)
        new = rng.normal(loc=base_mean + true_effect, scale=std, size=n)
        _, p = ttest_ind(old, new, equal_var=False)
        if p < 0.05:
            significant_count += 1
    power = significant_count / 1000
    print(f"n={n:4d}  power={power:.2%}")
```

Steps:

1. Run the code above. It simulates 1,000 experiments at each sample size and reports
   how often the test correctly detects the difference (statistical power).
2. Answer: at what sample size does the power reach 80% (the conventional threshold)?
3. Now change `true_effect` to 2.0 (a large improvement). How does the required
   sample size change?
4. Write a one-paragraph explanation of why this matters for evaluating prompt changes.

**Verification:** At n=10, power should be very low (under 20%). At n=200, power
should approach or exceed 80% for the small effect. For the large effect, n=10 should
already have moderate power.

**Extension:** Modify the simulation to use Mann-Whitney U instead of the t-test.
Is the power similar? For normally distributed data, the t-test should have slightly
higher power. This demonstrates the tradeoff between making assumptions and making
fewer assumptions.

---

### Challenge 4: Bootstrap a Confidence Interval

**Estimated time: 15 minutes**

**Goal:** Compute a bootstrap 95% confidence interval for the median match confidence
from a triangulate run.

```python
import numpy as np

# Match confidence scores from a hypothetical triangulate run
match_confidence = np.array([
    0.72, 0.85, 0.91, 0.68, 0.77, 0.83, 0.62, 0.88,
    0.65, 0.93, 0.71, 0.86, 0.79, 0.90, 0.74
])
```

Steps:

1. Write (or copy) the `bootstrap_ci` function from section 9.
2. Compute the 95% CI for the median.
3. Compute the 95% CI for the mean.
4. Compare the widths. Which is wider, and why?
5. Compute the 95% CI for the 90th percentile. Interpret: what is the lower bound
   of what you can expect for the best matches?

**Verification:** The median CI should be narrower than the mean CI if the data has
no extreme outliers. The 90th percentile CI will be the widest because extreme
quantiles have more sampling variability with small samples.

<details>
<summary>Hints</summary>

For the 90th percentile, use:

```python
lower, upper = bootstrap_ci(
    match_confidence,
    statistic_fn=lambda x: np.percentile(x, 90)
)
```

</details>

---

## Key Takeaways

Before moving to Step 5, verify you can answer these questions without looking
anything up:

1. What does a p-value of 0.03 mean? (Not "97% chance the hypothesis is true.")
2. When do you use a paired t-test instead of an independent t-test?
3. When do you use Mann-Whitney U instead of a t-test?
4. What does the chi-squared test require as input? (Not percentages.)
5. What is Cohen's d, and why does it matter more than the p-value?
6. If you run 10 tests, what is the approximate probability of at least one false
   positive at alpha = 0.05? How do you correct for this?
7. What is the difference between statistical significance and practical significance?
8. When is bootstrap the right choice?
9. What are the three pieces of information a complete statistical report includes?
   (p-value, effect size, plain-language meaning.)
10. Given a significant p-value but a Cohen's d of 0.08, what do you tell the Operator?

---

## Recommended Reading

- **Statistical Methods for the Social Sciences** - Alan Agresti, Barbara Finlay (5th
  edition, 2017). Chapters 5-9 cover all the hypothesis tests in this step with
  worked examples. Written for practitioners, not mathematicians.

- **The New Statistics: Why and How** - Geoff Cumming (Psychological Science, 2014).
  The best single paper on why effect sizes and confidence intervals should replace
  p-value-only reporting. Short, readable, persuasive.

- **scipy.stats documentation** - `docs.scipy.org/doc/scipy/reference/stats.html`.
  The function signatures, parameters, and return values for every test in this step.
  Read the "Notes" sections - they contain the assumptions and edge cases.

- **Practical Statistics for Data Scientists** - Peter Bruce, Andrew Bruce, Peter Gedeck
  (2nd edition, 2020). Chapter 3 (Statistical Experiments and Significance Testing).
  Covers the same material from a data science practitioner perspective, with R and
  Python code.

---

## What to Read Next

**Step 5: Time Series Basics** - Agent metrics are time series: token usage per day,
error rate per hour, cost per week, convergence rate per review cycle. Step 5 covers
resampling and frequency conversion, moving averages for smoothing, trend detection
with linear regression, seasonal decomposition, and practical anomaly detection.
The statistical tests from this step compose directly: once you detect a trend (Step
5), you test whether it is significant (this step). Once you detect a changepoint
(Step 5), you measure the effect size before and after (this step).

