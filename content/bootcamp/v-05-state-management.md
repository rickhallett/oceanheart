+++
title = "State Management for Agents"
date = "2026-03-10"
description = "Stateless to stateful. Filesystem as state. State backends. Schema design. Concurrency."
tags = ["state", "management", "bootcamp"]
step = 5
tier = 2
estimate = "4-5 hours"
bootcamp = 5
+++

Step 5 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

## Why This Step Exists

An agent that forgets everything between interactions is a sophisticated autocomplete. It
can respond to single prompts, transform text, generate code from specifications. These are
useful capabilities. They are also the capabilities of a stateless function.

The moment you need an agent to do sustained work - track progress across tasks, remember
what it decided and why, recover from interruptions, build on previous results - you need
state management. Not "memory" in the conversational sense (Step 6 covers that), but the
engineering discipline of deciding what to persist, where to persist it, how to read it
back, and what to do when it goes wrong.

This step exists at position 5 because it requires everything before it. You need to
understand the filesystem as a state store (Bootcamp I Step 3), context windows as
volatile memory (Step 4), and the retrieval problem (Step 1) before you can reason about
what state an agent needs to function correctly. State management is the bridge between
understanding the problem and building systems that solve it reliably.

The project you are studying makes state management decisions that most agent frameworks
abstract away. It uses files - plain text, YAML, TSV, JSON - as its primary state store.
Not because it lacks access to databases, but because files have properties that matter
for this workload: they are version-controlled, human-readable, diffable, and recoverable
through git. This step presents that architecture as a worked example, examines its genuine
strengths and real limitations, and then broadens to the full spectrum of state backends
you will encounter in production.

By the end of this step, you will be able to design a state management strategy for an
agent system: what to persist, where to persist it, how to handle concurrent access, and
how to recover from failure.

---

## Table of Contents

