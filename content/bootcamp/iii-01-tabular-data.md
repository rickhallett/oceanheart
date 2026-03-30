+++
title = "Tabular Data with pandas and DuckDB"
date = "2026-03-10"
description = "DataFrames, column operations, groupby, joins, reshaping. The foundation for all analysis."
tags = ["pandas", "duckdb", "data", "bootcamp"]
step = 1
tier = 1
estimate = "4-5 hours"
bootcamp = 3
+++

Step 1 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

Agents produce structured output constantly: YAML metrics from `bin/triangulate`, TSV
catch logs recording control firings (`docs/internal/weaver/catch-log.tsv`), JSON API
responses, YAML event spines tracking decisions and process events
(`docs/internal/events.yaml`). Before you can answer any analytical question about agent
behavior - which controls fire most, how severity distributes across models, whether
review convergence improves over time - you need to load that output into a structure
where columns have types and rows can be filtered, grouped, and joined.

pandas is the standard Python library for tabular data. It has been the default since
2011 and its API shapes how most data analysts think about data transformations. DuckDB
is a newer tool (first release 2019) that brings analytical SQL directly into a Python
process - no server, no setup, no network. It reads CSV and Parquet files from a SQL
`FROM` clause with zero configuration.

This project uses both. The `bin/triangulate` script processes YAML into metrics dicts.
Exploring those metrics - slicing by model, comparing across runs, building crosstabs
of severity by reviewer - is pandas territory. Running a one-off aggregation query
against the catch log without writing any Python class definitions is DuckDB territory.

This is Step 1 because every other step in Bootcamp III depends on it. Descriptive
statistics (Step 2) assumes you can load and filter a DataFrame. Hypothesis testing
(Step 3) assumes you can group and aggregate. Visualization (Step 4) assumes you can
reshape data into the format a plotting library expects. If your loading, filtering, and
reshaping are uncertain, every subsequent analysis is built on guesswork.

The goal: load any project data file into a queryable table in under 60 seconds, with
correct types, clean column names, and awareness of what is missing.

---

## Table of Contents

