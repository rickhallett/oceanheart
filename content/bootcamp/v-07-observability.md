+++
title = "Agent Observability and Tracing"
date = "2026-03-10"
description = "Traces, spans, structured logging. OpenTelemetry for LLM. Custom tracing. Alert fatigue."
tags = ["observability", "tracing", "monitoring", "bootcamp"]
step = 7
tier = 3
estimate = "4-5 hours"
bootcamp = 5
+++

Step 7 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

## Why This is Step 7

In Bootcamp I Step 8, you learned to observe processes at the operating system level.
`strace` showed you the exact sequence of syscalls a process made. `lsof` showed you
every file descriptor held open. `ss` showed you every network socket. These tools work
because the kernel does not lie - it records what actually happened at the boundary
between userspace and the operating system.

Agent systems need the same thing, one layer up.

When an agent fails silently - returns a plausible but wrong answer, takes 50 tool calls
instead of 5, burns through your token budget in a single session, or gets stuck in a
loop calling the same function repeatedly - you need to see what happened. Not what the
agent claimed to do. Not what the logs from your application framework show. What the
agent actually did: which model calls it made, what it sent in each prompt, what it
received back, which tools it called, what those tools returned, and how it decided
what to do next.

Traditional application performance monitoring (APM) tracks latency, error rates, and
throughput. These metrics matter for agent systems too, but they are not sufficient. An
agent that completes in 3 seconds with no errors may still have produced a wrong answer
because it retrieved the wrong documents, misinterpreted a tool result, or drifted from
its instructions midway through a multi-step task. Traditional APM would show a green
dashboard. The user would see a wrong answer.

Agent observability tracks decisions. Every step in an agent's execution is a decision
point: what to do next, which tool to call, what arguments to pass, how to interpret the
result. The trace is the structured record of these decisions. It is to agent debugging
what the stack trace is to traditional debugging and what `strace` output is to process
debugging.

This step exists at position 7 because it requires the foundational material from Steps
1-6. You need to understand retrieval (Step 1) to recognize when the wrong documents
were fetched. You need to understand tool use (Step 5) to interpret tool call traces.
You need to understand multi-step agents (Step 6) to follow a trace through multiple
reasoning steps. Observability without this foundation is a dashboard of numbers you
cannot interpret.

By the end of this step, you will be able to instrument an agent system to produce
structured traces, query those traces for diagnostic information, evaluate tracing
frameworks against your requirements, and build alerts that detect common failure
patterns before they reach users.

---

## Table of Contents

