+++
title = "Debugging Agent Systems"
date = "2026-03-10"
description = "Replay debugging, failure classification, diagnosis by layer, common patterns, post-mortems."
tags = ["debugging", "diagnosis", "bootcamp"]
step = 8
tier = 3
estimate = "4-5 hours"
bootcamp = 5
+++

Step 8 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

## Why This is Step 8

Step 7 gave you the instruments. You can now produce structured traces from agent
runs, query them with DuckDB, and detect common failure patterns through alerts. The
traces capture what the agent saw, decided, and did at each step.

This step teaches you how to read those traces when something goes wrong.

The distinction matters. Producing a trace is instrumentation. Reading a trace to find
why an agent failed - and classifying the failure precisely enough to prevent it from
recurring - is debugging. These are different skills. An application that emits perfect
traces but whose operators cannot diagnose failures from them is not observable in any
meaningful sense. Observability exists at the intersection of data production and data
interpretation.

Agent debugging is fundamentally different from debugging traditional software. In
traditional debugging, you set a breakpoint, inspect state, step through execution, and
watch variables change. The program is deterministic: the same inputs produce the same
outputs. If a test fails, you can reproduce it every time. If you add a print statement,
the output appears in the same place on every run.

None of this applies to agent systems. The core computation - the LLM inference call -
is a remote API call that returns non-deterministic output. You cannot set a breakpoint
inside the model. You cannot step through its reasoning. You cannot inspect its internal
state. The same prompt may produce different tool calls, different reasoning, different
outputs across runs. A failure that appears once may not appear again, and a success on
rerun does not mean the bug is fixed.

The layer model (introduced in **Bootcamp II Step 4 (context engineering)** and used
throughout this bootcamp) is the primary diagnostic framework for this step. It provides
what traditional debugging provides through stack traces: a systematic way to locate
where in the system a failure originated. When a traditional program crashes, the stack
trace tells you which function, which line, which call chain. When an agent fails, the
layer model tells you which layer: was it the model's weights (L0), the context window
(L3), a tool call (L7), the system prompt (L8), a self-reinforcing loop (L9), or a
human judgment error (L12)?

By the end of this step, you will be able to diagnose agent failures systematically
rather than guessing, classify failures into actionable categories, decide when to rerun
versus when to fix, and apply layer-by-layer diagnosis to locate root causes in traces
you built in Step 7.

---

## Table of Contents