1. [DataFrames from Scratch](#1-dataframes-from-scratch) (~30 min)
2. [Column Operations](#2-column-operations) (~30 min)
3. [Filtering and Boolean Indexing](#3-filtering-and-boolean-indexing) (~25 min)
4. [Groupby and Aggregation](#4-groupby-and-aggregation) (~30 min)
5. [Joins and Merges](#5-joins-and-merges) (~35 min)
6. [Reshaping](#6-reshaping) (~30 min)
7. [DuckDB Basics](#7-duckdb-basics) (~35 min)
8. [Data Cleaning Patterns](#8-data-cleaning-patterns) (~30 min)
9. [Challenges](#9-challenges) (~60-90 min)
10. [Key Takeaways](#key-takeaways)
11. [Recommended Reading](#recommended-reading)
12. [What to Read Next](#what-to-read-next)

---

## 1. DataFrames from Scratch

*Estimated time: 30 minutes*

A DataFrame is a two-dimensional, column-oriented data structure. Each column is a
**Series** - a one-dimensional array with a label (the column name) and a dtype (the
type of every element). The DataFrame itself is an ordered collection of Series objects
that share a common index. This is not a spreadsheet. It is closer to a dict of typed
arrays that are forced to have the same length.

The distinction matters because operations in pandas are column-oriented. When you write
`df["severity"].value_counts()`, pandas operates on a single contiguous array of values,
not scanning row by row. This is why pandas is fast on columnar operations and awkward
on row-by-row logic.

### Creating from Dicts

The most common way to create a DataFrame in Python code is from a dict of lists, where
each key becomes a column name and each list becomes the column values:

```python
import pandas as pd

df = pd.DataFrame({
  "id": ["BL-001", "BL-002", "BL-003"],
  "priority": ["medium", "low", "medium"],
  "status": ["open", "open", "open"],
})
print(df)
#        id priority status
# 0  BL-001   medium   open
# 1  BL-002      low   open
# 2  BL-003   medium   open
```

The second common pattern is a list of dicts, where each dict is a row. This is the
natural shape for YAML and JSON records:

```python
records = [
  {"id": "BL-001", "priority": "medium", "status": "open"},
  {"id": "BL-002", "priority": "low", "status": "open"},
]
df = pd.DataFrame(records)
```

Both produce identical DataFrames. Dict-of-lists is faster for large datasets because
pandas can allocate each column array in a single pass. List-of-dicts is what you get
from `yaml.safe_load()` on most YAML files.

### Reading CSV and TSV

The catch log (`docs/internal/weaver/catch-log.tsv`) is a tab-separated file with a
header row. pandas reads it directly:

```python
import pandas as pd

catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")
print(catches.columns.tolist())
# ['date', 'control', 'what_caught', 'agent', 'outcome', 'notes']
print(catches.shape)
# (10, 6)
```

`read_csv` is the workhorse function for delimited text. The `sep` parameter controls
the delimiter - `","` (default) for CSV, `"\t"` for TSV. The function infers column
names from the first row by default (`header="infer"`).

For dates, do not rely on automatic inference. Pass the column names explicitly:

```python
catches = pd.read_csv(
  "docs/internal/weaver/catch-log.tsv",
  sep="\t",
  parse_dates=["date"],
)
print(catches["date"].dtype)
# datetime64[ns]
```

The `parse_dates` parameter takes a list of column names to convert to datetime. Using
`parse_dates=True` (boolean) attempts to infer which columns are dates, which is slow
and unreliable. Always be explicit.

### Reading JSON

For JSON files that contain an array of objects (the most common format from API
responses and tool exports):

```python
df = pd.read_json("findings.json", orient="records")
```

The `orient` parameter tells pandas how the JSON is structured. `"records"` means a list
of `{key: value}` dicts - one dict per row. Without `orient`, pandas guesses, and it
guesses wrong often enough that specifying it explicitly is a standing habit.

### Reading YAML

There is no `pd.read_yaml()`. YAML loading is a two-step process: parse the YAML with
PyYAML, then construct the DataFrame:

```python
import yaml
import pandas as pd

# backlog.yaml is a bare list (no wrapper key)
with open("docs/internal/backlog.yaml") as f:
  data = yaml.safe_load(f) or []

backlog = pd.DataFrame(data)
print(backlog.columns.tolist())
# ['id', 'title', 'status', 'priority', 'tags', 'epic', 'created', 'closed', 'reason']
print(len(backlog))
# 10
```

The `or []` guard matters. `yaml.safe_load()` returns `None` for an empty file, and
`pd.DataFrame(None)` raises an error.

When YAML has a wrapper key, you must unwrap it:

```python
# events.yaml has a top-level "events" key
with open("docs/internal/events.yaml") as f:
  raw = yaml.safe_load(f)

events = pd.DataFrame(raw["events"])
print(events.columns.tolist())
# ['date', 'time', 'type', 'agent', 'commit', 'ref', 'summary', 'backrefs']
```

For deeply nested YAML (like `slopodar.yaml` where entries have multi-line block scalar
fields), `pd.json_normalize()` flattens nested dicts into dot-separated column names:

```python
with open("docs/internal/slopodar.yaml") as f:
  raw = yaml.safe_load(f)

patterns = pd.json_normalize(raw["patterns"], sep="_")
print(patterns.columns.tolist())
# ['id', 'name', 'domain', 'detected', 'confidence', 'trigger',
#  'description', 'detect', 'instead', 'severity', 'refs', ...]
```

> **AGENTIC GROUNDING:** When an agent produces a YAML metrics file - say, the output
> of `bin/triangulate` - your first action is loading it into a DataFrame. The two-step
> pattern (`yaml.safe_load` then `pd.DataFrame`) is the bridge between agent output
> (structured text on disk) and analytical operations (filtering, grouping, plotting).
> If you cannot do this reliably in under a minute, you cannot verify agent output at
> the speed the work demands.

---

## 2. Column Operations

*Estimated time: 30 minutes*

Once data is in a DataFrame, the first thing you do is inspect and reshape the columns.
Column operations are the most common pandas operations by volume: selecting the columns
you care about, renaming unclear names, computing derived values, and casting types so
that dates behave as dates and numbers behave as numbers.

### Selecting Columns

```python
# Single column - returns a Series
priorities = backlog["priority"]
print(type(priorities))
# <class 'pandas.core.series.Series'>

# Multiple columns - returns a DataFrame
subset = backlog[["id", "priority", "status"]]
print(type(subset))
# <class 'pandas.core.frame.DataFrame'>
```

The distinction between `df["col"]` (Series) and `df[["col"]]` (single-column DataFrame)
matters downstream. A merge operation expects a DataFrame; a value counts operation
works on a Series. Know which you are holding.

### Renaming Columns

The catch log has a column called `what_caught`. For downstream code, you might prefer
`description`:

```python
catches = catches.rename(columns={
  "what_caught": "description",
  "notes": "detail",
})
```

`rename()` returns a new DataFrame by default. Avoid `inplace=True` - it is discouraged
in pandas 2.x and may be removed in a future version. The assignment pattern
(`df = df.rename(...)`) is idiomatic.

### Computed Columns

Add a new column by assigning to a column name that does not yet exist:

```python
import pandas as pd

backlog["created_dt"] = pd.to_datetime(backlog["created"])
backlog["age_days"] = (pd.Timestamp.now(tz="UTC") - backlog["created_dt"]).dt.days
print(backlog[["id", "age_days"]].head(3))
#        id  age_days
# 0  BL-001         2
# 1  BL-002         2
# 2  BL-003         2
```

The `.dt` accessor exposes datetime component extraction on a Series of datetime values.
`.dt.days`, `.dt.month`, `.dt.dayofweek` - these are the pandas equivalent of SQL's
`EXTRACT()`.

### Type Casting

pandas infers types on load, but inference is imperfect. A column of integers with one
null value becomes `float64` (because numpy's `int64` cannot represent NaN). A column
of dates stored as strings stays as `object` (string) unless you explicitly parse it.

```python
# String to datetime
backlog["created"] = pd.to_datetime(backlog["created"], format="ISO8601")

# String to category (saves memory, enables groupby optimizations)
catches["outcome"] = catches["outcome"].astype("category")

# Object to nullable integer (handles NaN without float conversion)
# df["count"] = df["count"].astype("Int64")  # capital I for nullable
```

The `format="ISO8601"` option was added in pandas 2.0 as an explicit fast path for ISO
8601 strings. It is much faster than format inference and handles the timezone-aware
timestamps in `backlog.yaml` (e.g., `2026-03-08T15:41:52.485496+00:00`) correctly.

### Datetime Parsing Patterns

The project's data files use three different date formats:

| Source | Format | Example |
|--------|--------|---------|
| `backlog.yaml` | ISO 8601 with tz + microseconds | `2026-03-08T15:41:52.485496+00:00` |
| `events.yaml` | Separate `date` and `time` fields | `2026-03-04` + `08:30` |
| `catch-log.tsv` | `YYYY-MM-DD` | `2026-03-04` |

Handling each:

```python
# backlog: full ISO 8601
backlog["created"] = pd.to_datetime(backlog["created"], format="ISO8601")

# events: concatenate date + time, then parse
events["datetime"] = pd.to_datetime(
  events["date"] + " " + events["time"],
  format="%Y-%m-%d %H:%M",
)

# catch-log: simple date
catches["date"] = pd.to_datetime(catches["date"], format="%Y-%m-%d")
```

> **AGENTIC GROUNDING:** Date format heterogeneity across data sources is the norm in
> agent-produced data, not the exception. Each tool in the pipeline chooses its own
> format. The Operator who can normalize three different date representations into a
> common datetime type in seconds has a diagnostic advantage over one who has to look
> up `strftime` codes every time. Memorize `%Y-%m-%d %H:%M:%S` and `format="ISO8601"`.
> Those two cover 90% of what you will encounter.

---

## 3. Filtering and Boolean Indexing

*Estimated time: 25 minutes*

Filtering is how you ask questions of a DataFrame. "Which catch log entries were
scrubbed?" "Which backlog items have priority medium?" "Which slopodar patterns were
detected after March 1st?" Each question translates to a boolean mask - a Series of
`True`/`False` values the same length as the DataFrame - which is used to select rows.

### Single Conditions

```python
# All catches with outcome "scrubbed"
scrubbed = catches[catches["outcome"] == "scrubbed"]
print(len(scrubbed))
# 1

# All high-severity slopodar patterns
high_sev = patterns[patterns["severity"] == "high"]
print(len(high_sev))
```

The expression `catches["outcome"] == "scrubbed"` does not return a boolean. It returns a
**Series of booleans**, one per row. When you pass that Series as an index to the
DataFrame (`catches[...]`), pandas selects only the rows where the value is `True`.

### Combining Conditions

Use `&` (and), `|` (or), `~` (not). Each condition must be wrapped in parentheses
because of Python's operator precedence rules:

```python
# Catches by weaver that were fixed
weaver_fixes = catches[
  (catches["agent"] == "weaver") & (catches["outcome"] == "fixed")
]

# Patterns that are high severity OR strong confidence
urgent = patterns[
  (patterns["severity"] == "high") | (patterns["confidence"] == "strong")
]

# Everything except logged outcomes
not_logged = catches[~(catches["outcome"] == "logged")]
```

Forgetting the parentheses produces `ValueError: The truth value of a Series is
ambiguous`. This is one of the most common pandas errors. It happens because Python's
`and` operator tries to evaluate the entire Series as a single boolean, which is
undefined. Use `&` instead.

### The .query() Method

For complex conditions, `.query()` provides a more readable string-based syntax:

```python
result = catches.query("agent == 'weaver' and outcome == 'fixed'")

# Reference a Python variable with @
target_date = "2026-03-05"
recent = catches.query("date >= @target_date")
```

Use `@` to reference variables from the calling scope. Do not use f-strings to inject
values into the query string - that creates the same class of injection vulnerabilities
as building SQL strings with string concatenation.

### Membership Testing with .isin()

When filtering against a list of values:

```python
target_outcomes = ["fixed", "scrubbed", "blocked"]
actionable = catches[catches["outcome"].isin(target_outcomes)]
```

This is cleaner than chaining `|` conditions and easier to maintain when the list changes.

> **AGENTIC GROUNDING:** When a darkcat alley review produces 40 findings across three
> models, your first analytical action is filtering: "Show me only the high-severity
> findings." Then: "Show me only findings from the Claude review." Then: "Show me
> findings that all three models agreed on." Each of these is a boolean mask applied to
> a DataFrame. The speed at which you can filter determines the speed at which you can
> verify agent output.

---

## 4. Groupby and Aggregation

*Estimated time: 30 minutes*

Groupby is the pandas equivalent of SQL's `GROUP BY`. It splits a DataFrame into groups
based on one or more columns, applies an aggregation function to each group, and combines
the results. This is how you answer questions like "how many catches per control?" or
"what is the distribution of severity across slopodar domains?"

### The Split-Apply-Combine Pattern

Every groupby operation follows three internal steps:

1. **Split** - partition the DataFrame into groups based on distinct values in the group
   column(s)
2. **Apply** - run an aggregation function (count, sum, mean, etc.) on each group
3. **Combine** - assemble the per-group results into a new DataFrame

```python
# Count catches per control
catches_by_control = catches.groupby("control").size()
print(catches_by_control)
# control
# L11 cross-model       1
# dc-gemini             1
# dc-openai-r2          2
# dc-openai-r3          2
# ...
# Name: count, dtype: int64
```

`.size()` counts rows including NaN. `.count()` counts non-NaN values per column. For
simple counting, `.size()` is usually what you want.

### Named Aggregation

When you need multiple aggregations with specific output column names, use the named
aggregation syntax:

```python
# Slopodar patterns: count and list domains per confidence level
summary = patterns.groupby("confidence").agg(
  count=("id", "count"),
  domains=("domain", "nunique"),
)
print(summary)
#             count  domains
# confidence
# low             4        3
# medium          7        5
# strong         17        7
```

Each keyword argument is a tuple of `(source_column, aggregation_function)`. This is
the recommended approach in pandas 2.x - it produces clean column names without
post-processing.

### Common Aggregation Functions

| Function | What it computes |
|----------|-----------------|
| `"count"` | Number of non-NaN values |
| `"size"` | Number of rows (including NaN) |
| `"sum"` | Sum of values |
| `"mean"` | Arithmetic mean |
| `"median"` | Median |
| `"min"` / `"max"` | Minimum / Maximum |
| `"nunique"` | Number of unique values |
| `"first"` / `"last"` | First / last value in group |
| `lambda x: ...` | Any custom function |

### Multi-Column Groupby

Group by multiple columns to create cross-tabulations:

```python
# Slopodar: count patterns by domain and severity
cross = patterns.groupby(["domain", "severity"]).size().reset_index(name="count")
print(cross.head())
#                  domain severity  count
# 0  analytical-measurement     high      2
# 1  analytical-measurement   medium      2
# 2                    code     high      2
# 3                    code   medium      1
```

`reset_index()` converts the group columns from index levels back to regular columns.
Without it, `domain` and `severity` become a MultiIndex, which is correct but harder
to work with in downstream operations.

### Transform vs Aggregate

`agg()` reduces each group to a single row. `transform()` returns a value for every
row in the original DataFrame - the group-level result is broadcast back:

```python
# Add a column: what percentage of total catches does each row represent?
catches["pct_of_total"] = catches.groupby("agent")["outcome"].transform("count")
catches["pct_of_total"] = catches["pct_of_total"] / len(catches) * 100
```

Use `transform` when you need to annotate rows with group-level statistics without
reducing the DataFrame.

> **AGENTIC GROUNDING:** The `bin/triangulate` metrics export contains per-model finding
> counts, severity distributions, and convergence rates. Groupby is how you answer "which
> model finds the most unique issues?" (groupby model, count unique findings) and "does
> severity calibration vary by model?" (groupby model, compare severity distributions).
> These are the first questions you ask when evaluating whether a multi-model review
> pipeline is adding value.

---

## 5. Joins and Merges

*Estimated time: 35 minutes*

Joins combine two DataFrames based on shared columns. This project's data sources are
designed to cross-reference each other: events reference catch log entries by date,
slopodar patterns are referenced by ID in event backrefs, backlog items link to
decisions via tags. Joins are how you materialize those references into a single
queryable table.

### pd.merge() - The Core Join Function

```python
merged = pd.merge(left, right, on="shared_column", how="inner")
```

The `how` parameter controls which rows survive the join:

| `how` | Keeps |
|-------|-------|
| `"inner"` | Only rows with matches in both DataFrames |
| `"left"` | All rows from left, matched rows from right (NaN where no match) |
| `"right"` | All rows from right, matched rows from left |
| `"outer"` | All rows from both (NaN where no match on either side) |

### Joining Project Data Sources

The events and catch log share a `date` field. To see which events correspond to which
catches:

```python
import yaml
import pandas as pd

# Load events
with open("docs/internal/events.yaml") as f:
  events = pd.DataFrame(yaml.safe_load(f)["events"])
events["date"] = pd.to_datetime(events["date"], format="%Y-%m-%d")

# Load catches
catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")
catches["date"] = pd.to_datetime(catches["date"], format="%Y-%m-%d")

# Left join: all events, matched catches
merged = pd.merge(events, catches, on="date", how="left", suffixes=("_event", "_catch"))
print(merged.columns.tolist())
# ['date', 'time', 'type', 'agent_event', 'commit', 'ref', 'summary_event',
#  'backrefs', 'control', 'what_caught', 'agent_catch', 'outcome', 'notes']
print(len(merged))
```

Note the `suffixes` parameter. Both DataFrames have columns named `agent` and `summary`.
Without suffixes, pandas appends `_x` and `_y` automatically, which is uninformative.
Always provide meaningful suffixes when column names collide.

### Join Column Mismatch

When join columns have different names in the two DataFrames, use `left_on` and
`right_on`:

```python
# Hypothetical: backlog "id" matches a "backlog_ref" column in another source
merged = pd.merge(
  backlog,
  references,
  left_on="id",
  right_on="backlog_ref",
  how="inner",
)
```

### The validate Parameter

In pandas 2.x, `validate` is enforced strictly. Use it to catch cardinality violations
early:

```python
# Expect one event per date (one-to-many with catches)
merged = pd.merge(
  events,
  catches,
  on="date",
  how="left",
  validate="one_to_many",
)
```

If the join would produce a many-to-many relationship when you specified `one_to_many`,
pandas raises `MergeError`. This is a data quality assertion - the join itself tells you
whether your assumptions about the data are correct.

### The indicator Parameter

To see which rows matched and which did not:

```python
merged = pd.merge(events, catches, on="date", how="outer", indicator=True)
print(merged["_merge"].value_counts())
# both          ...
# left_only     ...
# right_only    ...
```

The `_merge` column shows whether each row came from the left only, right only, or both.
This is your diagnostic tool for understanding join completeness.

> **AGENTIC GROUNDING:** The project's data sources form a reference web: events
> reference catch log entries by date, slopodar patterns by `slopodar:<id>` in backrefs,
> and session decisions by `SD-NNN` in refs. When you join events with catches on date,
> you are materializing one edge of that web. When an event backref says
> `slopodar:the-lullaby` and you join with the slopodar DataFrame on ID, you are
> materializing another edge. The ability to traverse this web programmatically - not by
> reading files one at a time - is what turns a collection of logs into an auditable
> governance record.

---

## 6. Reshaping

*Estimated time: 30 minutes*

Reshaping transforms data between **wide** format (one column per category) and **long**
format (categories stacked in a single column). This matters because different operations
and different tools expect different shapes. Pivot tables are wide. Plotting libraries
(matplotlib, seaborn) usually want long. GroupBy works on long. Crosstabs produce wide.

### Pivot Tables

A pivot table takes long data and spreads one column's values across the column axis:

```python
# Slopodar: count of patterns by domain (rows) and severity (columns)
pt = patterns.pivot_table(
  values="id",
  index="domain",
  columns="severity",
  aggfunc="count",
  fill_value=0,
)
print(pt)
# severity                     high  medium
# domain
# analytical-measurement          2       2
# code                            2       1
# commit-workflow                 0       3
# governance-process              3       3
# metacognitive                   0       1
# prose-style                     4       3
# relationship-sycophancy         3       4
# tests                           1       3
```

The distinction between `pivot_table` and `pivot`: `pivot` does not aggregate. If
multiple rows have the same index/column combination, `pivot` raises `ValueError`.
`pivot_table` aggregates them using the function you specify. Rule of thumb: always use
`pivot_table`.

### Melt: Wide to Long

`melt` is the inverse of pivot. It takes columns and unpivots them into rows:

```python
# Suppose you have a wide convergence matrix from triangulate:
# columns: finding_id, claude_severity, gpt_severity, gemini_severity
wide = pd.DataFrame({
  "finding_id": ["F-01", "F-02", "F-03"],
  "claude_severity": ["high", "medium", "high"],
  "gpt_severity": ["high", "high", "medium"],
  "gemini_severity": ["medium", "medium", "high"],
})

long = pd.melt(
  wide,
  id_vars=["finding_id"],
  value_vars=["claude_severity", "gpt_severity", "gemini_severity"],
  var_name="model",
  value_name="severity",
)
print(long)
#   finding_id             model severity
# 0       F-01  claude_severity     high
# 1       F-02  claude_severity   medium
# 2       F-03  claude_severity     high
# 3       F-01     gpt_severity     high
# 4       F-02     gpt_severity     high
# ...
```

Always specify `value_vars` explicitly. Without it, `melt` unpivots every column not in
`id_vars`, which can silently include columns you did not intend to transform.

### Stack and Unstack

`stack` and `unstack` operate on the DataFrame's index rather than its columns. They are
the index-level equivalents of melt and pivot:

```python
# Start with the pivot table from above
# stack: columns -> index level (wide -> long)
stacked = pt.stack()
print(type(stacked))
# <class 'pandas.core.series.Series'>  (MultiIndex)

# unstack: index level -> columns (long -> wide)
unstacked = stacked.unstack(level="severity")
# Back to the original pivot table shape
```

`stack()` always produces a Series with a MultiIndex. Use `.reset_index()` to get back
to a flat DataFrame if needed.

### When to Reshape

| Situation | Shape needed | Operation |
|-----------|-------------|-----------|
| Plotting with seaborn | Long (one observation per row) | `melt` |
| Comparing columns side by side | Wide (one column per category) | `pivot_table` |
| GroupBy aggregation | Long | Already long, or `melt` first |
| Correlation matrix | Wide (one column per variable) | `pivot_table` or `unstack` |
| Export to CSV for a report | Wide | `pivot_table` |

> **AGENTIC GROUNDING:** The triangulate convergence matrix is naturally wide - one
> column per reviewer (R1, R2, R3), one row per finding. But to ask "does reviewer
> severity correlate with finding type?", you need it long: one row per reviewer-finding
> combination. The `melt` operation is the bridge. When you see a wide matrix and need
> to group by a value that is currently a column name, `melt` first, then `groupby`.

---

## 7. DuckDB Basics

*Estimated time: 35 minutes*

DuckDB is an in-process analytical SQL database. "In-process" means it runs inside your
Python process - no server, no client-server protocol, no network. You import it, write
SQL, and get results. It was designed specifically for the analytical workload that pandas
also targets: columnar operations on tabular data.

The key differentiator is the interface: SQL instead of method chaining. For aggregations,
window functions, and multi-table joins, SQL is often more readable than the equivalent
pandas code. For iterative exploration, reshaping, and string manipulation, pandas is
usually more natural.

### Direct File Queries

DuckDB's most striking feature is querying files directly from a `FROM` clause:

```python
import duckdb

result = duckdb.sql("""
  SELECT * FROM read_csv_auto(
    'docs/internal/weaver/catch-log.tsv',
    delim='\t'
  )
""")
print(result.fetchdf())
```

No loading step. No DataFrame construction. DuckDB reads the file, infers types, and
returns results. `read_csv_auto` auto-detects headers, delimiters (usually), and column
types. For TSV files, specifying `delim='\t'` explicitly is safer than relying on
auto-detection.

For CSV files, you can omit `read_csv_auto` entirely and just use the file path:

```python
result = duckdb.sql("SELECT * FROM 'data.csv' LIMIT 5")
```

DuckDB recognizes `.csv`, `.parquet`, and `.json` extensions in `FROM` clauses and applies
the appropriate reader automatically.

### Querying pandas DataFrames

DuckDB detects pandas DataFrames in the local Python scope and exposes them as virtual
tables:

```python
import pandas as pd
import duckdb

catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")

# DuckDB sees the "catches" variable and queries it directly
result = duckdb.sql("""
  SELECT control, COUNT(*) as n
  FROM catches
  GROUP BY control
  ORDER BY n DESC
""")
print(result.fetchdf())
```

This is the bridge between the two tools. Load and clean in pandas, then query with SQL
when the question is easier to express that way.

### Aggregation in SQL

SQL aggregation is often more concise than the equivalent pandas code:

```python
# pandas
catches.groupby("outcome").agg(
  count=("control", "count"),
).sort_values("count", ascending=False)

# DuckDB - same result, arguably clearer
duckdb.sql("""
  SELECT outcome, COUNT(*) as count
  FROM catches
  GROUP BY outcome
  ORDER BY count DESC
""").fetchdf()
```

For multi-level aggregations with CTEs (Common Table Expressions), SQL scales in
readability where pandas method chains become deeply nested:

```python
result = duckdb.sql("""
  WITH daily AS (
    SELECT
      date,
      COUNT(*) as catches_per_day
    FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
    GROUP BY date
  )
  SELECT
    date,
    catches_per_day,
    SUM(catches_per_day) OVER (ORDER BY date) as cumulative
  FROM daily
  ORDER BY date
""").fetchdf()
```

This query counts catches per day, then adds a running cumulative total using a window
function. The pandas equivalent requires chaining `groupby`, `size`, `cumsum`, and
index management. The SQL reads top to bottom.

### Window Functions

DuckDB supports the full SQL window function specification. Window functions compute a
value for each row based on a "window" of related rows, without collapsing the group:

```python
result = duckdb.sql("""
  SELECT
    date,
    control,
    outcome,
    ROW_NUMBER() OVER (PARTITION BY date ORDER BY control) as row_num
  FROM read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
""").fetchdf()
```

`PARTITION BY` is the window equivalent of `GROUP BY`, but it does not collapse rows.
Each row keeps its identity and gets an additional computed column.

### .fetchdf() and Friends

`duckdb.sql()` returns a `DuckDBPyRelation`, not a DataFrame. To get results:

| Method | Returns |
|--------|---------|
| `.fetchdf()` or `.df()` | pandas DataFrame |
| `.fetchall()` | List of tuples |
| `.fetchone()` | Single tuple |
| `.fetch_arrow_table()` | PyArrow Table (zero-copy, fastest for large results) |

Call the conversion method once. The result is consumed on first fetch - calling
`.fetchdf()` twice on the same result raises an error.

### When SQL vs When pandas

| Task | Better tool | Why |
|------|------------|-----|
| Aggregation with GROUP BY | DuckDB | SQL is native to this |
| Window functions (running totals, ranks) | DuckDB | SQL window syntax is mature and readable |
| Multi-table joins | DuckDB | SQL joins are explicit and declarative |
| Reshaping (pivot, melt) | pandas | SQL PIVOT exists but is less flexible |
| Iterative exploration | pandas | Method chaining in a notebook is faster feedback |
| String manipulation | pandas | `.str` accessor is more expressive than SQL string functions |
| Loading YAML | pandas | DuckDB cannot read YAML natively |

The practical pattern: load everything into pandas DataFrames, do cleaning and reshaping
there, then use DuckDB for complex queries by referencing the DataFrame variables in SQL.

> **HISTORY:** DuckDB was created by Mark Raasveldt and Hannes Muhleisen at CWI
> (Centrum Wiskunde & Informatica) in Amsterdam, the same research institute where
> Guido van Rossum created Python and where the Monet column-store database was built.
> The project started in 2018 with a specific thesis: most analytical workloads do not
> need a server. They need an in-process engine that speaks SQL and reads files. This
> is the same insight that made SQLite successful for transactional workloads - but
> DuckDB is optimized for analytical queries (columnar storage, vectorized execution)
> where SQLite is optimized for transactional ones (row storage, write-ahead log).

> **AGENTIC GROUNDING:** When you need a quick count from the catch log - "how many
> times did the lullaby control fire?" - the fastest path is often
> `duckdb.sql("SELECT COUNT(*) FROM read_csv_auto('catch-log.tsv', delim='\\t') WHERE control = 'the-lullaby'")`.
> No imports beyond duckdb, no DataFrame setup, no method chain. This matters in
> operational contexts where you need a number in five seconds, not a notebook.

---

## 8. Data Cleaning Patterns

*Estimated time: 30 minutes*

Real agent output is messy. Fields are null when they should not be, casing is
inconsistent between sources, types that should be numeric are stored as strings, and
lists appear where scalars are expected. Data cleaning is not a preliminary step you do
once and forget - it is a continuous activity that happens every time you load a new data
source.

### Missing Values

pandas represents missing values as `NaN` (numpy float), `NaT` (datetime), `None`
(object columns), or `pd.NA` (nullable extension types in pandas 2.x). The function
`pd.isna()` handles all of these consistently:

```python
# How many null values per column?
print(backlog.isna().sum())
# id          0
# title       0
# status      0
# priority    0
# tags        0
# epic        7    # 7 items have no epic
# created     0
# closed     10    # all items are open, so closed is always null
# reason      8
```

Common operations for handling nulls:

```python
# Fill NaN with a default
backlog["epic"] = backlog["epic"].fillna("unassigned")

# Drop rows where a specific column is null
has_reason = backlog.dropna(subset=["reason"])

# Drop rows where ALL columns are null (empty rows)
cleaned = df.dropna(how="all")
```

**Do not use `df["col"] == None` or `df["col"] == np.nan`.** Neither works. NaN is not
equal to itself (`np.nan == np.nan` is `False`). Always use `pd.isna()` or the
`.isna()` method.

### Deduplication

```python
# Find duplicates
print(catches.duplicated().sum())
# 0 - no exact duplicates

# Find duplicates based on specific columns
print(catches.duplicated(subset=["date", "control"]).sum())

# Remove duplicates, keeping the first occurrence
deduped = catches.drop_duplicates(subset=["date", "control"], keep="first")
```

The `subset` parameter is critical. Without it, `duplicated()` checks all columns,
which rarely finds duplicates in real data (one differing field is enough to make rows
"unique"). Specify the columns that define logical identity.

### String Normalization

The project data has a known casing inconsistency: events.yaml uses title case for agent
names (`Weaver`, `Operator`), while catch-log.tsv uses lowercase (`weaver`,
`operator(L12)`):

```python
# Normalize agent names for joining
catches["agent_clean"] = catches["agent"].str.lower().str.replace(
  r"\(.*\)", "", regex=True
).str.strip()

events["agent_clean"] = events["agent"].str.lower()

# Now both have: "weaver", "operator"
merged = pd.merge(events, catches, on=["date", "agent_clean"], how="inner")
```

The `.str` accessor exposes string methods on an entire Series: `.str.lower()`,
`.str.upper()`, `.str.strip()`, `.str.replace()`, `.str.contains()`. This is the pandas
equivalent of calling `str.lower()` on each element, but vectorized.

### Type Coercion

When a column should be numeric but contains non-numeric values (common in agent output
where error messages appear in numeric fields):

```python
# Coerce to numeric, turning unparseable values into NaN
df["score"] = pd.to_numeric(df["score"], errors="coerce")

# Check what was lost
lost = df[df["score"].isna()]
```

The `errors="coerce"` parameter is safer than `errors="raise"` (the default) during
exploratory analysis. It lets you see how much data is unparseable before deciding how
to handle it.

### Handling List Columns

The backlog's `tags` field is a list in each row (e.g., `["housekeeping"]` or
`["tooling", "portfolio"]`). pandas stores these as object-typed columns containing
Python lists. This is awkward for filtering and grouping because list equality does not
work as expected:

```python
# This does NOT work:
# backlog[backlog["tags"] == ["housekeeping"]]

# Instead, use .apply() or explode:
# Option 1: check membership
has_testing = backlog[backlog["tags"].apply(lambda t: "testing" in t)]

# Option 2: explode into one row per tag
exploded = backlog.explode("tags")
print(exploded.groupby("tags").size())
# tags
# housekeeping    3
# portfolio       2
# testing         2
# tooling         3
```

`explode()` duplicates rows - a backlog item with two tags produces two rows, one per
tag, with all other columns repeated. This is the standard pattern for normalizing
list-valued columns into a shape that groupby can operate on.

### A Complete Cleaning Pipeline

Putting it together for the catch log:

```python
import pandas as pd

# Load
catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")

# Parse dates
catches["date"] = pd.to_datetime(catches["date"], format="%Y-%m-%d")

# Normalize agent names
catches["agent"] = catches["agent"].str.lower().str.replace(
  r"\(.*\)", "", regex=True
).str.strip()

# Categorize known-cardinality columns
catches["outcome"] = catches["outcome"].astype("category")

# Check for nulls
assert catches["control"].notna().all(), "null controls found"

# Final shape
print(catches.dtypes)
# date           datetime64[ns]
# control                object
# what_caught            object
# agent                  object
# outcome              category
# notes                  object
```

> **AGENTIC GROUNDING:** Agent output is rarely clean. The catch log's agent column uses
> lowercase and compound values (`operator(L12)`) while the events log uses title case
> (`Operator`). The slopodar YAML references IDs as bare strings (`the-lullaby`) while
> event backrefs use a prefix (`slopodar:the-lullaby`). These inconsistencies are not
> bugs - they are natural consequences of different tools producing data independently.
> The Operator who builds a cleaning pipeline for each source on first load can join
> across sources reliably. The one who does not gets silent mismatches in every downstream
> analysis.

---

## 9. Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: Backlog Age Analysis

**Estimated time: 15 minutes**

**Goal:** Load the project backlog, compute the age of each item in days, and produce
a summary grouped by priority.

1. Load `docs/internal/backlog.yaml` into a pandas DataFrame.
2. Parse the `created` column as datetime (format: ISO 8601 with timezone).
3. Compute a new column `age_days` representing days since creation.
4. Group by `priority` and compute the mean and max age.
5. Sort the result by mean age descending.

```python
import yaml
import pandas as pd

with open("docs/internal/backlog.yaml") as f:
  data = yaml.safe_load(f) or []

backlog = pd.DataFrame(data)

# Your code here:
# 1. Parse created as datetime
# 2. Compute age_days
# 3. Groupby priority, aggregate mean and max age
# 4. Sort by mean age descending
```

**Verification:** Your output should show two rows (one for `medium`, one for `low`)
with age values reflecting days since 2026-03-08 or 2026-03-10.

<details>
<summary>Hints</summary>

- Use `pd.to_datetime(backlog["created"], format="ISO8601")` for the timezone-aware
  timestamps.
- For age computation: `(pd.Timestamp.now(tz="UTC") - backlog["created"]).dt.days`.
- Named aggregation: `.agg(mean_age=("age_days", "mean"), max_age=("age_days", "max"))`.

</details>

**Extension:** Add a column counting items per priority. Which priority has the most
items? Is the oldest item medium or low priority?

---

## Challenge: Catch Log Control Frequency with DuckDB

**Estimated time: 15 minutes**

**Goal:** Use DuckDB to query the catch log directly from disk and determine which
control fires most frequently and which agent has the most catches.

```python
import duckdb

# Query 1: Which control has the most firings?
# Write a SQL query against read_csv_auto('docs/internal/weaver/catch-log.tsv', delim='\t')
# that returns control name and count, ordered by count descending.

# Query 2: Which agent has the most catches?
# Normalize agent names to handle the "operator(L12)" value.
# Hint: use LOWER() and REGEXP_REPLACE() in DuckDB SQL.
```

**Verification:**
- Query 1 should show the control names with their counts, totaling 10 rows of data.
- Query 2 should show `weaver` with the majority of catches after normalization.

<details>
<summary>Hints</summary>

- Query 1: `SELECT control, COUNT(*) as n FROM read_csv_auto(...) GROUP BY control ORDER BY n DESC`
- Query 2: `SELECT LOWER(REGEXP_REPLACE(agent, '\(.*\)', '')) as agent_clean, COUNT(*) as n FROM ... GROUP BY 1 ORDER BY n DESC`

</details>

**Extension:** Write a single query that produces a cross-tabulation of agent by outcome.
Use DuckDB's `PIVOT` syntax.

---

## Challenge: Reshaping Severity Assessments

**Estimated time: 20 minutes**

**Goal:** Start with a wide-format severity matrix (simulating a triangulate convergence
export) and reshape it for analysis.

```python
import pandas as pd

# Simulated triangulate severity data (wide format)
wide = pd.DataFrame({
  "finding_id": ["F-01", "F-02", "F-03", "F-04", "F-05"],
  "file": ["lib/auth/login.ts", "lib/bouts/scoring.ts", "lib/credits.ts",
           "lib/auth/login.ts", "lib/bouts/scoring.ts"],
  "claude_severity": ["high", "medium", "high", "low", "medium"],
  "gpt_severity": ["high", "high", "medium", "low", "high"],
  "gemini_severity": ["medium", "medium", "high", "medium", "medium"],
})

# Task 1: Melt to long format (one row per finding-model pair)
# Columns: finding_id, file, model, severity

# Task 2: From the long format, create a pivot table counting
# severity ratings per model (models as rows, severities as columns)

# Task 3: From the long format, find which findings have disagreement
# (not all three models gave the same severity)
```

**Verification:**
- Task 1 produces 15 rows (5 findings x 3 models).
- Task 2 produces a 3x3 table (3 models, 3 severity levels).
- Task 3 should identify at least 3 findings with disagreement.

<details>
<summary>Hints</summary>

- Task 1: `pd.melt(wide, id_vars=["finding_id", "file"], var_name="model", value_name="severity")`
- Task 2: `long.pivot_table(values="finding_id", index="model", columns="severity", aggfunc="count", fill_value=0)`
- Task 3: Group the long format by `finding_id`, check if `nunique` of severity > 1.

</details>

---

## Challenge: Cross-Source Join

**Estimated time: 20 minutes**

**Goal:** Join events.yaml with catch-log.tsv on date, handling the agent name
inconsistency, and produce a unified timeline.

```python
import yaml
import pandas as pd

# Load events
with open("docs/internal/events.yaml") as f:
  events = pd.DataFrame(yaml.safe_load(f)["events"])

# Load catches
catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")

# Task 1: Normalize dates in both DataFrames to datetime

# Task 2: Normalize agent names
# - events uses title case: "Weaver", "Operator"
# - catches uses lowercase + compound: "weaver", "operator(L12)"
# Create an "agent_clean" column in both that contains lowercase, no parenthetical

# Task 3: Left join events with catches on date
# How many catch records match each event?

# Task 4: Which event date has the most associated catches?
# Which event date has no catches at all?
```

**Verification:**
- Both DataFrames should have a `datetime64` date column after Task 1.
- Agent clean values should be lowercase without parenthetical suffixes.
- The join should show that 2026-03-04 has 9 associated catches and 2026-03-05 has 1.

<details>
<summary>Hints</summary>

- Date parsing: `pd.to_datetime(df["date"], format="%Y-%m-%d")`
- Agent cleaning: `df["agent"].str.lower().str.replace(r"\(.*\)", "", regex=True).str.strip()`
- After the join, `merged.groupby("date")["control"].count()` shows catches per event date.

</details>

> **AGENTIC GROUNDING:** This challenge replicates what you do operationally when
> investigating a governance event. An entry in events.yaml says "lullaby caught" on
> 2026-03-05. You need to cross-reference the catch log to see the full detail: who
> caught it, what the outcome was, what notes were recorded. The join is the programmatic
> version of manually scanning two files looking for matching dates. At scale - when there
> are hundreds of events and catches - manual scanning fails. The join does not.

---

## Key Takeaways

Before moving to Step 2, you should be able to answer these questions without looking
anything up:

1. What is the two-step pattern for loading a YAML file with a wrapper key into a pandas
   DataFrame? Why is there no `pd.read_yaml()`?

2. What is the difference between `df["col"]` and `df[["col"]]`? When does the
   distinction matter?

3. Why does `df[(cond1) and (cond2)]` fail? What operator do you use instead, and why
   do the parentheses matter?

4. What is the difference between `.size()` and `.count()` in a groupby? When do you
   care?

5. What does `validate="one_to_many"` do in `pd.merge()`? Why should you use it?

6. When would you use `melt` vs `pivot_table`? Which direction does each one go?

7. How does DuckDB's `read_csv_auto()` differ from `pd.read_csv()`? What parameter is
   `delim` in DuckDB but `sep` in pandas?

8. Why does `df["col"] == None` not work for finding null values? What do you use
   instead?

9. What does `explode()` do to a column containing lists? How does it affect the row
   count?

10. When you join two DataFrames that have different casing for agent names (`Weaver` vs
    `weaver`), what happens if you do not normalize first? How do you fix it?

---

## Recommended Reading

- **Python for Data Analysis** - Wes McKinney (3rd edition, 2022). Chapters 5 (pandas
  basics), 7 (data cleaning), 8 (data wrangling), and 10 (aggregation and groupby).
  Written by the creator of pandas. The 3rd edition covers pandas 2.x changes.

- **pandas documentation** - `https://pandas.pydata.org/docs/`. The API reference is
  comprehensive. Start with the "10 minutes to pandas" tutorial, then use the API docs
  as a reference. The "What's new in 2.0" and "What's new in 2.1" pages document every
  breaking change.

- **DuckDB documentation** - `https://duckdb.org/docs/`. The SQL reference and Python
  API pages are the most relevant. The "SQL Introduction" covers syntax differences from
  PostgreSQL and MySQL.

- **SQL for Data Scientists** - Renee Teate (2021). If your SQL is rusty, this covers
  the analytical SQL patterns (window functions, CTEs, self-joins) that DuckDB supports
  and that pandas makes awkward.

---

## What to Read Next

**Step 2: Descriptive Statistics** - Before hypothesis testing, before time series,
before any claim about trends or differences, you need to describe what you have. Step 2
covers central tendency (mean, median, mode), spread (standard deviation, IQR,
percentiles), distribution shape (skewness, histograms), and correlation. Every concept
in Step 2 operates on the DataFrames and Series you learned to construct in Step 1. When
Step 2 asks "what is the median match confidence score?", it assumes you can load the
triangulate export, select the confidence column, and call `.median()` without hesitation.

