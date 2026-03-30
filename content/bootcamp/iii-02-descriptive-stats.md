+++
title = "Descriptive Statistics"
date = "2026-03-10"
description = "Central tendency, spread, percentiles, distribution shape, correlation. Describing what you have before claiming anything."
tags = ["statistics", "analytics", "bootcamp"]
step = 2
tier = 1
estimate = "3-4 hours"
bootcamp = 3
+++

Step 2 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

Before hypothesis testing, before time series analysis, before visualization - you need to
describe what you have. Descriptive statistics is the cheapest, fastest form of analysis.
It answers most operational questions without needing anything fancier.

Agents generate numerical data constantly: match confidence scores from `bin/triangulate`,
severity ratings from darkcat alley reviews, catch frequencies in `catch-log.tsv`, backlog
item ages in `backlog.yaml`. When the Operator asks "how well is the matching performing?"
or "which control fires the most?", the answer starts with descriptive statistics. Not a
model. Not a hypothesis test. A count, a mean, a percentile.

This step covers six topics that together give you the vocabulary to describe any
distribution you encounter in agentic engineering data. The key distinction to hold
throughout: this step describes data. Step 4 tests claims about data. "The median match
confidence is 0.73" is description. "The median match confidence is significantly higher
than 0.6" is a claim that requires a test. Stay in description territory here.

The goal: given any column of numbers or any pair of categorical variables from your
agent output, produce a complete description that an Operator can act on - without
reaching for tools you do not yet have.

---

## Table of Contents

