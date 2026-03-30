+++
title = "SQL Analytics with DuckDB"
date = "2026-03-10"
description = "CTEs, window functions, self-joins, pivoting, date/time operations. Analytical SQL for agent data."
tags = ["sql", "duckdb", "analytics", "bootcamp"]
step = 3
tier = 1
estimate = "4-5 hours"
bootcamp = 3
+++

Step 3 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

Most software engineers know enough SQL for CRUD: SELECT, INSERT, UPDATE, DELETE with WHERE
clauses and maybe a GROUP BY. This is ORM-level SQL. It retrieves data. Analytical SQL is
a different discipline. It transforms data into answers.

The gap shows up immediately in agentic engineering. The Operator asks: "Which control
catches the most issues, and is that changing week over week?" A CRUD query gives you a
count. An analytical query gives you a count per week, a ranking within each week, and the
delta from the previous week - all in a single result set, using window functions and CTEs.

This project's data lives in files: `docs/internal/weaver/catch-log.tsv` (tab-separated
control firing events), `docs/internal/events.yaml` (the event spine), `docs/internal/
backlog.yaml` (task tracking), `docs/internal/slopodar.yaml` (anti-pattern taxonomy).
DuckDB reads TSV and CSV directly from the filesystem with no server, no config, no
database setup. It is SQLite for analytics - embedded, zero-dependency, and fast enough
for millions of rows on a laptop.

The goal: move from "I can query data" to "I can answer questions about data" using
CTEs for composition, window functions for row-relative computation, self-joins for
comparison, and date operations for temporal analysis.

---

## Table of Contents

