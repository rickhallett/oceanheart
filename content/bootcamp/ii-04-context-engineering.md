+++
title = "Context Engineering"
date = "2026-03-10"
description = "The working set, cold and hot pressure, compaction loss, the dumb zone. The novel discipline."
tags = ["context", "engineering", "novel", "bootcamp"]
step = 4
tier = 2
estimate = "5-6 hours"
bootcamp = 2
+++

Step 4 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This is Step 4

Prompt engineering is what you say to the model. Context engineering is what information
is available when the model processes your request, and how that information is structured.
The distinction is not pedantic. You can write a perfect prompt and still get garbage output
if the model does not have the right information in its context window. Conversely, you can
write a mediocre prompt and get correct output if the right context is loaded.

Step 1 gave you L3 - the context window as a finite resource with position effects, primacy
and recency bias, and lost-in-the-middle. Step 3 gave you L8 - system prompts as
specifications that occupy the primacy position, and the observation that more role content
is not monotonically better (arXiv:2602.11988). This step takes those mechanics and builds
the engineering discipline on top of them.

The core problem: an LLM has no persistent memory. It has no filesystem. It has no
database. It has a context window - a fixed-size buffer of tokens that is its entire world.
Everything the model "knows" about your project, your codebase, your conventions, your
current task must be inside that window or it does not exist. When the window fills and
compacts, anything not written to durable storage is gone. Not degraded. Gone.

This step is where the bootcamp's novel content is most concentrated. RAG, token counting,
and prompt caching are established techniques covered well by Anthropic and OpenAI
documentation. The concepts introduced here - the working set isomorphism, cold and hot
context pressure, compaction loss, the dumb zone, and the context quality loop - are named
operational concepts developed from daily practice in agentic engineering. They have
specific definitions and specific controls, not vague warnings.

> **FIELD MATURITY: FRONTIER.** The term "context engineering" is emerging in practitioner
> discourse (Tobi Lutke, community talks, late 2025 onwards). RAG and token counting are
> established. What is not established - what no published academic framework covers - is
> the operational dynamics of context windows under sustained agentic use: the pressure
> framework, the working set concept applied to LLMs, the dumb zone as a named state,
> compaction loss as a binary failure mode, stale reference propagation as an agentic form
> of configuration drift, and the context quality loop. These concepts are novel to this
> project, identified as genuinely novel by independent cross-triangulation of the project
> lexicon. Intellectual honesty requires stating this: you are reading operational concepts
> derived from one project, one model family, and 200+ session decisions of daily practice.
> They are engineering instruments, not research findings. If you recognise them in your
> own work, they replicate. If you do not, they do not.

The goal: build a mental model of context management accurate enough that when an agent
produces syntactically valid but semantically disconnected output, you can identify whether
the failure is cold context pressure, hot context pressure, stale references, or something
else entirely - and you know the specific control for each.

---

## Table of Contents

