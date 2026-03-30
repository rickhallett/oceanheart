+++
title = "Cost Modelling for API-Based Systems"
date = "2026-03-10"
description = "Token economics, cost per task, trend analysis, marginal cost, budget forecasting."
tags = ["cost", "modelling", "api", "bootcamp"]
step = 8
tier = 3
estimate = "3-4 hours"
bootcamp = 3
+++

Step 8 of 10 in Bootcamp III: Operational Analytics.

---

> **FIELD MATURITY: Emerging.** API cost modeling for agent systems is a new practice
> area. Tooling exists (provider dashboards, billing APIs) but conventions are not settled.
> Pricing changes frequently - sometimes quarterly. This step teaches the analytical
> framework: cost per task, marginal cost per unit of value, budget forecasting from
> time series data. The specific prices used in examples are illustrative, not current.
> Check your provider's pricing page before making real budget decisions.

---

## Why This Step Exists

Every LLM API call has a cost. Input tokens have a price. Output tokens have a higher
price. When an agent system runs a multi-step workflow - generate a plan, execute each
step, review the output, retry on failure - the total cost is the sum of all those calls.
When a multi-model ensemble review like the project's darkcat alley process sends the
same code to three different models, the cost is roughly 3x a single review.

The question is not "how much does it cost?" The question is "is it worth the cost?"

The project's `bin/triangulate` script already computes **marginal value** - the number
of unique findings each successive model adds in a darkcat alley run. This step pairs
marginal value with **marginal cost**. The combination produces the operational decision
this entire step exists to enable: "Is the Nth model worth its cost?"

This is engineering economics, not financial analysis. The numbers are small (dollars per
run, not millions per quarter), the decisions are frequent (every pipeline configuration
change), and the data is available in the API response metadata. You do not need an
accounting degree. You need pandas, the pricing table, and the marginal analysis
framework from the project lexicon.

The goal: turn raw token counts from API responses into budget forecasts and
cost-per-unit-of-value metrics that inform real operational decisions.

---

## Table of Contents

