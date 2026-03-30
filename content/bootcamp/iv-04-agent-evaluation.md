+++
title = "Evaluating Agents and Workflows"
date = "2026-03-10"
description = "Task-based evaluation, trajectory analysis, Inspect AI, sandboxed execution, tool use accuracy."
tags = ["evals", "agents", "inspect-ai", "bootcamp"]
step = 4
tier = 2
estimate = "5-6 hours"
bootcamp = 4
+++

Step 4 of 9 in Bootcamp IV: Evaluation & Adversarial Testing.

---

## Why This Step Exists

Steps 1 through 3 taught you to evaluate single input-output pairs. You learned what
evaluations actually measure (Step 1), how to build datasets that test what you claim
(Step 2), and how to score model output reliably (Step 3). All of that work assumed a
clean model: one prompt goes in, one response comes out, a scorer judges the response.
That assumption no longer holds.

Agents produce trajectories, not single responses. An agent given the task "resolve this
GitHub issue" may read the issue, search the codebase, open files, propose a fix, run
tests, observe failures, revise the fix, run tests again, and submit the patch. That is
not one input-output pair. That is a sequence of decisions, each depending on the
results of prior decisions, each consuming tokens, each introducing opportunities for
error. Evaluating the final patch tells you whether the agent succeeded. It does not
tell you whether the agent's process was efficient, whether it used the right tools,
whether it recovered from mistakes gracefully, or whether it would succeed on a
different issue.

This is Step 4 because agent evaluation builds on everything before it. You still need
construct validity (Step 1) - but now the construct is "agent capability" not "model
capability." You still need good datasets (Step 2) - but now each dataset entry defines
an environment, not just an input. You still need reliable scoring (Step 3) - but now
the scorer may need to evaluate a trajectory, not just a final answer. The foundations
remain. The complexity increases.

The field is split on how to handle this complexity. Task-based benchmarks like SWE-bench
evaluate only the endpoint: did the patch resolve the issue? Trajectory-based approaches
like OpenAI's trace grading evaluate the path: were intermediate steps reasonable? Both
are legitimate. Both have blind spots. This step covers both, explains when each is
appropriate, and shows how to implement agent evals using Inspect AI.

---

## Table of Contents

