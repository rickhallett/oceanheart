+++
title = "Time Series Basics"
date = "2026-03-10"
description = "Moving averages, trend detection, seasonality, anomaly detection, change points. Agent metrics over time."
tags = ["time-series", "analytics", "bootcamp"]
step = 5
tier = 2
estimate = "3-4 hours"
bootcamp = 3
+++

Step 5 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

Agent metrics are time series. Token usage per day. Error rate per hour. Cost per week. Finding count per review cycle. Every backlog item has a creation timestamp. The catch-log has dates. The events log has dates. The moment you ask "is this going up?" or "is that spike normal?" you are doing time series analysis.

Most introductions to time series start with ARIMA models, stationarity tests, and autocorrelation functions. That is the wrong starting point for operational analytics. You do not need to forecast next week's token usage. You need to answer three practical questions:

1. **Is this going up or down?** Linear regression on a time index gives you a slope and a p-value. Done.
2. **Is there a repeating pattern?** Resample to the suspected frequency and look. Decompose if you want to separate trend from pattern.
3. **Is this spike an anomaly?** Compare it to the rolling mean and standard deviation. If it is 3 standard deviations away, it is unusual.

These are time series questions with practical answers that do not require Fourier transforms or differencing. This step teaches the tools for answering them - in both pandas and DuckDB - using project data from `events.yaml` and `catch-log.tsv`.

The goal: turn append-only event logs into operational instruments that tell you when something changed, whether the change matters, and whether the new behavior is stable.

---

## Table of Contents

