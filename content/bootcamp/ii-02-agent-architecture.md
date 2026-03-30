+++
title = "Agent Architecture Patterns"
date = "2026-03-10"
description = "Workflows vs agents. The five patterns from Anthropic's guidance. Single-agent vs multi-agent. The simplicity principle."
tags = ["agents", "architecture", "patterns", "bootcamp"]
step = 2
tier = 1
estimate = "4-5 hours"
bootcamp = 2
+++

Step 2 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This Step Exists

Architecture is the highest-leverage decision in agent system design. Get it wrong and you
pay the cost on every request: wrong latency profile, wrong cost profile, wrong auditability
characteristics. A system that should be a three-step workflow gets built as an autonomous
agent with a tool loop. Now you are debugging a stochastic system when you could have
debugged a pipeline.

Most problems do not need agents. This is not a philosophical position. It is an
engineering observation from Anthropic, OpenAI, and every team that has shipped agent
systems to production. The most effective agentic systems are mostly workflows - predefined
code paths where the LLM handles the intelligence and the code handles the control flow.

This step covers the five canonical workflow patterns from Anthropic's "Building effective
agents" (December 2024), the agent loop, handoff mechanisms, the framework landscape, and
one novel pattern from this project: the one-shot agent job. It maps everything to L6
in the layer model - the harness layer that sits between the API (L5) and the tools (L7),
orchestrating how LLM calls are composed, dispatched, and controlled.

> **FIELD MATURITY: ESTABLISHED.** The workflow and agent patterns are well-documented by
> Anthropic and OpenAI. Framework implementations are mature (LangGraph 1.0+, OpenAI Agents
> SDK). What is less well-covered is the operational decomposition of the harness layer into
> distinct modes, the one-shot agent job as a named pattern, and the principle that human
> review happens after execution, not during.

The goal: build the judgment to select the simplest architecture that solves the problem,
implement it with observable control flow, and know when to escalate from workflow to agent.

---

## Table of Contents