1. [Context Engineering vs Prompt Engineering](#1-context-engineering-vs-prompt-engineering) (~25 min)
2. [The Working Set](#2-the-working-set) (~40 min)
3. [Cold Context Pressure](#3-cold-context-pressure) (~40 min)
4. [Hot Context Pressure](#4-hot-context-pressure) (~35 min)
5. [Compaction Loss](#5-compaction-loss) (~30 min)
6. [The Dumb Zone](#6-the-dumb-zone) (~35 min)
7. [Stale Reference Propagation](#7-stale-reference-propagation) (~30 min)
8. [The Context Quality Loop](#8-the-context-quality-loop) (~30 min)
9. [Practical Techniques](#9-practical-techniques) (~40 min)
10. [Challenges](#10-challenges) (~60-90 min)
11. [Key Takeaways](#11-key-takeaways)
12. [Recommended Reading](#12-recommended-reading)
13. [What to Read Next](#13-what-to-read-next)

---

## 1. Context Engineering vs Prompt Engineering

*Estimated time: 25 minutes*

Most people treat "prompt engineering" and "context engineering" as synonyms. They are not.
The distinction is structural, and confusing them produces a specific class of failures.

**Prompt engineering** is the craft of writing effective instructions. What words you use,
how you structure your request, what output format you specify, what examples you include.
It operates primarily at L8 (agent role) and concerns the tokens you deliberately author.

**Context engineering** is the discipline of managing the entire context window - everything
the model can attend to during generation. This includes the system prompt (L8), but also
conversation history, tool results, retrieved documents, injected file contents, and all the
other tokens that arrive in the context window by mechanisms other than your prompt.

The difference matters because in agentic systems, the tokens you author are a minority
of the total context. Consider an agent that has been working for 30 minutes:

| Component | Approximate Tokens | Source |
|-----------|-------------------|--------|
| System prompt | 2,000 | You authored this |
| Conversation history | 15,000 | Accumulated turns |
| Tool results (file reads, shell output) | 60,000 | Agent's tool calls |
| Retrieved documents (RAG) | 10,000 | Search results |
| Current user message | 200 | Your latest instruction |
| **Total input context** | **~87,200** | |
| **Tokens you authored** | **~2,200** | **2.5% of total** |

You engineered 2.5% of the tokens. The other 97.5% arrived through system mechanics -
conversation accumulation, tool calls, retrieval pipelines. Your prompt might be
perfectly crafted. If the other 97.5% is noise, stale, or irrelevant, the model attends
to noise.

This is why context engineering is a distinct discipline. The same model, given the same
prompt, will produce correct output or garbage depending on what else is in the context
window. The prompt is one variable. The context is the whole system.

### What Context Engineering Controls

Context engineering answers questions that prompt engineering does not touch:

- **What enters the context window?** Which files, which conversation history, which tool
  results? Not everything available - everything relevant.
- **When does it enter?** At boot time? On demand? In response to a specific trigger?
  Loading 50 files at session start burns context budget before the first instruction.
- **How much of it enters?** The full file or a summary? The complete git diff or just the
  changed files? The entire conversation or only the last 5 turns?
- **What gets removed?** When the window approaches capacity, what gets pruned? Old tool
  results? Conversation history? Injected documents?
- **What persists outside the window?** Decisions written to files, session summaries,
  checkpoint state. Everything that survives context death.

These are engineering decisions with measurable consequences. Get them right and the model
operates inside its effective range. Get them wrong and you enter the dumb zone - where
the output looks correct to someone who does not know the project, and is wrong to someone
who does.

> **AGENTIC GROUNDING:** When an agent starts producing generic-looking output that
> ignores project-specific conventions, the first diagnostic question is not "is the
> prompt wrong?" but "what is in the context window?" Use the API's token counting
> (L5 - the only calibrated layer) to measure context utilisation. If the agent has
> been running for an hour and has consumed 150K of a 200K window, the problem is
> not the prompt. It is context pressure. The fix is context management: fresh windows,
> session boundaries, or context pruning. Step 9 covers recovery procedures in detail.

---

## 2. The Working Set

*Estimated time: 40 minutes*

In 1968, Peter Denning published "The Working Set Model for Program Behavior" in
Communications of the ACM. The paper solved a problem that was crippling early
timesharing systems: thrashing.

The problem was this: a timesharing system runs multiple programs, each with its own
virtual memory pages. Physical RAM is finite. When the system runs too many programs
simultaneously, each program has too few of its pages in RAM. Every memory access
triggers a page fault - the OS must swap a page from disk, which takes orders of
magnitude longer than a memory access. The system spends all its time swapping pages
and no time doing useful work. This is thrashing.

Denning's insight was the **working set** - the collection of pages referenced by a
process during a recent time interval. If a process's entire working set fits in RAM,
it runs efficiently. If any page of the working set is missing, page faults spike and
throughput collapses. The model is all-or-nothing: below the working set threshold,
performance degrades catastrophically, not gracefully.

### The Structural Isomorphism

This maps directly to LLM context windows. The mapping is structural, not metaphorical.

| Virtual Memory (Denning 1968) | LLM Context Window |
|-------------------------------|-------------------|
| Physical RAM | Context window (token budget) |
| Virtual memory pages | Information chunks (files, docs, history) |
| Working set W(t, tau) | Minimum context for correct generation |
| Page fault | Model falls back to training data priors |
| Thrashing | Pattern-matching instead of project-specific reasoning |
| Efficient execution | Correct, project-specific output |
| Swapping unnecessary pages into RAM | Loading irrelevant context (hot pressure) |

The isomorphism is exact in the following structural sense:

1. **Below the threshold, performance degrades catastrophically.** A process missing
   one critical page thrashes. An LLM missing one critical file generates plausible
   boilerplate instead of project-specific code. In both cases, the degradation is not
   proportional - it is a phase transition.

2. **Above the threshold, adding more does not help - it can hurt.** A process with
   twice its working set in RAM runs no faster and wastes memory that other processes
   could use. An LLM with twice its working set in context runs no better and wastes
   attention budget on irrelevant tokens - diluting focus on what matters.

3. **The working set changes over time.** A process accessing different data structures
   has a different working set at each phase. An agent working on authentication has a
   different working set than the same agent working on billing. The working set is not
   static.

4. **Finding the working set is the engineering problem.** In virtual memory, the OS
   approximates the working set using page reference bits and clock algorithms. In context
   engineering, the operator (or the system) must identify the minimum files, documents,
   and history needed for the current task. Both are approximation problems with the same
   structural goal: find the minimum sufficient set.

> **HISTORY:** Denning's 1968 paper was not immediately accepted. The working set model
> required tracking per-process page references, which was computationally expensive on
> 1960s hardware. The competing approach - global LRU page replacement - was simpler to
> implement but suffered from exactly the thrashing problem Denning predicted. It took
> nearly a decade for operating systems to implement working set approximations (BSD 4.3's
> page daemon, 1986). The concept has since been extended to CPU cache lines, file system
> buffer caches, and network connection pools. The structural pattern - find the minimum
> resident set, keep it loaded, evict everything else - recurs across every system with a
> fast tier and a slow tier. LLM context windows are the latest instance. Denning
> published "Working Set Analytics" in ACM Computing Surveys as recently as 2021,
> confirming the model's continued relevance 53 years after its introduction.

### Working Set in Practice

For an LLM agent working on a task, the working set is the answer to: "What is the
minimum set of files, documents, conversation history, and instructions that must be in
the context window for the agent to produce correct output?"

Not "all relevant context" - that is unbounded. Not "everything the agent might need" -
that is the entire codebase. The working set is the minimum. Below it, the agent produces
garbage. Above it, you are wasting budget.

Here is how to think about working set identification for common tasks:

**Task: Fix a bug in `lib/auth/login.ts`**

Working set:
- `lib/auth/login.ts` (the file with the bug)
- `lib/auth/types.ts` (the types used by the file)
- The specific error message or failing test
- The project's coding conventions (from AGENTS.md or equivalent)

Not in the working set:
- `lib/billing/` (different domain)
- The full conversation history from three tasks ago
- Every file that imports from `lib/auth/` (only needed if the fix changes the interface)

**Task: Add a new API endpoint for user profiles**

Working set:
- An existing endpoint file (as a pattern to follow)
- The database schema for the relevant tables
- The router configuration
- The project's conventions document

Not in the working set:
- The complete database schema (only the relevant tables)
- All existing endpoint files (one exemplar is sufficient)
- The test suite for unrelated endpoints

The key observation is that the working set is task-dependent and typically much smaller
than the full codebase. An agent that loads the entire `lib/` directory into context for
a single file fix is not being thorough. It is wasting attention budget.

### Estimating Working Set Size

A rough heuristic for working set estimation:

```
Working set tokens =
  system prompt (~2K)
  + task description (~200-500)
  + primary files (files you will read or modify)
  + type definitions / interfaces used by primary files
  + one exemplar file (if generating new code following a pattern)
  + conventions document (AGENTS.md, style guide)
```

For most focused tasks, this is 5,000-30,000 tokens. For complex, cross-cutting changes,
it might be 50,000-80,000 tokens. If your working set estimate exceeds 100,000 tokens,
the task is probably too large for a single agent pass and should be decomposed.

```python
#!/usr/bin/env python3
"""Estimate working set size for a task by counting tokens in relevant files."""

import anthropic
from pathlib import Path

client = anthropic.Anthropic()

def count_tokens(text: str) -> int:
  """Count tokens using the Anthropic API."""
  response = client.messages.count_tokens(
    model="claude-sonnet-4-20250514",
    messages=[{"role": "user", "content": text}]
  )
  return response.input_tokens

def estimate_working_set(files: list[str], task_description: str) -> dict:
  """Estimate working set size for a set of files plus a task."""
  results = {}
  total = 0

  # Task description
  task_tokens = count_tokens(task_description)
  results["task_description"] = task_tokens
  total += task_tokens

  # Each file
  for filepath in files:
    try:
      content = Path(filepath).read_text()
      tokens = count_tokens(content)
      results[filepath] = tokens
      total += tokens
    except FileNotFoundError:
      results[filepath] = "FILE NOT FOUND"

  results["_total"] = total
  return results

# Example: estimate working set for fixing a bug in auth
working_set = estimate_working_set(
  files=[
    "lib/auth/login.ts",
    "lib/auth/types.ts",
    "AGENTS.md",
  ],
  task_description="Fix the login endpoint to validate email format before database lookup"
)

for key, value in working_set.items():
  printf_line = f"  {key}: {value} tokens"
  print(printf_line)
```

> **AGENTIC GROUNDING:** The working set concept directly explains why agents produce
> different quality output for the same task depending on what is loaded. If an agent has
> access to the right 3 files, it generates project-specific code. If it has access to 50
> files, attention dilutes and it generates more generic code. If it has no project files
> at all, it pattern-matches from training data. The operator's job is to identify and load
> the working set - no more, no less. This project's AGENTS.md BFS rule (depth 1 = every
> session, depth 2 = when topic is relevant, depth 3+ = deliberate research only) is a
> working set management heuristic. It controls context loading to keep the agent in the
> effective range.

---

## 3. Cold Context Pressure

*Estimated time: 40 minutes*

**Cold context pressure** is what happens when the context window contains too little
project-specific information. The model fills the gap with high-probability token sequences
from its training data (L0 weights) rather than with knowledge about your specific project,
codebase, or conventions.

This is a novel concept. The term is not in the published literature. It names an
operational state specific to LLM-based workflows that practitioners encounter daily but
have not had a label for.

### The Mechanism

An LLM generates each token by computing P(next_token | all_previous_tokens). When the
context window contains rich, project-specific information - the correct file, the right
type definitions, the project's conventions - that information shapes the probability
distribution toward project-specific output.

When the context window is sparse - a task description and nothing else - the model has no
project-specific signal to condition on. It falls back to the strongest patterns in L0:
generic solutions, common library idioms, popular frameworks, Stack Overflow-style answers.
The output is syntactically correct. It compiles. It might even work. But it does not
reflect your project. It reflects the aggregate of all projects in the training data.

This is not hallucination. Hallucination is generating false facts. Cold context pressure
produces **true-in-general, wrong-for-this-project** output. The model is not making
things up. It is pattern-matching to the most probable output given insufficient context.

### Recognising Cold Context Pressure

Cold context pressure has a distinctive signature. If you observe these patterns, the
problem is likely insufficient context, not insufficient prompting:

**1. Generic boilerplate instead of project-specific code.**

The agent generates a fresh Express.js server setup when your project uses Hono. It writes
`console.log` for error handling when your project uses a structured logger. It creates a
`utils/helpers.ts` file when your project has a specific module structure.

```typescript
// Cold context: agent generates generic Express boilerplate
import express from 'express';
const app = express();
app.use(express.json());

app.post('/api/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.json(user);
  } catch (err) {
    console.log(err);  // generic error handling
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Warm context: agent generates project-specific code
// (because it has seen lib/common/server.ts and lib/common/errors.ts)
import { createRoute } from '../common/server';
import { AppError, handleError } from '../common/errors';
import { logger } from '../common/logger';

export const createUser = createRoute('POST', '/api/users', async (ctx) => {
  const validated = ctx.validated.json;  // uses project's validation pattern
  const user = await ctx.db.insert(users).values(validated).returning();
  return ctx.json(user[0], 201);
});
```

The first version is not wrong. It would work. But it does not belong in this project.
It belongs in the average project from the training data.

**2. Stdlib patterns from training data rather than current conventions.**

The agent uses `fs.readFileSync` (Node.js built-in) when your project uses a wrapper with
retry logic. It uses raw SQL strings when your project uses Drizzle ORM. It uses `fetch`
directly when your project has an HTTP client with authentication headers pre-configured.

**3. Hallucinated file paths and function names that sound plausible.**

The agent references `src/utils/auth.ts` when the actual path is `lib/auth/login.ts`.
It calls `validateUser()` when the actual function is `verifyCredentials()`. The names
are reasonable - they are what you would expect in a typical project. They are not what
exists in this project. The model has not seen the filesystem; it is predicting plausible
paths from the task description.

**4. Missing domain-specific constraints.**

The agent implements a function that works generically but violates a domain constraint
it does not know about. It creates a user without checking the subscription limit. It
processes a payment without the required audit trail. The constraint is not in the context,
so the model cannot condition on it.

### Cold Pressure in Practice: A Reproducible Demonstration

You can demonstrate cold context pressure with any coding agent. The following procedure
isolates the variable:

**Step 1: Pick a file in your project that follows project-specific conventions.**

Choose a file that uses patterns unique to your project - custom base classes, specific
error handling, project-specific imports.

**Step 2: Ask the agent to create a new file similar to the chosen one, without
providing the exemplar.**

Give the agent only the task description: "Create a new API endpoint for user profiles
that follows the same patterns as the user authentication endpoint."

Do not provide the authentication endpoint file. Do not provide type definitions. Do not
provide the conventions document.

**Step 3: Ask the agent the same question, but this time include the exemplar file.**

Provide the authentication endpoint file, the relevant type definitions, and the
conventions document.

**Step 4: Compare the outputs.**

The difference is cold context pressure made visible. The first output will be generic.
The second will be project-specific. The prompt was identical. The context was different.

```bash
# Step 2: cold context
printf 'Create a new API endpoint for user profiles following the same patterns as the user auth endpoint.\n' \
  | claude --model claude-sonnet-4-20250514 --print

# Step 3: warm context (exemplar loaded)
printf 'Here is the existing auth endpoint:\n\n%s\n\nHere are the relevant types:\n\n%s\n\nCreate a new API endpoint for user profiles following the same patterns.\n' \
  "$(cat lib/auth/login.ts)" \
  "$(cat lib/auth/types.ts)" \
  | claude --model claude-sonnet-4-20250514 --print
```

Run both. Diff the outputs. The difference is the working set.

> **AGENTIC GROUNDING:** Cold context pressure is the most common context failure in
> practice. It manifests when an agent is dispatched to a task without loading its working
> set first. The fix is not a better prompt - it is loading the right files. In this
> project, the one-shot agent job pattern addresses this by design: the plan file IS the
> working set. The agent receives a plan file containing the specific files, types, and
> conventions needed for the task. Nothing enters the context except the working set.
> If you skip the plan file, the polecat operates under cold pressure, and the output
> will be generic.

---

## 4. Hot Context Pressure

*Estimated time: 35 minutes*

**Hot context pressure** is the inverse: too much in the context window. The model's
attention budget is finite (Step 1, Section 4 - O(n^2) attention cost). When the context
is filled with tangentially related material, signal-to-noise degrades. The model attends
to everything but focuses on nothing.

This is also a novel concept. The term is not in the published literature as a named
operational state, though the phenomenon has been empirically validated.

### The Mechanism

Attention is a finite resource. The softmax in the attention mechanism distributes weight
across all tokens in the context. When you add 50,000 tokens of tangentially relevant
material to a context that already contains a 5,000-token working set, the attention
weight available to the working set tokens decreases. The model does not ignore the
irrelevant tokens - it attends to them, distributing attention that should be concentrated
on the tokens that matter.

The result is subtle but measurable: output quality degrades. Not catastrophically, as
with cold pressure. Gradually. The agent still uses project-specific patterns (they are
in the context), but it starts mixing in patterns from the irrelevant context. It follows
conventions inconsistently. It addresses requirements partially. It generates code that is
closer to the project style but not quite right.

### Empirical Evidence: arXiv:2602.11988

In February 2026, Gloaguen et al. published "Evaluating AGENTS.md: Are Repository-Level
Context Files Helpful for Coding Agents?" (arXiv:2602.11988). This paper provides the
first rigorous empirical study of hot context pressure in coding agents, though it does
not use that term.

Key findings:

- Context files (like AGENTS.md, CLAUDE.md) **tend to reduce task success rates** compared
  to providing no repository context
- They also **increase inference cost by over 20%**
- "Unnecessary requirements from context files make tasks harder"
- Recommendation: "human-written context files should describe only minimal requirements"

This validates the working set principle from the opposite direction. The paper shows that
adding context beyond the working set - even well-intentioned, high-quality context - can
make agents perform worse. The mechanism is hot context pressure: additional instructions
and conventions dilute attention from the actual task.

The paper's recommendation ("describe only minimal requirements") is precisely the working
set principle stated in different terms.

### Recognising Hot Context Pressure

Hot context pressure is harder to spot than cold pressure because the output is closer to
correct. Look for these signatures:

**1. Inconsistent convention adherence.**

The agent follows the project's import ordering in some places and ignores it in others.
It uses the correct error handling pattern for the first function and generic error handling
for the second. The conventions are in the context, but attention to them is diluted by
everything else.

**2. Partially addressed requirements.**

The agent implements 4 out of 6 requirements from the task description. The requirements
are all in the context, but the model's attention distributed unevenly across them. The
requirements that align with common patterns get implemented; the ones that are unusual
get missed.

**3. Conflating concepts from different parts of the context.**

The agent mixes terminology or patterns from different files loaded into context. It
uses the naming convention from `lib/auth/` when generating code for `lib/billing/`. It
applies test patterns from one domain to another where they do not fit. The agent is not
confused - it is attending to patterns from across the entire context and blending them.

**4. Increased latency and cost with no quality improvement.**

The API reports higher input token counts and longer response times. The output is not
better - it might be worse. You are paying for tokens the model is attending to without
benefit.

### Hot Pressure vs Cold Pressure: The Diagnostic Fork

When output quality is poor, the diagnostic question is:

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Output is generic, ignores project specifics | Cold pressure | Load the working set |
| Output is project-aware but inconsistent, partially correct | Hot pressure | Remove irrelevant context |
| Output is syntactically valid but semantically disconnected | Dumb zone (Section 6) | Reset context, verify working set |
| Output was correct earlier, degraded over session | Hot pressure from accumulation | Fresh context window |

The difference between cold and hot pressure is clinically distinguishable. Cold pressure
produces output that looks like it came from a different project. Hot pressure produces
output that looks like it came from your project but was written by someone who skimmed
the requirements.

### Practical Demonstration

```python
#!/usr/bin/env python3
"""Demonstrate hot context pressure by measuring output quality
with increasing irrelevant context."""

import anthropic
from pathlib import Path

client = anthropic.Anthropic()

task = """Write a function that validates an email address.
Requirements:
1. Must check for @ symbol
2. Must check for at least one dot after @
3. Must reject empty local part (before @)
4. Must reject empty domain (after @)
5. Return a typed result: { valid: boolean, error?: string }
"""

# Baseline: task only (cold, but focused)
baseline = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=1024,
  messages=[{"role": "user", "content": task}]
)

# Hot context: same task buried in irrelevant material
noise = "Here is the full project documentation:\n\n"
# Simulate loading 20 unrelated files
for i in range(20):
  noise += f"## Module {i}: {''.join(['lorem ipsum dolor sit amet. '] * 50)}\n\n"

hot_response = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=1024,
  messages=[{"role": "user", "content": noise + "\n\nNow for the actual task:\n\n" + task}]
)

print(f"Baseline input tokens: {baseline.usage.input_tokens}")
print(f"Hot context input tokens: {hot_response.usage.input_tokens}")
print(f"Token ratio: {hot_response.usage.input_tokens / baseline.usage.input_tokens:.1f}x")
print(f"\nCompare the outputs for requirement coverage and consistency.")
print(f"\nBaseline:\n{baseline.content[0].text[:500]}")
print(f"\nHot context:\n{hot_response.content[0].text[:500]}")
```

> **AGENTIC GROUNDING:** Hot context pressure is why this project's BFS depth rule exists.
> "Depth 1 = every session. Depth 2 = when topic is relevant. Depth 3+ = deliberate
> research only." Loading depth-3 files on every boot consumes tokens without benefit. The
> one-shot agent job pattern mitigates hot pressure by design: a fresh context window
> containing only the working set. No conversation history from previous tasks. No tool
> results from earlier debugging. Every dispatch starts clean. If you are running a
> long-lived agent session and output quality is degrading, the cheapest fix is often a
> fresh window with a curated working set.

---

## 5. Compaction Loss

*Estimated time: 30 minutes*

**Compaction loss** is what happens when a context window fills to capacity and the harness
(L6) must reduce it. Unlike filesystem state, which degrades gracefully (a corrupted sector
does not destroy the entire disk), context loss is binary and total.

This is a novel concept. The specific failure mode - binary, total context loss without
graceful degradation - is unique to LLM workflows and does not have a published equivalent.

### The Phase Transition

Context window compaction is not a gradient. It is a phase transition.

One tick: 200,000 tokens of accumulated conversation, tool results, decisions, reasoning,
corrections, and calibration history. The model has full access to the entire session.

Next tick: the harness compacts. Depending on the implementation, the window contains a
summary, the system prompt, and the most recent messages. Everything else is gone.

The summary attempts to preserve key decisions and facts. It cannot preserve calibration.
If you spent 16 rounds correcting the model's understanding of a specific domain concept,
the fact of the concept may survive compaction. The 16 rounds of correction - the nuance,
the edge cases, the specific misunderstandings that were resolved - do not. The model
reverts to its training data prior for that concept, and the correction cycle begins again.

This is qualitatively different from filesystem degradation:

| Property | Filesystem | Context Window |
|----------|-----------|---------------|
| Failure mode | Sector/block level | Total window replacement |
| Granularity | Individual files affected | Everything affected simultaneously |
| Recovery | Repair tools, backups, journaling | No in-window recovery possible |
| Graceful degradation | Yes - most data survives | No - compaction replaces the window |
| External recovery | RAID, backup, replication | **Only if written to durable storage** |

The standing policy in this project - "write decisions to durable file, not context only"
(SD-266, permanent) - exists because compaction loss was observed in production. A full
day's decisions, made in context, discussed, agreed upon, were lost when the window
compacted. The decisions existed only in the context. After compaction, they did not exist
anywhere.

### What Survives Compaction

| Survives | Lost |
|----------|------|
| Files committed to git | Uncommitted reasoning |
| Decisions written to session files | Verbal agreements in conversation |
| Standing orders in AGENTS.md | Ad-hoc instructions given in-thread |
| Test results (pass/fail in CI) | The reasoning that led to test design |
| Configuration changes on disk | The intent behind the change |

The pattern is clear: **anything written to durable storage survives. Everything else is
volatile.** The context window is volatile memory. Git, the filesystem, and external
databases are durable storage.

### The Compaction Trap

The most dangerous form of compaction loss is decisions that both parties (human and agent)
believe are established but that exist only in the context window. The conversation went:

1. Human proposes approach A
2. Agent identifies a problem with A, proposes B
3. Human agrees to B with a modification
4. Agent acknowledges B-modified
5. Work proceeds based on B-modified

If compaction occurs after step 5, the decision to use B-modified is gone. The agent
re-encounters the task, defaults to approach A (the most probable from training data),
and the human may not notice because the decision felt "established." It was established
in context. It was never written to file.

```bash
# The defence against compaction loss is durable writes.
# After every significant decision, write it to a file.

# Bad: decision exists only in conversation
# "Let's use approach B with the modification we discussed."

# Good: decision written to file
printf 'SD-325: Use approach B-modified for auth flow.\nRationale: A has race condition under concurrent sessions.\nModification: Add mutex on session token refresh.\n' \
  >> docs/decisions/current-session.md
git add docs/decisions/current-session.md
git commit -m "docs: record auth flow decision SD-325"
```

The cost of a durable write is approximately 30 seconds. The cost of re-deriving a lost
decision is the full discussion time again, plus the risk of reaching a different (possibly
worse) conclusion.

> **HISTORY:** The closest established parallel to compaction loss is the write-ahead log
> (WAL) in databases. PostgreSQL, SQLite, and other databases write every change to a
> sequential log before applying it to the data files. If the system crashes, the WAL
> provides a recovery path - replay the log to reconstruct the state. The standing policy
> "write decisions to durable file" (SD-266) is structurally identical to WAL discipline:
> write the decision log entry before acting on the decision. The difference is that
> databases implement WAL automatically at the system level. In agentic workflows,
> durable writes are a manual discipline. There is no automatic WAL for context windows.
> You either write the decision to file, or you accept that it might not survive.

> **AGENTIC GROUNDING:** When a long agent session starts producing output that contradicts
> earlier decisions, check whether compaction has occurred. Look at the token count (L5).
> If the count dropped dramatically between turns, the window was compacted. Check whether
> the key decisions from the session are recorded in durable files (git log, session
> decision files). If they are not, they are gone. The recovery procedure is not "remind
> the agent" - it is to load the durable state and rebuild from the last known position.
> This is checkpoint recovery, covered in Step 9.

---

## 6. The Dumb Zone

*Estimated time: 35 minutes*

The **dumb zone** is the state where an agent operates outside its effective context range.
The output has three properties simultaneously:

1. **Syntactically valid.** It parses. It compiles. It type-checks.
2. **Structurally sound.** It follows recognisable patterns. Functions are well-formed.
   Error handling exists. The code looks professional.
3. **Semantically disconnected.** It solves a different problem, uses wrong domain terms,
   ignores project-specific constraints, or implements a generic solution where a specific
   one was needed.

This is a novel concept. The term is not in the published literature. It names a state
that practitioners encounter frequently but typically attribute to the wrong cause: "the
model is bad," "AI cannot code," "hallucination."

The dumb zone is not a model failure. It is a context failure. The model is doing exactly
what it should - generating the most probable output given its context. The context is
insufficient, so the most probable output is generic. The Operator's job is to keep the
agent out of the dumb zone by ensuring the working set is loaded.

### Why the Dumb Zone is Dangerous

The dumb zone is more dangerous than outright failure. When a model produces an error -
a syntax error, a type error, a reference to a function that does not exist - the failure
is visible. The gate catches it. The compiler catches it. The human catches it.

Dumb zone output passes these checks. It compiles. It type-checks. It may even pass tests
if the tests are themselves generic (testing that "the function returns something" rather
than "the function returns the correct thing for this specific domain constraint").

Detection requires someone who knows the project. Someone who looks at the output and
says: "This is not wrong, but this is not what we do here." The output looks correct to
someone reviewing it without context. It looks wrong to someone who has the context. The
gap between those two perspectives is the dumb zone.

### Dumb Zone Examples

**Example 1: Domain term substitution**

The project uses "bout" to mean a scored interaction between two AI agents. The agent
generates code that uses "match" instead - a reasonable synonym from general usage, but
wrong in this codebase. Every reference to "match" is technically valid (it could mean
that), but it does not connect to the existing `bouts` module, the `BoutResult` type, or
the `scoreBout()` function. The code compiles. It is semantically disconnected from the
project.

```typescript
// Dumb zone output: generic term from training data
interface MatchResult {
  winnerId: string;
  loserId: string;
  score: number;
}

async function processMatch(match: MatchResult) {
  // Generic implementation - works, but disconnected
  await db.insert(matches).values(match);
}

// Correct output (with working set loaded):
import { BoutResult, BoutStatus } from '../bouts/types';
import { scoreBout } from '../bouts/scoring';

async function processBout(result: BoutResult) {
  // Project-specific: uses existing types, scoring logic, status transitions
  const scored = scoreBout(result);
  await db.insert(bouts).values({
    ...scored,
    status: BoutStatus.COMPLETED,
    settledAt: new Date(),
  });
}
```

Both versions compile. Both handle the data. The first is in the dumb zone.

**Example 2: Convention violation that type-checks**

The project uses 2-space indentation, `printf` instead of `echo`, and Drizzle ORM for
database access. The agent generates code with 4-space indentation, `console.log` for
debugging, and raw SQL queries. Every choice is defensible in isolation. None of them
reflect the project.

**Example 3: Security constraint invisible to the type system**

The project requires all database queries to go through a row-level security layer that
filters by tenant ID. The agent generates a query that works correctly in single-tenant
testing but bypasses the security layer. The type system does not encode the security
constraint. The test passes with a single tenant. In production, it leaks data across
tenants.

This is the sharpest form of the dumb zone: the output is correct in a generic context
and a security vulnerability in this specific context. The constraint was not in the
context window. The model could not condition on it.

### Detecting the Dumb Zone

The dumb zone is defined by what it takes to detect it:

| Detection Method | Catches Dumb Zone? | Why / Why Not |
|-----------------|-------------------|---------------|
| Compiler / type checker | No | Dumb zone output type-checks |
| Linter | Partially | Style rules catch some convention violations |
| Automated tests | Partially | Only if tests encode project-specific invariants |
| LLM self-review | No | Same model, same context gap, same blind spot |
| Human review (without context) | No | The output looks reasonable in isolation |
| **Human review (with context)** | **Yes** | "This is not what we do here" |
| **Cross-model review with project context** | **Partially** | Different model may catch different assumptions |

The last row is significant. Dumb zone detection is fundamentally a **taste-required**
verification (the concept from Step 6). The gate - typecheck, lint, test - catches
verifiable failures. The dumb zone produces output that passes the gate but fails the
taste test. This is why human review cannot be eliminated from the verification pipeline,
and why Step 7 (the human-AI interface) follows directly from this step.

> **AGENTIC GROUNDING:** When reviewing agent output, the question "does it compile?" is
> necessary but not sufficient. The question that catches dumb zone output is: "Would this
> code confuse someone who knows this project?" If the answer is yes - if the code uses
> wrong domain terms, violates unwritten conventions, or ignores constraints that are not
> in the type system - the agent was in the dumb zone. The fix is not a better review
> process. The fix is loading the working set so the agent never enters the dumb zone
> in the first place. Prevention is cheaper than detection by an order of magnitude.

---

## 7. Stale Reference Propagation

*Estimated time: 30 minutes*

**Stale reference propagation** is what happens when documentation or configuration
describes a state that no longer exists, and an agent consumes that documentation as
truth.

This is an observed anti-pattern from the project's slopodar (anti-pattern taxonomy). It
is the agentic form of configuration drift, but with a critical difference: in traditional
configuration drift, the old configuration is inert. In agentic contexts, stale
documentation is actively consumed by agents as instructions, and the agents will
hallucinate the described state into reality.

### The Mechanism

An agent boots from a configuration file (AGENTS.md, system prompt, or equivalent). The
file references:

- Functions that have been renamed
- File paths that have been reorganised
- API endpoints that have been deprecated
- Conventions that have been superseded
- Architectural decisions that have been reversed

The agent reads these references as current truth. It generates code that:

- Calls the old function names (which may still exist as dead code, passing type checks)
- Imports from old file paths (which cause build failures, or worse, import abandoned code)
- Uses deprecated API patterns (which work now but will break)
- Follows superseded conventions (which are inconsistent with recent code)

The agent is not hallucinating in the traditional sense. It is faithfully implementing
the instructions in its context. The instructions are wrong. The failure is in the
documentation, not the model.

### Stale References vs Hallucination

This distinction is operationally important:

| Property | Hallucination | Stale Reference Propagation |
|----------|--------------|---------------------------|
| Source | Model training data (L0) | Stale documentation in context (L3) |
| Cause | No relevant pattern in training data | Outdated pattern in provided context |
| Fix | Add correct information to context | Update the documentation |
| Detection | Check against reality | Check documentation against reality |
| Blame | Model limitation | Documentation maintenance failure |

When an agent generates a call to `processTransaction()` and the current function is
`settleCredits()`, the question is: did the agent invent a plausible name (hallucination),
or did the AGENTS.md file reference `processTransaction()` because that was the name three
PRs ago (stale reference)? The fix is different in each case.

### A Concrete Example

Consider a project with this evolution:

```
PR #47: Rename lib/payments/process.ts -> lib/credits/settle.ts
PR #47: Rename processTransaction() -> settleCredits()
PR #47: Update all call sites in lib/
PR #47: (Forgot to update AGENTS.md)
```

The AGENTS.md file still says:

```markdown
## Payment Flow
The payment processing pipeline uses `lib/payments/process.ts`.
The main entry point is `processTransaction(userId, amount)`.
```

A new agent session boots from this AGENTS.md. The agent is asked to add a new payment
feature. It generates:

```typescript
import { processTransaction } from '../payments/process';
// ...
await processTransaction(userId, amount);
```

If the old file was deleted, this is a build error. If the old file was left as dead code
(a common oversight), this compiles, the tests might pass, and the agent has just
resurrected dead code into an active code path. The type checker cannot distinguish between
"this import exists because it is actively used" and "this import exists because nobody
cleaned it up."

### The Compound Effect

Stale reference propagation compounds. Each agent that boots from stale documentation
reinforces the old state. If the agent writes code that references the old patterns, and
that code is committed, future agents now have two sources of the old pattern: the stale
documentation AND the newly committed code. The stale reference has propagated from
documentation into the codebase.

This is the inverse of the context quality loop (Section 8). Instead of clean context
producing cleaner code, stale context produces code that embeds the staleness, which
produces more stale context for the next agent.

### Controls

The control for stale reference propagation is not "review more carefully." It is a
process-level control:

**1. Every structural change must update every referencing document.**

When you rename a function, rename a file, or change an API, grep for the old name in
every document the agent reads. Not just code - documentation, configuration files,
system prompts, AGENTS.md.

```bash
# After renaming processTransaction -> settleCredits
rg "processTransaction" --type md --type yaml --type toml
# Fix every hit. This is not optional.
```

**2. Periodic staleness audits.**

Run a script that checks whether function names, file paths, and type names referenced
in documentation actually exist in the codebase.

```bash
#!/usr/bin/env bash
# Naive staleness check: extract function references from AGENTS.md
# and verify they exist in the codebase

references=$(rg -oP '`(\w+)\(\)`' AGENTS.md --only-matching | sort -u)
for ref in $references; do
  func_name=$(printf '%s' "$ref" | tr -d '`()')
  if ! rg -q "function $func_name\b|const $func_name\b|export.*$func_name\b" lib/; then
    printf 'STALE: %s referenced in AGENTS.md but not found in lib/\n' "$ref"
  fi
done
```

**3. Date-stamp mutable documentation.**

Add a "last verified" date to any document that agents consume. A document last verified
6 months ago is suspect. A document last verified after the most recent structural PR is
probably current.

> **SLOPODAR:** Stale reference propagation is catalogued in the project's anti-pattern
> taxonomy (slopodar.yaml) as `stale-reference-propagation`, severity high, confidence
> strong. The detection heuristic: "After structural change, grep config/agent files for
> old references." The pattern was first observed when a clean session reported "13-layer
> harness model" and "Lexicon at v0.17" - both stale at the time. The honest version of
> any agent configuration document is: "This is on file. Whether it gets read depends on
> context window and attention. Whether it is current depends on maintenance discipline.
> There is no guarantee."

> **AGENTIC GROUNDING:** If you maintain an AGENTS.md or similar configuration file, that
> file is consumed by agents as ground truth. Every inaccuracy in that file becomes an
> instruction to generate wrong code. The quality of your agent configuration documentation
> directly determines the quality of your agent output. This is not a documentation problem.
> It is a context engineering problem. Stale documentation is stale context. Stale context
> produces the dumb zone.

---

## 8. The Context Quality Loop

*Estimated time: 30 minutes*

The **context quality loop** is a feedback mechanism that compounds over time:

Clean code produces better context for future agents. Better context produces cleaner code.
The loop is self-reinforcing in both directions.

Conversely: slop produces worse context for future agents. Worse context produces more slop.

This is a novel concept. It names a feedback mechanism specific to codebases maintained
with AI assistance. The closest established parallels are kaizen (continuous improvement,
Toyota) and technical debt (compounding interest on shortcuts). The novel aspect is the
specific mechanism: codebase quality IS context engineering for future agents, because
agents consume the codebase as context.

### The Mechanism

When an agent reads a file in your codebase to understand how to write similar code, that
file becomes part of the agent's context. If the file is clean - well-named functions,
clear types, consistent patterns, accurate comments - the agent's output will reflect
those patterns. The file is good context.

If the file is sloppy - inconsistent naming, duplicated logic, stale comments, unclear
types - the agent's output will reflect those patterns too. The agent is not choosing to
write slop. It is generating the most probable continuation of the context it was given.
If the context is slop, the continuation is slop.

This compounds. Each commit of AI-generated code becomes context for the next AI-generated
commit. If quality degrades, each generation is slightly worse than the last. If quality
is maintained, each generation reinforces good patterns.

### Quantitative Evidence: GitClear

GitClear's analysis of approximately 153 million changed lines of code (January 2020 to
December 2023) provides quantitative evidence for the downward spiral:

- **Code churn** (lines reverted or updated within two weeks of authoring) is projected
  to double in 2024 compared to the pre-AI baseline of 2021
- The percentage of "added code" and "copy/pasted code" is increasing relative to
  "updated," "deleted," and "moved" code
- AI-assisted code resembles "an itinerant contributor, prone to violate the DRY-ness
  of the repos visited"

The pattern is consistent with the context quality loop: AI-generated code that violates
DRY principles becomes context for the next generation of AI-generated code. The next
generation sees duplicated patterns as the norm and duplicates further. Churn increases
because the duplicated code must be fixed repeatedly.

GitHub reports developers write code "55% faster" with Copilot. GitClear's data suggests
that the code written 55% faster has measurably different quality characteristics. Speed
and quality are not the same measurement. Optimising for one can degrade the other.

### Breaking the Downward Spiral

The context quality loop runs in both directions. Breaking the downward spiral and
establishing the upward spiral requires treating codebase hygiene as a context engineering
investment:

**1. Clean code is a context engineering decision.**

Every function you name clearly, every type you define precisely, every stale comment you
remove is not just good engineering practice. It is improving the context for every future
agent that reads that code. The return on clean code is higher in an AI-assisted codebase
because the code is read by agents far more frequently than by humans.

**2. AI-generated slop must be caught before it merges.**

The gate (typecheck + lint + test) catches some slop. Human review catches the rest -
specifically the "not wrong" category (output that passes every automated check but is
not right). This is why the gate is necessary but not sufficient, and why the human-in-
the-loop (Step 7) is irreducible.

**3. Refactoring is context engineering.**

When you refactor duplicated code into a shared utility, you are not just reducing
maintenance burden. You are ensuring that future agents see one canonical implementation
instead of N divergent copies. The agent will pattern-match to the canonical version,
producing consistent output across the codebase.

**4. Dead code is toxic context.**

Dead code - functions that are never called, imports that are never used, files that are
not part of any active code path - is not neutral. It is negative context. An agent that
reads a dead file does not know it is dead. It treats the patterns in that file as live
examples. Removing dead code is removing bad context.

### The Acceleration Question

The context quality loop creates an asymmetry in AI-assisted development:

- **Clean codebases get cleaner faster** with AI assistance (the agent has good patterns
  to follow, produces good code, which reinforces the patterns)
- **Sloppy codebases get sloppier faster** with AI assistance (the agent has bad patterns
  to follow, produces bad code, which reinforces those patterns)

AI does not uniformly improve or degrade code quality. It amplifies the existing direction.
This is why codebase hygiene matters more, not less, when AI writes code - the leverage
of clean patterns is higher, and the cost of sloppy patterns compounds faster.

> **AGENTIC GROUNDING:** If agents working on your codebase are producing increasingly
> generic or inconsistent output over time, and the prompts have not changed, check the
> codebase itself. Has AI-generated code that violates conventions been merged? Are there
> duplicated patterns that agents are copying? Is there dead code that agents are
> pattern-matching to? The context quality loop means that code review is not just about
> catching bugs in the current PR. It is about maintaining context quality for every future
> agent session. Every sloppy PR that merges degrades every future agent interaction with
> that code.

---

## 9. Practical Techniques

*Estimated time: 40 minutes*

The concepts from Sections 2-8 produce specific, implementable techniques. This section
collects them into a practitioner's toolkit.

### 9.1 BFS Depth Rules: What to Load When

Context loading follows a breadth-first search pattern. Not everything needs to be loaded.
Not everything needs to be loaded at the same time.

| Depth | When to Load | Examples | Token Budget |
|-------|-------------|----------|-------------|
| Depth 0 | Always (auto-injected) | System prompt, tool schemas | 1,000-3,000 |
| Depth 1 | Every session start | AGENTS.md, project conventions, active task file | 3,000-8,000 |
| Depth 2 | When the topic is relevant | Domain-specific modules, related type definitions | 5,000-30,000 |
| Depth 3+ | Deliberate research only | Historical decisions, archived documents, full dependency trees | Variable |

The rule: scan depth 1 first. Go to depth 2 only for the current task. Go to depth 3+
only when investigating a specific question. This is BFS applied to context loading.

```
Session start:
  Load AGENTS.md              (depth 1, ~2K tokens)
  Load current task file      (depth 1, ~500 tokens)
  Load active backlog         (depth 1, ~300 tokens)
  --- Stop here for orientation ---

Task begins:
  Load primary source files   (depth 2, variable)
  Load relevant types         (depth 2, variable)
  Load one exemplar if needed (depth 2, variable)
  --- Stop here for implementation ---

Investigation (only if stuck):
  Load historical decisions   (depth 3, variable)
  Load related domain modules (depth 3, variable)
  --- Use sparingly ---
```

The depth-1 consolidation in this project reduced L3 budget consumption by 76% (SD-195).
That number is project-specific, but the principle is general: most of the context budget
you burn on session start is depth-3 material loaded out of habit, not need.

### 9.2 Durable Writes as Policy

Compaction loss is defended by a single practice: write significant decisions to files
before they are needed for recovery.

What counts as "significant":

- Architectural decisions (approach A vs approach B)
- Convention decisions (naming, file structure, error handling patterns)
- Requirements interpretations (what the user meant by "X")
- Rejected alternatives (why approach A was rejected - this prevents re-deriving)
- Task state (what is done, what is remaining)

The format does not matter. A one-line entry in a session log is sufficient:

```bash
# Quick decision capture - 10 seconds
printf 'Decision: Use Drizzle ORM for new queries, not raw SQL. Reason: consistency with existing codebase.\n' \
  >> docs/decisions/session-$(date +%Y%m%d).md
```

The cost is trivial. The cost of not doing it is re-deriving the decision after
compaction, which takes the full discussion time again and risks reaching a different
conclusion.

### 9.3 Session Boundary Management

A session boundary is where one unit of work ends and another begins. Managing session
boundaries prevents hot context pressure from accumulating across unrelated tasks.

**Explicit task boundaries:**

When switching from one task to another, the ideal approach is a fresh context window.
The previous task's tool results, reasoning traces, and correction history are irrelevant
to the new task. They consume tokens and dilute attention.

If a fresh window is not practical (not all harnesses support it), at minimum:

1. Write the current task's state to a file
2. Summarise open decisions
3. Start the new task with an explicit context statement

```markdown
## Task Transition
Previous task: Fix auth validation (COMPLETE, committed as abc1234)
Current task: Add user profile endpoint
Working set for current task: lib/users/types.ts, lib/auth/routes.ts (as exemplar), AGENTS.md
```

**Session handoff (between agents or sessions):**

When a task transfers between agents or between sessions (human goes to sleep, comes
back the next day), the handoff document IS the context. Everything the next session
needs must be on disk:

```markdown
## Session State: 2026-03-10 23:45 UTC
### Completed
- Auth validation fix (commit abc1234)
- Schema migration for user profiles (commit def5678)

### In Progress
- User profile endpoint (lib/users/routes.ts, ~60% done)
- Blocked on: decision needed on profile image storage (S3 vs database BLOB)

### Decisions Made This Session
- Using Drizzle ORM for profile queries (consistency with existing codebase)
- Profile data schema follows lib/bouts/types.ts pattern

### Working Set for Next Session
- lib/users/routes.ts (in progress)
- lib/users/types.ts (defines ProfileData)
- lib/auth/routes.ts (exemplar for route patterns)
- AGENTS.md (conventions)
```

This is checkpoint recovery preparation. When the next session starts, it loads this file
and has the working set for the task without needing the full history of how the decisions
were made.

### 9.4 Context Budgeting

Context budgeting is the practice of estimating how much of the context window a task
will consume before starting, and planning for it.

**Budget estimation:**

```
Available budget:       200,000 tokens (model max)
System prompt:           -2,000
Tool schemas:            -1,500
Conversation overhead:   -5,000 (estimated turns * avg tokens per turn)
Output reservation:      -4,000 (max_tokens for response)
Safety margin:          -10,000 (buffer before compaction risk)
---
Available for context:  177,500 tokens

Working set:
  Primary file:           -3,000
  Type definitions:       -1,500
  Exemplar file:          -2,000
  Conventions doc:        -2,000
---
Remaining for tool results: 169,000 tokens
```

If the task involves heavy tool use (reading many files, running many commands), the
"remaining for tool results" budget determines how many tool calls the agent can make
before context pressure becomes a concern.

**Budget alarms:**

Most API responses include usage information. Track it:

```python
#!/usr/bin/env python3
"""Track context utilisation across a session."""

def check_context_budget(response, max_tokens=200_000, warning_threshold=0.7):
  """Check context utilisation and warn if approaching capacity."""
  used = response.usage.input_tokens + response.usage.output_tokens
  utilisation = used / max_tokens

  if utilisation > 0.9:
    print(f"CRITICAL: Context {utilisation:.0%} full ({used:,}/{max_tokens:,})")
    print("Action: Write state to file, start fresh window")
  elif utilisation > warning_threshold:
    print(f"WARNING: Context {utilisation:.0%} full ({used:,}/{max_tokens:,})")
    print("Action: Consider pruning history or starting fresh")
  else:
    print(f"Context: {utilisation:.0%} ({used:,}/{max_tokens:,})")

  return utilisation
```

### 9.5 Working Set Discovery

How do you find the working set for a task you have not done before?

**Start narrow, expand on demand.** Load the minimum: the file you are modifying, its
type imports, and the conventions document. Run the task. If the output is cold (generic,
ignores project specifics), add the most relevant missing file. Repeat until the output
is project-specific.

This is empirical working set discovery. It takes 2-3 iterations for a typical task and
is faster than guessing what might be relevant.

**Use the dependency graph.** If you know which file you are modifying, its imports tell
you the minimum type context. Follow the imports one level deep:

```bash
# Find what a file imports (TypeScript)
rg "^import .* from" lib/auth/login.ts

# Find what imports a file (reverse dependencies)
rg "from ['\"].*auth/login" lib/
```

The imports of the target file are almost always in the working set. The reverse
dependencies are usually not (unless the change affects the public interface).

**Use the test file.** If the file has a co-located test (`login.test.ts` beside
`login.ts`), the test file reveals the expected behaviour and test data. It is often
part of the working set for bug fixes.

> **AGENTIC GROUNDING:** Working set discovery is a skill that develops with practice on
> a specific codebase. In this project, the BFS depth map in AGENTS.md is the working set
> index - it tells agents where to find things without loading everything. For new projects,
> building this index is one of the highest-leverage activities you can do. A 20-line file
> listing the major modules, their purposes, and their key files saves every future agent
> session from starting cold.

---

## 10. Challenges

*Estimated time: 60-90 minutes total*

---

## Challenge: Identify the Working Set

**Estimated time: 10 minutes**

**Goal:** Given a task description, identify the minimum set of files that constitute the
working set.

Pick a real task in a codebase you work with (or use a public repository you are familiar
with). The task: "Add input validation to the login endpoint to reject malformed email
addresses."

1. List every file you think the agent needs in its context to produce correct, project-
   specific output.
2. For each file, write one sentence explaining why it is in the working set.
3. Now remove files one at a time, starting with the one you are least sure about. For
   each removal, ask: "Could the agent produce correct output without this?" If yes,
   it is not in the working set.

**Verification:** Your final list should have 3-6 files. If you have more than 8, you are
probably including convenience context rather than working set files. If you have fewer
than 2, you are underestimating what the agent needs.

**Extension:** Estimate the token count of your working set. Use a tokeniser or the
rough heuristic of 1 token per 4 characters. Does the working set fit comfortably within
10% of the model's context window?

---

## Challenge: Cold Pressure Demonstration

**Estimated time: 15 minutes**

**Goal:** Produce observable cold context pressure by comparing agent output with and
without the working set.

Use any coding agent (Claude, ChatGPT, Cursor, etc.) and a project you know well.

1. Choose a file that uses project-specific patterns (custom base classes, specific error
   handling, project-specific imports).
2. Ask the agent to generate a similar file, providing only the task description. No
   exemplar files, no type definitions, no conventions document. Record the output.
3. Now ask the same question, but this time include the exemplar file and its type
   definitions. Record the output.
4. Diff the two outputs.

**Verification:** The first output should be more generic (standard library patterns,
common framework defaults). The second should be more project-specific (matching the
exemplar's patterns, using the correct types). If both outputs are identical, either
your project's patterns are very close to common defaults, or you chose a file that does
not have distinctive project-specific patterns.

**What you are learning:** The prompt was identical in both cases. The context was
different. The output quality difference IS cold context pressure, made visible.

---

## Challenge: Hot Pressure Demonstration

**Estimated time: 15 minutes**

**Goal:** Produce observable hot context pressure by measuring the effect of irrelevant
context on output quality.

1. Write a focused task with 5 specific, enumerable requirements (like the email
   validation example in Section 4).
2. Send the task to the agent with no additional context. Count how many requirements
   the output addresses. Record the input token count from the API response.
3. Now prepend 20,000+ tokens of irrelevant but plausible context (documentation from
   a different module, a long README, unrelated code files). Send the same task.
   Count how many requirements the output addresses. Record the input token count.
4. Compare: requirements coverage, token counts, and response latency.

**Verification:** If hot pressure is present, you should see: (a) higher input token
count (obvious), (b) same or lower requirement coverage, (c) potentially longer response
time. The signal may be subtle - hot pressure degrades quality gradually, not
catastrophically.

<details>
<summary>Hints</summary>

If you do not observe a difference, try increasing the noise context. The effect becomes
more pronounced as the ratio of noise to signal increases. Also try a more complex task -
simple tasks (like "add 2 + 2") are robust to noise because the correct answer has very
high probability regardless of context.

</details>

**Extension:** Find the crossover point. How much irrelevant context must you add before
requirement coverage drops? This gives you a rough measure of the model's noise tolerance
for your specific task type.

---

## Challenge: Compaction Simulation

**Estimated time: 20 minutes**

**Goal:** Simulate compaction loss and observe the consequences of decisions that exist
only in context.

1. Start a fresh conversation with any LLM.
2. Establish three specific decisions through conversation:
   - "We will use approach B for the database schema" (not A)
   - "Error messages must include the request ID for traceability"
   - "All timestamps must be UTC, stored as ISO 8601 strings"
3. Have the model generate some code that reflects these decisions. Verify it incorporates
   all three.
4. Now simulate compaction: start a new conversation (fresh context). Give the model the
   same task description, but do NOT mention the three decisions.
5. Compare the output. Which decisions survived? Which were lost?

**Verification:** The new conversation should produce different output - likely using a
different schema approach, omitting request IDs from error messages, and potentially using
a different timestamp format. The decisions existed only in the first conversation's
context. After "compaction" (the new conversation), they are gone.

**What you are learning:** This is compaction loss in controlled conditions. In production,
this happens mid-session when the context window fills. The defence is durable writes:
writing the three decisions to a file that can be loaded into the new context.

**Extension:** Repeat step 4, but this time include a "decision log" in the new
conversation that records the three decisions. Observe that the output now matches.
This is checkpoint recovery.

---

## Challenge: Dumb Zone Detection

**Estimated time: 20 minutes**

**Goal:** Detect dumb zone output - code that compiles but is semantically disconnected
from the project.

1. Take a real agent-generated file from your project (or generate one using minimal
   context).
2. Check it against the following dumb zone indicators:

| Indicator | Check | Score |
|-----------|-------|-------|
| Domain terms | Does it use the project's domain vocabulary? | 0-2 |
| Import paths | Do imports match the project's module structure? | 0-2 |
| Error handling | Does error handling match the project's pattern? | 0-2 |
| Naming conventions | Do names match the project's style? | 0-2 |
| Type usage | Does it use the project's types, or define its own? | 0-2 |

3. Score each indicator: 0 = wrong/generic, 1 = partially correct, 2 = project-specific.

**Verification:** A score of 8-10 indicates the agent had adequate context. A score of
0-4 indicates the agent was in the dumb zone. A score of 5-7 is the ambiguous zone - the
agent had some context but not the full working set.

**What you are learning:** Dumb zone detection is a skill. The more familiar you are with
the project, the faster you spot it. A reviewer without project context would score the
same code higher, because it "looks right" in isolation. The gap between those two scores
is the dumb zone.

---

## Challenge: Stale Reference Audit

**Estimated time: 15 minutes**

**Goal:** Audit a configuration file for stale references.

1. Take your project's AGENTS.md, README.md, or equivalent documentation file.
2. Extract every function name, file path, and module name referenced in the document.
3. For each reference, verify it exists in the current codebase:

```bash
# Extract backtick-quoted references
rg '`[^`]+`' YOUR_CONFIG_FILE.md -o | sort -u > /tmp/refs.txt

# For each reference that looks like a file path, check it exists
while IFS= read -r ref; do
  path=$(printf '%s' "$ref" | tr -d '`')
  if [[ "$path" == */* ]] && [[ "$path" == *.* ]]; then
    if [ ! -f "$path" ]; then
      printf 'STALE PATH: %s\n' "$path"
    fi
  fi
done < /tmp/refs.txt
```

4. Count the stale references. Calculate the staleness ratio (stale / total).

**Verification:** Most projects that have been through any refactoring will have at least
one stale reference. A staleness ratio above 10% indicates the documentation is actively
harmful as agent context - it is more likely to mislead than to help.

**Extension:** Fix every stale reference you find and commit the fix. This is not
documentation work. It is context engineering work.

> **AGENTIC GROUNDING:** This audit is a context quality investment. Every stale reference
> you fix prevents future agents from generating code against the old state. The ROI is
> high: one fix prevents N future failures, where N is the number of agent sessions that
> would have consumed the stale reference.

---

## Challenge: Context Budget Estimation

**Estimated time: 15 minutes**

**Goal:** Build a context budget for a real task.

1. Choose a task you plan to do with an AI agent.
2. Fill in this budget template:

```
Model context window:     ________ tokens
System prompt:           -________ tokens
Tool schemas:            -________ tokens
Conversation overhead:   -________ tokens (est. turns * avg tokens)
Output reservation:      -________ tokens (max_tokens)
Safety margin (10%):     -________ tokens
                          --------
Available for context:    ________ tokens

Working set:
  File 1 (________):     -________ tokens
  File 2 (________):     -________ tokens
  File 3 (________):     -________ tokens
  Conventions doc:       -________ tokens
                          --------
Remaining for tools:      ________ tokens

Tool calls before pressure: ~________ (remaining / avg tool result size)
```

3. Estimate "tool calls before pressure" by dividing the remaining budget by the average
   size of a tool result in your workflow (a file read is typically 500-3,000 tokens; a
   test run output is 200-1,000 tokens; a git diff is 500-10,000 tokens).

**Verification:** If "tool calls before pressure" is less than 10, the task may need a
context management strategy (summarise tool results, prune history, use multiple passes
with fresh windows).

**What you are learning:** Context budgeting makes the invisible visible. Most
practitioners do not know how much of their context window is consumed by overhead. This
exercise calibrates your intuition for when context pressure will become a problem.

---

## 11. Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What is the difference between prompt engineering and context engineering? (Hint: one
   is about what you say, the other is about what information is available.)

2. What is the working set, and how does it relate to Denning's 1968 virtual memory
   research? (Hint: the mapping is structural, not metaphorical.)

3. What happens when an agent operates under cold context pressure? What does the output
   look like? (Hint: generic, training-data-default, not project-specific.)

4. What happens under hot context pressure? How is it different from cold pressure?
   (Hint: the output is project-aware but inconsistent, not generic.)

5. What is compaction loss, and why is it binary rather than gradual? (Hint: context
   window replacement is all-or-nothing.)

6. What is the dumb zone? Why is it more dangerous than outright failure? (Hint: it
   passes every automated check.)

7. How does stale reference propagation differ from hallucination? (Hint: one originates
   in L0, the other in L3.)

8. Explain the context quality loop in one sentence. (Hint: codebase quality IS context
   engineering for future agents.)

9. What is the BFS depth rule, and how does it prevent hot context pressure? (Hint: not
   everything needs to be loaded at session start.)

10. Why does a durable write (decision to file) cost 30 seconds but save potentially
    hours? (Hint: compaction loss is total.)

---

## 12. Recommended Reading

- **"The Working Set Model for Program Behavior"** - Peter J. Denning (1968).
  *Communications of the ACM*, 11(5), 323-333. The foundational paper for the working
  set concept. Available at: http://denninginstitute.com/pjd/PUBS/WSModel_1968.pdf.
  Read Section 2 (the formal definition) and Section 4 (the thrashing analysis). The
  structural isomorphism to LLM context windows is presented in this step.

- **"Working Set Analytics"** - Peter J. Denning (2021). *ACM Computing Surveys*. A
  retrospective confirming the model's continued relevance 53 years later.

- **"Coding on Copilot: 2023 Data Suggests Downward Pressure on Code Quality"** -
  GitClear (2024). Available at: https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality.
  The quantitative evidence for the context quality loop's downward spiral. 153 million
  lines analysed. Focus on the churn rate projections and the DRY violation findings.

- **"Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding
  Agents?"** - Gloaguen et al. (2026). arXiv:2602.11988. The empirical validation
  that more context can make agents worse. Read the key finding: context files "tend
  to reduce task success rates compared to providing no repository context, while also
  increasing inference cost by over 20%." This is hot context pressure quantified.

- **Anthropic documentation on prompt caching and context windows** - The practical
  API-level tools for context management. Covers cache_control, token counting, and
  context window limits.

---

## 13. What to Read Next

**Step 5: Tool Design and Agent-Computer Interfaces** - Every tool result an agent
receives is injected into the context window. A file read that returns 5,000 tokens
consumes the same budget as 5,000 tokens of conversation history. Step 5 covers how to
design tools that return the right amount of information - not raw dumps that cause hot
context pressure, and not empty responses that leave the agent under cold pressure. The
ACI (Agent-Computer Interface) design principles from Anthropic's "Building effective
agents" directly address context efficiency: tools should return structured, minimal,
actionable results. Tool design is context engineering applied to the information channel
between the agent and its environment.

Step 5 also covers the poka-yoke principle for tool design - error-proofing the interface
so the model cannot misuse it. This connects directly to Section 6 (the dumb zone): a
well-designed tool keeps the agent out of the dumb zone by providing exactly the context
it needs.