1. [Central Tendency](#1-central-tendency) (~30 min)
2. [Spread](#2-spread) (~30 min)
3. [Percentiles and Quantiles](#3-percentiles-and-quantiles) (~30 min)
4. [Distribution Shape](#4-distribution-shape) (~30 min)
5. [Correlation](#5-correlation) (~30 min)
6. [Crosstabs and Contingency Tables](#6-crosstabs-and-contingency-tables) (~20 min)
7. [Challenges](#7-challenges) (~60-90 min)
8. [Key Takeaways](#key-takeaways)
9. [Recommended Reading](#recommended-reading)
10. [What to Read Next](#what-to-read-next)

---

## 1. Central Tendency

*Estimated time: 30 minutes*

Central tendency answers a single question: if you had to summarize this entire column
with one number, what would it be? The answer depends on the shape of the data, and
picking the wrong summary measure is one of the most common analytical mistakes in
operational work.

There are three measures. Each has a specific use case.

### Mean

The arithmetic mean is the sum divided by the count. It uses every value in the dataset,
which makes it sensitive to outliers.

```python
import pandas as pd
import yaml

# Load slopodar patterns
with open("docs/internal/slopodar.yaml") as f:
  patterns = yaml.safe_load(f)["patterns"]

df = pd.DataFrame(patterns)

# Simulate match confidence scores for a triangulate run
# (real data comes from bin/triangulate convergence.yaml)
import numpy as np
np.random.seed(42)
scores = pd.Series(
  np.random.beta(5, 2, size=30),  # right-skewed toward 1.0
  name="match_confidence"
)

scores.mean()
# 0.714
```

Use the mean when the distribution is roughly symmetric and has no extreme outliers.
Match confidence scores from `bin/triangulate` are a reasonable candidate - they are
bounded between 0 and 1 and typically cluster in the 0.6-0.9 range.

The mean fails when data is skewed. If nine agent responses take 200ms and one takes
20 seconds, the mean is 2.18 seconds. That number describes nothing useful about the
typical response.

### Median

The median is the middle value when sorted. It is insensitive to outliers because it
only cares about rank position, not magnitude.

```python
scores.median()
# 0.729

# Compare mean vs median
printf_fmt = "mean: {:.3f}, median: {:.3f}"
print(printf_fmt.format(scores.mean(), scores.median()))
# mean: 0.714, median: 0.729
```

Use the median for skewed distributions: response latencies, token counts, backlog item
ages, file sizes. Any distribution where a few large values pull the mean away from
the typical experience.

A practical rule: if `mean / median` differs by more than 10-15%, the distribution is
skewed enough that the median is the better summary. Report both, lead with the median.

### Mode

The mode is the most frequent value. It is the only measure of central tendency that
works for categorical data.

```python
# Load catch log
catches = pd.read_csv(
  "docs/internal/weaver/catch-log.tsv", sep="\t"
)

# Mode of the 'control' column - which control fires most?
catches["control"].mode()
# 0    dc-openai-r2
# (or whichever control appears most often)

# Mode of the 'outcome' column
catches["outcome"].mode()
# 0    logged
```

For numerical data, mode is rarely useful because continuous values seldom repeat exactly.
For categorical data - control names, severity levels, outcome types - mode answers the
question "what is the most common category?"

### Choosing the Right Measure

| Data type | Distribution shape | Use | Example |
|-----------|-------------------|-----|---------|
| Numeric | Symmetric | Mean | Match confidence scores |
| Numeric | Skewed | Median | Token counts, latencies, backlog item ages |
| Numeric | Heavy outliers | Median | API response times with timeout spikes |
| Categorical | Any | Mode | Control names, severity levels |
| Ordinal | Any | Median | Severity ratings (low/medium/high as 1/2/3) |

> **AGENTIC GROUNDING:** When the Operator asks "what is the typical match confidence
> for this triangulate run?", the answer is the median if the distribution is skewed, the
> mean if it is symmetric. Reporting only the mean on skewed data is a form of analytical
> lullaby - the number looks reasonable but misrepresents the typical experience. Check
> skewness before choosing. If you are unsure, report both.

---

## 2. Spread

*Estimated time: 30 minutes*

A central tendency number without a spread measure is incomplete. "The mean match
confidence is 0.71" could describe a run where every score is between 0.68 and 0.74,
or a run where scores range from 0.2 to 1.0. These are operationally different
situations. Spread tells you how different.

### Range

The simplest measure: maximum minus minimum.

```python
scores.max() - scores.min()
# 0.612
```

Range is fast but fragile. A single outlier inflates it. Useful as a first glance, not
as a final answer.

### Variance and Standard Deviation

Variance is the average of the squared deviations from the mean. Standard deviation is
the square root of variance - it brings the measure back to the original units.

```python
scores.var()   # sample variance (ddof=1 by default)
# 0.032

scores.std()   # sample standard deviation
# 0.178
```

A standard deviation of 0.178 on match confidence scores means most scores fall within
roughly 0.178 of the mean. If the mean is 0.71, expect most scores between 0.53 and
0.89. This is the informal "68% rule" for roughly bell-shaped distributions - about 68%
of values fall within one standard deviation of the mean.

**The ddof trap:** pandas uses `ddof=1` (sample standard deviation) by default. NumPy
uses `ddof=0` (population standard deviation). These produce different results on the
same data. For operational analytics on agent output, `ddof=1` is correct because your
data is always a sample from a larger process.

```python
# These are NOT the same
scores.std()          # pandas: ddof=1 (correct for samples)
np.std(scores)        # numpy: ddof=0 (population, usually wrong)
np.std(scores, ddof=1)  # numpy with sample correction (matches pandas)
```

### Interquartile Range (IQR)

IQR is the distance between the 75th and 25th percentiles. It is robust to outliers
because it ignores the top and bottom 25% of values.

```python
q75 = scores.quantile(0.75)
q25 = scores.quantile(0.25)
iqr = q75 - q25
print(f"IQR: {iqr:.3f} (Q1={q25:.3f}, Q3={q75:.3f})")
# IQR: 0.218 (Q1=0.590, Q3=0.808)
```

IQR is the preferred spread measure for skewed data, paired with the median. When
you report "median backlog item age: 4.2 days, IQR: 2.1-7.8 days", you are describing
the typical experience and its range in a way that is not distorted by a single
ancient backlog item that has been open for 90 days.

### The df.describe() Shortcut

The `describe()` method computes count, mean, std, min, 25th, 50th, 75th, and max in
one call. It is the single most useful method for initial data exploration.

```python
scores.describe()
# count    30.000000
# mean      0.714234
# std       0.178012
# min       0.204516
# 25%       0.590123
# 50%       0.729456
# 75%       0.808234
# max       0.916789
```

Walk through each row:

- **count** - how many non-null values. If count differs from your expected row count, you have missing data.
- **mean** - the arithmetic average. Compare to 50% (median) for skewness signal.
- **std** - sample standard deviation. Relative to the mean, is this tight or wide?
- **min/max** - extremes. Do they make sense? A match confidence of -0.3 would indicate a bug.
- **25%/50%/75%** - the quartiles. The distance between 25% and 75% is the IQR.

```python
# Custom percentiles for operational reporting
scores.describe(percentiles=[0.5, 0.9, 0.95, 0.99])
# count    30.000000
# mean      0.714234
# std       0.178012
# min       0.204516
# 50%       0.729456
# 90%       0.891234
# 95%       0.903456
# 99%       0.914567
# max       0.916789
```

> **AGENTIC GROUNDING:** The triangulate script computes `avg_confidence`, `min_confidence`,
> and `max_confidence` in its `match_diagnostics` output. These are descriptive statistics.
> But a single run's average tells you nothing about variability across runs. Run
> `df.describe()` on a column of match confidences collected from 10 runs and you get the
> spread story: is matching consistently good, or does it vary wildly between runs?

---

## 3. Percentiles and Quantiles

*Estimated time: 30 minutes*

Percentiles answer the question "what value is X% of the data below?" The 90th percentile
(p90) means 90% of values fall below this point. Percentiles are the operational language
of SLOs and performance targets.

### The Operational Percentiles: p50, p90, p95, p99

In SRE and agentic engineering, four percentiles carry specific meaning:

| Percentile | Meaning | Use case |
|-----------|---------|----------|
| p50 | The median - the typical experience | "Typical agent response time" |
| p90 | Where most of the distribution lives | "Most users experience this or better" |
| p95 | The tail begins here | "SLO boundary for response time" |
| p99 | Near-worst case | "How bad does it get for the unlucky 1%?" |

```python
operational_pcts = [0.50, 0.90, 0.95, 0.99]
scores.quantile(operational_pcts)
# 0.50    0.729
# 0.90    0.891
# 0.95    0.903
# 0.99    0.915
```

### Reading Percentiles Operationally

Consider match confidence scores from `bin/triangulate`:

```python
# Simulated data for a triangulate run with 50 finding groups
np.random.seed(99)
confidences = pd.Series(
  np.concatenate([
    np.random.normal(0.75, 0.10, 40),   # well-matched findings
    np.random.uniform(0.3, 0.5, 10),    # poor matches (singletons forced into groups)
  ]),
  name="match_confidence"
).clip(0, 1)

for p in [0.50, 0.90, 0.95, 0.99]:
  print(f"p{int(p*100):02d}: {confidences.quantile(p):.3f}")
# p50: 0.744
# p90: 0.856
# p95: 0.877
# p99: 0.913
```

Interpretation: the median match confidence is 0.74. The p90 is 0.86 - 90% of finding
groups have a confidence above the matching threshold (0.6). But there is a tail: the
bottom 10% includes poorly matched groups that may be false convergences. The gap
between p50 and p10 (not shown but easily computed) reveals the spread in the lower tail.

```python
# The lower tail matters for matching quality
low_pcts = [0.01, 0.05, 0.10, 0.25]
for p in low_pcts:
  print(f"p{int(p*100):02d}: {confidences.quantile(p):.3f}")
# p01: 0.312
# p05: 0.358
# p10: 0.401
# p25: 0.650
```

Now you see the full picture: the bottom 10% of matches have confidence below 0.40.
These are likely false convergences - findings grouped together that should not be.
The matching threshold of 0.6 is above p25 (0.65), so roughly 25% of groups are
near or below the quality threshold.

> **HISTORY:** The practice of reporting p50/p90/p95/p99 for latency originates from the
> SRE community at Google, formalized in the "Site Reliability Engineering" book (2016).
> The insight was that mean latency masks tail behavior - a service with 100ms mean latency
> might have a p99 of 10 seconds, meaning 1 in 100 requests takes 100x longer than typical.
> SLOs written against p99 force engineers to care about the tail, not just the average.
> This same framing applies directly to agent performance metrics: match confidence, review
> completion time, cost per run.

> **AGENTIC GROUNDING:** When the Operator asks "is the matching threshold of 0.6 working?",
> the answer is not the mean confidence (which can look fine even when 20% of matches are
> garbage). The answer is: "p10 is 0.40, meaning 10% of matches fall below 0.40. The
> threshold catches some bad matches but not all. Consider raising it to 0.65 based on the
> p25 value." Percentiles give the Operator a basis for setting thresholds.

---

## 4. Distribution Shape

*Estimated time: 30 minutes*

Central tendency and spread describe where the data is and how wide it is. Shape describes
the geometry - is it symmetric, lopsided, peaked, or flat? Shape determines which
summary statistics to trust and which analysis methods to use next.

### Skewness

Skewness measures asymmetry around the mean. A symmetric distribution has skewness near
zero. A right-skewed distribution (long tail to the right) has positive skewness. A
left-skewed distribution (long tail to the left) has negative skewness.

```python
# Right-skewed data: token counts typically have a long right tail
np.random.seed(42)
token_counts = pd.Series(
  np.random.lognormal(mean=6, sigma=1, size=100).astype(int),
  name="tokens"
)

print(f"mean: {token_counts.mean():.0f}")
print(f"median: {token_counts.median():.0f}")
print(f"skewness: {token_counts.skew():.2f}")
# mean: 803
# median: 427
# skewness: 2.85
```

The mean (803) is nearly twice the median (427). The skewness of 2.85 confirms the
right skew. This is typical for token counts, latencies, and file sizes - distributions
bounded at zero with no upper bound.

**Interpreting skewness values:**

| Skewness | Interpretation | Action |
|----------|---------------|--------|
| -0.5 to 0.5 | Roughly symmetric | Mean is a good summary |
| 0.5 to 1.0 or -1.0 to -0.5 | Moderately skewed | Report both mean and median |
| > 1.0 or < -1.0 | Heavily skewed | Lead with median, use IQR for spread |

### Kurtosis

Kurtosis measures the heaviness of the tails relative to a normal distribution. High
kurtosis means more extreme values than you would expect from a bell curve. Low kurtosis
means fewer extremes.

```python
print(f"kurtosis: {token_counts.kurtosis():.2f}")
# kurtosis: 10.34
```

Pandas uses "excess kurtosis" by default - a normal distribution has kurtosis 0. A
kurtosis of 10.34 means the token count distribution has much heavier tails than a
normal distribution. In operational terms: expect more extreme token usage events than
a bell-shaped model would predict.

For most operational analytics, skewness matters more than kurtosis. Kurtosis becomes
important when you are modeling costs or assessing risk - heavy tails mean occasional
very expensive runs.

### Histograms - The Visual Description

A histogram is the visual equivalent of describe() plus skewness. It shows the full
shape at a glance.

```python
import matplotlib.pyplot as plt

fig, axes = plt.subplots(1, 2, figsize=(12, 4))

# Left: symmetric-ish data (match confidence)
axes[0].hist(scores, bins=15, edgecolor="black", alpha=0.7)
axes[0].axvline(scores.mean(), color="red", linestyle="--", label="mean")
axes[0].axvline(scores.median(), color="blue", linestyle="--", label="median")
axes[0].set_title("Match Confidence (roughly symmetric)")
axes[0].set_xlabel("confidence")
axes[0].legend()

# Right: skewed data (token counts)
axes[1].hist(token_counts, bins=20, edgecolor="black", alpha=0.7)
axes[1].axvline(token_counts.mean(), color="red", linestyle="--", label="mean")
axes[1].axvline(token_counts.median(), color="blue", linestyle="--", label="median")
axes[1].set_title("Token Counts (right-skewed)")
axes[1].set_xlabel("tokens")
axes[1].legend()

plt.tight_layout()
plt.savefig("distribution_shapes.png", dpi=100)
plt.show()
```

When the mean and median lines overlap, the distribution is symmetric. When the mean
line is pulled away from the median toward the tail, the distribution is skewed. The
histogram makes this visible instantly.

Step 6 (Visualization) covers plotting in depth. Here, the histogram serves as a
diagnostic tool for choosing the right descriptive statistics.

### The describe-then-histogram Workflow

When you first encounter a numerical column from agent output: (1) `col.describe()`,
(2) `col.skew()`, (3) `col.hist(bins=20)`. This takes 30 seconds and tells you the
center, spread, shape, and whether there are outliers. It is the first thing to do
before any further analysis.

> **AGENTIC GROUNDING:** When the Operator sees a metrics YAML from `bin/triangulate`
> showing `avg_confidence: 0.72`, the natural follow-up is "is that good?" A histogram
> of all 50 match confidences reveals whether 0.72 is a tight cluster (good - matching
> is consistent) or a bimodal split between good matches at 0.85 and bad matches at 0.35
> (bad - the average is misleading). Always look at shape before trusting a single number.

---

## 5. Correlation

*Estimated time: 30 minutes*

Correlation measures the strength and direction of the linear relationship between two
numerical variables. It answers: "when one goes up, does the other go up too?"

### Pearson Correlation

Pearson correlation (r) measures linear association. It ranges from -1 (perfect negative
linear relationship) to +1 (perfect positive linear relationship). Zero means no linear
relationship.

```python
# Simulate: finding count vs review file length
np.random.seed(42)
n_reviews = 30
review_data = pd.DataFrame({
  "file_lines": np.random.randint(200, 800, n_reviews),
  "finding_count": np.random.randint(3, 25, n_reviews),
})
# Add some correlation: longer reviews tend to have more findings
review_data["finding_count"] = (
  review_data["file_lines"] * 0.02
  + np.random.normal(0, 3, n_reviews)
).clip(1).astype(int)

r = review_data["file_lines"].corr(review_data["finding_count"])
print(f"Pearson r: {r:.3f}")
# Pearson r: 0.682
```

**Interpreting Pearson r:**

| r value | Interpretation |
|---------|---------------|
| 0.0 to 0.3 | Weak |
| 0.3 to 0.7 | Moderate |
| 0.7 to 1.0 | Strong |

The same thresholds apply to negative values. r = -0.65 is a moderate negative
correlation.

A Pearson r of 0.68 between file length and finding count means: longer review files
tend to have more findings, with moderate strength. This is not surprising - more code
reviewed means more potential issues - but quantifying it lets you normalize. "Model A
found 20 findings in a 600-line file; Model B found 15 in a 300-line file. Model B
actually found more per line."

### Spearman Correlation

Spearman correlation measures monotonic (not necessarily linear) association. It works
on ranks rather than raw values, making it robust to outliers and valid for ordinal data.

```python
# Spearman: uses ranks, robust to outliers
r_spearman = review_data["file_lines"].corr(
  review_data["finding_count"], method="spearman"
)
print(f"Spearman rho: {r_spearman:.3f}")
# Spearman rho: 0.701
```

**When to use which:**

| Scenario | Use | Reason |
|----------|-----|--------|
| Both variables are continuous, relationship is linear | Pearson | Measures linear strength directly |
| Relationship is monotonic but not linear | Spearman | Captures non-linear monotonic trends |
| Outliers present | Spearman | Rank-based, outlier-resistant |
| Ordinal data (severity: low/medium/high as 1/2/3) | Spearman | Designed for ranked data |
| Both variables are continuous, no outliers, linear check | Pearson first | Then Spearman to confirm |

### Correlation Matrix

When you have multiple numerical columns, compute all pairwise correlations at once:

```python
corr_matrix = metrics[["finding_count", "match_confidence", "severity_score"]].corr()
print(corr_matrix.round(2))
```

The matrix is symmetric with 1.0 on the diagonal. Scan off-diagonal cells for values
above 0.5 or below -0.5 - these are the relationships worth investigating.

### Correlation Is Not Causation

This bears repeating because it is the most abused statistical concept in operational
reporting. If finding count correlates with review file length, it could mean:
- Longer files have more surface area for findings (plausible causal link)
- More findings cause the report to be longer (reverse causation)
- Both are driven by a third variable: codebase size (confound)

Correlation tells you where to look. It does not tell you why. The "why" requires
domain knowledge and sometimes experimentation (Step 4 territory).

> **HISTORY:** Karl Pearson published his correlation coefficient in 1895, but the
> concept was developed by Francis Galton in the 1880s while studying the relationship
> between parents' and children's heights. Galton called it "co-relation" and noted
> that tall parents tend to have tall children, but not as tall as themselves - the
> phenomenon he named "regression to the mean." Charles Spearman published his rank
> correlation in 1904, specifically because he needed a measure that worked for
> ordinal data (intelligence test rankings). Both measures remain the workhorses of
> exploratory data analysis 130 years later.

> **AGENTIC GROUNDING:** The triangulate script computes convergence counts and match
> confidence scores per finding. If you compute the correlation between `convergence_count`
> and `match_confidence` across findings, a strong positive correlation means the matching
> algorithm assigns higher confidence to findings that multiple models agree on. A weak
> correlation means confidence scores are not tracking agreement well - a signal that the
> matching threshold or similarity algorithm may need tuning.

---

## 6. Crosstabs and Contingency Tables

*Estimated time: 20 minutes*

Crosstabs (cross-tabulations) describe the relationship between two categorical variables.
They answer questions like "how does severity distribute across models?" or "which
controls are used by which agents?"

### Basic Crosstab

```python
# Load catch log
catches = pd.read_csv(
  "docs/internal/weaver/catch-log.tsv", sep="\t"
)

# Crosstab: agent vs outcome
ct = pd.crosstab(catches["agent"], catches["outcome"])
print(ct)
# outcome    blocked  fixed  logged  reviewed  scrubbed
# agent
# operator(L12)    0      0       0         0         1
# weaver           1      2       4         2         0
```

Each cell shows the count of rows matching that combination of agent and outcome. The
table reveals patterns that are invisible in individual `value_counts()` calls: the
Operator catches things that get scrubbed, the Weaver catches things that get logged or
fixed.

### Margins and Normalization

Add row and column totals with `margins=True`. Normalize to see proportions instead of
counts:

```python
# With totals
ct_margins = pd.crosstab(
  catches["agent"],
  catches["outcome"],
  margins=True,
)
print(ct_margins)

# Normalized by row (each row sums to 1.0)
ct_norm = pd.crosstab(
  catches["agent"],
  catches["outcome"],
  normalize="index",  # "index" = row, "columns" = column, "all" = total
)
print(ct_norm.round(2))
```

Normalizing by row answers: "of the things the Weaver caught, what proportion were
logged vs fixed vs blocked?" Normalizing by column answers: "of all logged catches,
what proportion came from the Weaver vs the Operator?"

### Crosstab on Slopodar Data

The slopodar patterns have two categorical fields well-suited for crosstab analysis:
`domain` and `severity`.

```python
with open("docs/internal/slopodar.yaml") as f:
  patterns = yaml.safe_load(f)["patterns"]
slop_df = pd.DataFrame(patterns)

# Domain vs severity
ct_slop = pd.crosstab(
  slop_df["domain"],
  slop_df["severity"],
  margins=True,
)
print(ct_slop)
```

This reveals which domains have the most high-severity patterns. If `relationship-sycophancy`
has 5 high-severity entries while `prose-style` has only 2, that tells you where the
most dangerous patterns cluster.

> **AGENTIC GROUNDING:** The convergence matrix from `bin/triangulate` is conceptually
> a crosstab: findings (rows) crossed with reviews (columns), with binary values indicating
> which review found each finding. When the Operator asks "which model finds the most
> unique issues?", the answer comes from a crosstab of findings by model with a
> `convergence_count` filter. Findings with `convergence_count == 1` are unique to one model.
> A crosstab of `found_by` across models shows the overlap structure.

---

## 7. Challenges

*Estimated time: 60-90 minutes total*

---

### Challenge 1: Describe Match Confidence Scores

**Estimated time: 15 minutes**

**Goal:** Produce a complete descriptive summary of match confidence scores from a
simulated triangulate run.

Generate a realistic dataset and compute the full descriptive summary:

```python
import pandas as pd
import numpy as np

# Simulate 50 finding groups from a triangulate run
np.random.seed(2026)
confidences = pd.Series(
  np.concatenate([
    np.random.normal(0.78, 0.08, 35),   # well-matched
    np.random.uniform(0.30, 0.55, 10),   # poor matches
    np.random.normal(0.92, 0.03, 5),     # near-perfect matches
  ]),
  name="match_confidence"
).clip(0, 1)
```

Produce:

1. `describe()` output with custom percentiles: p50, p90, p95, p99
2. Skewness value and interpretation (symmetric, moderate, or heavy skew?)
3. A histogram with mean and median lines
4. A one-paragraph interpretation: is the matching performing well? What does the
   distribution shape tell you about the quality of the matching algorithm?

**Verification:** Your skewness should be negative (left-skewed due to the cluster of
high values). The p10 value should reveal the poor-match tail. Your interpretation
should note the bimodal tendency (a cluster around 0.78 and a lower cluster around 0.4).

<details>
<summary>Hints</summary>

- Use `confidences.describe(percentiles=[0.10, 0.50, 0.90, 0.95, 0.99])`
- Use `confidences.skew()` for the skewness value
- For the histogram: `confidences.hist(bins=20, edgecolor="black")`
- A bimodal distribution often has a skewness near zero even though it is not symmetric.
  The histogram reveals this while skewness alone does not.

</details>

---

### Challenge 2: Catch-Log Control Frequency Analysis

**Estimated time: 20 minutes**

**Goal:** Analyze the frequency distribution of controls in the catch log and produce a
crosstab of controls vs outcomes.

Load the real catch log and answer these questions:

```python
catches = pd.read_csv(
  "docs/internal/weaver/catch-log.tsv", sep="\t"
)
```

1. What is the mode of the `control` column? (Which control fires most often?)
2. What is the mode of the `outcome` column? (What is the most common outcome?)
3. Produce a `value_counts()` for both columns.
4. Build a crosstab of `control` vs `outcome`. Which control-outcome pair is most common?
5. Normalize the crosstab by row. For the most frequent control, what proportion of its
   catches result in each outcome?

**Verification:** Your `value_counts()` should show 10 total entries across all controls.
The crosstab should be sparse (many zero cells) because 10 rows with ~6 unique controls
and ~5 unique outcomes produce a wide, mostly-empty table.

---

### Challenge 3: Backlog Item Age Distribution

**Estimated time: 20 minutes**

**Goal:** Compute the age of each backlog item and describe the distribution.

```python
import yaml
import pandas as pd

with open("docs/internal/backlog.yaml") as f:
  backlog = pd.DataFrame(yaml.safe_load(f) or [])

backlog["created"] = pd.to_datetime(backlog["created"])
backlog["age_days"] = (pd.Timestamp.now(tz="UTC") - backlog["created"]).dt.total_seconds() / 86400
```

Produce:

1. `describe()` on `age_days`
2. Mean, median, and the ratio `mean / median`. Is the distribution skewed?
3. IQR of `age_days`
4. A crosstab of `priority` vs `tags` (you will need to explode the tags list first)
5. One-paragraph interpretation: are backlog items aging uniformly or is there a cluster
   pattern by priority?

**Verification:** All 10 items are from a narrow date range (2026-03-08 to 2026-03-10),
so the age distribution will be tight with a small range. The `mean / median` ratio
should be close to 1.0, indicating low skewness within this small dataset.

<details>
<summary>Hints</summary>

- To explode the tags list: `backlog_exploded = backlog.explode("tags")`
- Then: `pd.crosstab(backlog_exploded["priority"], backlog_exploded["tags"])`
- The IQR is `backlog["age_days"].quantile(0.75) - backlog["age_days"].quantile(0.25)`

</details>

---

### Challenge 4: Slopodar Confidence-Severity Correlation

**Estimated time: 20 minutes**

**Goal:** Investigate whether confidence level and severity level correlate in the
slopodar anti-pattern taxonomy.

```python
import yaml
import pandas as pd

with open("docs/internal/slopodar.yaml") as f:
  patterns = yaml.safe_load(f)["patterns"]

slop = pd.DataFrame(patterns)
```

1. Map `confidence` to numeric: `{"strong": 3, "medium": 2, "low": 1}`. Map `severity`
   to numeric: `{"high": 3, "medium": 2, "low": 1}`.
2. Compute Spearman correlation between the numeric confidence and severity columns.
   (Spearman because these are ordinal, not continuous.)
3. Build a crosstab of `confidence` vs `severity` to see the joint distribution.
4. Build a crosstab of `domain` vs `confidence` to see which domains have the most
   confident detections.
5. Interpret: is higher confidence associated with higher severity? Which domain has
   the weakest confidence?

**Verification:** The slopodar has 28 patterns. Severity values observed are `high` and
`medium` only (no `low` severity). Confidence values are `strong`, `medium`, and `low`.
Your Spearman correlation should be modest because there are only two severity levels,
limiting the range of the variable.

**Extension:** Compute the per-domain mean severity score. Which domains have the highest
average severity? Does this align with which domains the Operator should prioritize?

---

## Key Takeaways

Before moving to Step 4, verify you can answer these without looking anything up:

1. When should you use median instead of mean? (Name a specific distribution shape.)
2. What does `df.describe()` compute, and which row tells you about skewness indirectly?
3. What is the IQR, and why is it preferred over standard deviation for skewed data?
4. What does p95 mean operationally? Write one sentence using an agent metric example.
5. How do you interpret a skewness value of 2.5?
6. What is the difference between Pearson and Spearman correlation?
7. When does Pearson correlation mislead you? (Name two scenarios.)
8. What does `pd.crosstab()` compute, and when is it more useful than `value_counts()`?
9. Why is "correlation is not causation" specifically dangerous in operational reporting?
10. What is the describe-then-histogram workflow, and why does it take 30 seconds?

---

## Recommended Reading

- **Practical Statistics for Data Scientists** - Andrew Bruce, Peter Bruce (2nd edition,
  2020). Chapters 1-3 cover descriptive statistics, distributions, and correlation with a
  practitioner orientation rather than a theoretical one. The best single-volume reference
  for operational analytics.

- **Think Stats** - Allen Downey (2nd edition, 2014). Available free online. Chapters 1-4
  cover distributions, PMFs, CDFs, and the relationship between summary statistics and
  distribution shape. Code-heavy, Python-based, no filler.

- **The Visual Display of Quantitative Information** - Edward Tufte (2001). Not about
  statistics per se, but about how to present statistical summaries honestly. The
  histogram section in this step is a preview; Tufte explains why visual summaries
  complement numerical ones.

- **pandas documentation: `DataFrame.describe()`** -
  `https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.describe.html` -
  the canonical reference for customizing percentiles and column inclusion.

---

## What to Read Next

**Step 4: Statistical Testing for Practitioners** - This step described what your data
looks like. Step 4 asks whether differences and patterns are real or noise. "The median
match confidence is 0.73 for Model A and 0.68 for Model B" is description (this step).
"Model A's match confidence is significantly higher than Model B's" is a claim that
requires a hypothesis test (Step 4). Step 4 covers the Mann-Whitney U test, chi-squared
tests for crosstabs, bootstrap confidence intervals, and effect sizes. Every test in
Step 4 builds on the descriptive foundation from this step - you need to know the shape
of your distribution before you can choose the right test.

Alternatively, **Step 5: Time Series Basics** takes the descriptive statistics from this
step and adds the time dimension. Instead of "what is the median match confidence?", you
ask "is the median match confidence trending up or down over the last 10 runs?" Time
series analysis is description with a temporal axis.

