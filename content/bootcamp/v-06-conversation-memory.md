+++
title = "Conversation Memory and Session Persistence"
date = "2026-03-10"
description = "Memory patterns (full, sliding window, summary, entity, retrieval-augmented). Selective forgetting."
tags = ["memory", "conversation", "persistence", "bootcamp"]
step = 6
tier = 2
estimate = "4-5 hours"
bootcamp = 5
+++

Step 6 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

Estimated total time: 4-5 hours.

**Field maturity:** Emerging/Frontier
**Prerequisites:** Step 5 (state management for agents), Step 2 (embeddings and vector search)
**Leads to:** Step 7 (observability and tracing)
**You will need:** Python 3.10+, an OpenAI API key (or sentence-transformers for local
embeddings), sqlite-utils, chromadb. See Tool Setup below.

---

## Why This Step Exists

LLMs have no memory between API calls. This sentence needs to become intuitive, not just
understood. Every call to an LLM API starts with an empty context window. The model does
not know what you discussed ten seconds ago unless you explicitly include that conversation
in the current request. "Memory" in an LLM-based system is not a property of the model.
It is a context engineering problem: what prior information do you inject into the context
window, and how do you choose it?

Step 5 established the infrastructure: where to persist state, how to write it durably,
how to read it back after failure. This step addresses a specific application of that
infrastructure - conversation memory. Step 5 answers "how do I save and load data
reliably?" Step 6 answers "which parts of a conversation history should I save, how
much should I load, and what happens when the conversation is longer than the context
window can hold?"

The problem is harder than it appears. A 20-turn conversation fits comfortably in a
128k-token context window. A 200-turn customer support interaction will not. A
multi-session agent working with a user across weeks has history measured in hundreds of
thousands of tokens. You cannot include all of it. You must choose. Every choice is
lossy, and the nature of the loss determines the nature of the agent's failures.

This is an emerging field. The memory patterns in this step represent current best
practice as of early 2026, but the API landscape is shifting. OpenAI deprecated its
Assistants API (Threads, Runs) in favour of a new Responses API and Conversations API
with a hard shutdown of August 2026. Anthropic provides no server-side conversation
management at all - its Messages API is stateless by design, with prompt caching as the
efficiency mechanism. LangChain's memory abstractions have been superseded by LangGraph
persistence. Expect the implementations to change. The patterns - buffer, window,
summary, entity, retrieval-augmented - are stable. The frameworks that implement them
are not.

By the end of this step, you will be able to design a conversation memory strategy for
an agent system: choose the right pattern, implement session persistence, evaluate
whether memory is working, handle selective forgetting, and understand episodic memory
as a mechanism for agent self-improvement.

---

## Table of Contents