1. [The Debugging Challenge](#1-the-debugging-challenge) (~20 min)
2. [Replay Debugging](#2-replay-debugging) (~30 min)
3. [Failure Classification](#3-failure-classification) (~35 min)
4. [Rerun, Don't Fix](#4-rerun-dont-fix) (~25 min)
5. [Diagnosis by Layer - L0 through L12](#5-diagnosis-by-layer---l0-through-l12) (~60 min)
6. [Common Debugging Patterns](#6-common-debugging-patterns) (~35 min)
7. [Debugging in Production](#7-debugging-in-production) (~30 min)
8. [Challenges](#challenges) (~60-90 min)
9. [Key Takeaways](#key-takeaways)
10. [Recommended Reading](#recommended-reading)
11. [What to Read Next](#what-to-read-next)

---

## Tool Setup

*This section covers installation and verification. Skip tools you already have.*

### Required

```bash
# DuckDB for trace analysis (same as Step 7)
uv pip install duckdb

# Verify
python3 -c "import duckdb; print(f'DuckDB {duckdb.__version__}')"
```

```bash
# Standard library modules used in this step (no installation needed):
# json, datetime, pathlib, difflib, collections
# Verify Python version
python3 -c "import sys; assert sys.version_info >= (3, 10), 'Python 3.10+ required'; print(f'Python {sys.version}')"
```

### Sample Traces

The exercises in this step require agent traces. If you completed Step 7 and have
JSONL trace files, use those. If not, this script generates sample traces with
deliberate failures for diagnosis practice:

```python
# generate_sample_traces.py - Creates 50 traces with 5 deliberate failures
import json
import uuid
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)  # Reproducible for exercises

def make_trace(trace_id, steps, failure_type=None, failure_step=None):
  """Generate a single agent trace as a list of span dicts."""
  spans = []
  start = datetime(2026, 3, 10, 9, 0, 0) + timedelta(minutes=random.randint(0, 480))
  for i, step in enumerate(steps):
    span_start = start + timedelta(seconds=i * 2)
    span = {
      "trace_id": trace_id,
      "span_id": str(uuid.uuid4())[:8],
      "step": i,
      "type": step["type"],
      "name": step["name"],
      "start_time": span_start.isoformat(),
      "duration_ms": random.randint(100, 3000),
      "input_tokens": random.randint(500, 4000),
      "output_tokens": random.randint(50, 800),
      "status": "ok",
    }
    if step["type"] == "tool_call":
      span["tool_name"] = step.get("tool", "unknown")
      span["tool_args"] = step.get("args", {})
      span["tool_result_tokens"] = random.randint(100, 2000)
    if failure_type and i == failure_step:
      span["status"] = "error"
      span["error_type"] = failure_type
      span["error_message"] = step.get("error_msg", "Unknown error")
    spans.append(span)
  return spans

# Normal agent workflow: search, read, analyze, respond
normal_steps = [
  {"type": "llm_call", "name": "plan"},
  {"type": "tool_call", "name": "search", "tool": "file_search",
   "args": {"query": "config settings"}},
  {"type": "tool_call", "name": "read_file", "tool": "read_file",
   "args": {"path": "config.yaml"}},
  {"type": "llm_call", "name": "analyze"},
  {"type": "tool_call", "name": "write_file", "tool": "write_file",
   "args": {"path": "output.md", "content": "..."}},
  {"type": "llm_call", "name": "summarize"},
]

# Failure scenarios
failures = [
  # 1. Infinite loop - agent calls search 12 times
  {
    "steps": [{"type": "llm_call", "name": "plan"}] +
      [{"type": "tool_call", "name": f"search_attempt_{i}",
        "tool": "file_search",
        "args": {"query": "config settings"}} for i in range(12)] +
      [{"type": "llm_call", "name": "give_up",
        "error_msg": "Max iterations reached"}],
    "failure_type": "orchestration_error",
    "failure_step": 13,
  },
  # 2. Hallucinated tool call - agent invents a tool
  {
    "steps": [
      {"type": "llm_call", "name": "plan"},
      {"type": "tool_call", "name": "search", "tool": "file_search",
       "args": {"query": "database schema"}},
      {"type": "tool_call", "name": "hallucinated_call",
       "tool": "execute_sql",
       "args": {"query": "SELECT * FROM users"},
       "error_msg": "Tool 'execute_sql' not found in registry"},
    ],
    "failure_type": "model_error",
    "failure_step": 2,
  },
  # 3. Context overflow - token count explodes
  {
    "steps": [
      {"type": "llm_call", "name": "plan"},
    ] + [
      {"type": "tool_call", "name": f"read_large_file_{i}",
       "tool": "read_file",
       "args": {"path": f"large_dataset_{i}.json"}} for i in range(8)
    ] + [
      {"type": "llm_call", "name": "analyze_degraded",
       "error_msg": "Output quality degraded - incoherent response"},
    ],
    "failure_type": "context_error",
    "failure_step": 9,
  },
  # 4. Tool error - external service fails
  {
    "steps": [
      {"type": "llm_call", "name": "plan"},
      {"type": "tool_call", "name": "search", "tool": "web_search",
       "args": {"query": "latest API docs"},
       "error_msg": "HTTP 503: Service Unavailable"},
    ],
    "failure_type": "environment_error",
    "failure_step": 1,
  },
  # 5. State corruption - stale state from previous run
  {
    "steps": [
      {"type": "llm_call", "name": "plan"},
      {"type": "tool_call", "name": "read_state", "tool": "read_file",
       "args": {"path": ".agent-state.json"}},
      {"type": "llm_call", "name": "act_on_stale_state"},
      {"type": "tool_call", "name": "write_wrong_file", "tool": "write_file",
       "args": {"path": "deleted_module.py", "content": "..."},
       "error_msg": "File references deleted module from previous session"},
    ],
    "failure_type": "state_error",
    "failure_step": 3,
  },
]

output_path = Path("sample_traces.jsonl")
with output_path.open("w") as f:
  # Write 45 normal traces
  for i in range(45):
    trace_id = f"trace-{i:03d}"
    steps = normal_steps.copy()
    # Add some natural variation
    if random.random() > 0.7:
      steps.insert(2, {"type": "tool_call", "name": "extra_search",
                        "tool": "file_search",
                        "args": {"query": "additional context"}})
    spans = make_trace(trace_id, steps)
    for span in spans:
      f.write(json.dumps(span) + "\n")

  # Write 5 failure traces
  for i, failure in enumerate(failures):
    trace_id = f"trace-fail-{i:03d}"
    spans = make_trace(
      trace_id,
      failure["steps"],
      failure["failure_type"],
      failure["failure_step"],
    )
    for span in spans:
      f.write(json.dumps(span) + "\n")

printf_msg = f"Wrote {output_path}: 50 traces (45 normal, 5 failures)"
print(printf_msg)
```

Run this before starting the exercises:

```bash
python3 generate_sample_traces.py
```

---

## 1. The Debugging Challenge

*Estimated time: 20 minutes*

Traditional debugging rests on three assumptions that do not hold for agent systems:

**Determinism.** Given the same inputs, the same program produces the same outputs. This
is the foundation of reproducible bugs. If a test fails, you rerun it, it fails the same
way, and you can bisect to find the cause. LLM inference is non-deterministic even at
temperature 0. The API contract does not guarantee identical outputs for identical inputs
across calls. A bug you saw once may not appear on the next run.

**Inspectability.** You can pause execution at any point, examine the full program state,
and step forward one instruction at a time. Debuggers (gdb, pdb, Chrome DevTools) exist
because the execution environment exposes its state to inspection tools. An LLM API call
is a black box. You send a request. You receive a response. You cannot pause the model
mid-inference, inspect attention weights, or examine which tokens influenced the output.

**Locality.** A bug has a location - a line number, a function, a module. The stack trace
points to it. Agent failures rarely have a single location. A wrong answer may result
from: an inadequate system prompt (set at the start of the run), a retrieval step that
returned plausible but wrong documents (step 3 of 20), a tool call that succeeded but
returned stale data (step 7), and a model that synthesized all of this into a
confident-sounding wrong answer (step 20). The "bug" is distributed across the entire
execution.

### What You Have Instead

The trace from Step 7 is your primary debugging tool. Instead of breakpoints, you have
recorded spans. Instead of stepping through code, you replay the sequence of model calls
and tool invocations. Instead of inspecting live state, you examine the recorded inputs
and outputs at each step.

This is closer to post-mortem debugging from core dumps than to interactive debugging
with breakpoints. The execution has already happened. You are reconstructing what
occurred from the evidence left behind.

```python
# The fundamental debugging loop for agent systems
def debug_agent_failure(trace_path: str):
  """
  Post-mortem debugging from a JSONL trace.
  No breakpoints. No stepping. Evidence reconstruction.
  """
  import json
  from pathlib import Path

  spans = []
  with Path(trace_path).open() as f:
    for line in f:
      spans.append(json.loads(line))

  # Group by trace_id (a file may contain multiple traces)
  traces = {}
  for span in spans:
    tid = span["trace_id"]
    if tid not in traces:
      traces[tid] = []
    traces[tid].append(span)

  # For each trace, find the first error
  for tid, trace_spans in traces.items():
    sorted_spans = sorted(trace_spans, key=lambda s: s["step"])
    for span in sorted_spans:
      if span.get("status") == "error":
        print(f"Trace {tid}: failure at step {span['step']}")
        print(f"  Type: {span['type']}")
        print(f"  Name: {span['name']}")
        print(f"  Error: {span.get('error_type', 'unknown')}")
        print(f"  Message: {span.get('error_message', 'none')}")
        # The interesting question: what happened BEFORE this step?
        print(f"  Prior steps: {[s['name'] for s in sorted_spans[:span['step']]]}")
        break
```

The engineering loop from AGENTS.md - Read, Verify, Write, Execute, Confirm - applies
directly to debugging. Read the trace. Verify your hypothesis against the recorded
evidence. Write a fix (to the prompt, tool, or orchestration - not to the output).
Execute a new run. Confirm the fix by checking traces from the new run.

> **AGENTIC GROUNDING:** When an agent fails, the instinct is to look at the final
> output and try to understand what went wrong from the answer. This is like debugging
> a program by reading its stdout without looking at the source code. The trace is the
> source code of an agent run. The output is just the last line.

> **FIELD VS NOVEL:** Post-mortem debugging from logs is well-established in SRE
> practice (Beyer et al., "Site Reliability Engineering," 2016). Core dump analysis
> predates it by decades. The novel contribution here is applying these techniques to
> LLM agent traces, where the additional challenge of non-determinism means that
> reproducing a failure is not always possible, and where the "program" being debugged
> is a sequence of probabilistic inference calls rather than deterministic instructions.

---

## 2. Replay Debugging

*Estimated time: 30 minutes*

Replay debugging means re-examining an agent's execution step by step from a recorded
trace. The goal is to see exactly what the agent saw, decided, and did at each point
in its run. This is not re-execution. It is reconstruction from evidence.

### Post-Mortem Replay from JSONL

Given a JSONL trace from Step 7, you can reconstruct the agent's execution sequence:

```python
# replay.py - Step-by-step trace replay
import json
from pathlib import Path
from collections import defaultdict

def replay_trace(trace_path: str, trace_id: str):
  """
  Replay a single trace step by step.
  Shows what the agent saw at each decision point.
  """
  spans = []
  with Path(trace_path).open() as f:
    for line in f:
      span = json.loads(line)
      if span["trace_id"] == trace_id:
        spans.append(span)

  spans.sort(key=lambda s: s["step"])

  cumulative_input_tokens = 0
  cumulative_output_tokens = 0
  tool_calls = []

  print(f"=== Replay: {trace_id} ({len(spans)} steps) ===\n")

  for span in spans:
    cumulative_input_tokens += span.get("input_tokens", 0)
    cumulative_output_tokens += span.get("output_tokens", 0)

    status_marker = "[OK]" if span.get("status") == "ok" else "[ERROR]"

    print(f"Step {span['step']}: {span['name']} {status_marker}")
    print(f"  Type: {span['type']}")
    print(f"  Duration: {span['duration_ms']}ms")
    print(f"  Tokens this step: in={span.get('input_tokens', 0)}, "
          f"out={span.get('output_tokens', 0)}")
    print(f"  Cumulative tokens: in={cumulative_input_tokens}, "
          f"out={cumulative_output_tokens}")

    if span["type"] == "tool_call":
      tool_name = span.get("tool_name", "unknown")
      tool_args = span.get("tool_args", {})
      result_tokens = span.get("tool_result_tokens", 0)
      tool_calls.append(tool_name)
      print(f"  Tool: {tool_name}")
      print(f"  Args: {json.dumps(tool_args, indent=4)}")
      print(f"  Result tokens: {result_tokens}")
      cumulative_input_tokens += result_tokens  # Tool results enter context

    if span.get("status") == "error":
      print(f"  ERROR TYPE: {span.get('error_type', 'unknown')}")
      print(f"  ERROR MSG: {span.get('error_message', 'none')}")

    print()

  # Summary
  print("=== Summary ===")
  print(f"Total steps: {len(spans)}")
  print(f"Total tokens: in={cumulative_input_tokens}, "
        f"out={cumulative_output_tokens}")
  print(f"Tool calls: {tool_calls}")
  print(f"Final status: {spans[-1].get('status', 'unknown')}")


if __name__ == "__main__":
  import sys
  if len(sys.argv) < 3:
    print("Usage: python3 replay.py <trace_file> <trace_id>")
    sys.exit(1)
  replay_trace(sys.argv[1], sys.argv[2])
```

Run a replay:

```bash
python3 replay.py sample_traces.jsonl trace-fail-000
```

### The Limits of Replay

Replay from traces is post-mortem analysis. You see what happened. You do not re-execute
the agent. This distinction is important for two reasons.

First, re-execution would produce different results. If you send the same messages to
the model, it may respond differently because LLM output is non-deterministic. The
trace is the only record of what actually happened during that specific run.

Second, the trace may not capture everything. If your tracing from Step 7 did not
record the full content of tool results (perhaps you truncated them to save storage),
you have a gap in the record. The quality of your debugging is bounded by the quality
of your tracing.

### Approximate Replay

When post-mortem analysis is not enough and you need to test whether a fix works, you
can attempt approximate replay: send the same inputs to the model and compare the
outputs structurally.

```python
# approximate_replay.py - Re-execute and compare
import json
from pathlib import Path
from difflib import unified_diff

def approximate_replay(original_trace_path: str, trace_id: str,
                       call_model_fn=None):
  """
  Re-execute an agent trace and compare outputs.

  call_model_fn: a function that takes messages and returns a response.
  If None, uses a stub that returns "STUB: no model configured".
  """
  if call_model_fn is None:
    call_model_fn = lambda msgs: "STUB: no model configured"

  spans = []
  with Path(original_trace_path).open() as f:
    for line in f:
      span = json.loads(line)
      if span["trace_id"] == trace_id:
        spans.append(span)

  spans.sort(key=lambda s: s["step"])

  divergences = []
  for i, span in enumerate(spans):
    if span["type"] == "llm_call":
      # In a real implementation, you would reconstruct the
      # message history up to this point from the trace
      messages = [{"role": "user", "content": f"Step {i}: {span['name']}"}]
      new_output = call_model_fn(messages)

      # Compare structure, not exact content
      # (exact match is unrealistic for LLM output)
      original_tokens = span.get("output_tokens", 0)
      new_tokens = len(new_output.split())  # rough approximation

      ratio = new_tokens / max(original_tokens, 1)
      if ratio < 0.5 or ratio > 2.0:
        divergences.append({
          "step": i,
          "name": span["name"],
          "original_tokens": original_tokens,
          "new_tokens": new_tokens,
          "ratio": ratio,
        })

  if divergences:
    print(f"Found {len(divergences)} divergences:")
    for d in divergences:
      print(f"  Step {d['step']} ({d['name']}): "
            f"original={d['original_tokens']} tokens, "
            f"new={d['new_tokens']} tokens, ratio={d['ratio']:.2f}")
  else:
    print("No significant divergences detected")

  return divergences
```

Approximate replay answers a different question than post-mortem replay. Post-mortem
asks "what happened?" Approximate replay asks "would a fix change the outcome?" Neither
gives certainty. Together they give you a diagnostic workflow.

> **AGENTIC GROUNDING:** Deterministic replay tools like `rr` (Mozilla) and Replay.io
> record and replay program execution exactly because the programs are deterministic.
> No equivalent exists for LLM agent systems as of March 2026. The best available
> approach is post-mortem trace analysis (what happened) combined with approximate
> replay (would a change help). Accept this limitation and design your debugging
> workflow around it rather than wishing for tools that do not exist.

---

## 3. Failure Classification

*Estimated time: 35 minutes*

When an agent run fails, the first question is not "what went wrong" but "what kind of
thing went wrong." The failure type determines the diagnosis strategy, the fix category,
and whether you should rerun or fix.

Six categories cover the failure space for agent systems. Each maps to different layers
in the layer model and requires a different debugging approach.

### 3.1 Model Error

**Definition:** The model produced wrong output given correct input. The context was
adequate, the tools were available, the system prompt was clear - and the model still
made a mistake.

**Layer mapping:** L0 (weights), L4 (generation)

**Diagnosis strategy:** Check the trace for the model's input at the failing step. Was
the prompt clear? Were the tool results correct? If the input looks right and the output
is wrong, this is a model error.

**Characteristics:**
- Non-deterministic: the same input may produce correct output on the next run
- More common with ambiguous instructions or complex reasoning chains
- Temperature and sampling affect frequency

**Fix category:** Improve the prompt, add examples, simplify the task, or accept the
error rate and add verification downstream.

```python
# Detecting potential model errors in traces
def find_model_errors(trace_spans):
  """
  A model error is suspected when:
  - Tool results preceding the LLM call were all successful
  - Context token count was within reasonable bounds
  - But the subsequent action was wrong
  """
  for i, span in enumerate(trace_spans):
    if span["type"] != "llm_call":
      continue
    if span.get("status") != "error":
      continue

    # Check preceding tool calls
    prior_tools = [s for s in trace_spans[:i] if s["type"] == "tool_call"]
    all_tools_ok = all(s.get("status") == "ok" for s in prior_tools)

    # Check context size
    cumulative_tokens = sum(
      s.get("input_tokens", 0) + s.get("tool_result_tokens", 0)
      for s in trace_spans[:i]
    )
    context_reasonable = cumulative_tokens < 100000  # below typical limits

    if all_tools_ok and context_reasonable:
      print(f"Suspected model error at step {span['step']}: "
            f"{span['name']}")
      print(f"  All prior tools succeeded, context={cumulative_tokens} tokens")
      print(f"  Error: {span.get('error_message', 'unknown')}")
```

### 3.2 Context Error

**Definition:** The model had wrong or insufficient context to produce a correct output.
This is not a model failure - it is a context failure. The model did its best with what
it was given, but what it was given was inadequate.

**Layer mapping:** L3 (context window), L8 (agent role)

**Diagnosis strategy:** Check token counts at the failing step. Was the context window
near capacity (hot context pressure)? Was critical information missing from the context
(cold context pressure)? Did a previous compaction event lose important context?

**Characteristics:**
- Systematic: will reproduce on rerun with the same context
- Diagnosable from token counts and context content
- Two subtypes: too little context (cold) and too much context (hot)

**Fix category:** For cold context pressure - improve retrieval, add missing information
to the system prompt, ensure relevant tool results are included. For hot context
pressure - implement compaction, summarize tool results, limit context accumulation.

```python
# Detecting context errors from token accumulation patterns
def find_context_pressure(trace_spans, warn_threshold=80000,
                          critical_threshold=150000):
  """
  Track token accumulation across an agent trace.
  Flag when context approaches or exceeds thresholds.
  """
  cumulative = 0
  pressure_events = []

  for span in trace_spans:
    tokens_added = span.get("input_tokens", 0)
    if span["type"] == "tool_call":
      tokens_added += span.get("tool_result_tokens", 0)
    cumulative += tokens_added

    if cumulative > critical_threshold:
      pressure_events.append({
        "step": span["step"],
        "name": span["name"],
        "cumulative_tokens": cumulative,
        "severity": "critical",
        "diagnosis": "hot context pressure - generation quality "
                     "likely degraded",
      })
    elif cumulative > warn_threshold:
      pressure_events.append({
        "step": span["step"],
        "name": span["name"],
        "cumulative_tokens": cumulative,
        "severity": "warning",
        "diagnosis": "approaching context limits - monitor output quality",
      })

  return pressure_events
```

> **AGENTIC GROUNDING:** Cold context pressure and hot context pressure are the two
> modes of context failure. Cold: the agent does not have enough information to solve
> the problem, so it falls back to pattern-matching from training data. Hot: the agent
> has accumulated so much context that the signal-to-noise ratio degrades, attention
> dilutes, and generation quality drops. Both are diagnosable from traces if you track
> token counts per step. Step 5 (state management) covered how state corruption can
> create cold context pressure by failing to load necessary state at boot time.

### 3.3 Tool Error

**Definition:** A tool returned an error or an unexpected result. The model called the
right tool with reasonable arguments, but the tool itself failed.

**Layer mapping:** L7 (tool calling)

**Diagnosis strategy:** Check the tool call span in the trace. What were the arguments?
What was the return value or error? Was the error transient (network timeout) or
persistent (wrong API endpoint)?

**Characteristics:**
- Often transient: retrying may succeed
- Clear in traces: tool call spans include arguments and results
- Sometimes cascading: one tool failure causes the model to hallucinate a workaround

**Fix category:** Add retry logic, validate tool results, handle error responses
explicitly in the orchestration layer.

### 3.4 Environment Error

**Definition:** An external system that the agent depends on was unavailable, changed,
or returned unexpected data. Not a tool implementation error - the tool is correct, but
the environment it operates in is not.

**Layer mapping:** External (below L0 - outside the agent system entirely)

**Diagnosis strategy:** Check tool call results for HTTP errors, timeouts, or data that
does not match expected schemas. Check whether the same environment was available during
successful runs.

**Characteristics:**
- Time-dependent: may work at some times and fail at others
- Infrastructure-related: network, database, API rate limits
- Outside the agent's control

**Fix category:** Circuit breakers, fallback strategies, environment health checks
before starting the agent run.

### 3.5 Orchestration Error

**Definition:** The agent framework made a wrong routing decision. The model's output
was reasonable, the tools were available, but the orchestration layer (the harness at L6)
mishandled the flow.

**Layer mapping:** L6 (harness)

**Diagnosis strategy:** Check the trace for unexpected step transitions. Did the agent
skip a planned step? Did it route to the wrong tool? Did the loop termination condition
trigger too early or too late?

**Characteristics:**
- Deterministic: will reproduce with the same orchestration code
- Framework-dependent: different frameworks have different failure modes
- Often subtle: the agent "works" but follows the wrong path

**Fix category:** Fix the orchestration logic, add assertions on step transitions,
improve loop termination conditions.

### 3.6 State Error

**Definition:** The agent acted on stale or corrupted state from a previous run, a
concurrent process, or a failed state update. Step 5 (state management) covered state
design in detail. This is what happens when state management goes wrong at runtime.

**Layer mapping:** Application state (interacts with L3 through L8, depending on how
state enters the context)

**Diagnosis strategy:** Check the trace for state reads. Was the state current? Did it
match expected values? Is there a concurrent process that could have modified the state?

**Characteristics:**
- Requires cross-run analysis: compare state at read time with state at write time
- Related to stale reference propagation (from the slopodar): "when configuration
  documents describe a state that no longer exists, every agent that boots from them
  will hallucinate the described state into reality"
- Can appear as a model error if you do not check the state

**Fix category:** State versioning, state isolation between runs, explicit
initialization, validation after read.

### Classification Summary

| Failure Type | Layer | Reproducible? | Diagnosis Source | First Action |
|-------------|-------|---------------|-----------------|-------------|
| Model | L0, L4 | No (non-deterministic) | Input vs output | Rerun first |
| Context | L3, L8 | Yes (systematic) | Token counts | Check context |
| Tool | L7 | Depends (transient vs persistent) | Tool call spans | Check args and results |
| Environment | External | Time-dependent | Error responses | Check environment |
| Orchestration | L6 | Yes (deterministic) | Step transitions | Check routing logic |
| State | App state | Yes (if state unchanged) | State read spans | Check state freshness |

> **FIELD VS NOVEL:** Incident classification frameworks are well-established in SRE
> (ITIL severity levels, Google's SRE handbook chapter on incident management). The
> model/context/tool/environment/orchestration/state taxonomy is specific to agent
> systems. No published standard taxonomy for agent failure types exists as of March
> 2026. This classification is a useful operational framework, not an industry standard.
> It maps directly to the layer model, which gives it diagnostic power: each failure
> type has a specific set of layers to investigate.

---

## 4. Rerun, Don't Fix

*Estimated time: 25 minutes*

The standing order: "bad output means diagnose, reset, rerun - not fix in place."

This principle is counterintuitive for developers trained on deterministic systems. When
a program produces wrong output, you debug the program and fix the bug. The output then
becomes correct on subsequent runs. The fix and the verification are causally linked:
the fix caused the correct output.

Agent systems break this causal link. The output is probabilistic. A "fix" applied to
one run's output (editing the agent's response, modifying a tool result mid-run,
manually correcting a generated file) does three damaging things:

**1. It corrupts the trace.** The trace now contains a mix of agent-generated and
human-edited content. Post-mortem analysis cannot distinguish between what the agent
did and what the human changed. Root cause analysis becomes impossible because the
evidence has been tampered with.

**2. It does not prevent recurrence.** The next run will produce a new output from
the model's probability distribution. The manual fix to run N has no effect on run
N+1. You have addressed a symptom, not a cause.

**3. It creates a false positive.** The output looks correct after the fix, which
signals that the system works. It does not work. It produced wrong output and a human
patched it. The failure is now hidden instead of diagnosed.

### The Correct Workflow

```
1. Detect failure (from trace, output inspection, or monitoring)
2. Diagnose: classify the failure type (Section 3)
3. Reset: discard the failed run's output entirely
4. Fix the system: change the prompt, tool, context, or orchestration
5. Rerun: execute a fresh run with the system fix
6. Verify: check the new trace for the same failure pattern
```

The key is step 3: discard the output. Do not edit it. Do not salvage it. Do not try
to rescue a partially correct result. The output of a failed run is diagnostic evidence,
not a work product.

### When to Rerun vs When to Fix

Non-determinism works both ways. A failure that appeared once may not appear again. The
decision tree:

```
Was this the first occurrence?
  YES -> Rerun. If it succeeds, the failure was stochastic.
         Monitor for recurrence.
  NO  -> How many times has it occurred?
         1-2 times in 10 runs -> Stochastic. Accept the error rate
                                 or add downstream verification.
         5+ times in 10 runs -> Systematic. Diagnose and fix.
```

For systematic failures (reproducible across runs), the fix targets the system, not the
output:

| Failure Type | System Fix |
|-------------|-----------|
| Model error | Better prompt, simpler task decomposition, examples |
| Context error | Better retrieval, context management, compaction |
| Tool error | Input validation, error handling, retry logic |
| Environment error | Health checks, circuit breakers, fallbacks |
| Orchestration error | Fix routing logic, add assertions |
| State error | State validation, initialization, isolation |

### Immutable Infrastructure Analogy

The "rerun don't fix" principle maps to the immutable infrastructure pattern from
DevOps. Servers are cattle, not pets: when one breaks, you replace it with a new
instance rather than SSH-ing in to fix it. Agent runs are the same. A failed run is
replaced by a new run. The trace from the failed run is the diagnostic record that
informs the system fix.

Bill Baker (Microsoft) and Randy Bias (Cloudscaling) articulated this for servers in
2011-2012. The principle extends naturally to probabilistic computation: when the
computation is non-deterministic, fixing one instance's output is meaningless for future
instances. Only fixing the system (the prompt, the tools, the orchestration) affects
future runs.

> **AGENTIC GROUNDING:** This project's AGENTS.md includes the standing order: "bad
> output means diagnose, reset, rerun - not fix in place." The one-shot agent job
> pattern (called "polecats" in the project vocabulary) embodies this principle at the
> architecture level: fresh context window, one-shot execution, no interactive steering.
> If the output is wrong, the entire run is discarded and re-dispatched. The architecture
> makes "fix in place" structurally impossible, which eliminates the temptation.

---

## 5. Diagnosis by Layer - L0 through L12

*Estimated time: 60 minutes*

This section is the primary novel contribution of this step. The layer model provides
a systematic debugging framework that maps agent failures to specific layers of the
system. No other published framework offers this mapping.

Traditional debugging has the stack trace. Network debugging has the OSI model. Agent
debugging has the layer model. The principle is the same: when something breaks, start
from the bottom and work up (data flow) or from the top and work down (control flow)
until you find the layer where the expected behaviour diverges from the actual behaviour.

The key insight: each layer has different observability characteristics. Some layers
are directly observable (L5 API token counts are exact). Some layers are invisible
(L2 attention weights are not exposed). Some layers require inference from downstream
effects (L3 context pressure is felt in L4 generation quality, not measured directly).
Knowing which layers you can measure and which you must infer is the difference between
diagnosis and guessing.

### L0: Weights - The Frozen Prior

**What it is:** The model's trained parameters. Everything the model "knows" from
pre-training and RLHF. Frozen at inference time. Cannot be modified during a run.

**Diagnostic question:** Is the model fundamentally incapable of this task?

**Observable?** No. L0 is opaque. You cannot inspect weights. You cannot determine
what the model learned during training.

**What to check:**
- Does the model succeed at this task type in isolation (single-turn, no tools)?
- Do other models succeed where this one fails? (If yes, L0 is the difference.)
- Is the task within the model's documented capabilities?

**Try this:** Strip the failing step to a minimal prompt. Remove all tools, all
context, all orchestration. Send just the core question to the model's API. If the
model fails at this minimal version, the problem is at L0 or L4. If it succeeds,
the problem is at a higher layer.

```python
# L0 diagnostic: minimal prompt test
import json

def test_minimal_prompt(question: str, expected_type: str = "any"):
  """
  Test whether the model can answer a question
  without tools, context, or orchestration.

  In practice, replace this with an actual API call.
  """
  minimal_messages = [
    {"role": "user", "content": question}
  ]

  print(f"Minimal prompt test:")
  print(f"  Question: {question}")
  print(f"  Messages: {json.dumps(minimal_messages, indent=2)}")
  print(f"  Expected output type: {expected_type}")
  print(f"  -> Send this to the model API directly.")
  print(f"  -> If it fails: L0/L4 issue (model capability).")
  print(f"  -> If it succeeds: the problem is above L0.")
```

**Common L0 finding:** The model can do the task. Most failures are not L0 failures.
If you reach L0 in your diagnosis and the model passes the minimal test, move to
higher layers. L0 is the layer of last resort in diagnosis - check everything else
first.

### L1: Tokenization - The Budget Boundary

**What it is:** Text converted to token IDs. The context window's absolute size is
set here. Deterministic and verifiable.

**Diagnostic question:** Did the input exceed the token budget? Did tokenization
boundaries cause unexpected behaviour?

**Observable?** Yes. Tokenizers are deterministic. You can count tokens exactly.

**What to check:**
- Total token count at the point of failure (from trace data or API usage fields)
- Whether the input was truncated by the API
- Whether tokenization split a critical term in an unexpected way (rare but real)

**Try this:** Sum the `input_tokens` and `output_tokens` from your trace spans up to
the failure point. Compare against the model's context window limit. If you are near
the limit, the problem may be L1 (truncation) or L3 (attention degradation).

```python
# L1 diagnostic: token budget check
def check_token_budget(trace_spans, model_context_limit=200000):
  """
  Check whether the trace approached or exceeded the token budget.
  """
  cumulative = 0
  for span in trace_spans:
    cumulative += span.get("input_tokens", 0)
    cumulative += span.get("output_tokens", 0)
    if span["type"] == "tool_call":
      cumulative += span.get("tool_result_tokens", 0)

    utilisation = cumulative / model_context_limit
    if utilisation > 0.8:
      print(f"Step {span['step']}: {utilisation:.0%} of context budget "
            f"({cumulative}/{model_context_limit} tokens)")
      if utilisation > 0.95:
        print(f"  CRITICAL: near or at context limit. "
              f"Expect truncation or degraded output.")

  return cumulative
```

### L2: Attention - The Invisible Degradation

**What it is:** Each token attends to all prior tokens. Cost is quadratic. Quality
degrades as context length grows. This degradation is real but invisible - no API
exposes attention weights.

**Diagnostic question:** Is context length causing attention to dilute across too many
tokens, degrading the model's ability to focus on relevant information?

**Observable?** No. Attention weights are not exposed. You infer L2 problems from L4
output quality.

**What to check:**
- Did output quality degrade as context grew? (Compare early-step output quality to
  late-step output quality within the same trace.)
- Is critical information in the "lost in the middle" position? (Research shows models
  attend more to content at the beginning and end of the context, less to content in
  the middle.)

**Try this:** If you suspect attention dilution, test by reordering the context. Move
critical information to the beginning or end. If the model's output improves, L2
attention effects are likely the cause.

```python
# L2 diagnostic: output quality degradation over context length
def check_quality_degradation(trace_spans):
  """
  Compare output characteristics at the start vs end of a trace.
  Proxies for quality: output token count stability, error rates.

  This is an indirect measure - L2 is not directly observable.
  """
  llm_spans = [s for s in trace_spans if s["type"] == "llm_call"]
  if len(llm_spans) < 3:
    print("Not enough LLM calls to assess degradation")
    return

  first_half = llm_spans[:len(llm_spans)//2]
  second_half = llm_spans[len(llm_spans)//2:]

  first_avg_output = (
    sum(s.get("output_tokens", 0) for s in first_half) / len(first_half)
  )
  second_avg_output = (
    sum(s.get("output_tokens", 0) for s in second_half) / len(second_half)
  )

  first_error_rate = (
    sum(1 for s in first_half if s.get("status") == "error") / len(first_half)
  )
  second_error_rate = (
    sum(1 for s in second_half if s.get("status") == "error")
    / len(second_half)
  )

  print(f"First half ({len(first_half)} calls): "
        f"avg_output={first_avg_output:.0f} tokens, "
        f"error_rate={first_error_rate:.0%}")
  print(f"Second half ({len(second_half)} calls): "
        f"avg_output={second_avg_output:.0f} tokens, "
        f"error_rate={second_error_rate:.0%}")

  if second_error_rate > first_error_rate + 0.1:
    print("  -> Error rate increased in second half. "
          "Possible L2/L3 degradation.")
  if second_avg_output < first_avg_output * 0.5:
    print("  -> Output length dropped significantly. "
          "Possible attention dilution.")
```

### L3: Context Window Dynamics - The Pressure Chamber

**What it is:** The utilization and dynamics of the context window. Includes primacy
bias (beginning of context gets more attention), recency bias (end of context gets more
attention), lost-in-the-middle effects, and the critical phase transition of compaction.

**Diagnostic question:** Was the context window under pressure? Did the agent have too
little context (cold), too much context (hot), or did it hit a compaction event?

**Observable?** Partially. Token counts are exact (from L5). Attention distribution is
not observable. The phase transition of compaction is a discrete event: one moment you
have 200k tokens of context, the next moment you have only recovery tokens.

**What to check:**
- Token utilization curve through the trace (is it climbing toward limits?)
- Whether tool results were excessively large (each tool result costs context budget)
- Whether the system prompt was still effective in late steps (L8 role fidelity
  degrades as L3 fills)
- Whether a compaction event occurred (visible as a sudden drop in cumulative tokens)

**Try this:** Plot token accumulation across trace steps. Look for inflection points
where the curve steepens (heavy tool use) or drops (compaction). Compare output quality
before and after these inflection points.

```sql
-- L3 diagnostic: token accumulation by step (DuckDB)
-- Load trace spans into DuckDB and analyze context pressure

CREATE TABLE trace_spans AS
SELECT * FROM read_json('sample_traces.jsonl', auto_detect=true);

-- Token accumulation curve per trace
SELECT
  trace_id,
  step,
  name,
  type,
  input_tokens,
  COALESCE(tool_result_tokens, 0) AS tool_result_tokens,
  SUM(input_tokens + COALESCE(tool_result_tokens, 0))
    OVER (PARTITION BY trace_id ORDER BY step) AS cumulative_tokens,
  status
FROM trace_spans
WHERE trace_id = 'trace-fail-002'  -- The context overflow trace
ORDER BY step;
```

**L3 is the layer where cold context pressure and hot context pressure become
diagnosable.** Cold: the cumulative token count is low but the agent is failing -
it does not have enough context to solve the problem. Hot: the cumulative token count
is high and output quality is degrading - the context is saturated with information
and the model cannot attend to all of it.

> **FIELD VS NOVEL:** The "lost in the middle" effect is documented in Liu et al.
> (2023, "Lost in the Middle: How Language Models Use Long Contexts"). Context window
> management is a growing area of research. The novel contribution here is framing
> cold and hot context pressure as named, diagnosable failure modes with specific
> remediation strategies, and connecting them to the layer model. The layer model
> gives these pressure states a precise location (L3) and distinguishes them from
> model errors (L0/L4), tool errors (L7), or orchestration errors (L6).

### L4: Generation - The Autoregressive Trap

**What it is:** Token-by-token generation. Each token conditions the next. No
lookahead, no revision. Once a token is generated, it cannot be changed.

**Diagnostic question:** Did the model start generating in a wrong direction and
commit to it because it cannot revise?

**Observable?** Partially. If the harness exposes reasoning tokens (extended thinking),
these show the model's generation process. Output tokens are always visible.

**What to check:**
- Reasoning tokens (if available) - did the model's reasoning chain go wrong?
- Did the model start with a wrong premise and follow it to a wrong conclusion?
  (Look for outputs that are internally consistent but based on a wrong assumption.)
- Was the output cut short by a max_tokens limit?

**Try this:** If reasoning tokens are available, read them. They show the model's
thought process. Look for the point where reasoning diverges from the task. If reasoning
tokens are not available, examine whether the output is internally consistent (suggests
a committed-wrong-direction L4 issue) or internally inconsistent (suggests L3 context
corruption).

### L5: API - The Calibration Layer

**What it is:** The API request/response boundary. Token counts, costs, cache hits,
stop reasons. The only fully calibrated layer in the stack - every measurement here
is exact.

**Diagnostic question:** Do the API-level metrics show anything anomalous?

**Observable?** Yes, completely. L5 is the only layer where all measurements are exact.

**What to check:**
- `usage.input_tokens` and `usage.output_tokens` from the API response
- `stop_reason`: did the model stop normally, hit max_tokens, or encounter an error?
- Cache hit rates: is prompt caching working as expected?
- Response time: was there unusual latency?

**Try this:** Query your traces for API-level metadata. Anomalies here are always
significant because the measurements are exact.

```sql
-- L5 diagnostic: API-level anomalies (DuckDB)
SELECT
  trace_id,
  step,
  name,
  input_tokens,
  output_tokens,
  duration_ms,
  status,
  -- Flag anomalous response times
  CASE WHEN duration_ms > 10000 THEN 'SLOW'
       WHEN duration_ms < 50 THEN 'SUSPICIOUSLY_FAST'
       ELSE 'normal' END AS latency_flag,
  -- Flag anomalous output sizes
  CASE WHEN output_tokens < 10 THEN 'VERY_SHORT'
       WHEN output_tokens > 4000 THEN 'VERY_LONG'
       ELSE 'normal' END AS output_flag
FROM trace_spans
WHERE type = 'llm_call'
ORDER BY trace_id, step;
```

### L6: Harness - The Invisible Mediator

**What it is:** The orchestration layer that manages tools, context, and subagents.
In frameworks like LangChain, CrewAI, or custom agent loops, L6 is the code that
decides what happens between model calls.

**Diagnostic question:** Did the harness make a wrong routing decision, inject
unexpected context, or mishandle a tool result?

**Observable?** Only through its effects. The harness may inject system reminders,
context management instructions, or tool schemas that are not visible in your traces
unless you explicitly log them.

**What to check:**
- Step transitions: did the agent follow the expected workflow?
- Tool dispatch: did the harness send tool calls to the right tools?
- Context injection: did the harness add or remove context between steps?
- Loop termination: did the harness stop the loop at the right time?

**Try this:** Add logging to your harness code (if you control it) that records every
decision the harness makes: which tool to dispatch, what context to inject, when to
terminate. Compare the harness decisions against the expected workflow.

```python
# L6 diagnostic: step transition analysis
def analyze_step_transitions(trace_spans):
  """
  Check whether step transitions follow expected patterns.
  Unexpected transitions suggest L6 orchestration issues.
  """
  expected_patterns = {
    "plan": {"search", "read_file", "analyze"},
    "search": {"read_file", "analyze", "search"},  # search can repeat
    "read_file": {"analyze", "read_file", "search"},
    "analyze": {"write_file", "summarize", "search"},
    "write_file": {"summarize", "verify"},
    "summarize": set(),  # terminal
  }

  for i in range(len(trace_spans) - 1):
    current = trace_spans[i]["name"]
    next_step = trace_spans[i + 1]["name"]

    # Strip numeric suffixes for pattern matching
    current_base = current.rstrip("_0123456789")
    next_base = next_step.rstrip("_0123456789")

    if current_base in expected_patterns:
      if (expected_patterns[current_base] and
          next_base not in expected_patterns[current_base]):
        print(f"Unexpected transition at step {trace_spans[i]['step']}: "
              f"{current} -> {next_step}")
        print(f"  Expected next: {expected_patterns[current_base]}")
```

### L7: Tool Calling - The Verification Channel

**What it is:** The interface between the model and the external world. The model
requests tool calls. The harness executes them. Results are injected back into context.

**Diagnostic question:** Did the model call the right tool with the right arguments?
Did the tool return the expected result? Did the tool result cost too many tokens?

**Observable?** Yes - tool calls are the most observable layer in the stack because
both the request (tool name, arguments) and the response (tool result) are recorded
in traces.

**What to check:**
- Tool name: is this the right tool for this task?
- Arguments: do they match the tool's schema? Are any arguments hallucinated?
- Result: did the tool succeed? Is the result what was expected?
- Result size: did the tool result consume an excessive portion of the context budget?

**Try this:** For each tool call in a failed trace, validate the arguments against the
tool's schema and check the result against expected behavior.

```python
# L7 diagnostic: tool call validation
def validate_tool_calls(trace_spans, known_tools: set):
  """
  Check tool calls against known tool registry.
  Detect hallucinated tools, invalid arguments, and oversized results.
  """
  issues = []

  for span in trace_spans:
    if span["type"] != "tool_call":
      continue

    tool_name = span.get("tool_name", "unknown")
    tool_args = span.get("tool_args", {})
    result_tokens = span.get("tool_result_tokens", 0)

    # Check 1: is this a known tool?
    if tool_name not in known_tools:
      issues.append({
        "step": span["step"],
        "issue": "hallucinated_tool",
        "detail": f"Tool '{tool_name}' not in registry: {known_tools}",
      })

    # Check 2: did the result consume excessive context?
    if result_tokens > 10000:
      issues.append({
        "step": span["step"],
        "issue": "oversized_result",
        "detail": f"Tool result: {result_tokens} tokens "
                  f"(consider truncating)",
      })

    # Check 3: did the tool fail?
    if span.get("status") == "error":
      issues.append({
        "step": span["step"],
        "issue": "tool_error",
        "detail": span.get("error_message", "unknown error"),
      })

  return issues
```

> **AGENTIC GROUNDING:** The project's standing order "do not infer what you can
> verify" (AGENTS.md) is a L7 principle. Tools are the model's empirical contact with
> the external world. When an agent hallucinates a file path, the tool call fails.
> When an agent invents a database query, the tool reports the error. L7 is the layer
> where the model's internal representations meet external reality, and the collision
> is recorded in the trace. This is why tool call traces are the richest source of
> debugging information.

### L8: Agent Role - The Steering Context

**What it is:** The system prompt, role definition, and grounding instructions that
shape the model's behaviour. Occupies high-attention positions (primacy bias at L3).

**Diagnostic question:** Is the system prompt adequate for the task? Is it too long
(consuming context budget)? Is it contradictory? Does it degrade as L3 fills?

**Observable?** Yes, if you record the system prompt in your traces. The content is
known. The effect on behaviour requires comparison across runs.

**What to check:**
- Is the system prompt included in your trace? (If not, you cannot diagnose L8 issues.)
- How much context budget does the system prompt consume?
- Does the agent follow system prompt instructions in early steps but deviate in later
  steps? (This suggests L8 fidelity degradation as L3 fills.)
- Does the system prompt contain stale references that no longer match reality?

**Try this:** Compare agent behaviour in step 1 (where the system prompt has maximum
influence due to primacy bias) with behaviour in step 20 (where accumulated context
has diluted the system prompt's influence). If behaviour diverges, L8 fidelity is
degrading.

```python
# L8 diagnostic: role fidelity over time
def check_role_fidelity(trace_spans, expected_behavior_markers: list):
  """
  Check whether the agent's behavior remains consistent with
  its role definition throughout the trace.

  expected_behavior_markers: list of strings that should appear
  in the agent's outputs if it's following its role correctly.
  """
  llm_spans = [s for s in trace_spans if s["type"] == "llm_call"]

  for i, span in enumerate(llm_spans):
    position = "early" if i < len(llm_spans) // 3 else (
      "middle" if i < 2 * len(llm_spans) // 3 else "late"
    )

    # In a real implementation, you would check the actual output
    # content against expected markers. With trace data, you check
    # proxy indicators.
    print(f"Step {span['step']} ({position}): "
          f"output_tokens={span.get('output_tokens', 0)}, "
          f"status={span.get('status', 'ok')}")
```

### L9: Thread Position - The Self-Reinforcing Loop

**What it is:** The accumulated effect of the model's own outputs becoming part of its
input on subsequent turns. Each output reinforces certain patterns, creating anchoring
effects that constrain future generation.

**Diagnostic question:** Is the agent stuck in a self-reinforcing loop? Has its
behaviour narrowed over the course of the conversation to the point where it cannot
consider alternatives?

**Observable?** Indirectly. You observe L9 effects through L4 output patterns. If the
agent's outputs become increasingly repetitive, if it anchors on a wrong approach and
cannot break free, if it agrees with itself across turns - these are L9 symptoms.

**What to check:**
- Is the agent repeating the same tool calls? (Loop detection)
- Is the agent producing increasingly similar outputs across steps?
- Did the agent commit to a wrong approach early and double down on it?
- Is there evidence of sycophantic drift (the lullaby pattern - confidence increases
  and hedging decreases over the session)?

**Try this:** Check for repeated tool calls and converging output patterns.

```python
# L9 diagnostic: self-reinforcing loop detection
from collections import Counter

def detect_self_reinforcing_loops(trace_spans):
  """
  Detect patterns that suggest L9 anchoring:
  - Repeated identical tool calls
  - Decreasing output diversity
  - Escalating confidence without new information
  """
  # Check 1: repeated tool calls
  tool_calls = [
    (s.get("tool_name"), json.dumps(s.get("tool_args", {}), sort_keys=True))
    for s in trace_spans if s["type"] == "tool_call"
  ]
  tool_call_counts = Counter(tool_calls)
  repeated = {k: v for k, v in tool_call_counts.items() if v > 2}

  if repeated:
    print("Repeated tool calls (possible L9 loop):")
    for (tool, args), count in repeated.items():
      print(f"  {tool}({args[:60]}...): called {count} times")

  # Check 2: output token convergence
  # If outputs become increasingly similar in length, the model
  # may be anchoring on a generation pattern
  llm_outputs = [
    s.get("output_tokens", 0)
    for s in trace_spans if s["type"] == "llm_call"
  ]
  if len(llm_outputs) >= 4:
    first_half_var = _variance(llm_outputs[:len(llm_outputs)//2])
    second_half_var = _variance(llm_outputs[len(llm_outputs)//2:])

    if second_half_var < first_half_var * 0.3 and first_half_var > 0:
      print("Output token variance decreased significantly "
            "(possible anchoring)")
      print(f"  First half variance: {first_half_var:.0f}")
      print(f"  Second half variance: {second_half_var:.0f}")

  return repeated

def _variance(values):
  if len(values) < 2:
    return 0
  mean = sum(values) / len(values)
  return sum((v - mean) ** 2 for v in values) / len(values)
```

L9 is where two of the project's named foot guns manifest. **Spinning to infinity:**
the agent enters a recursive meta-analysis loop, consuming context without making
decisions. **High on own supply:** a sycophantic feedback loop where the agent's prior
outputs reinforce increasingly confident but unchecked assertions.

The antidote to L9 problems is often structural: fresh context windows (new runs break
the anchoring chain), external verification (tool calls that bring in new information),
or explicit loop detection at L6 that terminates the run when repetition is detected.

> **FIELD VS NOVEL:** Anchoring bias in human cognition is well-documented (Tversky &
> Kahneman, 1974). Sycophancy in LLMs is an active research area (Perez et al., 2022,
> "Discovering Language Model Behaviors with Model-Written Evaluations"). The novel
> contribution is identifying L9 thread position as the mechanism that produces both
> anchoring and sycophancy in agent systems, and connecting it to diagnosable patterns
> in traces. The self-reinforcing loop - where the model's outputs become part of its
> input and constrain future outputs - is structural to autoregressive generation, not
> a bug to be fixed. It can only be managed through architectural controls (context
> window resets, external verification, loop limits).

### L10: Multi-Agent - The Correlated Blind Spot

**What it is:** Multiple agents from the same model family. They share the same
weights (L0), the same inductive biases, and the same blind spots. Consensus among
them is consistency, not validation.

**Diagnostic question:** If multiple agents agree on a wrong answer, is it because
they are independently correct or because they share the same bias?

**Observable?** Only through cross-model comparison (L11). Within L10, you can
measure agreement, but you cannot distinguish agreement from shared error.

**What to check:**
- If multiple agents reviewed the same output and all approved, check whether a
  different model would have caught the error
- If an ensemble of agents all fail the same way, the failure is at L0 (shared
  weights) not at a higher layer

**Try this:** When multi-agent review passes but the output is wrong, run the same
review with a different model (L11). If the different model catches the error, the
failure was correlated bias at L10. If it does not, the error may be genuinely
difficult to detect.

### L11: Cross-Model - The Independent Signal

**What it is:** Different models with different training data, different RLHF, and
different inductive biases. The only way to get truly independent signal in automated
evaluation.

**Diagnostic question:** Is this failure specific to one model, or does every model
fail the same way?

**Observable?** Yes, through comparison. Run the same task on multiple models and
compare results.

**What to check:**
- Model A fails but Model B succeeds: the failure is likely L0-specific (Model A's
  weights cannot handle this task)
- Both Model A and Model B fail the same way: the failure is likely at a higher layer
  (context, tools, orchestration) or the task is genuinely difficult
- Models disagree: the divergence reveals where model-specific biases differ

**Try this:** For persistent failures, test with at least one alternative model. The
cost is low (one API call) and the diagnostic value is high (it eliminates or confirms
L0 as the cause).

### L12: Human in the Loop - The Irreducible Layer

**What it is:** The human operator who reviews outputs, provides rubrics, makes
decisions, and catches what automated systems miss. The only truly model-independent
layer. Cannot be scaled. Cannot be automated. Can be informed by L0-L11.

**Diagnostic question:** Did the human miss something? Did the human provide wrong
instructions? Is the human's judgment calibrated?

**Observable?** Only through self-reflection and external audit. L12 is the oracle
that cannot verify itself without external reference.

**What to check:**
- Were the instructions clear? (A failure classified as "model error" may actually be
  "human instruction error" when the prompt is ambiguous.)
- Did the human verify the output or just accept it? (Automation bias: humans accept
  AI output at higher rates than equivalent human output, even when it contains errors.
  Dell'Acqua et al. 2023.)
- Is cognitive deskilling occurring? (The METR RCT, 2025: experienced developers were
  19% slower with AI tools while believing they were 24% faster. A 40-point
  perception-reality gap.)

**Try this:** Have a second person review the same failure. If they reach a different
diagnosis, L12 is the variable. The oracle problem - the human whose judgment all
verification depends on - cannot be solved from within the system. It can only be
mitigated through structured review processes and external validation.

### The Layer Diagnosis Workflow

When a failure occurs, the diagnostic workflow moves through layers systematically:

```
Start at the failure point in the trace.

1. L5 (API): Check metrics. Any anomalies in token counts, latency, stop reason?
2. L7 (Tools): Check tool calls. Right tool? Right args? Right result?
3. L3 (Context): Check token accumulation. Cold pressure? Hot pressure?
4. L8 (Role): Check system prompt. Still effective at this point in the trace?
5. L9 (Thread): Check for loops, anchoring, repetition.
6. L6 (Harness): Check step transitions. Did the orchestration make correct routing?
7. L4 (Generation): Check output quality. Internally consistent but wrong?
8. L0 (Weights): Minimal prompt test. Can the model do this at all?
9. L10/L11 (Multi/Cross): Was this model-specific? Test with another model.
10. L12 (Human): Were the instructions right? Was verification adequate?
```

Start with the observable layers (L5, L7) and work toward the less observable ones
(L2, L0). This is efficient because observable layers give you data, while less
observable layers require inference.

> **FIELD VS NOVEL:** The OSI model (ISO 7498-1:1994) provides a layered debugging
> framework for network protocols - when a connection fails, you diagnose at the
> physical layer, data link layer, network layer, and so on up the stack. The TCP/IP
> model simplifies this for practical use. No equivalent layered debugging model exists
> for LLM agent systems. The L0-L12 layer model fills this gap. Like the OSI model,
> it provides a systematic place to look at each level of abstraction. Unlike the OSI
> model, several layers (L0, L2, L9) are not directly observable, which means diagnosis
> requires inference from downstream effects rather than direct measurement.

---

## 6. Common Debugging Patterns

*Estimated time: 35 minutes*

Five named patterns appear repeatedly in agent failure traces. Each has a signature
in the trace, a root cause at a specific layer, and a standard remediation.

### 6.1 The Infinite Loop

**Signature:** The same tool is called repeatedly with identical or near-identical
arguments. Step count is abnormally high. The trace shows 10, 20, 50 iterations of
the same operation.

**Root cause layers:** L6 (missing termination condition), L9 (self-reinforcing loop
where each iteration's output confirms the need for another iteration)

**Diagnosis from trace:**

```sql
-- Detect infinite loops: same tool called > 3 times in a trace
SELECT
  trace_id,
  tool_name,
  COUNT(*) AS call_count,
  COUNT(DISTINCT tool_args::VARCHAR) AS unique_args
FROM trace_spans
WHERE type = 'tool_call'
GROUP BY trace_id, tool_name
HAVING COUNT(*) > 3
ORDER BY call_count DESC;
```

**Remediation:**
- Add a maximum iteration count to the agent loop (L6 fix)
- Add loop detection that checks for repeated tool calls (L6 fix)
- Inject a "you have already tried this" message into context when repetition is
  detected (L3/L8 fix)

```python
# Loop detection at the orchestration level
def should_continue(trace_so_far: list, max_iterations: int = 20,
                    max_repeats: int = 3):
  """
  Returns False if the agent should stop.
  Checks total iterations and repeated tool calls.
  """
  if len(trace_so_far) >= max_iterations:
    return False

  # Check for repeated tool calls
  recent_tools = [
    (s.get("tool_name"), json.dumps(s.get("tool_args", {}), sort_keys=True))
    for s in trace_so_far[-10:]
    if s["type"] == "tool_call"
  ]
  counts = Counter(recent_tools)
  if any(v >= max_repeats for v in counts.values()):
    return False

  return True
```

### 6.2 The Wrong Tool

**Signature:** The agent selects a tool that exists in its registry but is not
appropriate for the current task. The tool call succeeds (no error), but the result
is irrelevant or misleading.

**Root cause layers:** L8 (tool descriptions in the system prompt are ambiguous or
misleading), L0/L4 (model misunderstands the task and selects the wrong tool)

**Diagnosis from trace:** Compare the tool called with the task described in the
preceding LLM call. Does the tool match the task? Check the tool descriptions in the
system prompt - are they unambiguous?

**Remediation:**
- Improve tool descriptions (L8 fix: make each tool's purpose unambiguous)
- Add tool selection constraints (L6 fix: restrict which tools are available at each
  step)
- Add examples of correct tool selection to the system prompt (L8 fix)

### 6.3 The Hallucinated Tool Call

**Signature:** The agent attempts to call a tool that does not exist, or passes
arguments that do not match the tool's schema. The harness returns an error because
the tool or argument is not recognized.

**Root cause layers:** L0/L4 (model generates a tool call from training data rather
than from the available tool list), L8 (tool schemas are not clearly defined in the
system prompt)

**Diagnosis from trace:**

```python
# Detect hallucinated tool calls
def find_hallucinated_calls(trace_spans, tool_registry: dict):
  """
  tool_registry: dict mapping tool_name -> expected argument keys
  """
  hallucinated = []

  for span in trace_spans:
    if span["type"] != "tool_call":
      continue

    tool = span.get("tool_name", "")
    args = span.get("tool_args", {})

    if tool not in tool_registry:
      hallucinated.append({
        "step": span["step"],
        "issue": "unknown_tool",
        "tool": tool,
        "detail": f"Tool '{tool}' not in registry",
      })
    else:
      expected_keys = tool_registry[tool]
      unexpected = set(args.keys()) - set(expected_keys)
      missing = set(expected_keys) - set(args.keys())
      if unexpected:
        hallucinated.append({
          "step": span["step"],
          "issue": "unexpected_args",
          "tool": tool,
          "detail": f"Unexpected arguments: {unexpected}",
        })
      if missing:
        hallucinated.append({
          "step": span["step"],
          "issue": "missing_args",
          "tool": tool,
          "detail": f"Missing required arguments: {missing}",
        })

  return hallucinated
```

**Remediation:**
- Use stricter structured output constraints (force the model to select from a fixed
  list of tools)
- Add a validation layer between model output and tool dispatch that rejects
  non-existent tools
- Ensure tool schemas are complete and unambiguous in the system prompt

### 6.4 The Context Overflow

**Signature:** Output quality degrades in the later steps of a long agent run. The
model produces shorter, less coherent, or less relevant outputs as context accumulates.
No explicit error - the degradation is gradual.

**Root cause layers:** L3 (context window approaching capacity), L2 (attention dilution
over long context), L7 (tool results consuming excessive context budget)

**Diagnosis from trace:**

```sql
-- Track output quality degradation over context accumulation (DuckDB)
WITH token_curve AS (
  SELECT
    trace_id,
    step,
    type,
    input_tokens + COALESCE(tool_result_tokens, 0) AS tokens_added,
    SUM(input_tokens + COALESCE(tool_result_tokens, 0))
      OVER (PARTITION BY trace_id ORDER BY step) AS cumulative_tokens,
    output_tokens,
    status
  FROM trace_spans
  WHERE trace_id = 'trace-fail-002'
)
SELECT
  step,
  type,
  tokens_added,
  cumulative_tokens,
  output_tokens,
  status,
  ROUND(cumulative_tokens * 100.0 / 200000, 1) AS pct_of_200k_limit
FROM token_curve
ORDER BY step;
```

**Remediation:**
- Implement context compaction: summarize tool results before adding them to context
- Limit tool result size: truncate large results to a fixed token budget
- Use a sliding window: only keep the N most recent interactions in context, summarize
  the rest
- Break long tasks into subtasks with fresh context windows (the polecat pattern)

### 6.5 The State Corruption

**Signature:** The agent acts on information that is no longer current. It references
files that have been deleted, uses configuration values from a previous run, or builds
on a plan that was superseded. The trace shows a state read followed by actions that
are correct for the read state but wrong for the actual state.

**Root cause layers:** Application state (cross-run contamination), L8 (stale reference
propagation from boot files)

**Diagnosis from trace:** Compare state read values in the trace with the actual state
at the time of the run. This requires either timestamped state snapshots or version
control (git) to reconstruct what the state looked like when the agent read it.

Step 5 (state management) covered state design patterns specifically to prevent this
failure mode. When it occurs despite those patterns, the diagnosis focuses on which
state management rule was violated:

- Was state properly initialized at the start of the run?
- Was state isolated between concurrent runs?
- Was state validated after reading and before acting?

**Remediation:**
- Validate state freshness on read (check timestamps, versions)
- Isolate state between runs (each run gets its own state directory or namespace)
- Use explicit initialization instead of relying on state from previous runs
- Add a "state health check" step at the start of each agent run

```python
# State freshness validation
import os
import time

def validate_state_freshness(state_path: str, max_age_seconds: int = 3600):
  """
  Check whether a state file is stale.
  Returns (is_fresh, age_seconds, detail).
  """
  if not os.path.exists(state_path):
    return False, -1, f"State file does not exist: {state_path}"

  mtime = os.path.getmtime(state_path)
  age = time.time() - mtime

  if age > max_age_seconds:
    return False, age, (
      f"State file is {age:.0f}s old "
      f"(max: {max_age_seconds}s): {state_path}"
    )

  return True, age, f"State file is {age:.0f}s old (fresh)"
```

> **SLOPODAR:** State corruption in agent systems is the runtime manifestation of
> stale reference propagation: "when configuration documents describe a state that no
> longer exists, every agent that boots from them will hallucinate the described state
> into reality." The same failure mode that corrupts agent boot files (documented in
> the slopodar) corrupts runtime state. The mechanism is identical: the agent reads
> a representation of the world, trusts it as current, and acts on it. If the
> representation is stale, the actions are wrong.

---

## 7. Debugging in Production

*Estimated time: 30 minutes*

Production failures have a constraint that development failures do not: you cannot
attach a debugger, you cannot add print statements, and you cannot reproduce the exact
conditions. The only evidence you have is the trace that was recorded during the run.

### Trace-Based Post-Mortem

The post-mortem workflow for production agent failures:

```
1. Pull the trace for the failed run
2. Replay step by step (Section 2)
3. Classify the failure (Section 3)
4. Locate the failure layer (Section 5)
5. Determine: systematic or stochastic?
6. If systematic: fix the system, deploy, monitor
7. If stochastic: monitor for recurrence, set alert threshold
```

The quality of this workflow depends entirely on the quality of your tracing from
Step 7. If your traces do not include tool call arguments, you cannot diagnose tool
errors. If your traces do not include token counts, you cannot diagnose context
pressure. If your traces do not include timestamps, you cannot correlate with
environment events.

### Statistical Debugging

When individual trace analysis does not reveal a pattern, aggregate analysis across
many traces can. If 5% of runs fail, the question becomes: what do the failing runs
have in common?

```sql
-- Statistical debugging: what do failing traces have in common? (DuckDB)

-- Failure rate by error type
SELECT
  error_type,
  COUNT(*) AS failure_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(DISTINCT trace_id) FROM trace_spans),
    1) AS failure_pct
FROM trace_spans
WHERE status = 'error'
GROUP BY error_type
ORDER BY failure_count DESC;

-- Average step count: failing vs successful traces
WITH trace_outcomes AS (
  SELECT
    trace_id,
    MAX(step) + 1 AS step_count,
    MAX(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS has_failure
  FROM trace_spans
  GROUP BY trace_id
)
SELECT
  CASE WHEN has_failure = 1 THEN 'failed' ELSE 'succeeded' END AS outcome,
  COUNT(*) AS trace_count,
  ROUND(AVG(step_count), 1) AS avg_steps,
  MIN(step_count) AS min_steps,
  MAX(step_count) AS max_steps
FROM trace_outcomes
GROUP BY has_failure;

-- Token consumption: failing vs successful traces
WITH trace_tokens AS (
  SELECT
    trace_id,
    SUM(input_tokens + COALESCE(tool_result_tokens, 0)) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    MAX(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS has_failure
  FROM trace_spans
  GROUP BY trace_id
)
SELECT
  CASE WHEN has_failure = 1 THEN 'failed' ELSE 'succeeded' END AS outcome,
  ROUND(AVG(total_input_tokens), 0) AS avg_input_tokens,
  ROUND(AVG(total_output_tokens), 0) AS avg_output_tokens,
  ROUND(AVG(total_input_tokens + total_output_tokens), 0) AS avg_total_tokens
FROM trace_tokens
GROUP BY has_failure;
```

### Correlation Analysis

Beyond aggregate statistics, look for correlations between failure and specific
conditions:

```sql
-- Do failures correlate with specific tools?
SELECT
  tool_name,
  COUNT(*) AS total_calls,
  SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_calls,
  ROUND(
    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1
  ) AS error_rate_pct
FROM trace_spans
WHERE type = 'tool_call'
GROUP BY tool_name
HAVING COUNT(*) > 2
ORDER BY error_rate_pct DESC;

-- Do failures correlate with time of day?
-- (Useful for detecting environment issues like peak load)
SELECT
  EXTRACT(HOUR FROM start_time::TIMESTAMP) AS hour_of_day,
  COUNT(DISTINCT trace_id) AS traces_this_hour,
  COUNT(DISTINCT CASE WHEN status = 'error' THEN trace_id END)
    AS failed_traces,
  ROUND(
    COUNT(DISTINCT CASE WHEN status = 'error' THEN trace_id END) * 100.0
    / COUNT(DISTINCT trace_id), 1
  ) AS failure_rate_pct
FROM trace_spans
GROUP BY hour_of_day
HAVING COUNT(DISTINCT trace_id) > 1
ORDER BY hour_of_day;

-- Do failures correlate with context size?
WITH trace_context AS (
  SELECT
    trace_id,
    MAX(
      SUM(input_tokens + COALESCE(tool_result_tokens, 0))
      OVER (PARTITION BY trace_id ORDER BY step)
    ) AS peak_context_tokens,
    MAX(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS has_failure
  FROM trace_spans
  GROUP BY trace_id
)
SELECT
  CASE
    WHEN peak_context_tokens < 10000 THEN 'small (<10k)'
    WHEN peak_context_tokens < 50000 THEN 'medium (10k-50k)'
    WHEN peak_context_tokens < 100000 THEN 'large (50k-100k)'
    ELSE 'very large (>100k)'
  END AS context_size_bucket,
  COUNT(*) AS trace_count,
  SUM(has_failure) AS failure_count,
  ROUND(SUM(has_failure) * 100.0 / COUNT(*), 1) AS failure_rate_pct
FROM trace_context
GROUP BY context_size_bucket
ORDER BY failure_rate_pct DESC;
```

### The Audit Trail

In production, the trace is not just a debugging tool. It is an audit trail. When a
user reports that an agent gave them a wrong answer, the trace shows exactly what the
agent did: which model calls it made, which tools it called, what data it accessed, and
how it arrived at its answer.

This matters for accountability. An agent that produces a wrong answer and leaves no
trace is a black box that cannot be audited. An agent that produces a wrong answer with
a complete trace is a system that made a specific, diagnosable mistake.

The audit trail requirements for production agent systems:

| Requirement | What to Record | Why |
|------------|---------------|-----|
| Completeness | Every model call, every tool call, every decision point | Gaps in the trace make diagnosis impossible |
| Immutability | Traces cannot be modified after recording | Tampered traces are worse than no traces |
| Retention | Traces retained for at least the appeal/review period | You need the trace when the complaint arrives |
| Accessibility | Traces queryable by run ID, user, time range, failure type | Finding the right trace matters as much as having it |

> **AGENTIC GROUNDING:** The project's event log (events.yaml) and catch log
> (catch-log.tsv) are examples of production audit trails. The event log records
> every notable event with date, time, type, agent, commit reference, and summary.
> The catch log records when a governance control fires - when a review catches
> something. These are lightweight but effective: append-only, structured, queryable.
> The same principles apply to agent traces in production. The trace is the agent's
> flight recorder. If the plane crashes, the recorder is how you find out why.

> **FIELD VS NOVEL:** Statistical debugging across software traces is established
> practice (Liblit et al., 2005, "Scalable Statistical Bug Isolation"). SRE post-mortem
> processes are well-documented (Beyer et al., 2016). The application of these
> techniques to LLM agent traces is emerging. The specific challenge for agents is that
> failures may be non-deterministic, meaning that statistical analysis across many runs
> is often more informative than deep analysis of a single run. DuckDB's ability to
> query JSONL files directly (covered in **Bootcamp III Step 3 (SQL analytics)**) makes
> this kind of statistical debugging accessible without infrastructure overhead.

---

## Challenge: Failure Diagnosis

**Estimated time: 25 minutes**

**Prerequisites:** Completed Tool Setup. Sample traces generated (or your own traces
from Step 7).

**Goal:** Given a failed agent trace, diagnose the failure. Classify it by type.
Identify the exact step where things went wrong. Propose a fix.

Run the sample trace generator if you have not already:

```bash
python3 generate_sample_traces.py
```

**Part 1: Identify the failures.**

Load the traces and find the failed runs:

```sql
-- Find all failed traces
SELECT DISTINCT trace_id, error_type, error_message
FROM read_json('sample_traces.jsonl', auto_detect=true)
WHERE status = 'error';
```

**Part 2: Diagnose one failure.**

Pick one of the failed traces (start with `trace-fail-001` - the hallucinated tool
call). Replay it step by step:

```bash
python3 replay.py sample_traces.jsonl trace-fail-001
```

Answer these questions:
1. At which step did the failure occur?
2. What failure type is this? (model, context, tool, environment, orchestration, state)
3. At which layer (L0-L12) did the root cause originate?
4. What would you change to prevent this failure in future runs?

**Part 3: Diagnose all five failures.**

Repeat Part 2 for each of the five failure traces. Record your diagnoses:

| Trace ID | Failure Step | Failure Type | Root Layer | Proposed Fix |
|----------|-------------|-------------|-----------|-------------|
| trace-fail-000 | ? | ? | ? | ? |
| trace-fail-001 | ? | ? | ? | ? |
| trace-fail-002 | ? | ? | ? | ? |
| trace-fail-003 | ? | ? | ? | ? |
| trace-fail-004 | ? | ? | ? | ? |

**Verification:** Compare your diagnoses against the failure definitions in the
`generate_sample_traces.py` script. The script documents the intended failure type for
each trace.

<details>
<summary>Hints</summary>

- `trace-fail-000`: Look at the step count. How many times was the search tool called?
  What should have stopped the loop?
- `trace-fail-001`: Look at the tool name in the failing step. Is `execute_sql` in
  the agent's tool registry?
- `trace-fail-002`: Track cumulative token count across steps. At what point does it
  become excessive?
- `trace-fail-003`: Check the error message. Is this an agent error or an
  infrastructure error?
- `trace-fail-004`: Check what state file was read and what file the agent tried to
  write. Does the write target make sense?

</details>

**Extension:** Write a function that automatically classifies a trace's failure type
from the span data, without reading the error_type field. Use only the patterns
described in Section 6.

---

## Challenge: Debug Dashboard

**Estimated time: 30 minutes**

**Prerequisites:** DuckDB installed. Sample traces generated.

**Goal:** Build a debug dashboard that loads all traces, identifies failures,
computes failure statistics, and provides step-by-step replay of the worst failure.

```python
# debug_dashboard.py - Agent trace debugging dashboard
import duckdb
import json
from pathlib import Path

def build_dashboard(trace_path: str = "sample_traces.jsonl"):
  """
  Build a debugging dashboard from JSONL traces.
  """
  con = duckdb.connect()

  # Load traces
  con.execute(f"""
    CREATE TABLE spans AS
    SELECT * FROM read_json('{trace_path}', auto_detect=true)
  """)

  # --- Section 1: Overview ---
  print("=" * 60)
  print("AGENT DEBUG DASHBOARD")
  print("=" * 60)

  overview = con.execute("""
    SELECT
      COUNT(DISTINCT trace_id) AS total_traces,
      COUNT(*) AS total_spans,
      COUNT(DISTINCT CASE WHEN status = 'error' THEN trace_id END)
        AS failed_traces,
      ROUND(
        COUNT(DISTINCT CASE WHEN status = 'error' THEN trace_id END) * 100.0
        / COUNT(DISTINCT trace_id), 1
      ) AS failure_rate_pct
    FROM spans
  """).fetchone()

  print(f"\nTotal traces: {overview[0]}")
  print(f"Total spans: {overview[1]}")
  print(f"Failed traces: {overview[2]}")
  print(f"Failure rate: {overview[3]}%")

  # --- Section 2: Failure type distribution ---
  print(f"\n{'─' * 60}")
  print("FAILURE TYPE DISTRIBUTION")
  print(f"{'─' * 60}")

  # YOUR CODE HERE: Query for failure type distribution
  # Group by error_type, count occurrences
  # Print as a formatted table

  # --- Section 3: Token consumption comparison ---
  print(f"\n{'─' * 60}")
  print("TOKEN CONSUMPTION: FAILED vs SUCCESSFUL")
  print(f"{'─' * 60}")

  # YOUR CODE HERE: Compare average token consumption
  # between failed and successful traces

  # --- Section 4: Replay worst failure ---
  print(f"\n{'─' * 60}")
  print("WORST FAILURE REPLAY")
  print(f"{'─' * 60}")

  # Find the trace with the most steps before failure
  # (longest wasted computation = worst failure)
  worst = con.execute("""
    WITH failure_steps AS (
      SELECT trace_id, step AS failure_step
      FROM spans
      WHERE status = 'error'
    ),
    trace_lengths AS (
      SELECT trace_id, MAX(step) AS total_steps
      FROM spans
      GROUP BY trace_id
    )
    SELECT f.trace_id, f.failure_step, t.total_steps
    FROM failure_steps f
    JOIN trace_lengths t ON f.trace_id = t.trace_id
    ORDER BY f.failure_step DESC
    LIMIT 1
  """).fetchone()

  if worst:
    print(f"\nWorst failure: {worst[0]}")
    print(f"  Failed at step {worst[1]} of {worst[2]}")

    # YOUR CODE HERE: Replay this trace step by step
    # Show each span's type, name, tokens, status
    # Highlight the failure step

  con.close()


if __name__ == "__main__":
  build_dashboard()
```

**Verification:** Your dashboard should show:
1. 50 total traces, 5 failures, 10% failure rate
2. Failure types distributed across the five categories
3. Failed traces consuming more tokens on average (due to the context overflow trace)
4. A step-by-step replay of the worst failure

<details>
<summary>Hints</summary>

For Section 2 (failure types):
```sql
SELECT
  error_type,
  COUNT(*) AS count
FROM spans
WHERE status = 'error' AND error_type IS NOT NULL
GROUP BY error_type
ORDER BY count DESC;
```

For Section 3 (token comparison), use the query pattern from Section 7 of the main
content.

For Section 4 (replay), query all spans for the worst trace ID, ordered by step, and
print each one with its relevant fields.

</details>

**Extension:** Add a "health score" to each trace based on: step count (more steps
than expected = lower score), token consumption (higher than average = lower score),
and tool error rate (any tool errors = lower score). Display as a histogram.

---

## Challenge: Replay Tool

**Estimated time: 35 minutes**

**Prerequisites:** DuckDB installed. Sample traces generated. An LLM API key (optional
 - the exercise works with stubs if no API is available).

**Goal:** Build a replay tool that re-executes each step of a trace and compares the
output to the original. This tests whether failures are reproducible and whether fixes
change outcomes.

```python
# replay_tool.py - Approximate agent replay
import json
import time
from pathlib import Path
from collections import defaultdict
from difflib import SequenceMatcher

def load_trace(trace_path: str, trace_id: str) -> list:
  """Load and sort spans for a single trace."""
  spans = []
  with Path(trace_path).open() as f:
    for line in f:
      span = json.loads(line)
      if span["trace_id"] == trace_id:
        spans.append(span)
  return sorted(spans, key=lambda s: s["step"])


def stub_model_call(messages: list) -> dict:
  """
  Stub model call for testing without an API key.
  Returns a deterministic response for comparison.
  """
  return {
    "output": f"STUB response for {len(messages)} messages",
    "output_tokens": 42,
    "duration_ms": 100,
  }


def stub_tool_call(tool_name: str, tool_args: dict) -> dict:
  """
  Stub tool call for testing.
  Returns a deterministic result.
  """
  return {
    "result": f"STUB result for {tool_name}({json.dumps(tool_args)})",
    "result_tokens": 100,
    "status": "ok",
  }


def replay_and_compare(trace_path: str, trace_id: str,
                       model_fn=None, tool_fn=None):
  """
  Replay a trace and compare each step to the original.

  model_fn: function(messages) -> dict with 'output', 'output_tokens'
  tool_fn: function(tool_name, tool_args) -> dict with 'result', 'status'
  """
  if model_fn is None:
    model_fn = stub_model_call
  if tool_fn is None:
    tool_fn = stub_tool_call

  original_spans = load_trace(trace_path, trace_id)
  if not original_spans:
    print(f"No spans found for trace {trace_id}")
    return

  print(f"Replaying trace {trace_id}: {len(original_spans)} steps\n")

  divergences = []
  messages = []  # Accumulated message history

  for original in original_spans:
    step = original["step"]
    step_type = original["type"]
    name = original["name"]

    if step_type == "llm_call":
      # Re-execute model call
      replay_start = time.time()
      replay_result = model_fn(messages)
      replay_duration = (time.time() - replay_start) * 1000

      # Compare
      original_tokens = original.get("output_tokens", 0)
      replay_tokens = replay_result.get("output_tokens", 0)
      token_ratio = replay_tokens / max(original_tokens, 1)

      diverged = abs(token_ratio - 1.0) > 0.5  # >50% difference
      status = "DIVERGED" if diverged else "similar"

      print(f"Step {step} [{name}] LLM call: {status}")
      print(f"  Original: {original_tokens} output tokens, "
            f"{original.get('duration_ms', 0)}ms")
      print(f"  Replay:   {replay_tokens} output tokens, "
            f"{replay_duration:.0f}ms")

      if diverged:
        divergences.append({
          "step": step,
          "name": name,
          "type": "llm_call",
          "original_tokens": original_tokens,
          "replay_tokens": replay_tokens,
          "token_ratio": token_ratio,
        })

      # Add to message history for next step
      messages.append({"role": "assistant", "content": replay_result["output"]})

    elif step_type == "tool_call":
      tool_name = original.get("tool_name", "unknown")
      tool_args = original.get("tool_args", {})

      # YOUR CODE HERE:
      # 1. Call tool_fn with the original tool_name and tool_args
      # 2. Compare the replay result status with the original status
      # 3. Record divergence if statuses differ
      # 4. Print step summary

      print(f"Step {step} [{name}] Tool call: {tool_name}")
      # Implement comparison logic here

    print()

  # Summary
  print("=" * 50)
  print(f"Replay complete: {len(divergences)} divergences "
        f"in {len(original_spans)} steps")
  if divergences:
    print("\nDivergences:")
    for d in divergences:
      print(f"  Step {d['step']} ({d['name']}): {d['type']} - "
            f"token ratio {d.get('token_ratio', 'N/A')}")
  else:
    print("No significant divergences detected")

  return divergences


if __name__ == "__main__":
  import sys
  trace_path = sys.argv[1] if len(sys.argv) > 1 else "sample_traces.jsonl"
  trace_id = sys.argv[2] if len(sys.argv) > 2 else "trace-fail-001"
  replay_and_compare(trace_path, trace_id)
```

**Fallback:** The stub functions work without any API key. The exercise demonstrates
the replay structure and comparison logic. To test with a real model, replace
`stub_model_call` with an actual API call:

```python
# Optional: real model call (requires API key)
def real_model_call(messages: list) -> dict:
  """Replace stub with actual API call for live replay."""
  from openai import OpenAI  # or anthropic
  client = OpenAI()

  response = client.chat.completions.create(
    model="gpt-4o-mini",  # cheap model for replay testing
    messages=messages,
    max_tokens=500,
  )

  return {
    "output": response.choices[0].message.content,
    "output_tokens": response.usage.completion_tokens,
    "duration_ms": 0,  # not tracked by the API response
  }
```

**Verification:** Running the replay tool against a failed trace should:
1. Process every step in the trace
2. Show the comparison between original and replay at each step
3. Report divergences (with stubs, all LLM calls will diverge because the stub
   returns fixed output)
4. Complete the tool call comparison you implemented

<details>
<summary>Hints</summary>

For the tool call comparison:
```python
replay_result = tool_fn(tool_name, tool_args)
original_status = original.get("status", "ok")
replay_status = replay_result.get("status", "ok")

if original_status != replay_status:
  divergences.append({
    "step": step,
    "name": name,
    "type": "tool_call",
    "original_status": original_status,
    "replay_status": replay_status,
  })
  print(f"  Status: DIVERGED (original={original_status}, "
        f"replay={replay_status})")
else:
  print(f"  Status: matched ({original_status})")
```

</details>

**Extension:** Add a "what-if" mode: replay the trace but modify one step (e.g.,
change a tool result, add context to the system prompt) and see whether the downstream
steps diverge. This is the agent debugging equivalent of changing one variable and
re-running.

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. Why can you not set a breakpoint inside an LLM inference call? What do you use
   instead?

2. What are the six failure types in the agent failure classification? Which layers
   does each map to?

3. Why does fixing agent output inline corrupt the trace and prevent root cause
   analysis?

4. When should you rerun a failed agent run versus fixing the system? What is the
   decision criterion?

5. Which layers of the model are directly observable (exact measurements available)
   and which require inference from downstream effects?

6. How do you distinguish a model error (L0/L4) from a context error (L3)?

7. What are the two kinds of context pressure, and how do you diagnose each from a
   trace?

8. How does L9 (thread position) create self-reinforcing loops, and what is the
   structural remedy?

9. What makes L10 (multi-agent) consensus unreliable as validation? How does L11
   (cross-model) address this?

10. Why is statistical debugging across many traces often more informative than deep
    analysis of a single trace for agent systems?

---

## Recommended Reading

- **Beyer, B. et al. (2016). "Site Reliability Engineering: How Google Runs Production
  Systems."** O'Reilly. Chapter 12 ("Effective Troubleshooting") covers systematic
  debugging in production systems. Chapter 15 ("Postmortem Culture") covers post-mortem
  analysis. The principles apply directly to agent system debugging.

- **Liu, N. F. et al. (2023). "Lost in the Middle: How Language Models Use Long
  Contexts."** Documents the attention pattern where models attend more to the beginning
  and end of long contexts, less to the middle. Direct relevance to L2/L3 diagnosis.

- **Perez, E. et al. (2022). "Discovering Language Model Behaviors with Model-Written
  Evaluations."** Documents sycophancy and other model behaviours relevant to L9
  diagnosis.

- **Bainbridge, L. (1983). "Ironies of Automation." Automatica, 19(6).** The
  foundational paper on how automation degrades the skills needed to oversee automation.
  Directly relevant to L12 diagnosis and cognitive deskilling.

- **Tversky, A. & Kahneman, D. (1974). "Judgment under Uncertainty: Heuristics and
  Biases." Science, 185(4157).** Documents anchoring bias, which is the human cognition
  analogue of L9 thread position effects.

- **Liblit, B. et al. (2005). "Scalable Statistical Bug Isolation."** Introduces
  statistical debugging techniques for finding bugs through aggregate analysis of many
  program runs. The agent debugging analogue: aggregate trace analysis.

- **DuckDB JSON documentation:** https://duckdb.org/docs/stable/data/json/overview.html
  - Reference for all JSON/JSONL query patterns used in this step.

- **Inspect AI Log Viewer:**
  https://inspect.ai-safety-institute.org.uk/log-viewer.html - The best available
  visual tool for step-by-step agent trace replay (for Inspect-produced traces).

---

## What to Read Next

**Step 9: Production Patterns** - Everything from Steps 1-8 operating under production
constraints. Rate limiting, cost management, graceful degradation, deployment strategies,
monitoring dashboards. The debugging skills from this step become your incident response
toolkit. The traces become your production audit trail. The failure classification becomes
your incident categorization scheme.

