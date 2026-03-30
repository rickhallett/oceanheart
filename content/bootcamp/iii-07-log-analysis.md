+++
title = "Log Analysis Patterns"
date = "2026-03-10"
description = "Log parsing, session reconstruction, error rate computation, latency analysis, JSONL in DuckDB."
tags = ["logs", "analysis", "bootcamp"]
step = 7
tier = 3
estimate = "3-4 hours"
bootcamp = 3
+++

Step 7 of 10 in Bootcamp III: Operational Analytics.

---

## Why This is Step 7

Bootcamp I Step 4 gave you single-pass text extraction: grep for filtering, awk for
column slicing, jq for structured JSON queries. Those tools handle one line at a time,
stateless, streaming. That is enough when you know what you are looking for and can
express it as a pattern match on a single line.

Agent systems produce logs that break this model. A single API call generates a request
log, a response log, and possibly an error log - three lines tied together by a
request ID. A multi-agent session spans hundreds of lines across multiple agents, each
annotated with a session ID and tool call ID. An error rate requires counting errors
across a time window, which means holding state. A latency percentile requires sorting
an entire column, which means buffering the whole dataset.

These are stateful problems. grep does not hold state. awk can, but the programs become
fragile. This step introduces the escalation pattern you will use repeatedly in
production:

- **grep/awk**: quick check, already in your terminal, answers "does this problem exist?"
- **pandas**: exploration, interactive, answers "what does this look like?"
- **DuckDB SQL**: repeatable, fast, answers "how does this scale?"

The project's own operational logs - `catch-log.tsv` (10 rows of control firing events)
and `events.yaml` (5 events in the reference web) - are real structured logs. They are
small enough to inspect manually but large enough to demonstrate every pattern. For
scale testing, this step includes data generators that produce thousands of realistic
JSONL log entries.

The goal: parse any log format into a table, then apply groupby, window, and percentile
operations to answer operational questions about agent systems.

---

## Table of Contents