1. [The Memory Problem](#1-the-memory-problem) (~20 min)
2. [Conversation Memory Patterns](#2-conversation-memory-patterns) (~50 min)
3. [Session Persistence](#3-session-persistence) (~35 min)
4. [Memory Evaluation](#4-memory-evaluation) (~25 min)
5. [The Forgetting Problem](#5-the-forgetting-problem) (~25 min)
6. [Episodic Memory and Reflexion](#6-episodic-memory-and-reflexion) (~35 min)
7. [Challenges](#challenges) (~60-90 min)
8. [Key Takeaways](#key-takeaways)
9. [Recommended Reading](#recommended-reading)
10. [What to Read Next](#what-to-read-next)

---

## Tool Setup

*This section covers installation and verification. Skip tools you already have.*

### Required

```bash
# Create a virtual environment for this step (or reuse from Step 5)
uv venv .venv-bcv06
source .venv-bcv06/bin/activate

# Core dependencies
uv pip install sqlite-utils chromadb numpy tiktoken

# Verify
python3 -c "import sqlite_utils; print(f'sqlite-utils {sqlite_utils.__version__}')"
python3 -c "import chromadb; print(f'chromadb {chromadb.__version__}')"
python3 -c "import tiktoken; print(f'tiktoken {tiktoken.__version__}')"
```

### Embedding Provider (one required)

**Option A - OpenAI embeddings (recommended for exercises):**

```bash
uv pip install openai
export OPENAI_API_KEY="sk-..."

# Verify
python3 -c "
from openai import OpenAI
client = OpenAI()
r = client.embeddings.create(input='test', model='text-embedding-3-small')
print(f'Embedding dimension: {len(r.data[0].embedding)}')
"
```

**Option B - Local embeddings (no API key needed):**

```bash
uv pip install sentence-transformers

# Verify (downloads model on first use, ~100MB)
python3 -c "
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
e = model.encode(['test'])
print(f'Embedding dimension: {e.shape[1]}')
"
```

### Optional

Exercises that involve summarisation can use any LLM API. If you have an OpenAI key,
exercises use `gpt-4o-mini` for cost efficiency. If not, deterministic Python fallbacks
are provided that simulate the LLM step.

---

## 1. The Memory Problem

*Estimated time: 20 minutes*

### 1.1 The Stateless Baseline

The API contract for every major LLM provider is the same: you send a list of messages,
you receive a completion. There is no server-side state carrying over between requests
(with the partial exception of OpenAI's new Conversations API, discussed in Section 3).
Each request is independent.

```python
# The fundamental pattern: every API call is stateless
# Turn 1
response_1 = client.messages.create(
  model="claude-sonnet-4-20250514",
  messages=[{"role": "user", "content": "My name is Alice."}]
)

# Turn 2 - model has NO memory of turn 1 unless we include it
response_2 = client.messages.create(
  model="claude-sonnet-4-20250514",
  messages=[
    {"role": "user", "content": "My name is Alice."},
    {"role": "assistant", "content": response_1.content[0].text},
    {"role": "user", "content": "What is my name?"}
  ]
)
```

The conversational interface creates an illusion. ChatGPT and Claude present a continuous
conversation. Behind the interface, every response is generated from the full message
history sent in a single API call. When you build on the API directly, that management
is your responsibility.

### 1.2 Why This is a Context Engineering Problem

Step 5 established two kinds of state: context window state (volatile, binary loss on
session end) and external state (durable, survives across sessions). Conversation memory
sits at the intersection. The history is the primary input to the model - it IS the
context - but must be stored externally to survive across API calls.

The tradeoff is completeness vs cost. Including full conversation history is maximally
accurate but grows linearly with conversation length. At some point, the history exceeds
the context window. Even before that limit, unnecessary history wastes tokens and can
degrade quality by diluting signal with irrelevant prior turns.

This is hot context pressure applied to conversation memory: in-thread material
accumulating within a session, raising the risk of signal-to-noise degradation and
eventually hitting the ceiling. The countermeasure is not "use a bigger window." It is
selecting the right subset of history for each turn.

> **AGENTIC GROUNDING:** The memory management strategy directly determines an agent's
> effective working duration. A customer support agent using full history works for
> 20-turn interactions but degrades on 200-turn sessions. A coding agent that includes
> all prior file edits saturates its context before finishing a complex refactoring.
> The memory strategy is a correctness requirement, not a performance optimisation.

### 1.3 The Five Patterns

Conversation memory is a design space with five distinct patterns:

| Pattern | What enters context | Cost | What is lost |
|---------|-------------------|------|--------------|
| Full history | Everything | O(n), unbounded | Nothing (until overflow) |
| Sliding window | Last N messages | O(1), fixed | Everything before window |
| Summary memory | Compressed summary | O(1), fixed | Detail within summarised turns |
| Entity memory | Extracted entities | O(e), grows with entities | Conversational context |
| Retrieval-augmented | Relevant past turns | O(k), per query | Turns not retrieved |

These are not competing approaches. They are tools. Production systems combine them.
The skill is knowing which combination fits the task.

> **FIELD VS NOVEL:** The five-pattern taxonomy is well-established. LangChain
> popularised the naming (buffer, window, summary, entity, knowledge-graph) circa
> 2022-2023, though implementations have since been superseded by LangGraph persistence.
> The novel contribution here is connecting each pattern to context engineering
> vocabulary: full history as a baseline producing hot context pressure, summary memory
> as lossy compression subject to compaction loss, and retrieval-augmented memory as
> the working set principle (Denning 1968) applied to conversation history - retrieve
> the minimum prior context for correct output on the current turn.

---

## 2. Conversation Memory Patterns

*Estimated time: 50 minutes*

### 2.1 Full History

Include every message in every API call.

```python
import tiktoken

class FullHistoryMemory:
  def __init__(self):
    self.messages = []

  def add_user_message(self, content):
    self.messages.append({"role": "user", "content": content})

  def add_assistant_message(self, content):
    self.messages.append({"role": "assistant", "content": content})

  def get_messages(self):
    return list(self.messages)

  def token_count(self, encoding_name="cl100k_base"):
    enc = tiktoken.get_encoding(encoding_name)
    return sum(4 + len(enc.encode(m["content"])) for m in self.messages)
```

**When to use:** Short conversations (<20 turns), tasks where every prior turn is
genuinely relevant, prototyping.

**When it breaks:** A 128k-token window holds roughly 160-200 turns at 500 tokens per
turn (reserving space for system prompt and response). The failure is not graceful - the
API returns an error when messages exceed the limit. Full history must always be paired
with overflow detection:

```python
MAX_CONTEXT_TOKENS = 128_000
RESERVED_TOKENS = 16_000  # system prompt + tools + response buffer

def check_overflow(messages, encoding_name="cl100k_base"):
  enc = tiktoken.get_encoding(encoding_name)
  total = sum(4 + len(enc.encode(m["content"])) for m in messages)
  available = MAX_CONTEXT_TOKENS - RESERVED_TOKENS
  return {"total": total, "available": available, "overflow": total > available}
```

### 2.2 Sliding Window

Include only the most recent N messages. Fixed context cost regardless of conversation
length.

```python
class SlidingWindowMemory:
  def __init__(self, window_size=20):
    self.messages = []
    self.window_size = window_size

  def add_user_message(self, content):
    self.messages.append({"role": "user", "content": content})

  def add_assistant_message(self, content):
    self.messages.append({"role": "assistant", "content": content})

  def get_messages(self):
    return list(self.messages[-self.window_size:])
```

**When to use:** Tasks where recent context dominates - chatbots answering follow-up
questions, coding assistants where the current file matters more than files discussed
50 turns ago.

**When it breaks:** The window drops information completely. If the user says "my
account number is 12345" in turn 2 and the window is 10 messages, that information
is gone by turn 12. The agent will not know the account number. It will not know that
it ever knew it. This is not a retrieval failure - the information is simply absent
from context.

A token-based window (include messages up to a token budget) is more precise than a
message-count window:

```python
class TokenWindowMemory:
  def __init__(self, max_tokens=8000, encoding_name="cl100k_base"):
    self.messages = []
    self.max_tokens = max_tokens
    self.encoding_name = encoding_name

  def add_user_message(self, content):
    self.messages.append({"role": "user", "content": content})

  def add_assistant_message(self, content):
    self.messages.append({"role": "assistant", "content": content})

  def get_messages(self):
    enc = tiktoken.get_encoding(self.encoding_name)
    result, total = [], 0
    for msg in reversed(self.messages):
      msg_tokens = 4 + len(enc.encode(msg["content"]))
      if total + msg_tokens > self.max_tokens:
        break
      result.append(msg)
      total += msg_tokens
    result.reverse()
    return result
```

### 2.3 Summary Memory

Periodically compress the conversation into a summary. Include the summary instead of
(or alongside) the raw messages. This is the most conceptually interesting pattern
because it introduces a fundamental tension: summarisation is lossy compression.

```python
class SummaryMemory:
  def __init__(self, summary_threshold=10, llm_client=None):
    self.messages = []
    self.summary = ""
    self.summary_threshold = summary_threshold
    self.unsummarised_count = 0
    self.llm_client = llm_client

  def add_user_message(self, content):
    self.messages.append({"role": "user", "content": content})
    self.unsummarised_count += 1
    self._maybe_summarise()

  def add_assistant_message(self, content):
    self.messages.append({"role": "assistant", "content": content})
    self.unsummarised_count += 1
    self._maybe_summarise()

  def _maybe_summarise(self):
    if self.unsummarised_count < self.summary_threshold:
      return
    keep_recent = 4
    to_summarise = self.messages[:-keep_recent] if len(self.messages) > keep_recent else []
    if not to_summarise:
      return
    self.summary = self._generate_summary(to_summarise)
    self.messages = self.messages[-keep_recent:]
    self.unsummarised_count = len(self.messages)

  def _generate_summary(self, messages):
    if self.llm_client:
      return self._llm_summarise(messages)
    return self._deterministic_summarise(messages)

  def _deterministic_summarise(self, messages):
    """Deterministic fallback: extract sentences with names or numbers."""
    facts = []
    for msg in messages:
      for sentence in msg["content"].split(". "):
        if any(c.isdigit() for c in sentence):
          facts.append(sentence.strip())
    combined = ". ".join(facts[:10]) if facts else f"Conversation of {len(messages)} messages"
    return (self.summary + "\n" + combined) if self.summary else combined

  def _llm_summarise(self, messages):
    conversation_text = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
    response = self.llm_client.chat.completions.create(
      model="gpt-4o-mini",
      messages=[{"role": "user", "content": f"""Summarise this conversation. Preserve:
- All names, numbers, and specific values
- All decisions and preferences stated
- Any corrections the user made

Previous summary: {self.summary or '(none)'}
New messages:
{conversation_text}

Concise summary (under 500 words):"""}],
      max_tokens=800,
    )
    return response.choices[0].message.content

  def get_messages(self):
    result = []
    if self.summary:
      result.append({"role": "system", "content": f"Summary of earlier conversation:\n{self.summary}"})
    result.extend(self.messages)
    return result
```

**The compaction loss problem.** Summary memory applies the same lossy operation that
creates compaction loss in context windows - but deliberately. When a context window
dies, loss is uncontrolled and total. When summary memory compresses, loss is controlled
and selective. But it is still loss.

Consider a 50-turn conversation. The user mentions in turn 3 that "the production
database is on host db-prod-7.internal." By turn 40, the summary has been regenerated
three times. Does the summary still contain the hostname? If the summariser judged it
unimportant, the hostname is gone. When the user asks in turn 45, the agent cannot
answer - not because it forgot, but because the summarisation decided the fact was not
worth preserving.

This is compaction loss applied to memory: summarisation is lossy compression with no
graceful degradation. The fact is either in the summary or it is not. The summariser
must decide at compression time what will matter later, and that decision is irreversible
unless the full history is preserved separately.

> **AGENTIC GROUNDING:** Summary memory is the most commonly recommended pattern for
> long conversations and the most dangerous to get wrong. A production support agent
> lost a customer's contract renewal date during summarisation. The agent stated it had
> "no record" of a renewal date - the customer had provided it in turn 4 of an 80-turn
> conversation. Debugging required comparing the summary against full history to find
> what was dropped. The failure was invisible to the agent: it did not know what it had
> lost.

### 2.4 Entity Memory

Extract structured entities from conversation: names, dates, numbers, decisions. Store
as key-value pairs, not free text.

```python
import re

class EntityMemory:
  def __init__(self):
    self.messages = []
    self.entities = {}
    self.window_size = 10

  def add_user_message(self, content):
    self.messages.append({"role": "user", "content": content})
    self._extract_entities(content)

  def add_assistant_message(self, content):
    self.messages.append({"role": "assistant", "content": content})

  def _extract_entities(self, content):
    """Simple pattern-based entity extraction."""
    # Name introductions
    match = re.search(r"(?:my name is|I'm|I am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", content)
    if match:
      self.entities["user_name"] = match.group(1)

    # Email addresses
    match = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", content)
    if match:
      self.entities["user_email"] = match.group(0)

    # Account/order numbers
    for pattern, key in [
      (r"account\s*(?:number|#)?\s*(?:is\s+)?(\S+)", "account_number"),
      (r"order\s*(?:number|#)?\s*(?:is\s+)?(\S+)", "order_number"),
    ]:
      match = re.search(pattern, content, re.IGNORECASE)
      if match:
        self.entities[key] = match.group(1)

    # Corrections: "actually, X is Y"
    match = re.search(r"actually[,\s]+(?:my\s+)?(\w+)\s+is\s+(.+?)(?:\.|$)", content, re.IGNORECASE)
    if match:
      self.entities[match.group(1).lower()] = match.group(2).strip()

  def get_messages(self):
    result = []
    if self.entities:
      text = "Known facts:\n" + "\n".join(f"- {k}: {v}" for k, v in self.entities.items())
      result.append({"role": "system", "content": text})
    result.extend(self.messages[-self.window_size:])
    return result
```

**When to use:** Task-oriented agents where specific facts matter more than
conversational flow - customer support, form-filling, preference tracking.

**When it breaks:** Entity extraction is imperfect. Pattern-based extraction misses
entities outside expected formats. LLM-based extraction adds latency and cost. More
fundamentally, entity memory captures facts but loses narrative context - the user's
reasoning for choosing option B over A is not an entity. Entity memory is often
combined with sliding window or summary memory.

### 2.5 Retrieval-Augmented Memory

Embed all past messages. For each new turn, retrieve the most relevant prior messages
using semantic similarity. This is the RAG pattern from Steps 2-4 applied to
conversation history.

```python
import chromadb

class RetrievalAugmentedMemory:
  def __init__(self, collection_name="conversation_memory"):
    self.client = chromadb.Client()
    self.collection = self.client.get_or_create_collection(
      name=collection_name, metadata={"hnsw:space": "cosine"},
    )
    self.messages = []
    self.window_size = 6
    self.retrieve_k = 5

  def add_user_message(self, content):
    msg = {"role": "user", "content": content}
    self.messages.append(msg)
    self._embed_message(msg, len(self.messages) - 1)

  def add_assistant_message(self, content):
    msg = {"role": "assistant", "content": content}
    self.messages.append(msg)
    self._embed_message(msg, len(self.messages) - 1)

  def _embed_message(self, msg, index):
    self.collection.add(
      ids=[f"msg-{index}"],
      documents=[f"{msg['role']}: {msg['content']}"],
      metadatas=[{"role": msg["role"], "index": index, "content": msg["content"]}],
    )

  def get_messages(self, current_query=None):
    result = []
    total = len(self.messages)

    # Retrieve relevant older messages
    if current_query and total > self.window_size:
      search_results = self.collection.query(
        query_texts=[current_query],
        n_results=min(self.retrieve_k, total - self.window_size),
        where={"index": {"$lt": total - self.window_size}},
      )
      if search_results and search_results["metadatas"] and search_results["metadatas"][0]:
        context_lines = ["Relevant earlier messages:"]
        for meta in search_results["metadatas"][0]:
          context_lines.append(f"[{meta['role']}]: {meta['content']}")
        result.append({"role": "system", "content": "\n".join(context_lines)})

    result.extend(self.messages[-self.window_size:])
    return result
```

**When to use:** Long-running conversations where early information may become
relevant unpredictably - multi-session support, research assistants.

**When it breaks:** Retrieval depends on embedding quality. If the current question
is phrased differently from the original statement, similarity may be low and the
relevant message will not be retrieved. This is the same retrieval quality problem
from Step 2, applied to conversation history. Additionally, embedding every message
adds latency to every turn.

> **AGENTIC GROUNDING:** Retrieval-augmented memory is how production agents handle
> "I told you this three weeks ago." A customer references a conversation from two
> weeks prior about a billing issue. No sliding window reaches that far. But if those
> messages are embedded, the query "what happened with my billing dispute?" retrieves
> the relevant turns from the earlier session. The working set for this query includes
> messages from a different session - something no window or summary can provide.

### 2.6 Choosing a Pattern

| Question | If yes | If no |
|----------|--------|-------|
| Conversation always short (<30 turns)? | Full history | Continue below |
| Only recent context matters? | Sliding window | Continue below |
| Specific facts (names, IDs) are key? | Entity + window | Continue below |
| Old information may become relevant? | Retrieval-augmented | Summary memory |

Production systems combine patterns. A common architecture: entity memory for structured
facts, sliding window for conversational flow, and retrieval for long-term recall - all
assembled within a context budget.

> **FIELD VS NOVEL:** The combined-memory architecture is practised across the industry,
> from LangChain's (now superseded) `CombinedMemory` to custom implementations. The
> novel framing is applying the working set concept: each memory layer contributes to
> the working set for the current turn, and the context budget manager determines what
> fits. This inverts the typical approach (start with all memory, truncate to fit)
> into "build the minimum sufficient context from available memory layers."

---

## 3. Session Persistence

*Estimated time: 35 minutes*

### 3.1 The Session Boundary Problem

Step 5 covered state persistence generally. This section applies it specifically to
conversation sessions. A session boundary occurs whenever the connection is interrupted:
browser close, server restart, WebSocket drop, API timeout. Everything in the context
window is lost. The persistence layer must capture enough state before the boundary to
restore the conversation after it.

What to persist depends on the memory pattern, but the rule is: persist more than what
enters context. If you only persist the sliding window contents, you lose the ability
to change window size or switch strategies later.

### 3.2 Session Schema

A minimal but complete schema in SQLite:

```python
import sqlite_utils
import json
import time
import uuid

def create_session_db(db_path="sessions.db"):
  db = sqlite_utils.Database(db_path)

  if "sessions" not in db.table_names():
    db["sessions"].create({
      "session_id": str, "created_at": float, "updated_at": float, "metadata": str,
    }, pk="session_id")

  if "messages" not in db.table_names():
    db["messages"].create({
      "id": int, "session_id": str, "turn_index": int,
      "role": str, "content": str, "timestamp": float,
      "token_count": int, "metadata": str,
    }, pk="id", foreign_keys=[("session_id", "sessions")])
    db["messages"].create_index(["session_id", "turn_index"])

  if "entities" not in db.table_names():
    db["entities"].create({
      "id": int, "session_id": str, "key": str, "value": str,
      "source_turn": int, "updated_at": float,
    }, pk="id", foreign_keys=[("session_id", "sessions")])
    db["entities"].create_index(["session_id", "key"], unique=True)

  if "summaries" not in db.table_names():
    db["summaries"].create({
      "id": int, "session_id": str, "summary_text": str,
      "covers_through_turn": int, "created_at": float,
    }, pk="id", foreign_keys=[("session_id", "sessions")])

  return db

class PersistentSession:
  def __init__(self, db_path="sessions.db", session_id=None):
    self.db = create_session_db(db_path)
    self.session_id = session_id or str(uuid.uuid4())
    if not list(self.db["sessions"].rows_where("session_id = ?", [self.session_id])):
      self.db["sessions"].insert({
        "session_id": self.session_id, "created_at": time.time(),
        "updated_at": time.time(), "metadata": "{}",
      })

  def add_message(self, role, content, metadata=None):
    import tiktoken
    enc = tiktoken.get_encoding("cl100k_base")
    max_turn = self.db.execute(
      "SELECT COALESCE(MAX(turn_index), -1) FROM messages WHERE session_id = ?",
      [self.session_id],
    ).fetchone()[0]
    self.db["messages"].insert({
      "session_id": self.session_id, "turn_index": max_turn + 1,
      "role": role, "content": content, "timestamp": time.time(),
      "token_count": len(enc.encode(content)),
      "metadata": json.dumps(metadata or {}),
    })
    self.db["sessions"].update(self.session_id, {"updated_at": time.time()})

  def get_messages(self, limit=None):
    rows = list(self.db["messages"].rows_where(
      "session_id = ?", [self.session_id], order_by="turn_index",
    ))
    if limit:
      rows = rows[-limit:]
    return [{"role": r["role"], "content": r["content"]} for r in rows]

  def save_entity(self, key, value, source_turn):
    self.db["entities"].upsert({
      "session_id": self.session_id, "key": key, "value": value,
      "source_turn": source_turn, "updated_at": time.time(),
    }, pk=["session_id", "key"])

  def get_entities(self):
    return {r["key"]: r["value"] for r in self.db["entities"].rows_where(
      "session_id = ?", [self.session_id],
    )}
```

### 3.3 Session ID Management

```python
import uuid, time

# UUID4 (random, no information leakage)
session_id = str(uuid.uuid4())

# Timestamp-prefixed (sortable, reveals creation time)
session_id = f"{int(time.time())}-{uuid.uuid4().hex[:12]}"

# User-scoped (enables per-user session listing)
session_id = f"user_123:{int(time.time())}:{uuid.uuid4().hex[:8]}"
```

For debugging, timestamp-prefixed IDs are superior - you can sort chronologically and
correlate with server logs. For privacy, random UUIDs prevent information leakage.

### 3.4 Crash Recovery

Every message should be persisted before the response is sent to the user. If the
process crashes after persisting the user's message but before generating a response,
the session resumes from the last persisted message. The crash-vulnerable window is
between response generation and response persistence:

```python
class CrashSafeSession:
  def __init__(self, db_path, session_id):
    self.session = PersistentSession(db_path, session_id)

  def handle_user_message(self, content):
    # Step 1: Persist user message BEFORE processing
    self.session.add_message("user", content)
    # Step 2: Generate response (crash-vulnerable window)
    response = self._generate_response(content)
    # Step 3: Persist response
    self.session.add_message("assistant", response)
    return response

  def recover(self):
    messages = self.session.get_messages()
    if not messages:
      return "clean"
    if messages[-1]["role"] == "user":
      return "incomplete_turn"  # crash during generation
    return "clean"
```

This maps directly to checkpoint recovery (the project's dead reckoning protocol):
read the last known durable state, reconstruct position, resume.

> **FIELD VS NOVEL:** Session persistence for web applications is well-established
> (HTTP sessions, cookies, Redis stores). The novel aspect for agents is the interaction
> between persistence and memory strategy. An agent session must persist conversation
> history, memory state (summary, entities, embeddings), and agent configuration in a
> way that allows the memory strategy to be applied correctly on restore. The crash
> recovery pattern maps to the project's checkpoint recovery protocol: read durable
> state, reconstruct, resume.

### 3.5 The Provider Landscape (March 2026)

**Anthropic (stateless with caching).** The Messages API is stateless. Every request
contains the full message history. Efficiency comes from prompt caching: cache the
conversation prefix, pay 10% of base cost for cache hits (5-minute TTL, 1-hour option
at 2x cost). Developer manages all state.

**OpenAI (transitioning to server-side state).** The Assistants API (Threads, Runs)
is deprecated with a hard shutdown of August 2026. The replacement is the Responses
API with a Conversations API. `openai.conversations.create()` returns a persistent
server-side object. Compaction is a first-class concern with `compact_threshold` and
a standalone compact endpoint.

This divergence is instructive. Anthropic treats the developer as the state manager -
maximum flexibility, maximum responsibility. OpenAI provides managed state - less
flexibility, less responsibility. The choice depends on whether you need custom memory
strategies (favour Anthropic) or simpler integration (favour OpenAI).

> **FIELD MATURITY:** The provider API landscape for conversation state is in active
> flux. OpenAI's Conversations API is new. Anthropic's stateless model is stable but
> requires developers to build all state management. Build your memory layer as a
> provider-agnostic abstraction, and expect to adapt as APIs evolve.

---

## 4. Memory Evaluation

*Estimated time: 25 minutes*

### 4.1 Separating Storage, Retrieval, and Utilisation

How do you test whether a memory system works? The naive test - ask about turn 3 at
turn 20 - conflates three distinct capabilities:

1. **Storage** - Was the information persisted?
2. **Retrieval** - Was it loaded into context when needed?
3. **Utilisation** - Did the model use it correctly?

A failure at any level produces the same symptom (wrong answer), but the fix differs.
Storage failure means persistence is broken. Retrieval failure means the memory strategy
is not selecting the right context. Utilisation failure means the model had the
information but failed to use it.

### 4.2 Designing Memory Tests

Plant facts at specific conversation depths, query them later:

```python
def create_memory_test(n_turns, fact_positions, query_turn):
  """Create a test conversation with planted facts.

  Args:
    n_turns: total turns
    fact_positions: {turn: {"statement": ..., "key": ..., "expected": ...}}
    query_turn: when to query the facts
  """
  messages = []
  expected = {}

  for turn in range(n_turns):
    if turn in fact_positions:
      fact = fact_positions[turn]
      messages.append(("user", fact["statement"]))
      messages.append(("assistant", f"Noted: {fact['expected']}"))
      expected[fact["key"]] = fact["expected"]
    elif turn == query_turn:
      for key in expected:
        messages.append(("user", f"What is {key}?"))
        messages.append(("assistant", "__EVALUATE__"))
    else:
      messages.append(("user", f"Tell me about topic {turn}"))
      messages.append(("assistant", f"Information about topic {turn}..."))

  return messages, expected
```

### 4.3 Scoring

Run the same test through each memory strategy:

```python
def evaluate_memory(memory, test_messages, expected):
  scores = {}
  for role, content in test_messages:
    if content == "__EVALUATE__":
      continue
    if role == "user":
      memory.add_user_message(content)
      for key, exp_val in expected.items():
        if f"What is {key}?" == content:
          context = memory.get_messages()
          context_text = " ".join(m["content"] for m in context)
          scores[key] = exp_val.lower() in context_text.lower()
    else:
      memory.add_assistant_message(content)

  accuracy = sum(scores.values()) / len(scores) if scores else 0
  return {"per_fact": scores, "accuracy": accuracy}
```

The evaluation reveals each strategy's tradeoff:

| Strategy | Turn-2 fact | Turn-25 fact | Context tokens |
|----------|-------------|--------------|----------------|
| Full history | Present | Present | ~25,000 |
| Window (20) | Missing | Present | ~5,000 |
| Summary | Depends | Likely present | ~2,000 |
| Retrieval | Depends on similarity | Depends on similarity | ~3,000 |

> **AGENTIC GROUNDING:** Memory evaluation is not optional in production. A deployed
> customer service agent that loses account numbers at conversation depth 30 creates
> real business impact. Run the test suite against your strategy, measure at which depth
> facts disappear, and validate that critical facts survive at all depths your users
> will reach.

---

## 5. The Forgetting Problem

*Estimated time: 25 minutes*

### 5.1 Why Forgetting Matters

Not all information should be remembered:

- **Corrections.** "Actually, my email is alice@newdomain.com." The old value should
  be replaced.
- **Retracted statements.** "Ignore what I said about the budget."
- **Accidentally shared sensitive data.** "Please forget I shared my SSN."
- **Legal erasure requests.** GDPR Article 17 grants the right to deletion.

Forgetting is harder than remembering. In full history, delete specific messages. But
in summary memory, deleted information may be incorporated into the summary. In
retrieval-augmented memory, the embedding persists in the vector store. In entity memory,
the extracted entity exists independently of the source message.

### 5.2 GDPR Article 17 in Practice

GDPR Article 17 grants data subjects the right to erasure "without undue delay."
Applied to agent memory:

1. If a user requests deletion, the system must delete from all storage locations.
2. "All locations" includes: message database, summaries generated from those messages,
   entities extracted from them, embeddings computed from them, and cached prompt
   prefixes containing them.
3. Deletion must be complete enough that the agent cannot reconstruct deleted
   information from remaining state.

### 5.3 Implementing Erasure

```python
class ErasableMemory:
  def __init__(self, db_path, collection_name="memory"):
    self.db = create_session_db(db_path)
    self.vector_client = chromadb.Client()
    self.collection = self.vector_client.get_or_create_collection(name=collection_name)

  def erase_message(self, session_id, turn_index):
    """Cascade delete through all memory layers."""
    # 1. Delete the message
    self.db.execute(
      "DELETE FROM messages WHERE session_id = ? AND turn_index = ?",
      [session_id, turn_index],
    )
    # 2. Delete entities sourced from this message
    self.db.execute(
      "DELETE FROM entities WHERE session_id = ? AND source_turn = ?",
      [session_id, turn_index],
    )
    # 3. Delete the embedding
    try:
      self.collection.delete(ids=[f"msg-{session_id}-{turn_index}"])
    except Exception:
      pass
    # 4. Invalidate summaries covering this message
    self.db.execute(
      "DELETE FROM summaries WHERE session_id = ? AND covers_through_turn >= ?",
      [session_id, turn_index],
    )

  def erase_session(self, session_id):
    """Erase an entire session."""
    for table in ["messages", "entities", "summaries"]:
      self.db.execute(f"DELETE FROM {table} WHERE session_id = ?", [session_id])
    results = self.collection.get(where={"session_id": session_id})
    if results and results["ids"]:
      self.collection.delete(ids=results["ids"])
    self.db.execute("DELETE FROM sessions WHERE session_id = ?", [session_id])
```

### 5.4 The Summary Problem

The hardest erasure case. If personal information has been compressed into a summary,
deleting the original message is insufficient. Three approaches, none perfect:

1. **Regenerate summaries.** Delete target messages, regenerate all summaries from
   remaining messages. Cost: regeneration requires LLM calls and produces different
   output.

2. **Summary provenance.** Record which messages each summary covers. On erasure, flag
   affected summaries for regeneration. Reduces unnecessary regeneration.

3. **Sanitise before summarisation.** Classify message content and exclude PII from
   summarisation input. Sensitive facts go into the entity store with `erasable=True`.
   The summary contains only non-sensitive context.

```python
def sanitise_for_summary(messages):
  """Remove PII before summarisation."""
  import re
  patterns = [
    (r'\b\d{3}-\d{2}-\d{4}\b', '[SSN_REDACTED]'),
    (r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', '[CARD_REDACTED]'),
    (r'[\w.+-]+@[\w-]+\.[\w.]+', '[EMAIL_REDACTED]'),
  ]
  sanitised = []
  for msg in messages:
    content = msg["content"]
    for pattern, replacement in patterns:
      content = re.sub(pattern, replacement, content)
    sanitised.append({"role": msg["role"], "content": content})
  return sanitised
```

Option 3 is the most robust because it prevents the problem rather than cleaning up
after it. But it requires reliable PII detection, which is itself imperfect.

> **FIELD VS NOVEL:** GDPR Article 17 (effective 2018) is stable law. Its application
> to LLM agent memory is an active area of regulatory interpretation. The challenge of
> deleting information that has been summarised or embedded - where original data has
> been transformed into a derived representation - has no established engineering
> solution. The approach above (sanitise before summarisation, cascade deletion, summary
> regeneration) represents current best practice, not a solved problem.

---

## 6. Episodic Memory and Reflexion

*Estimated time: 35 minutes*

### 6.1 Conversation Memory vs Episodic Memory

Everything discussed so far is conversation memory: remembering what was said. Episodic
memory is different: remembering what happened, what went wrong, and what to do
differently.

Conversation memory records: "The user asked about billing. I explained the charges."
Episodic memory records: "I explained charges incorrectly because I used an outdated
pricing table. Next time, verify pricing data before responding."

Episodic memory is about the agent's experience with its own process, not the user's
information. It records failures, corrections, and learned patterns that improve future
behaviour without changing model weights.

### 6.2 The Reflexion Pattern

Reflexion (Shinn et al. 2023) formalises this: an agent that fails generates a verbal
reflection on why it failed, stores that reflection in an episodic memory buffer, and
reads it as context for subsequent attempts. There is no weight update. The "learning"
happens through the context window.

```python
import sqlite_utils
import time

class EpisodicMemoryStore:
  """Episodic memory following the Reflexion pattern."""

  def __init__(self, db_path="episodic_memory.db"):
    self.db = sqlite_utils.Database(db_path)
    if "episodes" not in self.db.table_names():
      self.db["episodes"].create({
        "id": int, "timestamp": float, "task_type": str,
        "description": str, "outcome": str,
        "reflection": str, "lesson": str, "standing": int,
      }, pk="id")
      self.db["episodes"].create_index(["task_type"])

  def record(self, task_type, description, outcome, reflection, lesson, standing=False):
    self.db["episodes"].insert({
      "timestamp": time.time(), "task_type": task_type,
      "description": description, "outcome": outcome,
      "reflection": reflection, "lesson": lesson,
      "standing": 1 if standing else 0,
    })

  def get_standing_lessons(self):
    return list(self.db["episodes"].rows_where("standing = 1", order_by="-timestamp"))

  def get_recent(self, task_type=None, limit=5):
    if task_type:
      return list(self.db["episodes"].rows_where(
        "task_type = ?", [task_type], order_by="-timestamp", limit=limit,
      ))
    return list(self.db["episodes"].rows_where(order_by="-timestamp", limit=limit))

  def build_context(self, task_type=None, max_lessons=5):
    sections = []
    standing = self.get_standing_lessons()
    if standing:
      sections.append("STANDING LESSONS (always apply):")
      for ep in standing:
        sections.append(f"  - {ep['lesson']}")
    recent = self.get_recent(task_type, limit=max_lessons)
    if recent:
      sections.append(f"\nRecent experience with '{task_type or 'all'}' tasks:")
      for ep in recent:
        sections.append(f"  - [{ep['outcome']}] {ep['description']}: {ep['lesson']}")
    return "\n".join(sections) if sections else ""
```

Reflexion achieved 91% pass@1 on HumanEval (vs GPT-4's 80% at publication). The
benchmark numbers are obsolete - current models exceed both baselines - but the
architectural insight remains valid: verbal self-reflection stored as text can
substitute for weight updates.

### 6.3 The Session-Decisions Chain as Episodic Memory

The project maintains a session-decisions chain: SD-001 through SD-321+, each recording
a decision, its reasoning, and its outcome. This is a worked example of Reflexion-style
episodic memory applied to a real engineering project.

```yaml
# Simplified session decision structure
- id: SD-131
  label: "sycophantic-drift-detected"
  summary: "Agent performing honesty while being dishonest about confidence"
  outcome: "SD-134 (truth-first) issued as permanent standing order"

- id: SD-134
  label: "truth-first"
  summary: "Truth over hiring signal"
  reasoning: "After SD-131 detected drift, the correction is not 'be more honest'
    (a paper guardrail) but a permanent policy binding all future sessions."
  status: PERMANENT
```

The chain exhibits three properties of effective episodic memory:

1. **Append-only.** Decisions are never modified. If superseded, a new decision
   references the old one (forward-ref, not renumber - SD-297). Structurally identical
   to Reflexion's append-only buffer.

2. **Indexed for retrieval.** The full chain is too large for every context window.
   A curated index (`session-decisions-index.yaml`) provides recent decisions and
   standing orders - the working set for session orientation.

3. **Actionable.** Each decision changes future behaviour. SD-134 is not a reflection
   ("we noticed drift") but a standing order ("truth over hiring signal, PERMANENT").
   The reflection is converted into an instruction binding all future agents.

> **AGENTIC GROUNDING:** The session-decisions chain demonstrates production episodic
> memory at scale: 321+ decisions over months, with standing orders persisting across
> every session. When a new agent boots, it reads the index and inherits accumulated
> lessons without having experienced them. SD-131 detected sycophantic drift. SD-134
> corrected it permanently. Every agent since operates under that policy, regardless
> of whether it "remembers" the original incident.

> **FIELD VS NOVEL:** The Reflexion pattern is established (Shinn et al. 2023).
> Episodic memory buffers appear in MemGPT and Generative Agents. The novel element
> is the session-decisions chain as a multi-month, multi-agent episodic memory in a
> real engineering project. It demonstrates properties absent from the literature:
> standing orders (permanent lessons binding all sessions), forward-referencing for
> supersession (SD-297), and a curated index as the working set for orientation. The
> pattern "reflect, record, index, enforce" extends Reflexion from single-agent retry
> loops to multi-agent governance.

### 6.4 MemGPT and Virtual Memory Hierarchies

MemGPT (Packer et al. 2023) draws an explicit analogy to OS virtual memory: just as
an OS pages between RAM and disk to provide the illusion of large memory, an agent can
page between context window ("RAM") and external storage ("disk").

| OS Memory | LLM Memory (MemGPT) |
|-----------|-------------------|
| RAM | Context window |
| Disk | External storage (database, files) |
| Page fault | Model needs information not in context |
| Page-in/out | Move data between context and storage |

MemGPT uses "interrupts" for control flow: the model autonomously decides what to page
in and out. This is more sophisticated than fixed strategies (window, summary) because
the model itself manages context.

**The limits of the analogy.** OS virtual memory has hardware-enforced guarantees: page
faults are deterministic, paging is transparent. MemGPT's "virtual context management"
has neither. The model's paging decisions are heuristic, not deterministic. Recognising
that needed information is absent (the "page fault") depends on the model's ability to
know what it does not know - an unreliable capability. The Letta product has pivoted
from the paper's memory focus toward a coding agent platform. Use the paper for the
concept, not the product documentation.

---

## Challenge: Memory Strategy Comparison

**Estimated time: 30 minutes**

**Prerequisites:** Completed Tool Setup. Memory classes from Section 2 implemented.

**Goal:** Compare three memory strategies on a 50-turn conversation with planted facts.

Generate a test conversation:

```python
def generate_test_conversation():
  turns = []
  for i in range(50):
    if i == 2:
      turns.append(("user", "By the way, my name is Aleksandra."))
      turns.append(("assistant", "Nice to meet you, Aleksandra!"))
    elif i == 5:
      turns.append(("user", "My account number is 90210-XB."))
      turns.append(("assistant", "Recorded: account 90210-XB."))
    elif i == 15:
      turns.append(("user", "I prefer email, not phone."))
      turns.append(("assistant", "Noted: email preferred."))
    elif i == 25:
      turns.append(("user", "Actually, my name is Aleksandraa with two a's."))
      turns.append(("assistant", "Updated to Aleksandraa."))
    elif i in (45, 47, 49):
      queries = {45: "What is my account number?", 47: "Preferred contact?", 49: "My name?"}
      turns.append(("user", queries[i]))
      turns.append(("assistant", "__QUERY__"))
    else:
      turns.append(("user", f"Explain concept {i}."))
      turns.append(("assistant", f"Here is concept {i}..."))
  return turns
```

Feed the conversation through full history, sliding window (10 messages), and summary
memory. At query turns (45, 47, 49), check whether the context contains:

1. Account number (90210-XB)
2. Contact preference (email)
3. Corrected name (Aleksandraa)

**Verification:** Complete this table:

| Strategy | Account present? | Preference present? | Name correct? | Tokens |
|----------|-----------------|---------------------|---------------|--------|
| Full history | | | | |
| Window (10) | | | | |
| Summary | | | | |

**Fallback:** Use `_deterministic_summarise` from Section 2.3 if no LLM API available.

<details>
<summary>Hints</summary>

- Sliding window at turn 45 contains only turns 40-49. All planted facts are outside.
- For summary, check whether the output contains literal strings "90210-XB", "email",
  and "Aleksandraa". Missing strings mean the summariser dropped them.
- Full history costs ~25k tokens at turn 50. Window costs ~2.5k. Summary costs ~1.5k.
  The question is whether token savings justify information loss.

</details>

**Extension:** Add entity memory as a fourth strategy. Does it capture all three facts?
Does it handle the correction at turn 25?

---

## Challenge: Retrieval-Augmented Memory

**Estimated time: 30 minutes**

**Prerequisites:** Chroma installed. Embedding provider configured.

**Goal:** Build retrieval-augmented memory and measure whether it outperforms sliding
window on the same 50-turn conversation.

```python
ram = RetrievalAugmentedMemory(collection_name="challenge_2")
test_conversation = generate_test_conversation()

for role, content in test_conversation:
  if content == "__QUERY__":
    continue
  if role == "user":
    ram.add_user_message(content)
  else:
    ram.add_assistant_message(content)

# Evaluate retrieval at query turns
queries = [
  ("What is my account number?", "90210-XB"),
  ("Preferred contact method?", "email"),
  ("What is my name?", "Aleksandraa"),
]
for query, expected in queries:
  messages = ram.get_messages(current_query=query)
  context_text = " ".join(m["content"] for m in messages)
  found = expected.lower() in context_text.lower()
  print(f"Query: {query} -> {expected} found: {found}")
```

**Verification:** Compare against sliding window:

| Metric | Window (10) | Retrieval-augmented |
|--------|-------------|-------------------|
| Account found | | |
| Preference found | | |
| Name found | | |
| Query latency (ms) | | |

**Fallback:** Local embeddings (sentence-transformers) may differ from OpenAI. Both
are valid - the point is to measure retrieval accuracy on your specific queries.

<details>
<summary>Hints</summary>

- If retrieval misses a fact, check embedding distances with `include=["distances"]`.
- Try rephrasing: "What account do I have?" vs "What is my account number?" may
  retrieve different results.
- Chroma returns distances (lower = more similar), not similarity scores.

</details>

**Extension:** Combine retrieval with entity memory. Does the combination capture
everything that either misses individually?

---

## Challenge: Memory Evaluation Design

**Estimated time: 30 minutes**

**Prerequisites:** At least two memory strategies implemented.

**Goal:** Design a systematic evaluation: 20 test cases probing memory at various
depths with automated scoring.

Design around two dimensions:

**Fact types** (4): identifiers, preferences, temporal facts, corrections.

**Depths** (5): 5, 15, 30, 45, 60 turns before query.

```python
def design_test_suite():
  tests = []
  fact_types = [
    {"type": "identifier", "template": "My order is ORD-{id}.",
     "query": "What is my order number?", "pattern": "ORD-{id}"},
    {"type": "preference", "template": "I prefer {val} format.",
     "query": "What format do I prefer?", "pattern": "{val}"},
    {"type": "temporal", "template": "Deadline is {val}.",
     "query": "When is the deadline?", "pattern": "{val}"},
    {"type": "correction", "template": "Actually the value is {val}.",
     "query": "What is the current value?", "pattern": "{val}"},
  ]
  depths = [5, 15, 30, 45, 60]

  for i, fact in enumerate(fact_types):
    for depth in depths:
      tests.append({
        "id": len(tests) + 1, "type": fact["type"],
        "plant_turn": depth, "query_turn": depth + 20,
        "total_turns": depth + 25,
        "template": fact["template"], "query": fact["query"],
        "pattern": fact["pattern"],
      })
  return tests

def score_strategy(memory_class, kwargs, tests):
  results = []
  for test in tests:
    memory = memory_class(**kwargs)
    val = f"TEST_{test['id']}"
    for turn in range(test["total_turns"]):
      if turn == test["plant_turn"]:
        stmt = test["template"].format(id=val, val=val)
        memory.add_user_message(stmt)
        memory.add_assistant_message("Noted.")
      elif turn == test["query_turn"]:
        memory.add_user_message(test["query"])
        ctx = " ".join(m["content"] for m in memory.get_messages())
        results.append({
          "id": test["id"], "type": test["type"],
          "depth": test["plant_turn"],
          "found": val.lower() in ctx.lower(),
        })
      else:
        memory.add_user_message(f"Filler {turn}")
        memory.add_assistant_message(f"Response {turn}")

  total = len(results)
  found = sum(1 for r in results if r["found"])
  return {"accuracy": found / total, "by_depth": results}
```

**Verification:** Produce a comparison table for two strategies showing accuracy at
each depth level. Sliding window should show a sharp cutoff at the window boundary.
Summary memory should show fact-type-dependent accuracy.

<details>
<summary>Hints</summary>

- Full history is your baseline: 100% until context overflow.
- Sliding window accuracy is binary by depth: 100% inside window, 0% outside.
- The correction test is most interesting: does memory return corrected or original?
- If retrieval fails, check query-to-fact embedding similarity.

</details>

**Extension:** Add a cross-session test: plant a fact in session A, query in session B.
Which strategies support cross-session recall?

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. Why do LLMs have no inherent memory between API calls? What does the API contract
   guarantee, and what does it not?

2. Name the five conversation memory patterns. For each, what is preserved and what
   is lost?

3. What is compaction loss applied to memory summarisation? Why is the loss binary
   rather than gradual?

4. What is hot context pressure in conversation memory? How does it differ from
   simply running out of context window space?

5. What must be persisted to restore a session? Why persist more than what enters
   the context window?

6. How does Anthropic's approach to conversation state differ from OpenAI's new
   Conversations API?

7. What are the three levels at which a memory test can fail (storage, retrieval,
   utilisation)?

8. What does GDPR Article 17 require, and why is selective erasure hard in
   summary-based memory?

9. How does episodic memory differ from conversation memory? What does Reflexion store?

10. How does the session-decisions chain function as episodic memory? What are its
    three key properties?

---

## Recommended Reading

- **Shinn et al., "Reflexion: Language Agents with Verbal Reinforcement Learning"
  (2023).** Episodic memory through self-reflection. https://arxiv.org/abs/2303.11366
  Read Section 3 (architecture) and Section 4.1 (episodic memory buffer).

- **Packer et al., "MemGPT: Towards LLMs as Operating Systems" (2023).** Virtual
  memory analogy for context management. https://arxiv.org/abs/2310.08560 The paper
  is more valuable than the current product documentation (Letta has pivoted).

- **GDPR Article 17 - Right to Erasure.** The legal basis for selective forgetting.
  https://gdpr-info.eu/art-17-gdpr/ Short, directly applicable.

- **Anthropic Prompt Caching.** The stateless approach to conversation efficiency.
  https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

- **OpenAI Conversation State Guide.** Server-side state management (new API).
  https://platform.openai.com/docs/guides/conversation-state Note: new as of 2026.

- **Martin Fowler, "Event Sourcing" (2005).** Append-only event logs underpinning
  episodic memory. https://martinfowler.com/eaaDev/EventSourcing.html

- **Denning, P.J. (1968), "The Working Set Model for Program Behavior."** The working
  set applied to memory: minimum prior context for correct output on the current turn.

---

## What to Read Next

**Step 7: Observability and Tracing** - Step 6 builds the memory system. Step 7
covers how to observe it in operation: tracing LLM calls and token usage, monitoring
memory strategy performance, detecting when summarisation drops critical facts, and
measuring retrieval quality in production. The memory evaluation framework from this
step becomes the basis for production monitoring.