1. [Why Agent Observability is Different](#1-why-agent-observability-is-different) (~25 min)
2. [The Trace](#2-the-trace) (~30 min)
3. [Custom Tracing with JSONL](#3-custom-tracing-with-jsonl) (~45 min)
4. [Tracing Frameworks - Landscape Assessment](#4-tracing-frameworks---landscape-assessment) (~35 min)
5. [The Pitkeel Model - A Case Study in Custom Observability](#5-the-pitkeel-model---a-case-study-in-custom-observability) (~35 min)
6. [Metrics That Matter](#6-metrics-that-matter) (~30 min)
7. [Alerting](#7-alerting) (~30 min)
8. [Challenges](#challenges) (~60-90 min)
9. [Key Takeaways](#key-takeaways)
10. [Recommended Reading](#recommended-reading)
11. [What to Read Next](#what-to-read-next)

---

## Tool Setup

*This section covers installation and verification. Skip tools you already have.*

### Required

```bash
# DuckDB for trace analysis (cross-reference: Bootcamp III Step 3)
uv pip install duckdb

# Verify
python3 -c "import duckdb; print(f'DuckDB {duckdb.__version__}')"
```

```bash
# Standard library modules used in this step (no installation needed):
# json, datetime, time, uuid, pathlib
# Verify Python version
python3 -c "import sys; assert sys.version_info >= (3, 10), 'Python 3.10+ required'; print(f'Python {sys.version}')"
```

### Minimal Agent Scaffold (if you do not have a working agent from Step 6)

The exercises in this step require a running agent to instrument. If you completed
Step 6, use that agent. If not, this minimal scaffold simulates a multi-step agent
with tool calls:

```python
# agent_scaffold.py - Minimal agent for observability exercises
# This simulates an agent without requiring an LLM API key.

import random
import time

TOOLS = {
  "search": lambda q: {"results": [f"Result for '{q}'"], "count": 1},
  "read_file": lambda path: {"content": f"Contents of {path}", "lines": 42},
  "write_file": lambda path: {"status": "written", "path": path},
  "calculate": lambda expr: {"result": eval(expr, {"__builtins__": {}}, {})},
}

def simulate_agent_step(step_num, task):
  """Simulate one agent step: pick a tool, call it, return result."""
  tool_name = random.choice(list(TOOLS.keys()))
  args = {
    "search": "project documentation",
    "read_file": "/tmp/config.yaml",
    "write_file": "/tmp/output.txt",
    "calculate": "2 + 2",
  }[tool_name]

  start = time.monotonic()
  result = TOOLS[tool_name](args)
  latency = time.monotonic() - start

  # Simulate token usage
  input_tokens = random.randint(500, 2000)
  output_tokens = random.randint(100, 800)

  return {
    "step": step_num,
    "tool": tool_name,
    "args": args,
    "result": result,
    "input_tokens": input_tokens,
    "output_tokens": output_tokens,
    "latency_ms": round(latency * 1000, 2),
  }

def run_agent(task, max_steps=5):
  """Run the simulated agent for N steps."""
  steps = []
  for i in range(1, max_steps + 1):
    step = simulate_agent_step(i, task)
    steps.append(step)
    if random.random() < 0.1:  # 10% chance of early completion
      break
  return steps
```

Save this file and verify it runs:

```bash
python3 -c "
from agent_scaffold import run_agent
steps = run_agent('find and summarize documentation')
for s in steps:
  print(f'Step {s[\"step\"]}: {s[\"tool\"]}({s[\"args\"]}) -> {s[\"input_tokens\"]}+{s[\"output_tokens\"]} tokens')
"
```

### Optional: Arize Phoenix (for framework comparison exercise)

```bash
# Open-source observability platform (optional, for Challenge 2)
uv pip install arize-phoenix

# Verify
python3 -c "import phoenix; print('Phoenix installed')"
```

Phoenix is optional. Challenge 2 provides a fallback comparison method that does not
require it.

---

## 1. Why Agent Observability is Different

*Estimated time: 25 minutes*

Traditional software observability answers the question: "is the system healthy?" Agent
observability answers a different question: "did the agent make good decisions?"

This distinction is not cosmetic. It changes what you instrument, what you record, and
what you query.

### 1.1 The four properties that make agents different

**Non-deterministic outputs.** A traditional web server given the same HTTP request
produces the same response. An LLM given the same prompt can produce different outputs
on every call. Even with temperature set to 0, providers do not guarantee deterministic
responses across calls made at different times or routed to different hardware. This
means you cannot reproduce a bug by replaying inputs. You can only reconstruct what
happened by reading the trace.

**Multi-step reasoning.** A single user request to an agent may produce 5, 20, or 100
LLM calls, each feeding into the next. Traditional APM models one request as one span
with child spans for database queries and external API calls. Agent observability models
one request as a tree of reasoning steps, where the output of step N determines the
input of step N+1 in ways that are not predictable at instrumentation time.

**Tool interactions as side effects.** Every tool call an agent makes is a side effect.
An agent that calls `write_file` has changed the world. An agent that calls `search`
has consumed tokens that cost money. These side effects are not visible in the LLM's
response - they happen between LLM calls, mediated by the agent harness. If you only
trace the LLM calls, you miss half the story.

**Context state evolution.** The context window changes with every step. Tokens
accumulate. Tool results are injected. System prompts are prepended. The model at step
15 is reasoning over a fundamentally different input than at step 1, even though it is
the same model with the same weights. Context window utilization - how much of the
budget is consumed and what is in it - is an observable that traditional APM does not
have an analogue for.

### 1.2 The strace analogy

In Bootcamp I Step 8, you learned that `strace` shows you what a process actually does
at the kernel boundary. The agent trace serves the same function at the agent boundary:

| OS-level (strace) | Agent-level (trace) |
|-------------------|---------------------|
| `openat("/etc/config", O_RDONLY) = 3` | `tool_call("read_file", {path: "/etc/config"})` |
| `write(1, "hello\n", 6) = 6` | `model_output("Based on the config, the answer is...")` |
| `connect(3, {sa_family=AF_INET, sin_port=htons(443)}) = 0` | `api_call("anthropic", {model: "claude-sonnet-4-20250514", tokens: 2048})` |
| `clone(child_stack=...) = 1235` | `spawn_subagent("researcher", {task: "find documents"})` |
| Return values and errno codes | Token counts, latency, finish reasons |

The structural parallel is exact. `strace` intercepts the boundary between userspace
and kernel. The agent trace intercepts the boundary between the agent harness and the
LLM provider. Both show you what actually happened, not what the program claimed
happened.

The difference: `strace` output is deterministic - the same program with the same input
produces the same syscalls. Agent traces are not - the same agent with the same task may
produce different tool call sequences on every run. This makes traces more important for
agents than for traditional programs. You cannot reproduce the failure; you can only
analyze the trace from when it happened.

### 1.3 What traditional APM misses

A production agent system monitored with standard APM (Datadog, New Relic, Grafana)
will show you:

- HTTP request latency (p50, p95, p99)
- Error rate (4xx, 5xx responses)
- Throughput (requests per second)
- Database query duration

These are necessary but not sufficient. They will not tell you:

- That the agent retrieved 5 documents but only 2 were relevant
- That the agent called the same tool 8 times because it kept getting parsing errors
- That the agent used 45,000 tokens for a task that should have taken 5,000
- That the agent's final answer contradicted information from its second tool call
- That the context window was 92% full when the agent made its critical decision

Agent observability adds a layer on top of traditional APM. It does not replace it.
You still need latency and error rate monitoring. You also need decision tracing.

> **AGENTIC GROUNDING:** Consider a coding agent asked to fix a bug. Traditional APM
> shows the request completed in 12 seconds with no errors. The agent trace shows: the
> agent read the wrong file (tool call 1), generated a fix for code that does not exist
> in that file (model output 2), tried to apply the fix (tool call 3), got a "file not
> found" error (tool result 3), read a different file (tool call 4), generated a new fix
> (model output 5), and applied it successfully (tool call 6). The bug is still there -
> the agent fixed something else. APM says success. The trace says failure. Only one is
> correct.

> **FIELD VS NOVEL:** Traditional observability (Honeycomb, Datadog, the "three pillars"
> of logs/metrics/traces) is well-established and documented extensively by Charity
> Majors, Ben Sigelman, and the OpenTelemetry community. The application of
> observability to agent systems is emerging - tools exist (LangSmith, Phoenix, Braintrust)
> but conventions are still forming. The specific framing of agent traces as the analogue
> of `strace` output, and context window utilization as an observable, comes from this
> project's operational experience. The layer model (L5 API as the only calibrated layer,
> L3 context as an un-introspectable state) provides the theoretical backing: you can
> measure token counts exactly because L5 is calibrated, but you cannot measure context
> quality because L3 is opaque to the model.

---

## 2. The Trace

*Estimated time: 30 minutes*

A trace is a structured record of an agent's execution path. It captures enough
information to reconstruct what the agent did, why it made each decision, and where
things went right or wrong.

### 2.1 Trace structure

The fundamental unit of a trace is the **step**. Each step records one action the agent
took:

```
Step 1: [model] Received task, decided to search for documentation
Step 2: [tool]  Called search("project architecture") -> 3 results
Step 3: [model] Read search results, decided to read the top result
Step 4: [tool]  Called read_file("AGENTS.md") -> 2,100 lines
Step 5: [model] Extracted relevant sections, formulated answer
Step 6: [output] Returned final answer to user
```

Each step has a type (model call, tool call, output) and associated metadata. The
minimum useful metadata per step:

| Field | Type | Purpose |
|-------|------|---------|
| `session_id` | string | Groups steps belonging to the same agent run |
| `step_number` | integer | Ordering within the session |
| `timestamp` | ISO 8601 | When the step occurred |
| `action_type` | enum | `model_call`, `tool_call`, `tool_result`, `output` |
| `input_tokens` | integer | Tokens sent to the model (for model calls) |
| `output_tokens` | integer | Tokens received from the model |
| `latency_ms` | float | Wall-clock time for this step |
| `tool_name` | string | Which tool was called (for tool calls) |
| `tool_args` | object | Arguments passed to the tool |
| `error` | string or null | Error message if the step failed |

This is the minimum. A production trace may include additional fields: model name,
temperature, finish reason, token budget remaining, context window utilization, the
full prompt sent, the full response received. Each additional field adds diagnostic
power and storage cost.

### 2.2 Spans and parent-child relationships

OpenTelemetry uses the concept of a **span** - a named, timed operation that can
contain child spans. Agent traces map naturally to this model:

```
Span: agent_run (session_id=abc123, duration=8200ms)
  Span: reasoning_step_1 (type=model_call, tokens_in=1200, tokens_out=150)
  Span: tool_call_1 (type=tool, name=search, latency=340ms)
  Span: reasoning_step_2 (type=model_call, tokens_in=2800, tokens_out=200)
  Span: tool_call_2 (type=tool, name=read_file, latency=12ms)
  Span: reasoning_step_3 (type=model_call, tokens_in=4500, tokens_out=350)
  Span: output (type=final_response, tokens_out=350)
```

The parent span (`agent_run`) contains the entire execution. Child spans represent
individual steps. This hierarchy enables two kinds of queries:

1. **Run-level queries:** "How long did this agent run take? How many tokens did it
   consume total? Did it succeed or fail?"
2. **Step-level queries:** "Which step took the longest? Where did the token budget
   spike? Which tool call returned an error?"

For multi-agent systems (where one agent spawns sub-agents), the span hierarchy adds
another level:

```
Span: orchestrator (session_id=abc123)
  Span: sub_agent_researcher (session_id=def456)
    Span: tool_call: search(...)
    Span: model_call: analyze results
  Span: sub_agent_writer (session_id=ghi789)
    Span: model_call: draft response
    Span: tool_call: format_output(...)
```

This is structurally identical to distributed tracing in microservices, where a request
propagates through multiple services. The concepts transfer directly. The difference is
that in microservices, each service is deterministic; in multi-agent systems, each agent
is not.

### 2.3 What a good trace captures

A good trace captures enough to replay the agent's decision-making process in your head.
You should be able to read the trace and say: "At step 3, the agent had this information
available, and it chose to call this tool with these arguments, because the model's
output at step 2 directed it there."

Specifically, a good trace captures:

- **Token counts per step.** These are the only fully calibrated observable in the
  system (L5 API layer). They come directly from the provider's response headers.
  They are exact, not estimated.

- **Latency per step.** Wall-clock time from request to response. This tells you where
  time is being spent: in the model, in tool execution, or in network overhead.

- **Tool call arguments and results.** The full arguments sent to each tool and the full
  result returned. Without this, you cannot diagnose tool-related failures.

- **Error information.** Not just "error occurred" but the full error message, the step
  that caused it, and whether the agent recovered.

- **The decision.** What the model chose to do at each step. This is the hardest to
  capture because it requires logging either the full model output or a summary of the
  model's reasoning. For models that support reasoning tokens (extended thinking), the
  reasoning content itself is a trace of the decision process.

### 2.4 What a bad trace misses

Common tracing failures, each of which produces a diagnostic blind spot:

**Missing token counts.** If you do not record input_tokens and output_tokens per step,
you cannot calculate token efficiency, detect context window pressure, or diagnose
budget overruns. Token counts are free - every LLM API returns them in the response.
Not recording them is throwing away calibrated data.

**Missing latency.** If you do not record wall-clock time per step, you cannot identify
bottlenecks. Was the agent slow because the model took 4 seconds to respond, or because
the tool call hit a 30-second timeout?

**Aggregated-only recording.** Some tracing approaches record only the total token count
and total latency for an entire run. This is useless for diagnosis. If a 20-step run used
30,000 tokens, you need to know which steps consumed the most. Per-step recording is the
minimum.

**Missing tool results.** Recording that the agent called `search("bug fix")` but not
what the search returned makes it impossible to diagnose retrieval failures. The tool
result is the input to the next model call - it is load-bearing information.

**No error context.** Recording `error: true` without the error message, the step that
caused it, or the state at the time of failure. This is the agent equivalent of a log
line that says `ERROR: something went wrong` - technically accurate, diagnostically
useless.

> **SLOPODAR:** The **phantom ledger** pattern from the project's anti-pattern taxonomy
> applies directly to tracing: "The LLM builds a correct operation but records a
> different value in the audit trail." A trace that records step counts and token totals
> but not the actual tool call arguments and results is a phantom ledger. The numbers
> look plausible, but when you need to diagnose a failure, the trace does not contain
> the information you need. The audit trail does not match the actual operation.

> **AGENTIC GROUNDING:** When an agent produces a subtly wrong answer and the user
> reports it three days later, the trace is your only evidence. If the trace captured
> per-step token counts and tool results, you can reconstruct: the agent retrieved
> document X at step 3, which contained outdated information, and the model generated
> from that outdated context. Without per-step data, you know the agent ran, you know it
> was wrong, but you cannot determine why. The diagnostic gap between "it failed" and
> "here is why it failed" is the gap between a useless trace and a useful one.

---

## 3. Custom Tracing with JSONL

*Estimated time: 45 minutes*

Before reaching for a framework, build tracing from scratch. This serves two purposes:
you understand exactly what the framework abstracts, and you have a fallback for when
frameworks are overkill or introduce unwanted coupling.

### 3.1 Why JSONL

JSON Lines (JSONL) is the natural format for agent traces. Each line is a valid JSON
object. Each object represents one trace event. The format has three properties that
matter:

1. **Append-only.** Writing a new event means appending a line. No need to parse the
   existing file, update a data structure, and re-serialize. This is the same property
   that makes write-ahead logs (WAL) reliable in databases.

2. **Streamable.** You can read events as they are written, line by line. No need to wait
   for the file to be complete. This enables live monitoring of agent runs.

3. **Queryable.** DuckDB, jq, Python, and every data processing tool can read JSONL
   natively. No custom parser needed.

The JSONL specification (jsonlines.org) is minimal: UTF-8 encoding, one JSON value per
line, newline-separated. It is stable and will not change.

### 3.2 Trace schema

Here is a concrete schema for agent trace events. Every field is motivated by a specific
diagnostic need:

```python
# trace_schema.py - Agent trace event schema

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any
import json
import uuid


@dataclass
class TraceEvent:
  """One step in an agent's execution trace."""

  # Identity
  session_id: str = ""           # Groups events from one agent run
  trace_id: str = ""             # Unique ID for this event
  step: int = 0                  # Sequential step number within session

  # Timing
  timestamp: str = ""            # ISO 8601 with timezone
  latency_ms: float = 0.0       # Wall-clock time for this step

  # Action
  action_type: str = ""          # model_call, tool_call, tool_result, output, error
  model: str = ""                # Model identifier (for model_call events)

  # Token usage (from API response - L5 calibrated data)
  input_tokens: int = 0          # Tokens sent to the model
  output_tokens: int = 0         # Tokens received from the model
  total_tokens: int = 0          # input + output (convenience field)
  cache_read_tokens: int = 0     # Tokens served from cache (if applicable)

  # Tool interaction
  tool_name: str = ""            # Tool called (for tool_call events)
  tool_args: dict = field(default_factory=dict)   # Arguments passed
  tool_result: Any = None        # Result returned (for tool_result events)

  # Error handling
  error: str | None = None       # Error message if step failed
  error_type: str | None = None  # Error classification (timeout, parse, auth, etc.)

  # Context state
  context_tokens: int = 0        # Estimated context window usage at this step
  context_pct: float = 0.0       # context_tokens / max_context_tokens

  def to_jsonl(self) -> str:
    """Serialize to a single JSON line."""
    d = asdict(self)
    # Remove None values to keep lines compact
    d = {k: v for k, v in d.items() if v is not None and v != "" and v != 0 and v != 0.0}
    return json.dumps(d, separators=(",", ":"), default=str)

  @classmethod
  def create(cls, session_id: str, step: int, action_type: str, **kwargs) -> "TraceEvent":
    """Factory method with automatic timestamp and trace_id."""
    return cls(
      session_id=session_id,
      trace_id=str(uuid.uuid4())[:8],
      step=step,
      timestamp=datetime.now(timezone.utc).isoformat(),
      action_type=action_type,
      **kwargs,
    )
```

### 3.3 The trace writer

A trace writer appends events to a JSONL file. The implementation is intentionally
simple - complexity in the tracing layer is complexity that can fail silently:

```python
# trace_writer.py - Append-only JSONL trace writer

import os
from pathlib import Path
from trace_schema import TraceEvent


class TraceWriter:
  """Writes trace events to a JSONL file. One line per event."""

  def __init__(self, path: str | Path):
    self.path = Path(path)
    self.path.parent.mkdir(parents=True, exist_ok=True)
    self._fd = open(self.path, "a", encoding="utf-8")

  def write(self, event: TraceEvent) -> None:
    """Append one trace event. Flushes immediately."""
    line = event.to_jsonl()
    self._fd.write(line + "\n")
    self._fd.flush()  # Ensure the event is on disk, not in a buffer

  def close(self) -> None:
    self._fd.close()

  def __enter__(self):
    return self

  def __exit__(self, *args):
    self.close()
```

Two design choices to note:

1. **Immediate flush.** `self._fd.flush()` after every write ensures that if the agent
   crashes, all events written up to that point are on disk. This is the same reason
   databases flush their WAL entries before acknowledging a write. For agent tracing,
   the crash scenario is not a system crash - it is context window death, a provider
   timeout, or an uncaught exception in a tool call.

2. **Append mode.** Opening with `"a"` means multiple agent runs can write to the same
   file without overwriting. Each run's events are interleaved chronologically, grouped
   by `session_id`. This is a deliberate choice - a single trace file containing many
   runs is easier to analyze with DuckDB than many single-run files.

### 3.4 Instrumenting an agent

Here is the instrumentation pattern. Wrap each model call and tool call with trace
events:

```python
# instrumented_agent.py - Agent with JSONL tracing

import time
import uuid
from trace_schema import TraceEvent
from trace_writer import TraceWriter


def run_traced_agent(task: str, trace_path: str = "traces/agent.jsonl"):
  """Run an agent with full tracing."""
  session_id = str(uuid.uuid4())[:12]
  step = 0
  cumulative_tokens = 0

  with TraceWriter(trace_path) as writer:
    # Step 1: Initial model call - decide what to do
    step += 1
    start = time.monotonic()

    # --- Your actual model call here ---
    # response = client.messages.create(...)
    # For demonstration, using the scaffold:
    from agent_scaffold import simulate_agent_step
    result = simulate_agent_step(step, task)
    # ---

    latency = (time.monotonic() - start) * 1000
    cumulative_tokens += result["input_tokens"] + result["output_tokens"]

    writer.write(TraceEvent.create(
      session_id=session_id,
      step=step,
      action_type="model_call",
      input_tokens=result["input_tokens"],
      output_tokens=result["output_tokens"],
      total_tokens=result["input_tokens"] + result["output_tokens"],
      latency_ms=round(latency, 2),
      context_tokens=cumulative_tokens,
    ))

    # Step 2: Tool call based on model's decision
    step += 1
    start = time.monotonic()
    result = simulate_agent_step(step, task)
    latency = (time.monotonic() - start) * 1000

    writer.write(TraceEvent.create(
      session_id=session_id,
      step=step,
      action_type="tool_call",
      tool_name=result["tool"],
      tool_args={"input": result["args"]},
      latency_ms=round(latency, 2),
    ))

    # Step 3: Tool result
    step += 1
    writer.write(TraceEvent.create(
      session_id=session_id,
      step=step,
      action_type="tool_result",
      tool_name=result["tool"],
      tool_result=result["result"],
    ))

    # Continue for remaining steps...
    for _ in range(3):
      step += 1
      start = time.monotonic()
      result = simulate_agent_step(step, task)
      latency = (time.monotonic() - start) * 1000
      cumulative_tokens += result["input_tokens"] + result["output_tokens"]

      writer.write(TraceEvent.create(
        session_id=session_id,
        step=step,
        action_type="model_call",
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
        total_tokens=result["input_tokens"] + result["output_tokens"],
        latency_ms=round(latency, 2),
        context_tokens=cumulative_tokens,
      ))

  return session_id


if __name__ == "__main__":
  sid = run_traced_agent("find and summarize project documentation")
  printf_msg = f"Traced session: {sid}"
  import sys
  sys.stdout.write(printf_msg + "\n")
```

Run it and inspect the output:

```bash
python3 instrumented_agent.py

# View the raw trace
python3 -c "
from pathlib import Path
for line in Path('traces/agent.jsonl').read_text().strip().split('\n'):
  print(line)
"
```

Each line is a self-contained JSON object. No line depends on any other line. You can
`grep` for a session_id, `sort` by timestamp, or load the entire file into DuckDB.

### 3.5 Querying traces with DuckDB

DuckDB reads JSONL natively. This is where Bootcamp III Step 3 (SQL analytics) connects
directly:

```python
# analyze_traces.py - DuckDB analysis of agent traces

import duckdb

db = duckdb.connect()

# Load all traces
db.execute("""
  CREATE TABLE traces AS
  SELECT * FROM read_json('traces/agent.jsonl', auto_detect=true)
""")

# Query 1: Summary per session
print("=== Session summaries ===")
db.execute("""
  SELECT
    session_id,
    COUNT(*) as total_steps,
    SUM(input_tokens) as total_input_tokens,
    SUM(output_tokens) as total_output_tokens,
    SUM(input_tokens + output_tokens) as total_tokens,
    ROUND(SUM(latency_ms), 1) as total_latency_ms,
    COUNT(CASE WHEN error IS NOT NULL THEN 1 END) as error_count
  FROM traces
  GROUP BY session_id
  ORDER BY total_tokens DESC
""").show()

# Query 2: Per-step latency distribution
print("\n=== Latency percentiles (ms) ===")
db.execute("""
  SELECT
    action_type,
    COUNT(*) as count,
    ROUND(AVG(latency_ms), 1) as avg_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms), 1) as p50_ms,
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 1) as p95_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 1) as p99_ms
  FROM traces
  WHERE latency_ms > 0
  GROUP BY action_type
""").show()

# Query 3: Most common tools
print("\n=== Tool usage ===")
db.execute("""
  SELECT
    tool_name,
    COUNT(*) as call_count,
    COUNT(CASE WHEN error IS NOT NULL THEN 1 END) as error_count,
    ROUND(AVG(latency_ms), 1) as avg_latency_ms
  FROM traces
  WHERE tool_name != '' AND tool_name IS NOT NULL
  GROUP BY tool_name
  ORDER BY call_count DESC
""").show()

# Query 4: Token budget progression within a session
print("\n=== Token accumulation (first session) ===")
db.execute("""
  SELECT
    step,
    action_type,
    input_tokens,
    output_tokens,
    context_tokens,
    ROUND(context_tokens * 100.0 / 200000, 1) as context_pct
  FROM traces
  WHERE session_id = (SELECT session_id FROM traces LIMIT 1)
  ORDER BY step
""").show()
```

```bash
python3 analyze_traces.py
```

This is the custom tracing workflow: write JSONL during execution, query with DuckDB
after execution. No framework, no dashboard, no external service. The data is local,
queryable, and version-controllable. You can commit trace files alongside the code
that produced them.

### 3.6 When custom tracing is the right choice

Custom JSONL tracing is appropriate when:

- **Your team is small.** A startup with 2-3 engineers does not need a tracing platform.
  JSONL + DuckDB + a Jupyter notebook provides full diagnostic capability without
  operational overhead.

- **Your needs are specific.** If you need to trace a specific interaction pattern (e.g.,
  context window utilization over time), a general-purpose framework may not support it.
  Custom tracing records exactly what you need.

- **Framework lock-in is a concern.** Every framework has opinions about how traces should
  be structured. Custom JSONL has no opinions - it is raw data. You can always import it
  into a framework later. The reverse is harder.

- **The agent system is simple.** A single-agent system with 5-10 steps per run does not
  need distributed tracing. A JSONL file is sufficient.

Custom tracing is not appropriate when:

- **You need a visual trace viewer.** Frameworks like Phoenix and LangSmith provide
  interactive trace visualization that would take significant effort to build from scratch.

- **You need real-time dashboards.** Custom JSONL is post-mortem by default. Adding
  real-time capabilities means building a streaming pipeline.

- **Your system has many agents across many services.** Distributed tracing requires
  context propagation (passing trace IDs across service boundaries). OpenTelemetry solves
  this; building it yourself is reinventing a solved problem.

> **AGENTIC GROUNDING:** The project you are studying uses custom structured logging
> (events.yaml, catch-log.tsv) rather than a tracing framework. This is not because
> frameworks are bad - it is because the project's observability needs are specific to the
> human-AI interface (session duration, scope drift, context depth distribution) and no
> existing framework measures those things. The decision to build custom is always a
> tradeoff: you get exactly what you need, but you build and maintain it yourself.

> **FIELD VS NOVEL:** JSONL as a logging format is well-established and documented at
> jsonlines.org. DuckDB's JSON support is mature and stable. The novel contribution is
> the specific trace schema designed for agent systems (session_id, step, context_tokens,
> context_pct) and the framing of custom tracing as a deliberate architectural choice
> rather than a stopgap before adopting a framework. The project's events.yaml (an
> append-only YAML event log with backrefs) and catch-log.tsv (a TSV recording when
> governance controls fire) are real examples of custom observability instruments designed
> for a domain no framework covers.

---

## 4. Tracing Frameworks - Landscape Assessment

*Estimated time: 35 minutes*

The agent observability landscape in March 2026 is fragmented. No single tool has
emerged as the standard. This section assesses the major options honestly, marking what
is stable enough to depend on and what will change.

### 4.1 OpenTelemetry GenAI Semantic Conventions

**What it is:** An extension to the OpenTelemetry specification that defines standard
attribute names for LLM and agent spans. Part of the broader OpenTelemetry project,
which is the industry standard for distributed tracing, metrics, and logging.

**Status: Development (not stable).** As of March 2026, the GenAI semantic conventions
are explicitly in "Development" status. The specification version at time of writing is
v1.40.0. This means attribute names can change without notice. Instrumentations built
on older versions (v1.36.0 and prior) are advised not to change their defaults.

**What it defines:**

- Standard span names and attributes for model calls: `gen_ai.request.model`,
  `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.finish_reasons`
- Agent-specific spans (`gen_ai.agent` operations) with attributes for agent name, ID,
  version
- Provider-specific conventions for Anthropic, OpenAI, AWS Bedrock, Azure AI
- Content capture (input/output messages, system instructions) as opt-in to avoid
  logging sensitive data

**What to learn from it:** The conceptual model - spans, attributes, exporters, context
propagation - is stable and transferable. The specific attribute names are not.

**Practical recommendation:** Learn the OpenTelemetry concepts. Use them in your mental
model. Do not hardcode specific GenAI attribute names into production systems - they
will change. Wrap them in an abstraction layer that you can update when the spec
stabilizes.

```python
# Example: OpenTelemetry-style manual instrumentation
# The core SDK (opentelemetry-api, opentelemetry-sdk) is stable.
# The GenAI attribute names are not.

# uv pip install opentelemetry-api opentelemetry-sdk

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

# Setup (stable API)
provider = TracerProvider()
provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("agent-bootcamp")

# Creating spans (stable pattern)
with tracer.start_as_current_span("agent_run") as parent_span:
  parent_span.set_attribute("agent.task", "summarize documentation")

  with tracer.start_as_current_span("model_call") as span:
    # These attribute names MAY change as the GenAI spec evolves:
    span.set_attribute("gen_ai.request.model", "claude-sonnet-4-20250514")
    span.set_attribute("gen_ai.usage.input_tokens", 1500)
    span.set_attribute("gen_ai.usage.output_tokens", 350)
    # ... your actual model call here ...

  with tracer.start_as_current_span("tool_call") as span:
    span.set_attribute("tool.name", "search")
    span.set_attribute("tool.args", "project architecture")
    # ... your actual tool call here ...
```

> **FIELD MATURITY:** OpenTelemetry core (spans, traces, metrics, exporters) is
> production-grade and used by most major technology companies. The GenAI semantic
> conventions are in active development with breaking changes expected. The gap between
> these two maturity levels is the key thing to understand: the architecture is solid,
> the agent-specific vocabulary is still being written.

### 4.2 LangSmith

**What it is:** An observability, evaluation, and deployment platform originally from
the LangChain team. Now positions itself as "framework-agnostic" with integrations for
OpenAI, Anthropic, CrewAI, Vercel AI SDK, Pydantic AI, and others.

**Status:** Actively maintained. Free tier available. HIPAA, SOC 2 Type 2, GDPR
compliant. Self-hosted option exists.

**Strengths:**
- Visual trace viewer with step-by-step message replay
- Integrated evaluation and prompt management
- Broad framework support (no longer LangChain-only)
- Active development and documentation

**Weaknesses:**
- Commercial product with vendor lock-in considerations
- The deepest integration is still with LangChain
- Pricing and features change with product direction
- Self-hosting adds operational complexity

**What to learn from it:** LangSmith is a good reference implementation for what an
agent observability platform should provide: trace visualization, evaluation integration,
prompt versioning, and production monitoring in a single tool. Study its trace viewer UI
to understand what information is useful for debugging, even if you do not use the
product.

### 4.3 Braintrust

**What it is:** An AI observability platform focused on the feedback loop from
instrumentation to evaluation to deployment.

**Status:** Actively maintained. Free tier available.

**Key insight for this bootcamp:** Braintrust's workflow model -
Instrument -> Observe -> Annotate -> Evaluate -> Deploy - explicitly connects
observability to evaluation. This maps directly to the Bootcamp IV -> Bootcamp V
progression: evaluation tells you what went wrong, observability tells you why, and
the loop between them drives improvement.

**Strengths:**
- Strong connection between eval and observability
- Clean workflow model for iterative improvement
- Good documentation of the observe-evaluate-improve cycle

**Weaknesses:**
- Newer entrant, smaller community than LangSmith
- Commercial product with vendor lock-in
- Feature set still evolving

### 4.4 Arize Phoenix

**What it is:** An open-source AI observability platform. 8,800+ GitHub stars as of
March 2026. Built on OpenTelemetry via the OpenInference instrumentation project.

**Status:** Actively maintained, rapid development (7,800+ commits).

**Strengths:**
- Open-source (can run locally, no vendor lock-in)
- Installable via `pip install arize-phoenix`
- Runs locally, in Jupyter notebooks, in Docker, or in the cloud
- Built on OpenTelemetry standard
- Supports many providers and frameworks: OpenAI, Anthropic, LangChain, LlamaIndex,
  DSPy, CrewAI
- Includes evaluation, datasets, experiments, and a prompt playground

**Weaknesses:**
- Large API surface area (many features, steep learning curve for full usage)
- Active development means APIs change frequently
- The full platform can be resource-intensive for simple use cases

**Practical recommendation for this bootcamp:** Phoenix is the strongest candidate for
hands-on exercises because it is open-source and runs locally. Use it for the framework
comparison exercise (Challenge 2). For production, evaluate whether the full platform
is justified or whether custom JSONL + DuckDB meets your needs.

### 4.5 Inspect AI Tracing

**What it is:** Built-in tracing and log viewing in the Inspect AI evaluation framework
(maintained by the UK AI Security Institute).

**Status:** Actively maintained. Part of the evaluation framework covered in
Bootcamp IV.

**Key details:**
- Trace logs are JSONL format, gzip compressed
- Automatically retained for the last 10 evaluations
- Captures model generate() calls, tool calls, subprocess execution, subtask spawns
- `inspect trace anomalies` identifies running/cancelled/errored/timed-out actions
- `inspect trace http` shows all HTTP requests (with `--failed` filter)
- Custom tracing API: `trace_action()` (context manager) and `trace_message()` (events)
- Log Viewer provides message history display, scoring details, filtering, and live view

**The connection to this bootcamp:** If you are using Inspect for evaluation (Bootcamp
IV), you already have tracing. Inspect's log viewer is the best available tool for
step-by-step replay of evaluation runs. The traces it produces are JSONL - the same
format covered in Section 3.

**Weakness:** Inspect tracing is evaluation-focused. It is not designed for production
monitoring of deployed agents. For that, you need one of the other tools or custom
tracing.

### 4.6 Assessment matrix

| Tool | Open Source | Local Install | Stable API | Production Ready | Best For |
|------|-----------|--------------|-----------|-----------------|---------|
| Custom JSONL + DuckDB | Yes | Yes | Yes (you own it) | Yes (simple systems) | Learning, small teams, specific needs |
| OpenTelemetry (core) | Yes | Yes | Yes (core), No (GenAI) | Yes (core) | Standard-based instrumentation |
| Arize Phoenix | Yes | Yes | No (evolving) | Emerging | Open-source visual tracing |
| LangSmith | No | Self-host option | No (commercial) | Yes | Full-featured platform |
| Braintrust | No | No | No (commercial) | Yes | Eval + observability loop |
| Inspect AI | Yes | Yes | Emerging | For eval | Evaluation trace debugging |

The pattern: stable concepts, unstable tools. Learn the concepts (spans, structured
events, per-step recording, context propagation). Choose tools based on your current
needs. Expect to change tools as the field matures.

> **AGENTIC GROUNDING:** An engineering team choosing a tracing framework in 2026 faces
> the same decision pattern as choosing a web framework in 2012 or a container
> orchestration tool in 2016. The concepts are converging (everyone agrees on spans and
> structured events), but the implementations are diverging (every tool has a different
> API). The safe strategy: instrument with clean abstractions, export to JSONL as a
> baseline, and integrate with a visual tool when you need one. Do not build your system
> on a framework's specific API unless you are prepared to migrate when it changes.

---

## 5. The Pitkeel Model - A Case Study in Custom Observability

*Estimated time: 35 minutes*

This section examines the project's own observability tool, pitkeel, as a case study.
Pitkeel is not a recommendation for your agent system. It is an example of when and
how to build a custom observability instrument for a domain that no standard tool
covers.

### 5.1 What pitkeel observes

Pitkeel (pitkeel/pitkeel.py, pitkeel/analysis.py, pitkeel/keelstate.py) is an
operational stability monitor for human-AI collaboration sessions. It reads git
history and surfaces signals about session behavior. Its header comment states its
philosophy: "Does not interpret. Does not diagnose. Instruments."

It tracks five signal types:

| Signal | What it measures | How | Diagnostic value |
|--------|-----------------|-----|-----------------|
| Session | Duration, breaks, fatigue level | Gap analysis on commit timestamps (>30 min = break) | Detects extended sessions without breaks |
| Scope | Drift within current session | First commit files vs all files touched | Detects when work expands beyond initial scope |
| Velocity | Commits per hour, acceleration | Time-based midpoint split, rate comparison | Detects rushing (rapid-fire commits) |
| Context | Depth distribution of docs/internal/ files | Walk filesystem, classify by path depth | Detects context pollution (too many d1 files) |
| Wellness | Operator's log presence | Check filesystem for today's log file | Basic health check |

### 5.2 Architecture decisions worth studying

**Git as the single source of truth.** Pitkeel does not maintain its own database of
sessions. It reads git log, computes session boundaries from commit timestamps, and
derives all signals from this data. This means the data source is already being written
(every commit creates a record) and is already version-controlled. There is no
synchronization problem between the observability system and the system being observed.

Compare this to the alternative: a separate database that records session start/end
times, manually updated by the user or an agent. That database can fall out of sync
with reality. Git log cannot - it IS reality.

**Pure analysis functions separated from IO.** The analysis module (analysis.py) contains
only pure functions. `analyse_session(commits, now)` takes a list of Commit dataclasses
and a datetime, returns a SessionSignal dataclass. No file access, no subprocess calls,
no network requests. This makes every signal function independently testable:

```python
# From pitkeel/analysis.py - the session analysis function signature
def analyse_session(commits: list[Commit], now: datetime) -> SessionSignal:
    """Pure function: commits in, signal out. No IO."""
    sig = SessionSignal()
    if not commits:
        return sig
    sig.total_commits_today = len(commits)
    sig.sessions = _segment_sessions(commits)
    sig.current_session = sig.sessions[-1]
    # Fatigue thresholds: 2h mild, 3h moderate, 4h high, 6h severe
    d = sig.current_session.duration
    if d >= timedelta(hours=6):
        sig.fatigue_level = "severe"
    elif d >= timedelta(hours=4):
        sig.fatigue_level = "high"
    # ...
    return sig
```

The IO layer (git_io.py) handles subprocess calls to git. The rendering layer
(pitkeel.py) handles terminal output. The analysis layer is the logic. This separation
is not novel - it is standard software architecture. But it is worth noting because many
observability tools mix data collection, analysis, and rendering into a single function,
making them impossible to test in isolation.

**Typed dataclasses for every signal.** Each signal type has a dedicated dataclass:
SessionSignal, ScopeSignal, VelocitySignal, ContextSignal, WellnessSignal. The fields
are typed. The defaults are explicit. There are no magic strings, no untyped dictionaries
passed between functions. This is the same principle as the trace schema in Section 3 -
structure your observability data with types, not ad hoc dictionaries.

**Flock-protected state file.** The persistent state file (.keel-state) uses
`fcntl.flock()` for atomic read-modify-write. This prevents torn writes when multiple
processes might access the state simultaneously. The state schema is a typed dataclass
(keelstate.py) with validation:

```python
# From pitkeel/keelstate.py
@dataclass
class State:
    head: str = ""
    sd: str = ""
    bearing: Bearing = field(default_factory=Bearing)
    officer: str = ""
    true_north: str = ""
    gate: str = ""        # "green", "red", or empty
    gate_time: str = ""
    tests: int = 0
    weave: str = ""
    register: str = ""
    tempo: str = ""

    def validate(self) -> None:
        if self.gate and self.gate not in ("green", "red"):
            raise ValueError(f"gate must be 'green', 'red', or empty; got {self.gate!r}")
```

### 5.3 What pitkeel does not do

Understanding what pitkeel omits is as important as understanding what it includes:

- **It does not trace LLM calls.** Pitkeel monitors the human-AI session, not the AI's
  internal execution. It has no access to model prompts, responses, or token counts.
- **It does not provide dashboards.** Output is terminal text (ANSI-styled) or plain text
  (for commit message hooks). No web UI, no graphs.
- **It does not alert.** It surfaces signals; the human interprets them. There is no
  automated alerting system.
- **It does not integrate with any tracing framework.** It is standalone, reading only
  from git and the local filesystem.

These omissions are deliberate. Pitkeel solves a specific problem (human-AI session
monitoring) that no standard tool addresses. It does not attempt to be a general-purpose
observability platform.

### 5.4 The companion instruments: events.yaml and catch-log.tsv

Pitkeel is not the project's only observability instrument. Two other structured logs
serve complementary roles:

**events.yaml** - the event log spine:

```yaml
events:
  - date: "2026-03-04"
    time: "08:30"
    type: L11
    agent: Weaver
    commit: dd23fa3
    ref: governance-friction-audit-2026-03-04.md
    summary: "Cross-model review of governance audit"
    backrefs: [catch-log.tsv]
```

Each event records date, time, type (mapped to the layer model: L11 = cross-model),
agent, commit, reference to the primary artifact, summary, and backreferences to related
artifacts. The backrefs column creates a reference web between artifacts. This is
append-only YAML per SD-316 - events are never modified after creation.

**catch-log.tsv** - the control firing log:

```
date	control	what_caught	agent	outcome	notes
2026-03-07	the-lullaby	DeepMind application muster	Weaver	logged	Named gaps then built framework to paper over them
```

Each row records when a governance control (from the slopodar taxonomy) fired and caught
something. Fields: date, control name, what was caught, which agent, outcome (logged,
reviewed, fixed, blocked), and free-text notes. This is a meta-observability instrument -
it observes the observability controls themselves.

Together, these three instruments cover different aspects of the same system:

| Instrument | What it observes | Data source | Format |
|-----------|-----------------|------------|--------|
| pitkeel | Human-AI session dynamics | Git log, filesystem | JSON (.keel-state) + terminal output |
| events.yaml | Significant operational events | Manual append | YAML (append-only) |
| catch-log.tsv | Governance control activations | Manual append | TSV (append-only) |

### 5.5 When to build custom

The decision to build custom observability follows a simple test:

1. **Does your domain have observables that standard tools do not measure?** If yes,
   custom is justified. Pitkeel measures session duration from commit gaps and scope
   drift from file-level analysis - no standard APM tool does this.

2. **Is the custom instrument simpler than configuring a general tool?** If a 400-line
   Python script (pitkeel + analysis + keelstate) solves your problem completely, that
   is less operational burden than running a Phoenix server and writing custom exporters
   to feed it non-standard metrics.

3. **Can you maintain it?** Custom instruments must be updated as requirements change.
   If the team that builds it cannot maintain it, it will become stale reference
   propagation - an instrument that describes the system as it was, not as it is.

The inverse test: **use standard tools when the problem is standard.** If you need to
trace LLM API calls, measure latency, and visualize multi-step execution, that is
exactly what Phoenix, LangSmith, and OpenTelemetry are for. Building your own visual
trace viewer is reinventing a solved problem.

> **FIELD VS NOVEL:** Standard APM and observability are well-documented (Honeycomb,
> Charity Majors's writing, the OpenTelemetry documentation). The concept of building
> custom observability for domain-specific concerns is also established practice in SRE.
> The novel contribution is pitkeel as a worked example of custom observability for
> human-AI collaboration - a domain that did not exist before LLM-based workflows.
> The specific observables (scope drift from commit file analysis, fatigue from commit
> timestamp gaps, context depth distribution from filesystem walks) are not found in
> any standard observability framework.

> **AGENTIC GROUNDING:** If you operate an agent system that manages human-AI
> collaborative sessions (pair programming agents, research assistants, writing tools),
> standard observability will tell you about API latency and error rates but nothing
> about session dynamics: whether the human is fatiguing, whether scope is drifting,
> whether the collaboration is accelerating or stalling. These are the signals pitkeel
> surfaces. Your system may need different custom signals - the point is to identify
> what is domain-specific and build instruments for those specific observables.

---

## 6. Metrics That Matter

*Estimated time: 30 minutes*

Not everything measurable matters. Not everything that matters is measurable. This
section identifies the metrics that provide genuine diagnostic value for agent systems,
organized by what question they answer.

### 6.1 Task-level metrics

These answer: "Is the agent doing its job?"

**Task success rate.** The percentage of tasks the agent completes correctly. This is the
most important metric and the hardest to measure, because "correctly" requires an
evaluation framework (Bootcamp IV). For simple tasks (code compilation, test passing),
success is binary. For complex tasks (writing, analysis, research), success is a
spectrum that requires human judgment or automated evaluation.

```sql
-- Task success rate from traces (requires a success/failure label per session)
SELECT
  COUNT(CASE WHEN outcome = 'success' THEN 1 END) * 100.0 / COUNT(*) as success_rate,
  COUNT(*) as total_tasks
FROM (
  SELECT
    session_id,
    MAX(CASE WHEN action_type = 'output' AND error IS NULL THEN 'success' ELSE 'failure' END) as outcome
  FROM traces
  GROUP BY session_id
)
```

**Steps to completion.** The number of steps the agent takes to complete a task. Fewer is
generally better, but not always - a complex task legitimately requires more steps. The
diagnostic value is in the distribution: if the same type of task takes 5 steps one day
and 25 the next, something changed.

```sql
-- Steps to completion distribution
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY step_count) as median_steps,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY step_count) as p95_steps,
  MAX(step_count) as max_steps,
  AVG(step_count) as avg_steps
FROM (
  SELECT session_id, MAX(step) as step_count
  FROM traces
  GROUP BY session_id
)
```

**Error recovery rate.** The percentage of tool errors the agent recovers from (tries
a different approach) vs the percentage it fails on (returns an error to the user).
An agent that encounters a "file not found" error and tries a different path is
recovering. An agent that encounters the same error and reports failure is not.

### 6.2 Efficiency metrics

These answer: "Is the agent using resources wisely?"

**Token efficiency.** Tokens spent per successful task. This is a cost metric but also
a quality signal - an agent that uses 50,000 tokens for a task that should take 5,000
is either retrieving too much context, stuck in a loop, or reasoning inefficiently.

```sql
-- Token efficiency by task type (if task_type is recorded)
SELECT
  AVG(total_tokens) as avg_tokens,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_tokens) as median_tokens,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_tokens) as p95_tokens
FROM (
  SELECT
    session_id,
    SUM(input_tokens + output_tokens) as total_tokens
  FROM traces
  GROUP BY session_id
)
```

**Tool use accuracy.** The percentage of tool calls that produce useful results (results
the agent uses in its next reasoning step) vs wasted calls (results the agent ignores
or that return errors). This requires correlating tool results with subsequent model
decisions, which is why per-step tracing is essential.

**Context window utilization.** The percentage of the context window consumed at each
step. If the context window is at 90% capacity by step 5 of a 20-step task, the agent
is going to hit problems. This metric is only available if you record `context_tokens`
per step (as in the trace schema from Section 3).

```sql
-- Context window utilization progression
SELECT
  step,
  AVG(context_tokens) as avg_context_tokens,
  AVG(context_pct) as avg_context_pct,
  MAX(context_pct) as max_context_pct
FROM traces
WHERE context_tokens > 0
GROUP BY step
ORDER BY step
```

### 6.3 Latency metrics

These answer: "Where is time being spent?"

**Per-step latency.** The wall-clock time for each step. This breaks down into:

- Model call latency (time waiting for the LLM provider to respond)
- Tool execution latency (time for tool calls to complete)
- Orchestration overhead (time in the agent harness between steps)

```sql
-- Latency breakdown by action type
SELECT
  action_type,
  COUNT(*) as count,
  ROUND(AVG(latency_ms), 1) as avg_ms,
  ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms), 1) as p50_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 1) as p95_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms), 1) as p99_ms,
  ROUND(MAX(latency_ms), 1) as max_ms
FROM traces
WHERE latency_ms > 0
GROUP BY action_type
ORDER BY avg_ms DESC
```

**End-to-end latency.** The total time from task start to completion. This is what the
user experiences. A task that completes in 30 seconds with 20 steps feels different from
one that completes in 30 seconds with 2 steps, even though the total time is the same.
The former indicates many fast steps; the latter indicates few slow steps. Both may need
optimization, but for different reasons.

### 6.4 Connection to Bootcamp III

The metrics in this section connect directly to **Bootcamp III Step 3 (SQL analytics)**
for DuckDB query patterns, **Bootcamp III Step 5 (time series)** for tracking metrics
over time, and the general data analysis patterns covered throughout Bootcamp III.

The skills are the same: write SQL queries against structured data, compute descriptive
statistics, identify distributions, and look for anomalies. The data source is different
(agent traces instead of application logs), but the analysis techniques are identical.

If your time series of token efficiency shows a sudden increase, the diagnosis process
is the same as any time series anomaly: identify when it started, correlate with changes
(new model version, prompt changes, tool additions), and investigate the specific sessions
where the anomaly is most pronounced.

> **AGENTIC GROUNDING:** The distinction between metrics that matter and metrics that
> are easy to measure is critical. Token count is easy to measure (the API returns it).
> Task success rate is hard to measure (it requires evaluation). Most agent observability
> dashboards display the easy metrics prominently and the hard metrics poorly or not at
> all. This creates a version of Goodhart's Law: teams optimize for what they measure
> (token efficiency, latency) while the thing that actually matters (correct answers)
> goes unmeasured. Build your metrics starting from the question "did the agent succeed?"
> and work backward to the observables that diagnose success and failure.

---

## 7. Alerting

*Estimated time: 30 minutes*

Alerting is where observability becomes operational. A trace is evidence. A metric is a
measurement. An alert is a decision: something is wrong enough that a human needs to
know about it right now.

### 7.1 The alert fatigue problem

The project's vocabulary names this: **alert fatigue** (also called the naturalist's
tax in the lexicon). The definition from the project: "Observation generation exceeding
processing capacity makes additional parallelism counterproductive. Governed by
Amdahl's Law."

Translated to alerting: if you alert on every anomaly, the human stops reading alerts.
This is not a hypothetical - it is one of the most documented problems in SRE. Honeycomb
defines alert fatigue as occurring "when a person is exposed to too many alerts and
becomes desensitized to them."

The cost of a false alarm is not zero. Every false alarm:
- Interrupts the human's current work
- Degrades trust in the alerting system
- Consumes attention budget that could be used for real problems
- Creates a conditioning effect: the human learns to ignore alerts

The cost of a missed alert is also not zero. Every missed alert:
- Allows a failure to reach users
- Increases the time to detection and resolution
- May compound into a larger failure

Alert design is the practice of finding the threshold where the cost of false alarms
and the cost of missed alerts are both acceptable. There is no perfect threshold. Every
alert is a bet: "this condition is worth interrupting a human for."

### 7.2 What to alert on

For agent systems, the following conditions warrant alerts. Each is chosen because it
represents a failure that compounds if not caught:

**Token budget exceeded.** An agent that consumes more tokens than its budget allows is
either stuck in a loop or processing a task that is too complex for the current approach.
This alert is straightforward to implement and has a clear threshold.

```python
# alert_token_budget.py - Token budget alert

def check_token_budget(traces: list[dict], budget: int = 50000) -> list[dict]:
  """Check if any session exceeded the token budget."""
  alerts = []
  sessions = {}

  for event in traces:
    sid = event.get("session_id", "")
    if sid not in sessions:
      sessions[sid] = 0
    sessions[sid] += event.get("input_tokens", 0) + event.get("output_tokens", 0)

  for sid, total in sessions.items():
    if total > budget:
      alerts.append({
        "type": "token_budget_exceeded",
        "session_id": sid,
        "total_tokens": total,
        "budget": budget,
        "overage_pct": round((total - budget) / budget * 100, 1),
      })

  return alerts
```

**Error rate spike.** A sudden increase in the percentage of steps that produce errors.
A single error is normal (tools fail, APIs timeout). A sustained increase indicates a
systemic problem: a tool is down, an API key has expired, a prompt change introduced
a regression.

```python
# alert_error_rate.py - Error rate spike detection

from collections import defaultdict


def check_error_rate(traces: list[dict],
                     window_size: int = 100,
                     threshold: float = 0.20) -> list[dict]:
  """Alert if error rate in the last N events exceeds threshold."""
  alerts = []
  recent = traces[-window_size:] if len(traces) >= window_size else traces

  error_count = sum(1 for e in recent if e.get("error") is not None)
  error_rate = error_count / len(recent) if recent else 0

  if error_rate > threshold:
    # Find the most common error types
    error_types = defaultdict(int)
    for e in recent:
      if e.get("error"):
        error_types[e.get("error_type", "unknown")] += 1

    alerts.append({
      "type": "error_rate_spike",
      "error_rate": round(error_rate, 3),
      "threshold": threshold,
      "window_size": len(recent),
      "error_count": error_count,
      "top_errors": dict(sorted(error_types.items(), key=lambda x: -x[1])[:3]),
    })

  return alerts
```

**Agent stuck in a loop.** The same tool called 3 or more times consecutively with the
same or nearly identical arguments. This indicates the agent is not learning from tool
results - it is repeating the same action expecting a different outcome. This is one
of the most common agent failure patterns and one of the easiest to detect.

```python
# alert_loop_detection.py - Stuck-in-loop detection

def check_stuck_in_loop(traces: list[dict],
                        session_id: str,
                        repeat_threshold: int = 3) -> list[dict]:
  """Detect if an agent is stuck calling the same tool repeatedly."""
  alerts = []

  # Filter to this session's tool calls
  tool_calls = [
    e for e in traces
    if e.get("session_id") == session_id
    and e.get("action_type") == "tool_call"
    and e.get("tool_name")
  ]

  if len(tool_calls) < repeat_threshold:
    return alerts

  # Check for consecutive identical tool calls
  streak = 1
  streak_start = 0

  for i in range(1, len(tool_calls)):
    current = (tool_calls[i].get("tool_name"), str(tool_calls[i].get("tool_args")))
    previous = (tool_calls[i-1].get("tool_name"), str(tool_calls[i-1].get("tool_args")))

    if current == previous:
      streak += 1
    else:
      if streak >= repeat_threshold:
        alerts.append({
          "type": "stuck_in_loop",
          "session_id": session_id,
          "tool_name": tool_calls[streak_start].get("tool_name"),
          "tool_args": tool_calls[streak_start].get("tool_args"),
          "repeat_count": streak,
          "first_step": tool_calls[streak_start].get("step"),
          "last_step": tool_calls[i-1].get("step"),
        })
      streak = 1
      streak_start = i

  # Check the final streak
  if streak >= repeat_threshold:
    alerts.append({
      "type": "stuck_in_loop",
      "session_id": session_id,
      "tool_name": tool_calls[streak_start].get("tool_name"),
      "tool_args": tool_calls[streak_start].get("tool_args"),
      "repeat_count": streak,
      "first_step": tool_calls[streak_start].get("step"),
      "last_step": tool_calls[-1].get("step"),
    })

  return alerts
```

**Unexpected tool call pattern.** An agent calling a tool it has never used before, or
calling tools in an order that has never been observed. This is harder to implement
because it requires a baseline of "normal" behavior. Start simple: maintain a set of
expected tools per agent type and alert when a tool not in the set is called.

### 7.3 Alert design principles

**Actionable.** Every alert must have a clear next step. "Token budget exceeded for
session abc123" is actionable: investigate that session. "Something might be wrong" is
not actionable: with what?

**Specific.** Include the session_id, the step number, the threshold that was crossed,
and the actual value. "Error rate 0.35 exceeded threshold 0.20 in window of 100 events,
top errors: timeout (12), parse_error (8), auth_failure (3)" tells the responder exactly
where to start investigating.

**Rare.** If an alert fires more than once per day during normal operations, it is either
miscalibrated (threshold too low) or detecting a chronic condition that should be fixed,
not alerted on. Chronic conditions belong in dashboards, not alerts.

**Tiered.** Not all problems are equally urgent. A token budget exceeded by 10% is
informational. A token budget exceeded by 500% is critical. A stuck-in-loop detection
is urgent (the agent is burning money right now). An error rate that crept up 5% over
a week is a trend to investigate, not an emergency.

### 7.4 The alert pipeline

A minimal alert pipeline for agent systems:

```python
# alert_pipeline.py - Complete alert pipeline

import json
import sys
from pathlib import Path
from datetime import datetime, timezone


def load_traces(path: str) -> list[dict]:
  """Load JSONL traces."""
  traces = []
  for line in Path(path).read_text().strip().split("\n"):
    if line.strip():
      traces.append(json.loads(line))
  return traces


def run_alerts(trace_path: str, config: dict) -> list[dict]:
  """Run all alert checks against traces."""
  traces = load_traces(trace_path)
  all_alerts = []

  # Token budget check (all sessions)
  from alert_token_budget import check_token_budget
  all_alerts.extend(check_token_budget(traces, budget=config.get("token_budget", 50000)))

  # Error rate check
  from alert_error_rate import check_error_rate
  all_alerts.extend(check_error_rate(
    traces,
    window_size=config.get("error_window", 100),
    threshold=config.get("error_threshold", 0.20),
  ))

  # Loop detection (per session)
  from alert_loop_detection import check_stuck_in_loop
  session_ids = set(e.get("session_id") for e in traces if e.get("session_id"))
  for sid in session_ids:
    all_alerts.extend(check_stuck_in_loop(
      traces, sid,
      repeat_threshold=config.get("loop_threshold", 3),
    ))

  # Add metadata to each alert
  now = datetime.now(timezone.utc).isoformat()
  for alert in all_alerts:
    alert["detected_at"] = now
    alert["trace_file"] = trace_path

  return all_alerts


if __name__ == "__main__":
  config = {
    "token_budget": 50000,
    "error_window": 100,
    "error_threshold": 0.20,
    "loop_threshold": 3,
  }

  alerts = run_alerts("traces/agent.jsonl", config)

  if alerts:
    for alert in alerts:
      sys.stdout.write(json.dumps(alert, separators=(",", ":")) + "\n")
    sys.exit(1)  # Non-zero exit for CI/CD integration
  else:
    sys.stdout.write("No alerts.\n")
    sys.exit(0)
```

This pipeline reads traces from a JSONL file, runs all alert checks, and outputs alerts
as JSONL to stdout. The non-zero exit code makes it usable in CI/CD pipelines: run the
pipeline after each agent evaluation, fail the build if alerts fire.

> **AGENTIC GROUNDING:** Alert fatigue is a real operational problem, not a theoretical
> concern. In the project's vocabulary, it is governed by Amdahl's Law applied to human
> attention: observation generation exceeding processing capacity makes additional
> parallelism counterproductive. The practical consequence: start with 2-3 alerts (token
> budget, error rate, loop detection). Add more only when you have evidence that a new
> failure pattern is not caught by existing alerts. Every alert you add dilutes the
> attention available for existing alerts. The total set of alerts should fit on one
> screen and should fire rarely enough that each firing gets investigated.

> **FIELD VS NOVEL:** Alert fatigue and alert design principles are well-established in
> SRE literature (Google SRE Book Chapter 6, Honeycomb's writing on observability).
> The application to agent systems is emerging. The specific alert types for agents
> (loop detection, token budget, context window pressure) are not yet standardized.
> The project's naming of alert fatigue as "naturalist's tax" and its framing through
> Amdahl's Law on human attention is a project-specific contribution that connects
> established SRE wisdom to the LLM agent context.

---

## Challenge: Custom Tracing for a Multi-Step Agent

**Estimated time: 30 minutes**

**Prerequisites:** Completed Tool Setup. DuckDB installed. Either a working agent from
Step 6 or the agent scaffold from Tool Setup.

**Goal:** Implement JSONL tracing for a 5-step agent, run it 20 times, and query the
resulting traces with DuckDB to answer three specific questions.

**Part 1: Instrument the agent**

Using the trace schema and writer from Section 3, instrument your agent (or the
scaffold) to produce one JSONL event per step. Each event must include at minimum:
`session_id`, `step`, `timestamp`, `action_type`, `input_tokens`, `output_tokens`,
`latency_ms`, `tool_name` (for tool calls), and `error` (null if no error).

```python
# Start from this skeleton:
import uuid
import time
import json
from pathlib import Path

TRACE_PATH = "traces/challenge1.jsonl"

def trace_event(session_id, step, action_type, **kwargs):
  """Write one trace event to the JSONL file."""
  event = {
    "session_id": session_id,
    "step": step,
    "timestamp": __import__("datetime").datetime.now(
      __import__("datetime").timezone.utc
    ).isoformat(),
    "action_type": action_type,
    **kwargs,
  }
  # Remove None/empty values
  event = {k: v for k, v in event.items() if v is not None}
  with open(TRACE_PATH, "a") as f:
    f.write(json.dumps(event, separators=(",", ":"), default=str) + "\n")

# Your agent loop here - instrument each step with trace_event()
```

**Part 2: Run 20 sessions**

```python
# Run 20 traced sessions
Path(TRACE_PATH).unlink(missing_ok=True)  # Start fresh
for i in range(20):
  session_id = str(uuid.uuid4())[:12]
  # Run your agent with tracing
  # ...
```

**Part 3: Query with DuckDB**

Write DuckDB queries to answer:

1. What is the average number of steps to completion across all 20 sessions?
2. What is the p95 latency for model_call events?
3. What is the most common tool called, and what is its error rate?

```python
import duckdb
db = duckdb.connect()
db.execute(f"CREATE TABLE t AS SELECT * FROM read_json('{TRACE_PATH}', auto_detect=true)")

# Query 1: Average steps to completion
# Your query here

# Query 2: P95 latency for model_call
# Your query here

# Query 3: Most common tool and error rate
# Your query here
```

**Verification:** Your output should show three query results with concrete numbers.
The trace file should contain exactly 20 * (steps per session) lines of valid JSON.

```bash
# Verify JSONL integrity (every line should parse as valid JSON)
python3 -c "
import json
from pathlib import Path
lines = Path('$TRACE_PATH').read_text().strip().split('\n')
valid = sum(1 for l in lines if json.loads(l))
printf_msg = f'{valid} valid JSONL lines'
import sys; sys.stdout.write(printf_msg + '\n')
"
```

<details>
<summary>Hints</summary>

For Query 1:
```sql
SELECT AVG(max_step) as avg_steps
FROM (SELECT session_id, MAX(step) as max_step FROM t GROUP BY session_id)
```

For Query 2:
```sql
SELECT ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 1) as p95_ms
FROM t WHERE action_type = 'model_call' AND latency_ms > 0
```

For Query 3:
```sql
SELECT tool_name, COUNT(*) as calls,
  COUNT(CASE WHEN error IS NOT NULL THEN 1 END) as errors,
  ROUND(COUNT(CASE WHEN error IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as error_rate_pct
FROM t WHERE tool_name IS NOT NULL AND tool_name != ''
GROUP BY tool_name ORDER BY calls DESC LIMIT 1
```

</details>

**Extension:** Add a `context_tokens` field to your trace events that tracks cumulative
token usage within each session. Query: at what step number does the average session
cross 50% of a 200,000-token context window?

---

## Challenge: Framework Comparison

**Estimated time: 25 minutes**

**Prerequisites:** Challenge 1 complete. Traces from 20 sessions available.

**Goal:** Compare your custom JSONL tracing against a tracing framework to identify
what the framework provides that custom tracing does not.

**Option A: With Arize Phoenix (if installed)**

```python
# Start Phoenix locally
import phoenix as px
session = px.launch_app()
# This opens a local web UI at http://localhost:6006

# Instrument your agent with Phoenix's OpenInference tracing
# Then run 5 sessions and view the traces in the Phoenix UI
```

Compare:
1. What information does Phoenix display that your JSONL traces do not capture?
2. What does the visual trace viewer show that a DuckDB query does not?
3. What is the overhead (additional latency, memory usage) of running Phoenix?

**Option B: Without Phoenix (framework-free comparison)**

If Phoenix is not installed, perform the comparison analytically:

1. Read the Phoenix documentation (https://docs.arize.com/phoenix) for 10 minutes.
   List three features that would require significant effort to build from scratch.

2. List three things your custom JSONL tracing does that Phoenix's default
   instrumentation does not (hint: think about domain-specific fields like
   `context_pct` or custom tool_args logging).

3. Estimate the engineering effort (in hours) to add Phoenix's top 3 features to
   your custom tracing vs the operational effort (in hours per month) to maintain a
   Phoenix deployment.

**Fallback:** If no framework documentation is accessible, compare your JSONL traces
against the Inspect AI log viewer documentation
(https://inspect.ai-safety-institute.org.uk/log-viewer.html). The comparison is the
same: what does the visual tool provide that raw JSONL does not?

**Verification:** Produce a written comparison (200-400 words) answering: "For a team
of 2 engineers building an agent product, should they start with custom JSONL tracing
or a framework? Under what conditions should they switch?"

<details>
<summary>Hints</summary>

Key framework advantages: visual trace tree, real-time monitoring, built-in eval
integration, automatic OpenTelemetry instrumentation, team collaboration features.

Key custom advantages: no dependencies, no operational overhead, full control over
schema, queryable with any SQL tool, version-controllable traces, no vendor lock-in.

The breakpoint is usually team size and system complexity. Below ~5 engineers and
~10 agent types, custom is often sufficient. Above that, the coordination overhead
of custom tracing exceeds the operational overhead of a framework.

</details>

---

## Challenge: Loop Detection Alert

**Estimated time: 25 minutes**

**Prerequisites:** Challenge 1 complete. Familiarity with the alerting patterns from
Section 7.

**Goal:** Build a loop detection alert and test it with a deliberately buggy agent that
gets stuck calling the same tool repeatedly.

**Part 1: Create a buggy agent**

Write an agent that deliberately enters a loop - calling the same tool with the same
arguments 5+ times consecutively:

```python
# buggy_agent.py - Agent that gets stuck in a loop

import uuid
import time
import json
import random
from pathlib import Path

TRACE_PATH = "traces/buggy.jsonl"

def trace_event(session_id, step, action_type, **kwargs):
  event = {
    "session_id": session_id,
    "step": step,
    "timestamp": __import__("datetime").datetime.now(
      __import__("datetime").timezone.utc
    ).isoformat(),
    "action_type": action_type,
    **kwargs,
  }
  event = {k: v for k, v in event.items() if v is not None}
  with open(TRACE_PATH, "a") as f:
    f.write(json.dumps(event, separators=(",", ":"), default=str) + "\n")

def run_buggy_agent():
  session_id = str(uuid.uuid4())[:12]

  # Steps 1-2: Normal behavior
  for step in range(1, 3):
    trace_event(session_id, step, "tool_call",
      tool_name="search",
      tool_args={"query": f"step {step} query"},
      latency_ms=round(random.uniform(50, 200), 2))

  # Steps 3-8: Stuck in a loop (same tool, same args)
  for step in range(3, 9):
    trace_event(session_id, step, "tool_call",
      tool_name="read_file",
      tool_args={"path": "/tmp/missing.txt"},
      error="FileNotFoundError: /tmp/missing.txt",
      latency_ms=round(random.uniform(10, 50), 2))

  # Steps 9-10: Agent gives up
  trace_event(session_id, 9, "model_call",
    input_tokens=3000, output_tokens=100,
    latency_ms=round(random.uniform(500, 1500), 2))
  trace_event(session_id, 10, "output",
    error="Task failed: could not read required file")

  return session_id

# Run the buggy agent
Path(TRACE_PATH).unlink(missing_ok=True)
sid = run_buggy_agent()
```

**Part 2: Implement loop detection**

Write a function that reads the JSONL trace and detects the loop. The function should
return a structured alert containing:
- The session_id where the loop was detected
- The tool name and arguments that were repeated
- The number of consecutive repetitions
- The step numbers where the loop started and ended

**Part 3: Test and verify**

Run the buggy agent, run your detector, and verify it catches the loop.

```bash
python3 buggy_agent.py
python3 your_loop_detector.py
# Should output an alert for the stuck-in-loop pattern
```

**Verification:** Your detector should identify the `read_file` loop with 6 consecutive
calls (steps 3-8) and produce a structured alert. Test with a non-buggy agent to verify
it produces no false positives.

<details>
<summary>Hints</summary>

The detection algorithm from Section 7.2 works directly. The key comparison is
`(tool_name, str(tool_args))` between consecutive tool_call events. A match
increments the streak counter; a mismatch resets it.

Edge case: if the agent alternates between two tools with the same args (A, B, A, B),
this is not a simple loop but may still be pathological. For this exercise, detect only
consecutive identical calls. More sophisticated patterns (A-B-A-B, or same tool with
slightly different args) are extensions.

</details>

**Extension:** Modify your detector to also catch "near-loops" - sequences where the
same tool is called with arguments that differ only in a counter or timestamp (e.g.,
`search("query attempt 1")`, `search("query attempt 2")`, `search("query attempt 3")`).
These are retry loops that the simple exact-match detector misses.

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What are the four properties that make agent observability different from traditional
   APM? (non-deterministic outputs, multi-step reasoning, tool side effects, context
   state evolution)

2. What is the minimum set of fields a useful trace event should include? Why is each
   field necessary?

3. Why is JSONL a good format for agent traces? What properties does it have that make
   it suitable? (append-only, streamable, queryable)

4. What is the current maturity status of OpenTelemetry GenAI semantic conventions?
   What should you depend on, and what should you wrap in abstractions?

5. When should you build custom observability instead of using a framework? What test
   determines the answer?

6. What three metrics answer "is the agent doing its job?" Which of these is the
   hardest to measure, and why?

7. What is alert fatigue? Why does adding more alerts not always improve reliability?

8. How does the stuck-in-loop alert work? What trace data does it require?

9. What is the phantom ledger anti-pattern, and how does it apply to tracing?

10. How does `strace` (Bootcamp I Step 8) relate to agent tracing? What is the
    structural analogy, and where does it break down?

---

## Recommended Reading

- **"Observability Engineering"** - Charity Majors, Liz Fong-Jones, George Miranda
  (O'Reilly, 2022). The definitive book on observability. Covers structured events,
  high cardinality, and the limitations of the "three pillars" framing. Read Chapters
  1-3 for the conceptual foundation that underlies everything in this step.

- **OpenTelemetry Documentation** - https://opentelemetry.io/docs/. The specification
  for distributed tracing. Read the "Concepts" section for the stable conceptual model
  (spans, traces, context propagation). Read the GenAI semantic conventions
  (https://opentelemetry.io/docs/specs/semconv/gen-ai/) for the emerging agent-specific
  standard, with the understanding that specifics will change.

- **JSONL Specification** - https://jsonlines.org/. Short and complete. The entire
  spec is three sentences.

- **DuckDB JSON Documentation** - https://duckdb.org/docs/stable/data/json/overview.html.
  How to query JSONL files with SQL. Directly applicable to the trace analysis workflow.

- **Arize Phoenix** - https://github.com/Arize-ai/phoenix. The most mature open-source
  agent observability platform. Worth studying even if you do not use it, for its
  approach to trace visualization and evaluation integration.

- **Google SRE Book, Chapter 6: "Monitoring Distributed Systems"** -
  https://sre.google/sre-book/monitoring-distributed-systems/. The foundational
  discussion of monitoring, alerting, and alert fatigue that informs Section 7.

---

## What to Read Next

**Step 8: Debugging Agent Systems** - When observability tells you something is wrong,
debugging tells you why. Step 8 covers systematic diagnosis using the layer model
(L0-L12), replay analysis of traces from this step, the "rerun don't fix" principle
for non-deterministic systems, and failure classification for agent-specific error
types. The traces you learned to produce and query in this step become the primary
evidence for the debugging process in Step 8.