1. [Resampling and Frequency Conversion](#1-resampling-and-frequency-conversion) (~25 min)
2. [Moving Averages](#2-moving-averages) (~30 min)
3. [Trend Detection](#3-trend-detection) (~30 min)
4. [Seasonality](#4-seasonality) (~30 min)
5. [Anomaly Detection](#5-anomaly-detection) (~35 min)
6. [Change Point Detection](#6-change-point-detection) (~40 min)
7. [Challenges](#7-challenges) (~60-90 min)
8. [Key Takeaways](#key-takeaways)
9. [Recommended Reading](#recommended-reading)
10. [What to Read Next](#what-to-read-next)

---

## 1. Resampling and Frequency Conversion

*Estimated time: 25 minutes*

Raw event data arrives at whatever granularity the system produces - one row per event, one row per commit, one row per catch-log entry. The first step in any time series analysis is choosing a regular frequency and aggregating the raw data to match.

Resampling is frequency conversion. You take data at one granularity (individual events with timestamps) and convert it to another (daily counts, weekly sums, monthly averages). This is not a statistical technique. It is data preparation. But getting it wrong - choosing the wrong frequency, using the wrong aggregation, or failing to handle gaps - will make every downstream analysis incorrect.

### Resampling in pandas

The `resample()` method requires a `DatetimeIndex`. If your DataFrame has a date column but uses a default integer index, you must convert:

```python
import pandas as pd
import yaml

# Load events.yaml
with open("docs/internal/events.yaml") as f:
  raw = yaml.safe_load(f)

events = pd.DataFrame(raw["events"])
events["date"] = pd.to_datetime(events["date"])
events = events.set_index("date")
events = events.sort_index()  # resample requires sorted index
```

Once the index is a `DatetimeIndex`, resampling is a groupby on time:

```python
# Count events per day
daily_counts = events.resample("D")["type"].count()

# Count events per week (week ending Sunday by default)
weekly_counts = events.resample("W")["type"].count()
```

The `resample()` call returns a `Resampler` object, not data. You must chain an aggregation: `.count()`, `.sum()`, `.mean()`, `.agg()`. Without the aggregation, you get a Resampler that prints as an opaque object.

Common frequency aliases in pandas 2.x:

| Alias | Meaning |
|-------|---------|
| `"D"` | Calendar day |
| `"W"` | Week (ending Sunday) |
| `"ME"` | Month end |
| `"MS"` | Month start |
| `"h"` | Hour |

Note the 2.x changes: `"M"` became `"ME"`, `"H"` became `"h"`, `"Y"` became `"YE"`. Using the old aliases produces `FutureWarning` in 2.1 and `ValueError` in 2.2+.

### Resampling in DuckDB

DuckDB uses `DATE_TRUNC` for the same operation, combined with `GROUP BY`:

```python
import duckdb

result = duckdb.sql("""
  SELECT
    DATE_TRUNC('week', date::DATE) AS week,
    COUNT(*) AS event_count
  FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  GROUP BY 1
  ORDER BY 1
""").fetchdf()
```

`DATE_TRUNC('week', date)` truncates each date to the Monday of its week. This is the DuckDB equivalent of `resample("W")`, but anchored to Monday rather than Sunday. The distinction matters when comparing output between the two tools.

### Handling Gaps

Real event data has gaps. No events on a Saturday means no row for Saturday. This creates problems for rolling calculations and visualizations. Fill the gaps explicitly:

```python
# pandas: create a complete date range and reindex
full_range = pd.date_range(
  start=daily_counts.index.min(),
  end=daily_counts.index.max(),
  freq="D"
)
daily_counts = daily_counts.reindex(full_range, fill_value=0)
```

In DuckDB, generate the date range with `generate_series`:

```sql
WITH date_range AS (
  SELECT UNNEST(generate_series(
    DATE '2026-03-04',
    DATE '2026-03-10',
    INTERVAL 1 DAY
  )) AS date
),
raw_counts AS (
  SELECT date::DATE AS date, COUNT(*) AS n
  FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  GROUP BY 1
)
SELECT
  dr.date,
  COALESCE(rc.n, 0) AS event_count
FROM date_range dr
LEFT JOIN raw_counts rc ON dr.date = rc.date
ORDER BY dr.date
```

> **AGENTIC GROUNDING:** When an agent reports "event frequency is stable at 5 per day," check whether it accounted for zero-event days. If the agent computed `mean(daily_counts)` on a DataFrame that only contains rows where events occurred, every zero-count day is invisible. The mean is inflated. Reindexing with `fill_value=0` before computing statistics is a one-line fix that changes the answer.

---

## 2. Moving Averages

*Estimated time: 30 minutes*

A moving average smooths noisy data by averaging each point with its neighbors. This is the single most useful time series operation for operational analytics. It answers: "ignoring the day-to-day noise, what is the underlying level?"

There are two kinds that matter in practice: the Simple Moving Average (SMA) and the Exponentially Weighted Moving Average (EWMA).

### Simple Moving Average (SMA)

The SMA gives equal weight to every observation in the window. A 7-day SMA averages the current value with the previous 6 days:

```python
# pandas
df["sma_7"] = df["event_count"].rolling(7).mean()
```

The first 6 values of `sma_7` will be `NaN` because there are not enough prior observations to fill the window. If you want partial windows (compute the mean of whatever is available), set `min_periods=1`:

```python
df["sma_7"] = df["event_count"].rolling(7, min_periods=1).mean()
```

If you already worked through Step 3, this should look familiar. A rolling mean is a window function applied to time-ordered data. The difference from Step 3's SQL window functions is that pandas `rolling()` operates on rows (or time offsets), while SQL window functions operate on partitioned result sets.

An important distinction: `window=7` means 7 rows, not 7 calendar days. If your data has gaps (missing weekends), a 7-row window covers more than a week. Use a time-based offset for calendar-based windows:

```python
# Calendar-based: always covers exactly 7 days, regardless of gaps
df["sma_7d"] = df["event_count"].rolling("7D").mean()
```

The DuckDB equivalent uses a window function:

```sql
SELECT
  date,
  event_count,
  AVG(event_count) OVER (
    ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS sma_7
FROM daily_events
```

Note: `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` gives a 7-row window (6 + current = 7). This is the row-based equivalent. For calendar-based windows in DuckDB:

```sql
SELECT
  date,
  event_count,
  AVG(event_count) OVER (
    ORDER BY date
    RANGE BETWEEN INTERVAL 6 DAY PRECEDING AND CURRENT ROW
  ) AS sma_7d
FROM daily_events
```

### Exponentially Weighted Moving Average (EWMA)

The EWMA gives more weight to recent observations and exponentially decaying weight to older ones. It tracks recent changes more closely than the SMA:

```python
# pandas
df["ewma_7"] = df["event_count"].ewm(span=7).mean()
```

The `span` parameter controls how fast the weights decay. `span=7` means the center of mass is at 3 observations, and roughly 86% of the total weight falls within the last 7 periods. A higher span produces smoother output; a lower span tracks the raw data more closely.

You must specify exactly one of `com`, `span`, `halflife`, or `alpha`. They are mathematically related: `alpha = 2 / (span + 1)`. For instructional purposes, `span` is the most intuitive.

Unlike the SMA, the EWMA has no leading `NaN` values. It is defined from the first observation because the weighting scheme does not require a full window.

### SMA vs EWMA: When to Use Each

| Property | SMA | EWMA |
|----------|-----|------|
| Weights | Equal across window | Exponentially decaying |
| Lag | Higher (centered at middle of window) | Lower (weighted toward recent) |
| Leading NaN | Yes (window - 1 values) | No |
| Best for | Smoothing noise, stable baselines | Tracking regime shifts, recent trends |

Use the SMA when you want to remove noise and all recent observations are equally relevant. Use the EWMA when you want the smoothed line to respond faster to recent changes - for example, detecting that cost started climbing this week rather than last month.

> **AGENTIC GROUNDING:** An agent monitoring its own token usage might report a 7-day moving average to smooth out variance from task complexity. But if the agent uses SMA and a regime change happened 3 days ago (new prompt, different task distribution), the SMA will not fully reflect the change for another 4 days. The EWMA reacts faster. When reviewing agent self-reporting of smoothed metrics, ask which smoothing method was used and whether the lag is appropriate for the question being asked.

---

## 3. Trend Detection

*Estimated time: 30 minutes*

"Is this going up?" is the most common question in operational analytics. A visual inspection of a line chart often suffices (Step 6 covers visualization), but sometimes you need a number: the rate of change, and whether it is statistically significant.

The simplest quantitative trend detection is linear regression on a time index. You fit a line `y = slope * t + intercept` where `t` is time (as a numeric sequence) and `y` is the metric. The slope tells you the rate of change. The p-value tells you whether the slope is significantly different from zero.

### Linear Regression with scipy

```python
import numpy as np
from scipy.stats import linregress

# Prepare: x must be numeric, not datetime
x = np.arange(len(df))  # 0, 1, 2, ..., n-1
y = df["event_count"].values

result = linregress(x, y)
```

The `LinregressResult` has five useful fields:

| Field | Meaning |
|-------|---------|
| `result.slope` | Rate of change per time unit |
| `result.intercept` | Starting level (y when x=0) |
| `result.rvalue` | Pearson correlation coefficient |
| `result.pvalue` | P-value for H0: slope = 0 |
| `result.stderr` | Standard error of the slope |

Interpret the result:

```python
if result.pvalue < 0.05:
  direction = "increasing" if result.slope > 0 else "decreasing"
  r_squared = result.rvalue ** 2
  printf(f"Significant {direction} trend: "
         f"slope={result.slope:.4f}/day, "
         f"R^2={r_squared:.3f}, "
         f"p={result.pvalue:.4f}")
else:
  printf("No significant trend detected "
         f"(slope={result.slope:.4f}, p={result.pvalue:.4f})")
```

The `rvalue**2` (R-squared) tells you how much of the variance is explained by the linear trend. An R-squared of 0.7 means 70% of the variation in the metric is explained by the passage of time. The remaining 30% is noise, seasonality, or other factors.

### Practical Example: Catch-Log Firing Rate

Load the catch-log and compute a daily control firing count:

```python
import pandas as pd
from scipy.stats import linregress

catches = pd.read_csv(
  "docs/internal/weaver/catch-log.tsv", sep="\t", parse_dates=["date"]
)
daily = catches.groupby("date").size().reset_index(name="count")
daily = daily.sort_values("date")

x = np.arange(len(daily))
y = daily["count"].values

result = linregress(x, y)
printf(f"Slope: {result.slope:.3f} catches/day, p={result.pvalue:.4f}")
```

With only 2 distinct dates in the current catch-log (2026-03-04 and 2026-03-05), this will produce a line through 2 points - a perfect fit with no residual, which is not meaningful. This illustrates an important constraint: trend detection requires enough data points to distinguish signal from noise. With fewer than 10-15 observations, linear regression is unreliable. The p-value may look significant, but the confidence interval on the slope will be wide.

### Trend Detection in DuckDB

DuckDB does not have a built-in `LINREGRESS` function, but you can compute the slope manually using the regression formulas:

```sql
SELECT
  (COUNT(*) * SUM(x * y) - SUM(x) * SUM(y)) /
  (COUNT(*) * SUM(x * x) - SUM(x) * SUM(x)) AS slope,
  (SUM(y) - slope * SUM(x)) / COUNT(*) AS intercept
FROM (
  SELECT
    ROW_NUMBER() OVER (ORDER BY date) - 1 AS x,
    count AS y
  FROM daily_counts
)
```

This is the closed-form formula for simple linear regression. It computes the same slope as `linregress()` but does not give you a p-value. For operational work, use DuckDB for the data preparation (resampling, gap filling, window functions) and scipy for the statistical test.

> **HISTORY:** Linear regression was invented by Francis Galton in the 1880s while studying the heights of parents and children. He noticed that tall parents tended to have shorter children (and vice versa) - a phenomenon he called "regression towards mediocrity." The name stuck, even though modern regression has nothing to do with mediocrity. The technique became the foundation of statistical modeling because it decomposes observed data into a systematic component (the line) and a random component (the residual) - the same decomposition you use in trend detection.

> **AGENTIC GROUNDING:** When an agent reports "token usage increased by 15% this week," ask for the baseline. A 15% increase from a noisy baseline with no significant trend is meaningless. A 15% increase with a slope p-value of 0.002 is a real signal. The p-value from `linregress()` is the tool that separates "it went up this particular week" from "it is consistently going up."

---

## 4. Seasonality

*Estimated time: 30 minutes*

Seasonality is a repeating pattern at a known frequency. Agent systems often show weekly patterns: more activity on weekdays, less on weekends. Cost data shows monthly billing cycles. CI/CD systems show deploy-day spikes.

The question is not "does this data have seasonality?" (visual inspection answers that). The question is: "after removing the seasonal pattern, what is the real trend?" Seasonal decomposition separates the observed time series into three components:

- **Trend** - the long-term direction (up, down, flat)
- **Seasonal** - the repeating pattern (weekday/weekend cycle, monthly cycle)
- **Residual** - everything left over (noise, anomalies, one-off events)

### Decomposition with statsmodels

```python
from statsmodels.tsa.seasonal import seasonal_decompose

# Prepare: need a Series with DatetimeIndex
daily_counts = catches.groupby("date").size()
daily_counts.index = pd.to_datetime(daily_counts.index)
daily_counts = daily_counts.sort_index()

# Fill gaps - decomposition requires no missing values
full_range = pd.date_range(
  start=daily_counts.index.min(),
  end=daily_counts.index.max(),
  freq="D"
)
daily_counts = daily_counts.reindex(full_range, fill_value=0)

result = seasonal_decompose(
  daily_counts,
  model="additive",
  period=7,
  extrapolate_trend="freq"
)
```

The three critical parameters:

1. **`model`** - `"additive"` or `"multiplicative"`. Use additive when the seasonal variation is roughly constant regardless of the trend level (the weekday/weekend difference is always about 3 events). Use multiplicative when the seasonal variation scales with the trend (the weekday/weekend difference is always about 20% of the current level). When in doubt, start with additive.

2. **`period`** - the number of observations in one complete seasonal cycle. For daily data with weekly seasonality: `period=7`. For hourly data with daily patterns: `period=24`. For monthly data with yearly patterns: `period=12`. Getting this wrong produces nonsensical decomposition.

3. **`extrapolate_trend="freq"`** - by default, the trend component has `NaN` at the edges because the centered moving average cannot be computed at the boundaries. This parameter fills those NaN values by extrapolation.

### Accessing the Components

The result has four attributes, each a pandas Series:

```python
trend = result.trend       # the smoothed long-term direction
seasonal = result.seasonal # one cycle repeated across the full series
residual = result.resid    # what is left after removing trend + seasonal
observed = result.observed # the original data
```

For additive decomposition: `observed = trend + seasonal + residual`. You can verify this:

```python
reconstructed = result.trend + result.seasonal + result.resid
assert (reconstructed - result.observed).abs().max() < 1e-10
```

### Visualizing the Decomposition

The result object has a built-in plot method:

```python
fig = result.plot()
fig.set_size_inches(12, 8)
fig.tight_layout()
fig.savefig("decomposition.png", dpi=150)
```

This produces a 4-panel figure: observed, trend, seasonal, residual. The trend panel answers "is the underlying level changing?" The seasonal panel answers "what does the repeating pattern look like?" The residual panel answers "which data points are not explained by trend or seasonality?"

### Seasonality in DuckDB

DuckDB does not have a built-in decomposition function, but you can compute the seasonal averages manually:

```sql
WITH daily AS (
  SELECT
    date::DATE AS date,
    COUNT(*) AS event_count,
    EXTRACT(dow FROM date::DATE) AS day_of_week
  FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  GROUP BY 1
)
SELECT
  day_of_week,
  AVG(event_count) AS avg_events,
  COUNT(*) AS n_weeks
FROM daily
GROUP BY day_of_week
ORDER BY day_of_week
```

This tells you the average event count per day of the week - a simple seasonal profile. For the full trend-seasonal-residual decomposition, use Python.

> **AGENTIC GROUNDING:** Seasonal decomposition is particularly useful for evaluating agent process changes. If you changed the darkcat review instructions on a Wednesday and catch rates went up on Thursday, did the instructions work, or is Thursday always a high-catch day? Decompose the time series, then look at the residual. If Thursday's residual is unusually high (not just its seasonal component), the change had an effect beyond the normal weekly pattern.

---

## 5. Anomaly Detection

*Estimated time: 35 minutes*

An anomaly is a data point that deviates significantly from the expected pattern. In operational analytics, anomalies answer: "is this spike a problem?" Token usage doubled today. Cost tripled this week. The catch rate dropped to zero. Are these anomalies that warrant investigation, or normal variation?

Two methods cover the vast majority of practical cases: the z-score method and the IQR method. Both build directly on descriptive statistics from Step 2. Neither requires machine learning.

### Z-Score Method

The z-score measures how many standard deviations a value is from the mean. For time series, use a rolling mean and rolling standard deviation instead of the global mean and std:

```python
# Compute rolling statistics
window = 7
df["rolling_mean"] = df["event_count"].rolling(window, min_periods=1).mean()
df["rolling_std"] = df["event_count"].rolling(window, min_periods=1).std()

# Compute z-score
df["z_score"] = (df["event_count"] - df["rolling_mean"]) / df["rolling_std"]

# Flag anomalies: |z| > 2 is unusual, |z| > 3 is extreme
df["is_anomaly"] = df["z_score"].abs() > 2
```

Why rolling statistics instead of global? Because the mean and standard deviation of a time series change over time. If token usage trends upward, a value that was anomalously high in January might be normal in March. The rolling window adapts the baseline.

The threshold is a design choice:

| Threshold | Meaning | False positive rate (normal data) |
|-----------|---------|-----------------------------------|
| |z| > 2 | Unusual | ~5% |
| |z| > 2.5 | Quite unusual | ~1.2% |
| |z| > 3 | Extreme | ~0.3% |

Choose based on the cost of false positives vs missed anomalies. For cost monitoring, |z| > 2 is aggressive but catches problems early. For error alerting, |z| > 3 reduces noise.

### Z-Score Method in DuckDB

```sql
WITH stats AS (
  SELECT
    date,
    event_count,
    AVG(event_count) OVER (
      ORDER BY date
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_mean,
    STDDEV_SAMP(event_count) OVER (
      ORDER BY date
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_std
  FROM daily_events
)
SELECT
  date,
  event_count,
  rolling_mean,
  rolling_std,
  (event_count - rolling_mean) / NULLIF(rolling_std, 0) AS z_score,
  ABS((event_count - rolling_mean) / NULLIF(rolling_std, 0)) > 2 AS is_anomaly
FROM stats
```

Note the `NULLIF(rolling_std, 0)` guard. If all values in the window are identical, the standard deviation is zero, and division by zero produces an error (DuckDB) or infinity (pandas). Guarding against zero std is essential.

### IQR Method

The Interquartile Range (IQR) method is more robust to outliers than the z-score method. It does not assume the data is normally distributed:

```python
# Compute rolling IQR
q1 = df["event_count"].rolling(window, min_periods=1).quantile(0.25)
q3 = df["event_count"].rolling(window, min_periods=1).quantile(0.75)
iqr = q3 - q1

# Define fences
lower_fence = q1 - 1.5 * iqr
upper_fence = q3 + 1.5 * iqr

# Flag anomalies
df["iqr_anomaly"] = (
  (df["event_count"] < lower_fence) |
  (df["event_count"] > upper_fence)
)
```

The 1.5 multiplier is the standard Tukey fence. For more aggressive detection, use 1.0. For fewer false positives, use 2.0 or 3.0 (which matches the "extreme outlier" convention).

### Z-Score vs IQR: When to Use Each

| Property | Z-Score | IQR |
|----------|---------|-----|
| Assumption | Approximately normal | None |
| Sensitivity to outliers | High (outliers inflate std) | Low (quartiles resist outliers) |
| Best for | Roughly symmetric data | Skewed data, heavy tails |
| Simplicity | Simpler formula | Slightly more computation |

For most operational metrics (token counts, error rates, latencies), the IQR method is safer because these distributions tend to be right-skewed with occasional spikes. The z-score method is easier to explain and compute.

### Practical Example: Catch-Log Anomaly Detection

```python
import pandas as pd

catches = pd.read_csv(
  "docs/internal/weaver/catch-log.tsv", sep="\t", parse_dates=["date"]
)
daily = catches.groupby("date").size().reset_index(name="count")
daily = daily.sort_values("date")

# With only 2 dates, rolling statistics are not meaningful.
# This illustrates the minimum data requirement.
# In practice, you need at least 2-3x the window size in data points.
printf(f"Data points: {len(daily)}")
printf(f"Minimum for 7-day rolling: ~14-21 days")
```

> **AGENTIC GROUNDING:** When an agent system flags its own anomalies - "unusual token usage detected" - verify the detection method. A common failure mode is computing z-scores against a global mean rather than a rolling mean. If usage has been trending up for weeks, today's "anomalous" value might just be the continuation of a trend, not a spike. Rolling baselines prevent this conflation. A second failure mode: the agent uses a 1-day window for the rolling std, which makes every day that differs from yesterday an "anomaly."

---

## 6. Change Point Detection

*Estimated time: 40 minutes*

Anomaly detection finds individual data points that deviate from the expected pattern. Change point detection finds the moment when the pattern itself changed. These are different questions:

- Anomaly: "Tuesday's token usage was unusually high."
- Change point: "Starting around March 5th, the average token usage shifted from 50k to 80k per day."

The first is a spike. The second is a regime change. For operational analytics, change points answer questions like: "Did the prompt update actually change the error rate?" "When did the new model's behavior stabilize?" "Did the darkcat alley process improve the catch rate?"

### The CUSUM Algorithm

CUSUM (Cumulative Sum) is the simplest and most widely used change point detection method. The idea: compute the cumulative sum of deviations from the mean. When the cumulative sum trends sharply away from zero, something changed.

Here is the intuition. If your data fluctuates around a stable mean, the deviations (value - mean) will be roughly balanced: some positive, some negative, and their cumulative sum will stay near zero. If the mean shifts upward at some point, the deviations after that point will be consistently positive, and the cumulative sum will start climbing. The change point is where the cumulative sum begins its climb.

### CUSUM Implementation

The complete algorithm in Python:

```python
import numpy as np

def cusum(data, threshold=None):
  """Detect change points using the CUSUM algorithm.

  Args:
    data: 1D array of numeric values
    threshold: detection threshold (default: 2 * std of data)

  Returns:
    List of indices where change points were detected
  """
  data = np.asarray(data, dtype=float)
  mean = data.mean()
  std = data.std(ddof=1)
  if threshold is None:
    threshold = 2 * std

  cumsum = np.cumsum(data - mean)

  # Find where the cumulative sum deviates beyond the threshold
  change_points = []
  for i in range(1, len(cumsum)):
    if abs(cumsum[i] - cumsum[i - 1]) > threshold:
      change_points.append(i)

  return cumsum, change_points
```

This is a simplified version. The core operation is one line: `cumsum = np.cumsum(data - mean)`. Everything else is bookkeeping.

Let's trace through an example to make it concrete. Suppose you have 10 days of event counts:

```python
import numpy as np

# Days 1-5: baseline (~4 events/day)
# Days 6-10: elevated (~8 events/day)
data = np.array([3, 5, 4, 4, 3, 8, 9, 7, 8, 9])

mean = data.mean()  # 6.0
deviations = data - mean
# [-3, -1, -2, -2, -3, 2, 3, 1, 2, 3]

cumsum = np.cumsum(deviations)
# [-3, -4, -6, -8, -11, -9, -6, -5, -3, 0]
```

The cumulative sum drops steadily for the first 5 days (values below the mean) and climbs back for the last 5 days (values above the mean). The minimum of the cumulative sum at index 4 (day 5) marks the change point - the moment when the data shifted from below-mean to above-mean behavior.

A more robust approach uses the maximum deviation of the CUSUM from its running minimum (or maximum) to detect the actual point of change:

```python
def cusum_detect(data, drift=0):
  """CUSUM change point detection with directional tracking.

  Args:
    data: 1D array of numeric values
    drift: allowable drift before signaling (default: 0)

  Returns:
    cumsum: the raw cumulative sum of deviations
    change_idx: index of the most likely change point
  """
  data = np.asarray(data, dtype=float)
  mean = data.mean()
  cumsum = np.cumsum(data - mean - drift)

  # The change point is at the extremum of the cumulative sum
  min_idx = np.argmin(cumsum)
  max_idx = np.argmax(cumsum)

  # The extremum with the largest absolute value indicates
  # the direction and location of the change
  if abs(cumsum[min_idx]) > abs(cumsum[max_idx]):
    change_idx = min_idx
  else:
    change_idx = max_idx

  return cumsum, change_idx
```

### Applying CUSUM to Project Data

Consider this scenario: the control firing rate changed after updating the darkcat review instructions. We have the catch-log with dates. Did the firing rate actually change?

```python
import pandas as pd
import numpy as np

catches = pd.read_csv(
  "docs/internal/weaver/catch-log.tsv", sep="\t", parse_dates=["date"]
)

# Compute daily firing counts
daily = catches.groupby("date").size().reset_index(name="count")
daily = daily.sort_values("date")

# Simulate extended data to illustrate CUSUM
# (The actual catch-log has only 2 dates)
np.random.seed(42)
baseline = np.random.poisson(lam=3, size=14)    # 2 weeks at ~3/day
elevated = np.random.poisson(lam=6, size=14)    # 2 weeks at ~6/day
simulated = np.concatenate([baseline, elevated])

dates = pd.date_range("2026-02-20", periods=28, freq="D")
sim_df = pd.DataFrame({"date": dates, "count": simulated})

# Apply CUSUM
cumsum, change_idx = cusum_detect(sim_df["count"].values)
printf(f"Detected change point at index {change_idx}: "
       f"{sim_df['date'].iloc[change_idx].strftime('%Y-%m-%d')}")
```

### Interpreting CUSUM Results

The CUSUM curve itself is informative:

- **Flat cumulative sum** - no change, data fluctuates around a stable mean
- **Steadily rising** - values are consistently above the mean
- **Steadily falling** - values are consistently below the mean
- **V-shape or inverted V** - a change point exists at the vertex

The sharpness of the V indicates how sudden the change was. A gradual transition produces a smooth curve; an abrupt shift produces a sharp corner.

### Limitations

CUSUM assumes a single change point. If there are multiple regime changes, the algorithm finds the dominant one. For multiple change points, you can apply CUSUM recursively to each segment, or use more sophisticated methods (the `ruptures` Python package, for example). For operational analytics, the single-change-point assumption is usually sufficient because you are typically testing a specific hypothesis: "Did this deployment change the metric?"

CUSUM also uses the global mean as the reference level. If the data has a strong upward trend, CUSUM may flag the trend itself as a "change" rather than finding a specific shift. Detrend the data first (subtract the linear regression line from Section 3) if you need to detect change points in trended data.

> **HISTORY:** CUSUM was developed by E.S. Page in 1954 for industrial quality control - detecting when a manufacturing process shifted out of specification. It was designed for exactly the scenario we face in agent operations: continuous monitoring of a metric with the question "has the process changed?" The algorithm has been used in fields from epidemiology (detecting disease outbreaks) to finance (regime detection) to network security (intrusion detection). Its simplicity - a running sum of deviations - is its strength. It requires no distributional assumptions beyond a stable mean.

> **AGENTIC GROUNDING:** CUSUM answers the operationally critical question: "When did the change take effect?" If you updated an agent's system prompt on March 5th, but CUSUM detects the change point on March 7th, there is a 2-day lag. This might mean the change took time to propagate, or that the first few interactions under the new prompt happened to look like the old regime. Either way, the deployment timestamp is not the same as the effect timestamp. CUSUM finds the latter.

---

## 7. Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: Resample and Smooth Event Data

**Estimated time: 15 minutes**

**Goal:** Load the events.yaml file, compute daily event counts, apply a moving average, and determine if the smoothing changes your interpretation.

1. Load `docs/internal/events.yaml` into a pandas DataFrame with a `DatetimeIndex`.
2. Resample to daily counts. Fill zero-event days with 0.
3. Compute a 3-day simple moving average (the dataset is small, so use a small window).
4. Compute a 3-day EWMA.
5. Print all three columns (raw count, SMA, EWMA) side by side.

```python
import pandas as pd
import yaml

with open("docs/internal/events.yaml") as f:
  raw = yaml.safe_load(f)

events = pd.DataFrame(raw["events"])
events["date"] = pd.to_datetime(events["date"])
# Your code here
```

**Verification:** The raw daily counts should be: 2026-03-04 has 4 events, 2026-03-05 has 2 events (check against the file). The SMA and EWMA should differ because the EWMA weights recent values more heavily.

**Extension:** Repeat the exercise in DuckDB. Load the events into a DuckDB table via a pandas DataFrame, compute the daily counts with `DATE_TRUNC`, and compute the SMA with a window function.

---

## Challenge: Detect a Trend in Simulated Data

**Estimated time: 20 minutes**

**Goal:** Generate time series data with a known trend, add noise, and use `linregress()` to recover the trend.

1. Generate 60 days of data with a known slope of 0.5 per day and normally distributed noise:

```python
import numpy as np
from scipy.stats import linregress

np.random.seed(42)
n_days = 60
true_slope = 0.5
noise = np.random.normal(0, 3, n_days)
y = true_slope * np.arange(n_days) + 10 + noise
```

2. Run `linregress(np.arange(n_days), y)` and print the estimated slope, p-value, and R-squared.
3. How close is the estimated slope to the true slope of 0.5?
4. Increase the noise level from 3 to 10. Repeat. Does the slope estimate change? Does the p-value change?

**Verification:** With noise=3 and seed=42, the estimated slope should be close to 0.5 (within about 0.1) and the p-value should be well below 0.05. With noise=10, the slope estimate should be similar but the p-value will be higher and the R-squared lower.

**What you are learning:** Noise does not bias the slope estimate (on average), but it does reduce your ability to detect the trend (higher p-value, lower R-squared). This is why smoothing and longer time windows improve trend detection.

---

## Challenge: Anomaly Detection with Both Methods

**Estimated time: 20 minutes**

**Goal:** Apply both z-score and IQR anomaly detection to the same dataset and compare the results.

1. Generate 90 days of Poisson-distributed event counts with two injected anomalies:

```python
import numpy as np
import pandas as pd

np.random.seed(42)
counts = np.random.poisson(lam=5, size=90)
counts[30] = 25  # inject anomaly at day 30
counts[60] = 0   # inject anomaly at day 60 (unusual low)

dates = pd.date_range("2026-01-01", periods=90, freq="D")
df = pd.DataFrame({"date": dates, "count": counts})
df = df.set_index("date")
```

2. Apply the z-score method with a 7-day rolling window and threshold |z| > 2.
3. Apply the IQR method with a 7-day rolling window and 1.5x fences.
4. How many anomalies does each method detect? Do both methods catch the injected anomalies at days 30 and 60?

**Verification:** Both methods should catch day 30 (the spike to 25 is far from the baseline of ~5). Day 60 (a drop to 0) may or may not be flagged depending on the rolling window context. Compare the total number of flagged days between the two methods.

<details>
<summary>Hints</summary>

For the z-score method:
```python
rolling_mean = df["count"].rolling(7, min_periods=1).mean()
rolling_std = df["count"].rolling(7, min_periods=1).std()
z = (df["count"] - rolling_mean) / rolling_std
anomalies_z = df[z.abs() > 2]
```

For the IQR method:
```python
q1 = df["count"].rolling(7, min_periods=1).quantile(0.25)
q3 = df["count"].rolling(7, min_periods=1).quantile(0.75)
iqr = q3 - q1
lower = q1 - 1.5 * iqr
upper = q3 + 1.5 * iqr
anomalies_iqr = df[(df["count"] < lower) | (df["count"] > upper)]
```

</details>

---

## Challenge: CUSUM Change Point Detection

**Estimated time: 20 minutes**

**Goal:** Generate data with a known change point, apply the CUSUM algorithm, and verify it finds the correct location.

1. Generate 56 days of data: 28 days with a mean of 4, then 28 days with a mean of 8:

```python
import numpy as np

np.random.seed(42)
before = np.random.poisson(lam=4, size=28)
after = np.random.poisson(lam=8, size=28)
data = np.concatenate([before, after])
# The true change point is at index 28
```

2. Implement the `cusum_detect` function from Section 6 (or copy it).
3. Run it on `data` and print the detected change point index.
4. How close is the detected index to the true change point at 28?

**Verification:** The detected change point should be within a few indices of 28. Plot the cumulative sum if you have completed Step 6 - it should show a clear V-shape with the vertex near index 28.

**Extension:** Try different mean values for the "after" period. How large must the shift be (relative to the Poisson variance) for CUSUM to reliably detect it? Try shifts of +1, +2, +4, +8 from the baseline mean of 4. At what shift size does the detected change point consistently land within 3 indices of the true location?

> **AGENTIC GROUNDING:** In practice, you rarely know the true change point. You know when you deployed a change, and you want to know when the effect became visible in the data. Running CUSUM on your metrics with the deployment date as a reference lets you measure the deployment-to-effect lag. If the lag is longer than expected, the change may not have propagated correctly, or confounding factors may be masking the effect.

---

## Key Takeaways

Before moving to Step 6, verify you can answer these questions without looking anything up:

1. What does `df.resample("W").sum()` require of the DataFrame's index? What happens if the index is not a DatetimeIndex?
2. What is the DuckDB equivalent of pandas `resample("W")`?
3. What is the difference between `rolling(7)` (integer window) and `rolling("7D")` (offset window) when data has gaps?
4. When would you choose EWMA over SMA? What does the `span` parameter control?
5. What does `linregress()` require as the `x` argument? Can you pass datetime objects?
6. What does a low p-value from `linregress()` tell you? What does R-squared tell you?
7. In `seasonal_decompose()`, what happens if you set `period` incorrectly?
8. Why use rolling mean/std instead of global mean/std for z-score anomaly detection on a time series?
9. What is the IQR method's advantage over the z-score method for skewed data?
10. What does the CUSUM algorithm compute, and how do you interpret its output?

---

## Recommended Reading

- **Practical Time Series Analysis** - Aileen Nielsen (O'Reilly, 2019). Chapters 1-4 cover the foundations without diving into ARIMA. The gap between "descriptive statistics" and "time series modeling" is where this book lives.

- **pandas documentation: Time Series / Date functionality** - The official documentation for `resample()`, `rolling()`, and `ewm()` is the authoritative reference for parameter behavior and edge cases. Pay attention to the 2.x frequency alias changes.

- **Page, E.S. (1954). "Continuous Inspection Schemes"** - Biometrika, 41(1/2), 100-115. The original CUSUM paper. Short, readable, and directly applicable. Available through most academic libraries.

- **`scipy.stats.linregress` documentation** - Reference for return value fields and interpretation. The `intercept_stderr` field was added in scipy 1.6.

---

## What to Read Next

**Step 6: Visualization for Decision-Making** - A trend line is a number. A chart of that trend line is a story. Step 6 covers matplotlib's object-oriented API for producing functional plots: line charts for trends over time, scatter plots for correlations, histograms for distributions, and multi-panel layouts for decompositions. Every technique in this step - moving averages, trend lines, seasonal decomposition panels, CUSUM curves, anomaly flags overlaid on raw data - becomes more useful when you can see it. Step 6 turns the numbers from Steps 2-5 into visual instruments for operational decision-making.

