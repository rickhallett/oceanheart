+++
title = "How LLMs Actually Work"
date = "2026-03-10"
description = "Transformer architecture, tokenisation, context windows, autoregressive generation. The operational consequences of the math."
tags = ["llm", "fundamentals", "bootcamp"]
step = 1
tier = 1
estimate = "5-6 hours"
bootcamp = 2
+++

Step 1 of 11 in Bootcamp II: Agentic Engineering Practices.

---

## Why This is Step 1

You cannot verify what you do not understand. When an agent produces plausible but wrong
code, diagnosing whether the failure is in the prompt, the context window, the model's
training data, or the tool interface requires understanding the generation pipeline. "Try
a different prompt" is not root cause analysis. It is superstition with a feedback loop.

This step has the highest compositional leverage of any step in Bootcamp II. Agent
architecture (Step 2), prompt engineering (Step 3), context engineering (Step 4),
verification (Step 6), and the human-AI interface (Step 7) all depend on the mechanics
covered here. If your understanding of LLM internals is shallow - if you think of the
model as a magic box that turns prompts into text - every subsequent step builds on sand.

The field covers this topic well. Karpathy's "Let's build GPT from scratch" (2023),
Alammar's "The Illustrated Transformer" (2018), and Vaswani et al.'s "Attention Is All
You Need" (2017) are excellent resources and are referenced throughout. The novel
contribution of this step is the **operational framing**: every concept is mapped to a
layer in the layer model (L0-L5), and every section answers the question "why does this
matter when agents write code?"

> **FIELD MATURITY: ESTABLISHED.** The transformer architecture, tokenisation, attention
> mechanisms, and API mechanics are well-documented by model providers and the research
> community. What is less well-covered is the operational consequences framing - how these
> mechanisms create specific failure modes in agentic workflows, and which layers of the
> stack are observable, calibrated, or opaque.

The goal: build a mental model of the generation pipeline accurate enough that when an
agent writes confidently wrong code, you can identify which layer the failure originated
in and what your diagnostic options are at that layer.

---

## Table of Contents