1. [Why This is Step 5](#1-why-this-is-step-5) (~15 min)
2. [The State Management Spectrum](#2-the-state-management-spectrum) (~30 min)
3. [The Filesystem as State - A Worked Example](#3-the-filesystem-as-state---a-worked-example) (~50 min)
4. [State Categories](#4-state-categories) (~30 min)
5. [The Durable Write as Policy](#5-the-durable-write-as-policy) (~25 min)
6. [State Backends](#6-state-backends) (~45 min)
7. [State Schema Design](#7-state-schema-design) (~30 min)
8. [Concurrency and State](#8-concurrency-and-state) (~40 min)
9. [Challenges](#challenges) (~60-90 min)
10. [What to Read Next](#what-to-read-next)

---

## 1. Why This is Step 5

*Estimated time: 15 minutes*

Every software system has state. The question is never "does my system have state?" but
"where does my state live, and what happens when I lose it?"

For traditional applications, the answer is usually straightforward: state lives in a
database, is accessed through an ORM or query layer, and is protected by transactions
and replication. Losing the database is a disaster but a well-understood one, with
established recovery procedures.

Agent systems introduce a complication. An agent has at least two kinds of state that
interact in ways traditional applications do not experience:

1. **Context window state** - the tokens currently loaded in the model's working memory.
   This state is volatile in the strongest possible sense: it exists only for the
   duration of a single API call or session, it cannot be inspected by the agent itself
   (the model has no introspective token counter), and when it is lost, the loss is
   binary and total. There is no graceful degradation. One moment the agent has 200k
   tokens of context; the next, it has nothing.

2. **External state** - everything the agent has written to durable storage: files,
   database rows, API calls, git commits. This state survives context window death.
   It is the agent's lifeline.

The interaction between these two kinds of state is the central problem. When an agent
makes a decision but records it only in its context window, that decision is one session
boundary away from permanent loss. When an agent writes state to a file but the file
becomes stale, the next agent that boots from it will hallucinate the described state
into reality - the stale reference propagation failure mode.

State management for agents is the discipline of keeping these two kinds of state
synchronized: ensuring that anything worth keeping gets written to durable storage
before the context window dies, and ensuring that durable storage accurately reflects
reality when the next agent reads it.

> **AGENTIC GROUNDING:** The failure mode is concrete. An agent works for 45 minutes
> on a complex refactoring task, making a series of design decisions informed by code
> analysis and test results. It records nothing to durable storage because everything
> is "in context." Then the session ends - network timeout, token limit, user closes
> the terminal. Every decision, every piece of analysis, every intermediate conclusion
> is gone. The next agent starts from zero. This is not a hypothetical. It is the
> default behaviour of every agent that does not actively manage its state.

---

## 2. The State Management Spectrum

*Estimated time: 30 minutes*

State management is a spectrum of design choices, not a progression from bad to good.
Where you should sit on the spectrum depends on the task, the failure tolerance, and
the cost of state infrastructure.

### 2.1 Stateless: the one-shot agent job

At one end of the spectrum sits the deliberately stateless agent. This project calls
them **one-shot agent jobs** - `claude -p` agents executing within a deterministic
pipeline. Fresh context window, one-shot, no interactive steering.

The key word is *deliberately*. A stateless agent is not broken. It is a design
choice with specific advantages:

- **No state corruption.** If there is no persistent state, there is nothing to
  corrupt. Each invocation starts clean.
- **Perfect reproducibility.** Given the same inputs and the same model, a stateless
  agent produces the same distribution of outputs. No hidden state from previous runs
  can influence the result.
- **Trivial scaling.** Stateless processes can be parallelized without coordination.
  No locks, no shared databases, no race conditions.
- **Compaction immunity.** A stateless agent cannot suffer compaction loss because it
  has no compaction to lose. Its context window is its only state, and it was designed
  to be discarded.

The project uses one-shot agent jobs for its Makefile pipeline. Each step receives a
plan file as its prime context, executes its task, writes its output, and exits. The
pipeline is the orchestration; the agent is the executor. This is the same pattern as
a Unix pipeline: each process is stateless, and the pipe carries state between them.

When stateless is the right choice:

- Deterministic transformations (code formatting, linting, type checking)
- Idempotent tasks (file generation from templates, report compilation)
- Pipeline stages where each stage's output is the next stage's input
- Tasks where reproducibility matters more than continuity

When stateless is insufficient:

- Multi-step tasks where later steps depend on decisions made in earlier steps
- Tasks requiring learning from feedback within a session
- Workflows where human intervention can interrupt and resume
- Any task where "start from zero" is more expensive than "resume from checkpoint"

```python
# A stateless agent job: receives input, produces output, exits.
# No persistent state. No session history. No side effects beyond the output file.
import sys
import json

def one_shot_transform(input_path: str, output_path: str) -> None:
  """Transform input to output. No state carried between invocations."""
  with open(input_path) as f:
    data = json.load(f)

  # The transformation is pure: same input always produces same output
  result = {
    "processed": True,
    "items": [transform_item(item) for item in data["items"]],
    "source": input_path
  }

  with open(output_path, "w") as f:
    json.dump(result, f, indent=2)

def transform_item(item: dict) -> dict:
  """Pure function. No external state accessed."""
  return {
    "id": item["id"],
    "normalized_name": item["name"].lower().strip(),
    "valid": len(item["name"]) > 0
  }

if __name__ == "__main__":
  one_shot_transform(sys.argv[1], sys.argv[2])
```

### 2.2 Session state: within a single interaction

The middle of the spectrum. State exists for the duration of a session - a conversation,
a task execution, a debugging session - and is discarded when the session ends.

Session state includes:

- The conversation history (messages sent and received)
- Tool call results (file contents read, command outputs)
- Intermediate computations (analysis results, plans in progress)
- Decisions made during the session ("I chose approach A over B because...")

The critical question for session state is: **what happens if the session is interrupted?**

If the answer is "start over," session state is sufficient and no persistence is needed.
If the answer is "that would cost hours of work," you need to either persist session
state to durable storage or restructure the work to produce durable outputs more
frequently.

```python
# Session state: exists for one conversation, discarded after.
class SessionState:
  """State that lives for exactly one agent session."""

  def __init__(self):
    self.messages: list[dict] = []
    self.tool_results: dict[str, str] = {}
    self.decisions: list[str] = []
    self.files_read: set[str] = set()

  def record_decision(self, decision: str, rationale: str) -> None:
    """Record a decision made during this session.

    If the session dies, this decision is lost forever.
    SD-266 says: write it to a durable file instead.
    """
    self.decisions.append(f"{decision}: {rationale}")

  def get_context_for_prompt(self) -> str:
    """Build the context string for the next LLM call.

    This is the session's working set - the minimum state
    needed for the model to produce correct output on the
    next turn.
    """
    parts = []
    for msg in self.messages[-10:]:  # Last 10 messages
      parts.append(f"{msg['role']}: {msg['content']}")
    if self.decisions:
      parts.append("Decisions made this session:")
      for d in self.decisions:
        parts.append(f"  - {d}")
    return "\n".join(parts)
```

### 2.3 Persistent state: across session boundaries

At the other end of the spectrum. State survives session death, system restarts, and
(in distributed systems) even hardware failure. Persistent state is what makes an agent
capable of sustained work across days, weeks, or months.

Persistent state includes:

- User preferences and configurations
- Accumulated knowledge (what the agent has learned about the codebase, the user, the
  domain)
- Decision history (what was decided, when, and why)
- Task progress (what has been done, what remains)

Persistent state requires engineering discipline:

- **Schema.** What shape does the state have? What fields are required? What types are
  they? If you persist unstructured blobs, you will not be able to query them later.
- **Migration.** What happens when the schema changes? Version 1 of your state has 5
  fields. Version 2 has 7. How do you handle records written under version 1?
- **Consistency.** If two agents read the same state, they must see the same data. If
  one writes while another reads, the reader must see either the old state or the new
  state, never a partial update.
- **Recoverability.** If the storage system fails, can you recover? From backups? From
  replicas? From event logs?

```python
# Persistent state: survives session boundaries.
# This example uses SQLite, covered in detail in Section 6.
import sqlite3
from datetime import datetime

class PersistentAgentState:
  """State that survives across sessions."""

  def __init__(self, db_path: str):
    self.conn = sqlite3.connect(db_path)
    self._ensure_schema()

  def _ensure_schema(self) -> None:
    """Create tables if they don't exist. Idempotent."""
    self.conn.executescript("""
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        session_id TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS task_progress (
        task_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TEXT,
        completed_at TEXT,
        result TEXT
      );
    """)
    self.conn.commit()

  def record_decision(self, decision: str, rationale: str,
                      session_id: str) -> None:
    """Record a decision to durable storage.

    This survives context window death, session restarts,
    and system reboots. SD-266 in action.
    """
    self.conn.execute(
      "INSERT INTO decisions (timestamp, decision, rationale, session_id) "
      "VALUES (?, ?, ?, ?)",
      (datetime.utcnow().isoformat(), decision, rationale, session_id)
    )
    self.conn.commit()

  def get_recent_decisions(self, limit: int = 20) -> list[dict]:
    """Retrieve recent decisions for context restoration.

    After a session restart, the new agent loads these to
    reconstruct its understanding of prior work.
    """
    cursor = self.conn.execute(
      "SELECT timestamp, decision, rationale, session_id "
      "FROM decisions ORDER BY id DESC LIMIT ?",
      (limit,)
    )
    return [
      {"timestamp": row[0], "decision": row[1],
       "rationale": row[2], "session_id": row[3]}
      for row in cursor.fetchall()
    ]
```

### 2.4 The spectrum is a design choice

These three positions - stateless, session, persistent - are not quality levels. A
stateless agent is not worse than a persistent one. The right choice depends on the
task:

| Task | Right position | Why |
|------|---------------|-----|
| Code formatting | Stateless | Deterministic, idempotent, no history needed |
| Interactive debugging | Session | Decisions build on each other within session |
| Customer service | Persistent | Must remember customer history across sessions |
| CI/CD pipeline stage | Stateless | Each run is independent, reproducibility matters |
| Research assistant | Persistent | Accumulates knowledge over weeks of work |
| One-shot code review | Stateless | Fresh perspective is the feature, not the bug |

The mistake is to default to one position without analysis. Many agent frameworks
push toward full persistence by default, adding complexity for tasks that do not need
it. Equally, many quick prototypes remain stateless past the point where persistence
would save significant rework.

> **AGENTIC GROUNDING:** The project's Makefile pipeline uses one-shot agent jobs
> (stateless) for individual build steps, but persistent files (AGENTS.md, events.yaml,
> session-decisions) for cross-session continuity. This is not inconsistent. It is the
> spectrum applied deliberately: stateless where reproducibility matters, persistent
> where continuity matters. The agents are stateless; the system is stateful.

> **FIELD VS NOVEL:** The stateless/session/persistent taxonomy is well-established in
> web application architecture (Phoenix, W. Scott Means - "Stateless Applications,"
> Richardson, "RESTful Web Services"). The novel contribution here is applying it
> explicitly to agent systems, where the volatility of the context window creates a
> failure mode (compaction loss) that web applications do not have. A web server's
> session can be recreated from a database. An agent's context window, once lost, is
> gone - there is no "session restore" unless you built one.

---

## 3. The Filesystem as State - A Worked Example

*Estimated time: 50 minutes*

Bootcamp I Step 3 established the filesystem as a state store at the operating system
level: inodes, permissions, atomic writes, file locking. This section takes that
foundation and examines how a real project uses the filesystem as its primary state
management system.

The project you are studying does not use a database for its operational state. It uses
files. This is a deliberate architectural choice, not a limitation. Understanding why -
and where the choice has genuine limitations - is the goal of this section.

### 3.1 The boot sequence as state restoration

When an agent starts a new session, it reads AGENTS.md. This file is approximately 600
lines of structured information: objectives, standing orders, vocabulary, the layer model,
anti-pattern taxonomy, filesystem map, recent decisions. The file IS a state restoration
mechanism.

Consider what happens at session start:

1. The harness loads AGENTS.md into the context window (L8 - agent role).
2. The agent now "knows" the project's vocabulary, objectives, constraints, and recent
   history.
3. The agent is operational. It can make decisions consistent with prior sessions.

This is checkpoint recovery - navigating from last known position when visibility is
lost. The "visibility" here is the context window, and it is lost at every session
boundary. AGENTS.md is the checkpoint.

The design properties that make this work:

- **Self-contained.** AGENTS.md contains or references everything needed for cold boot.
  An agent reading only this file is operational. This is the working set for
  session initialization.
- **Version-controlled.** Every change to AGENTS.md is a git commit. The state history
  is the git log. You can see exactly what changed, when, and why.
- **Human-readable.** An operator can read AGENTS.md and verify that the state is correct.
  No binary formats, no serialization layers, no tooling required beyond a text editor.
- **Diffable.** `git diff` on AGENTS.md shows exactly what changed between sessions. This
  is impossible with opaque state stores.

```
# The state restoration sequence visualized:
#
# Session N dies (context window death)
#     |
#     v
# All context-only state is permanently lost (compaction loss)
#     |
#     v
# Session N+1 starts
#     |
#     v
# Harness loads AGENTS.md (checkpoint recovery)
#     |
#     v
# Agent reads filesystem state map (knows what files exist)
#     |
#     v
# Agent loads task-specific files as needed (working set construction)
#     |
#     v
# Agent is operational (recovered from checkpoint)
```

### 3.2 The state files - a catalog

The project maintains several distinct state files, each with a specific role and update
pattern. This is not accidental. Each file represents a different category of state with
different access patterns.

**AGENTS.md - Boot state (checkpoint)**

- **Content:** Project objectives, standing orders, vocabulary, recent decisions, filesystem
  map.
- **Update pattern:** Modified when project structure, vocabulary, or standing orders change.
  Infrequent updates (every few sessions, not every commit).
- **Access pattern:** Read at every session start. Loaded into L8 (agent role).
- **What happens if lost:** New sessions start with no project context. The agent enters the
  dumb zone - syntactically valid output, semantically disconnected from the project.
- **Recovery:** git history preserves all prior versions.

**events.yaml - Event log (append-only)**

- **Content:** Structured event records with date, time, type, agent, commit, reference,
  summary, and backreferences.
- **Update pattern:** Append-only. New events are added at the end. Existing events are
  never modified (immutability per SD-266 - "historical data is immutable").
- **Access pattern:** Queried when reconstructing project history or understanding what
  happened when.
- **What happens if lost:** Historical record is gone, but operational capability is
  unaffected. Events can be partially reconstructed from git log.
- **Recovery:** git history, plus partial reconstruction from commit messages.

```yaml
# events.yaml structure - an append-only event log
events:
  - date: "2026-03-04"
    time: "08:30"
    type: L11
    agent: Weaver
    commit: dd23fa3
    ref: governance-friction-audit-2026-03-04.md
    summary: "Cross-model triangulation on governance patterns"
    backrefs: [catch-log.tsv]

  - date: "2026-03-05"
    time: "14:15"
    type: process
    agent: Architect
    commit: a1b2c3d
    ref: null
    summary: "Boot sequence consolidation into AGENTS.md"
    backrefs: [session-decisions-index.yaml]
```

**session-decisions-index.yaml - Decision index (curated)**

- **Content:** Standing orders (always active) and the most recent decisions. A curated
  window into the full 322-entry decision chain.
- **Update pattern:** Updated when new decisions are made. Curated, not append-only - old
  "recent" entries are rotated out while standing orders persist.
- **Access pattern:** Read at session start for orientation. The full decision chain
  (session-decisions.md) is depth 3 - read only for deliberate research.
- **What happens if lost:** Orientation is degraded. Standing orders must be reconstructed
  from AGENTS.md (which contains a summary). Recent decisions are lost until the full
  chain is consulted.

**.keel-state - Runtime state (mutable, locked)**

- **Content:** JSON with typed fields: current head commit, current session decision number,
  bearing (work status, last commit, notes), officer of the watch, true north, gate
  status, test counts, weave mode, register, tempo.
- **Update pattern:** Read-modify-write. Protected by `fcntl.flock` to prevent torn writes
  from concurrent access. This is the pattern from Bootcamp I Step 3 Section 9 (file
  locking and concurrency), applied to a real operational state file.
- **Access pattern:** Read and updated by pitkeel (the project's stability monitoring tool)
  during sessions.
- **What happens if lost:** Runtime monitoring state is reset. No operational impact - the
  file is recreated with defaults on next pitkeel run.

**catch-log.tsv - Control log (append-only)**

- **Content:** Tab-separated records of when governance controls fire and catch something:
  date, control name, what was caught, agent, outcome, notes.
- **Update pattern:** Append-only. Each line is a new record.
- **Access pattern:** Queried during reviews and retrospectives.
- **What happens if lost:** Historical control data is gone. Operational capability
  unaffected.

**backlog.yaml - Task tracking (structured, CLI-managed)**

- **Content:** Structured task items with IDs, titles, priorities, statuses, epics, tags.
- **Update pattern:** CRUD through the `backlog` CLI. Items are added, updated (status
  changes), and closed.
- **Access pattern:** Read at session start for task orientation. Updated during sessions
  as work progresses.
- **What happens if lost:** Task tracking must be reconstructed from events.yaml and git
  history. Painful but possible.

### 3.3 Why files work for this project

The file-based architecture is not a default or a simplification. It is a deliberate
match to the project's specific constraints:

**Single-host operation.** There is one operator, one repository, one machine. There is
no concurrent multi-user access pattern that would require a shared database server.

**Version control as audit trail.** Every state change produces a git commit. The commit
hash, timestamp, author, and message are a complete audit trail. A database would require
building a separate audit system.

**Human readability as verification.** The operator reads state files directly. YAML, TSV,
and JSON are human-readable without tooling. This enables the engineering loop's "verify"
step: the operator can `cat events.yaml` and verify the agent wrote what it claimed to
write.

**Diffability as change detection.** `git diff` on a YAML file shows exactly what changed.
`git log -p -- events.yaml` shows the complete change history. This is immediate,
free, and requires no additional infrastructure.

**Recoverability through git.** If a state file is corrupted, `git checkout -- filename`
restores the last committed version. If the file needs to be inspected at any historical
point, `git show commit:filename` retrieves it. The entire version control system
functions as a state backup mechanism.

### 3.4 Where files fail

The file-based approach has genuine limitations. Being honest about these is as important
as understanding the strengths.

**Concurrent writes.** When multiple agents or processes need to write to the same file
simultaneously, file locking (flock) works for single-host scenarios but does not scale
to distributed systems. The `.keel-state` file uses flock, and this is sufficient because
only one process updates it. If five agents needed to update backlog.yaml simultaneously,
file locking would serialize their operations and create a bottleneck.

**Complex queries.** "Show me all decisions made by the Architect agent in the last 7 days
that relate to state management" requires parsing YAML, filtering by multiple criteria, and
sorting. In a database, this is a single SQL query. In files, it is a script.

**Large datasets.** A 322-entry session decision chain is manageable in YAML. A 100,000-entry
event log is not. YAML parsing has O(n) cost on file size, and the entire file must be
loaded into memory to append a single entry. Databases handle this with indexes and
streaming reads.

**Schema enforcement.** Files have no built-in schema validation. A YAML file accepts
any structure, including malformed or incomplete records. The backlog CLI enforces schema
at the application level, but a direct file edit can introduce invalid data. Databases
enforce schemas at the storage level.

**Relational data.** When events reference decisions that reference tasks that reference
agents, the relationships are expressed through backreference strings that must be resolved
by reading multiple files. A relational database handles this with joins.

> **AGENTIC GROUNDING:** The decision to use files is defensible for this project's
> constraints. The mistake - common in agent engineering - is to either dismiss files as
> "not a real database" (losing their genuine advantages) or to use them past their
> effective range (suffering their genuine limitations). The working set concept applies:
> what is the minimum state infrastructure for correct operation? For a single-operator
> project with version control, files are sufficient. For a multi-user SaaS product,
> they are not. The answer depends on the requirements, not on framework conventions.

> **FIELD VS NOVEL:** File-based configuration management is well-established (/etc/ on
> Unix, Kubernetes ConfigMaps, Terraform state files). Version-controlled configuration
> is standard DevOps practice (GitOps, Weaveworks 2017). The novel contribution here is
> using file-based state as the primary runtime state store for an AI agent system, with
> explicit recognition of the filesystem as a state management architecture rather than
> a workaround. The boot sequence (AGENTS.md loaded at session start) is structurally
> identical to checkpoint recovery in database systems, but applied to LLM context
> windows.

---

## 4. State Categories

*Estimated time: 30 minutes*

Not all state is equal. Different categories of state have different lifetimes,
different persistence requirements, and different costs of loss. The framework below
provides a structured way to think about what to persist and what to let die.

### 4.1 Ephemeral state: within a single LLM call

Ephemeral state exists only during a single inference call to the model. It includes:

- The tokens currently in the context window
- The model's internal attention patterns (L2 - invisible, immeasurable)
- Intermediate reasoning tokens (L4 - observable at L12 through reasoning traces, but
  not persisted by the API)
- The model's "working memory" of the current task

Ephemeral state has a unique property: **it cannot be persisted because it cannot be
fully captured.** You can record the input tokens and the output tokens, but you cannot
record the attention patterns or intermediate computations that produced the output. The
model's "understanding" of the context is not serializable.

What you can do is persist the inputs and outputs, and that is usually sufficient. If
you need to reproduce a result, replay the same input to the same model (accepting that
non-determinism means you may get a different output).

**Never attempt to persist ephemeral state directly.** Instead, persist the decisions
and outputs that result from processing ephemeral state.

```python
# Ephemeral state: exists only during this function call
def process_with_llm(prompt: str, context: str) -> str:
  """The model's internal state during this call is ephemeral.

  We cannot capture attention patterns or intermediate reasoning.
  We CAN capture the input and output.
  """
  # These are the persistable artifacts of ephemeral processing
  input_record = {"prompt": prompt, "context_length": len(context)}
  response = call_llm(prompt, context)
  output_record = {"response": response, "tokens_used": count_tokens(response)}

  # The model's "understanding" during processing is gone.
  # Only the input/output records survive.
  return response
```

### 4.2 Session state: within a single conversation or task

Session state accumulates during an interaction and persists across multiple LLM calls
within that session. It is the state that makes a conversation coherent: each message
builds on the previous ones.

Session state includes:

- Conversation history (the full message sequence)
- Tool call results accumulated during the session
- Intermediate computations and analysis results
- Decisions made during the session and their rationale
- Files read, commands executed, observations recorded

Session state is volatile by default. When the session ends - whether gracefully (user
closes the chat) or ungracefully (network timeout, token limit, crash) - it is gone
unless explicitly persisted.

The critical engineering question: **is the cost of losing this session state acceptable?**

For a 5-minute interaction: probably yes. Redo the work.
For a 3-hour debugging session with 15 intermediate findings: probably no.

If the answer is "no," you have two options:

1. **Persist session state to durable storage** - write conversation history, decisions,
   and intermediate results to a file or database. This is what OpenAI's Conversations
   API and similar services provide as managed infrastructure.

2. **Structure the work to produce durable artifacts frequently** - instead of one long
   session, produce intermediate outputs (files, commits, reports) that survive session
   death. This is the project's approach: the standing order "write to durable file, not
   context only" (SD-266) ensures that decisions are persisted as they are made, not
   batched until session end.

```python
# Session state with optional persistence
import json
import os
from datetime import datetime

class AgentSession:
  """Manages state for a single agent session.

  Can optionally persist to disk for crash recovery.
  """

  def __init__(self, session_id: str, persist_path: str | None = None):
    self.session_id = session_id
    self.persist_path = persist_path
    self.messages: list[dict] = []
    self.tool_results: list[dict] = []
    self.decisions: list[dict] = []
    self.started_at = datetime.utcnow().isoformat()

  def add_message(self, role: str, content: str) -> None:
    self.messages.append({
      "role": role,
      "content": content,
      "timestamp": datetime.utcnow().isoformat()
    })
    self._maybe_persist()

  def record_decision(self, decision: str, rationale: str) -> None:
    self.decisions.append({
      "decision": decision,
      "rationale": rationale,
      "timestamp": datetime.utcnow().isoformat(),
      "message_index": len(self.messages) - 1
    })
    self._maybe_persist()  # SD-266: persist immediately

  def _maybe_persist(self) -> None:
    """If a persist path is configured, write state to disk.

    This is the SD-266 pattern: write to durable file, not
    context only. If the session dies, the next session can
    read this file and recover.
    """
    if self.persist_path is None:
      return

    state = {
      "session_id": self.session_id,
      "started_at": self.started_at,
      "messages": self.messages,
      "decisions": self.decisions,
      "tool_results": self.tool_results,
      "persisted_at": datetime.utcnow().isoformat()
    }

    # Atomic write: temp file + rename (Bootcamp I Step 3)
    import tempfile
    dir_name = os.path.dirname(os.path.abspath(self.persist_path))
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix=".session.")
    try:
      with os.fdopen(fd, "w") as f:
        json.dump(state, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
      os.replace(tmp_path, self.persist_path)
    except Exception:
      os.unlink(tmp_path)
      raise

  @classmethod
  def recover(cls, persist_path: str) -> "AgentSession":
    """Recover a session from a persisted state file.

    Checkpoint recovery: navigate from last known position.
    """
    with open(persist_path) as f:
      state = json.load(f)

    session = cls(state["session_id"], persist_path)
    session.messages = state["messages"]
    session.decisions = state["decisions"]
    session.tool_results = state.get("tool_results", [])
    session.started_at = state["started_at"]
    return session
```

### 4.3 Persistent state: across session boundaries

Persistent state is the information that must survive not just session death but also
system restarts, deployments, and potentially hardware failure. It is the long-term
memory of the system.

Examples:

- **User preferences:** Display settings, notification preferences, language choices.
  Simple key-value pairs that change infrequently.
- **Accumulated knowledge:** What the agent has learned about a codebase, a user's
  coding style, common error patterns. Grows over time.
- **Decision history:** What was decided, when, why, and by which agent. The project's
  session-decisions chain is a pure example: 322 numbered decisions forming an
  immutable, append-only record.
- **Task state:** Progress on ongoing work. What has been completed, what is blocked,
  what is next.

Persistent state requires:

1. **A schema.** Even if the storage format is flexible (JSON, YAML), the application
   must enforce structural expectations. "Any valid JSON" is not a schema.
2. **A migration strategy.** Schema version 1 has 5 fields. Version 2 adds 2 fields
   and renames 1. What happens to existing records?
3. **A backup strategy.** Persistent state is, by definition, valuable enough to keep.
   It must be protected against loss.
4. **An access pattern analysis.** Is the state read-heavy or write-heavy? Queried by
   time range, by category, by agent? The access pattern determines the right backend.

> **AGENTIC GROUNDING:** Session-boundary amnesia is a named failure mode: at session
> start, the LLM loses not just facts but calibration. The caution from previous
> corrections, the felt sense of where the operator's red lines are, all reset. Persistent
> state cannot fully solve this (you cannot persist calibration), but it can provide the
> factual foundation that the new session builds calibration from. This is why the
> project's AGENTS.md includes not just facts but behavioral constraints (standing orders,
> anti-pattern taxonomy) - they are an attempt to persist calibration as explicit rules.

---

## 5. The Durable Write as Policy

*Estimated time: 25 minutes*

SD-266 is a standing order in this project: "write to durable file, not context only."
It is classified as permanent - it persists across all sessions, obeyed without
restatement. This section explains why a state management practice became a governance
policy.

### 5.1 The failure mode: compaction loss

Compaction loss is what happens when decisions, analysis, or intermediate results exist
only in the context window and the context window dies. The loss is binary and total.
There is no graceful degradation:

- One moment: 200k tokens of rich context, including 45 minutes of analysis, 12
  intermediate decisions, and a nuanced understanding of the problem.
- Next moment: zero tokens. The session is gone. Recovery tokens only.

There is no "session restore" button. The model does not have a saved state that can be
loaded. The context window is volatile memory with no swap file.

Traditional systems have analogues but with softer failure modes. A web application
losing its session store is painful but recoverable - the user re-authenticates, and
their persistent data is still in the database. A process crash loses in-memory state
but the operating system can generate a core dump. An agent losing its context window
has no core dump, no session cookie, no persistent backing store - unless one was
explicitly built.

### 5.2 The write-ahead log pattern

SD-266 is the write-ahead log (WAL) pattern applied to agent state.

In database systems, the WAL principle is: "changes to data files must be written only
after those changes have been logged, that is, after WAL records describing the changes
have been flushed to permanent storage" (PostgreSQL documentation). The log is written
first; the actual data modification follows. If the system crashes between log write
and data modification, the database recovers by replaying the log.

Applied to agent state, the principle becomes: **write the decision to durable storage
before acting on it.** If the context window dies after the durable write but before the
action completes, the next session can read the decision and resume.

```python
# The WAL pattern applied to agent decisions
import json
import os
import tempfile
from datetime import datetime

class DurableDecisionLog:
  """Write-ahead log for agent decisions.

  Every decision is written to disk BEFORE the agent acts on it.
  If the session dies mid-action, the next session reads the log
  and knows what was decided.
  """

  def __init__(self, log_path: str):
    self.log_path = log_path
    self._ensure_file()

  def _ensure_file(self) -> None:
    if not os.path.exists(self.log_path):
      with open(self.log_path, "w") as f:
        json.dump({"decisions": []}, f)

  def write_decision(self, decision: str, rationale: str,
                     planned_action: str) -> int:
    """Write decision to log BEFORE acting.

    Returns decision ID for cross-referencing.

    The sequence:
    1. Write decision to durable storage (this method)
    2. Act on the decision (caller's responsibility)
    3. Write outcome to durable storage (record_outcome)

    If the session dies between 1 and 2: next session sees
    the decision but no outcome. It knows to resume.

    If the session dies between 2 and 3: next session sees
    the decision but no outcome. It checks if the action
    actually happened (verify, don't infer).
    """
    with open(self.log_path) as f:
      log = json.load(f)

    decision_id = len(log["decisions"]) + 1
    log["decisions"].append({
      "id": decision_id,
      "timestamp": datetime.utcnow().isoformat(),
      "decision": decision,
      "rationale": rationale,
      "planned_action": planned_action,
      "outcome": None  # Filled in after action completes
    })

    # Atomic write (Bootcamp I Step 3 pattern)
    dir_name = os.path.dirname(os.path.abspath(self.log_path))
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix=".decision.")
    try:
      with os.fdopen(fd, "w") as f:
        json.dump(log, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
      os.replace(tmp_path, self.log_path)
    except Exception:
      os.unlink(tmp_path)
      raise

    return decision_id

  def record_outcome(self, decision_id: int, outcome: str) -> None:
    """Record the outcome of a previously logged decision."""
    with open(self.log_path) as f:
      log = json.load(f)

    for d in log["decisions"]:
      if d["id"] == decision_id:
        d["outcome"] = outcome
        d["completed_at"] = datetime.utcnow().isoformat()
        break

    dir_name = os.path.dirname(os.path.abspath(self.log_path))
    fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix=".decision.")
    try:
      with os.fdopen(fd, "w") as f:
        json.dump(log, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
      os.replace(tmp_path, self.log_path)
    except Exception:
      os.unlink(tmp_path)
      raise

  def get_incomplete_decisions(self) -> list[dict]:
    """Find decisions that were logged but never completed.

    These are the decisions where the session died between
    'decide' and 'act' (or between 'act' and 'record outcome').
    The checkpoint recovery protocol processes these.
    """
    with open(self.log_path) as f:
      log = json.load(f)
    return [d for d in log["decisions"] if d["outcome"] is None]
```

### 5.3 The policy in practice

SD-266 is not a suggestion. It is enforced through project culture and agent instructions:

- Every agent's role file includes standing orders, which include SD-266.
- The AGENTS.md boot sequence repeats it in the standing orders section.
- The catch-log.tsv records instances where the control fires - when a reviewer
  notices that a decision was made in context but not written to a durable file.

The practical discipline:

1. **Make a decision** - "We should use approach A because of X, Y, Z."
2. **Write it down** - append to session-decisions, update AGENTS.md, log to events.yaml.
3. **Then act** - implement the decision.

Not "act, then write it down later." Not "write it down at the end of the session."
Write first, act second. The write is the commit point.

This mirrors database WAL semantics exactly. The log entry is the source of truth. The
actual state change (the agent's action) is derived from the log. If there is a conflict
between what the log says and what was actually done, the log wins and the action is
replayed.

> **FIELD VS NOVEL:** Write-ahead logging is a foundational database concept (Gray and
> Reuter, "Transaction Processing," 1992; PostgreSQL WAL documentation; SQLite WAL mode).
> The novel application is treating LLM context window death as equivalent to a database
> crash, and applying WAL semantics to agent decision-making. SD-266 is not a borrowed
> metaphor - it is a direct application of crash recovery theory to a system where
> crashes (context window death) are not exceptional events but routine operational
> occurrences.

---

## 6. State Backends

*Estimated time: 45 minutes*

This section covers four state backends: files, SQLite, Redis, and PostgreSQL. For each:
what it is, when it is the right choice, what it costs, and how to use it for agent
state. The goal is not to teach database administration but to give you enough
understanding to make informed backend choices.

### 6.1 Files

You have already seen the project's file-based state in detail (Section 3). Here is the
summary comparison table:

| Property | Files |
|----------|-------|
| Query capability | grep, awk, jq, custom scripts |
| Concurrency | flock (advisory, single-host) |
| Schema enforcement | Application-level only |
| Versioning | Git (free, automatic with discipline) |
| Human readability | Native (text formats) |
| Deployment | Zero - files exist on the filesystem |
| Backup | Git push, rsync, cp |
| Max practical size | ~10k records (YAML), ~100k records (TSV/CSV) |
| Best for | Single-operator, version-controlled, human-audited systems |

**Practical file-based state with Python:**

```python
import json
import yaml
import csv
import os
import tempfile
from pathlib import Path

class FileStateStore:
  """State store using the filesystem.

  Uses atomic writes (temp + rename) for safety.
  Uses file locking for concurrent access.
  Supports JSON, YAML, and TSV formats.
  """

  def __init__(self, base_dir: str):
    self.base_dir = Path(base_dir)
    self.base_dir.mkdir(parents=True, exist_ok=True)

  def read_json(self, name: str) -> dict:
    path = self.base_dir / f"{name}.json"
    if not path.exists():
      return {}
    with open(path) as f:
      return json.load(f)

  def write_json(self, name: str, data: dict) -> None:
    """Atomic write: temp file + rename."""
    path = self.base_dir / f"{name}.json"
    fd, tmp = tempfile.mkstemp(dir=self.base_dir, prefix=".tmp.")
    try:
      with os.fdopen(fd, "w") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
      os.replace(tmp, str(path))
    except Exception:
      os.unlink(tmp)
      raise

  def append_tsv(self, name: str, row: list[str]) -> None:
    """Append a row to a TSV file. Suitable for log-style data."""
    path = self.base_dir / f"{name}.tsv"
    with open(path, "a") as f:
      f.write("\t".join(str(field) for field in row) + "\n")
      f.flush()
      os.fsync(f.fileno())

  def read_yaml(self, name: str) -> dict:
    path = self.base_dir / f"{name}.yaml"
    if not path.exists():
      return {}
    with open(path) as f:
      return yaml.safe_load(f) or {}

  def write_yaml(self, name: str, data: dict) -> None:
    """Atomic write for YAML."""
    path = self.base_dir / f"{name}.yaml"
    fd, tmp = tempfile.mkstemp(dir=self.base_dir, prefix=".tmp.")
    try:
      with os.fdopen(fd, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        f.flush()
        os.fsync(f.fileno())
      os.replace(tmp, str(path))
    except Exception:
      os.unlink(tmp)
      raise
```

### 6.2 SQLite

SQLite is a self-contained, serverless, zero-configuration SQL database engine. It stores
the entire database in a single file. For agent state management, it occupies a sweet spot:
more structured than files, simpler than a database server.

| Property | SQLite |
|----------|--------|
| Query capability | Full SQL |
| Concurrency | WAL mode: concurrent reads, serialized writes |
| Schema enforcement | SQL types + CHECK constraints + foreign keys |
| Versioning | Not built-in (file-level git possible but diffs are binary) |
| Human readability | Requires sqlite3 CLI or library |
| Deployment | Zero - single file, library linked into application |
| Backup | Copy file, or `.backup` command |
| Max practical size | Terabytes (practical limit is usually query complexity) |
| Best for | Structured agent state, queryable history, single-host |

**WAL mode** is critical for agent state. In the default rollback journal mode, a writer
blocks all readers and readers block writers. In WAL mode, readers do not block writers
and writers do not block readers. Multiple concurrent reads can proceed while a write
is in progress. This matters when one process writes agent state while another process
reads it for monitoring.

```python
import sqlite3
from datetime import datetime
from contextlib import contextmanager

class SQLiteAgentState:
  """Agent state backed by SQLite with WAL mode.

  WAL mode enables concurrent reads during writes.
  Schema is enforced at the database level.
  Queries are SQL - no custom parsing required.
  """

  def __init__(self, db_path: str):
    self.db_path = db_path
    self.conn = sqlite3.connect(db_path)
    self.conn.execute("PRAGMA journal_mode=WAL")
    self.conn.execute("PRAGMA foreign_keys=ON")
    self._ensure_schema()

  def _ensure_schema(self) -> None:
    self.conn.executescript("""
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'completed', 'crashed'))
      );

      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL REFERENCES sessions(session_id),
        timestamp TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT NOT NULL,
        outcome TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        agent TEXT NOT NULL,
        summary TEXT NOT NULL,
        metadata TEXT  -- JSON blob for flexible additional data
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_session
        ON decisions(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_type
        ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp
        ON events(timestamp);
    """)
    self.conn.commit()

  def start_session(self, session_id: str) -> None:
    self.conn.execute(
      "INSERT INTO sessions (session_id, started_at) VALUES (?, ?)",
      (session_id, datetime.utcnow().isoformat())
    )
    self.conn.commit()

  def record_decision(self, session_id: str, decision: str,
                      rationale: str) -> int:
    cursor = self.conn.execute(
      "INSERT INTO decisions (session_id, timestamp, decision, rationale) "
      "VALUES (?, ?, ?, ?)",
      (session_id, datetime.utcnow().isoformat(), decision, rationale)
    )
    self.conn.commit()
    return cursor.lastrowid

  def get_decisions_by_session(self, session_id: str) -> list[dict]:
    cursor = self.conn.execute(
      "SELECT id, timestamp, decision, rationale, outcome "
      "FROM decisions WHERE session_id = ? ORDER BY id",
      (session_id,)
    )
    return [
      {"id": r[0], "timestamp": r[1], "decision": r[2],
       "rationale": r[3], "outcome": r[4]}
      for r in cursor.fetchall()
    ]

  def get_incomplete_decisions(self) -> list[dict]:
    """Find decisions without outcomes - for checkpoint recovery."""
    cursor = self.conn.execute(
      "SELECT d.id, d.session_id, d.timestamp, d.decision, d.rationale "
      "FROM decisions d "
      "JOIN sessions s ON d.session_id = s.session_id "
      "WHERE d.outcome IS NULL "
      "ORDER BY d.timestamp"
    )
    return [
      {"id": r[0], "session_id": r[1], "timestamp": r[2],
       "decision": r[3], "rationale": r[4]}
      for r in cursor.fetchall()
    ]

  def get_events_in_range(self, start: str, end: str,
                          event_type: str | None = None) -> list[dict]:
    """Query events by time range and optional type.

    This query would require parsing an entire YAML file
    with file-based state. With SQLite, it uses an index.
    """
    if event_type:
      cursor = self.conn.execute(
        "SELECT timestamp, event_type, agent, summary "
        "FROM events "
        "WHERE timestamp BETWEEN ? AND ? AND event_type = ? "
        "ORDER BY timestamp",
        (start, end, event_type)
      )
    else:
      cursor = self.conn.execute(
        "SELECT timestamp, event_type, agent, summary "
        "FROM events WHERE timestamp BETWEEN ? AND ? "
        "ORDER BY timestamp",
        (start, end)
      )
    return [
      {"timestamp": r[0], "type": r[1], "agent": r[2], "summary": r[3]}
      for r in cursor.fetchall()
    ]
```

**When to choose SQLite over files:**

- You need to query state by multiple criteria (date ranges, agent names, status)
- Your state has relational structure (decisions reference sessions, events reference
  agents)
- You need concurrent read access while writing (WAL mode)
- Your state volume exceeds what YAML/JSON handles comfortably (~10k records)
- You want schema enforcement at the storage level

**When files are still better:**

- You need version-controlled diffs of state changes
- Human readability without tooling is a requirement
- The state is small and access patterns are simple (read-all, append)
- You want `git checkout` as your recovery mechanism

### 6.3 Redis

Redis is an in-memory data store with optional persistence. For agent state, it fills a
specific niche: fast shared state between processes with built-in expiry.

| Property | Redis |
|----------|-------|
| Query capability | Key-based, data structure operations, Lua scripting |
| Concurrency | Single-threaded command execution (no locks needed) |
| Schema enforcement | None (application-level) |
| Versioning | None |
| Human readability | CLI inspection (`redis-cli`) |
| Deployment | Requires running server |
| Backup | RDB snapshots, AOF (append-only file) |
| Max practical size | Limited by RAM |
| Best for | Session state, shared inter-process state, TTL-based expiry |

Redis excels at session state because of TTL (time-to-live). You can set state that
automatically expires:

```python
# Conceptual Redis usage for agent session state
# Requires: redis server running, redis-py installed
import redis
import json
from datetime import datetime

class RedisSessionState:
  """Session state backed by Redis.

  Key advantage: TTL-based automatic expiry.
  Session state expires when the session is over.
  No cleanup required.
  """

  def __init__(self, redis_url: str = "redis://localhost:6379"):
    self.r = redis.from_url(redis_url)

  def create_session(self, session_id: str,
                     ttl_seconds: int = 3600) -> None:
    """Create a session with automatic expiry.

    After ttl_seconds, the entire session state is
    automatically deleted. No cleanup code needed.
    """
    key = f"session:{session_id}"
    self.r.hset(key, mapping={
      "started_at": datetime.utcnow().isoformat(),
      "status": "active",
      "message_count": "0"
    })
    self.r.expire(key, ttl_seconds)

  def add_message(self, session_id: str, role: str,
                  content: str) -> None:
    """Add a message to the session's conversation history.

    Uses a Redis list for ordered message storage.
    TTL is inherited from the session key.
    """
    msg = json.dumps({
      "role": role,
      "content": content,
      "timestamp": datetime.utcnow().isoformat()
    })
    list_key = f"session:{session_id}:messages"
    self.r.rpush(list_key, msg)
    # Set TTL on the message list too
    self.r.expire(list_key, 3600)

    # Increment message count
    self.r.hincrby(f"session:{session_id}", "message_count", 1)

  def get_recent_messages(self, session_id: str,
                          count: int = 10) -> list[dict]:
    """Get the most recent messages from the session."""
    list_key = f"session:{session_id}:messages"
    raw = self.r.lrange(list_key, -count, -1)
    return [json.loads(msg) for msg in raw]

  def record_decision(self, session_id: str, decision: str,
                      rationale: str) -> None:
    """Record a decision in a Redis stream.

    Redis Streams are an append-only log data structure -
    structurally similar to event sourcing.
    """
    self.r.xadd(
      f"decisions:{session_id}",
      {
        "decision": decision,
        "rationale": rationale,
        "timestamp": datetime.utcnow().isoformat()
      }
    )
```

**Redis Streams** deserve specific attention for agent state. A Redis Stream is an
append-only log with consumer groups - structurally identical to an event sourcing
pattern. Multiple consumers can read from the same stream independently, each tracking
their own position. This is useful when multiple agent processes need to react to the
same events.

**When to choose Redis:**

- Session state that should auto-expire (TTL)
- Shared state between multiple agent processes on the same or different hosts
- High-frequency reads and writes (Redis operates in-memory - sub-millisecond latency)
- Pub/sub patterns (one agent publishes events, others subscribe)

**When Redis is wrong:**

- Long-term persistent state (Redis is ephemeral by default; AOF persistence exists but
  is not its strength)
- Complex relational queries (Redis is key-based, not relational)
- State that must survive server restarts without configuration (requires explicit
  persistence setup)
- When you do not want to operate a server (SQLite and files require no server)

**Licensing note (as of 2026):** Redis changed from BSD to dual SSPL/RSAL in 2024.
Valkey (Linux Foundation fork) is an API-compatible alternative under BSD. The technical
patterns are identical across both.

### 6.4 PostgreSQL

PostgreSQL is a full relational database with ACID transactions, advanced data types,
and an extension ecosystem. For agent state, it is the enterprise-grade option.

| Property | PostgreSQL |
|----------|-----------|
| Query capability | Full SQL, JSON operators, full-text search, pgvector |
| Concurrency | MVCC (multi-version concurrency control) - readers never block writers |
| Schema enforcement | Strong - types, constraints, foreign keys, check constraints |
| Versioning | None built-in (audit triggers possible) |
| Human readability | psql CLI, pgAdmin, any SQL client |
| Deployment | Requires server (managed options: Neon, Supabase, RDS) |
| Backup | pg_dump, WAL archiving, point-in-time recovery |
| Max practical size | Petabytes |
| Best for | Multi-user systems, complex queries, production agent platforms |

PostgreSQL's relevance to agent state extends beyond basic CRUD through two features:

**JSONB columns** for flexible state alongside structured data:

```sql
-- Agent state table with structured + flexible columns
CREATE TABLE agent_state (
  agent_id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Structured fields (schema-enforced)
  status TEXT NOT NULL DEFAULT 'idle'
    CHECK (status IN ('idle', 'active', 'blocked', 'error')),
  current_task_id TEXT REFERENCES tasks(task_id),

  -- Flexible fields (schema-flexible)
  config JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'
);

-- Query into JSONB: find agents configured for a specific model
SELECT agent_id, config->>'model' AS model
FROM agent_state
WHERE config->>'model' LIKE 'claude%'
  AND status = 'active';
```

**pgvector** for storing embeddings alongside relational data:

```sql
-- If your agent state includes embeddings (Step 2 covers these),
-- pgvector stores them in the same database as your relational data.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE agent_knowledge (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_state(agent_id),
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI text-embedding-3-small dimension
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Semantic search: find knowledge similar to a query
SELECT content, source,
       1 - (embedding <=> $1::vector) AS similarity
FROM agent_knowledge
WHERE agent_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

**When to choose PostgreSQL:**

- Multi-user agent platforms (multiple users, multiple agents, shared state)
- Complex queries across relational data (decisions referencing tasks referencing users)
- You need embeddings and relational data in the same store (pgvector)
- ACID transactions are required (financial data, compliance-sensitive state)
- You already have PostgreSQL infrastructure (adding a schema is cheaper than adding a
  new system)

**When PostgreSQL is overkill:**

- Single-agent, single-user systems
- Prototyping and experimentation
- When the total state fits in a single file
- When you do not want to operate (or pay for) a database server

### 6.5 Choosing a backend

The decision is not about which backend is "best." It is about which backend matches
your requirements with the least unnecessary complexity.

| Requirement | Files | SQLite | Redis | PostgreSQL |
|-------------|-------|--------|-------|-----------|
| Zero deployment | Yes | Yes | No | No |
| Version-controlled diffs | Yes | No | No | No |
| Human-readable without tools | Yes | No | Partially | No |
| SQL queries | No | Yes | No | Yes |
| Concurrent multi-process | flock | WAL | Native | MVCC |
| TTL/auto-expiry | No | No | Native | Trigger-based |
| Distributed access | No | No | Yes | Yes |
| Embedding storage | No | No | No | pgvector |
| Schema enforcement | No | SQL | No | SQL |

Decision heuristic:

1. **Start with files** if you have no concurrent writes, no complex queries, and value
   version-controlled diffs.
2. **Move to SQLite** when you need queries, schema enforcement, or concurrent reads.
3. **Add Redis** when you need shared state between processes, TTL-based expiry, or
   pub/sub.
4. **Use PostgreSQL** when you need relational integrity, complex queries, multi-user
   access, or embeddings in the same store.

You can mix backends. The project uses files for most state but could add SQLite for
queryable event logs or Redis for inter-agent coordination without replacing the
file-based architecture. State backends are composable, not exclusive.

> **AGENTIC GROUNDING:** Many agent frameworks default to PostgreSQL or Redis for all
> state, even when the agent is a single-user prototype. This is premature optimization:
> it adds deployment complexity (database server), operational burden (backups,
> monitoring, upgrades), and debugging friction (state is not in version control, not
> diffable, not human-readable by default). Start with the simplest backend that meets
> your actual requirements, and migrate when the requirements change. The migration path
> is well-trodden: files to SQLite to PostgreSQL is a common progression, and each step
> adds capability without discarding the previous layer's data.

---

## 7. State Schema Design

*Estimated time: 30 minutes*

Choosing a backend is necessary but not sufficient. You also need to decide what to
persist. This is the state schema design problem, and getting it wrong is expensive in
both directions: persisting too much creates noise and storage costs; persisting too
little creates amnesia.

### 7.1 The working set applied to state

The working set concept (Denning 1968, applied to LLM context in this project) transfers
directly to state design. The working set for context is the minimum set of tokens
needed for correct model output. The working set for state is the minimum set of
persisted data needed for correct agent behavior.

Questions to determine the state working set:

1. **If the agent starts a new session with this state, can it produce correct output?**
   If yes, the state working set is sufficient. If no, something is missing.

2. **If I remove this piece of state, does the agent's behavior change?** If yes, it is
   part of the working set. If no, it is noise.

3. **Does this state ever get read?** If no process ever reads a piece of persisted
   state, it is dead weight. Persist only what you consume.

4. **At what frequency does this state change?** State that changes every second needs
   a different persistence strategy than state that changes every week.

### 7.2 What to persist

**Always persist:**

- **Decisions and their rationale.** If an agent decided to use approach A over B, the
  next session needs to know this. Without it, the agent may re-evaluate the same
  question and reach a different conclusion, creating inconsistency.
- **Task state and progress.** What has been done, what remains, what is blocked. Without
  this, work is repeated.
- **Configuration and preferences.** How the system should behave. Without this, defaults
  are applied every session.
- **Error history.** What went wrong and what was done about it. Without this, the same
  errors are encountered and re-diagnosed.

**Persist selectively:**

- **Conversation history.** Full message transcripts are expensive to store and to load
  into context. Persist summaries or key messages, not every turn. Step 6 covers memory
  summarization in detail.
- **Tool call results.** The output of a file read or command execution is ephemeral by
  nature - the file or system state may have changed. Persisting the result creates
  stale reference propagation risk. Persist the fact that the tool was called, not
  necessarily the full result.
- **Intermediate computations.** Analysis results, draft plans, exploratory reasoning.
  Persist if the computation was expensive to produce. Let die if it was cheap to
  reproduce.

**Let die:**

- **Model-internal state.** Attention patterns, token probabilities, intermediate
  reasoning steps. These cannot be captured and are not reproducible.
- **Transient operational state.** "I am currently reading file X" - this is meaningful
  only during the current operation and should not be persisted.
- **Duplicate information.** If the source of truth is elsewhere (a git repository, an
  API), do not duplicate it in your state store. Reference it instead.

### 7.3 Schema versioning

State schemas evolve. Version 1 has 5 fields. Version 2 adds 2 fields, renames 1, and
removes 1. What happens to existing data?

Three strategies:

**Strategy 1: Migration scripts (database pattern)**

Write explicit migration scripts that transform old data to the new schema. This is
standard practice in web applications (Rails migrations, Alembic for SQLAlchemy,
Drizzle migrations).

```python
# Schema migration example
def migrate_v1_to_v2(db: sqlite3.Connection) -> None:
  """Migrate state schema from v1 to v2.

  Changes:
  - Add 'priority' column to decisions (default: 'normal')
  - Rename 'outcome' to 'result' (SQLite requires table rebuild)
  - Add 'tags' column (JSON array, default: '[]')
  """
  db.executescript("""
    -- Add new columns with defaults
    ALTER TABLE decisions ADD COLUMN priority TEXT
      NOT NULL DEFAULT 'normal';
    ALTER TABLE decisions ADD COLUMN tags TEXT
      NOT NULL DEFAULT '[]';

    -- SQLite does not support RENAME COLUMN before 3.25.0
    -- For older versions, rebuild the table:
    -- CREATE TABLE decisions_new (...);
    -- INSERT INTO decisions_new SELECT ... FROM decisions;
    -- DROP TABLE decisions;
    -- ALTER TABLE decisions_new RENAME TO decisions;

    -- For SQLite 3.25.0+:
    ALTER TABLE decisions RENAME COLUMN outcome TO result;

    -- Record migration
    INSERT INTO schema_migrations (version, applied_at)
    VALUES (2, datetime('now'));
  """)
  db.commit()
```

**Strategy 2: Tolerant reader (file-based pattern)**

Do not migrate. Instead, write code that reads any version and fills in missing fields
with defaults.

```python
# Tolerant reader: handles any schema version
def read_decision(raw: dict) -> dict:
  """Read a decision record, tolerating any schema version.

  Missing fields get defaults. Unknown fields are preserved.
  No migration required - old and new records coexist.
  """
  return {
    "id": raw.get("id", 0),
    "timestamp": raw.get("timestamp", "unknown"),
    "decision": raw.get("decision", ""),
    "rationale": raw.get("rationale", ""),
    # v2 fields with defaults
    "result": raw.get("result", raw.get("outcome")),  # handle rename
    "priority": raw.get("priority", "normal"),
    "tags": raw.get("tags", []),
    # Preserve any unknown fields (forward compatibility)
    **{k: v for k, v in raw.items()
       if k not in ("id", "timestamp", "decision", "rationale",
                     "outcome", "result", "priority", "tags")}
  }
```

**Strategy 3: Event sourcing (append-only pattern)**

Do not modify existing records. Write new events that describe the change. Derive
current state by replaying all events. Schema evolution becomes a matter of adding
new event types.

```python
# Event sourcing: schema evolution through new event types
events = [
  # v1 events
  {"type": "decision_made", "data": {"text": "Use approach A"}},
  {"type": "decision_outcome", "data": {"decision_id": 1, "outcome": "success"}},

  # v2 adds a new event type - no migration needed
  {"type": "decision_prioritized", "data": {"decision_id": 1, "priority": "high"}},

  # v2 renames 'outcome' to 'result' in new events
  # Old events retain 'outcome'. New events use 'result'.
  # The projection function handles both.
  {"type": "decision_result", "data": {"decision_id": 2, "result": "failed"}},
]

def project_decisions(events: list[dict]) -> dict[int, dict]:
  """Project current decision state from event stream.

  Handles both v1 and v2 event types.
  """
  decisions = {}
  for event in events:
    if event["type"] == "decision_made":
      did = len(decisions) + 1
      decisions[did] = {
        "text": event["data"]["text"],
        "result": None,
        "priority": "normal"
      }
    elif event["type"] == "decision_outcome":
      did = event["data"]["decision_id"]
      decisions[did]["result"] = event["data"]["outcome"]
    elif event["type"] == "decision_result":
      did = event["data"]["decision_id"]
      decisions[did]["result"] = event["data"]["result"]
    elif event["type"] == "decision_prioritized":
      did = event["data"]["decision_id"]
      decisions[did]["priority"] = event["data"]["priority"]
  return decisions
```

### 7.4 The stale state problem

Persisted state becomes stale the moment the reality it describes changes. This is
stale reference propagation applied to state: when a state file describes a state that
no longer exists, any process that reads it will act on the described state rather than
the actual state.

Examples:

- A state file says the current branch is `feature-x`, but someone merged and deleted it.
- A task state file says task 3 is "in progress," but the agent that was working on it
  crashed 2 hours ago.
- A configuration file references a model name that has been deprecated.

Mitigations:

1. **Timestamps on state.** Include `updated_at` fields so readers can detect staleness.
2. **Heartbeat patterns.** Agents periodically update a timestamp to prove they are alive.
   State not updated within the heartbeat interval is suspect.
3. **Verify, don't infer.** The engineering loop principle. Before acting on persisted
   state, verify it against the actual system. "The state file says the branch exists"
   is not the same as "the branch exists" - run `git branch` to confirm.

> **AGENTIC GROUNDING:** Stale reference propagation is not hypothetical. In this
> project's pilot study, a clean-session agent booted from a stale AGENTS.md and
> confidently reported "13-layer harness model" and "Lexicon at v0.17" - both were
> outdated. The agent did not hallucinate these facts. It read them from a file that
> described a state that no longer existed. This is a state management failure, not a
> model failure.

> **FIELD VS NOVEL:** Schema migration (Rails migrations, Flyway, Alembic) and the
> tolerant reader pattern (Postel's Law applied to data formats) are well-established.
> Event sourcing for schema evolution is documented by Fowler (2005) and practiced in
> CQRS/ES systems. The novel contribution is applying the working set concept to state
> schema design: rather than asking "what should I persist?" (unbounded), ask "what is
> the minimum state for correct agent behavior?" This reframes state design as a
> constraint satisfaction problem rather than a feature wish list.

---

## 8. Concurrency and State

*Estimated time: 40 minutes*

When multiple agents, processes, or requests access shared state simultaneously,
coordination is required. Without it, the results range from inconsistent reads to
corrupted data. This section covers three coordination strategies in order of
complexity.

### 8.1 File locking (flock)

Bootcamp I Step 3 Section 9 covered file locking with `flock(2)`. The project's
`.keel-state` file uses this pattern: `fcntl.flock` for atomic read-modify-write.

The mechanism:

1. Open a lock file (or the data file itself).
2. Acquire an exclusive lock (`LOCK_EX`). This blocks if another process holds the lock.
3. Read the current state.
4. Compute new state.
5. Write new state atomically (temp + rename).
6. Release the lock.

```python
import fcntl
import json
import os
import tempfile
from contextlib import contextmanager

@contextmanager
def locked_state(state_path: str):
  """Read-modify-write with file locking.

  This is the pattern used by .keel-state in this project.
  fcntl.flock provides advisory locking - all cooperating
  processes must use this function to access the state file.
  """
  lock_path = state_path + ".lock"
  lock_fd = open(lock_path, "w")
  try:
    # Acquire exclusive lock (blocks until available)
    fcntl.flock(lock_fd, fcntl.LOCK_EX)

    # Read current state
    if os.path.exists(state_path):
      with open(state_path) as f:
        state = json.load(f)
    else:
      state = {}

    # Yield state for modification
    yield state

    # Write modified state atomically
    dir_name = os.path.dirname(os.path.abspath(state_path))
    fd, tmp = tempfile.mkstemp(dir=dir_name, prefix=".tmp.")
    try:
      with os.fdopen(fd, "w") as f:
        json.dump(state, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
      os.replace(tmp, state_path)
    except Exception:
      os.unlink(tmp)
      raise
  finally:
    # Release lock
    fcntl.flock(lock_fd, fcntl.LOCK_UN)
    lock_fd.close()

# Usage
with locked_state("/path/to/.keel-state") as state:
  state["last_commit"] = "abc123"
  state["gate_status"] = "green"
  # State is written atomically when the context manager exits
```

**Limitations of file locking:**

- **Single-host only.** `flock` does not work across network filesystems (NFS) reliably.
  For distributed systems, use a distributed lock (Redis, ZooKeeper, etcd).
- **Advisory only.** A process that does not call `flock` can read and write the file
  freely. The lock is a cooperative protocol, not an enforcement mechanism. This is the
  paper guardrail anti-pattern if the cooperation is not enforced by code review.
- **No deadlock detection.** If process A holds lock X and waits for lock Y while process
  B holds lock Y and waits for lock X, both wait forever. Keep lock scopes small and
  never nest locks.
- **Performance.** Under contention, processes queue up waiting for the lock. If state
  updates are frequent, this serialization becomes a bottleneck.

### 8.2 Optimistic concurrency

Optimistic concurrency assumes that conflicts are rare. Instead of locking before
reading, each record carries a version number. A write succeeds only if the version
has not changed since the read.

```python
# Optimistic concurrency with version numbers
import sqlite3

class OptimisticStateStore:
  """State store with optimistic concurrency control.

  No locks held during processing. Conflicts detected at
  write time via version check.
  """

  def __init__(self, db_path: str):
    self.conn = sqlite3.connect(db_path)
    self.conn.execute("PRAGMA journal_mode=WAL")
    self.conn.execute("""
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      )
    """)
    self.conn.commit()

  def read(self, key: str) -> tuple[str, int] | None:
    """Read a value and its version number."""
    cursor = self.conn.execute(
      "SELECT value, version FROM state WHERE key = ?",
      (key,)
    )
    row = cursor.fetchone()
    if row is None:
      return None
    return row[0], row[1]

  def write(self, key: str, value: str,
            expected_version: int) -> bool:
    """Write a value only if the version matches.

    Returns True if the write succeeded, False if a conflict
    was detected (another process updated the value since
    we read it).

    The caller must handle the conflict: re-read the current
    value, recompute, and retry.
    """
    from datetime import datetime
    cursor = self.conn.execute(
      "UPDATE state SET value = ?, version = version + 1, "
      "updated_at = ? "
      "WHERE key = ? AND version = ?",
      (value, datetime.utcnow().isoformat(), key, expected_version)
    )
    self.conn.commit()

    if cursor.rowcount == 0:
      # No rows updated: either key doesn't exist or version mismatch
      return False
    return True

  def write_with_retry(self, key: str,
                       transform_fn, max_retries: int = 3) -> bool:
    """Read-transform-write with automatic retry on conflict.

    transform_fn receives the current value and returns the new value.
    On conflict, re-reads and retries.
    """
    for attempt in range(max_retries):
      result = self.read(key)
      if result is None:
        return False

      current_value, version = result
      new_value = transform_fn(current_value)

      if self.write(key, new_value, version):
        return True
      # Conflict detected - retry with fresh read

    return False  # Exhausted retries
```

**When to use optimistic concurrency:**

- Conflicts are rare (multiple agents reading the same state but usually writing to
  different keys)
- The cost of a retry is low (the transformation is cheap to recompute)
- You want higher throughput than pessimistic locking allows (no lock waiting)

**When to use pessimistic locking (flock):**

- Conflicts are frequent (multiple processes regularly updating the same key)
- The cost of a failed write is high (expensive computation that must be discarded on
  conflict)
- The critical section is very short (lock contention is minimal)

### 8.3 Event sourcing as a concurrency strategy

Event sourcing eliminates write conflicts entirely by changing the data model. Instead
of updating mutable state, processes append immutable events to a log. Current state is
derived by replaying the event log.

Why this eliminates conflicts: appends do not conflict. Two processes appending
events to the same log simultaneously produce a log with both events. The order might
vary, but neither event is lost.

```python
# Event sourcing: append-only, no write conflicts
import json
import os
import fcntl
from datetime import datetime

class EventStore:
  """Append-only event store.

  Write conflicts are impossible because appends do not conflict.
  Current state is derived by replaying events.
  """

  def __init__(self, log_path: str):
    self.log_path = log_path

  def append(self, event_type: str, data: dict,
             agent: str = "unknown") -> None:
    """Append an event to the log.

    Uses flock for append serialization (ensures events
    don't interleave within a single write), but no read
    lock is needed - readers see a consistent prefix.
    """
    event = {
      "timestamp": datetime.utcnow().isoformat(),
      "type": event_type,
      "agent": agent,
      "data": data
    }
    line = json.dumps(event) + "\n"

    with open(self.log_path, "a") as f:
      fcntl.flock(f, fcntl.LOCK_EX)
      f.write(line)
      f.flush()
      os.fsync(f.fileno())
      fcntl.flock(f, fcntl.LOCK_UN)

  def replay(self, event_filter: str | None = None) -> list[dict]:
    """Replay all events, optionally filtered by type."""
    if not os.path.exists(self.log_path):
      return []

    events = []
    with open(self.log_path) as f:
      for line in f:
        line = line.strip()
        if not line:
          continue
        event = json.loads(line)
        if event_filter is None or event["type"] == event_filter:
          events.append(event)
    return events

  def project_state(self, projector) -> dict:
    """Derive current state by replaying events through a projector.

    The projector is a function that takes (current_state, event)
    and returns new_state. This is a fold/reduce over the event log.
    """
    state = {}
    for event in self.replay():
      state = projector(state, event)
    return state


# Example projector: derive task state from events
def task_projector(state: dict, event: dict) -> dict:
  """Derive current task states from the event stream."""
  if event["type"] == "task_created":
    task_id = event["data"]["task_id"]
    state[task_id] = {
      "title": event["data"]["title"],
      "status": "open",
      "created_at": event["timestamp"],
      "agent": event["agent"]
    }
  elif event["type"] == "task_started":
    task_id = event["data"]["task_id"]
    if task_id in state:
      state[task_id]["status"] = "in_progress"
      state[task_id]["started_at"] = event["timestamp"]
  elif event["type"] == "task_completed":
    task_id = event["data"]["task_id"]
    if task_id in state:
      state[task_id]["status"] = "completed"
      state[task_id]["completed_at"] = event["timestamp"]
      state[task_id]["result"] = event["data"].get("result")
  return state

# Usage
store = EventStore("/tmp/agent-events.jsonl")

# Multiple agents can append simultaneously without conflicts
store.append("task_created", {"task_id": "T1", "title": "Review PR"}, "agent-a")
store.append("task_started", {"task_id": "T1"}, "agent-b")

# Derive current state by replay
current_tasks = store.project_state(task_projector)
```

The project's events.yaml is a simplified version of this pattern. It is append-only,
structured, and queryable. The difference from a full event sourcing system is that the
project does not derive all state from the event log - events.yaml is one state source
among several. A pure event sourcing system would derive task state, decision state, and
agent state all from a single event log.

**Trade-offs of event sourcing:**

| Advantage | Cost |
|-----------|------|
| No write conflicts | Replay cost grows with event log size |
| Complete audit trail (every change is an event) | Projecting current state is O(n) events |
| Time-travel queries (state at any point in time) | Complex projector logic for rich state |
| Natural fit for distributed systems | Event ordering in distributed systems is hard |
| Schema evolution through new event types | Event format must be stable (old events are immutable) |

For agent state, event sourcing is most valuable when:

- Multiple agents write to shared state (no locking needed)
- Audit trail is important (every state change is recorded)
- You need to understand how state evolved over time ("what changed between session 3
  and session 5?")

> **FIELD VS NOVEL:** Event sourcing is well-established (Fowler 2005, Greg Young's CQRS
> pattern, Kafka/Pulsar/EventStoreDB in production systems). File locking with flock(2)
> is POSIX standard, unchanged for decades. Optimistic concurrency is standard database
> practice (HTTP ETags, DynamoDB conditional writes, git's merge model). The novel
> contribution is recognizing that agent multi-process coordination maps directly to
> these established patterns. The `.keel-state` flock pattern is not a workaround - it
> is the same mutual exclusion strategy that databases use internally, applied at the
> application level because the state store (a file) does not provide it natively.

---

## Challenge: State Architecture Analysis

**Estimated time: 30 minutes**

**Goal:** Map every durable state file in this project. For each, identify its state
category, update pattern, and failure impact.

Create a table with these columns:

| File | State Category | Update Pattern | What It Stores | What Happens If Lost |
|------|---------------|----------------|----------------|---------------------|

Files to analyze:
- AGENTS.md
- events.yaml
- session-decisions-index.yaml
- .keel-state
- catch-log.tsv
- backlog.yaml

For each file, answer:

1. Is it boot state, event log, runtime state, or task tracking?
2. Is its update pattern append-only, read-modify-write, or full rewrite?
3. Does it use file locking? Should it?
4. What is the recovery mechanism if the file is corrupted? (Hint: git plays a role.)
5. Could this file be replaced by a SQLite table? What would you gain? What would you
   lose?

**Verification:** Your table should have 6 rows and 5 columns. For each file, you
should be able to explain why the project chose a file over a database for this
specific state, and under what conditions that choice would change.

<details>
<summary>Hints</summary>

- Read the AGENTS.md filesystem awareness section for the file catalog.
- The update pattern matters: append-only files (events.yaml, catch-log.tsv) have
  different concurrency characteristics than read-modify-write files (.keel-state).
- The recovery question is about git: `git checkout -- filename` restores the last
  committed version. But what about uncommitted changes?
- SQLite would add queryability but lose version-controlled diffs. For which files
  does that trade-off make sense?

</details>

**Extension:** Add a "Stale Risk" column. For each file, assess how quickly the state
becomes stale after reality changes, and what the consequences of acting on stale state
would be. Which files have the highest stale reference propagation risk?

---

## Challenge: Session State Implementation

**Estimated time: 30 minutes**

**Goal:** Build a simple agent that processes 5 sequential tasks, each building on the
previous result. Implement state persistence in two ways and compare.

**Setup:**

```python
# The 5 tasks - each depends on the previous result
TASKS = [
  {"id": 1, "instruction": "Generate a list of 5 random words"},
  {"id": 2, "instruction": "Sort the previous list alphabetically"},
  {"id": 3, "instruction": "Reverse each word in the sorted list"},
  {"id": 4, "instruction": "Join the reversed words with hyphens"},
  {"id": 5, "instruction": "Count the total characters in the result"},
]
```

**Part A: File-based state**

Implement `process_tasks_file(tasks, state_dir)` that:

1. For each task, reads the previous result from a JSON file
2. Processes the task (you can simulate LLM processing with simple Python)
3. Writes the result to a JSON state file
4. Can be interrupted at any point and resumed by re-running

The state files should allow crash recovery: if the process is killed after task 3,
re-running should detect that tasks 1-3 are complete and resume at task 4.

**Part B: SQLite-based state**

Implement `process_tasks_sqlite(tasks, db_path)` that does the same thing using SQLite.

Design a schema that supports:
- Tracking which tasks are complete
- Storing the result of each task
- Querying "what was the result of task N?"
- Finding incomplete tasks for crash recovery

**Comparison:**

After implementing both, answer:

1. Which was easier to implement?
2. Which handles crash recovery more cleanly?
3. Which is easier to debug (inspect state during execution)?
4. For a system with 5 tasks, which would you choose? For 500 tasks? For 50,000?

**Verification:** Both implementations should produce the same final result. Both should
handle interruption at any task boundary and resume correctly.

<details>
<summary>Hints</summary>

For file-based state, use one JSON file per task result: `task_1_result.json`,
`task_2_result.json`, etc. Checking for crash recovery is just checking which files exist.

For SQLite, the `INSERT OR IGNORE` pattern (or checking `status` column) handles
idempotent re-runs. The `get_incomplete_decisions` query from Section 6.2 is the template.

Use the atomic write pattern from Bootcamp I Step 3 for file writes.

</details>

---

## Challenge: State Schema Design

**Estimated time: 30 minutes**

**Goal:** Design a state schema for a customer service agent that handles support tickets
across multiple sessions.

**Requirements:**

The agent must:
- Remember customer history across sessions (who they are, past tickets, preferences)
- Maintain conversation context within a session (current ticket discussion)
- Track ephemeral tool state (current API call in progress, database query results)
- Handle session interruption gracefully (customer disconnects mid-conversation)

**Design the schema:**

1. **Identify state categories.** For each piece of state, classify as ephemeral,
   session, or persistent. Justify each classification.

2. **Choose backends.** Which backend(s) would you use? You may mix backends (e.g.,
   Redis for session state, PostgreSQL for persistent state).

3. **Define the schema.** Write the actual table definitions (SQL), key patterns
   (Redis), or file structures. Include:
   - Customer profile (persistent)
   - Ticket history (persistent)
   - Current conversation (session)
   - Tool call state (ephemeral)

4. **Handle session interruption.** Describe what happens when a customer disconnects
   mid-conversation. What state is preserved? What is lost? How does the next session
   resume?

5. **Handle schema evolution.** Version 2 of the agent needs to track customer sentiment
   scores. How do you add this to your schema without breaking existing data?

**Verification:** Your design should answer these questions:
- If the session crashes, can the agent resume the conversation?
- If the agent restarts, does it know who the customer is?
- If the schema changes, does existing data survive?
- If two agents handle the same customer simultaneously, is the state consistent?

<details>
<summary>Hints</summary>

A reasonable backend combination: PostgreSQL for customer profiles and ticket history
(relational, queryable, durable), Redis for active session state (TTL-based expiry,
fast reads), nothing special for ephemeral state (it lives only in the current function
call).

For the schema, think about what the next agent session needs to load into its working
set to continue the conversation. The customer's name and open ticket are necessary.
The full conversation transcript from 6 months ago probably is not.

Session interruption recovery: persist conversation state to PostgreSQL (or a
session-recovery table) at each turn, not just at session end. This is SD-266 applied
to customer conversations.

</details>

**Extension:** Add a GDPR Article 17 compliance requirement: the customer requests
erasure of their personal data. What happens to your schema? Which records can be
deleted, which must be anonymized, and which are exempt (legal obligation, legitimate
interest)? This is a genuine open problem in agent state management - there are no
established solutions for selective erasure from agent state.

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What are the three positions on the state management spectrum, and when is each the
   right choice?

2. Why is an agent's context window state fundamentally different from a web application's
   session state? What property makes the loss total rather than gradual?

3. What is SD-266 and why is it a standing order rather than a guideline?

4. Name three properties of file-based state that a database does not provide. Name
   three capabilities of a database that files do not provide.

5. What is the difference between advisory and mandatory locking? Which does `flock`
   provide, and what is the implication?

6. How does event sourcing eliminate write conflicts? What does it cost in exchange?

7. What is the working set applied to state? How does it help you decide what to persist?

8. What is stale reference propagation, and how does it manifest in state files?

9. What is the atomic write pattern (temp + rename), and why is it necessary for state
   file updates?

10. When would you choose SQLite over files? When would you choose PostgreSQL over SQLite?
    What factors determine the answer?

---

## Recommended Reading

- **Martin Fowler, "Event Sourcing" (2005).** The canonical reference for append-only
  event logs and state derivation. https://martinfowler.com/eaaDev/EventSourcing.html
  Note: still marked as draft, but the pattern has been stable for 20 years.

- **PostgreSQL WAL Documentation.** The authoritative explanation of write-ahead logging.
  https://www.postgresql.org/docs/current/wal-intro.html Read the introduction and
  the section on crash recovery.

- **SQLite WAL Mode.** How SQLite implements WAL for concurrent read/write access.
  https://www.sqlite.org/wal.html The explanation of how WAL inverts the rollback
  journal approach is particularly clear.

- **sqlite-utils (Simon Willison).** Practical SQLite library and CLI for rapid
  prototyping. https://sqlite-utils.datasette.io/en/stable/ Useful for exercises
  and for agent state prototyping.

- **flock(2) man page.** The POSIX file locking interface. Read the section on advisory
  vs mandatory locking and the note about open file descriptions vs file descriptors.
  https://man7.org/linux/man-pages/man2/flock.2.html

- **Pat Helland, "Immutability Changes Everything" (2015).** The case for append-only
  data structures in distributed systems. Applies directly to event sourcing for agent
  state.

- **Denning, P.J. (1968), "The Working Set Model for Program Behavior."** The original
  working set paper. The structural isomorphism to context window management is exact.

---

## What to Read Next

**Step 6: Conversation Memory and Session Persistence** - Step 5 covers where and how
to persist state. Step 6 covers what to persist in the specific context of conversation
memory: buffer vs summary vs window strategies, memory compression as lossy encoding,
the interaction between memory management and context window pressure, and the open
problem of selective erasure (GDPR Article 17 applied to agent memory). Step 6 builds
directly on the state backends, schema design, and durable write patterns from this step.