1. [Token Counting and Pricing](#1-token-counting-and-pricing) (~30 min)
2. [Cost Per Task](#2-cost-per-task) (~30 min)
3. [Cost Trend Analysis](#3-cost-trend-analysis) (~30 min)
4. [Marginal Cost Analysis](#4-marginal-cost-analysis) (~30 min)
5. [Cost Optimization Patterns](#5-cost-optimization-patterns) (~30 min)
6. [Budget Forecasting](#6-budget-forecasting) (~30 min)
7. [Challenges](#7-challenges) (~60-90 min)
8. [Key Takeaways](#key-takeaways)
9. [Recommended Reading](#recommended-reading)
10. [What to Read Next](#what-to-read-next)

---

## 1. Token Counting and Pricing

*Estimated time: 30 minutes*

The atomic unit of LLM cost is the **token**. A token is a chunk of text - roughly 4
characters or 0.75 words in English, though the exact mapping depends on the tokenizer.
The cost of an API call is determined by two counts: how many tokens you send in (the
prompt, the system message, the conversation history) and how many tokens the model
generates back (the completion).

These are priced differently. Output tokens cost more than input tokens - typically 3-5x
more. This asymmetry exists because generation requires more compute per token than
encoding does. The model processes all input tokens in parallel during the forward pass,
but generates output tokens sequentially, one at a time.

### Input vs Output Tokens

Every API response includes token usage metadata. The exact field names vary by provider,
but the structure is consistent:

```python
# Anthropic Claude - response.usage
{
  "input_tokens": 1523,
  "output_tokens": 847
}

# OpenAI - response.usage
{
  "prompt_tokens": 1523,
  "completion_tokens": 847,
  "total_tokens": 2370
}

# Google Gemini - response.usage_metadata
{
  "prompt_token_count": 1523,
  "candidates_token_count": 847,
  "total_token_count": 2370
}
```

The field names differ but the semantics are identical: tokens in, tokens out, total.

### Illustrative Pricing

> **NOTE:** The prices below are illustrative examples for teaching the analytical
> framework. They are not current prices. API pricing changes frequently. Always check
> the provider's current pricing page before making budget decisions.

| Provider | Model | Input (per 1M tokens) | Output (per 1M tokens) |
|----------|-------|----------------------|------------------------|
| Anthropic | Claude Sonnet | $3.00 | $15.00 |
| OpenAI | GPT-4o | $5.00 | $15.00 |
| Google | Gemini 1.5 Pro | $3.50 | $10.50 |

The unit "per 1 million tokens" is standard across providers. To compute cost for a
single call:

```python
import pandas as pd

# Illustrative prices (check provider pages for current rates)
PRICES = {
  "claude-sonnet": {"input": 3.00 / 1_000_000, "output": 15.00 / 1_000_000},
  "gpt-4o":        {"input": 5.00 / 1_000_000, "output": 15.00 / 1_000_000},
  "gemini-1.5-pro":{"input": 3.50 / 1_000_000, "output": 10.50 / 1_000_000},
}

def compute_call_cost(model, input_tokens, output_tokens):
  """Compute cost of a single API call."""
  p = PRICES[model]
  return input_tokens * p["input"] + output_tokens * p["output"]

# Example: a Claude Sonnet call with 2000 input, 500 output tokens
cost = compute_call_cost("claude-sonnet", 2000, 500)
# 2000 * 0.000003 + 500 * 0.000015 = 0.006 + 0.0075 = $0.0135
```

A single call costs fractions of a cent. The cost becomes material through volume -
hundreds or thousands of calls per day in an active agent system.

### Cached vs Uncached Tokens

Some providers offer **prompt caching** - when you send the same prefix repeatedly
(for example, a long system prompt), the cached tokens are charged at a reduced rate.

```python
# Anthropic cache pricing structure (illustrative)
CACHE_PRICES = {
  "claude-sonnet": {
    "input_cached": 0.30 / 1_000_000,    # 90% discount on cached input
    "input_uncached": 3.00 / 1_000_000,
    "cache_write": 3.75 / 1_000_000,     # one-time cost to write to cache
    "output": 15.00 / 1_000_000,
  }
}

def compute_cached_cost(model, cached_tokens, uncached_tokens, output_tokens,
                        cache_write_tokens=0):
  """Compute cost with prompt caching."""
  p = CACHE_PRICES[model]
  return (
    cached_tokens * p["input_cached"]
    + uncached_tokens * p["input_uncached"]
    + cache_write_tokens * p["cache_write"]
    + output_tokens * p["output"]
  )
```

Prompt caching is relevant when your system prompt or context window has a large
stable prefix. A 10,000-token system prompt sent 100 times costs $3.00 at full price
but only $0.30 at cached price (after the initial cache write). Section 5 covers this
as an optimization pattern.

### Context Window Utilization

Larger context windows cost more because more input tokens means more cost. A common
pattern in agent systems is stuffing the context window with conversation history,
retrieved documents, or previous tool outputs. Each of those tokens has a price.

```python
# Context window utilization analysis
df = pd.DataFrame({
  "call_id": ["c1", "c2", "c3", "c4", "c5"],
  "input_tokens": [1200, 8400, 45000, 2100, 95000],
  "output_tokens": [300, 450, 1200, 200, 2000],
  "max_context": [200000] * 5,
})

df["utilization"] = df["input_tokens"] / df["max_context"]
df["cost"] = df.apply(
  lambda r: compute_call_cost("claude-sonnet", r["input_tokens"], r["output_tokens"]),
  axis=1,
)

# Call c5 uses 47.5% of context and costs 70x more input cost than c1
```

> **AGENTIC GROUNDING:** Agent systems tend to grow their context windows over time.
> Each tool call result appended to the conversation adds tokens. Each retry adds
> tokens. A multi-turn agent session that starts at 2,000 tokens can reach 50,000
> tokens by the 10th turn. If you are not tracking context utilization per call,
> you cannot explain why costs spike on long sessions. The token count is in the
> API response - log it.

---

## 2. Cost Per Task

*Estimated time: 30 minutes*

A single API call is rarely the unit of work. The unit of work is a **task** - a
multi-step workflow that produces a useful output. Decomposing a task into its API
calls is the first step toward understanding what things actually cost.

### Decomposing a Workflow

Consider the project's darkcat alley pipeline - a multi-model ensemble review:

1. **Review 1** - Send code to Claude for adversarial review. One API call.
2. **Review 2** - Send same code to GPT-4o for adversarial review. One API call.
3. **Review 3** - Send same code to Gemini for adversarial review. One API call.
4. **Parse** - Extract findings from each review. Local computation, no API cost.
5. **Triangulate** - Match findings across reviews, compute metrics. Local, no API cost.

Steps 1-3 have API costs. Steps 4-5 are local computation (CPU time, not dollars).
The total cost of a darkcat alley run is the sum of the three review calls.

```python
# Decompose a darkcat alley run into costs
reviews = pd.DataFrame({
  "step": ["review_claude", "review_gpt4o", "review_gemini"],
  "model": ["claude-sonnet", "gpt-4o", "gemini-1.5-pro"],
  "input_tokens": [12000, 12000, 12000],   # same code sent to each
  "output_tokens": [3500, 4200, 3800],      # models produce different amounts
})

reviews["cost"] = reviews.apply(
  lambda r: compute_call_cost(r["model"], r["input_tokens"], r["output_tokens"]),
  axis=1,
)

total_task_cost = reviews["cost"].sum()

# Per-step costs:
# claude:  12000 * 0.000003 + 3500 * 0.000015 = $0.036 + $0.0525 = $0.0885
# gpt-4o:  12000 * 0.000005 + 4200 * 0.000015 = $0.060 + $0.0630 = $0.1230
# gemini:  12000 * 0.0000035 + 3800 * 0.0000105 = $0.042 + $0.0399 = $0.0819
# Total: ~$0.29 per darkcat alley run
```

### Recording Cost Per Call

The key discipline is recording token counts with every API call. Build a log:

```python
import datetime

cost_log = []

def log_api_call(task_id, step, model, input_tokens, output_tokens):
  """Record an API call with its cost."""
  cost = compute_call_cost(model, input_tokens, output_tokens)
  cost_log.append({
    "timestamp": datetime.datetime.now().isoformat(),
    "task_id": task_id,
    "step": step,
    "model": model,
    "input_tokens": input_tokens,
    "output_tokens": output_tokens,
    "cost_usd": cost,
  })

# After collecting calls:
df_costs = pd.DataFrame(cost_log)

# Cost by task
df_costs.groupby("task_id")["cost_usd"].sum()

# Cost by model
df_costs.groupby("model")["cost_usd"].sum()

# Cost by step
df_costs.groupby("step")["cost_usd"].sum()
```

### Cost Distribution Within a Task

Not all steps cost equally. In the darkcat alley example, the GPT-4o review costs
~42% of the total despite being one of three reviews - because its input price is
higher. Understanding which step dominates the cost tells you where optimization
effort should focus.

```python
reviews["cost_pct"] = reviews["cost"] / reviews["cost"].sum() * 100

# Output:
#   step             model            cost     cost_pct
#   review_claude    claude-sonnet    0.0885   30.3
#   review_gpt4o     gpt-4o           0.1230   42.1
#   review_gemini    gemini-1.5-pro   0.0819   28.0
```

> **AGENTIC GROUNDING:** When an agent pipeline runs slowly or expensively, the
> instinct is to optimize "the AI part." But cost decomposition often reveals that
> one step dominates. In the darkcat alley pipeline, replacing the most expensive
> model saves 42% of cost. Replacing the cheapest saves 28%. The decomposition
> tells you where the leverage is. Without it, you are optimizing blind.

---

## 3. Cost Trend Analysis

*Estimated time: 30 minutes*

Cost per task is a snapshot. Cost over time is a trend. This section applies the time
series techniques from Step 5 (moving averages, trend detection) to cost data.

### Daily Cost Time Series

Start with a daily aggregate: total cost per day across all tasks.

```python
# Simulate 30 days of API cost data
import numpy as np

np.random.seed(42)
dates = pd.date_range("2026-02-01", periods=30, freq="D")
# Base cost ~$8/day with slight upward trend and noise
base_cost = 8.0 + np.arange(30) * 0.15  # trend: +$0.15/day
noise = np.random.normal(0, 1.5, 30)
daily_cost = base_cost + noise
daily_cost = np.maximum(daily_cost, 0)  # no negative costs

df_daily = pd.DataFrame({"date": dates, "daily_cost": daily_cost})
df_daily = df_daily.set_index("date")
```

### Moving Averages for Cost Smoothing

Daily cost is noisy. A 7-day moving average (covered in Step 5) smooths the noise
and reveals the underlying trend:

```python
df_daily["sma_7"] = df_daily["daily_cost"].rolling(7).mean()
df_daily["ewma_7"] = df_daily["daily_cost"].ewm(span=7).mean()

# The SMA shows the smoothed trend
# The EWMA gives more weight to recent days - useful for detecting
# cost changes that happened in the last few days
```

### Trend Detection

Is cost going up or down? Use `scipy.stats.linregress` (as introduced in Step 5)
on the daily cost data:

```python
from scipy import stats

# Convert dates to ordinal numbers for regression
x = np.arange(len(df_daily))
y = df_daily["daily_cost"].values

slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)

# slope > 0 means cost is increasing
# p_value < 0.05 means the trend is statistically significant
# r_value**2 is the fraction of variance explained by the trend

# With our simulated data:
# slope ~ 0.15 (cost increasing ~$0.15/day)
# p_value < 0.05 (trend is real, not noise)
```

### Budget Burn Rate

The **burn rate** is the rate at which you are consuming your monthly budget. It is
the slope of cumulative cost over time.

```python
monthly_budget = 250.00  # dollars

df_daily["cumulative_cost"] = df_daily["daily_cost"].cumsum()
df_daily["budget_remaining"] = monthly_budget - df_daily["cumulative_cost"]

# Days until budget exhaustion at current burn rate
avg_daily_cost = df_daily["daily_cost"].mean()
days_in_month = 30
projected_monthly = avg_daily_cost * days_in_month

# Budget burn curve: plot cumulative_cost with a horizontal line at monthly_budget
# If the cumulative curve crosses the budget line before day 30, you overspend
```

The budget burn curve is the single most useful cost visualization. It shows cumulative
cost climbing day by day against a horizontal budget line. When the curve is on pace to
cross the line before the end of the month, you have a budget problem. When it flattens
below the line, you have room.

```python
# Budget burn curve data for plotting
import matplotlib
matplotlib.use("Agg")  # non-interactive backend
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(10, 5))
ax.plot(df_daily.index, df_daily["cumulative_cost"], label="Cumulative Cost")
ax.axhline(y=monthly_budget, color="r", linestyle="--", label="Monthly Budget")

# Projected line from current burn rate
projected_x = df_daily.index
projected_y = avg_daily_cost * np.arange(1, len(df_daily) + 1)
ax.plot(projected_x, projected_y, color="gray", linestyle=":", label="Linear Projection")

ax.set_xlabel("Date")
ax.set_ylabel("Cost (USD)")
ax.set_title("Budget Burn Curve")
ax.legend()
fig.tight_layout()
fig.savefig("budget_burn_curve.png", dpi=150)
plt.close(fig)
```

> **AGENTIC GROUNDING:** Agent systems do not have natural spending limits. A human
> developer stops making API calls when they go home. An automated pipeline runs until
> you stop it. A runaway retry loop can burn through a daily budget in minutes. The
> budget burn curve is your early warning system. If you plot it daily, you see problems
> days before they become crises.

> **HISTORY:** The "burn rate" concept comes from startup finance, where it measures
> how fast a company spends its cash reserves. The application to API budgets is direct:
> you have a fixed monthly allocation, and you need to know whether your current usage
> rate will exhaust it. The concept was formalized in venture capital in the 1990s, but
> the daily granularity possible with API billing data makes it far more actionable than
> quarterly cash flow statements.

---

## 4. Marginal Cost Analysis

*Estimated time: 30 minutes*

This section connects cost data to the project's **marginal analysis** framework
(see lexicon in AGENTS.md: "continue while marginal value > marginal cost; exit
condition for review loops").

### The Core Question

The darkcat alley pipeline runs 3 models. Each model has a cost. Each model finds
some unique bugs that no other model finds. The question: is the cost of the Nth
model justified by the unique findings it adds?

This is the textbook marginal analysis question: compare the additional cost of one
more unit (one more model) against the additional value that unit produces.

### Marginal Value From Triangulate

The `bin/triangulate` script computes marginal value in its `metrics.yaml` output.
The relevant section is `marginal_value.dispatch_order`:

```yaml
# From triangulate metrics.yaml (see Task 02 findings, section 6d)
marginal_value:
  dispatch_order:
    order: [R1, R2, R3]
    cumulative:
      - model: claude-sonnet
        review_id: R1
        cumulative_unique: 12
        new_unique: 12       # first model finds 12 unique findings
      - model: gpt-4o
        review_id: R2
        cumulative_unique: 17
        new_unique: 5        # second model adds 5 new findings
      - model: gemini-1.5-pro
        review_id: R3
        cumulative_unique: 19
        new_unique: 2        # third model adds 2 new findings
```

Marginal value decreases with each additional model. This is expected - it is
**diminishing marginal returns** (see lexicon). The first model has no overlap with
anything. The second model overlaps with the first on common findings and only adds
truly unique ones. The third model overlaps with both.

### Pairing Value With Cost

The analytical step: divide each model's cost by its unique contribution.

```python
# Marginal value data (from triangulate metrics.yaml)
marginal = pd.DataFrame({
  "model": ["claude-sonnet", "gpt-4o", "gemini-1.5-pro"],
  "review_id": ["R1", "R2", "R3"],
  "new_unique_findings": [12, 5, 2],
  "cost_usd": [0.0885, 0.1230, 0.0819],  # from section 2
})

marginal["cost_per_unique_finding"] = (
  marginal["cost_usd"] / marginal["new_unique_findings"]
)

# Output:
#   model              new_unique  cost_usd  cost_per_unique_finding
#   claude-sonnet      12          0.0885    $0.0074
#   gpt-4o             5           0.1230    $0.0246
#   gemini-1.5-pro     2           0.0819    $0.0410
```

The first model finds bugs at $0.007 each. The third model finds bugs at $0.041 each -
5.5x more expensive per unique finding. The value of the third model depends on how
much those 2 unique findings are worth. If they catch a critical security issue, $0.08
is trivially justified. If they are low-severity style nits, it may not be.

### Marginal Cost Across All Permutations

The dispatch order matters. Triangulate computes marginal value for all N!
permutations of model ordering (see `metrics.yaml` `all_permutations`). The cost
analysis should match:

```python
# All 6 permutations for 3 models (3! = 6)
from itertools import permutations

models = ["claude-sonnet", "gpt-4o", "gemini-1.5-pro"]
costs = {"claude-sonnet": 0.0885, "gpt-4o": 0.1230, "gemini-1.5-pro": 0.0819}

# For each permutation, compute cumulative cost at each position
for perm in permutations(models):
  cumulative = 0
  for i, model in enumerate(perm):
    cumulative += costs[model]
    # pair this with the marginal value at position i from triangulate
```

The decision rule from the lexicon: **continue while marginal value > marginal cost**.
When the cost per unique finding exceeds a threshold you define (say, $0.10 per
finding), adding another model is not worth it. The threshold depends on what you are
reviewing - security-critical code has a higher acceptable cost per finding than
cosmetic code cleanup.

### The Decision Table

Operationalize the marginal analysis as a table:

```python
# Decision: should we run the third model?
decision = pd.DataFrame({
  "metric": [
    "Third model cost",
    "Third model unique findings",
    "Cost per unique finding",
    "Cumulative cost (2 models)",
    "Cumulative cost (3 models)",
    "Marginal cost increase",
    "Marginal value increase",
  ],
  "value": [
    "$0.0819",
    "2",
    "$0.0410",
    "$0.2115",
    "$0.2934",
    "38.7%",
    "11.8% (2 of 17 cumulative findings)",
  ],
})

# The third model increases cost by 38.7% for an 11.8% increase in findings.
# Decision depends on context: 38.7% cost for 11.8% value is poor ROI
# UNLESS those 2 findings are high-severity.
```

> **AGENTIC GROUNDING:** The project already computes marginal value via triangulate.
> This step adds marginal cost. The combination is the operational decision tool.
> When the Operator asks "should we add a fourth model to darkcat alley?", the answer
> is not "more models = better." The answer is: "The fourth model costs $X and is
> projected to add Y unique findings based on the diminishing returns curve. The
> cost per unique finding would be $Z. At our current budget, this means exhausting
> the monthly allocation N days earlier." That is a decision, not a guess.

---

## 5. Cost Optimization Patterns

*Estimated time: 30 minutes*

Once you can measure cost, you can reduce it. Each pattern below includes a method
for estimating savings from actual usage data, not just theoretical benefits.

### Pattern 1: Prompt Caching

Many API calls in an agent system share a common prefix - the system prompt, the
coding conventions, the review rubric. Prompt caching stores this prefix so subsequent
calls pay a reduced rate for the cached portion.

**Estimating savings from usage data:**

```python
# Analyze token overlap in a batch of API calls for the same task type
calls = pd.DataFrame({
  "call_id": range(50),
  "system_prompt_tokens": [4500] * 50,  # same system prompt every time
  "user_tokens": np.random.randint(500, 8000, 50),  # varies per call
  "output_tokens": np.random.randint(200, 2000, 50),
})

# Without caching: all input tokens at full price
calls["cost_no_cache"] = calls.apply(
  lambda r: (r["system_prompt_tokens"] + r["user_tokens"]) * 3.00 / 1_000_000
            + r["output_tokens"] * 15.00 / 1_000_000,
  axis=1,
)

# With caching: system prompt at cached rate after first call
calls["cost_with_cache"] = calls.apply(
  lambda r: r["system_prompt_tokens"] * 0.30 / 1_000_000  # cached rate
            + r["user_tokens"] * 3.00 / 1_000_000
            + r["output_tokens"] * 15.00 / 1_000_000,
  axis=1,
)
# First call pays write cost
calls.loc[0, "cost_with_cache"] += 4500 * 3.75 / 1_000_000

savings_pct = (1 - calls["cost_with_cache"].sum() / calls["cost_no_cache"].sum()) * 100
# With 4500-token system prompt across 50 calls, savings are ~15-25%
# depending on the ratio of system prompt to user content
```

The key variable is the **cache hit ratio** - what fraction of your input tokens are
cacheable. If your system prompt is 4,500 tokens and your average user content is
3,000 tokens, about 60% of input is cacheable. Higher ratios yield larger savings.

### Pattern 2: Model Selection by Task Complexity

Not every task needs the most capable (and expensive) model. Route simple tasks
(JSON formatting, data extraction) to a cheaper model. Reserve the premium model
for complex reasoning or security-critical review.

```python
# Model routing: compare routed cost vs all-standard cost
MODEL_TIERS = {
  "simple":   {"input": 0.25 / 1_000_000, "output": 1.25 / 1_000_000},
  "standard": {"input": 3.00 / 1_000_000, "output": 15.00 / 1_000_000},
  "complex":  {"input": 15.00 / 1_000_000, "output": 75.00 / 1_000_000},
}

tasks = pd.DataFrame({
  "task": ["format_json", "extract_fields", "security_review", "code_review"],
  "tier": ["simple", "simple", "complex", "standard"],
  "input_tokens": [500, 800, 15000, 8000],
  "output_tokens": [200, 300, 4000, 3000],
})

tasks["cost_routed"] = tasks.apply(
  lambda r: r["input_tokens"] * MODEL_TIERS[r["tier"]]["input"]
            + r["output_tokens"] * MODEL_TIERS[r["tier"]]["output"],
  axis=1,
)
tasks["cost_all_standard"] = tasks.apply(
  lambda r: r["input_tokens"] * MODEL_TIERS["standard"]["input"]
            + r["output_tokens"] * MODEL_TIERS["standard"]["output"],
  axis=1,
)

savings = (1 - tasks["cost_routed"].sum() / tasks["cost_all_standard"].sum()) * 100
# Routing simple tasks to cheaper models saves 40-70% on those calls
```

### Pattern 3: Early Termination on Convergence

In a multi-model review, if the first two models agree on all findings, the third
model is unlikely to add value. Early termination skips it.

```python
# Estimate savings from early termination
# If models converge on 80% of runs, you skip the third review 80% of the time
runs = 100
convergence_rate = 0.80
third_model_cost = 0.0819  # from our earlier calculation

full_cost = runs * 0.2934     # all 3 models, every run
early_term_cost = (
  runs * 0.2115               # first 2 models, every run
  + runs * (1 - convergence_rate) * third_model_cost  # third model only when needed
)

savings = full_cost - early_term_cost
# At 80% convergence: ~$6.55 saved per 100 runs
# savings_pct = savings / full_cost * 100 ~ 22%
```

The trade-off is real: early termination means occasionally missing the unique findings
the third model would have caught. The marginal analysis from Section 4 quantifies
this trade-off.

### Pattern 4: Context Window Management

Agent conversations that accumulate context over many turns become expensive. Truncating
or summarizing older context reduces input token counts.

```python
# Estimate cost savings from context management
# A 20-turn conversation where each turn adds ~1000 tokens of context

turns = 20
tokens_per_turn = 1000
output_per_turn = 500

# Without management: each call includes all previous context
unmanaged_input = [turns * tokens_per_turn for t in range(turns)]
# Actually, it grows: turn 1 = 1000, turn 2 = 2000, ..., turn 20 = 20000
unmanaged_input = [(t + 1) * tokens_per_turn for t in range(turns)]
unmanaged_cost = sum(
  compute_call_cost("claude-sonnet", inp, output_per_turn)
  for inp in unmanaged_input
)

# With management: keep only last 5 turns + summary of earlier turns
summary_tokens = 500  # compressed summary of older context
managed_input = [
  min((t + 1) * tokens_per_turn, 5 * tokens_per_turn + summary_tokens)
  for t in range(turns)
]
managed_cost = sum(
  compute_call_cost("claude-sonnet", inp, output_per_turn)
  for inp in managed_input
)

savings_pct = (1 - managed_cost / unmanaged_cost) * 100
# Context management saves ~45% on a 20-turn conversation
```

> **AGENTIC GROUNDING:** Cost optimization in agent systems is not about finding the
> cheapest model. It is about matching cost to value at each decision point. A security
> review that misses a critical vulnerability because you used a cheap model is not a
> savings. A JSON formatting task that costs 60x more because you used a premium model
> is waste. The optimization patterns above are all measurable from your usage logs.
> If you are not logging token counts per call, you cannot measure. And if you cannot
> measure, you cannot optimize.

---

## 6. Budget Forecasting

*Estimated time: 30 minutes*

Budget forecasting uses historical cost data to predict future spending. The techniques
range from simple linear projection to scenario modeling.

### Linear Projection

The simplest forecast: if your average daily cost is $X, your monthly cost will be
approximately $X * 30.

```python
# Using our simulated daily cost data from Section 3
avg_daily = df_daily["daily_cost"].mean()
projected_monthly = avg_daily * 30

# More precise: use the last 7 days to capture recent trends
recent_avg = df_daily["daily_cost"].tail(7).mean()
projected_from_recent = recent_avg * 30

# If trend is significant, use the regression line
if p_value < 0.05:
  # Project the regression line to end of month
  days_remaining = 30 - len(df_daily)
  future_days = np.arange(len(df_daily), 30)
  projected_future_daily = slope * future_days + intercept
  projected_remaining = projected_future_daily.sum()
  projected_total = df_daily["daily_cost"].sum() + projected_remaining
```

### Budget Exhaustion Date

When will the budget run out at the current rate?

```python
def budget_exhaustion_date(daily_costs, monthly_budget, start_date):
  """Project when the budget will be exhausted."""
  cumulative = daily_costs.cumsum()
  avg_daily = daily_costs.mean()

  # Days already elapsed
  days_elapsed = len(daily_costs)
  spent = cumulative.iloc[-1]
  remaining = monthly_budget - spent

  if remaining <= 0:
    return "Budget already exhausted"

  # Days until exhaustion at current average rate
  days_to_exhaustion = remaining / avg_daily
  exhaustion_date = start_date + pd.Timedelta(days=days_elapsed + days_to_exhaustion)

  return exhaustion_date

exhaust = budget_exhaustion_date(
  df_daily["daily_cost"],
  monthly_budget=250.00,
  start_date=pd.Timestamp("2026-02-01"),
)
# "Budget exhausts on 2026-02-28" (or similar, depending on simulated data)
```

### Scenario Modeling

Scenario modeling answers "what if" questions. Build a simple function that takes
parameters and outputs projected costs.

```python
def project_monthly_cost(
  current_daily_cost,
  new_task_runs_per_day=0,
  new_task_cost_per_run=0.0,
  price_change_pct=0.0,
  model_count_change=0,
  cost_per_additional_model=0.0,
):
  """Project monthly cost under different scenarios."""
  # Adjust for price changes
  adjusted_daily = current_daily_cost * (1 + price_change_pct / 100)

  # Add new task costs
  new_task_daily = new_task_runs_per_day * new_task_cost_per_run

  # Add/remove model costs
  model_daily = model_count_change * cost_per_additional_model

  total_daily = adjusted_daily + new_task_daily + model_daily
  monthly = total_daily * 30

  return {
    "current_monthly": current_daily_cost * 30,
    "projected_monthly": monthly,
    "change_pct": (monthly / (current_daily_cost * 30) - 1) * 100,
    "daily_breakdown": {
      "base": adjusted_daily,
      "new_tasks": new_task_daily,
      "model_changes": model_daily,
    },
  }

# Scenario 1: Add a new agent task at 10 runs/day, $0.15/run
s1 = project_monthly_cost(
  current_daily_cost=avg_daily,
  new_task_runs_per_day=10,
  new_task_cost_per_run=0.15,
)
# Adds $1.50/day = $45/month

# Scenario 2: API prices drop 20% (as they tend to over time)
s2 = project_monthly_cost(
  current_daily_cost=avg_daily,
  price_change_pct=-20,
)
# Saves 20% = ~$48/month at current usage

# Scenario 3: Add a fourth model to darkcat alley (5 runs/day)
s3 = project_monthly_cost(
  current_daily_cost=avg_daily,
  new_task_runs_per_day=5,
  new_task_cost_per_run=0.10,
)
```

### Scenario Comparison Table

Present scenarios side by side for decision-making:

```python
scenarios = pd.DataFrame({
  "scenario": ["Baseline", "Add new task", "Price drop 20%", "Fourth model"],
  "monthly_cost": [
    avg_daily * 30,
    s1["projected_monthly"],
    s2["projected_monthly"],
    s3["projected_monthly"],
  ],
})

scenarios["vs_budget"] = scenarios["monthly_cost"] - monthly_budget
scenarios["within_budget"] = scenarios["monthly_cost"] <= monthly_budget

# This table is the artifact you bring to a budget discussion.
# Each row is a scenario. Each column is a metric.
# The "within_budget" column is the decision gate.
```

> **AGENTIC GROUNDING:** Budget forecasting for agent systems is not a quarterly
> exercise. API costs change when you change prompts, add tools, adjust retry
> logic, or update models. Each of these changes has a cost impact that compounds
> over a month. The scenario model above takes 10 minutes to build and answers
> "can we afford this change?" before you make it. The alternative - making the
> change and discovering the cost impact at the end of the month - is the agent
> engineering equivalent of deploying without tests.

> **HISTORY:** Scenario modeling in operations research dates to the RAND Corporation's
> work in the 1950s, where Herman Kahn developed the technique for military planning.
> The application to software cost modeling became common in the 1980s with Barry
> Boehm's COCOMO model for estimating software project costs. API-based cost modeling
> is simpler because the cost function is linear (tokens times price), not the
> exponential functions Boehm had to estimate for human programmer productivity.

---

## 7. Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: Compute Cost for a Simulated Month

**Estimated time: 20 minutes**

**Goal:** Given a month of simulated API usage data, compute total cost, cost per
model, cost per task type, and daily cost trend.

Generate 30 days of API cost data with three models and two task types:

```python
import pandas as pd
import numpy as np

np.random.seed(42)

days = pd.date_range("2026-02-01", periods=30, freq="D")
models = ["claude-sonnet", "gpt-4o", "gemini-1.5-pro"]
task_types = ["code_review", "summarize"]

records = []
for day in days:
  for task_type in task_types:
    n_runs = np.random.randint(3, 12)  # 3-12 runs per task type per day
    for _ in range(n_runs):
      model = np.random.choice(models)
      input_t = np.random.randint(2000, 20000)
      output_t = np.random.randint(500, 5000)
      records.append({
        "date": day,
        "task_type": task_type,
        "model": model,
        "input_tokens": input_t,
        "output_tokens": output_t,
      })

df = pd.DataFrame(records)
```

Compute:

1. Add a `cost_usd` column using the illustrative pricing from Section 1
2. Total cost for the month
3. Cost grouped by model (which model costs the most in total?)
4. Cost grouped by task type
5. Daily cost - resample to daily totals and compute the 7-day moving average
6. Plot the budget burn curve against a $250 monthly budget

**Verification:** Your burn curve should show whether the simulated month stays
within budget. The total monthly cost should be in the range of $150-$400 depending
on the random seed.

<details>
<summary>Hints</summary>

- Use the `PRICES` dict from Section 1 with `df["model"].map()` to get per-token rates
- For the burn curve: `df.groupby("date")["cost_usd"].sum().cumsum()`
- Use `matplotlib` or just print the daily cumulative values if you prefer text output

</details>

---

## Challenge: Marginal Cost Per Unique Finding

**Estimated time: 20 minutes**

**Goal:** Using simulated triangulate output, compute the cost-per-unique-finding for
each model and determine which model has the best and worst ROI.

Create the analysis from a simulated darkcat alley run:

```python
# Simulated triangulate marginal value output
# 3 models, 10 runs each
runs = []
for run_id in range(10):
  # Model 1 always finds 8-15 unique findings
  m1_unique = np.random.randint(8, 16)
  # Model 2 adds 3-7 unique findings
  m2_unique = np.random.randint(3, 8)
  # Model 3 adds 1-4 unique findings
  m3_unique = np.random.randint(1, 5)

  runs.append({
    "run_id": run_id,
    "r1_model": "claude-sonnet", "r1_new_unique": m1_unique, "r1_cost": 0.0885,
    "r2_model": "gpt-4o", "r2_new_unique": m2_unique, "r2_cost": 0.1230,
    "r3_model": "gemini-1.5-pro", "r3_new_unique": m3_unique, "r3_cost": 0.0819,
  })

runs_df = pd.DataFrame(runs)
```

Compute:

1. Average `cost_per_unique_finding` for each model position across all runs
2. The run where the third model had the worst ROI (highest cost per finding)
3. The run where the third model had the best ROI (lowest cost per finding)
4. A recommendation: given these 10 runs, should the third model be kept? Use the
   marginal analysis framework - state your threshold and justify it.

**Verification:** Model 1 should consistently have the lowest cost per finding.
Model 3 should have the highest. Your recommendation should reference the specific
numbers, not just "it depends."

---

## Challenge: Budget Forecast Notebook

**Estimated time: 25 minutes**

**Goal:** Build a budget forecasting function that takes current usage data and a
monthly budget, and outputs the projected exhaustion date, cost by category, and
a recommendation.

Write a function with this signature:

```python
def budget_forecast(
  daily_costs: pd.Series,    # indexed by date
  monthly_budget: float,
  cost_by_category: pd.DataFrame,  # columns: category, daily_avg_cost
) -> dict:
  """
  Returns:
    - projected_monthly_total
    - exhaustion_date (or "within budget")
    - top_cost_category
    - recommendation (string)
  """
  pass
```

Test it with:
- 15 days of cost data (you are mid-month)
- Monthly budget of $200
- Three categories: reviews ($5/day), agent_tasks ($3/day), experiments ($2/day)

**Verification:** The function should correctly project that $10/day over 30 days
= $300, which exceeds the $200 budget. The exhaustion date should be approximately
day 20. The recommendation should identify the top cost category and suggest a
concrete reduction.

<details>
<summary>Hints</summary>

- Use `daily_costs.mean()` for the projected daily rate
- Exhaustion date = budget / daily_rate (in days from start of month)
- The recommendation can be templated: "Reduce {category} by {amount} to stay within budget"

</details>

---

## Challenge: Cost Sensitivity Analysis

**Estimated time: 20 minutes**

**Goal:** Analyze how a 20% price reduction changes the optimal number of review
models in a darkcat alley pipeline.

Using the marginal analysis framework from Section 4:

1. Define a cost threshold for "worth running" - for example, $0.05 per unique
   finding
2. At current prices, which models pass the threshold? (Use the data from Section 4)
3. Apply a 20% price reduction to all models
4. Recompute cost per unique finding at the new prices
5. Do any models that previously failed the threshold now pass?
6. At what price reduction does a hypothetical fourth model (adding 1 unique
   finding at $0.10 per run) become worth running?

```python
# Starting data from Section 4
models = pd.DataFrame({
  "model": ["claude-sonnet", "gpt-4o", "gemini-1.5-pro", "hypothetical-4th"],
  "new_unique": [12, 5, 2, 1],
  "cost_current": [0.0885, 0.1230, 0.0819, 0.1000],
})

threshold = 0.05  # dollars per unique finding

# Your analysis here
```

**Verification:** At current prices, model 1 passes the threshold easily, model 2
is borderline, and model 3 fails. After a 20% reduction, model 3 may or may not
pass depending on exact threshold. The fourth model requires a much larger reduction
to be viable.

**Extension:** Plot cost_per_unique_finding as a function of price_reduction_pct
(0% to 50%) for all four models. Identify the crossover points where each model
becomes viable.

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What is the difference between input and output token pricing, and why does it exist?
2. Given a multi-step agent workflow, how do you compute the total cost per task?
3. How do you detect whether API costs are trending up or down over time?
4. What is the marginal cost per unique finding, and how do you compute it from
   triangulate output?
5. What four cost optimization patterns can be estimated from usage log data?
6. How do you project budget exhaustion date from daily cost data?
7. What is a budget burn curve, and what does it tell you that a monthly total does not?
8. When does the marginal analysis framework say to stop adding models to a multi-model
   review pipeline?

---

## Recommended Reading

- **Cloud FinOps** - J.R. Storment and Mike Fuller (O'Reilly, 2nd edition, 2023).
  Chapters 1-3 cover the FinOps framework for cloud cost management. The principles
  (teams need to own their costs, decisions are driven by business value) apply directly
  to API cost management at smaller scale.

- **Provider pricing pages** - The authoritative source for current prices. All numbers
  in this step are illustrative. Check:
  - Anthropic: `https://www.anthropic.com/pricing`
  - OpenAI: `https://openai.com/pricing`
  - Google: `https://ai.google.dev/pricing`

- **The project's `bin/triangulate` script** - Produces the marginal value metrics
  that pair with the marginal cost analysis in Section 4. Read the source to understand
  how `new_unique` findings are computed per model.

---

## What to Read Next

**Step 9: Anomaly Detection in Operational Data** - This step taught you to detect cost
trends and project budgets. Step 9 goes deeper into the anomaly detection techniques
introduced briefly in Step 5 and applies them to operational data including cost
spikes, token usage anomalies, and error rate changes. The budget burn curve from this
step becomes one of several monitoring surfaces where anomaly detection catches problems
before they become crises. The z-score and IQR methods from Step 5 get applied to the
cost time series you built here.