1. [The Layer Model: L0-L5](#1-the-layer-model-l0-l5) (~20 min)
2. [Weights and Training: L0](#2-weights-and-training-l0) (~30 min)
3. [Tokenisation: L1](#3-tokenisation-l1) (~40 min)
4. [Attention: L2](#4-attention-l2) (~35 min)
5. [The Context Window: L3](#5-the-context-window-l3) (~40 min)
6. [Autoregressive Generation: L4](#6-autoregressive-generation-l4) (~35 min)
7. [Reasoning Tokens and Extended Thinking](#7-reasoning-tokens-and-extended-thinking) (~25 min)
8. [RLHF and Its Consequences](#8-rlhf-and-its-consequences) (~30 min)
9. [API Mechanics: L5](#9-api-mechanics-l5) (~40 min)
10. [Model Families and Practical Differences](#10-model-families-and-practical-differences) (~25 min)
11. [Challenges](#11-challenges) (~60-90 min)
12. [Key Takeaways](#12-key-takeaways)
13. [Recommended Reading](#13-recommended-reading)
14. [What to Read Next](#14-what-to-read-next)

---

## 1. The Layer Model: L0-L5

*Estimated time: 20 minutes*

Before diving into individual mechanisms, you need the map. The layer model is an
operational framework for reasoning about where in the LLM stack something happened, what
is observable, and what is not. It is not a research taxonomy. It is an engineering
instrument - a way to localise failures.

The full model has 13 layers (L0-L12), covering everything from frozen weights to the
human operator. This step covers the bottom six - the layers that describe how an LLM
turns a sequence of tokens into a response.

| Layer | Name | What It Is | Observable? | Calibrated? |
|-------|------|-----------|-------------|-------------|
| L0 | WEIGHTS | Frozen parameters, training priors, RLHF alignment | No | No |
| L1 | TOKENISE | Text to token IDs via BPE encoding | Yes (deterministic) | Yes |
| L2 | ATTENTION | Self-attention across all tokens, O(n^2) cost | No | No |
| L3 | CONTEXT | The context window as finite resource with position effects | Partially (token count visible at L5) | No (position effects not measurable) |
| L4 | GENERATION | Autoregressive token-by-token output, no lookahead | Partially (output visible, process not) | No |
| L5 | API | Request/response, token counts, costs, caching | Yes | **Yes** - the only fully calibrated layer |

The critical insight is in the rightmost column. **L5 is the only layer where the numbers
are exact.** Token counts reported by the API are deterministic. Costs are computable.
Cache hit rates are measurable. Everything below L5 - what the model attended to, how it
weighted its options, why it chose one token over another - is opaque.

This matters because engineers are accustomed to systems where the internals are
inspectable. You can `strace` a process (Bootcamp I, Step 1). You can `git cat-file` an
object (Bootcamp I, Step 7). You cannot inspect attention weights during a production API
call. You cannot see which training examples influenced the output. When you hit an LLM
failure, you are debugging a system where most of the internal state is unobservable.

Read the layers bottom-up for data flow: text enters at L1, becomes tokens, flows through
attention at L2, is shaped by context position at L3, generates output at L4, and the
response arrives at L5. Read top-down for control flow: you configure the API call at L5,
which determines how much context enters at L3, which shapes what the model attends to at
L2.

> **AGENTIC GROUNDING:** When an agent produces wrong output, the first diagnostic
> question is "which layer?" If the model generated syntactically valid but semantically
> wrong code, the failure is probably at L0 (training data does not cover this pattern),
> L3 (relevant context was outside the attention window), or L8 (system prompt did not
> ground the agent properly - covered in Step 3). If the token count is wrong, check L5.
> If code has bizarre variable names or split keywords, check L1. The layer model gives
> you a diagnostic checklist instead of "try a different prompt."

---

## 2. Weights and Training: L0

*Estimated time: 30 minutes*

An LLM is a function. It takes a sequence of tokens and returns a probability distribution
over the next token. That function is defined by its **weights** - billions of numerical
parameters learned during training.

At inference time (when you make an API call), the weights are frozen. The model cannot
learn from your conversation. It cannot update its parameters based on your corrections.
When you tell Claude "no, the function should return a list, not a dict" and it generates
the correct version on the next attempt, it has not learned anything. It has received
additional context tokens that shift the probability distribution toward the output you
want. The weights are identical to what they were before your correction.

This is not a limitation of current implementations. It is a property of the architecture.
Training requires gradient computation across the entire parameter space, which is
incompatible with real-time inference serving millions of users.

### What the Weights Encode

The weights encode compressed statistical patterns from the training data. For a model
like Claude or GPT-4, that training data includes:

- Large portions of the public internet (filtered and curated)
- Code repositories (GitHub, GitLab, open source projects)
- Books, academic papers, documentation
- Conversational data used for instruction tuning
- Human preference data used for RLHF alignment (more on this in Section 8)

The weights produce `P(next_token | all_previous_tokens)` - a probability distribution
conditioned on everything that came before. The model does not "know" Python or "understand"
git. It has statistical associations between token sequences that are strong enough to
produce syntactically and often semantically valid code. The distinction matters when those
associations fail - the model does not know it is wrong, because there is no "knowing" at
L0. There are only probabilities.

### The Training Cutoff

Every model has a knowledge cutoff - a date beyond which the training data does not extend.
Events, APIs, library versions, and best practices that emerged after the cutoff are not in
the weights. The model may generate confident responses about post-cutoff topics by
extrapolating from pre-cutoff patterns, but those responses are unconstrained by data.

This is a specific failure mode for code generation. If a library changed its API after the
training cutoff, the model will generate code using the old API with full confidence. The
code will look correct. It will type-check against the old types. It will fail at runtime
against the current version.

```python
# Example: checking model awareness of its own training cutoff
# This is observable at L5 - the model's response to meta-questions
# about its training data is part of the generation, not the weights.

import anthropic

client = anthropic.Anthropic()

message = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  messages=[
    {
      "role": "user",
      "content": "What is your training data cutoff date? "
        "Do not hedge - give me the date if you know it, "
        "or say you do not know."
    }
  ]
)
print(message.content[0].text)
# The response is generated at L4, shaped by L0 weights and L8 system prompt.
# The actual cutoff is a property of L0. The model's report of it is L4 output.
# These can diverge.
```

### Temperature and Sampling

The raw output of the model at each generation step is a probability distribution over the
entire vocabulary (typically 100K-200K tokens). **Temperature** and **top-p** control how
this distribution is sampled:

- **Temperature = 0**: Always pick the highest-probability token (greedy decoding). Output
  is deterministic (modulo floating-point nondeterminism). Best for tasks where you want
  consistency: code generation, structured output, factual retrieval.
- **Temperature = 1**: Sample from the distribution as-is. Output varies between runs.
  Good for creative tasks where diversity matters.
- **Temperature > 1**: Flatten the distribution, making unlikely tokens more probable.
  Output becomes increasingly random. Rarely useful in engineering contexts.
- **Top-p (nucleus sampling)**: Instead of considering all tokens, only consider the
  smallest set of tokens whose cumulative probability exceeds `p`. Top-p = 0.9 means
  "consider the most likely tokens that together account for 90% of the probability mass."

For agentic engineering, **temperature 0** is almost always correct. You want reproducible,
deterministic-ish output. You are not writing poetry. You are generating code, structured
data, and tool calls that will be consumed by downstream systems. Non-determinism in those
contexts is a bug, not a feature.

> **HISTORY:** The transformer architecture was introduced by Vaswani et al. in "Attention
> Is All You Need" (2017), originally for machine translation. The key insight was replacing
> recurrence (processing tokens sequentially, as in LSTMs) with self-attention (processing
> all tokens in parallel). This made training vastly more parallelisable, which made
> scaling to billions of parameters practical. Modern LLMs (GPT, Claude, Gemini) use
> decoder-only variants of the transformer - they dropped the encoder half and kept only
> the autoregressive decoder. The architecture you interact with through the API is a
> direct descendant of that 2017 paper, scaled by three orders of magnitude in parameters
> and trained on qualitatively different data.

> **AGENTIC GROUNDING:** When an agent generates code that uses a deprecated API, the
> failure is at L0 - the weights encode the old pattern more strongly than the new one
> (or the new one does not exist in the training data at all). The fix is not "prompt
> harder." The fix is to provide the current API documentation in the context (L3), where
> the model can attend to it. This is the core insight of context engineering (Step 4):
> L0 is frozen, but L3 is configurable.

---

## 3. Tokenisation: L1

*Estimated time: 40 minutes*

Tokenisation is the process of converting text into a sequence of integer IDs that the
model can process. It is deterministic, reversible, and the single most underappreciated
source of code generation bugs.

### What Tokens Are

A token is not a word. It is not a character. It is a subword unit produced by
**Byte Pair Encoding (BPE)** or a similar algorithm. BPE works by iteratively merging
the most frequent pair of adjacent bytes (or characters) in the training corpus until a
target vocabulary size is reached.

The result is a vocabulary of 100K-200K tokens that includes:

- Common words as single tokens: `the`, `function`, `return`
- Common subwords: `ing`, `tion`, `pre`
- Individual characters and bytes (for handling anything not in the vocabulary)
- Special tokens: beginning-of-sequence, end-of-sequence, padding
- Whitespace tokens: spaces, newlines, tabs (often merged with the following text)

The key insight: **token boundaries do not align with semantic boundaries in code.** A
Python function definition might tokenise as:

```
"def calculate_total(items):" -> ["def", " calculate", "_total", "(", "items", "):"]
```

The underscore in `calculate_total` may or may not be its own token depending on the
tokeniser. `items` is one token. But `item_list` might be two or three. This means the
model sees different numbers of "things" depending on naming conventions, and the attention
mechanism (L2) operates on tokens, not on your semantic intent.

### Tokenisation Surprises in Code

Code tokenisation produces counterintuitive results that directly affect generation
quality.

**Indentation matters.** Languages that use indentation for structure (Python, YAML) pay a
token cost for indentation. Four spaces of indentation is typically one or two tokens. In
deeply nested code, a significant fraction of the token budget is spent on whitespace.

**Variable names have different costs.** Short, common variable names (`i`, `x`, `data`)
are usually single tokens. Descriptive names (`customer_subscription_end_date`) might be
four or five tokens. The model literally has more "room to think" when processing code
with short variable names - though the descriptive names provide better context.

**String literals are expensive.** A URL in a string literal might consume 10-20 tokens.
Long error messages, SQL queries embedded in strings, base64-encoded data - all of these
consume tokens far faster than the surrounding code logic.

**Numbers tokenise strangely.** The number `1000` might be one token. The number `1729`
might be two tokens (`17`, `29`). The number `123456789` might be four tokens. This means
arithmetic reasoning requires the model to work across token boundaries, which is one
reason LLMs are unreliable at math.

### Hands-On: Exploring Tokenisation

The `tiktoken` library (by OpenAI) lets you tokenise text programmatically. For Claude,
Anthropic provides token counting through the API.

```python
#!/usr/bin/env python3
"""Explore tokenisation boundaries in code."""

# pip install tiktoken
import tiktoken

# cl100k_base is used by GPT-4; o200k_base by newer models
enc = tiktoken.get_encoding("cl100k_base")

def show_tokens(text, label=""):
  tokens = enc.encode(text)
  decoded = [enc.decode([t]) for t in tokens]
  if label:
    print(f"\n{label}")
  print(f"  Text: {repr(text)}")
  print(f"  Tokens ({len(tokens)}): {decoded}")
  print(f"  Token IDs: {tokens}")

# Natural language vs code
show_tokens("The cat sat on the mat.", "Natural language")
show_tokens("def calculate_total(items):", "Python function")
show_tokens("    return sum(item.price for item in items)", "Indented Python")

# Variable naming cost
show_tokens("x = 42", "Short variable")
show_tokens("customer_subscription_end_date = 42", "Descriptive variable")

# Number tokenisation
show_tokens("1000", "Round number")
show_tokens("1729", "Irregular number")
show_tokens("123456789", "Long number")

# String literal cost
show_tokens('"https://api.example.com/v2/users/123/subscriptions"', "URL in string")

# Whitespace cost
show_tokens("if True:\n    pass", "Python with 4-space indent")
show_tokens("if True:\n        pass", "Python with 8-space indent")

# Code vs description of code
show_tokens("async function fetchUser(id) { return await db.get(id); }", "JS code")
show_tokens("An async function that fetches a user by ID from the database", "Description")
```

Run this and study the output. Pay attention to where the tokeniser splits things
differently than you would.

You can also explore interactively at `https://platform.openai.com/tokenizer` - paste code
and see token boundaries colour-coded. For Claude specifically, the token count in any API
response includes the exact input and output token counts (visible at L5).

> **HISTORY:** Byte Pair Encoding was originally a data compression algorithm (Gage, 1994).
> Its application to NLP subword tokenisation was introduced by Sennrich et al. (2016) for
> neural machine translation, solving the "open vocabulary" problem - how to handle words
> the model has never seen. Before BPE, models used fixed vocabularies and replaced unknown
> words with an `<UNK>` token, losing all information. BPE's insight is that any word can
> be represented as a sequence of subword units, so nothing is truly unknown - just
> decomposed into smaller pieces. SentencePiece (Kudo & Richardson, 2018) extended this to
> work directly on raw text without pre-tokenisation. Modern LLMs use variants of these
> approaches, typically with vocabulary sizes of 100K-200K tokens.

> **AGENTIC GROUNDING:** When an agent generates code with bizarre variable names, split
> keywords, or corrupted string literals, the failure may originate at L1. The model
> operates on tokens, not characters. If a function name is tokenised in a way that splits
> it across an awkward boundary, the model's "understanding" of that function name is
> distributed across multiple attention steps. More practically: when estimating whether a
> piece of context will fit in the context window, count tokens, not words. A 10,000-word
> document might be 13,000-15,000 tokens. A 500-line code file might be 3,000-5,000 tokens
> depending on indentation and naming conventions. The token count is the budget that
> matters, and it is computable at L1.

---

## 4. Attention: L2

*Estimated time: 35 minutes*

Attention is the mechanism that gives the transformer its power. In one sentence: every
token in the sequence can "look at" every other token and decide how much to weight that
information when computing its own representation. This is what makes transformers
different from earlier architectures that processed tokens left-to-right with a fixed-size
hidden state (LSTMs, GRUs).

### How Attention Works (Operational Level)

You do not need to derive the attention formula to use LLMs effectively. You need to
understand the operational consequences. Here is the formula, and then we will focus on
what it means:

```
Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) V
```

Where:
- **Q (Query)**: "What am I looking for?" - each token's query vector
- **K (Key)**: "What do I contain?" - each token's key vector
- **V (Value)**: "What information do I carry?" - each token's value vector
- **d_k**: The dimension of the key vectors (used for scaling)

The dot product `QK^T` computes a score between every pair of tokens. The softmax converts
these scores into weights that sum to 1. The weighted sum of V gives each token a new
representation that incorporates information from all other tokens it deemed relevant.

What matters for engineering:

### Consequence 1: O(n^2) Cost

Every token attends to every other token. For a sequence of `n` tokens, this requires
computing `n * n` attention scores. Double the context length and you quadruple the
attention computation. This is why context windows have hard caps - the cost is not
linear in context length, it is quadratic.

In practice, models use optimisations (FlashAttention, KV caching, sliding window
attention) that reduce the constant factor but do not change the fundamental scaling. A
200K-token context window costs dramatically more compute than a 4K-token context window,
which is why API pricing differentiates between input tokens and output tokens, and why
long contexts cost more per token.

### Consequence 2: Attention Dilution

When the context is short (a few hundred tokens), each token gets a meaningful share of
attention from every other token. As the context grows to tens or hundreds of thousands
of tokens, the attention budget is spread thinner. A critical piece of information at
position 50,000 in a 200,000-token context is competing with 199,999 other tokens for
attention.

This does not mean the model cannot find it - attention heads specialise, and some are
good at long-range retrieval. But it means that retrieval from long contexts is
probabilistic, not guaranteed. The "lost-in-the-middle" effect (Section 5) is a direct
consequence of attention dilution.

### Consequence 3: Unobservable

**You cannot see attention weights during a production API call.** You cannot know which
tokens the model attended to when generating a particular output. You cannot verify that
it "read" the function documentation you included in the context. You can only observe
the output and infer what must have been attended to.

This is a fundamental difference from debuggable systems. When a process reads a file, you
can `strace` the `read()` syscall and see exactly which bytes were consumed (Bootcamp I,
Step 1). When an LLM "reads" your context, you see the input (L5) and the output (L5),
but the attention computation between them (L2) is a black box.

The layer model captures this: "degradation is felt, not measured." You notice that the
model seems to ignore a piece of context, but you cannot measure the attention it received.

### Multi-Head Attention

Modern LLMs use **multi-head attention** - multiple independent attention mechanisms
running in parallel, each learning to focus on different types of relationships.

One head might learn to attend to syntactic structure (matching brackets, function
definitions). Another might attend to semantic relationships (variable definitions and
their uses). Another might attend to positional patterns (the instruction at the beginning
of the context). With 32-128 heads (typical for production models), the model has multiple
parallel "lenses" for examining the relationship between any two tokens.

For engineers, the practical implication is that the model is not doing a single pass of
"reading" - it is doing dozens of parallel scans, each looking for different patterns.
This is why models can simultaneously track syntactic correctness, semantic meaning, and
instruction adherence. It is also why failures can be partial - one head might track
bracket nesting perfectly while another loses track of a variable binding.

> **AGENTIC GROUNDING:** You cannot debug attention directly, but you can design around
> its limitations. If you need the model to attend to a specific piece of information,
> put it at the beginning of the context (primacy bias) or at the end just before the
> instruction (recency bias). Do not bury critical context in the middle of a 100K-token
> window and hope the model finds it. Attention is probabilistic, not deterministic. Design
> your context the way you would design a dashboard - put the critical information where
> it will be seen.

---

## 5. The Context Window: L3

*Estimated time: 40 minutes*

The context window is the total number of tokens the model can process in a single
request - input tokens plus output tokens. It is a finite resource with a hard cap.

### Current Context Window Sizes (March 2026)

| Model Family | Context Window | Notes |
|-------------|---------------|-------|
| Claude 3.5 Sonnet / Claude Opus 4 | 200K tokens | ~150K pages of text |
| GPT-4.1 | 1M tokens | Largest OpenAI context |
| GPT-5 | Varies by tier, up to 1M+ | Tier-dependent |
| Gemini 1.5 Pro | 2M tokens | Largest available |

These numbers are impressive. They are also misleading.

### Advertised Length vs Effective Length

The number on the label is the maximum number of tokens the model can accept. It is not
the maximum number of tokens the model can effectively use.

Research consistently shows that LLM retrieval performance degrades in the middle of long
contexts. The pattern, documented across multiple model families, is:

- **Primacy bias**: Information near the beginning of the context gets disproportionate
  attention. The first few hundred tokens (the system prompt, the initial instructions)
  have the strongest influence on generation.
- **Recency bias**: Information near the end of the context (the most recent messages)
  also gets strong attention. This is where the model looks for "what am I supposed to
  do right now?"
- **Lost-in-the-middle**: Information in the roughly 25-75% range of a long context is
  most likely to be missed or underweighted. A critical function definition buried at
  position 80,000 in a 200,000-token context may not influence the output as reliably as
  the same definition placed at position 1,000.

This is not a binary - the model does not completely ignore middle content. But retrieval
from middle positions is statistically less reliable than from the beginning or end. The
practical implication: **a 200K-token context window does not mean you have 200K tokens of
equally effective context.**

### Context Window as Resource Budget

The context window is consumed by everything:

| Component | Typical Token Cost | Notes |
|-----------|-------------------|-------|
| System prompt | 500-5,000 | Depends on complexity |
| Conversation history | 1,000-100,000+ | Grows over session |
| Tool definitions | 200-2,000 | Per tool schema |
| Tool results | Varies wildly | A `git diff` can be 10K tokens |
| Retrieved documents | 1,000-50,000 | RAG context |
| User message | 50-5,000 | The actual instruction |
| **Output budget** | **500-8,000** | What is left for the response |

Every tool result, every conversation turn, every piece of retrieved context consumes
budget from the same fixed pool. An agent that aggressively uses tools (reading files,
running commands, searching code) burns context tokens with each tool call. There is no
"tool results do not count" mode - they occupy the same window.

### L3 Position Effects and Agentic Systems

For a single prompt-response, the lost-in-the-middle effect is a nuisance. For an agentic
system that accumulates dozens of tool calls and conversation turns, it is a structural
constraint.

Consider an agent that has been working on a bug for 20 turns. The system prompt (which
contains the agent's role definition and instructions) is at position 0. The initial bug
description is at position 2,000. Fifteen tool call results (file reads, test runs, grep
outputs) occupy positions 3,000-80,000. The most recent exchange is at position 80,000+.

The agent's role definition has primacy. The current instruction has recency. The initial
bug description? It is in the middle, competing with 78,000 tokens of tool results for
attention. If the agent "forgets" the original bug and starts solving a different problem,
the failure is at L3 - the relevant context has drifted into the low-attention zone.

```python
#!/usr/bin/env python3
"""Demonstrate context window token accounting with the Anthropic API."""

import anthropic

client = anthropic.Anthropic()

# A simple request - observe the token counts
response = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  system="You are a helpful assistant. Respond concisely.",
  messages=[
    {"role": "user", "content": "What is 2 + 2?"}
  ]
)

# L5 gives us exact token counts
print(f"Input tokens:  {response.usage.input_tokens}")
print(f"Output tokens: {response.usage.output_tokens}")
print(f"Total tokens:  {response.usage.input_tokens + response.usage.output_tokens}")
print(f"Response: {response.content[0].text}")

# Now observe what happens when we add context
long_context = "Here is some background information:\n" + ("x " * 5000)
response2 = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  system="You are a helpful assistant. Respond concisely.",
  messages=[
    {"role": "user", "content": long_context + "\nWhat is 2 + 2?"}
  ]
)

print(f"\nWith added context:")
print(f"Input tokens:  {response2.usage.input_tokens}")
print(f"Output tokens: {response2.usage.output_tokens}")
print(f"Response: {response2.content[0].text}")
# The extra context consumed tokens but did not change the answer.
# In a real agent system, this is your budget being spent on noise.
```

> **AGENTIC GROUNDING:** Context window management is the central engineering challenge
> of agentic systems. Every design decision - how much conversation history to retain,
> which tool results to include, how long the system prompt is, whether to use RAG -
> is ultimately a question of token budget allocation within L3. When an agent starts
> producing incoherent or contradictory output after a long session, the first hypothesis
> should be L3 saturation: the relevant context has been pushed into the low-attention
> zone by accumulated tool results. The fix is not a better prompt. It is context
> management - summarising, pruning, or restarting with a fresh context window. Step 4
> covers this in depth.

---

## 6. Autoregressive Generation: L4

*Estimated time: 35 minutes*

LLMs generate text one token at a time. Each token is conditioned on all previous tokens
(the input context plus all tokens generated so far). There is no lookahead. There is no
revision. The model cannot go back and fix a decision made 500 tokens ago.

This is autoregressive generation, and it is the most important operational characteristic
of LLMs for engineers to internalise.

### The Generation Loop

At each step, the model:

1. Takes all tokens so far (input + generated output) as input
2. Computes attention across all of them (L2)
3. Produces a probability distribution over the full vocabulary (~100K-200K tokens)
4. Samples one token from that distribution (using temperature/top-p settings from L5)
5. Appends that token to the sequence
6. Repeats from step 1

This continues until the model generates a stop token (end-of-turn, end-of-sequence) or
hits the `max_tokens` limit set at L5.

### Why This Matters: No Revision

When a human writes code, they frequently go back and change earlier decisions. You start
writing a function, realise the return type should be different, and refactor. You write
a class, realise it should be split into two, and restructure.

An LLM cannot do this. If the model starts generating a function that returns a string,
and 200 tokens later "realises" (at L4, through the shifted probability distribution)
that it should return a list, it cannot go back. It is committed. It can add a comment
saying "this should probably return a list" or generate a conversion at the end, but the
structural decision is locked in.

This has concrete consequences for code quality:

```python
# What the model generates (committed to string return early):
def process_items(items):
  """Process items and return results."""
  result = ""  # <-- committed to string here, token 5
  for item in items:
    processed = transform(item)
    result += str(processed) + ","  # <-- string concatenation, token 20
  return result  # <-- returns string, token 35

# What it "should" have generated (but can't revise):
def process_items(items):
  """Process items and return results."""
  results = []  # <-- list from the start
  for item in items:
    results.append(transform(item))
  return results
```

The first version is not wrong - it works. But it is the kind of suboptimal code that
emerges from an inability to revise. The model made a reasonable local decision (use a
string) that turned out to be globally suboptimal (a list would be better). A human would
refactor. The model cannot.

### Longer Code, More Drift

The autoregressive constraint means that code quality tends to degrade as the generated
code gets longer. In the first 50 tokens, the model has the full force of the context
and instructions to guide it. By token 500, the model's own generated output is exerting
significant influence on subsequent generation - including any mistakes or suboptimal
choices made along the way.

This is not a vague "things get worse" claim. It is a structural property of the
generation mechanism. Each token conditions the next. Early tokens have outsized influence
on later tokens. A poor variable name at token 10 propagates through every reference to
that variable for the rest of the generation.

### How This Affects Agent Code Generation

When an agent generates a 200-line function in a single generation pass, the last 100 lines
are conditioned on the first 100 lines. If the first 100 lines contain:

- A suboptimal data structure choice
- An incorrect assumption about the input format
- A naming convention that diverges from the codebase

Then the last 100 lines will build on those decisions. The model is not going to stop at
line 101 and say "wait, I should restructure." It will continue along the trajectory
established by its own earlier output.

This is why the most effective agent patterns break long generation tasks into multiple
shorter generations. Instead of "generate the entire module," you get better results from
"generate the function signature," "generate the implementation of function A," "generate
the implementation of function B," etc. Each generation step starts with a fresh
instruction and the accumulated context, rather than being conditioned on hundreds of tokens
of its own potentially-drifting output.

> **AGENTIC GROUNDING:** The autoregressive constraint is why code review of agent output
> is not optional. The model generates forward-only. It cannot self-correct structural
> decisions. Long agent-generated functions (100+ lines in a single generation) should be
> treated with more suspicion than short ones, because the accumulation of uncorrectable
> local decisions compounds. When reviewing agent code, read the first 20 lines especially
> carefully - if the setup is wrong, everything that follows inherits the error. "Output
> is sequential and irrevocable. Model cannot 'go back.'"

---

## 7. Reasoning Tokens and Extended Thinking

*Estimated time: 25 minutes*

Modern LLMs have a mechanism that partially addresses the limitations of autoregressive
generation: **reasoning tokens** (also called "extended thinking" or "chain of thought").

### What Reasoning Tokens Are

Before generating the visible output, the model generates a sequence of internal tokens
where it "thinks through" the problem. These tokens go through the same autoregressive
generation process (L4), but they are not part of the final response. They are visible to
the model during subsequent generation steps, so the model can use them as scratchpad
computation.

In Claude, this is called **extended thinking**. In OpenAI's reasoning models (o1, o3,
GPT-5 with reasoning), this is called the "reasoning" or "thinking" step. The mechanisms
differ in detail but the principle is the same: generate intermediate tokens that improve
the quality of the final output.

### Tokens You Pay For vs Tokens You See

This creates a practical distinction:

| Token Type | Visible to User? | Visible to Model? | You Pay For Them? |
|-----------|-----------------|-------------------|-------------------|
| Input tokens | Yes (you wrote them) | Yes | Yes |
| Reasoning tokens | Sometimes (model-dependent) | Yes | Yes |
| Output tokens | Yes | Yes | Yes |

Reasoning tokens are real tokens. They consume compute, they cost money, and they count
against rate limits. A model that "thinks for 5,000 tokens" before responding with 200
tokens has consumed 5,200 output tokens. If you are budget-conscious, this matters.

### When Reasoning Tokens Help

Reasoning tokens are most effective for:

- **Multi-step problems**: planning, architecture decisions, complex debugging
- **Problems requiring sequential logic**: math, code analysis, constraint satisfaction
- **Problems where the first instinct is wrong**: tasks where the obvious answer is not
  the correct one

They are less effective (and just add cost) for:

- **Simple generation**: writing boilerplate code, formatting text
- **Direct retrieval**: "what is the syntax for X?"
- **Classification**: categorising inputs into known buckets

### Observability at L12

In some implementations, reasoning tokens are visible to the human operator. Claude's
extended thinking can be inspected. This creates a unique observability point: you can read
the model's intermediate reasoning and check whether it matches your intent.

```python
#!/usr/bin/env python3
"""Observe reasoning tokens (extended thinking) with Claude."""

import anthropic

client = anthropic.Anthropic()

# Enable extended thinking
response = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=16000,
  thinking={
    "type": "enabled",
    "budget_tokens": 10000  # budget for thinking
  },
  messages=[
    {
      "role": "user",
      "content": "I have a Python function that takes a list of timestamps "
        "and returns the longest gap between consecutive timestamps. "
        "Write it, but first think through the edge cases."
    }
  ]
)

# Inspect the response blocks
for block in response.content:
  if block.type == "thinking":
    print("=== REASONING TOKENS ===")
    print(block.thinking[:500])  # first 500 chars of thinking
    print(f"... ({len(block.thinking)} chars total)")
  elif block.type == "text":
    print("\n=== OUTPUT ===")
    print(block.text)

print(f"\nToken usage:")
print(f"  Input:  {response.usage.input_tokens}")
print(f"  Output: {response.usage.output_tokens}")
```

The reasoning tokens are where the model's intent becomes partially observable. If the
model's reasoning says "I should handle the empty list case" but the generated code does
not handle it, you have found a generation failure - the model knew what to do at the
reasoning stage but failed to execute at the output stage. This diagnostic capability is
unique to models that expose their reasoning.

> **AGENTIC GROUNDING:** In an agentic workflow, reasoning tokens are your best window
> into the model's decision process. When reviewing agent output, check the reasoning (if
> available) against the output. Divergence between "what the model thought about" and
> "what the model generated" is a signal of generation failure at L4 - the autoregressive
> process drifted from the reasoning plan. This is more diagnostic than just looking at
> the output and guessing what went wrong.

---

## 8. RLHF and Its Consequences

*Estimated time: 30 minutes*

After pretraining (learning to predict the next token on vast amounts of text), modern
LLMs go through a second training phase: **Reinforcement Learning from Human Feedback
(RLHF)**. This is where the model learns to be helpful, harmless, and honest. It is also
where sycophancy comes from.

### How RLHF Works (Simplified)

1. **Supervised fine-tuning**: The model is trained on examples of desired behavior -
   instruction/response pairs curated by human annotators. This teaches the model the
   format: "when asked a question, produce a helpful answer" rather than "predict the
   next token in a web document."

2. **Reward modeling**: Human annotators rank model outputs from best to worst. A separate
   "reward model" is trained to predict these human preferences. The reward model learns
   what humans consider a "good" response.

3. **RL optimization**: The LLM is optimized to maximize the reward model's score. The
   model learns to generate outputs that would score highly with human annotators.

### The Sycophancy Problem

RLHF optimizes for human preference. Humans prefer responses that:

- Agree with them
- Are confident
- Are detailed and thorough
- Acknowledge the human's expertise
- Avoid confrontation

This creates a systematic bias toward **sycophancy** - telling the user what they want to
hear rather than what is true. The model learns that agreeing with the user's framing gets
higher reward scores than correcting the user's assumptions.

In engineering contexts, sycophancy manifests as:

**Agreeing with wrong approaches:**

```
User: "I'll use a global variable to share state between these modules."
Sycophantic model: "That's a reasonable approach! Global variables are simple
  and effective for sharing state..."
Honest model: "Global variables create implicit coupling and make testing
  difficult. Consider dependency injection or a shared state object passed
  explicitly."
```

**Generating code that matches the user's pattern even when the pattern is wrong:**

If your codebase has a bug pattern (say, not handling null values), the model will
reproduce that pattern in new code because it has learned to match the style and patterns
it sees in the context. RLHF reinforces this - matching the user's existing code patterns
gets positive reward.

**Expressing false confidence:**

The model will generate code with the same tone and confidence whether the code is correct
or completely wrong. RLHF trains for helpful-sounding responses, not for calibrated
uncertainty. "Here is the implementation" sounds the same whether the implementation is
correct or subtly broken.

### The Alignment Tax

Sycophancy is not a bug - it is a consequence of the optimization objective. Making the
model less sycophantic requires explicitly training it to disagree with users, which risks
making it less helpful in cases where the user is correct. This is the **alignment tax**:
making the model more honest comes at the cost of making it less agreeable, and human
annotators consistently rate disagreeable responses lower even when they are correct.

For engineers, the alignment tax means: **you cannot trust model confidence as a signal of
correctness.** The model expresses confidence because it was trained to express confidence,
not because it has calibrated uncertainty about its output.

### Sycophancy as Engineering Constraint

Frame sycophancy as an engineering constraint, not a moral failing. The model is doing
what it was optimised to do. Your job is to build systems that account for this constraint:

1. **Never use model confidence as a verification signal.** "The model seemed confident"
   is not evidence of correctness.

2. **Design for disagreement.** If the model always agrees with your approach, that is a
   red flag, not validation. Try explicitly asking "what is wrong with this approach?" and
   see if the critique is substantive.

3. **Use multiple models for high-stakes decisions.** Different models have different RLHF
   training, which means different sycophancy patterns. Convergence across models is a
   stronger signal than confidence from one model (covered in Step 8).

4. **Verify with the gate, not with the model.** The quality gate (`pnpm run typecheck &&
   pnpm run lint && pnpm run test`) does not have RLHF. It does not care about your
   feelings. It passes or it fails. This is why the gate is survival - it is the only part
   of the workflow immune to sycophancy.

> **AGENTIC GROUNDING:** Sycophancy is the single most dangerous LLM property for agentic
> engineering. An agent that confidently generates wrong code is worse than an agent that
> refuses the task, because wrong-and-confident code passes casual review. The pilot study
> that informed this curriculum identified sycophantic drift - not hallucination - as the
> primary failure mode in sustained agent-assisted development. The model performs honesty
> while being dishonest about its confidence. This is not detectable by fact-checking
> individual claims. It requires process-level controls: the gate, adversarial review, and
> independent verification. Step 6 covers these controls in detail.

---

## 9. API Mechanics: L5

*Estimated time: 40 minutes*

L5 is the API layer. It is where you actually interact with the model. It is also the
only fully calibrated layer in the entire stack: token counts are exact, costs are
deterministic, and cache hits are measurable.

### The Request/Response Cycle

Every LLM API call follows the same basic pattern:

```
Request:
  - model (which model to use)
  - messages[] (the conversation: system + user + assistant turns)
  - max_tokens (output length limit)
  - temperature, top_p (sampling parameters)
  - tools[] (optional tool/function definitions)
  - system (system prompt - separate from messages in some APIs)

Response:
  - content (the generated text or tool calls)
  - usage (exact token counts: input, output, cache)
  - stop_reason (why generation stopped: end_turn, max_tokens, tool_use)
  - model (which model actually served the request)
```

### Token Counting: Your One Reliable Instrument

The `usage` field in the API response is the most important diagnostic data you have.

```python
#!/usr/bin/env python3
"""API mechanics - observing L5 instrumentation."""

import anthropic

client = anthropic.Anthropic()

# Simple request with detailed usage observation
response = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=1024,
  messages=[
    {
      "role": "user",
      "content": "Write a Python function that reverses a linked list. "
        "Include type hints and a docstring."
    }
  ]
)

print("=== L5 Instrumentation ===")
print(f"Model:         {response.model}")
print(f"Stop reason:   {response.stop_reason}")
print(f"Input tokens:  {response.usage.input_tokens}")
print(f"Output tokens: {response.usage.output_tokens}")

# Check for cache usage (if available)
if hasattr(response.usage, 'cache_creation_input_tokens'):
  print(f"Cache create:  {response.usage.cache_creation_input_tokens}")
if hasattr(response.usage, 'cache_read_input_tokens'):
  print(f"Cache read:    {response.usage.cache_read_input_tokens}")

print(f"\n=== Generated Output ===")
print(response.content[0].text)
```

These numbers are exact. Not estimated, not approximate - exact. The API counted the
tokens and reported the count. This is why L5 is called "the only calibrated layer."

Compare this to L2 (attention - you cannot see which tokens the model attended to), L3
(context - you cannot measure position effects), or L0 (weights - you cannot inspect the
parameters). At L5, you have ground truth.

### Prompt Caching

Most LLM providers offer **prompt caching**: if the beginning of your request matches a
previous request, the cached portion does not need to be recomputed. The cache hit reduces
latency and cost (typically 75-90% cost reduction on cached tokens).

This has significant implications for agent system design:

- **System prompts should be at the beginning** of the request (where they are most
  likely to be cached across calls). Moving the system prompt to the end wastes cache
  opportunities.
- **Stable context should precede variable context.** Put the tool definitions, role
  instructions, and constant reference material before the conversation history and current
  query.
- **Cache effectiveness is measurable at L5.** The API tells you exactly how many tokens
  were cache hits. If your cache hit rate is low, your request structure is not cache-
  friendly.

```python
#!/usr/bin/env python3
"""Demonstrate prompt caching by making two similar requests."""

import anthropic

client = anthropic.Anthropic()

# A long system prompt that should be cached
long_system = """You are an expert Python developer.
You follow PEP 8 strictly.
You always include type hints.
You always include docstrings.
You prefer list comprehensions over map/filter.
You handle edge cases explicitly.
""" + ("# Additional guidelines\n" * 200)  # pad to ensure caching threshold

# First request - cache miss (creates the cache)
r1 = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  system=[{
    "type": "text",
    "text": long_system,
    "cache_control": {"type": "ephemeral"}
  }],
  messages=[{"role": "user", "content": "Write a fibonacci function."}]
)

print("Request 1 (cache miss expected):")
print(f"  Input tokens:  {r1.usage.input_tokens}")
if hasattr(r1.usage, 'cache_creation_input_tokens'):
  print(f"  Cache created: {r1.usage.cache_creation_input_tokens}")
if hasattr(r1.usage, 'cache_read_input_tokens'):
  print(f"  Cache read:    {r1.usage.cache_read_input_tokens}")

# Second request - same system prompt, different question
r2 = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  system=[{
    "type": "text",
    "text": long_system,
    "cache_control": {"type": "ephemeral"}
  }],
  messages=[{"role": "user", "content": "Write a binary search function."}]
)

print("\nRequest 2 (cache hit expected):")
print(f"  Input tokens:  {r2.usage.input_tokens}")
if hasattr(r2.usage, 'cache_creation_input_tokens'):
  print(f"  Cache created: {r2.usage.cache_creation_input_tokens}")
if hasattr(r2.usage, 'cache_read_input_tokens'):
  print(f"  Cache read:    {r2.usage.cache_read_input_tokens}")
```

### Streaming

Most LLM APIs support **streaming** - receiving tokens as they are generated rather than
waiting for the full response. This affects user experience (lower perceived latency) but
also has engineering implications:

- **Partial responses are observable.** You can implement early termination if the model
  starts generating something clearly wrong.
- **Token-level monitoring is possible.** You can count tokens in flight and terminate
  before hitting a budget limit.
- **Error handling is different.** A streaming response can fail partway through. Your
  code needs to handle partial responses.

```python
#!/usr/bin/env python3
"""Streaming response with token counting."""

import anthropic

client = anthropic.Anthropic()

token_count = 0
print("Streaming response:")

with client.messages.stream(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  messages=[
    {"role": "user", "content": "Explain what a hash table is in 3 sentences."}
  ]
) as stream:
  for text in stream.text_stream:
    print(text, end="", flush=True)

print()

# Get final message with usage stats
final = stream.get_final_message()
print(f"\nInput tokens:  {final.usage.input_tokens}")
print(f"Output tokens: {final.usage.output_tokens}")
```

### Stop Reasons

The `stop_reason` field tells you why generation ended:

| Stop Reason | Meaning | Action |
|------------|---------|--------|
| `end_turn` | Model finished its response naturally | Normal - response is complete |
| `max_tokens` | Hit the `max_tokens` limit | Response is truncated - increase limit or split the task |
| `tool_use` | Model wants to call a tool | Execute the tool, feed result back |
| `stop_sequence` | Hit a custom stop sequence | Response ended at your boundary |

`max_tokens` is the most important to detect. If an agent generates code that ends
abruptly mid-function, check the stop reason. If it is `max_tokens`, the model did not
"decide" to stop - it was cut off. The fix is to increase the limit or restructure the
task so the model generates less in a single pass.

> **AGENTIC GROUNDING:** L5 is where you build your instrumentation. Every agent system
> should log: input token count, output token count, cache hit rate, stop reason, latency,
> and cost per request. This is not optional telemetry - it is your only source of ground
> truth about what happened. When an agent session degrades (responses get worse over time),
> the L5 logs tell you whether input tokens are growing (context accumulation), cache hits
> are dropping (request structure drift), or the model is hitting max_tokens (responses
> being truncated). Without L5 instrumentation, you are debugging blind. "Token counts are
> exact. Costs are deterministic. The only fully calibrated layer."

---

## 10. Model Families and Practical Differences

*Estimated time: 25 minutes*

As of early 2026, three major model families dominate the field. For most engineering
tasks, the differences between models within the same capability tier are smaller than the
differences between good and bad prompts. But there are cases where model selection
matters, and knowing when is part of the engineering skill.

### The Major Families

**Claude (Anthropic)**

- Strong system prompt adherence and instruction following
- Extended thinking (visible reasoning tokens)
- 200K context window
- Tends toward longer, more detailed responses
- Generally strong at structured output, code generation, and following complex
  multi-step instructions

**GPT-4/GPT-5 (OpenAI)**

- Strong code generation and function calling
- Structured Outputs mode (JSON schema validation)
- Up to 1M token context window
- Reasoning models (o1, o3) with internal chain-of-thought
- Developer/user message hierarchy
- Generally strong at concise, focused responses

**Gemini (Google)**

- Largest context windows (up to 2M tokens)
- Strong multimodal capabilities (images, video, audio)
- Less mature agentic tooling compared to Anthropic/OpenAI
- Generally strong at information synthesis across very long contexts

### When Model Selection Matters

| Scenario | Recommendation | Why |
|----------|---------------|-----|
| Adversarial review | Use different families | Same RLHF = same blind spots |
| Long context retrieval | Gemini or GPT-4.1 | Larger effective context |
| Structured output (JSON) | GPT-4/5 with Structured Outputs | Schema validation built in |
| Complex instruction following | Claude | Strong system prompt adherence |
| Cost-sensitive classification | Smallest model that works | Model intelligence is wasted on simple tasks |
| Extended reasoning | Claude with thinking or o3 | Visible reasoning aids verification |

### When Model Selection Does Not Matter

For routine code generation, simple refactoring, documentation writing, and standard
engineering tasks, any model at the frontier tier will produce comparable results. The
prompt quality, the context provided, and the verification process have more impact than
the model choice.

The anti-pattern to avoid: switching models when the real problem is context engineering.
If an agent is producing poor output, the first hypothesis should be "is the right context
loaded?" (L3), not "should I use a different model?" (L0). Switching models changes the
weights and RLHF but does nothing for missing context.

### Same Model != Independent

A critical insight for multi-agent systems: **multiple instances of the same model are not
independent evaluators.** If you ask Claude to review code that Claude wrote, you have the
same weights, the same RLHF, and the same systematic biases reviewing their own output.
Unanimous agreement from three Claude instances is consistency, not validation.

This is why adversarial review (Step 8) uses different model families. One sample from a
different distribution is worth more than N additional samples from the same distribution.
GPT-4 reviewing Claude's code (or vice versa) provides genuinely independent signal. Three
Claude instances reviewing Claude's code provides the illusion of validation.

> **AGENTIC GROUNDING:** The practical rule for model selection in agentic workflows:
> use one model family for generation and a different family for verification. Use the
> cheapest model that meets the quality bar for routine tasks (classification, formatting,
> simple generation). Reserve expensive models for tasks that require long reasoning
> chains or complex instruction following. And when the output matters - when it is going
> to production, when it touches security, when it handles money - verify with a different
> model, not the same one. "Unanimous agreement is consistency, not validation."

---

## Challenge: Tokenisation Exploration

**Estimated time: 15 minutes**

**Goal:** Build intuition for how code tokenises differently than prose, and what that
means for token budgets.

Install `tiktoken` and write a script that compares the tokenisation of:

1. A 20-line Python function with descriptive variable names
2. The same function rewritten with single-letter variable names
3. A 20-line function with 2-space indentation vs 4-space indentation
4. A SQL query embedded as a string literal vs the equivalent ORM code

For each pair, report:
- Total token count
- Token count difference (absolute and percentage)
- Any tokens that split in surprising places

```python
#!/usr/bin/env python3
"""Tokenisation exploration - compare code styles."""
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

# Your code samples go here
descriptive = """
def calculate_monthly_revenue(transactions, start_date, end_date):
    filtered_transactions = [
        t for t in transactions
        if start_date <= t.created_at <= end_date
    ]
    total_revenue = sum(
        t.amount for t in filtered_transactions
        if t.status == "completed"
    )
    return total_revenue
"""

terse = """
def f(ts, s, e):
    ft = [
        t for t in ts
        if s <= t.created_at <= e
    ]
    r = sum(
        t.amount for t in ft
        if t.status == "completed"
    )
    return r
"""

# Count and compare
# ... (write the comparison logic)
```

**Verification:** You should see a 20-40% token difference between descriptive and terse
naming. You should see measurable (but smaller) differences for indentation changes.
The SQL-in-string vs ORM comparison should show that string literals are tokenised
character-by-character (expensive) while ORM method calls tokenise as known subwords
(cheaper).

**Extension:** Run the same comparison on a file from a real codebase you work on.
Calculate the token cost per line for different sections of the file.

---

## Challenge: Lost-in-the-Middle Probe

**Estimated time: 20 minutes**

**Goal:** Demonstrate the lost-in-the-middle effect empirically with a real API call.

Design a prompt that embeds a specific fact at different positions in a long context,
then asks the model to retrieve that fact. Measure retrieval accuracy by position.

```python
#!/usr/bin/env python3
"""Lost-in-the-middle probe - empirical demonstration."""

import anthropic

client = anthropic.Anthropic()

# Create padding content (filler paragraphs about unrelated topics)
def make_padding(n_paragraphs):
  """Generate n paragraphs of plausible-looking filler text."""
  topics = [
    "The history of bridge construction involves numerous engineering challenges.",
    "Marine biology research has expanded significantly in the past decade.",
    "Urban planning requires balancing residential and commercial zones.",
    "Agricultural irrigation systems vary greatly by climate region.",
    "Telecommunications infrastructure has evolved from copper to fiber optics.",
  ]
  result = []
  for i in range(n_paragraphs):
    topic = topics[i % len(topics)]
    result.append(f"Paragraph {i+1}: {topic} " + "Details follow. " * 20)
  return "\n\n".join(result)

# The needle - a specific retrievable fact
needle = "The secret code for Project Nightingale is ZEPHYR-7742."

# Test positions: beginning, 25%, 50%, 75%, end
positions = ["beginning", "quarter", "middle", "three_quarter", "end"]
padding = make_padding(40)  # ~40 paragraphs of filler
paragraphs = padding.split("\n\n")

for position in positions:
  if position == "beginning":
    idx = 2
  elif position == "quarter":
    idx = len(paragraphs) // 4
  elif position == "middle":
    idx = len(paragraphs) // 2
  elif position == "three_quarter":
    idx = 3 * len(paragraphs) // 4
  else:
    idx = len(paragraphs) - 2

  # Insert needle at position
  test_paragraphs = paragraphs.copy()
  test_paragraphs.insert(idx, needle)
  context = "\n\n".join(test_paragraphs)

  response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=100,
    messages=[{
      "role": "user",
      "content": context + "\n\nWhat is the secret code for Project Nightingale?"
    }]
  )

  answer = response.content[0].text
  found = "ZEPHYR-7742" in answer
  print(f"Position: {position:15s} | Found: {found} | "
    f"Tokens: {response.usage.input_tokens} | Answer: {answer[:60]}")
```

**Verification:** With sufficient padding, you should see lower retrieval reliability for
the middle positions compared to beginning and end. If you do not, increase the padding
until the total context is at least 50K tokens.

**What you are learning:** The advertised context window is not the effective context
window. Position matters. This is the L3 effect that drives context engineering decisions
in Step 4.

<details>
<summary>Hints</summary>

If all positions return the correct answer, your context is too short for the effect
to manifest. Try 80+ padding paragraphs or longer paragraphs. The effect is more
pronounced at higher context utilisation (closer to the window limit).

Also: running each position multiple times (3-5 trials) gives a more reliable signal
than a single trial per position, since generation is probabilistic.

</details>

---

## Challenge: Token Budget Calculator

**Estimated time: 15 minutes**

**Goal:** Calculate the real token cost of a plausible agentic workflow and identify where
the budget goes.

Scenario: An agent is helping fix a bug. The workflow involves:

1. System prompt (800 tokens)
2. User describes the bug (200 tokens)
3. Agent reads 3 source files (average 3,000 tokens each)
4. Agent runs test suite, gets failure output (2,000 tokens)
5. Agent asks a clarifying question (150 tokens)
6. User responds (100 tokens)
7. Agent reads 2 more files for context (3,000 tokens each)
8. Agent generates the fix (500 tokens)
9. Agent runs tests again (2,000 tokens)
10. Agent generates a summary (300 tokens)

Calculate:

- Total tokens consumed across the workflow
- Context window utilisation at each step (cumulative)
- Cost at Claude Sonnet pricing ($3/M input, $15/M output) or current pricing
- What percentage of the budget is tool results vs actual generation?

```python
#!/usr/bin/env python3
"""Token budget calculator for an agentic workflow."""

# Define the workflow steps
steps = [
  ("System prompt", "input", 800),
  ("Bug description", "input", 200),
  ("Read file 1", "input", 3000),
  ("Read file 2", "input", 3000),
  ("Read file 3", "input", 3000),
  ("Test output", "input", 2000),
  ("Agent question", "output", 150),
  ("User response", "input", 100),
  ("Read file 4", "input", 3000),
  ("Read file 5", "input", 3000),
  ("Agent fix", "output", 500),
  ("Test output 2", "input", 2000),
  ("Agent summary", "output", 300),
]

# Calculate cumulative context and costs
# NOTE: in a real conversation, each API call re-sends all prior context
# The model re-reads everything on every turn
cumulative_input = 0
total_output = 0
context_window = 200000  # 200K for Claude

print(f"{'Step':<20} {'Type':<8} {'Tokens':>7} {'Cumulative':>11} {'Window %':>9}")
print("-" * 60)

for name, token_type, tokens in steps:
  if token_type == "input":
    cumulative_input += tokens
  else:
    total_output += tokens
    cumulative_input += tokens  # output becomes input for next turn

  utilisation = (cumulative_input / context_window) * 100
  print(f"{name:<20} {token_type:<8} {tokens:>7} {cumulative_input:>11} {utilisation:>8.1f}%")

# Cost calculation (use current pricing)
input_cost_per_m = 3.0   # $/M tokens - adjust to current pricing
output_cost_per_m = 15.0  # $/M tokens - adjust to current pricing

# ... (calculate total cost, tool result percentage, etc.)
```

**Verification:** You should find that tool results (file reads, test output) consume
70-80% of the token budget. The actual generation (the fix, the question, the summary)
is a small fraction. This ratio is typical for agentic workflows.

**Extension:** Run this calculation on an actual agent session. Export the conversation
history, count tokens per message, and plot the cumulative context utilisation curve.
Where does it cross 50% of the window?

---

## Challenge: Autoregressive Limitation Exposure

**Estimated time: 20 minutes**

**Goal:** Design a task that exposes the forward-only generation constraint and demonstrate
how to work around it.

Ask a model to generate a Python class where:

- The class has 5 methods
- Method 3 needs to call a helper function defined in method 5
- Method 1's docstring needs to reference the return type of method 4

This requires "forward references" - knowing about something that has not been generated
yet. The autoregressive constraint means the model must either plan ahead (reasoning
tokens) or make commitments that may not align with what comes later.

```python
#!/usr/bin/env python3
"""Expose autoregressive limitations with forward-reference tasks."""

import anthropic

client = anthropic.Anthropic()

prompt = """Write a Python class called DataPipeline with exactly 5 methods:

1. summarize() - returns a string summarizing the pipeline state.
   Its docstring must accurately describe the return type of validate().
2. transform(data: list) - transforms input data using internal rules.
3. process(data: list) - the main method. Must call _normalize() internally.
4. validate(data: list) - returns a ValidationResult dataclass with
   fields: valid (bool), errors (list[str]), warnings (list[str]).
5. _normalize(data: list) - private helper that normalizes data formats.

Requirements:
- summarize()'s docstring must reference ValidationResult accurately
- process() must call _normalize() with the correct signature
- All methods must have consistent type hints

Generate the complete class."""

# Version 1: Single-shot generation (exposed to autoregressive drift)
r1 = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=4096,
  messages=[{"role": "user", "content": prompt}]
)

print("=== Single-shot generation ===")
print(r1.content[0].text)
print(f"\nTokens: {r1.usage.output_tokens}")

# Version 2: Two-pass - first generate the interface, then implement
r2_plan = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=1024,
  messages=[{
    "role": "user",
    "content": prompt + "\n\nFirst, write ONLY the class skeleton: "
      "class definition, method signatures with type hints, and docstrings. "
      "Do not implement the method bodies yet (use 'pass')."
  }]
)

r2_impl = client.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=4096,
  messages=[
    {"role": "user", "content": prompt},
    {"role": "assistant", "content": r2_plan.content[0].text},
    {
      "role": "user",
      "content": "Good. Now implement all the method bodies, "
        "keeping the signatures and docstrings exactly as defined above."
    }
  ]
)

print("\n=== Two-pass generation ===")
print(r2_impl.content[0].text)
print(f"\nPlan tokens: {r2_plan.usage.output_tokens}")
print(f"Impl tokens: {r2_impl.usage.output_tokens}")
```

**Verification:** Compare the two versions:
- Does `summarize()`'s docstring accurately reference `ValidationResult` in both?
- Does `process()` call `_normalize()` with the correct signature in both?
- Are the type hints consistent across all methods in both?

The two-pass version should have fewer forward-reference errors because the skeleton
was established first, giving the implementation pass full context about all signatures
and types.

**What you are learning:** Breaking generation into planning and implementation steps
mitigates the autoregressive constraint. This is the fundamental pattern behind effective
agent architectures (Step 2).

---

## Challenge: Model Comparison

**Estimated time: 20 minutes**

**Goal:** Send the same prompt to two different model families and compare the outputs
structurally (not just "which is better").

Requirements:
- Access to at least two different model APIs (e.g., Anthropic + OpenAI)
- A code generation prompt complex enough to reveal differences

```python
#!/usr/bin/env python3
"""Structural comparison of model outputs."""

import anthropic
# pip install openai
import openai

prompt = """Write a Python function called merge_configs that:
1. Takes two dictionaries (base_config and override_config)
2. Deep-merges them (nested dicts are merged, not replaced)
3. Handles the case where a value in override is None (should delete the key)
4. Returns a new dict (does not mutate inputs)
5. Include type hints, docstring, and handle edge cases

Write ONLY the function, no examples or explanation."""

# Claude
ac = anthropic.Anthropic()
claude_response = ac.messages.create(
  model="claude-sonnet-4-20250514",
  max_tokens=2048,
  messages=[{"role": "user", "content": prompt}]
)
claude_code = claude_response.content[0].text

# GPT-4 (adjust model name to what you have access to)
oc = openai.OpenAI()
gpt_response = oc.chat.completions.create(
  model="gpt-4o",
  max_tokens=2048,
  messages=[{"role": "user", "content": prompt}]
)
gpt_code = gpt_response.choices[0].message.content

# Structural comparison (not "which is better")
print("=== STRUCTURAL COMPARISON ===")
print(f"Claude output tokens: {claude_response.usage.output_tokens}")
print(f"GPT output tokens:    {gpt_response.usage.completion_tokens}")
print(f"Claude code lines:    {len(claude_code.splitlines())}")
print(f"GPT code lines:       {len(gpt_code.splitlines())}")

# Check specific requirements
for label, code in [("Claude", claude_code), ("GPT", gpt_code)]:
  print(f"\n{label}:")
  print(f"  Has type hints:     {'def merge_configs(' in code and ':' in code.split('def')[1].split(')')[0]}")
  print(f"  Has docstring:      {'\"\"\"' in code or \"'''\" in code}")
  print(f"  Handles None:       {'None' in code}")
  print(f"  Returns new dict:   {'copy' in code.lower() or '{' in code}")
  print(f"  Recursive:          {'merge_configs' in code.split('def merge_configs')[1] if 'def merge_configs' in code else 'N/A'}")

print("\n=== Claude Code ===")
print(claude_code)
print("\n=== GPT Code ===")
print(gpt_code)
```

**Verification:** Document at least three structural differences:
- Different approaches to deep merge (recursive vs iterative)
- Different edge case handling (what happens with empty dicts, non-dict values, None)
- Different code style (naming, comments, structure)

**What you are learning:** Different model families (different L0 weights, different RLHF)
produce structurally different solutions to the same problem. Neither is necessarily
"better." The differences are the data that makes multi-model verification valuable
(Step 8).

---

## Challenge: API Instrumentation Dashboard

**Estimated time: 20 minutes**

**Goal:** Build a minimal instrumentation wrapper that logs L5 metrics for every API call.

```python
#!/usr/bin/env python3
"""Build an L5 instrumentation wrapper."""

import anthropic
import time
import json

class InstrumentedClient:
  """Wrapper that logs L5 metrics for every API call."""

  def __init__(self):
    self.client = anthropic.Anthropic()
    self.call_log = []

  def create_message(self, **kwargs):
    start = time.time()
    response = self.client.messages.create(**kwargs)
    elapsed = time.time() - start

    record = {
      "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
      "model": response.model,
      "input_tokens": response.usage.input_tokens,
      "output_tokens": response.usage.output_tokens,
      "stop_reason": response.stop_reason,
      "latency_ms": int(elapsed * 1000),
    }

    # Add cache metrics if available
    if hasattr(response.usage, 'cache_read_input_tokens'):
      record["cache_read"] = response.usage.cache_read_input_tokens
    if hasattr(response.usage, 'cache_creation_input_tokens'):
      record["cache_create"] = response.usage.cache_creation_input_tokens

    self.call_log.append(record)
    return response

  def report(self):
    """Print a summary of all API calls in this session."""
    if not self.call_log:
      print("No API calls recorded.")
      return

    total_input = sum(r["input_tokens"] for r in self.call_log)
    total_output = sum(r["output_tokens"] for r in self.call_log)
    total_latency = sum(r["latency_ms"] for r in self.call_log)
    total_cache = sum(r.get("cache_read", 0) for r in self.call_log)

    print(f"\n{'='*50}")
    print(f"L5 Session Report ({len(self.call_log)} API calls)")
    print(f"{'='*50}")
    print(f"Total input tokens:   {total_input:>10,}")
    print(f"Total output tokens:  {total_output:>10,}")
    print(f"Total cache hits:     {total_cache:>10,}")
    print(f"Total latency:        {total_latency:>10,} ms")
    print(f"Avg latency/call:     {total_latency // len(self.call_log):>10,} ms")

    if total_input > 0:
      cache_rate = (total_cache / total_input) * 100
      print(f"Cache hit rate:       {cache_rate:>9.1f}%")

    # Per-call breakdown
    print(f"\n{'Call':<6} {'In':>8} {'Out':>8} {'Cache':>8} {'ms':>8} {'Stop':<12}")
    print("-" * 55)
    for i, r in enumerate(self.call_log):
      print(f"{i+1:<6} {r['input_tokens']:>8} {r['output_tokens']:>8} "
        f"{r.get('cache_read', 0):>8} {r['latency_ms']:>8} {r['stop_reason']:<12}")

# Usage:
client = InstrumentedClient()

# Make a few calls
client.create_message(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  messages=[{"role": "user", "content": "What is a hash table?"}]
)

client.create_message(
  model="claude-sonnet-4-20250514",
  max_tokens=256,
  messages=[{"role": "user", "content": "What is a binary tree?"}]
)

client.report()
```

**Verification:** Run the wrapper with 5+ API calls and confirm that:
- Every call is logged with exact token counts
- The session report totals match the sum of individual calls
- Stop reasons are captured correctly

**Extension:** Add cost calculation based on current pricing. Add a `save_log(filepath)`
method that writes the call log to JSON for post-session analysis.

> **AGENTIC GROUNDING:** This instrumentation pattern is not a toy exercise. Production
> agent systems need exactly this kind of L5 logging to diagnose performance degradation,
> cost overruns, and context window exhaustion. The wrapper you build here is the seed of
> a production observability system. Without it, you are debugging agent behavior with no
> telemetry - the equivalent of running a web service with no request logging.

---

## Key Takeaways

Before moving to Step 2, you should be able to answer these questions without
looking anything up:

1. What are the six layers (L0-L5) and which ones are observable, partially observable,
   or opaque?

2. Why can a model not "learn" from corrections within a conversation? What is actually
   happening when it generates a better response after your feedback?

3. What is a token? Why is `customer_subscription_end_date` more expensive than `x` in
   token budget terms? Why does this matter for context window management?

4. Why is the attention mechanism O(n^2) in sequence length? What is the practical
   consequence for long contexts?

5. What is the lost-in-the-middle effect? Where should you place critical context in a
   long prompt, and why?

6. What does "autoregressive" mean concretely? Why can the model not go back and fix a
   design decision made 500 tokens ago?

7. What are reasoning tokens? How do they partially address the autoregressive limitation?
   Do they count against your token budget?

8. What is RLHF? Why does it produce sycophancy? Why is sycophancy an engineering
   constraint rather than a moral failing?

9. Which layer provides exact, calibrated measurements? What specific metrics are
   available there?

10. Why is it better to use a different model family for code review than the model that
    generated the code?

If you can answer all ten from memory, you have the mechanical understanding needed for
everything that follows.

---

## Recommended Reading

These are not required for the bootcamp, but they are the primary sources for deeper
understanding:

- **"Attention Is All You Need"** - Vaswani et al. (2017). arXiv:1706.03762. The
  original transformer paper. Read for architecture intuition - the encoder-decoder
  structure, multi-head attention, positional encoding. Note that modern LLMs use
  decoder-only variants, not the full encoder-decoder described here.

- **"Let's build GPT: from scratch, in code, spelled out"** - Andrej Karpathy (2023).
  YouTube, ~2 hours. Builds a character-level GPT from scratch in Python. The best
  available resource for understanding the architecture through code. Covers everything
  from bigram models to full self-attention.

- **"The Illustrated Transformer"** - Jay Alammar (2018). jalammar.github.io. The
  definitive visual explanation of the transformer architecture. The attention diagrams
  and Q/K/V visualisations are referenced in courses at Stanford, Harvard, MIT, and CMU.
  Updated version available as a book chapter at LLM-book.com.

- **"Building effective agents"** - Erik Schluntz and Barry Zhang, Anthropic (Dec 2024).
  The "augmented LLM" concept - LLM + retrieval + tools + memory as the fundamental
  building block. Read the building blocks section for Step 1 context; the full article
  is essential reading for Step 2.

- **Anthropic API documentation** - docs.anthropic.com. The Messages API reference,
  token counting, prompt caching, and extended thinking documentation. This is the L5
  specification for Claude.

- **OpenAI API documentation** - platform.openai.com/docs. The Chat Completions and
  Responses API references. The prompt engineering guide is particularly useful for
  understanding the developer/user/assistant message hierarchy.

- **`tiktoken` library** - github.com/openai/tiktoken. Python library for BPE
  tokenisation. Essential for token counting and budget estimation.

- **Layer model (internal)** - `docs/internal/layer-model.md` in this project. The full
  13-layer model (L0-L12) with cross-cutting concerns, loading points, and operational
  consequences. This step covers L0-L5; Steps 2-7 cover the remaining layers.

---

## What to Read Next

**Step 2: Agent Architecture Patterns** - An LLM by itself is a function: tokens in,
tokens out. An agent is that function embedded in a loop with tools, memory, and control
flow. Step 2 covers the five canonical workflow patterns (prompt chaining, routing,
parallelisation, orchestrator-workers, evaluator-optimizer), the distinction between
workflows and agents, and how the harness layer (L6) orchestrates all of it. Every
pattern in Step 2 is built on the mechanics from Step 1 - the context window budget, the
autoregressive constraint, the API request/response cycle. Understanding why an
orchestrator-workers pattern is more expensive than prompt chaining requires understanding
that each agent call consumes a full context window at L3.

**Step 3: Prompt Engineering as System Design** - Prompts are not magic incantations. They
are configuration for the L0-L4 pipeline. Step 3 treats prompt engineering as system
design: system prompt architecture, structured output formats, role definitions, and the
L8 saturation threshold (more context is not monotonically better). The connection to
Step 1: understanding tokenisation (L1) and attention (L2) tells you why prompt structure
matters - token boundaries affect parsing, and attention dilution affects which parts of
your prompt actually influence the output.