1. [The Harness Layer: L6](#1-the-harness-layer-l6) (~20 min)
2. [Workflows vs Agents](#2-workflows-vs-agents) (~20 min)
3. [Five Workflow Patterns](#3-five-workflow-patterns) (~50 min)
4. [The Agent Loop](#4-the-agent-loop) (~25 min)
5. [Single-Agent vs Multi-Agent](#5-single-agent-vs-multi-agent) (~20 min)
6. [Handoffs](#6-handoffs) (~25 min)
7. [The Simplicity Principle](#7-the-simplicity-principle) (~15 min)
8. [Framework Landscape](#8-framework-landscape) (~20 min)
9. [The One-Shot Agent Job](#9-the-one-shot-agent-job) (~25 min)
10. [Challenges](#10-challenges) (~60-90 min)
11. [Key Takeaways](#11-key-takeaways)
12. [Recommended Reading](#12-recommended-reading)
13. [What to Read Next](#13-what-to-read-next)

---

## 1. The Harness Layer: L6

*Estimated time: 20 minutes*

Step 1 covered L0-L5 - the layers that describe how an LLM turns tokens into a response.
But an LLM by itself is a stateless function: tokens in, tokens out. To build anything
useful, you need an orchestration layer that manages conversation state, dispatches tool
calls, routes control flow, and mediates between the human and the model. This is L6 -
the harness.

The harness is not one thing. It has four operational modes, and recognising which mode you
are in determines your debugging strategy and failure model.

| Mode | Name | What Happens | Control |
|------|------|-------------|---------|
| L6a | DIRECT | Human and model take turns. Single call-response. | Human can interrupt |
| L6b | DISPATCH | Harness orchestrates multiple LLM calls. | Human inputs queue (FIFO) |
| L6c | OVERRIDE | Human takes direct control. Kill switch. | Always available |
| L6d | BYPASS | State exchange outside the harness via files/git. | Human writes durable state |

**L6a DIRECT** is what happens when you use the API directly. One LLM, one conversation.

**L6b DISPATCH** is what happens when your system orchestrates multiple calls. Workflows,
routers, orchestrator-workers - all L6b. In agent frameworks like LangGraph or the OpenAI
Agents SDK, the framework is L6b. The harness code decides what happens next.

**L6c OVERRIDE** is the escape hatch. When a subagent enters an infinite loop, when cost
is spiralling - the human breaks in. Ctrl-C in CLI tools, stop button in UIs, timeout in
pipelines. If your system does not have L6c, you do not have a production system.

**L6d BYPASS** is the least obvious mode but operationally the most important for sustained
work. When the context window dies (compaction - see Step 4), in-thread state is lost. But
decisions written to files and committed to git survive. L6d is the human reading
`git log`, editing a plan file, or writing a session decision that will load into the next
context window. The harness is bypassed entirely.

### Why the Decomposition Matters

"The agent is not working" could mean:

- The LLM generates bad responses (L4, L0, L3 - not L6)
- Orchestration code routes to the wrong handler (L6b)
- The subagent loop has no termination condition (L6b, needs L6c)
- Context from the previous session was not loaded (L6d failure)

"Neither side can verify what L6 adds, removes, or transforms." The harness injects system
reminders, tool schemas, and context management instructions that are opaque to both the
model and the human. When debugging agent behavior, remember that L6 is a transformation
layer with its own behavior, not a transparent pipe.

> **AGENTIC GROUNDING:** When an agent system produces unexpected behavior, the first
> diagnostic question after "which layer?" is "which L6 mode?" If you are using a
> framework (LangGraph, Agents SDK, Claude Code), the framework IS L6. Bugs in L6 look
> like bugs in the model - the output is wrong - but the cause is in the orchestration
> code. Check routing logic and context assembly before blaming the model.

---

## 2. Workflows vs Agents

*Estimated time: 20 minutes*

Anthropic's "Building effective agents" draws a clean line:

> "Workflows are systems where LLMs and tools are orchestrated through predefined code
> paths. Agents, on the other hand, are systems where LLMs dynamically direct their own
> processes and tool usage, maintaining control over how they accomplish tasks."

This distinction is load-bearing. It determines cost, latency, reliability, and
debuggability.

In a **workflow**, the code decides what happens. The LLM is called at specific points to
handle intelligence-requiring steps, but the control flow is deterministic. You can draw
the execution path on a whiteboard before the system runs.

```python
# Workflow: code controls the flow, LLM handles intelligence
def review_document(document: str) -> dict:
  claims = extract_claims(document)          # LLM call 1
  results = [check_claim(c) for c in claims] # LLM calls 2..N+1
  report = generate_report(document, results) # LLM call N+2
  return {"claims": results, "report": report}
```

In an **agent**, the LLM decides what happens. The code provides tools and an environment,
but the LLM chooses which tools to call, in what order, and when to stop.

```python
# Agent: LLM controls the flow
def agent_loop(task: str, tools: list, max_iterations: int = 10) -> str:
  messages = [{"role": "user", "content": task}]
  for i in range(max_iterations):
    response = call_llm(messages, tools=tools)
    if response.stop_reason == "end_turn":
      return response.text
    if response.stop_reason == "tool_use":
      tool_result = execute_tool(response.tool_call)
      messages.append({"role": "assistant", "content": response.content})
      messages.append({"role": "user", "content": tool_result})
  return "Max iterations reached"
```

| Criterion | Workflow | Agent |
|-----------|----------|-------|
| Steps known in advance? | Yes | No |
| Cost predictable? | Yes (bounded) | No (unbounded without limits) |
| Debuggable? | Step-by-step | Trace the loop history |
| Failure mode | Known step fails | Loop diverges, never terminates |

**Most tasks that people build agents for should be workflows.** If you can enumerate the
steps, use a workflow. The threshold for "genuinely requires an agent" should be high.

> **HISTORY:** The workflow-vs-agent distinction crystallised in late 2024 when both
> Anthropic and OpenAI published guidance converging on the same conclusion: most production
> systems should be workflows. This corrected the 2023-2024 hype cycle where "agent"
> became a marketing term applied to everything from chatbots to RAG pipelines. Erik
> Schluntz and Barry Zhang at Anthropic: "we recommend finding the simplest solution
> possible, and only increasing complexity when needed."

> **AGENTIC GROUNDING:** When you see an agent system with an unbounded tool-use loop
> and no cost ceiling, the architecture is probably wrong. Enterprise systems need
> predictable costs and bounded latency. The first question for any proposed agent system:
> "Can this be a workflow instead?" If yes, make it a workflow.

---

## 3. Five Workflow Patterns

*Estimated time: 50 minutes*

Anthropic's "Building effective agents" identifies five workflow patterns. Each trades
complexity for capability. The order is from simplest to most complex.

### 3.1 Prompt Chaining

Sequential LLM calls where the output of one becomes the input to the next. A pipeline.

**When to use:** Task decomposes into fixed sequential steps. You want verification gates
between steps. **When not to use:** Steps are independent (use parallelisation).

```python
#!/usr/bin/env python3
"""Prompt chaining with gates between steps."""
import anthropic, json

client = anthropic.Anthropic()

def call_llm(prompt: str, system: str = "") -> str:
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=2048,
    system=system or "You are a helpful assistant.",
    messages=[{"role": "user", "content": prompt}]
  )
  return r.content[0].text

def chain_example(code: str) -> dict:
  """Three-step chain: analyze -> improve -> verify."""
  # Step 1: Analyze
  analysis = call_llm(
    f"Analyze for bugs and style issues. Return JSON with 'bugs' and "
    f"'style_issues' lists.\n\n```python\n{code}\n```",
    system="Return only valid JSON, no markdown."
  )
  # Gate: parse check
  try:
    data = json.loads(analysis)
  except json.JSONDecodeError:
    return {"error": "Gate failed: invalid JSON from step 1"}

  if not data.get("bugs") and not data.get("style_issues"):
    return {"result": "No issues found"}

  # Step 2: Improve
  improved = call_llm(
    f"Original:\n```python\n{code}\n```\nIssues:\n{json.dumps(data)}\n"
    f"Generate improved code only.",
    system="Fix all identified issues."
  )
  # Step 3: Verify
  verification = call_llm(
    f"Issues: {json.dumps(data)}\nImproved:\n{improved}\n"
    f"Return JSON: 'all_fixed' (bool), 'remaining' (list).",
    system="Return only valid JSON."
  )
  return {"analysis": data, "improved": improved, "verification": verification}
```

The **gates** between steps are the key structural element. Gates are programmatic checks -
JSON parsing, length validation, keyword presence - not LLM calls. Cheap and deterministic.

### 3.2 Routing

Classify the input, dispatch to a specialised handler. A switch statement where the LLM
is the classifier.

**When to use:** Different input types need different processing. Categories are known in
advance. **When not to use:** All inputs need the same processing.

```python
#!/usr/bin/env python3
"""Routing: classify then dispatch."""
import anthropic

client = anthropic.Anthropic()

def classify(query: str) -> str:
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=50,
    system="Classify into: BILLING, TECHNICAL, ACCOUNT, or GENERAL. "
      "Return only the category name.",
    messages=[{"role": "user", "content": query}]
  )
  return r.content[0].text.strip()

def handle(query: str, system: str) -> str:
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=1024,
    system=system,
    messages=[{"role": "user", "content": query}]
  )
  return r.content[0].text

handlers = {
  "BILLING": "You are a billing specialist. Be concise and actionable.",
  "TECHNICAL": "You are a technical support engineer. Troubleshoot step by step.",
  "ACCOUNT": "You are an account specialist. Help with settings and access.",
  "GENERAL": "You are a helpful support agent.",
}

def route(query: str) -> str:
  category = classify(query)
  system = handlers.get(category, handlers["GENERAL"])
  return handle(query, system)
```

Routing costs one classification call (cheap - small output) plus one specialist call. The
specialist benefits from a focused system prompt with smaller, more relevant context.

### 3.3 Parallelisation

Multiple LLM calls executed simultaneously. Two variants: **sectioning** (independent
subtasks in parallel) and **voting** (same task, multiple attempts, then synthesise).

**When to use:** Subtasks are independent. You need multiple perspectives. **When not to
use:** Steps are sequential.

```python
#!/usr/bin/env python3
"""Parallelisation: sectioning pattern."""
import anthropic, concurrent.futures

client = anthropic.Anthropic()

def call_llm(prompt: str, system: str = "") -> str:
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=1024,
    system=system or "Be specific and concise.",
    messages=[{"role": "user", "content": prompt}]
  )
  return r.content[0].text

def review_parallel(code: str) -> dict:
  """Three independent reviews in parallel."""
  perspectives = [
    ("security", "Review for security vulnerabilities only."),
    ("performance", "Review for performance issues only."),
    ("maintainability", "Review for maintainability issues only."),
  ]
  results = {}
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    futures = {
      pool.submit(call_llm, f"{inst}\n\n```python\n{code}\n```", inst): name
      for name, inst in perspectives
    }
    for future in concurrent.futures.as_completed(futures):
      results[futures[future]] = future.result()
  return results
```

Three parallel reviews cost three LLM calls. Voting with synthesis costs N + 1. Wall-clock
latency improves (limited by the slowest call), but total token cost is the sum of all.

### 3.4 Orchestrator-Workers

A central LLM decomposes the task into subtasks, delegates each to a worker, and
synthesises results. The key difference from parallelisation: subtasks are **not predefined**
- the orchestrator determines them at runtime.

**When to use:** Cannot predict subtasks in advance. Decomposition itself requires
intelligence. **When not to use:** Subtasks are predictable (use parallelisation).

```python
#!/usr/bin/env python3
"""Orchestrator-workers: dynamic decomposition."""
import anthropic, json, concurrent.futures

client = anthropic.Anthropic()

def call_llm(prompt: str, system: str = "") -> str:
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=2048,
    system=system or "You are a helpful assistant.",
    messages=[{"role": "user", "content": prompt}]
  )
  return r.content[0].text

def orchestrate(task: str) -> dict:
  # Decompose
  raw = call_llm(
    f"Task: {task}\nDecompose into independent subtasks. "
    f"Return JSON list: [{{'id': str, 'description': str}}].",
    system="Return only valid JSON."
  )
  subtasks = json.loads(raw)

  # Workers in parallel
  results = {}
  with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    futures = {
      pool.submit(call_llm, f"Complete: {st['description']}"): st["id"]
      for st in subtasks
    }
    for f in concurrent.futures.as_completed(futures):
      results[futures[f]] = f.result()

  # Synthesise
  parts = "\n".join(f"=== {k} ===\n{v}" for k, v in results.items())
  synthesis = call_llm(
    f"Original: {task}\nResults:\n{parts}\nSynthesise into final deliverable."
  )
  return {"subtasks": subtasks, "results": results, "synthesis": synthesis}
```

This is the most expensive workflow pattern: at least `1 + N + 1` calls where N is
determined at runtime. This is the pattern behind coding agents that make multi-file
changes - the agent analyses the task, determines which files need changing, and generates
each change.

### 3.5 Evaluator-Optimizer

One LLM generates, another evaluates with structured feedback. The generator improves based
on feedback. Loops until the evaluator is satisfied or a max iteration count is reached.

**When to use:** Clear evaluation criteria. Iterative refinement provides measurable value.
**When not to use:** Evaluation criteria are ambiguous. First-pass output is adequate.

```python
#!/usr/bin/env python3
"""Evaluator-optimizer: iterative refinement."""
import anthropic, json

client = anthropic.Anthropic()

def call_llm(prompt: str, system: str = "") -> str:
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=2048,
    system=system or "You are a helpful assistant.",
    messages=[{"role": "user", "content": prompt}]
  )
  return r.content[0].text

def refine(task: str, max_rounds: int = 3) -> dict:
  current = call_llm(task, system="Produce your best work.")
  for i in range(max_rounds):
    evaluation = call_llm(
      f"Task: {task}\nOutput:\n{current}\n"
      f"Return JSON: 'score' (1-10), 'improvements' (list), 'done' (bool).",
      system="Be critical. Return only valid JSON."
    )
    try:
      ev = json.loads(evaluation)
    except json.JSONDecodeError:
      break
    if ev.get("done"):
      break
    current = call_llm(
      f"Task: {task}\nPrevious:\n{current}\n"
      f"Feedback:\n{json.dumps(ev)}\nRewrite addressing all feedback.",
      system="Incorporate all feedback."
    )
  return {"final": current, "rounds": i + 1}
```

Each iteration costs two calls (evaluate + improve). Context grows with each round because
the evaluation includes the previous output. Watch the token budget.

> **AGENTIC GROUNDING:** Log L5 metrics for every LLM call in every pattern. A chain costs
> 3 calls. Orchestrator-workers might cost 10. Evaluator-optimizer might cost 7. The cost
> difference between architectures is 3-10x. Choose the simplest pattern that meets the
> quality requirement. If prompt chaining produces adequate results, the orchestrator-workers
> pattern is waste.

---

## 4. The Agent Loop

*Estimated time: 25 minutes*

When a workflow is not sufficient - when the steps genuinely cannot be predefined - you
need an agent. An agent is an LLM in a loop with tools and environment feedback.

### The Core Structure

Every agent implements the same loop:

```
while not done:
  1. Send context (conversation + tool results) to the LLM
  2. LLM responds with text, tool calls, or both
  3. If text only: check stopping condition
  4. If tool calls: execute tools, append results, go to 1
```

Anthropic describes agents as "typically just LLMs using tools based on environmental
feedback in a loop." The simplicity of the definition is deceptive. The complexity is
in the details: what tools are available, how context accumulates, and when the loop stops.

### Stopping Conditions

| Condition | Type | Risk |
|-----------|------|------|
| Model generates `end_turn` | Model-decided | Might never stop |
| Max iterations | Code-enforced | Arbitrary cutoff |
| Max tokens consumed | Budget-enforced | Might interrupt mid-task |
| Timeout | Time-enforced | Prevents runaway |
| Human intervention (L6c) | Override | Reactive, not preventive |

A production agent needs at least three of these. The combination of model-decided +
max-iterations + cost-limit + timeout provides defense in depth.

```python
#!/usr/bin/env python3
"""Minimal agent loop with multiple stopping conditions."""
import anthropic, time

client = anthropic.Anthropic()

tools = [{
  "name": "read_file",
  "description": "Read a file at the given path.",
  "input_schema": {
    "type": "object",
    "properties": {"path": {"type": "string"}},
    "required": ["path"]
  }
}]

def execute_tool(name: str, args: dict) -> str:
  if name == "read_file":
    try:
      with open(args["path"]) as f:
        return f.read()
    except FileNotFoundError:
      return f"Error: not found: {args['path']}"
  return f"Error: unknown tool: {name}"

def agent_loop(task: str, max_iter: int = 10, max_tokens: int = 50000,
               timeout: int = 120) -> dict:
  messages = [{"role": "user", "content": task}]
  total_tokens, start = 0, time.time()

  for i in range(max_iter):
    if time.time() - start > timeout:
      return {"stop": "timeout", "iterations": i}
    if total_tokens > max_tokens:
      return {"stop": "token_budget", "iterations": i}

    r = client.messages.create(
      model="claude-sonnet-4-20250514", max_tokens=4096,
      system="Use tools to complete tasks.", messages=messages, tools=tools,
    )
    total_tokens += r.usage.input_tokens + r.usage.output_tokens

    if r.stop_reason == "end_turn":
      text = [b.text for b in r.content if b.type == "text"]
      return {"result": "\n".join(text), "stop": "done",
              "iterations": i + 1, "tokens": total_tokens}

    if r.stop_reason == "tool_use":
      messages.append({"role": "assistant", "content": r.content})
      results = []
      for b in r.content:
        if b.type == "tool_use":
          results.append({"type": "tool_result", "tool_use_id": b.id,
                          "content": execute_tool(b.name, b.input)})
      messages.append({"role": "user", "content": results})

  return {"stop": "max_iterations", "iterations": max_iter, "tokens": total_tokens}
```

### The Context Accumulation Problem

Every iteration adds to the conversation: the tool call, the result, the model's response.
After 10 iterations with substantial tool results, the context might contain 50,000+ tokens.
The agent's earlier decisions drift into the low-attention zone (L3, Step 1). The system
prompt has primacy. The recent tool result has recency. But the reasoning from iteration 3
that shaped all subsequent decisions? Buried in the middle.

This is why long-running agent loops degrade. It is not "the model gets tired." It is a
structural property of L3: attention dilutes as context grows. The fix is context
management - summarising intermediate results, pruning tool output, or restarting with a
fresh window and a checkpoint. Step 4 covers this in depth.

> **AGENTIC GROUNDING:** If your agent loop degrades after 5-10 iterations, check the
> total token count at L5. If it is above 50% of the context window, context accumulation
> is the likely cause. Standard fixes: summarise tool results, truncate history to last
> N turns plus system prompt, or restart with fresh context containing only current state.

---

## 5. Single-Agent vs Multi-Agent

*Estimated time: 20 minutes*

A single agent with the right tools can handle most tasks. Multi-agent systems add value in
specific scenarios and add complexity in all scenarios.

### When Multi-Agent Adds Value

**Context isolation.** A reviewer that starts with a fresh context window cannot be
influenced by the generator's intermediate reasoning. This is independent code review -
the reviewer should not watch the developer write the code.

**Different model families.** Claude reviewing GPT's output has different L0 weights and
different RLHF. Same-model review is consistency checking, not independent verification
(Step 1, Section 10).

**Genuinely different tool sets.** A browser agent and a code agent need different
capabilities and different system prompts.

### When Multi-Agent Adds Only Complexity

**Same model doing different roles.** If all agents are Claude with different system
prompts, you have not gained independence. You have gained complexity and cost. The agents
share L0 weights, RLHF alignment, and systematic biases.

**Coordination overhead.** Multi-agent systems need coordination code: sequencing, result
passing, disagreement handling, error propagation. A single agent with five tools is simpler
than five agents exchanging results.

**Context loss at handoffs.** Context does not transfer automatically. The handoff must
explicitly include everything the second agent needs. Omissions are a frequent source of
multi-agent bugs.

### Architectural Patterns

| Pattern | Topology | Use Case |
|---------|----------|----------|
| Single agent | One LLM + tools | Most tasks (default) |
| Supervisor-worker | Orchestrator + N workers | Complex decomposition |
| Pipeline | A -> B -> C | Multi-stage processing |
| Reviewer | Generator + independent reviewer | Quality-critical output |

The **reviewer** pattern deserves special attention. One agent generates, one reviews from
a fresh context, ideally using a different model family. This maps directly to the
adversarial review concept in Step 8.

> **AGENTIC GROUNDING:** Before building multi-agent, answer: "Why can one agent not do
> this?" Multi-agent is justified when you need context isolation, different model families,
> or genuinely different tool sets. The default is one agent. Escalate only with a specific,
> identifiable limitation of the single-agent approach.

---

## 6. Handoffs

*Estimated time: 25 minutes*

When multi-agent does make sense, the critical challenge is the handoff - how one agent
transfers control and context to another. OpenAI's "Orchestrating Agents: Routines and
Handoffs" (October 2024) codified this pattern. The Swarm library (now superseded by the
OpenAI Agents SDK) provided the reference implementation.

### The Mechanism

A handoff has three parts:

1. **Trigger**: The current agent recognises it should transfer. This can be explicit
   (routing decision) or emergent (calling a `transfer_to_X` function).
2. **Context transfer**: What information passes - conversation history, a summary,
   extracted data, or context variables.
3. **Control transfer**: The next agent becomes active. The previous one is done.

### The Swarm Pattern

In Swarm's design, a handoff is a tool that returns an Agent object instead of a string:

```python
# Swarm handoff pattern (conceptual)
class Agent:
  def __init__(self, name: str, instructions: str, tools: list = None):
    self.name = name
    self.instructions = instructions
    self.tools = tools or []

def transfer_to_billing():
  """Transfer to the billing specialist."""
  return billing_agent

triage_agent = Agent(
  name="Triage",
  instructions="Determine the customer's need and transfer to the "
    "appropriate specialist.",
  tools=[transfer_to_billing, transfer_to_technical],
)
```

Handoffs use the same mechanism as tool calls. If a function returns a string, it is a
tool result. If it returns an Agent, the framework swaps the active agent. No special
protocol - just functions.

### What Gets Lost

The conversation history typically survives, but:

- **System prompt changes.** The new agent has different instructions. Domain knowledge
  implicit in the first agent's prompt is not in the second's.
- **Tool context dilution.** Tool results from the first agent are in the conversation
  history but subject to attention dilution (L3). The second agent may not weight them
  as strongly.
- **Accumulated reasoning.** The first agent's reasoning is in the history, but it is now
  L3 input, not the second agent's own reasoning. Anchoring effects differ.

**Context variables** - structured data separate from the conversation - survive handoffs
cleanly. Use them for anything the next agent must know: customer ID, session state,
intermediate results.

```python
#!/usr/bin/env python3
"""Handoff with explicit context passing."""
import anthropic, json

client = anthropic.Anthropic()

def call_agent(name: str, instructions: str, message: str,
               context: dict = None) -> dict:
  system = instructions
  if context:
    system += f"\n\nContext variables:\n{json.dumps(context, indent=2)}"
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=1024,
    system=system, messages=[{"role": "user", "content": message}],
  )
  return {"agent": name, "response": r.content[0].text,
          "tokens": r.usage.input_tokens + r.usage.output_tokens}

# Triage -> specialist handoff
ctx = {"customer_id": "C-1234", "plan": "enterprise"}
triage = call_agent("triage",
  "Classify the issue. Extract key details for the specialist.",
  "API calls failing with 429 errors since yesterday.", ctx)

ctx["triage_summary"] = triage["response"]
specialist = call_agent("technical",
  "Customer triaged. Context variables contain the summary. Troubleshoot.",
  "Help with the issue described in triage summary.", ctx)
```

The specialist gets a fresh message list. The triage summary passes as a context variable,
not conversation history. Clean context (no L3 pollution) with reliable information transfer.

> **HISTORY:** OpenAI published Swarm in October 2024 as an educational framework. By
> early 2025, they released the Agents SDK as the production successor. The core patterns
> carried over: agents as instructions + tools, handoffs as functions returning agent
> objects, context variables for structured state. Swarm remains the better teaching tool;
> the Agents SDK is the production choice.

> **AGENTIC GROUNDING:** Handoff bugs are among the hardest multi-agent failures to
> diagnose. The symptom: "the second agent gave a wrong answer." The cause: information
> from the first agent's context was not passed. When debugging, inspect the handoff
> boundary. Explicit context variables are more reliable than implicit conversation history.

---

## 7. The Simplicity Principle

*Estimated time: 15 minutes*

> "When building applications with LLMs, we recommend finding the simplest solution
> possible, and only increasing complexity when needed. This might mean not building
> agentic systems at all."
> - Erik Schluntz and Barry Zhang, Anthropic (December 2024)

This is the single most important architectural principle. The escalation ladder:

```
1. Single LLM call (augmented LLM)
   v  only if the task requires multiple steps
2. Prompt chaining / routing
   v  only if subtasks benefit from parallel execution
3. Parallelisation
   v  only if decomposition requires intelligence
4. Orchestrator-workers
   v  only if iterative refinement is needed
5. Evaluator-optimizer
   v  only if steps cannot be predefined
6. Agent (LLM-directed tool loop)
   v  only if context isolation or independent verification is needed
7. Multi-agent system
```

Each step up adds cost, latency, complexity, failure modes, and opacity. Each step up
provides capability, quality, and flexibility. The error mode is almost always building too
high on the ladder. Teams reach for orchestrator-workers when chaining would suffice. They
build multi-agent when a single agent with good tools would produce the same results.

### How to Decide

1. Can a single LLM call handle this? Try it. Measure quality.
2. If not, what specifically fails? Name the failure. It points to the pattern.
3. Implement one step up. Not two. Measure again.
4. Repeat until quality is adequate. Not perfect - adequate.

The instinct to "build it right from the start" by choosing a complex architecture is wrong
in this domain. LLM behavior is probabilistic. You cannot predict whether complexity
improves results without testing. Start simple, measure, escalate with evidence.

> **AGENTIC GROUNDING:** The simplicity principle has direct cost impact. A single call
> costs $0.01-0.10. Orchestrator-workers costs $0.10-1.00. Multi-agent with review costs
> $1-10. For 10,000 daily requests, the difference is $300-9,000/day. Start with the
> cheapest architecture that meets the quality bar.

---

## 8. Framework Landscape

*Estimated time: 20 minutes*

Agent frameworks handle boilerplate - LLM call management, tool dispatch, state, error
handling - but introduce abstraction that can obscure the mechanisms you need to understand.

### The Major Frameworks (March 2026)

| Framework | Approach | Core Abstraction | Status |
|-----------|----------|-----------------|--------|
| **LangGraph** | Graph-based | `StateGraph` with typed state, nodes, conditional edges | Production (v1.1+) |
| **OpenAI Agents SDK** | Instructions + tools | Agent = instructions + tools + handoffs | Production |
| **Claude Agent SDK** | Augmented LLM | LLM + retrieval + tools + memory | Production |
| **CrewAI** | Role-based | Agent with role, goal, backstory, tools | Production |
| **AutoGen** | Conversable agents | Group chat between agents | Maturing (v0.4+) |
| **Strands (AWS)** | AWS-integrated | Referenced alongside Claude Agent SDK | Production |

**LangGraph** abstracts control flow as a graph. Nodes are Python functions. Edges connect
them, including conditional edges. The key differentiator is **persistent state and
checkpointing** - agents survive failures, support human-in-the-loop, and maintain memory.
"LangGraph does not abstract prompts or architecture" - it handles plumbing, not decisions.

**OpenAI Agents SDK** abstracts the agent loop and handoffs. More opinionated than LangGraph
(the loop structure is fixed) but simpler. Evolved from Swarm. Handoffs remain tool calls
that return agent objects.

**CrewAI** abstracts agents as personas with roles, goals, and backstories. Intuitive but
potentially misleading - an agent with a "researcher" role does not gain research skills.
The persona affects the system prompt, not the underlying capability.

### When Abstraction Helps vs Obscures

Frameworks help when you need persistent state, built-in observability, or standard patterns
without writing the plumbing. Frameworks obscure when you cannot explain what happens at the
API level, when debugging requires understanding both your code and the framework internals,
or when the framework encourages over-engineering.

The test: **can you build your system with raw API calls?** If yes, you understand the
mechanism. If not, you do not understand what the framework is doing - and you will not be
able to debug it when it fails.

> **HISTORY:** The framework landscape consolidated between 2024 and 2026. LangChain
> stabilised with LangGraph (v1.0 October 2025). OpenAI moved from educational Swarm to
> production Agents SDK. AutoGen underwent a v0.4 rewrite. The trend: toward lower-level,
> more explicit frameworks and away from "autonomous agent" frameworks that tried to handle
> everything automatically. Engineers prefer frameworks that expose the mechanism.

> **AGENTIC GROUNDING:** Framework selection matters less than understanding the underlying
> patterns. When evaluating a framework, check: can I see the LLM calls? Can I inspect
> the context being sent? Can I add stopping conditions? Can I log L5 metrics? If the
> answer is "not easily," the framework is obscuring what you need for production debugging.

---

## 9. The One-Shot Agent Job

*Estimated time: 25 minutes*

Every pattern so far involves interactive execution - a loop running, context accumulating.
There is an alternative that eliminates most failure modes: the **one-shot agent job**.

This project calls this pattern the one-shot agent job (historically "polecat" in the
project's internal vocabulary). It draws on established patterns - Kubernetes Jobs, Unix
`fork+exec`, batch processing - applied to LLM agent execution.

### The Pattern

```
1. Write a plan file (human or prior agent writes the spec)
2. Launch a fresh agent with the plan as primary context
3. Agent executes to completion - no interactive steering
4. Human reviews output AFTER execution
```

The one-shot agent job is the opposite of interactive work. No back-and-forth. The agent
starts with a specification, executes in a fresh context, produces output. The human
reviews the output, not the process.

### Why Stateless Beats Stateful

Interactive sessions accumulate three problems that the one-shot pattern eliminates:

**Context degradation.** As conversation grows, L3 effects compound. The system prompt
drifts to primacy-only position, everything in between (tool results, corrections) competes
for attention. The one-shot agent starts with a fresh context containing only the plan.

**Trajectory corruption.** When the human steers mid-execution ("no, try this instead"),
the correction sits alongside the wrong approach. The model has both the wrong path and
the correction, and must navigate between them. Anchoring from the wrong approach persists.

**Sycophancy escalation.** Over long sessions, sycophantic tendencies compound (Step 1,
Section 8). The model agrees with the human's framing increasingly as compliance history
builds. No conversation history in a one-shot means no sycophancy buildup.

### Implementation

In this project, one-shot jobs run through the Makefile:

```makefile
# One-shot agent job: fresh context, deterministic, no steering
polecat-review:
	@printf "Running review agent...\n"
	claude -p \
	  --model claude-sonnet-4-20250514 \
	  --system-prompt "$$(cat .claude/agents/reviewer.md)" \
	  "Review last commit. $$(cat docs/decisions/current-plan.md)"
```

The `-p` flag means pipe mode: one-shot, no interactive conversation. The plan file is the
**working set** - minimum context for correct output. The agent reads the plan, executes,
terminates. The human runs the quality gate afterward.

### Review After Execution

The most counterintuitive aspect: the human reviews AFTER execution, not during.

1. **Steering during execution degrades output** - corrections create conflicting context.
2. **The quality gate catches most errors** mechanically (typecheck, lint, tests). No
   sycophancy in the gate.
3. **Human review of completed output is more effective** than review of incremental
   progress - the human evaluates coherence, not individual steps.
4. **Human time is better spent on review.** If the human steers every step, the system
   runs at human speed. If the human reviews after, it runs at machine speed with human
   verification.

This maps to the HOTL/HODL spectrum: "HOTL when the gate can verify; HODL when it
requires taste."

> **AGENTIC GROUNDING:** The one-shot agent job works best when: (1) the task is fully
> specifiable in a plan file, (2) the quality gate can verify correctness, and (3) the
> cost of a failed attempt is low. It does not work for exploratory tasks where the goal
> is unclear, or tasks requiring human judgment at intermediate steps. Know which tasks
> fit the pattern and which do not.

---

## Challenge: Identify the Pattern

**Estimated time: 10 minutes**

**Goal:** Given descriptions of real systems, name the workflow or agent pattern.

1. A system classifies customer emails (billing/technical/account), then forwards to a
   specialised handler that generates a response using domain-specific instructions.

2. A code review tool generates reviews from three perspectives (security, performance,
   maintainability) simultaneously, then merges them into a single report.

3. A writing tool generates a blog post, then a separate step scores it. If below 7/10,
   it regenerates with feedback. Repeats up to three times.

4. A coding assistant reads a task, decides which files to read, reads them, writes code,
   runs tests, reads errors, fixes code, runs tests again until they pass.

5. A data pipeline generates a summary from a CSV, uses the summary to generate a
   visualisation description, then generates plotting code from the description.

6. A project tool takes a feature request, uses an LLM to break it into subtasks (count
   depends on the request), assigns each to a specialised generator, synthesises results.

**Verification:**

<details>
<summary>Answers</summary>

1. **Routing.** Classify then dispatch. Two calls.
2. **Parallelisation (sectioning).** Three independent reviews, then merge.
3. **Evaluator-optimizer.** Generate, evaluate, refine loop with threshold.
4. **Agent (tool-use loop).** LLM decides next step based on environment feedback.
5. **Prompt chaining.** Three sequential calls, each feeding the next.
6. **Orchestrator-workers.** Dynamic decomposition, delegated execution, synthesis.

</details>

---

## Challenge: Build a Prompt Chain

**Estimated time: 20 minutes**

**Goal:** Implement a two-step chain with a gate. Observe L5 metrics per step.

Build a chain: (1) generate a Python function from a description, (2) gate: verify output
contains `def ` and `return`, (3) generate unit tests for the function.

```python
#!/usr/bin/env python3
"""Prompt chain with gate and L5 metrics."""
import anthropic, time

client = anthropic.Anthropic()

def step(prompt: str, system: str) -> dict:
  start = time.time()
  r = client.messages.create(
    model="claude-sonnet-4-20250514", max_tokens=1024,
    system=system, messages=[{"role": "user", "content": prompt}]
  )
  return {"text": r.content[0].text,
          "in": r.usage.input_tokens, "out": r.usage.output_tokens,
          "ms": int((time.time() - start) * 1000)}

# Step 1: Generate function
desc = "takes a list of integers, returns list of (number, is_prime) tuples"
s1 = step(f"Write a Python function: {desc}",
          "Generate ONLY the function code. No markdown, no explanation.")
print(f"Step 1: {s1['in']} in, {s1['out']} out, {s1['ms']}ms")

# Gate
if "def " not in s1["text"] or "return" not in s1["text"]:
  print("Gate FAILED: missing function definition or return")
else:
  print("Gate PASSED")
  # Step 2: Generate tests
  s2 = step(f"Write pytest tests for:\n\n{s1['text']}",
            "Generate ONLY test code. No explanation.")
  print(f"Step 2: {s2['in']} in, {s2['out']} out, {s2['ms']}ms")
  print(f"Total: {s1['in']+s2['in']} in, {s1['out']+s2['out']} out")
```

**Verification:** Step 2 should use more input tokens than Step 1 (includes the generated
function as context). The gate should pass for well-formed output.

**Extension:** Add a third step that writes both to temp files and runs `pytest`.

---

## Challenge: Workflow vs Agent Comparison

**Estimated time: 20 minutes**

**Goal:** Implement the same task as a workflow and an agent. Compare cost and latency.

Task: fix all style issues in a Python file (missing docstrings, inconsistent naming).

```python
#!/usr/bin/env python3
"""Compare workflow (single call) vs agent (tool loop) for style fixing."""
import anthropic, time

client = anthropic.Anthropic()

code = '''
def calc(x,y):
    r = x + y
    return r

def processData(items):
    result = []
    for Item in items:
        if Item > 0:
            result.append(Item * 2)
    return result

class dataProcessor:
    def __init__(self, data):
        self.data = data
    def Run(self):
        return processData(self.data)
'''

# Workflow: single call
t0 = time.time()
r1 = client.messages.create(
  model="claude-sonnet-4-20250514", max_tokens=2048,
  system="Fix ALL style issues: add docstrings, snake_case names, type hints. "
    "Return ONLY the fixed code.",
  messages=[{"role": "user", "content": f"Fix:\n{code}"}]
)
w_time = int((time.time() - t0) * 1000)
w_tokens = r1.usage.input_tokens + r1.usage.output_tokens

# Agent: tool loop (simplified - gives tools to fix one issue at a time)
# ... (implement agent version with apply_fix tool, measure iterations)

print(f"Workflow: {w_tokens} tokens, {w_time}ms, 1 call")
# print(f"Agent: {a_tokens} tokens, {a_time}ms, {a_calls} calls")
# Expected: agent uses 3-10x more tokens for comparable output
```

**Verification:** The agent should use significantly more resources. For this task - where
all fixes are independent and steps are predictable - the workflow is strictly better.

**What you are learning:** Not every task benefits from an agent loop. The simplicity
principle in action.

---

## Challenge: Build a Handoff

**Estimated time: 25 minutes**

**Goal:** Build a two-agent system with explicit context transfer. Verify the second agent
has the information it needs.

Agent 1 (analyst) produces a structured JSON analysis of code. Agent 2 (implementer)
receives the analysis as a context variable and generates improvements.

```python
#!/usr/bin/env python3
"""Two-agent handoff with structured context transfer."""
import anthropic, json

client = anthropic.Anthropic()

code = '''
import requests
def get_user(id):
    resp = requests.get(f"http://api.example.com/users/{id}")
    return resp.json()
'''

# Agent 1: Analyst
r1 = client.messages.create(
  model="claude-sonnet-4-20250514", max_tokens=1024,
  system="Analyse code. Return ONLY JSON: 'issues' (list of "
    "{severity, description}), 'recommendations' (list of actions).",
  messages=[{"role": "user", "content": f"Analyse:\n```python\n{code}\n```"}]
)
analysis = json.loads(r1.content[0].text)
print(f"Analyst found {len(analysis.get('issues', []))} issues")

# Handoff: structured data, not conversation history
r2 = client.messages.create(
  model="claude-sonnet-4-20250514", max_tokens=2048,
  system="Implement ALL improvements from the analysis. Return ONLY code.",
  messages=[{"role": "user",
    "content": f"Original:\n```python\n{code}\n```\n\n"
      f"Analysis:\n{json.dumps(analysis, indent=2)}\n\nFix all issues."}]
)
print(f"Implementer output:\n{r2.content[0].text}")
```

**Verification:** Agent 1 should identify missing error handling, no type hints, hardcoded
URL. Agent 2 should address the specific issues. The structured handoff (JSON) should
produce better-targeted improvements than sending raw code alone.

**Extension:** Add a third agent (verifier) that checks whether all issues were addressed.

---

## Challenge: Design a One-Shot Pipeline

**Estimated time: 20 minutes**

**Goal:** Write a plan file for a one-shot agent job, then implement the execution.

Task: an automated code review of the last git commit.

```python
#!/usr/bin/env python3
"""One-shot agent job: plan -> fresh context -> execution."""
import anthropic, subprocess

client = anthropic.Anthropic()

# Build plan context
try:
  diff = subprocess.run(
    ["git", "diff", "HEAD~1", "HEAD"],
    capture_output=True, text=True, timeout=10
  ).stdout or "(no diff available)"
except (subprocess.TimeoutExpired, FileNotFoundError):
  diff = "(no git available - using sample diff)"

plan = f"""# Code Review Plan
## Task
Review the git diff. Return JSON: 'issues' (list with severity/description/suggestion),
'approval' (bool), 'summary' (string).

## Review Criteria
1. Security: injection, auth, data exposure
2. Correctness: logic errors, edge cases
3. Style: naming, structure, conventions

## Diff
```diff
{diff}
```
"""

# One-shot execution: fresh context, no history
r = client.messages.create(
  model="claude-sonnet-4-20250514", max_tokens=2048,
  system="Execute the review plan exactly. Return ONLY JSON.",
  messages=[{"role": "user", "content": plan}]
)
print(f"Plan: {len(plan)} chars")
print(f"Review:\n{r.content[0].text}")
```

**What you are learning:** The plan file IS the working set. If the plan is incomplete, the
output will be wrong - and that is a plan quality problem, not a model problem.

---

## Challenge: L6 Mode Identification

**Estimated time: 10 minutes**

**Goal:** Identify the L6 mode for each scenario.

1. Using the Claude API directly in a Python script. One message in, one message out.
2. LangGraph with three nodes: classify, process, summarise.
3. Your agent has been running 15 minutes. You press Ctrl-C.
4. After context window compaction, you read `git log` to reconstruct decisions.
5. Claude Code is running with 5 tools, 8 tool calls made. You type a message.

**Verification:**

<details>
<summary>Answers</summary>

1. **L6a DIRECT.** Single call-response.
2. **L6b DISPATCH.** Framework orchestrates multiple LLM calls.
3. **L6c OVERRIDE.** Hardware-level interrupt.
4. **L6d BYPASS.** State exchange through filesystem, outside the harness.
5. **L6b DISPATCH with queued L6a.** Tool execution is L6b. Your message queues FIFO.

</details>

---

## Key Takeaways

Before moving on, you should be able to answer without looking anything up:

1. What are the four L6 modes? What is the diagnostic implication of each?
2. What is the difference between a workflow and an agent? When is each appropriate?
3. Name the five workflow patterns. What does each cost in LLM calls?
4. What stopping conditions does a production agent loop need?
5. When does multi-agent provide value a single agent cannot?
6. What gets lost at a handoff boundary? What transfers reliably?
7. What is the simplicity principle and the escalation ladder?
8. What should you check when evaluating an agent framework?
9. What is the one-shot agent job? What three problems does it eliminate?
10. Why does the human review after execution, not during?

---

## Recommended Reading

- **"Building effective agents"** - Erik Schluntz and Barry Zhang, Anthropic (December
  2024). anthropic.com/engineering/building-effective-agents. The primary reference for all
  five workflow patterns, the augmented LLM concept, and the simplicity principle. Read the
  full article including both appendices.

- **"Orchestrating Agents: Routines and Handoffs"** - Ilan Bigio, OpenAI (October 2024).
  cookbook.openai.com/examples/orchestrating_agents. Defines routines and handoffs. The
  conceptual foundation for the Agents SDK.

- **OpenAI Swarm repository** - github.com/openai/swarm. Superseded by Agents SDK for
  production, but the best educational implementation. Read the source.

- **LangGraph documentation** - docs.langchain.com. Graph-based orchestration. Read the
  "Why LangGraph?" section for the case for explicit state management.

- **Layer model L6** - `docs/internal/layer-model.md` in this project. The four modes
  with cross-cutting observations about harness opacity.

---

## What to Read Next

**Step 4: Context Engineering** - The context window (L3) is the finite resource that
every architecture pattern in this step consumes. Context engineering is the discipline of
managing that resource: what enters the context, where it is positioned, when it is pruned,
and how to recover when the window is exhausted. The working set concept (minimum context
for correct output) is the bridge from architecture to operational practice.

**Step 5: Tool Design and Agent-Computer Interfaces** - The tools available to an agent
determine what it can do. Step 5 covers tool design as an engineering discipline: schemas
that LLMs use reliably, the ACI concept from Anthropic's SWE-bench work, and the finding
that "we spent more time optimising our tools than the overall prompt."