1. [Log Format Parsing](#1-log-format-parsing) (~30 min)
2. [Session Reconstruction](#2-session-reconstruction) (~30 min)
3. [Error Rate Computation](#3-error-rate-computation) (~30 min)
4. [Latency Analysis](#4-latency-analysis) (~30 min)
5. [Multi-line Log Records](#5-multi-line-log-records) (~20 min)
6. [Log Aggregation in DuckDB](#6-log-aggregation-in-duckdb) (~30 min)
7. [Challenges](#7-challenges) (~60-90 min)
8. [Key Takeaways](#key-takeaways)
9. [Recommended Reading](#recommended-reading)
10. [What to Read Next](#what-to-read-next)

---

## 1. Log Format Parsing

*Estimated time: 30 minutes*

Every log analysis task starts with the same problem: turning unstructured or
semi-structured text into rows and columns. Log formats fall into three families, and
you need regex patterns for each.

### JSONL (Newline-Delimited JSON)

The simplest format to parse and the one you should demand from any system you build.
One JSON object per line, no wrapping array, no commas between records.

```json
{"ts":"2026-03-04T08:30:00Z","model":"claude-3-opus","tokens_in":150,"tokens_out":420,"latency_ms":1230,"status":200}
{"ts":"2026-03-04T08:30:01Z","model":"gpt-4","tokens_in":200,"tokens_out":380,"latency_ms":890,"status":200}
{"ts":"2026-03-04T08:30:03Z","model":"claude-3-opus","tokens_in":180,"tokens_out":0,"latency_ms":5020,"status":429}
```

Loading JSONL into pandas is a one-liner:

```python
import pandas as pd

df = pd.read_json("api_calls.jsonl", lines=True)
```

The `lines=True` parameter tells pandas to treat each line as a separate JSON object.
Without it, pandas expects a single JSON array or object, and your JSONL file will
produce a parse error.

**Bash quick check** - count lines, count errors:

```bash
wc -l api_calls.jsonl
grep -c '"status":4' api_calls.jsonl
grep -c '"status":5' api_calls.jsonl
```

> **AGENTIC GROUNDING:** LLM API providers (Anthropic, OpenAI) return structured JSON
> responses. If your orchestration layer logs every API call as JSONL, you get a
> queryable audit trail for free. When an agent session produces unexpected output,
> `grep "session_id" api.jsonl | jq '.status'` answers "did any call fail?" in
> seconds. This is cheaper and faster than reading the agent's narrative about what
> happened.

### Key=Value (Structured Logging)

Many application frameworks emit structured log lines with `key=value` pairs. This
format predates JSON logging and remains common in systems like systemd-journald,
Heroku log drains, and Go's `logfmt` convention.

```
ts=2026-03-04T08:30:00Z level=INFO agent=weaver session=abc-123 msg="tool call completed" tool=bash duration_ms=340
ts=2026-03-04T08:30:01Z level=ERROR agent=weaver session=abc-123 msg="tool call failed" tool=web_search error="timeout after 5000ms"
```

The regex pattern for key=value pairs:

```python
import re

KV_PATTERN = re.compile(r'(\w+)=(?:"([^"]*)"|([\S]*))')

def parse_kv_line(line: str) -> dict:
  """Parse a key=value log line into a dict."""
  return {k: v1 or v2 for k, v1, v2 in KV_PATTERN.findall(line)}

line = 'ts=2026-03-04T08:30:00Z level=INFO agent=weaver msg="tool call completed"'
record = parse_kv_line(line)
# {'ts': '2026-03-04T08:30:00Z', 'level': 'INFO', 'agent': 'weaver', 'msg': 'tool call completed'}
```

The regex handles two cases: quoted values (`msg="tool call completed"`) and unquoted
values (`level=INFO`). Group 1 captures the key, group 2 captures quoted values, group 3
captures unquoted values.

**Bash quick check** - extract all unique agents:

```bash
grep -oP 'agent=\K\S+' structured.log | sort -u
```

### Syslog/Traditional Format

The oldest format. A timestamp, a severity, a source, and a free-text message. Regex
is the only option.

```
Mar  4 08:30:00 app-server-1 orchestrator[2341]: Session abc-123 started, model=claude-3-opus
Mar  4 08:30:01 app-server-1 orchestrator[2341]: Session abc-123 tool_call=bash, duration=340ms
Mar  4 08:30:03 app-server-1 orchestrator[2341]: Session abc-123 ERROR: rate limit exceeded (429)
```

The regex for syslog:

```python
import re

SYSLOG_PATTERN = re.compile(
  r'(\w{3}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+'  # timestamp
  r'(\S+)\s+'                                 # hostname
  r'(\S+?)(?:\[(\d+)\])?:\s+'                # program[pid]
  r'(.*)'                                     # message
)

line = 'Mar  4 08:30:00 app-server-1 orchestrator[2341]: Session abc-123 started'
m = SYSLOG_PATTERN.match(line)
if m:
  ts, host, prog, pid, msg = m.groups()
```

### Timestamp Parsing

Timestamps are the single most error-prone element in log parsing. Three formats
dominate:

```python
import pandas as pd

# ISO 8601 (the correct format - use this in your systems)
pd.to_datetime("2026-03-04T08:30:00Z", format="ISO8601")

# Syslog (no year - pandas infers current year)
pd.to_datetime("Mar  4 08:30:00", format="%b  %d %H:%M:%S")

# Unix epoch milliseconds (common in JS-based systems)
pd.to_datetime(1741073400000, unit="ms")
```

The `format="ISO8601"` option was added in pandas 2.0 and is significantly faster than
format inference. Always use it for ISO timestamps. For unknown formats, use
`format="mixed"` - slower, but explicit about the ambiguity.

> **HISTORY:** The syslog format's lack of a year field (and lack of timezone) was a
> design decision from RFC 3164, written in 2001 to document existing practice that
> dated back to the 1980s. BSD syslog was designed for local logging where the year was
> obvious and the timezone was the host's timezone. RFC 5424 (2009) replaced this with
> ISO 8601 timestamps, but the old format persists in systemd, macOS, and most network
> devices. When you parse syslog timestamps, you must supply the year from context.

---

## 2. Session Reconstruction

*Estimated time: 30 minutes*

A single agent session generates many log lines. Session reconstruction is the act of
grouping those lines by their session identifier and computing per-session metrics.
This is the prototypical stateful log analysis problem - grep cannot do it.

### Generating Simulated Session Data

The project's real logs are small. For session analysis, we need volume. This generator
produces realistic multi-agent session logs as JSONL:

```python
#!/usr/bin/env python3
"""Generate simulated multi-agent session logs (JSONL)."""
import json
import random
from datetime import datetime, timedelta

random.seed(42)

AGENTS = ["weaver", "architect", "watchdog", "sentinel"]
TOOLS = ["bash", "read_file", "write_file", "web_search", "sql_query"]
OUTCOMES = ["success", "success", "success", "success", "error", "timeout"]
MODELS = ["claude-3-opus", "claude-3-sonnet", "gpt-4"]

def generate_sessions(n_sessions=200, output_path="sessions.jsonl"):
  base_time = datetime(2026, 3, 4, 8, 0, 0)
  records = []

  for i in range(n_sessions):
    session_id = f"sess-{i:04d}"
    agent = random.choice(AGENTS)
    model = random.choice(MODELS)
    n_calls = random.randint(2, 12)
    t = base_time + timedelta(seconds=random.randint(0, 86400))

    for j in range(n_calls):
      tool = random.choice(TOOLS)
      outcome = random.choice(OUTCOMES)
      duration = random.randint(50, 3000) if outcome != "timeout" else random.randint(5000, 30000)
      tokens_in = random.randint(50, 500)
      tokens_out = random.randint(100, 2000) if outcome == "success" else 0

      records.append({
        "ts": (t + timedelta(milliseconds=j * random.randint(500, 5000))).isoformat() + "Z",
        "session_id": session_id,
        "agent": agent,
        "model": model,
        "tool": tool,
        "outcome": outcome,
        "duration_ms": duration,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
      })

  records.sort(key=lambda r: r["ts"])
  with open(output_path, "w") as f:
    for r in records:
      f.write(json.dumps(r) + "\n")

  return len(records)

if __name__ == "__main__":
  n = generate_sessions()
  printf_msg = f"Generated {n} log lines across 200 sessions"
  print(printf_msg)
```

Run the generator, then load the data:

```python
import pandas as pd

df = pd.read_json("sessions.jsonl", lines=True)
df["ts"] = pd.to_datetime(df["ts"], format="ISO8601")
```

### The Escalation Pattern: Session Metrics

**Bash quick check** - how many sessions, how many lines per session?

```bash
# Count unique sessions
jq -r '.session_id' sessions.jsonl | sort -u | wc -l

# Lines per session (top 5 busiest)
jq -r '.session_id' sessions.jsonl | sort | uniq -c | sort -rn | head -5
```

**Pandas exploration** - per-session summary:

```python
session_summary = df.groupby("session_id").agg(
  agent=("agent", "first"),
  model=("model", "first"),
  n_calls=("tool", "count"),
  n_errors=("outcome", lambda x: (x == "error").sum()),
  n_timeouts=("outcome", lambda x: (x == "timeout").sum()),
  total_duration_ms=("duration_ms", "sum"),
  total_tokens_in=("tokens_in", "sum"),
  total_tokens_out=("tokens_out", "sum"),
)

# Sessions that had at least one error
error_sessions = session_summary[session_summary["n_errors"] > 0]
print(f"Sessions with errors: {len(error_sessions)} / {len(session_summary)}")
```

**DuckDB repeatable query:**

```python
import duckdb

session_stats = duckdb.sql("""
  SELECT
    session_id,
    FIRST(agent) AS agent,
    FIRST(model) AS model,
    COUNT(*) AS n_calls,
    SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) AS n_errors,
    SUM(CASE WHEN outcome = 'timeout' THEN 1 ELSE 0 END) AS n_timeouts,
    SUM(duration_ms) AS total_duration_ms,
    MAX(ts) - MIN(ts) AS wall_time
  FROM read_json_auto('sessions.jsonl')
  GROUP BY session_id
  ORDER BY n_errors DESC
""").fetchdf()
```

### Per-Agent Success Rate

The question agents cannot answer about themselves: what is your actual success rate?

```python
agent_stats = session_summary.groupby("agent").agg(
  total_sessions=("n_calls", "count"),
  sessions_with_errors=("n_errors", lambda x: (x > 0).sum()),
).assign(
  error_rate=lambda d: d["sessions_with_errors"] / d["total_sessions"]
)
print(agent_stats.sort_values("error_rate", ascending=False))
```

> **AGENTIC GROUNDING:** Session reconstruction is the foundation of agent
> observability. When an agent reports "task completed successfully" but the session log
> shows 3 errors and 2 timeouts before eventual completion, you have a discrepancy
> between the agent's narrative and the operational record. The session summary table is
> the ground truth. The agent's self-report is the claim. Trust the table.

---

## 3. Error Rate Computation

*Estimated time: 30 minutes*

Error count is a number. Error rate is a signal. The difference is the denominator -
errors per total requests, computed over a time window, tracked over time. This is the
metric that tells you whether things are getting worse.

### Generating API Log Data

```python
#!/usr/bin/env python3
"""Generate simulated API call logs (JSONL) with realistic error patterns."""
import json
import random
from datetime import datetime, timedelta

random.seed(7)

MODELS = ["claude-3-opus", "claude-3-sonnet", "gpt-4", "gemini-pro"]
ENDPOINTS = ["/v1/chat/completions", "/v1/messages", "/v1/embeddings"]
STATUS_WEIGHTS = {200: 85, 400: 3, 429: 7, 500: 3, 503: 2}
STATUSES = []
for code, weight in STATUS_WEIGHTS.items():
  STATUSES.extend([code] * weight)

def generate_api_logs(n_requests=5000, output_path="api_calls.jsonl"):
  base_time = datetime(2026, 3, 4, 0, 0, 0)
  records = []

  for i in range(n_requests):
    ts = base_time + timedelta(seconds=i * random.uniform(0.5, 3.0))
    model = random.choice(MODELS)
    endpoint = random.choice(ENDPOINTS)
    status = random.choice(STATUSES)

    # Latency depends on status
    if status == 200:
      latency = random.gauss(800, 300)
    elif status == 429:
      latency = random.gauss(50, 10)   # rate limits respond fast
    elif status >= 500:
      latency = random.gauss(5000, 1500)  # server errors are slow
    else:
      latency = random.gauss(100, 30)  # client errors are fast

    latency = max(10, latency)
    tokens_in = random.randint(50, 800)
    tokens_out = random.randint(100, 4000) if status == 200 else 0

    records.append({
      "ts": ts.isoformat() + "Z",
      "endpoint": endpoint,
      "model": model,
      "status": status,
      "latency_ms": round(latency, 1),
      "tokens_in": tokens_in,
      "tokens_out": tokens_out,
    })

  with open(output_path, "w") as f:
    for r in records:
      f.write(json.dumps(r) + "\n")

  return len(records)

if __name__ == "__main__":
  n = generate_api_logs()
  print(f"Generated {n} API call log lines")
```

### Error Classification

Not all errors are equal. The first step in error analysis is classification.

```python
import pandas as pd

df = pd.read_json("api_calls.jsonl", lines=True)
df["ts"] = pd.to_datetime(df["ts"], format="ISO8601")

# Classify errors by HTTP status range
df["error_class"] = pd.cut(
  df["status"],
  bins=[0, 399, 429, 499, 599],
  labels=["success", "rate_limit", "client_error", "server_error"],
  right=True,
)

print(df["error_class"].value_counts())
```

### The Escalation Pattern: Error Rate Over Time

**Bash quick check** - error count per hour:

```bash
# Count 4xx and 5xx per hour
jq -r 'select(.status >= 400) | .ts[:13]' api_calls.jsonl | sort | uniq -c
```

**Pandas exploration** - error rate per 15-minute window:

```python
df = df.set_index("ts").sort_index()

# Total requests per window
total = df.resample("15min")["status"].count()

# Error requests per window
errors = df[df["status"] >= 400].resample("15min")["status"].count()

# Error rate (fill missing windows with 0 errors)
error_rate = (errors.reindex(total.index, fill_value=0) / total).fillna(0)
print(error_rate.describe())
```

**DuckDB repeatable query:**

```python
import duckdb

hourly_errors = duckdb.sql("""
  WITH windows AS (
    SELECT
      DATE_TRUNC('hour', CAST(ts AS TIMESTAMP)) AS hour,
      COUNT(*) AS total,
      SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors
    FROM read_json_auto('api_calls.jsonl')
    GROUP BY 1
  )
  SELECT
    hour,
    total,
    errors,
    ROUND(errors * 100.0 / total, 2) AS error_pct
  FROM windows
  ORDER BY hour
""").fetchdf()
```

### Error Trends: Is It Getting Worse?

A flat error rate is acceptable. A rising error rate is an incident. Compare the rolling
average to the overall average:

```python
error_rate_15m = (errors.reindex(total.index, fill_value=0) / total).fillna(0)
rolling_avg = error_rate_15m.rolling("1h").mean()
overall_avg = error_rate_15m.mean()

# Windows where rolling error rate exceeds 2x the overall average
hot_windows = rolling_avg[rolling_avg > 2 * overall_avg]
if len(hot_windows) > 0:
  print(f"Found {len(hot_windows)} windows with elevated error rates")
  print(hot_windows)
```

> **AGENTIC GROUNDING:** When an agent system starts failing, the error rate curve tells
> you whether you have a transient spike (rate limit burst, network blip) or a
> persistent degradation (bad prompt template, upstream API change). The distinction
> determines your response: wait and retry vs. investigate and fix. A single error count
> without the rate or trend is nearly useless for this decision.

---

## 4. Latency Analysis

*Estimated time: 30 minutes*

Mean latency is a lie. It hides the tail. In agent systems, the user waiting for a
response experiences the p99, not the p50. A "fast" system with 800ms mean latency and
a 15-second p99 feels broken one request in a hundred.

### Percentile Computation

Use the API call data from Section 3.

**Bash quick check** - approximate median latency:

```bash
jq '.latency_ms' api_calls.jsonl | sort -n | awk '
  { vals[NR] = $1 }
  END {
    printf "p50: %.1f\n", vals[int(NR*0.5)]
    printf "p95: %.1f\n", vals[int(NR*0.95)]
    printf "p99: %.1f\n", vals[int(NR*0.99)]
  }
'
```

**Pandas exploration** - percentiles by model:

```python
import pandas as pd

df = pd.read_json("api_calls.jsonl", lines=True)

# Overall percentiles
print(df["latency_ms"].quantile([0.5, 0.95, 0.99]))

# Per-model percentiles
model_latency = df.groupby("model")["latency_ms"].quantile([0.5, 0.95, 0.99])
print(model_latency.unstack())
```

The `.quantile()` method on a grouped Series returns a MultiIndex Series. Calling
`.unstack()` pivots the percentile level into columns, producing a readable table:

```
               0.50     0.95      0.99
model
claude-3-opus  812.3   1489.2   4823.1
claude-3-sonnet 795.1  1423.8   4612.7
gemini-pro     801.6   1456.3   4910.2
gpt-4          808.4   1478.9   4789.5
```

**DuckDB repeatable query:**

```python
import duckdb

latency_report = duckdb.sql("""
  SELECT
    model,
    COUNT(*) AS n,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms), 1) AS p50,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 1) AS p95,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 1) AS p99,
    ROUND(AVG(latency_ms), 1) AS mean
  FROM read_json_auto('api_calls.jsonl')
  GROUP BY model
  ORDER BY p99 DESC
""").fetchdf()

print(latency_report)
```

### Latency by Endpoint and Time

Latency varies by endpoint (embeddings are fast, chat completions are slow) and by
time of day (congestion patterns). Cross-tabulating both reveals where the system is
slowest and when.

```python
# Pandas pivot: p95 latency by endpoint and hour
df["ts"] = pd.to_datetime(df["ts"], format="ISO8601")
df["hour"] = df["ts"].dt.hour

pt = df.pivot_table(
  values="latency_ms",
  index="endpoint",
  columns="hour",
  aggfunc=lambda x: x.quantile(0.95),
)
print(pt)
```

### Identifying Slow Requests

The tail matters most. Extract the slowest 1% and look for patterns:

```python
p99_threshold = df["latency_ms"].quantile(0.99)
slow_requests = df[df["latency_ms"] >= p99_threshold]

# What models and endpoints produce the slowest requests?
print(slow_requests.groupby(["model", "endpoint"]).size().sort_values(ascending=False))

# What status codes dominate the slow tail?
print(slow_requests["status"].value_counts())
```

If server errors (5xx) dominate the slow tail, latency and reliability are the same
problem. If successful requests (200) dominate, you have a genuine performance issue.

> **AGENTIC GROUNDING:** When an Operator notices that an agent "feels slow," the latency
> percentile table is the diagnostic instrument. If p50 is 800ms but p99 is 12 seconds,
> you know that most calls are fast but occasional calls are painfully slow. The next
> question is: which model/endpoint/time-of-day produces those slow calls? The pivot
> table answers that without guessing.

---

## 5. Multi-line Log Records

*Estimated time: 20 minutes*

Not all log records fit on one line. Stack traces, JSON responses, and agent reasoning
blocks span multiple lines. Parsing these requires stateful logic: detect the start of
a record, accumulate lines until the end of the record, then emit the complete record.

### Stack Traces

A Python stack trace starts with `Traceback (most recent call last):` and ends with
the exception line. The pattern for extraction:

**Bash** - extract stack traces with context:

```bash
# Print each traceback plus the exception line
grep -n 'Traceback (most recent call last)' app.log | while read line; do
  lineno=$(printf '%s' "$line" | cut -d: -f1)
  # Extract from Traceback through next non-indented line
  awk "NR>=${lineno} && NR<=${lineno}+50 { print; if (NR>${lineno} && /^[^ ]/) exit }" app.log
  printf '\n---\n'
done
```

**Python stateful parser:**

```python
def extract_tracebacks(filepath: str) -> list[str]:
  """Extract complete Python tracebacks from a log file."""
  tracebacks = []
  current = []
  in_traceback = False

  with open(filepath) as f:
    for line in f:
      if "Traceback (most recent call last):" in line:
        in_traceback = True
        current = [line]
      elif in_traceback:
        current.append(line)
        # Traceback ends at a line that starts with a non-space character
        # and is not a "During handling of" continuation
        if not line.startswith((" ", "\t")) and "During handling" not in line:
          tracebacks.append("".join(current))
          current = []
          in_traceback = False

  return tracebacks
```

### Agent Reasoning Blocks

Agent frameworks often emit multi-line reasoning blocks delimited by markers. Claude
Code emits tool use blocks; LangChain emits chain-of-thought blocks. A common pattern
uses XML-style delimiters:

```
[2026-03-04T08:30:00Z] [session=abc-123] <reasoning>
The user asked for a file listing. I need to use the bash tool
to run ls -la in the project directory. Checking if the path
exists first.
</reasoning>
[2026-03-04T08:30:01Z] [session=abc-123] tool_call=bash command="ls -la /project"
```

**Python parser for delimited blocks:**

```python
import re

def extract_blocks(filepath: str, open_tag: str, close_tag: str) -> list[dict]:
  """Extract multi-line blocks between open/close tags."""
  blocks = []
  current_lines = []
  in_block = False
  block_start_line = 0

  with open(filepath) as f:
    for lineno, line in enumerate(f, 1):
      if open_tag in line:
        in_block = True
        block_start_line = lineno
        current_lines = [line]
      elif in_block:
        current_lines.append(line)
        if close_tag in line:
          blocks.append({
            "start_line": block_start_line,
            "end_line": lineno,
            "content": "".join(current_lines),
          })
          current_lines = []
          in_block = False

  return blocks

reasoning_blocks = extract_blocks("agent.log", "<reasoning>", "</reasoning>")
```

### The Real Project Example: Catch-Log Notes Field

The project's `catch-log.tsv` has a `notes` field that contains extended descriptions -
sometimes over 100 words. In TSV format, these remain on a single line (tabs and
newlines would break the format), but they require text analysis, not simple column
extraction.

```python
import pandas as pd

catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")

# The notes field is where the operational narrative lives
for _, row in catches.iterrows():
  word_count = len(row["notes"].split())
  if word_count > 30:
    print(f"[{row['date']}] {row['control']}: {word_count} words")
```

This shows which control firings produced the most detailed analysis - a proxy for
which events required the most investigation.

> **AGENTIC GROUNDING:** Multi-line log records are where automated parsing tools fail
> silently. An agent told to "count the errors in this log" will count lines matching
> an error pattern, but a stack trace spanning 20 lines is one error, not 20. A
> reasoning block spanning 10 lines is one thought, not 10 log entries. The stateful
> parser distinguishes records from lines. If your analysis tool does not handle
> multi-line records, your error counts are inflated and your aggregations are wrong.

---

## 6. Log Aggregation in DuckDB

*Estimated time: 30 minutes*

When log files grow past what fits comfortably in a pandas DataFrame (roughly 10 million
rows on a 16GB machine), or when you need repeatable queries that a colleague can run
without installing Python dependencies, DuckDB's direct file reading is the answer.

### JSONL to SQL in One Step

DuckDB's `read_json_auto` reads JSONL files directly in SQL, inferring the schema from
the first few thousand rows:

```python
import duckdb

# No loading step - query the file directly
result = duckdb.sql("""
  SELECT
    model,
    COUNT(*) AS total,
    SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) AS errors,
    ROUND(AVG(latency_ms), 1) AS avg_latency,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 1) AS p95_latency
  FROM read_json_auto('api_calls.jsonl')
  GROUP BY model
  ORDER BY total DESC
""").fetchdf()
```

For newline-delimited JSON, `read_json_auto` auto-detects the format. If it does not,
force it:

```python
duckdb.sql("""
  SELECT * FROM read_json_auto('api_calls.jsonl', format='newline_delimited')
""")
```

### Loading the Project's Real Data

The project's `events.yaml` and `catch-log.tsv` require different loading strategies.
TSV loads directly. YAML needs a Python preprocessing step.

```python
import yaml
import pandas as pd
import duckdb

# TSV - DuckDB reads it directly
catches = duckdb.sql("""
  SELECT * FROM read_csv_auto(
    'docs/internal/weaver/catch-log.tsv',
    delim='\t'
  )
""").fetchdf()

# YAML - load via Python, then query via DuckDB
with open("docs/internal/events.yaml") as f:
  events_raw = yaml.safe_load(f)

events = pd.DataFrame(events_raw["events"])
events["datetime"] = pd.to_datetime(events["date"] + "T" + events["time"])

# DuckDB can query the pandas DataFrame directly
timeline = duckdb.sql("""
  SELECT
    e.datetime,
    e.type,
    e.agent,
    e.summary,
    c.control,
    c.outcome
  FROM events e
  LEFT JOIN catches c
    ON e.date = c.date
    AND LOWER(e.agent) = c.agent
  ORDER BY e.datetime
""").fetchdf()
```

Note the `LOWER(e.agent)` in the join condition. The events file uses title case
(`Weaver`), the catch-log uses lowercase (`weaver`). This is exactly the kind of
inconsistency that breaks naive joins and that you should test for before trusting
results.

### Window Functions for Log Analysis

Window functions let you compute running totals, ranks, and differences between
consecutive rows - operations that are essential for log analysis but awkward in pandas.

```python
import duckdb

# Time between consecutive API calls (inter-arrival time)
iat = duckdb.sql("""
  SELECT
    ts,
    model,
    latency_ms,
    ts - LAG(ts) OVER (ORDER BY ts) AS time_since_prev,
    latency_ms - LAG(latency_ms) OVER (PARTITION BY model ORDER BY ts) AS latency_delta
  FROM read_json_auto('api_calls.jsonl')
  ORDER BY ts
  LIMIT 20
""").fetchdf()
```

### Creating Persistent Analytical Tables

For repeated analysis, materialize the parsed logs into a DuckDB database:

```python
import duckdb

con = duckdb.connect("logs.db")

con.sql("""
  CREATE TABLE IF NOT EXISTS api_calls AS
  SELECT
    CAST(ts AS TIMESTAMP) AS ts,
    endpoint,
    model,
    status,
    latency_ms,
    tokens_in,
    tokens_out,
    CASE
      WHEN status < 400 THEN 'success'
      WHEN status = 429 THEN 'rate_limit'
      WHEN status < 500 THEN 'client_error'
      ELSE 'server_error'
    END AS error_class
  FROM read_json_auto('api_calls.jsonl')
""")

# Now query the materialized table - no re-parsing on each query
con.sql("SELECT error_class, COUNT(*) FROM api_calls GROUP BY 1").fetchdf()
con.close()
```

> **AGENTIC GROUNDING:** In the project's operational workflow, the catch-log.tsv and
> events.yaml are small enough to inspect manually. But the patterns shown here -
> direct file reading, case-normalized joins, materialized analytical tables - are the
> same patterns you would use when these logs grow to thousands of entries across months
> of operation. The DuckDB query that joins events to catch-log entries is a reusable
> artifact: save it as a `.sql` file, version it, run it whenever you need the timeline.

> **HISTORY:** DuckDB was created by Mark Raasveldt and Hannes Muhleisen at CWI
> Amsterdam in 2018. It brought OLAP database capabilities into an embeddable library
> with zero external dependencies - the SQLite philosophy applied to analytical queries.
> Before DuckDB, the gap between "grep a log file" and "load into a data warehouse" had
> no good middle ground. DuckDB filled that gap: analytical SQL on local files, no server,
> no setup, no data movement.

---

## 7. Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: Unified Timeline from Real Project Data

**Estimated time: 20 minutes**

**Goal:** Parse the project's `catch-log.tsv` and `events.yaml` into a single
chronologically ordered timeline. For each event, determine whether a catch-log entry
exists on the same date.

1. Load both files:

```python
import yaml
import pandas as pd

catches = pd.read_csv("docs/internal/weaver/catch-log.tsv", sep="\t")
catches["date"] = pd.to_datetime(catches["date"])

with open("docs/internal/events.yaml") as f:
  raw = yaml.safe_load(f)
events = pd.DataFrame(raw["events"])
events["datetime"] = pd.to_datetime(events["date"] + "T" + events["time"])
```

2. For each event, check whether a catch-log entry exists on the same date. Use a
   left merge on the date field.

3. Produce a table with columns: `datetime`, `event_type`, `event_summary`,
   `has_catch_entry` (boolean), `catch_control` (from catch-log, if matched).

4. Sort by datetime and print.

**Verification:** The 2026-03-04 events should match multiple catch-log entries. The
2026-03-05 `decision` event should match the `the-lullaby` catch-log entry. The agent
name casing difference (`Weaver` vs `weaver`) must be handled.

<details>
<summary>Hints</summary>

- Normalize agent case before joining: `events["agent_lower"] = events["agent"].str.lower()`
- The catch-log has no time field, so you can only join on date, not datetime
- Use `how="left"` on the merge so events without catch entries still appear
- One event may match multiple catch-log entries (2026-03-04 has 8 catch entries)

</details>

**Extension:** Rewrite the same analysis as a single DuckDB SQL query that reads both
files and produces the timeline.

---

## Challenge: API Log Summary Report

**Estimated time: 20 minutes**

**Goal:** Given the simulated API call JSONL log, produce a one-page operational summary.

1. Run the `generate_api_logs` function from Section 3 to create `api_calls.jsonl`.

2. Compute and print these metrics:
   - Total requests
   - Requests per minute (mean)
   - Error rate (% of requests with status >= 400)
   - Median latency (overall and per model)
   - p95 and p99 latency (overall and per model)
   - Tokens per successful request (mean tokens_in, mean tokens_out)
   - Top 3 error status codes with counts

3. Format the output as a readable text report, not raw DataFrame output.

**Verification:** Error rate should be approximately 15% (the generator weights 85%
success). Rate limit (429) should be the most common error type. Server errors (5xx)
should have the highest latency.

<details>
<summary>Hints</summary>

- Use `df.describe(percentiles=[0.5, 0.95, 0.99])` for quick percentile overview
- Filter to `status == 200` before computing token statistics
- For requests per minute: total requests divided by the time span in minutes
- `(df["ts"].max() - df["ts"].min()).total_seconds() / 60` gives the span in minutes

</details>

**Extension:** Produce the same report using only DuckDB SQL (no pandas). Write a
single query that outputs all metrics.

---

## Challenge: Session Success Rate by Agent

**Estimated time: 20 minutes**

**Goal:** Reconstruct agent sessions from the simulated session log and compute the
success rate per agent role.

1. Run the `generate_sessions` function from Section 2 to create `sessions.jsonl`.

2. Define a session as "failed" if it contains at least one `error` or `timeout` outcome.
   Define it as "successful" if all outcomes are `success`.

3. Compute per-agent:
   - Total sessions
   - Failed sessions
   - Success rate (%)
   - Mean session duration (sum of all call durations within the session)
   - Mean tool calls per session

4. Print a summary table sorted by success rate (ascending - worst agents first).

**Verification:** With `random.seed(42)`, results should be deterministic. All four
agents should have comparable success rates (the generator assigns errors uniformly).
Success rate should be roughly 40-50% (each call has a 1/6 chance of error or timeout,
and sessions have 2-12 calls).

<details>
<summary>Hints</summary>

- Group by `session_id` first, then group the session summaries by `agent`
- A session is "failed" if `(outcome == "error").any() or (outcome == "timeout").any()`
- For the two-level groupby, compute session-level metrics first, then aggregate

</details>

---

## Challenge: Log Health Dashboard Script

**Estimated time: 20 minutes**

**Goal:** Write a Python script that reads any JSONL log file with a `ts` and `status`
field, and outputs a health dashboard to stdout.

The dashboard must include:

- Total lines
- Date range (first timestamp to last timestamp)
- Error count and error rate
- Top 5 error messages (or status codes) with counts
- Hourly request volume (as a text-based bar chart)

```python
#!/usr/bin/env python3
"""Log health dashboard - reads JSONL, prints operational summary."""
import sys
import pandas as pd

def dashboard(path: str):
  df = pd.read_json(path, lines=True)
  df["ts"] = pd.to_datetime(df["ts"], format="ISO8601")

  # Your implementation here
  # ...

if __name__ == "__main__":
  if len(sys.argv) != 2:
    print(f"Usage: {sys.argv[0]} <logfile.jsonl>", file=sys.stderr)
    sys.exit(1)
  dashboard(sys.argv[1])
```

**Verification:** Run it against `api_calls.jsonl`. The output should show approximately
5000 total lines, ~15% error rate, and a roughly uniform hourly distribution (the
generator distributes requests evenly across 24 hours).

**Extension:** Add a text-based bar chart for hourly volume. Use `printf`-style
formatting to produce fixed-width bars:

```python
def text_bar(value: int, max_value: int, width: int = 40) -> str:
  bar_len = int(value / max_value * width)
  return "#" * bar_len
```

> **AGENTIC GROUNDING:** A log health dashboard is the first thing you build when
> inheriting an agent system. Before analyzing specific failures, you need the vital
> signs: is the system producing logs? How many errors? Is volume consistent? This
> script is a reusable diagnostic tool - save it, version it, run it daily. An agent
> can generate this script, but it cannot judge whether the numbers it produces are
> alarming. That judgment is the Operator's job.

---

## Key Takeaways

Before moving to the next step, verify you can answer these questions without looking
anything up:

1. What is JSONL, and how does it differ from a JSON array? Why does it matter for log
   analysis? (One record per line means you can use line-oriented tools like grep and wc.)

2. What regex pattern extracts key=value pairs from structured log lines, handling both
   quoted and unquoted values?

3. Why is session reconstruction a stateful problem that grep cannot solve? (You need to
   group multiple lines by session ID and compute aggregate metrics per group.)

4. What is the difference between error count and error rate? Why does the rate matter
   more? (Rate includes the denominator - total requests - and can be tracked over time
   windows to detect trends.)

5. Why is mean latency misleading? What percentiles should you report instead? (p50 for
   typical experience, p95 for most users, p99 for worst case.)

6. What is the three-tool escalation pattern for log analysis, and when do you use each
   level? (grep for quick check, pandas for exploration, DuckDB for repeatable queries
   at scale.)

7. How do you handle the case normalization problem when joining data from different
   sources? (Normalize before joining: `LOWER()` in SQL, `.str.lower()` in pandas.)

8. Why do multi-line log records (stack traces, reasoning blocks) break naive line-counting
   approaches? (One logical record spans multiple lines; counting lines overcounts records.)

---

## Recommended Reading

- **Designing Data-Intensive Applications** - Martin Kleppmann (2017). Chapter 10
  (Batch Processing) covers the log-as-data-source pattern. Chapter 11 (Stream
  Processing) covers windowed aggregation on event streams.

- **The Art of Monitoring** - James Turnbull (2016). Chapters on log aggregation and
  metric computation. Covers the operational context for why percentiles matter more
  than averages.

- **DuckDB Documentation: Reading JSON Files** -
  `https://duckdb.org/docs/data/json/overview` - the canonical reference for
  `read_json_auto` parameters, JSONL support, and schema inference behavior.

- **pandas User Guide: Time Series / Date Functionality** -
  `https://pandas.pydata.org/docs/user_guide/timeseries.html` - covers `resample`,
  `rolling`, and `DatetimeIndex` operations used throughout this step.

---

## What to Read Next

**Step 8: Anomaly Detection and Alerting** - Step 7 gave you the metrics: error rates,
latency percentiles, session success rates. Step 8 covers what happens when those
metrics cross a threshold. It introduces statistical anomaly detection (z-scores, IQR
methods, rolling deviation) and the alerting patterns that connect metrics to human
attention. The error rate trend analysis from Section 3 becomes the input to an
alerting rule. The latency percentile tables from Section 4 become the baseline for
detecting performance regressions. The tools remain the same (pandas, DuckDB); the
questions shift from "what happened?" to "is this normal?"