1. [DuckDB Setup and Data Loading](#1-duckdb-setup-and-data-loading) (~20 min)
2. [CTEs - Composable Query Pipelines](#2-ctes---composable-query-pipelines) (~30 min)
3. [Window Functions](#3-window-functions) (~90 min)
4. [Self-Joins](#4-self-joins) (~25 min)
5. [Pivoting and Unpivoting](#5-pivoting-and-unpivoting) (~25 min)
6. [Date and Time Operations](#6-date-and-time-operations) (~25 min)
7. [Analytical Patterns](#7-analytical-patterns) (~30 min)
8. [Challenges](#challenges) (~60-90 min)
9. [Key Takeaways](#key-takeaways)
10. [Recommended Reading](#recommended-reading)
11. [What to Read Next](#what-to-read-next)

---

## 1. DuckDB Setup and Data Loading

*Estimated time: 20 minutes*

DuckDB's defining feature for analytical work is zero-config file queries. There is no
server to start, no connection string to configure, no schema to define up front. Point
it at a file, and it reads it.

### Installation

```bash
uv pip install duckdb
```

Verify:

```python
import duckdb
printf '%s\n' "$(python3 -c 'import duckdb; print(duckdb.__version__)')"
```

### Direct File Queries

DuckDB reads CSV and TSV files directly in FROM clauses:

```python
import duckdb

# Query a TSV file - no loading step, no schema definition
result = duckdb.sql("""
  SELECT *
  FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  LIMIT 5
""").df()

print(result)
```

The `read_csv_auto()` function auto-detects column types, header rows, and delimiters.
For TSV files, pass `delim='\t'` explicitly - auto-detection sometimes guesses wrong
on tab-delimited files with few columns.

The `.df()` method converts the result to a pandas DataFrame. It is an alias for
`.fetchdf()`. Use whichever you prefer; `.df()` is shorter.

### YAML Requires a Python Intermediary

DuckDB has no native YAML reader. Load YAML into a pandas DataFrame first, then
DuckDB can query it directly by referencing the Python variable name:

```python
import yaml
import pandas as pd
import duckdb

# Load YAML into pandas
with open("docs/internal/events.yaml") as f:
  events_raw = yaml.safe_load(f)

events = pd.DataFrame(events_raw["events"])

# DuckDB sees the pandas variable as a virtual table
result = duckdb.sql("""
  SELECT type, agent, COUNT(*) as n
  FROM events
  GROUP BY type, agent
  ORDER BY n DESC
""").df()

print(result)
```

DuckDB automatically detects Python variables that are pandas DataFrames and makes them
queryable as tables. The variable name becomes the table name in SQL.

### The Python Wrapper Pattern

Every SQL example in this step is runnable through this pattern:

```python
import duckdb

result = duckdb.sql("""
  YOUR SQL HERE
""").df()
```

For multi-step analysis, assign intermediate results to DataFrames and reference them
by variable name in subsequent queries. DuckDB sees pandas DataFrames in the local
Python scope as virtual tables.

### Pandas Comparison

In pandas, loading and querying the same TSV looks like:

```python
import pandas as pd

catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")
result = catches.groupby(["control"])["outcome"].count().sort_values(ascending=False)
```

For simple loads and single-table operations, pandas is equally direct. DuckDB's advantage
appears when you need joins across files, window functions, or complex aggregations - the
topics in the rest of this step.

> **AGENTIC GROUNDING:** When agent systems produce data in multiple formats - YAML
> metrics, TSV logs, JSON API responses - DuckDB's ability to query files directly and
> join across Python DataFrames means you do not need an ETL pipeline. Load each source
> in one line, then write SQL that joins them. The `bin/triangulate` script exports YAML;
> a DuckDB query over a directory of those exports is how you do cross-run analysis.

---

## 2. CTEs - Composable Query Pipelines

*Estimated time: 30 minutes*

A Common Table Expression (CTE) is a named subquery defined with the `WITH` keyword.
CTEs turn complex queries into readable pipelines where each stage has a name and a
clear purpose.

### Why CTEs Over Nested Subqueries

Consider this question: "For each control in the catch log, show the total catches and
the percentage of total." Without CTEs:

```sql
SELECT
  control,
  COUNT(*) as catches,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')), 1) as pct
FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
GROUP BY control
ORDER BY catches DESC
```

The subquery in the SELECT list is repeated inline, hard to read, and would need to be
duplicated if referenced again. With a CTE:

```sql
WITH
  catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  ),
  summary AS (
    SELECT
      control,
      COUNT(*) as catches,
      (SELECT COUNT(*) FROM catches) as total
    FROM catches
    GROUP BY control
  )
SELECT
  control,
  catches,
  ROUND(catches * 100.0 / total, 1) as pct
FROM summary
ORDER BY catches DESC
```

Each CTE is a named stage. `catches` loads the data once. `summary` computes per-control
counts with the total. The final SELECT formats the output. Read top to bottom - the
pipeline is self-documenting.

### Multi-Stage Composition

CTEs chain. Each CTE can reference any CTE defined before it. This is how you build
analytical pipelines:

```python
import duckdb

result = duckdb.sql("""
  WITH
    raw AS (
      SELECT *
      FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
    ),
    by_date AS (
      SELECT
        date,
        control,
        COUNT(*) as daily_catches
      FROM raw
      GROUP BY date, control
    ),
    ranked AS (
      SELECT
        date,
        control,
        daily_catches,
        ROW_NUMBER() OVER (PARTITION BY date ORDER BY daily_catches DESC) as rank
      FROM by_date
    )
  SELECT * FROM ranked
  WHERE rank <= 3
  ORDER BY date, rank
""").df()

print(result)
```

This pipeline: loads raw data, aggregates by date and control, ranks controls within each
date, and filters to the top 3 per date. Each stage is testable in isolation - change the
final SELECT to `SELECT * FROM by_date` to inspect the intermediate result.

### Pandas Comparison

The equivalent in pandas uses method chaining:

```python
(catches
  .groupby(["date", "control"])
  .size()
  .reset_index(name="daily_catches")
  .sort_values(["date", "daily_catches"], ascending=[True, False])
  .groupby("date")
  .head(3))
```

Both approaches compose. CTEs are often clearer when the pipeline involves window functions
or joins at intermediate stages. Pandas method chaining is often clearer for reshaping
operations.

> **AGENTIC GROUNDING:** CTEs are how you make agent data analysis reproducible. A CTE
> pipeline in a `.sql` file is a documented, version-controlled analytical artifact. When
> the Operator asks "how did you compute that convergence number?", the CTE pipeline is
> the answer - each stage visible, each transformation named.

---

## 3. Window Functions

*Estimated time: 90 minutes*

Window functions are the single largest gap between "I know SQL" and "I can analyze data
with SQL." They compute a value for each row using information from other rows, without
collapsing the result set. A GROUP BY reduces 10 rows into 1 summary row. A window
function keeps all 10 rows and adds a computed column to each.

The concept: "For each row, compute something using a window of related rows."

### The OVER Clause

Every window function has an `OVER()` clause that defines the window:

```sql
function_name() OVER (
  [PARTITION BY column(s)]
  [ORDER BY column(s)]
  [frame_specification]
)
```

- **PARTITION BY** divides rows into groups. Like GROUP BY, but without collapsing rows.
  "Compute this separately for each control" means `PARTITION BY control`.
- **ORDER BY** defines the ordering within each partition. Required for ranking and
  offset functions (LAG, LEAD). Defines what "previous" and "next" mean.
- **Frame specification** defines which rows relative to the current row are included
  in the computation. Default depends on the function.

An empty `OVER()` means "the entire result set is one window."

### ROW_NUMBER

Assigns a sequential integer to each row within its partition. No ties - if two rows
have the same ORDER BY value, ROW_NUMBER arbitrarily picks which gets 1 and which gets 2.

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  )
  SELECT
    date,
    control,
    outcome,
    ROW_NUMBER() OVER (ORDER BY date) as seq,
    ROW_NUMBER() OVER (PARTITION BY outcome ORDER BY date) as seq_within_outcome
  FROM catches
""").df()

print(result)
```

Two uses here: `seq` numbers all rows chronologically. `seq_within_outcome` numbers rows
within each outcome group separately. The "logged" outcomes get their own 1, 2, 3 sequence;
the "fixed" outcomes get their own.

**Common use:** Top-N queries. "Show the first catch for each control":

```sql
WITH catches AS (
  SELECT *
  FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
),
numbered AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY control ORDER BY date) as rn
  FROM catches
)
SELECT * FROM numbered WHERE rn = 1
```

### RANK and DENSE_RANK

RANK assigns the same number to ties, then skips. DENSE_RANK assigns the same number
to ties without skipping.

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  ),
  control_counts AS (
    SELECT control, COUNT(*) as n
    FROM catches
    GROUP BY control
  )
  SELECT
    control,
    n,
    RANK() OVER (ORDER BY n DESC) as rank,
    DENSE_RANK() OVER (ORDER BY n DESC) as dense_rank
  FROM control_counts
""").df()

print(result)
```

If two controls both have 3 catches:

| control | n | rank | dense_rank |
|---------|---|------|------------|
| L11 cross-model | 3 | 1 | 1 |
| dc-openai-r2 | 3 | 1 | 1 |
| gauntlet-audit | 1 | 3 | 2 |

RANK skips rank 2 because two rows share rank 1. DENSE_RANK does not skip - the next
distinct value gets 2. Use DENSE_RANK when you want "the N distinct levels" and RANK
when you want "the actual position."

### LAG and LEAD

LAG looks backward. LEAD looks forward. Both take three arguments:
`LAG(column, offset, default)`.

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  ),
  daily AS (
    SELECT
      date,
      COUNT(*) as catches
    FROM catches
    GROUP BY date
    ORDER BY date
  )
  SELECT
    date,
    catches,
    LAG(catches, 1) OVER (ORDER BY date) as prev_day_catches,
    catches - LAG(catches, 1) OVER (ORDER BY date) as daily_change,
    LEAD(catches, 1) OVER (ORDER BY date) as next_day_catches
  FROM daily
""").df()

print(result)
```

`LAG(catches, 1)` returns the value from 1 row before the current row (by the ORDER BY).
`LEAD(catches, 1)` returns the value from 1 row after. The first row's LAG is NULL (no
previous row). The last row's LEAD is NULL (no next row).

The third argument provides a default when there is no row to look at:

```sql
LAG(catches, 1, 0) OVER (ORDER BY date)
-- Returns 0 instead of NULL for the first row
```

**Common use:** Period-over-period comparison. "How did catches change from yesterday?"

```sql
WITH catches AS (
  SELECT *
  FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
),
daily AS (
  SELECT date, COUNT(*) as n
  FROM catches
  GROUP BY date
)
SELECT
  date,
  n,
  LAG(n) OVER (ORDER BY date) as prev,
  CASE
    WHEN LAG(n) OVER (ORDER BY date) IS NULL THEN NULL
    WHEN LAG(n) OVER (ORDER BY date) = 0 THEN NULL
    ELSE ROUND((n - LAG(n) OVER (ORDER BY date)) * 100.0 / LAG(n) OVER (ORDER BY date), 1)
  END as pct_change
FROM daily
ORDER BY date
```

### Running SUM and AVG

Running aggregates compute a cumulative value up to and including the current row. The
frame specification controls which rows are included.

**Running total:**

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  ),
  daily AS (
    SELECT date, COUNT(*) as n
    FROM catches
    GROUP BY date
    ORDER BY date
  )
  SELECT
    date,
    n,
    SUM(n) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) as cumulative_catches
  FROM daily
""").df()

print(result)
```

`ROWS UNBOUNDED PRECEDING` means "from the first row of the partition up to and including
the current row." This is the default frame when ORDER BY is specified, but stating it
explicitly makes the intent clear.

**Moving average:**

```sql
SELECT
  date,
  n,
  AVG(n) OVER (
    ORDER BY date
    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
  ) as sma_3
FROM daily
```

`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` creates a sliding window of 3 rows: the
current row and the 2 before it. For the first row, the window contains only itself.
For the second row, it contains 2 rows. From the third row onward, it always contains 3.

### Frame Specification: ROWS vs RANGE

The frame specification defines which rows fall inside the window:

```sql
-- Physical rows
ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
-- Includes exactly 3 rows (current + 2 before)

-- Logical range
RANGE BETWEEN INTERVAL 7 DAY PRECEDING AND CURRENT ROW
-- Includes all rows within 7 calendar days before current row
```

The difference matters when data has gaps. If your daily counts skip weekends:

- `ROWS BETWEEN 6 PRECEDING` always grabs the previous 6 rows, regardless of their dates.
  That might span 10 calendar days if there are gaps.
- `RANGE BETWEEN INTERVAL 6 DAY PRECEDING` grabs only rows within 6 calendar days, even
  if that means fewer than 6 rows.

For time series with regular intervals (no gaps), ROWS and RANGE produce identical results.
For irregular data, RANGE is usually what you want.

### PARTITION BY and ORDER BY Combined

PARTITION BY and ORDER BY work together. PARTITION BY creates independent groups. ORDER BY
defines sequence within each group.

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  )
  SELECT
    control,
    date,
    outcome,
    ROW_NUMBER() OVER (PARTITION BY control ORDER BY date) as seq_per_control,
    COUNT(*) OVER (PARTITION BY control) as total_per_control,
    SUM(1) OVER (PARTITION BY control ORDER BY date ROWS UNBOUNDED PRECEDING) as running_count
  FROM catches
  ORDER BY control, date
""").df()

print(result)
```

Three window functions, same data, different computations:
- `ROW_NUMBER()` sequences events within each control
- `COUNT(*)` with PARTITION BY but no ORDER BY counts total events per control (same value
  for every row in the partition)
- `SUM(1)` with PARTITION BY and ORDER BY gives a running count within each control

When there is no ORDER BY in the OVER clause, the frame is the entire partition. When there
is an ORDER BY, the default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.

### Pandas Comparison

Window functions in pandas use `.groupby().transform()`, `.groupby().rank()`, and `.shift()`:

```python
# ROW_NUMBER equivalent
catches["rn"] = catches.groupby("control").cumcount() + 1

# LAG equivalent
catches["prev_date"] = catches.sort_values("date").groupby("control")["date"].shift(1)

# Running sum
catches["cumulative"] = catches.sort_values("date").groupby("control")["outcome"].cumcount() + 1

# RANK equivalent
control_counts = catches.groupby("control").size().reset_index(name="n")
control_counts["rank"] = control_counts["n"].rank(method="min", ascending=False).astype(int)
```

For simple ranking and lag operations, pandas is comparable. For complex frames
(`ROWS BETWEEN N PRECEDING AND M FOLLOWING`), pandas requires `.rolling()` with careful
setup. SQL window functions express these directly and readably.

> **HISTORY:** Window functions entered the SQL standard in SQL:2003, but practical
> implementations lagged for years. MySQL did not support them until version 8.0 in 2018.
> SQLite added them in 3.25.0 (2018). PostgreSQL has had them since 8.4 (2009) and is the
> reference implementation most people learn from. DuckDB inherits PostgreSQL's window
> function semantics, which means PostgreSQL documentation and examples translate directly.

> **AGENTIC GROUNDING:** When you need to answer "how is this metric changing over time
> within each category?", window functions are the tool. An agent system that logs events
> per control type naturally maps to `PARTITION BY control ORDER BY date`. The running
> total tells you cumulative volume. The LAG comparison tells you acceleration. The RANK
> tells you which controls are most active. All three are single-query answers that would
> require multiple pandas operations.

---

## 4. Self-Joins

*Estimated time: 25 minutes*

A self-join compares a table to itself. It answers questions like "which rows share a
property?" or "which items in set A have no match in set B?"

### Same-Day Events Across Sources

Join the catch log against itself to find controls that fired on the same day:

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  )
  SELECT
    a.date,
    a.control as control_a,
    b.control as control_b,
    a.outcome as outcome_a,
    b.outcome as outcome_b
  FROM catches a
  JOIN catches b
    ON a.date = b.date
    AND a.control < b.control
  ORDER BY a.date
""").df()

print(result)
```

The condition `a.control < b.control` prevents duplicate pairs. Without it, you get both
(L11 cross-model, dc-gemini) and (dc-gemini, L11 cross-model), plus every row paired with
itself.

### Finding Gaps with Anti-Joins

An anti-join finds rows in one set that have no match in another. This is the LEFT JOIN
WHERE NULL pattern:

```python
import duckdb
import pandas as pd
import yaml

with open("docs/internal/events.yaml") as f:
  events = pd.DataFrame(yaml.safe_load(f)["events"])

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  )
  SELECT e.date, e.type, e.summary
  FROM events e
  LEFT JOIN catches c ON e.date = c.date
  WHERE c.date IS NULL
""").df()

print(result)
```

This finds events that occurred on dates with no catch log entries. The LEFT JOIN keeps
all events; the WHERE clause filters to those where the catch side is NULL (no match).

### Pandas Comparison

Pandas anti-joins use the `indicator` parameter:

```python
merged = pd.merge(events, catches, on="date", how="left", indicator=True)
unmatched = merged[merged["_merge"] == "left_only"]
```

Both approaches work. SQL anti-joins are more idiomatic when the data is already in
a queryable format. Pandas is clearer when you need to inspect the full merge result
before filtering.

> **AGENTIC GROUNDING:** Self-joins are how you answer "which findings appear in one
> model's review but not another's." In the triangulate workflow, each model produces
> findings independently. A self-join on the findings union - `WHERE a.found_by = 'R1'
> AND b.found_by = 'R2'` - shows convergence at the individual finding level, not just
> the aggregate convergence rate.

---

## 5. Pivoting and Unpivoting

*Estimated time: 25 minutes*

Pivoting turns row values into column names (long to wide). Unpivoting does the reverse
(wide to long). DuckDB has native PIVOT and UNPIVOT syntax, which is more concise than
the standard SQL CASE-WHEN approach.

### PIVOT: Long to Wide

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  )
  PIVOT (
    SELECT outcome, date, control FROM catches
  )
  ON outcome
  USING COUNT(*)
  GROUP BY date
  ORDER BY date
""").df()

print(result)
```

This produces one row per date, with columns for each outcome value (logged, reviewed,
blocked, fixed, scrubbed). Each cell contains the count of catches with that outcome on
that date.

Before PIVOT (long):

| date | outcome | control |
|------|---------|---------|
| 2026-03-04 | logged | L11 cross-model |
| 2026-03-04 | fixed | dc-openai-r2 |

After PIVOT (wide):

| date | logged | fixed | blocked | reviewed | scrubbed |
|------|--------|-------|---------|----------|----------|
| 2026-03-04 | 2 | 2 | 1 | 1 | 0 |

### UNPIVOT: Wide to Long

```sql
UNPIVOT (
  SELECT * FROM wide_table
)
ON logged, fixed, blocked, reviewed, scrubbed
INTO NAME outcome VALUE count
```

This reverses the pivot - each outcome column becomes a row with two new columns: `outcome`
(the column name) and `count` (the cell value).

### Pandas Comparison

Pandas uses `pivot_table()` for pivoting and `melt()` for unpivoting:

```python
# Pivot
pt = catches.pivot_table(
  values="control",
  index="date",
  columns="outcome",
  aggfunc="count",
  fill_value=0,
)

# Unpivot
long = pd.melt(
  pt.reset_index(),
  id_vars=["date"],
  var_name="outcome",
  value_name="count",
)
```

Pandas and DuckDB are comparably clear for pivoting. DuckDB's PIVOT syntax is more
concise for simple cases. Pandas `pivot_table` is more flexible for multi-level pivots
and custom aggregation functions.

> **AGENTIC GROUNDING:** The convergence matrix from `bin/triangulate` is a pivoted view -
> findings as rows, models as columns, presence as values. When you need to analyze
> convergence patterns across multiple runs, unpivoting that matrix into long format makes
> it queryable: "Which findings are found by exactly 2 models?" becomes a simple GROUP BY
> and HAVING clause on the unpivoted data.

---

## 6. Date and Time Operations

*Estimated time: 25 minutes*

Agent data is inherently temporal. Events have timestamps. Backlogs have creation dates.
Catch logs have dates. Analytical questions are almost always time-relative: "per week",
"compared to last period", "days since creation."

### DATE_TRUNC

Truncates a date or timestamp to a specified precision. This is how you group by time
periods:

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  )
  SELECT
    DATE_TRUNC('week', date::DATE) as week,
    COUNT(*) as catches
  FROM catches
  GROUP BY 1
  ORDER BY 1
""").df()

print(result)
```

`DATE_TRUNC('week', date)` returns the Monday of the week containing that date.
Other units: `'day'`, `'month'`, `'quarter'`, `'year'`, `'hour'`, `'minute'`.

### EXTRACT

Pulls a specific component from a date or timestamp:

```sql
SELECT
  EXTRACT(dow FROM date::DATE) as day_of_week,
  EXTRACT(month FROM date::DATE) as month,
  EXTRACT(year FROM date::DATE) as year
FROM catches
```

DuckDB's `dow` returns 0 for Sunday, 6 for Saturday. Use `isodow` for ISO convention
where Monday is 1 and Sunday is 7.

### DATE_DIFF

Computes the difference between two dates in a specified unit:

```python
import duckdb
import pandas as pd
import yaml

with open("docs/internal/backlog.yaml") as f:
  backlog = pd.DataFrame(yaml.safe_load(f) or [])

result = duckdb.sql("""
  SELECT
    id,
    title,
    created::DATE as created_date,
    DATE_DIFF('day', created::DATE, CURRENT_DATE) as age_days
  FROM backlog
  ORDER BY age_days DESC
""").df()

print(result)
```

The argument order is `DATE_DIFF(unit, start, end)`, returning `end - start`. Getting the
order wrong gives negative values.

**Warning:** `DATE_DIFF('month', '2026-01-31', '2026-02-28')` returns 0, not 1. It counts
complete unit boundary crossings, not calendar months. For approximate months, use
`DATE_DIFF('day', start, end) / 30`.

### Interval Arithmetic

DuckDB supports direct date arithmetic with intervals:

```sql
SELECT
  date::DATE as original,
  date::DATE + INTERVAL 7 DAY as next_week,
  date::DATE - INTERVAL 1 MONTH as last_month
FROM catches
```

### Pandas Comparison

Pandas uses `.dt` accessor methods and `pd.Timedelta`:

```python
# DATE_TRUNC equivalent
catches["week"] = catches["date"].dt.to_period("W").dt.start_time

# EXTRACT equivalent
catches["dow"] = catches["date"].dt.dayofweek  # 0=Monday in pandas (differs from SQL)

# DATE_DIFF equivalent
catches["age_days"] = (pd.Timestamp.now() - catches["date"]).dt.days
```

Note the convention difference: pandas `dayofweek` uses 0=Monday, while SQL `dow` uses
0=Sunday. This is a common source of off-by-one errors when translating between the two.

> **AGENTIC GROUNDING:** The catch log and events log both use `YYYY-MM-DD` date strings.
> DATE_TRUNC and DATE_DIFF are how you aggregate these into operational views - catches per
> week, events per month, age of backlog items. When the Operator asks "how long has
> BL-007 been open?", `DATE_DIFF('day', created::DATE, CURRENT_DATE)` is the answer.

---

## 7. Analytical Patterns

*Estimated time: 30 minutes*

The previous sections covered SQL mechanics. This section combines them into patterns
that answer operational questions about agent systems.

### Funnel Analysis

A funnel tracks how many items survive each stage of a process. In the catch log, the
funnel is: catch event -> outcome (logged/reviewed/blocked/fixed/scrubbed).

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  ),
  funnel AS (
    SELECT
      outcome,
      COUNT(*) as n,
      SUM(COUNT(*)) OVER () as total
    FROM catches
    GROUP BY outcome
  )
  SELECT
    outcome, n,
    ROUND(n * 100.0 / total, 1) as pct_of_total,
    SUM(n) OVER (ORDER BY n DESC ROWS UNBOUNDED PRECEDING) as cumulative
  FROM funnel
  ORDER BY n DESC
""").df()

print(result)
```

This combines GROUP BY (to count per outcome) with a window function (to compute total
and cumulative). A healthy verification system has most catches resulting in "fixed" or
"blocked" - if most are just "logged", the controls are observing but not acting.

### Cohort Analysis

A cohort groups items by when they first appeared, then tracks behavior over time. For
slopodar patterns, the cohort is the detection date:

```python
import duckdb
import pandas as pd
import yaml

with open("docs/internal/slopodar.yaml") as f:
  patterns = pd.DataFrame(yaml.safe_load(f)["patterns"])

result = duckdb.sql("""
  SELECT
    DATE_TRUNC('week', detected::DATE) as detection_week,
    domain,
    COUNT(*) as patterns_detected,
    COUNT(CASE WHEN confidence = 'strong' THEN 1 END) as strong_confidence,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity
  FROM patterns
  GROUP BY 1, 2
  ORDER BY 1, 2
""").df()

print(result)
```

This groups patterns by their detection week and domain, showing how the taxonomy grew
over time and whether later-detected patterns tend to be lower confidence.

### Retention Analysis

Retention asks: "Do items persist across periods?" For a multi-run triangulate setup,
this would track which findings survive from run to run. With the project's current data,
we can approximate retention by checking which controls fire on multiple dates:

```python
import duckdb

result = duckdb.sql("""
  WITH catches AS (
    SELECT *
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
  ),
  control_dates AS (
    SELECT
      control,
      COUNT(DISTINCT date) as active_days,
      MIN(date) as first_seen,
      MAX(date) as last_seen
    FROM catches
    GROUP BY control
  )
  SELECT
    control,
    active_days,
    first_seen,
    last_seen,
    CASE
      WHEN active_days > 1 THEN 'recurring'
      ELSE 'single-day'
    END as pattern_type
  FROM control_dates
  ORDER BY active_days DESC
""").df()

print(result)
```

Recurring controls are the ones to prioritize - they represent persistent issues, not
one-off events.

> **AGENTIC GROUNDING:** These three patterns - funnel, cohort, retention - map directly
> to operational questions about agent systems. "What percentage of darkcat findings
> actually get fixed?" is a funnel. "Are newer model versions finding different patterns
> than older ones?" is a cohort analysis. "Which issues persist across prompt iterations?"
> is retention. The SQL is the same structure every time; only the data source and column
> names change.

---

## Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: CTE Pipeline with Week-over-Week Change

**Estimated time: 20 minutes**

**Goal:** Write a CTE pipeline that loads the catch log, computes catches per week per
control, ranks controls by total catches, and shows week-over-week change.

Write a single SQL query (wrapped in `duckdb.sql()`) with these CTE stages:

1. `raw` - load `docs/internal/weaver/catch-log.tsv`
2. `weekly` - group by `DATE_TRUNC('week', date::DATE)` and control, counting catches
3. `with_lag` - add a LAG column showing previous week's catches per control
4. `ranked` - add a DENSE_RANK on total catches across all weeks per control

The final SELECT should show: week, control, weekly catches, previous week catches,
change, and the control's overall rank.

**Verification:** The query runs without error. Each CTE is independently queryable
(change the final SELECT to `SELECT * FROM weekly` to inspect). The LAG column shows
NULL for the first week of each control.

<details>
<summary>Hints</summary>

- `DATE_TRUNC` needs the date cast to DATE type: `date::DATE`
- LAG needs `PARTITION BY control ORDER BY week` to compare within the same control
- DENSE_RANK for the overall rank should be computed on a subquery that sums across weeks
- The weekly CTE needs `GROUP BY 1, 2` (positional references to the first two columns)

</details>

---

## Challenge: Window Function Rankings

**Estimated time: 15 minutes**

**Goal:** Using the slopodar taxonomy, rank patterns by detection date within each domain,
and show each pattern's position relative to its domain peers.

Load `docs/internal/slopodar.yaml` into a pandas DataFrame. Then write a DuckDB query
that:

1. Assigns `ROW_NUMBER()` within each domain, ordered by detection date
2. Computes `COUNT(*)` per domain (total patterns in that domain)
3. Shows `RANK()` by severity (high > medium > low) within each domain

The output should include: id, name, domain, detected, row number, domain total, and
severity rank.

**Verification:** Each domain's ROW_NUMBER starts at 1. The domain total is the same for
every row within a domain. Severity ranks show ties for patterns with the same severity.

<details>
<summary>Hints</summary>

- Use a CASE expression to convert severity to a numeric rank for ordering:
  `CASE WHEN severity = 'high' THEN 1 WHEN severity = 'medium' THEN 2 ELSE 3 END`
- `COUNT(*) OVER (PARTITION BY domain)` gives the total without collapsing rows

</details>

---

## Challenge: Cross-Source Self-Join

**Estimated time: 15 minutes**

**Goal:** Join the events log with the catch log on date to reconstruct the timeline of
"what happened and what caught it."

Load `docs/internal/events.yaml` into a pandas DataFrame. Write a DuckDB query that:

1. LEFT JOINs events onto catch log entries by date
2. Shows: event date, event type, event summary, catch control, catch outcome
3. Includes events with no corresponding catch (NULL catch columns)
4. Orders by date, then by event type

**Verification:** All events appear in the output. Events on dates with catch log entries
show the catch details. Events on dates without catch entries show NULL for catch columns.

<details>
<summary>Hints</summary>

- The agent column has different casing across sources (`Weaver` vs `weaver`). For this
  exercise, join on date only - the casing mismatch is a known data quality issue
  documented in Task 02 findings.
- Use `e.date::VARCHAR = c.date` if type coercion causes issues.

</details>

---

## Challenge: Pivot and Temporal Analysis

**Estimated time: 20 minutes**

**Goal:** Build a pivoted view of the catch log showing outcomes as columns and dates as
rows, then add a running total.

Write a DuckDB query that:

1. PIVOTs the catch log with dates as rows and outcomes as columns (COUNT of catches)
2. Wraps the PIVOT result in a CTE
3. Adds a running total column that sums all catches across all outcomes per date,
   accumulated over time

**Verification:** Each date is one row. Each outcome is a column with counts. The running
total increases monotonically. The final running total equals the total row count of the
catch log.

<details>
<summary>Hints</summary>

- PIVOT produces a result you can wrap in a CTE: `WITH pivoted AS (PIVOT ...)`
- For the running total, you need to sum across the outcome columns first:
  `(COALESCE(logged, 0) + COALESCE(fixed, 0) + ...)` to get a daily total, then
  `SUM(...) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING)` for the cumulative

</details>

---

## Key Takeaways

Before moving to Step 5, verify you can answer these questions without looking anything up:

1. What does `duckdb.sql("SELECT * FROM 'file.tsv'").df()` do, and why is the `.df()`
   method needed?
2. What is the difference between a CTE and a subquery? When does a CTE make a query
   more readable?
3. What does `OVER (PARTITION BY x ORDER BY y)` mean? How does PARTITION BY differ from
   GROUP BY?
4. What is the difference between ROW_NUMBER, RANK, and DENSE_RANK when there are ties?
5. What does `LAG(value, 1) OVER (ORDER BY date)` return for the first row?
6. What is the difference between `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` and
   `RANGE BETWEEN INTERVAL 2 DAY PRECEDING AND CURRENT ROW`?
7. How do you find rows in table A that have no match in table B? (Name the SQL pattern.)
8. What does `DATE_TRUNC('week', date)` return? What day of the week is the result?
9. In DuckDB's PIVOT syntax, what does the ON clause specify?
10. When would you use SQL window functions instead of pandas for the same analysis?

---

## Recommended Reading

- **DuckDB Documentation - SQL Reference** - https://duckdb.org/docs/sql/introduction.
  The window functions page and the PIVOT/UNPIVOT page are the most relevant sections
  for this step.

- **PostgreSQL Window Functions Tutorial** - https://www.postgresql.org/docs/current/
  tutorial-window.html. DuckDB follows PostgreSQL semantics for window functions. The
  PostgreSQL tutorial is the clearest explanation of frame specifications available.

- **"SQL for Data Scientists" - Renee Teate (2021)**. Chapters on window functions and
  CTEs. Practical rather than theoretical, with an analytics focus.

- **Modern SQL** - https://modern-sql.com/. Markus Winand's site covering SQL:2003+
  features including window functions, CTEs, LATERAL joins, and temporal queries.
  The window function section is particularly thorough.

---

## What to Read Next

**Step 5: Time Series Basics** - Time series analysis builds directly on the window
functions and date operations from this step. LAG for period-over-period comparison,
running SUM for cumulative metrics, DATE_TRUNC for temporal grouping - these are
the SQL primitives that Step 5 extends with trend detection, seasonality decomposition,
and anomaly identification. Step 5 works in both pandas and DuckDB, so the SQL skills
from this step compose with the pandas skills from Step 1. The question shifts from
"what happened?" (this step) to "what is the pattern over time?" (Step 5).