1. [From Pairs to Trajectories](#1-from-pairs-to-trajectories) (~25 min)
2. [Why Agent Evaluation is Harder](#2-why-agent-evaluation-is-harder) (~30 min)
3. [Task-Based Evaluation](#3-task-based-evaluation) (~40 min)
4. [Trajectory Evaluation](#4-trajectory-evaluation) (~35 min)
5. [The Inspect AI Agent Evaluation Model](#5-the-inspect-ai-agent-evaluation-model) (~45 min)
6. [Sandboxing for Agent Evals](#6-sandboxing-for-agent-evals) (~30 min)
7. [Workflow Evaluation](#7-workflow-evaluation) (~30 min)
8. [Cost and Latency as Eval Dimensions](#8-cost-and-latency-as-eval-dimensions) (~25 min)
9. [Evaluating Tool Use](#9-evaluating-tool-use) (~25 min)
10. [Challenges](#10-challenges) (~60-90 min)
11. [Key Takeaways](#11-key-takeaways)
12. [Recommended Reading](#12-recommended-reading)
13. [What to Read Next](#13-what-to-read-next)

---

## 1. From Pairs to Trajectories

*Estimated time: 25 minutes*

Every eval you have built so far follows the same structure: sample in, response out,
score the response. The dataset has an `input` field and a `target` field. The scorer
compares the model's output against the target. The result is a score per sample, and an
aggregate metric across samples. This is the paradigm for evaluating LLMs as functions:
given this input, how good is this output?

Agents are not functions. They are programs that make sequential decisions in an
environment. When you give an agent the instruction "find the configuration file that
sets the database connection timeout and change it to 30 seconds," the agent does not
produce a single output. It produces a trace:

```
1. grep for "timeout" across the repository
2. Read the 4 files returned by grep
3. Identify config/database.yaml as the relevant file
4. Read the current timeout value (15 seconds)
5. Edit the file to change 15 to 30
6. Run the test suite to verify the change
7. Report completion
```

That trace is the agent's trajectory through the state space. Each step has inputs
(the current state, the tool results from previous steps), a decision (which tool to
call, with what parameters), and an output (the tool result). The final result - a
correctly modified configuration file - is one data point. The trajectory is seven.

### Why Trajectories Matter

Consider two agents that both complete the same task successfully:

**Agent A:**

```
1. grep for "timeout" across the repository
2. Read config/database.yaml
3. Edit the timeout value from 15 to 30
4. Run tests - all pass
```

**Agent B:**

```
1. grep for "database" across the repository
2. Read 12 files returned by grep
3. grep for "timeout" across the repository
4. Read 6 files returned by grep
5. Read config/database.yaml
6. Read config/database.yaml again (redundant)
7. Attempt to edit with wrong file path - error
8. Edit config/database.yaml correctly
9. Run tests - 2 failures (unrelated)
10. Run tests again - 2 failures (same, pre-existing)
11. Investigate the 2 test failures (irrelevant to task)
12. Conclude the task is complete despite pre-existing test failures
```

Both agents resolve the task. A pure task-completion eval scores them identically. But
Agent A completed the task in 4 steps, Agent B in 12. Agent A used the right tools
efficiently, Agent B made redundant calls and got distracted by unrelated test failures.
Agent A's trajectory demonstrates competence. Agent B's trajectory demonstrates that it
got lucky.

If you are deciding which agent to deploy in production, the trajectory difference is
the difference that matters. Agent B will consume three times the tokens, take three
times as long, and hit rate limits three times as fast. On a harder task where the
margin for error is thinner, Agent B's inefficiency may cross the line from "wasteful
but successful" to "too many steps and ran out of context window."

> **AGENTIC GROUNDING:** The distinction between "successful but wasteful" and
> "successful and efficient" is the trajectory evaluation problem in miniature. When you
> steer agents in production, you watch for this distinction continuously - an agent that
> stumbles to the right answer today may stumble past it tomorrow. Evaluating
> trajectories, not just outcomes, is how you detect this before deployment.

### The Shape of Agent Evaluation

Agent evaluation has three layers, and each step you have learned so far maps to one:

| Layer | What it evaluates | Prior steps |
|-------|-------------------|-------------|
| **Task completion** | Did the agent succeed at the overall goal? | Step 3 (scoring) |
| **Trajectory quality** | Was the path to success efficient and reasonable? | Step 1 (what we measure) |
| **Tool use accuracy** | Were individual tool calls correct and well-formed? | Step 2 (sample design) |

You can evaluate any layer in isolation. Most benchmarks evaluate only the first.
Production-grade agent evaluation requires all three. This step builds them from the
ground up.

---

## 2. Why Agent Evaluation is Harder

*Estimated time: 30 minutes*

Agent evaluation inherits every difficulty from single-response evaluation - construct
validity, prompt sensitivity, scorer reliability - and adds four more. These are not
minor complications. Each one changes the design of your eval in fundamental ways.

### 2.1 Non-Deterministic Trajectories

A function called with the same input produces the same output (assuming
temperature=0 and identical state). An agent called with the same task description
may take a completely different path. The model's tool-calling decisions depend on
sampling from the output distribution, and small changes in probability mass can
shift which tool gets selected at each step.

Run the same agent on the same task ten times and you may get ten different
trajectories. Some will succeed, some will fail. The ones that succeed will take
different paths. This means:

- **Single runs are unreliable.** A task that succeeds on one run and fails on the
  next tells you the agent's success rate is somewhere between 0% and 100%. You need
  multiple runs per sample to estimate reliability. Inspect AI supports this directly
  via the `epochs` parameter on tasks.

- **Aggregation requires care.** Mean accuracy across a single run overstates
  confidence. With 100 samples and 1 run each, a score of 72% could be 72% reliable
  success or 100% success with 28% random failure. Multiple epochs per sample with
  pass@k metrics (the probability of at least one success in k attempts) give a more
  honest picture.

- **Trajectory comparison is hard.** Two successful trajectories may have nothing in
  common structurally. You cannot diff them the way you diff outputs. Trajectory
  evaluation requires either human judgment or trajectory-level metrics (step count,
  tool call patterns, error recovery events).

> **FIELD MATURITY: EMERGING** - The pass@k metric for agent evaluation is borrowed from
> code generation (Chen et al., 2021, "Evaluating Large Language Models Trained on
> Code"). Its application to agentic tasks with multi-step trajectories is standard
> practice in benchmarks like SWE-bench but not formally studied for trajectory-level
> properties.

### 2.2 Environment Interaction

A prompt eval is self-contained. The model receives a prompt, produces a response, and
the response is scored against a target. The model does not change the world.

An agent eval changes the world. When an agent calls `bash("rm -rf /tmp/workdir")`, the
file system changes. When it calls `python("import requests; requests.post(url, data)")`,
a network request fires. When it calls `text_editor("write", path, content)`, a file is
created. Each action modifies the environment, and subsequent actions see the modified
environment.

This means:

- **Eval environments must be isolated.** If agent A's test run modifies a file that
  agent B's test run reads, the results are coupled. Each sample needs its own
  environment. This is why sandboxing (Section 6) is non-negotiable, not optional.

- **Initial state must be reproducible.** If the eval starts with "a repository containing
  this file structure" then every run must start with exactly that state. Docker images
  and compose files provide this.

- **Side effects are part of the evaluation.** The scorer may need to inspect the state of
  the environment after the agent finishes, not just the agent's final text output. Did the
  file actually change? Did the test suite actually pass? These are environment checks, not
  text checks.

### 2.3 Multi-Step Dependencies

In a single-response eval, the output depends on the input and the model. In an agent
eval, step N's output depends on steps 1 through N-1. An error in step 3 propagates
through steps 4, 5, and 6. A tool failure in step 7 can either be recovered from
(good) or can cascade into a sequence of increasingly confused tool calls (bad).

This creates an evaluation challenge: when an agent fails at step 10, where did the
failure actually originate? The proximate failure (wrong tool call at step 10) may have
been caused by a distal error (misinterpreting tool output at step 4). Task-completion
scoring catches the failure. Trajectory scoring can locate it. Neither is easy.

### 2.4 Partial Observability

When a model produces a response, you can see the response. When an agent produces a
trajectory, you can see the tool calls and tool results. What you usually cannot see
is the model's reasoning between tool calls - why it chose this tool over that one,
why it interpreted the result this way rather than another.

Some providers expose reasoning tokens (chain-of-thought traces). Others do not.
Even when available, reasoning tokens show what the model reported thinking, not
necessarily what drove the generation. This partial observability means that
trajectory evaluation is always working with incomplete information.

> **AGENTIC GROUNDING:** Partial observability is not unique to agent evaluation. In this
> project's operational model, L4 (autoregressive generation) describes how the model
> generates tokens without revision or lookahead - what you see is the output, not the
> process. L12 (the human layer) uses reasoning tokens as a diagnostic instrument, not as
> ground truth. Agent evaluation faces the same constraint: you evaluate the observable
> trace, not the hidden reasoning.

### 2.5 The Combined Effect

These four difficulties compound. A non-deterministic agent (2.1) interacting with a
mutable environment (2.2) through multi-step chains (2.3) with partial visibility into
its reasoning (2.4) creates an evaluation space that is qualitatively different from
"give it a prompt, score the response."

The practical consequence: agent evaluation is more expensive, less reliable, and harder
to interpret than single-response evaluation. An agent eval that provides the same
confidence level as a 200-sample prompt eval may require 200 samples times 5 epochs
times 2x compute cost per sample (for sandboxing and tool execution). That is 2,000
eval runs instead of 200. Cost matters (Section 8).

This is not a reason to avoid agent evaluation. It is a reason to design agent evals
with the same rigor you learned in Steps 1-3, with additional controls for the
difficulties specific to agents.

---

## 3. Task-Based Evaluation

*Estimated time: 40 minutes*

Task-based evaluation is the dominant paradigm for agent benchmarks. The structure is
simple: define a task, provide an environment, run the agent, measure whether the task
was completed. The evaluation is binary (success/failure) or graded (partial credit),
scored against concrete success criteria.

The appeal is clear. Task-based evaluation tests what matters for deployment: can the
agent do the job? The implementation is tractable: define the task in a dataset, build
the environment as a sandbox, run the agent, check the result.

The limitation is equally clear. Task-based evaluation is endpoint scoring. It tells you
whether the agent completed the task. It does not tell you how it completed the task,
whether its process was efficient, or whether it would complete a slightly different
task. These are the concerns that trajectory evaluation (Section 4) and tool use
evaluation (Section 9) address.

### 3.1 SWE-bench

SWE-bench (Jimenez et al., 2023) is the most influential agent benchmark for software
engineering. The task: given a real GitHub issue from a real open-source Python
repository, produce a patch that resolves the issue. The scoring: does the repository's
test suite pass after the patch is applied?

The key design decisions:

- **Real issues, not synthetic ones.** Each task is a genuine GitHub issue from a
  popular Python project (Django, Flask, scikit-learn, sympy, and others). This avoids
  the ecological validity problem (Step 1) of synthetic benchmarks - the tasks are
  things real developers actually needed to fix.

- **Test-based scoring.** Success is defined by whether the project's existing tests
  pass after the patch. This is a verifiable criterion - no human judgment required,
  no LLM-as-judge ambiguity. The scorer is the project's test suite.

- **Multiple subsets for different purposes.** The full benchmark has 2,294 instances.
  SWE-bench Verified (500 instances, human-filtered and co-created with OpenAI) is
  the standard subset for leaderboard comparison. SWE-bench Lite (300 instances) is a
  cheaper evaluation. SWE-bench Multilingual (300 instances, 9 languages) and
  SWE-bench Multimodal (517 instances) extend coverage.

The results show rapid progress. GPT-4 scored approximately 2% when SWE-bench launched
in late 2023. As of 2025-2026, top agents exceed 60% on SWE-bench Verified. Mini-SWE-
agent v2 scores 65% in roughly 100 lines of Python. The field has moved fast.

**What SWE-bench gets right:**

- **Ecological validity.** Real issues from real codebases. The tasks were not designed
  for the benchmark - they are authentic development work.

- **Verifiable scoring.** The test suite is an automated, reproducible scorer. No human
  in the loop, no prompt-sensitivity in the scoring step.

- **Difficulty gradient.** The full benchmark contains tasks ranging from trivial
  one-line fixes to complex multi-file refactors. This gives discriminative power
  across capability levels.

**What SWE-bench gets wrong (or does not address):**

- **Trajectory blindness.** SWE-bench evaluates the patch, not the process. An agent
  that reads the issue, identifies the root cause immediately, and produces a clean
  fix scores the same as an agent that flails for 50 tool calls before stumbling on a
  patch. For cost-sensitive deployment, this distinction matters.

- **The "right answer wrong work" risk.** A patch can pass the test suite for the
  wrong reason. If the test checks that the status code is 400 but does not check why
  it is 400, a patch can fix the wrong thing and still pass. SWE-bench inherits the
  quality of each project's test suite - some are thorough, some are not.

- **No cost dimension.** The SWE-bench leaderboard now includes cost scatter plots,
  but cost is presented as context rather than as a first-class evaluation dimension.
  An agent scoring 60% at $2 per resolution is categorically different from one
  scoring 60% at $50 per resolution.

- **Python-only** (with the exception of Multilingual). The original benchmark covers
  a specific ecosystem. Agent capabilities may differ across languages and frameworks.

> **SLOPODAR:** "Right answer wrong work" applies directly to SWE-bench. A test that
> asserts the correct status code via the wrong causal path is a phantom green light.
> The benchmark inherits this limitation from the underlying test suites it uses as
> scorers - it cannot be more reliable than the tests it relies on.

### 3.2 WebArena

WebArena (Zhou et al., 2023) evaluates agents on web navigation tasks. The task:
accomplish a goal using a web browser in a realistic web environment. The scoring:
functional correctness of the task completion, evaluated by programmatic checks on the
browser state.

The environment consists of four self-hosted web applications:

- An e-commerce site (modeled on a real store)
- A social forum (Reddit-like)
- A collaborative software development platform (GitLab-like)
- A content management system (Wikipedia-like)

The agent navigates by performing browser actions: click, type, select, scroll, and
navigate. This is interactive tool use in a visual or DOM-based environment, not code
generation.

Human performance on WebArena is 78.24%. The best GPT-4-based agent at the time of
publication scored 14.41%. The gap has narrowed but remains substantial.

**What WebArena adds beyond SWE-bench:**

- **Interactive environment.** The agent must navigate, not just generate. Each action
  changes the visible page, and the next action depends on what the page shows after
  the previous action. This tests planning and multi-step reasoning in a way that code
  generation benchmarks do not.

- **Cross-application tasks.** Some tasks require navigating between multiple
  applications (look up order information in the store, then post about it on the
  forum). This tests the agent's ability to coordinate across contexts.

**What WebArena does not address:**

- **Trajectory quality.** Like SWE-bench, WebArena evaluates task completion, not the
  quality of the navigation path. An agent that clicks 50 links to find the right page
  scores the same as one that navigates directly.

- **Environment drift.** Web UIs evolve. A benchmark built on a specific version of a
  web application may not reflect how real web applications behave a year later.

- **Setup complexity.** Self-hosting four web applications is non-trivial. The barrier
  to entry for running WebArena evaluations is significantly higher than for running
  SWE-bench.

### 3.3 OSWorld

OSWorld (Xie et al., 2024) extends the evaluation environment from browser-only to full
operating system interaction. The task: complete a task using a real desktop environment
(Ubuntu, Windows, or macOS). The scoring: custom execution-based evaluation scripts that
check the state of the OS after the agent finishes.

OSWorld includes 369 tasks involving:

- Web applications (inheriting the WebArena scope)
- Desktop applications (text editors, spreadsheets, file managers)
- OS-level operations (file management, system configuration)
- Cross-application workflows (export data from one app, import into another)

Human performance is 72.36%. The best model at publication scored 12.24%. The primary
failure modes are GUI grounding (identifying the correct UI element to interact with)
and operational knowledge (knowing how a specific application works).

**The progression:**

| Benchmark | Environment | Interaction | Scoring |
|-----------|-------------|-------------|---------|
| SWE-bench | Code repository | Code generation (patches) | Test suite pass/fail |
| WebArena | Web browsers | Browser actions (click, type) | Programmatic state checks |
| OSWorld | Full desktop OS | Mouse, keyboard, screenshots | Custom evaluation scripts |

Each step adds environmental complexity. Each step also adds evaluation infrastructure
complexity - you need more elaborate sandboxing, more sophisticated state checking,
and more compute per eval run.

> **FIELD MATURITY: EMERGING** - Task-based agent benchmarks are the most mature area of
> agent evaluation. SWE-bench has broad adoption and active development (SWE-smith for
> training data, CodeClash for goal-oriented tasks). WebArena and OSWorld are established
> but less widely used. The pattern (define task, provide environment, check result) is
> proven. What remains emerging is the integration of trajectory quality, cost, and tool
> use metrics alongside task completion.

### 3.4 What Task-Based Benchmarks Teach About Eval Design

The design patterns shared by SWE-bench, WebArena, and OSWorld are reusable for your
own agent evals:

1. **Environment as part of the dataset.** Each sample is not just an input prompt -
   it includes the initial environment state (repository checkout, website state, OS
   image). In Inspect AI, this maps to the `sandbox` parameter and per-sample `files`
   and `setup` scripts.

2. **Programmatic scoring over the environment.** The scorer checks the environment
   state, not (only) the agent's text output. Did the file change? Did the test pass?
   Did the page reach the expected state? This is more reliable than scoring text
   and catches cases where the agent claims success without achieving it.

3. **Binary scoring with partial credit as an option.** Most task-based benchmarks
   start with pass/fail (the task was completed or it was not). Partial credit (the
   agent completed 3 of 5 sub-goals) adds information but requires defining the
   sub-goals. Start with binary scoring; add granularity when you need it.

4. **Multiple subsets for different evaluation goals.** SWE-bench Verified for
   rigorous comparison, Lite for quick iteration, Full for comprehensive assessment.
   Design your agent eval datasets with this in mind.

---

## 4. Trajectory Evaluation

*Estimated time: 35 minutes*

Task-based evaluation answers "did the agent succeed?" Trajectory evaluation answers
"how did the agent succeed (or fail)?" It examines the sequence of decisions the agent
made, the quality of intermediate steps, and the efficiency of the overall path.

Trajectory evaluation matters because two agents with identical task-completion rates
can have wildly different operational profiles. One may be reliable and efficient. The
other may be unreliable and wasteful, succeeding only because the task set was
forgiving. In production, the difference shows up in cost, latency, error rates, and
the frequency with which human intervention is needed.

### 4.1 What to Measure in a Trajectory

A trajectory is a sequence of (action, observation) pairs. At each step, the agent
selects an action (typically a tool call) and observes the result. The trajectory has
several measurable properties:

**Step count.** The number of steps from start to completion. Lower is generally
better, but not always - a careful agent that verifies its work in an extra step may be
preferable to a fast agent that skips verification.

**Error count and recovery.** How many tool calls returned errors? When an error
occurred, did the agent recover (retry with corrected parameters, switch to a different
approach) or cascade (make increasingly confused calls until hitting a limit)?

**Redundancy.** Did the agent read the same file twice? Did it search for the same
string with slightly different parameters? Redundant calls waste tokens and time.

**Tool selection accuracy.** At each step, was the tool the agent selected appropriate
for the sub-task? An agent that uses `grep` to search for a function definition when
`glob` would find the file by name faster is making a sub-optimal but not incorrect
choice. An agent that uses `bash("cat file")` to read a file when a `read_file` tool
is available is using the wrong tool.

**Reasoning coherence.** When reasoning tokens are available, does the stated reasoning
match the subsequent action? An agent that says "I should read the configuration file"
and then calls `grep` on an unrelated directory is exhibiting incoherent reasoning.

### 4.2 OpenAI Trace Grading

OpenAI's trace grading system provides the most explicit published approach to
trajectory evaluation. A trace is "the end-to-end log of decisions, tool calls, and
reasoning steps." Trace grading assigns structured scores or labels to this log to
assess correctness, quality, or adherence to expectations.

The key insight in OpenAI's approach: trace grading treats the trajectory as a
first-class evaluation artifact, not a debug log. Instead of examining traces only
when something goes wrong, you systematically grade traces as part of your evaluation
pipeline.

OpenAI's trace grading supports:

- **Graders** that run against the full trace (not just the final output). A grader can
  check whether the agent followed required steps, avoided prohibited actions, or
  maintained a coherent strategy throughout the trace.

- **Batch evaluation** - "Grade all" functionality that applies graders across a set of
  traces, producing aggregate metrics.

- **Dashboard integration** - traces live in the OpenAI platform under Logs, with
  grading results visible alongside the traces.

The limitation: OpenAI's trace grading is tied to their platform. It requires use of
the OpenAI Agent Builder or Responses API. It is not model-agnostic. For evaluating
agents that use other providers, you need a different approach - or you need to build
the equivalent functionality yourself.

> **FIELD MATURITY: FRONTIER** - Trace-level grading as a systematic practice (not just
> ad-hoc debugging) is at the frontier. OpenAI has published documentation, but the
> methodology is thin - there is no published study of how trace grading correlates with
> downstream agent reliability. The concept is sound. The empirical validation does not
> yet exist.

### 4.3 Trajectory Metrics

Here are concrete metrics you can compute from an agent trajectory, independent of any
specific platform:

```python
# Trajectory metrics - computable from any logged agent trace

def trajectory_metrics(trace: list[dict]) -> dict:
  """Compute metrics from an agent execution trace.

  Each trace entry has:
    - step: int
    - tool: str (tool name)
    - params: dict (tool parameters)
    - result: str (tool output)
    - success: bool (tool call succeeded)
    - tokens_in: int (prompt tokens for this step)
    - tokens_out: int (completion tokens for this step)
  """
  total_steps = len(trace)
  error_steps = sum(1 for s in trace if not s["success"])
  unique_tools = len(set(s["tool"] for s in trace))
  total_tokens = sum(s["tokens_in"] + s["tokens_out"] for s in trace)

  # Redundancy: same tool + same params called more than once
  call_signatures = [
    (s["tool"], tuple(sorted(s["params"].items())))
    for s in trace
  ]
  unique_calls = len(set(call_signatures))
  redundant_calls = total_steps - unique_calls

  # Error recovery: after an error, did the next step succeed?
  recoveries = 0
  cascades = 0
  for i in range(len(trace) - 1):
    if not trace[i]["success"]:
      if trace[i + 1]["success"]:
        recoveries += 1
      else:
        cascades += 1

  return {
    "total_steps": total_steps,
    "error_count": error_steps,
    "error_rate": error_steps / total_steps if total_steps else 0,
    "unique_tools_used": unique_tools,
    "redundant_calls": redundant_calls,
    "redundancy_rate": redundant_calls / total_steps if total_steps else 0,
    "recovery_rate": (
      recoveries / (recoveries + cascades)
      if (recoveries + cascades) > 0
      else None
    ),
    "total_tokens": total_tokens,
    "tokens_per_step": total_tokens / total_steps if total_steps else 0,
  }
```

These metrics are not sufficient on their own. An agent that completes a task in 4
steps with 0 errors is not automatically better than one that completes it in 8 steps
with 1 error and a clean recovery. The 8-step agent may have been more thorough.
Trajectory metrics are diagnostic signals, not scores. They inform human judgment
about agent quality; they do not replace it.

### 4.4 Combining Task and Trajectory Evaluation

The most informative agent evaluation combines both:

| Metric | Source | What it tells you |
|--------|--------|-------------------|
| Task success rate | Task-based eval (endpoint) | Can the agent do the job? |
| Pass@k | Multiple epochs | How reliable is success? |
| Mean steps to completion | Trajectory analysis | How efficient is the agent? |
| Error recovery rate | Trajectory analysis | How robust is the agent? |
| Cost per resolution | Token counting | How expensive is the agent? |
| Tool use accuracy | Per-step analysis | Is the agent using tools correctly? |

An agent scoring 70% success rate with 5 mean steps and $0.50 per resolution is a
different product from an agent scoring 70% success with 25 mean steps and $4.00 per
resolution - even though a task-completion-only benchmark would rank them identically.

> **AGENTIC GROUNDING:** Trajectory evaluation matters because an agent that stumbles to
> the right answer is different from one that takes a clean path. In production, the
> stumbling agent will eventually stumble past the right answer on a harder task. Catching
> this in evaluation is cheaper than catching it in production. When you deploy agents, you
> want to know not just their success rate but their failure modes - and trajectory analysis
> is how you find them.

---

## 5. The Inspect AI Agent Evaluation Model

*Estimated time: 45 minutes*

Inspect AI (UK AI Security Institute) provides the most comprehensive open-source
framework for agent evaluation. This section covers the agent-specific features -
the general architecture (Tasks, Solvers, Scorers) was introduced in Step 3. Here
we focus on what changes when the solver is not a simple prompt-and-generate chain
but an autonomous agent.

### 5.1 The Agent Protocol

In Inspect, an agent is a solver that makes autonomous decisions about tool use. The
`Agent` protocol defines the interface:

```python
from inspect_ai.agent import Agent, AgentState, agent

@agent
def my_agent() -> Agent:
  async def execute(state: AgentState) -> AgentState:
    # Agent logic: read state, decide actions, call tools
    # The agent has full control over the tool loop
    return state
  return execute
```

The `AgentState` extends `TaskState` with agent-specific capabilities. The key
distinction: a regular solver processes the state once (or in a fixed sequence). An
agent loops, making decisions about which tools to call until it decides the task is
complete.

### 5.2 The ReAct Agent

Inspect includes a built-in ReAct (Reasoning + Acting) agent. ReAct is the standard
agent architecture: the model reasons about the current state, selects a tool to call,
observes the result, then reasons again until it reaches a conclusion.

```python
from inspect_ai import Task, task
from inspect_ai.agent import react
from inspect_ai.dataset import json_dataset
from inspect_ai.scorer import includes
from inspect_ai.tool import bash, python, text_editor

@task
def code_task():
  return Task(
    dataset=json_dataset("code_tasks.jsonl"),
    solver=react(
      prompt="You are a software engineer. Complete the task described.",
      tools=[bash(), python(), text_editor()],
      attempts=3,       # 3 submission attempts with scorer feedback
    ),
    scorer=includes(),
    sandbox="docker",   # run tool calls in a Docker container
    message_limit=50,   # cap the trajectory length
  )
```

The ReAct agent's features relevant to evaluation:

- **`attempts`** - the agent can submit multiple answers, receiving scorer feedback
  between attempts. This tests error recovery: can the agent use feedback to correct
  its answer?

- **`message_limit`** - caps the number of messages in the conversation. Without a
  limit, a confused agent can loop indefinitely, consuming tokens. The limit is an
  eval design parameter: too low and capable agents cannot complete complex tasks,
  too high and you pay for flailing.

- **Refusal retry** - `retry_refusals=3` retries if the model refuses to act (common
  with safety-tuned models on security evaluation tasks).

- **Message compaction** - for long-running agents, Inspect can compact the message
  history to fit within context limits, preserving the most recent and most relevant
  messages.

### 5.3 Multi-Agent Evaluation

Agents in Inspect can be composed. The two composition primitives:

**Handoff** - transfers control from one agent to another, sharing the full
conversation history. The receiving agent sees everything the previous agent said and
did.

```python
from inspect_ai.agent import handoff, react

planner = react(
  prompt="You are a planning agent. Decompose the task into sub-tasks.",
  tools=[],  # planning only, no tool use
)

executor = react(
  prompt="You are an execution agent. Complete the sub-tasks identified.",
  tools=[bash(), python()],
)

# In a multi-agent task, handoff passes context
@task
def multi_agent_task():
  return Task(
    dataset=json_dataset("tasks.jsonl"),
    solver=[planner, handoff(executor)],
    scorer=includes(),
    sandbox="docker",
  )
```

**Agent as tool** - wraps an agent as a tool that another agent can call. The
outer agent sends a string to the inner agent and receives a string back. The
inner agent's full trajectory is hidden from the outer agent.

```python
from inspect_ai.agent import as_tool, react

research_agent = react(
  prompt="You research questions using web search.",
  tools=[web_search()],
)

# The orchestrator can call the research agent as a tool
orchestrator = react(
  prompt="You are an orchestrator. Use the research tool for questions.",
  tools=[as_tool(research_agent, name="research")],
)
```

Multi-agent evaluation is where the evaluation design space expands significantly.
You can now evaluate:

- The overall system's task completion rate
- Each agent's trajectory independently
- The quality of inter-agent communication (handoff content, tool call parameters)
- Whether the multi-agent architecture outperforms a single-agent approach on the
  same task

### 5.4 Agent Bridge for External Agents

Inspect's Agent Bridge allows you to evaluate agents built with external frameworks:

- Claude Code
- Codex CLI
- Gemini CLI
- OpenAI Agents SDK
- LangChain
- Pydantic AI

This means you can use Inspect's evaluation infrastructure (datasets, scorers,
sandboxing, logging) with agents that are not built on Inspect's solver architecture.
The bridge handles the communication protocol; you write the eval the same way.

### 5.5 Agent Logging and Trajectory Data

Inspect logs the full agent trajectory: every message, every tool call, every tool
result. This data is available through:

- **The Log Viewer** (`inspect view`) - a web-based tool that shows the complete
  message history for each sample, including tool calls and results. You can step
  through the agent's trajectory visually.

- **Log Dataframes** - Python API for extracting structured data from logs.
  `EvalLogDataFrame` provides access to messages and events as tabular data for
  programmatic trajectory analysis.

- **Inspect Scout** - a separate tool (from Meridian Labs) for in-depth transcript
  analysis of agent traces.

The logging infrastructure means that every agent eval automatically produces the
raw data needed for trajectory analysis (Section 4). You do not need to instrument
your agent manually - Inspect captures the trace.

### 5.6 Putting It Together: A Complete Agent Eval

Here is a complete example that evaluates an agent on a file search task - the kind
you might design for testing a coding assistant:

```python
# file_search_eval.py
from inspect_ai import Task, task
from inspect_ai.agent import react
from inspect_ai.dataset import Sample, MemoryDataset
from inspect_ai.scorer import scorer, Score, Target, CORRECT, INCORRECT, accuracy
from inspect_ai.solver import TaskState
from inspect_ai.tool import bash, python

# Dataset: 5 file search tasks (you would have 20+ in practice)
SEARCH_TASKS = MemoryDataset(samples=[
  Sample(
    input="Find the function that handles user authentication "
          "and return its file path and line number.",
    target="src/auth/login.py:42",
    files={
      "src/auth/login.py": (
        "# Authentication module\n"
        "import hashlib\n"
        "\n"
        "def validate_credentials(username, password):\n"
        "  # ... validation logic\n"
        "  pass\n"
      ),
      "src/auth/session.py": "# Session management\n",
      "src/api/routes.py": "# API routes\nimport auth.login\n",
      "src/utils/helpers.py": "# Utility functions\n",
      "src/config.py": "# Configuration\nAUTH_TIMEOUT = 300\n",
    },
  ),
  Sample(
    input="What is the configured authentication timeout value?",
    target="300",
    files={
      "src/auth/login.py": "# Auth module\n",
      "src/config.py": "# Configuration\nAUTH_TIMEOUT = 300\n",
      "src/utils/helpers.py": "# Utilities\n",
    },
  ),
  # ... more samples
])


@scorer(metrics=[accuracy()])
def search_scorer():
  """Score file search results - checks both correctness and efficiency."""

  async def score(state: TaskState, target: Target) -> Score:
    completion = state.output.completion
    target_str = str(target.text)

    # Check if the target value appears in the agent's output
    is_correct = target_str in completion

    # Count tool calls from the message history
    tool_calls = sum(
      1 for msg in state.messages
      if hasattr(msg, "tool_calls") and msg.tool_calls
    )

    return Score(
      value=CORRECT if is_correct else INCORRECT,
      answer=completion[:200],
      explanation=f"Tool calls: {tool_calls}",
      metadata={"tool_call_count": tool_calls},
    )

  return score


@task
def file_search_eval():
  return Task(
    dataset=SEARCH_TASKS,
    solver=react(
      prompt=(
        "You are a code search assistant. Find the requested "
        "information in the provided codebase. Be precise and efficient."
      ),
      tools=[bash(), python()],
    ),
    scorer=search_scorer(),
    sandbox="docker",
    message_limit=30,
    epochs=3,  # run each sample 3 times for reliability
  )
```

Run it:

```bash
inspect eval file_search_eval.py --model anthropic/claude-sonnet-4-0

# View results in the browser
inspect view
```

This eval captures:

- **Task completion** - did the agent find the correct answer? (the scorer)
- **Efficiency** - how many tool calls did it need? (metadata in the score)
- **Reliability** - does it succeed consistently? (3 epochs per sample)
- **Full trajectory** - the complete trace is logged for analysis

> **NOVEL:** The one-shot agent job pattern (called "polecat" in this project's
> operational vocabulary) is an eval-friendly architecture by construction. A polecat
> receives a plan file as its entire context, executes without interactive steering, and
> produces output against a quality gate. This is structurally identical to an Inspect AI
> eval sample: input (plan file), solver (the agent), scorer (the gate). The
> reproducibility that makes polecats reliable in production is the same property that
> makes them evaluable: fresh context, deterministic execution, no hidden state from
> prior interactions. This observation is from operational experience, not published
> literature.

---

## 6. Sandboxing for Agent Evals

*Estimated time: 30 minutes*

When an agent can call `bash()`, `python()`, or `text_editor()`, it can execute
arbitrary code. In an evaluation context, that code is generated by the model being
evaluated - it is untrusted by definition. Running untrusted model-generated code on
your host machine is a security risk. Running it on a shared evaluation server without
isolation is a correctness risk (one sample's side effects contaminate another).

Sandboxing is non-negotiable for agent evaluation. Not optional, not "nice to have,"
non-negotiable.

### 6.1 What Sandboxing Provides

A sandbox for agent evaluation provides three properties:

**Isolation.** Each evaluation sample runs in its own environment. Agent A's file
modifications, network calls, and process state cannot affect Agent B's evaluation.
This is a correctness requirement: without isolation, your eval results are coupled
across samples, and you cannot attribute success or failure to the agent's behavior
alone.

**Safety.** A model-generated `bash("rm -rf /")` command runs inside a container, not
on your host. A model-generated `python("import os; os.system('curl attacker.com')")`
hits a container with no network access, not your local network. This is a security
requirement.

**Reproducibility.** The sandbox starts from a known state (a Docker image) and is
destroyed after each sample. The next sample starts from the same known state. This
is a measurement requirement: if the environment changes between samples, you are not
measuring the same thing.

### 6.2 Docker Sandboxes in Inspect AI

Inspect AI uses Docker as its primary sandboxing mechanism. The sandbox is configured
via a `compose.yaml` file:

```yaml
# compose.yaml for an agent eval sandbox
services:
  default:
    build: .
    init: true
    command: tail -f /dev/null
    cpus: 1.0
    mem_limit: 512m
    network_mode: none
```

The key configuration options:

- **`cpus` and `mem_limit`** - resource limits prevent a runaway process from consuming
  the eval host's resources. An agent that generates an infinite loop hits the CPU limit,
  not your machine's capacity.

- **`network_mode: none`** - disables network access inside the container. This prevents
  exfiltration of evaluation data and blocks model-generated code from making external
  requests. For evals that require network access (web navigation), you would use a
  more permissive network mode with specific allowlists.

- **`init: true`** - runs a proper init process inside the container. This ensures
  zombie processes are reaped and signals are handled correctly.

The Dockerfile sets up the environment:

```dockerfile
FROM python:3.12-slim

# Install tools the agent will use
RUN apt-get update && apt-get install -y \
  git \
  ripgrep \
  && rm -rf /var/lib/apt/lists/*

# Copy the codebase to evaluate against
COPY ./workspace /workspace
WORKDIR /workspace
```

Per-sample files are injected into the running container before the agent starts. If
your dataset sample includes `files={"src/main.py": "print('hello')"}`, Inspect writes
that file into the sandbox before the agent sees the task.

### 6.3 The Connection to Container Internals

If you completed Bootcamp I Step 9, you know what Docker containers actually are:
Linux namespaces (PID, net, mount, user) and cgroups (CPU, memory limits). A Docker
sandbox for agent evaluation is using the same kernel primitives:

- **PID namespace** - the agent's processes cannot see or signal the host's processes.
- **Network namespace** - `network_mode: none` creates a namespace with no network
  interfaces.
- **Mount namespace** - the container's filesystem is isolated from the host.
- **Cgroups** - `cpus: 1.0` and `mem_limit: 512m` are cgroup constraints.

This is not abstract theory. When an agent eval times out because a model-generated
Python script consumed all available memory, you diagnose it by inspecting the cgroup
limits and the container's OOM (out-of-memory) events. When an agent's `bash()` call
hangs, you check the PID namespace for stuck processes. The container internals from
Bootcamp I are the diagnostic tools for agent eval infrastructure.

### 6.4 Multiple Sandbox Environments

Some agent evals require more than one container. Inspect supports multi-service
compose configurations:

```yaml
# compose.yaml for a security evaluation
services:
  default:
    build: ./agent
    init: true
    command: tail -f /dev/null
    cpus: 1.0
    mem_limit: 512m

  target:
    build: ./target
    init: true
    command: python -m http.server 8080
    cpus: 0.5
    mem_limit: 256m
```

In this configuration, the `default` service is where the agent runs. The `target`
service is a separate container running a web server that the agent is supposed to
interact with. The agent can make network requests to the target but cannot access
the eval host.

This pattern is used extensively in cybersecurity evaluations (capture-the-flag tasks,
vulnerability assessment) and in web agent evaluations (where the agent navigates a
web application running in a separate container).

### 6.5 Scorer Access to Sandbox State

Scorers in Inspect can read the sandbox state after the agent finishes. This is
critical for agent evaluation - the scorer often needs to check whether the agent
actually changed the environment, not just whether it claimed to:

```python
from inspect_ai.scorer import scorer, Score, Target, CORRECT, INCORRECT, accuracy
from inspect_ai.solver import TaskState
from inspect_ai.util import sandbox

@scorer(metrics=[accuracy()])
def file_content_scorer():
  """Check whether the agent actually modified the target file."""

  async def score(state: TaskState, target: Target) -> Score:
    # Read the file from the sandbox - not from the agent's output
    try:
      result = await sandbox().exec(["cat", "/workspace/config.yaml"])
      actual_content = result.stdout
    except Exception:
      return Score(
        value=INCORRECT,
        explanation="Could not read target file from sandbox",
      )

    expected = target.text
    is_correct = expected in actual_content

    return Score(
      value=CORRECT if is_correct else INCORRECT,
      answer=actual_content[:500],
      explanation=(
        f"Expected '{expected}' in file. "
        f"{'Found' if is_correct else 'Not found'}."
      ),
    )

  return score
```

This pattern - scoring by inspecting environment state rather than parsing agent
output - is more reliable for agent evaluation. The agent can claim it modified a
file. The sandbox check verifies it.

> **AGENTIC GROUNDING:** Sandboxing is a safety requirement, not a convenience feature.
> When you evaluate agents that can execute code, you are running untrusted programs.
> The same principle applies to production agent systems - every tool call is potentially
> dangerous, and containment is the baseline control. If your eval infrastructure does not
> sandbox agent execution, your eval results are not trustworthy (because samples may
> interfere with each other) and your eval host is not safe (because model-generated code
> runs with your privileges).

---

## 7. Workflow Evaluation

*Estimated time: 30 minutes*

An agent acts autonomously. A workflow is a structured pipeline where each step is
defined by the developer: step 1 calls model A with prompt template X, step 2 routes
the output to one of three processors based on a classification, step 3 calls model B
to generate the final output. Workflows are more predictable than agents but still
require multi-step evaluation.

### 7.1 The Distinction

| Property | Agent | Workflow |
|----------|-------|----------|
| Control flow | Model decides | Developer defines |
| Tool selection | Model chooses | Developer specifies per step |
| Non-determinism | High (tool selection varies) | Lower (structure fixed, outputs vary) |
| Failure modes | Wrong tool, wrong parameters, wrong strategy | Wrong routing, error propagation, step interaction |
| Evaluation focus | Can it complete the task? | Does each step work? Does the pipeline work end-to-end? |

Workflows include prompt chains (step 1 output becomes step 2 input), routing
(classifier directs input to different processors), parallel execution (multiple
models process the same input independently, results are merged), and retrieval-
augmented generation (retrieve documents, inject into prompt, generate response).

### 7.2 Component vs Integration Evaluation

Workflow evaluation splits into two complementary approaches:

**Component evaluation** tests each step in isolation. You provide a fixed input to
step 2 and score step 2's output, regardless of what step 1 would produce. This is
the unit testing of workflow evaluation.

Advantages:
- Isolates each step's contribution to quality
- Cheaper to run (test one step, not the full pipeline)
- Faster to iterate (change step 2's prompt, re-eval only step 2)
- Pinpoints failure location when something breaks

Disadvantages:
- Misses interaction effects between steps
- The fixed inputs you provide may not match what previous steps actually produce
- A step that scores well in isolation may fail when fed real upstream output

**Integration evaluation** tests the full pipeline end-to-end. You provide the
initial input and score the final output. This is the integration testing of
workflow evaluation.

Advantages:
- Tests the actual user experience
- Catches interaction effects (step 1 produces output that step 2 handles poorly)
- Measures real-world latency and cost

Disadvantages:
- Expensive (runs the full pipeline per sample)
- When the pipeline fails, you do not know which step is responsible
- Changes to any step require re-running the full evaluation

### 7.3 When to Use Which

The answer is the same as in software testing: both, at different frequencies.

**Component evaluation** should run frequently - on every prompt change, every model
swap, every configuration update. It is your fast feedback loop. If step 2 drops from
85% accuracy to 72%, you know immediately without running the full pipeline.

**Integration evaluation** should run less frequently - at release boundaries, when
combining component changes, when evaluating the system for deployment. It is your
validation check.

In practice:

```
Developer changes step 2 prompt
  -> Run step 2 component eval (fast, cheap)
  -> Score meets threshold? Continue.
  -> Run full pipeline integration eval (slower, more expensive)
  -> Score meets threshold? Ship.
```

This mirrors the software engineering practice of running unit tests on every save
and integration tests on every merge. The eval is the test; the pipeline is the
system under test.

### 7.4 Evaluating Routing Steps

Routing is a workflow pattern where a classifier directs input to one of several
processing branches. Evaluating a router requires checking:

1. **Classification accuracy** - does the router send inputs to the correct branch?
   This is a standard classification eval (Step 3).

2. **Branch coverage** - does your eval dataset exercise all branches? A dataset
   where 90% of inputs go to branch A and 10% split between B and C does not
   adequately test branches B and C.

3. **Error routing** - what happens when the input does not clearly belong to any
   branch? Does the router have a default path? Does it handle ambiguous inputs
   gracefully?

### 7.5 Evaluating Retrieval-Augmented Generation (RAG)

RAG pipelines have three evaluable components:

| Component | Eval question | Metrics |
|-----------|---------------|---------|
| Retrieval | Did it find the right documents? | Recall@k, precision@k, MRR |
| Context assembly | Are the retrieved documents well-formatted for the model? | Context relevance score |
| Generation | Given these documents, is the response correct? | Faithfulness, correctness |

**Faithfulness** is the RAG-specific metric: does the generated response stay faithful
to the retrieved documents, or does it hallucinate beyond what the documents support?
An unfaithful RAG response is worse than a non-RAG response because the user believes
the system is grounded in sources when it is not.

Component evaluation of RAG tests each piece separately. Integration evaluation tests
the full retrieve-then-generate pipeline. Both are needed. A retrieval system with
95% recall combined with a generator that ignores 30% of retrieved context produces a
system that is less capable than the retrieval score suggests.

> **NOVEL:** The verification pipeline (called "gauntlet" in this project's operational
> vocabulary) is a worked example of multi-stage workflow evaluation in production. The
> pipeline runs: development gate (typecheck + lint + test) then adversarial review
> (3 independent models) then synthesis then human review then commit. Each stage has
> different evaluation criteria (automated binary checks, structured YAML findings,
> human judgment). The pipeline demonstrates the component/integration distinction in
> practice - each stage can be evaluated independently (did the gate catch the type
> error? did the adversarial review find the bug?) but the pipeline's effectiveness is
> measured end-to-end (did a defect reach the commit?). This architecture is documented
> in the project's operational files, not published literature.

---

## 8. Cost and Latency as Eval Dimensions

*Estimated time: 25 minutes*

An agent that solves a task in 5 API calls is different from one that solves it in 50.
Both may achieve the same success rate. They do not achieve the same operational cost.
In evaluation, we often treat cost and latency as implementation details, not evaluation
dimensions. This is a mistake.

### 8.1 Why Cost is a First-Class Metric

Consider two agents evaluated on SWE-bench Verified:

| Agent | Success rate | Mean cost per attempt | Cost per resolution |
|-------|-------------|----------------------|---------------------|
| Agent A | 50% | $1.00 | $2.00 |
| Agent B | 60% | $10.00 | $16.67 |

Agent B has a higher success rate. Agent B also costs 8x more per resolution. Whether
Agent B is "better" depends entirely on your deployment context. If you are running
the agent on 1,000 issues, Agent A costs $2,000 for 500 resolutions. Agent B costs
$16,670 for 600 resolutions. The marginal 100 resolutions cost $14,670.

If your cost budget is $5,000, Agent A resolves 500 issues. Agent B resolves about
300 before exhausting the budget. The "worse" agent resolves more issues within the
constraint.

This is not a hypothetical. SWE-bench's leaderboard now includes cost scatter plots
that show this tradeoff directly. The dominant position is the Pareto frontier: no
agent resolves more issues at a lower cost. But few organizations operate on the
Pareto frontier. Most operate under a cost constraint, and the cost-constrained
optimal agent is often not the highest-accuracy agent.

### 8.2 Metrics for Cost and Latency

**Token efficiency** - total tokens (prompt + completion) per successful resolution.
This is provider-agnostic: regardless of what you pay per token, fewer tokens means
lower cost.

```python
# Token efficiency across an eval run
def token_efficiency(results: list[dict]) -> dict:
  successful = [r for r in results if r["success"]]
  failed = [r for r in results if not r["success"]]

  if not successful:
    return {"cost_per_resolution": float("inf")}

  total_tokens_success = sum(r["total_tokens"] for r in successful)
  total_tokens_all = sum(r["total_tokens"] for r in results)

  return {
    "tokens_per_resolution": total_tokens_success / len(successful),
    "tokens_per_attempt": total_tokens_all / len(results),
    "wasted_tokens": sum(r["total_tokens"] for r in failed),
    "waste_rate": (
      sum(r["total_tokens"] for r in failed) / total_tokens_all
      if total_tokens_all > 0 else 0
    ),
  }
```

**Time to completion** - wall-clock time from task start to task completion. This
includes API latency, tool execution time, and any retry delays. For user-facing
agent systems, time to completion determines the user experience.

**Cost per resolution** - total monetary cost divided by the number of successful
resolutions. This is the deployment-relevant metric. It combines token efficiency,
model pricing, and success rate into a single number that answers: "how much does it
cost to get one successful result?"

**Waste rate** - what fraction of total tokens are spent on failed attempts? A high
waste rate means the agent burns resources on tasks it cannot complete. An agent with
70% success rate and 10% waste rate is spending its tokens wisely (failing fast on
tasks it cannot solve). An agent with 70% success rate and 50% waste rate is spending
as much on failures as on successes.

### 8.3 Reporting Cost Alongside Accuracy

Every agent eval report should include cost dimensions alongside accuracy. A result
table should look like this:

```
Agent: code-assistant-v2
Model: claude-sonnet-4-0
Dataset: code-tasks-50
Epochs: 3

Success rate:           72.0% (108/150 runs)
Pass@1:                 64.0% (32/50 tasks succeed on first try)
Pass@3:                 80.0% (40/50 tasks succeed at least once in 3 runs)

Mean steps per success: 6.2
Mean steps per failure: 14.8
Mean tokens per success: 8,400
Mean tokens per failure: 22,100

Cost per attempt:       $0.12
Cost per resolution:    $0.17
Waste rate:             38.2%
Mean time per attempt:  24.3 seconds
```

This table tells a complete story. The agent succeeds 72% of the time. When it fails,
it takes more than twice as many steps and nearly three times as many tokens as when
it succeeds - suggesting it does not fail fast. The cost per resolution is reasonable.
The waste rate (38%) indicates room for improvement in early termination of hopeless
attempts.

> **AGENTIC GROUNDING:** Cost and latency metrics matter because agent deployment is a
> resource allocation problem. An agent that costs $0.17 per resolution can be deployed
> at scale. An agent that costs $17.00 per resolution is limited to high-value tasks.
> Evaluating accuracy without cost is like evaluating a hire based on skill without
> considering salary - technically correct but operationally incomplete.

### 8.4 Cost-Aware Eval Design

Several design decisions in your eval affect cost measurement:

- **Message limits.** A `message_limit=50` caps agent trajectories. This directly
  affects cost: the limit prevents runaway spending but may truncate legitimate long
  chains. Report the limit alongside your results.

- **Epochs.** Running 5 epochs per sample gives reliable pass@k estimates but costs
  5x more than a single run. The tradeoff: statistical reliability vs eval budget.
  Use enough epochs to measure what you need and no more.

- **Sandbox overhead.** Docker container startup and teardown adds time (typically
  1-5 seconds per sample). For large eval sets, this overhead is significant. Inspect
  manages sandbox lifecycle to minimize this.

- **Caching.** Inspect supports model output caching. If you re-run the same eval
  with the same model and the same dataset, cached results avoid redundant API calls.
  Use caching for iteration; disable it for final measurements.

---

## 9. Evaluating Tool Use

*Estimated time: 25 minutes*

Tool use is the atomic unit of agent behavior. At each step, the agent decides:
which tool to call, with what parameters, and how to interpret the result. Each of
these decisions is independently evaluable. Tool use accuracy is a decomposable
sub-metric that gives finer-grained insight than task-level success or trajectory-
level efficiency.

### 9.1 The Three Components

**Tool selection accuracy** - did the agent choose the right tool for the sub-task?

When the agent needs to find a function definition, the appropriate tool is `grep` or
`glob` (depending on whether it is searching by content or by filename). Using
`bash("find . -name '*.py' | xargs grep 'def function_name'")` works but is
unnecessary when a dedicated search tool is available. Using `python()` to write and
run a custom search script is even worse - correct but wildly inefficient.

Tool selection accuracy is the fraction of tool calls where the selected tool was
appropriate for the sub-task. Measuring this requires defining what "appropriate" means
for each sub-task, which requires either:

- A reference trajectory (expert-annotated sequence of correct tool calls)
- A set of acceptable tools per sub-task type (search tasks accept grep/glob, file
  reads accept read/cat, edits accept text_editor/sed)
- An LLM judge that evaluates tool selection appropriateness in context

### 9.2 Parameter Accuracy

Even when the agent selects the correct tool, the parameters may be wrong:

```python
# Correct tool, wrong parameters
bash("grep -r 'timeout' .")        # searches everything - too broad
bash("grep 'timeout' config.yaml")  # searches the right file - correct

# Correct tool, malformed parameters
bash("grep -r timeout' .")          # syntax error - missing quote
```

Parameter accuracy is the fraction of tool calls where the parameters were syntactically
valid and semantically appropriate. Syntactic validity is checkable automatically (the
tool call succeeded vs returned a parse error). Semantic appropriateness is harder and
may require human judgment or LLM-as-judge scoring.

### 9.3 Result Interpretation Accuracy

After a tool returns its result, the agent must interpret it correctly. This is where
subtle errors occur:

```
Agent calls: grep("authentication", "src/")
Tool returns: "src/auth/login.py:42:def authenticate(user, password):"
              "src/auth/session.py:18:# authentication session management"
              "src/middleware/cors.py:5:# CORS authentication headers"

Agent interprets: "The authentication function is in src/middleware/cors.py"
```

The agent selected the right tool, provided correct parameters, and received
accurate results - then misinterpreted which result was relevant. This kind of error
is invisible in task-level scoring if the agent eventually recovers. It is visible in
trajectory analysis and in tool use accuracy metrics.

Result interpretation accuracy is the hardest component to evaluate automatically. It
requires comparing the agent's next action (which reveals how it interpreted the result)
against what a competent interpretation would have produced. This is typically done with
LLM-as-judge scoring or by comparison against reference trajectories.

### 9.4 Tool Use as a Decomposed Metric

Combining the three components:

```
Tool use accuracy = f(selection, parameters, interpretation)
```

You can report each component separately:

```
Tool selection accuracy:     92% (46/50 correct tool choices)
Parameter accuracy:          88% (44/50 syntactically and semantically correct)
Result interpretation:       84% (42/50 correct interpretations)
Overall tool use accuracy:   74% (37/50 all three correct)
```

The decomposition pinpoints failure modes. An agent with high selection accuracy but
low interpretation accuracy is choosing the right tools but misreading their output -
a different remediation target than an agent that keeps picking the wrong tool.

### 9.5 Implementing Tool Use Scoring

In Inspect AI, tool calls are recorded in the message history. A custom scorer can
extract and evaluate them:

```python
from inspect_ai.scorer import scorer, Score, Target, accuracy
from inspect_ai.solver import TaskState

@scorer(metrics=[accuracy()])
def tool_use_scorer(expected_tools: list[str]):
  """Score based on whether the agent used expected tools."""

  async def score(state: TaskState, target: Target) -> Score:
    # Extract tool calls from the conversation
    actual_tools = []
    for msg in state.messages:
      if hasattr(msg, "tool_calls") and msg.tool_calls:
        for call in msg.tool_calls:
          actual_tools.append(call.function)

    # Check if expected tools were used
    expected_set = set(expected_tools)
    actual_set = set(actual_tools)

    correct_tools = expected_set & actual_set
    wrong_tools = actual_set - expected_set
    missed_tools = expected_set - actual_set

    # Score: fraction of expected tools that were actually used
    if not expected_set:
      fraction = 1.0
    else:
      fraction = len(correct_tools) / len(expected_set)

    return Score(
      value=fraction,
      answer=f"Used: {sorted(actual_set)}",
      explanation=(
        f"Expected: {sorted(expected_set)}, "
        f"Correct: {sorted(correct_tools)}, "
        f"Wrong: {sorted(wrong_tools)}, "
        f"Missed: {sorted(missed_tools)}"
      ),
      metadata={
        "total_tool_calls": len(actual_tools),
        "unique_tools": len(actual_set),
        "correct_tools": len(correct_tools),
        "wrong_tools": len(wrong_tools),
        "missed_tools": len(missed_tools),
      },
    )

  return score
```

This scorer checks whether the agent used the expected tools. A more sophisticated
version would check the order, the parameters, and the interpretation of results.
Start with selection accuracy; add the other components when you need them.

> **NOVEL:** The quality gate in this project is the simplest possible agent eval
> scorer. The gate runs `pnpm run typecheck && pnpm run lint && pnpm run test` - three
> binary checks composed with AND. This is tool use evaluation in its most basic form:
> the agent produces code, the gate evaluates it by running three tools against it.
> Each tool is a scorer (pass/fail), the gate is a composite scorer (all must pass),
> the output is binary (green/red). The gate does not evaluate the agent's trajectory
> or tool selection. It evaluates only the final artifact. This is a deliberate design
> choice: the gate provides fast, reliable, automated verification of the endpoint. It
> is complemented by adversarial review (trajectory and quality evaluation by
> independent models) for properties the gate cannot check. The combination of
> automated gate plus adversarial review is the project's evaluation architecture.

---

## 10. Challenges

*Estimated time: 60-90 minutes total*

These challenges are designed to build practical skills in agent evaluation. Each one
exercises a specific concept from this step. You will need access to Inspect AI
(`pip install inspect-ai`), a Docker installation, and an API key for at least one
model provider.

---

### Challenge 1: Design an Agent Eval for File Search

*Estimated time: 30 minutes*
*Type: Design + Build*

Design and implement an agent evaluation for a file search task. The agent must find
specific information across a set of files using available tools (bash, python, or
read).

**Deliverable:** A working Inspect AI evaluation file (`file_search_eval.py`) with:

- A dataset of at least 20 search tasks across 10 files
- A ReAct agent with appropriate tools
- A custom scorer that measures both correctness and efficiency (tool call count)

**Design constraints:**

- Tasks should range from simple (find a specific string) to complex (find a pattern
  that spans multiple files)
- The dataset must include at least 3 tasks where the information is NOT present in
  any file (testing the agent's ability to report "not found")
- The scorer must record tool call count in its metadata

**Evaluation criteria:** Your eval is well-designed if:

- The success rate differs meaningfully between a strong model and a weak model
- The efficiency metric (tool calls per task) shows variance across tasks
- "Not found" tasks are scored correctly (the agent should report absence, not fabricate
  an answer)

<details>
<summary>Design guidance</summary>

Start with the `MemoryDataset` approach shown in Section 5.6. Each sample's `files`
dict defines the codebase the agent searches. Vary the file structure across samples
to prevent the agent from learning a single search strategy.

For the scorer, use `state.messages` to count tool calls. Record the count in
`Score.metadata` so it appears in the eval logs.

For "not found" tasks, set the target to a sentinel value (e.g., "NOT_FOUND") and
check whether the agent's output indicates absence rather than fabrication.

Run with `epochs=3` and report both pass@1 and pass@3 to measure reliability.

</details>

---

### Challenge 2: Build a ReAct Agent Eval with Inspect AI

*Estimated time: 30 minutes*
*Type: Build + Analyse*

Build an Inspect AI eval for a simple ReAct agent that solves coding tasks using
bash and Python tools. Measure task success rate, average steps to completion, and
tool use accuracy.

**Deliverable:**

1. An eval file (`react_agent_eval.py`) with at least 10 coding tasks
2. A custom scorer that captures trajectory metrics
3. A brief analysis (5-10 sentences) of the results

**Design constraints:**

- Tasks should be solvable in under 10 tool calls by a competent agent
- Use `sandbox="docker"` for all tasks
- Set `message_limit=30` to prevent runaway trajectories
- Run with `epochs=3` for reliability

**Evaluation criteria:**

- The eval runs successfully against at least one model
- Trajectory metrics (steps, tool calls, errors) are captured in scorer metadata
- The analysis identifies at least one concrete finding (e.g., "the agent uses bash
  for file reads instead of the text editor, averaging 2 extra steps per task")

<details>
<summary>Design guidance</summary>

Sample coding tasks:

```jsonl
{"input": "Create a Python file that prints the first 10 Fibonacci numbers, then run it.", "target": "0 1 1 2 3 5 8 13 21 34"}
{"input": "Find all Python files in /workspace and count the total lines of code.", "target": "Use wc -l"}
{"input": "Write a bash script that lists all environment variables starting with 'PATH'.", "target": "PATH"}
```

Your custom scorer should:
1. Check task completion (does the output contain the target?)
2. Count total messages in `state.messages`
3. Count tool calls specifically (messages with `tool_calls` attribute)
4. Store all counts in `Score.metadata`

After running, load the eval log with `read_eval_log()` and compute aggregate
trajectory metrics across all samples.

</details>

---

### Challenge 3: Compare Single-Agent vs Multi-Agent Architectures

*Estimated time: 30-45 minutes*
*Type: Build + Analyse*

Evaluate the same set of tasks with two different architectures: a single ReAct agent
and a planner-executor multi-agent system. Compare success rate, cost, latency, and
error recovery.

**Deliverable:**

1. Two eval files (or one file with two task definitions): `single_agent_eval` and
   `multi_agent_eval`
2. Both evals use the same dataset (at least 10 tasks)
3. A comparison table showing: success rate, mean tokens per task, mean steps per
   task, and error count for each architecture

**Design constraints:**

- The single-agent eval uses `react()` with all tools available
- The multi-agent eval uses a planning agent (no tools, just reasoning) that produces
  a plan, followed by an execution agent (with tools) that follows the plan
- Both evals use the same scorer, sandbox, and message limits
- Run both with `epochs=3`

**Evaluation criteria:**

- The comparison identifies at least one dimension where each architecture is stronger
  (e.g., single-agent is faster but multi-agent has better error recovery)
- The cost comparison uses token counts, not just step counts
- The analysis acknowledges limitations (sample size, task selection bias)

<details>
<summary>Design guidance</summary>

For the multi-agent setup, use `handoff()` to pass context from the planner to the
executor:

```python
from inspect_ai.agent import handoff, react

planner = react(
  prompt="Decompose this task into numbered steps. Do not execute.",
  tools=[],
)

executor = react(
  prompt="Follow the plan from the previous agent. Execute each step.",
  tools=[bash(), python()],
)

solver = [planner, handoff(executor)]
```

For fair comparison, both architectures must have the same total message limit.
If the single agent has `message_limit=30`, the multi-agent system should also
have 30 total messages across both agents.

Be honest about sample size. With 10 tasks and 3 epochs, you have 30 data points
per architecture. This is enough to see large differences but not enough to draw
statistically significant conclusions about small differences. Say so in your
analysis.

</details>

---

## 11. Key Takeaways

Before moving to Step 5, you should be able to answer these questions without
looking anything up:

1. What is the fundamental difference between evaluating a model and evaluating
   an agent? (Hint: it involves more than one output.)

2. Why does running an agent eval once per sample produce unreliable results?
   What parameter in Inspect AI addresses this?

3. SWE-bench scores an agent by running the repository's test suite after
   applying the agent's patch. What does this evaluation miss?

4. What is the difference between task-based evaluation and trajectory
   evaluation? When do you need each?

5. Why is sandboxing non-negotiable for agent evaluation? Name the three
   properties it provides.

6. What are the three components of tool use accuracy? Which is hardest to
   evaluate automatically?

7. When evaluating a multi-step workflow, what is the tradeoff between
   component evaluation and integration evaluation?

8. An agent achieves 60% success rate at $10 per resolution. Another achieves
   50% success rate at $1 per resolution. Under a $5,000 budget, which resolves
   more tasks?

9. In Inspect AI, what is the difference between `handoff()` and `as_tool()`
   for multi-agent composition?

10. What does the `epochs` parameter on an Inspect AI task do, and why does it
    matter for agent evaluation specifically?

---

## 12. Recommended Reading

- **Jimenez et al. (2023) "SWE-bench: Can Language Models Resolve Real-World GitHub
  Issues?"** (arXiv:2310.06770) - The foundational agent benchmark for software
  engineering. Read sections on task construction and scoring methodology. The
  leaderboard at swebench.com shows current state of the field.

- **Zhou et al. (2023) "WebArena: A Realistic Web Environment for Building Autonomous
  Agents"** (arXiv:2307.13854) - Extends agent evaluation to interactive web
  environments. The environment setup and evaluation methodology sections are most
  relevant.

- **Xie et al. (2024) "OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks
  in Real Computer Environments"** (arXiv:2404.07972) - Full desktop OS evaluation.
  Read for the progression from browser-only to OS-level evaluation and the failure
  mode analysis.

- **Inspect AI Documentation - Agents** (inspect.ai-safety-institute.org.uk/agents.html)
  - The agent evaluation API. Read the ReAct agent documentation, the Agent Bridge
  section, and the multi-agent composition patterns.

- **Inspect AI Documentation - Sandboxing**
  (inspect.ai-safety-institute.org.uk/sandbox.html) - Docker and Kubernetes sandbox
  configuration. Read alongside Bootcamp I Step 9 for the connection to container
  internals.

- **OpenAI Trace Grading Documentation**
  (platform.openai.com/docs/guides/trace-grading) - The most explicit published
  approach to trajectory evaluation. Read for the concept of trace-level scoring even
  if you do not use OpenAI's platform.

- **Chen et al. (2021) "Evaluating Large Language Models Trained on Code"**
  (arXiv:2107.03374) - Introduces pass@k metrics. Read section 3 for the statistical
  methodology behind multi-run agent evaluation.

- **Anthropic "Challenges in Evaluating AI Systems" (2023)** - General evaluation
  challenges that apply with additional force to agent evaluation. Read after Step 1
  for the agent-specific implications.

---

## What to Read Next

**Step 5: Eval Infrastructure and Automation** - This step taught you how to design
and run agent evaluations. Step 5 teaches you how to run them systematically: eval-
driven development as the inner loop of agentic engineering, running evals in CI/CD,
dataset versioning, result storage and trend analysis, prompt optimization using evals
as feedback, and regression testing to ensure changes do not break what already works.
Step 5 takes the agent evals you designed here and embeds them in a development
workflow - the eval moves from "something you run" to "something that runs on every
change."

