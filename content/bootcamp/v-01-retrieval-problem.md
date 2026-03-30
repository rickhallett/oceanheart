+++
title = "The Retrieval Problem"
date = "2026-03-10"
description = "Why agents need external knowledge. The naive RAG pipeline. Where it breaks. Retrieval quality metrics."
tags = ["rag", "retrieval", "bootcamp"]
step = 1
tier = 1
estimate = "3-4 hours"
bootcamp = 5
+++

Step 1 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

Estimated total time: 3-4 hours.

**Field maturity:** Established
**Prerequisites:** Bootcamp II Step 4 (context engineering)
**Leads to:** Step 2 (embeddings and vector search)

---

## Why This is Step 1

Every agent system you build or operate will, at some point, need information that is
not in the model's weights. The model finished training months or years before your user
asks a question. The company policy changed last Tuesday. The codebase was refactored
this morning. The customer's order was placed three minutes ago. None of this exists in
the model's parameters. Without retrieval, the model does not know it does not know, and
it will generate a confident, fluent, wrong answer.

This is not a theoretical concern. It is the dominant failure mode of deployed agent
systems. An agent asked to answer questions about your internal documentation will, if
given no retrieval mechanism, confabulate plausible answers from its training data. An
agent asked to search your codebase will hallucinate function signatures that look
correct but do not exist. An agent asked about recent events will describe a version of
reality that was true at training time and is false now.

Retrieval-Augmented Generation (RAG) is the dominant pattern for solving this problem.
The idea is simple: before the model generates an answer, retrieve relevant documents
from an external knowledge base and inject them into the context window. The model then
generates from the combined signal of its parameters and the retrieved evidence. Lewis
et al. (2020) formalized this as combining "parametric memory" (the model's weights)
with "non-parametric memory" (an external document index). The concept predates that
paper - information retrieval is a field with decades of research - but Lewis et al.
gave the pattern its name and demonstrated that the retrieval and generation components
could be trained jointly.

This step has the highest compositional leverage of any step in this bootcamp. Everything
in Tier 1 builds on it: Step 2 (embeddings and vector search) operationalizes the
retrieval mechanism, Step 3 (RAG pipeline engineering) composes it into a production
pipeline, and Step 4 (advanced retrieval patterns) addresses the failure modes you will
learn to identify here. If your understanding of the retrieval problem is shallow, every
subsequent step builds on sand.

The goal is not to memorize the RAG acronym. The goal is to build an understanding of
retrieval quality precise enough that when an agent returns a wrong answer, you can
determine whether the problem was retrieval (wrong documents found), generation (right
documents found, wrong answer produced), or specification (the question itself was
ambiguous) - and know what to fix.

---

## Table of Contents

1. [Why Agents Need External Knowledge](#1-why-agents-need-external-knowledge) (~20 min)
2. [The Context Engineering Connection](#2-the-context-engineering-connection) (~25 min)
3. [The Retrieval Spectrum](#3-the-retrieval-spectrum) (~30 min)
4. [The Naive RAG Pipeline](#4-the-naive-rag-pipeline) (~30 min)
5. [Where Naive RAG Fails](#5-where-naive-rag-fails) (~30 min)
6. [Retrieval Quality Metrics](#6-retrieval-quality-metrics) (~25 min)
7. [When Not to Use RAG](#7-when-not-to-use-rag) (~15 min)
8. [Challenges](#challenges) (~60-90 min)
9. [Key Takeaways](#key-takeaways)
10. [Recommended Reading](#recommended-reading)
11. [What to Read Next](#what-to-read-next)

---

## 1. Why Agents Need External Knowledge

*Estimated time: 20 minutes*

A language model's knowledge has three fundamental limits: it is stale, it is generic,
and it is unverifiable. Understanding each limit precisely is the foundation for
understanding why retrieval exists and when it is necessary.

### Staleness

Language models are trained on snapshots of the world. The training data has a cutoff
date, and everything after that date does not exist in the model's parameters. This is
not a fixable deficiency. Training a model costs millions of dollars and takes weeks or
months. You cannot retrain every time a customer updates their billing address.

The staleness problem compounds in enterprise contexts. Company policies change. Product
lines are added and removed. Organizational structures are reorganized. Regulatory
requirements evolve. A model trained six months ago may have the right structure for
answering compliance questions but the wrong facts for every specific regulation that has
been amended since training.

Consider what happens when an agent is asked: "What is our current refund policy?" If
the model was trained before the most recent policy change, it will generate the old
policy. The answer will be grammatically perfect, structurally sound, and factually
wrong. The user has no way to distinguish this from a correct answer. The model has no
way to know it is wrong.

### Incompleteness

Even at training time, the model's knowledge is incomplete. It was trained on public
internet data, books, and code. It was not trained on your company's internal wiki, your
proprietary codebase, your customer database, or your Slack conversations. This is not a
data quality issue. It is a data access issue. The information the agent needs was never
in the training set and never could be.

This matters most for domain-specific tasks. A legal agent needs access to case law
databases. A medical agent needs access to the latest clinical trial results. A customer
support agent needs access to the specific customer's account history. None of this is in
the model's weights. None of it should be - you do not want your proprietary data in a
model that other customers are also using.

### Unverifiability

When a model generates text from its parameters, there is no citation, no source
document, no evidence chain. The user cannot verify where the information came from. This
is acceptable for creative writing. It is unacceptable for enterprise applications where
decisions are made on the basis of the model's output.

Retrieval provides provenance. When the model generates an answer from a retrieved
document, the system can cite the source. The user can verify. The audit trail exists.
This is not a cosmetic feature. In regulated industries, the ability to trace a decision
back to a source document is a legal requirement.

### The Gap

These three limits create a gap between what the model knows and what the task requires.
The size of this gap determines whether retrieval is necessary:

```
Small gap:   "Explain the concept of recursion"
             The model's parametric knowledge suffices.
             No retrieval needed.

Medium gap:  "What are the top Python web frameworks in 2026?"
             Training data may be slightly stale.
             Retrieval improves accuracy but is not critical.

Large gap:   "What is Customer #4829's current subscription tier?"
             Zero chance this is in training data.
             Retrieval is mandatory.

Total gap:   "Summarize the email thread from this morning."
             Information exists nowhere except the email system.
             Retrieval from a specific system is the only option.
```

The retrieval problem is the problem of closing this gap reliably: finding the right
information, from the right source, at the right time, and delivering it to the model in
a form it can use.

> **AGENTIC GROUNDING:** When an agent produces a wrong answer, the first diagnostic
> question is: "Did the agent have access to the information it needed?" If the answer is
> no, the problem is retrieval, not reasoning. No amount of prompt engineering will fix a
> model that lacks the necessary information. This is the most common misdiagnosis in
> production agent systems - operators tune prompts when they should be fixing retrieval.

> **FIELD VS NOVEL:** The knowledge gap problem is well-established in information
> retrieval (Manning et al. 2008, Ch. 1) and was explicitly framed for LLMs by Lewis et
> al. (2020). The novel contribution from this project is naming the operational state
> that results from this gap: cold context pressure - too little context pushes the model
> to pattern-match from training data instead of solving from provided information (see
> **Bootcamp II Step 4 (context engineering)** for the full context engineering
> vocabulary). Retrieval failure does not produce an error. It produces cold context
> pressure, which produces fluent, confident, wrong output.

---

## 2. The Context Engineering Connection

*Estimated time: 25 minutes*

RAG is not a standalone technology. It is a context engineering strategy. Its job is to
dynamically populate the context window with the information the model needs to produce
correct output for a specific query. Understanding RAG through this lens changes how you
design, evaluate, and debug retrieval systems.

### The Working Set

In 1968, Peter Denning introduced the working set model for virtual memory management.
The core insight: at any point in time, a running program actively uses only a subset of
its total memory pages. If you keep that subset - the working set - in physical RAM, the
program runs efficiently. If any page from the working set is missing, the program
thrashes: it spends more time swapping pages in and out than doing useful work.

The concept maps directly to language model context windows (introduced in **Bootcamp II
Step 4 (context engineering)**, from Denning 1968). At any point in an interaction, the
model needs a specific subset of all possible information to produce a correct response.
This is the working set for that query. If the working set is present in the context
window, the model can produce correct output. If any critical piece is missing, the model
enters the dumb zone - it produces syntactically valid output that is semantically
disconnected from the actual state of the world.

RAG's job, stated precisely, is: **construct the working set for each query and deliver
it to the context window.**

This framing has three immediate practical consequences:

### Consequence 1: Not all context is equal

The working set is the *minimum* context for correct output. It is not "all potentially
relevant context." Retrieving 50 documents when the model needs 3 does not help. It
wastes context window budget, increases cost, and creates noise that can degrade
generation quality. This is hot context pressure - too much in-thread material degrades
signal-to-noise.

The L8 layer in the operational model (Bootcamp II Step 4) documents this precisely:
"excessive L8 loading degrades L4 output quality. More role content is not monotonically
better." The same principle applies to retrieved documents. There is an optimal amount of
retrieval context, and exceeding it hurts performance.

### Consequence 2: Missing context is catastrophic

When the working set is incomplete - when a document the model needs was not retrieved -
the model does not stop and say "I don't have enough information." It generates anyway,
using its parametric knowledge to fill the gap. This is cold context pressure. The model
falls back to pattern-matching from training data, producing output that looks correct
but may be stale, generic, or entirely fabricated.

This failure mode is silent. There is no error message. There is no exception. The model
produces output with the same confidence whether the working set is complete or missing
half its contents. Detecting this failure requires measuring retrieval quality
independently from generation quality - a topic covered in Section 6.

### Consequence 3: The working set changes per query

Unlike a static configuration file that is loaded once at boot time, the retrieval
working set is different for every query. A customer support agent answering "How do I
reset my password?" needs the password reset documentation. The same agent answering
"What is the status of my order?" needs the order management documentation and the
customer's order history. The retrieval system must construct a different working set
each time.

This is what makes retrieval harder than static context loading. The AGENTS.md file in
this project is a static working set - it is loaded at the start of every session because
it contains the minimum context for any task. RAG must construct an equivalent working
set dynamically, for each query, from a potentially massive document collection.

### The Manual RAG Analogy

This project uses a manual retrieval strategy codified as the BFS depth rule (SD-195):
"Depth 1 = every session. Depth 2 = when topic is relevant. Depth 3+ = deliberate
research only." This is a human-operated retrieval policy. The operator decides which
documents to load based on the current task. The BFS depth map in AGENTS.md is the
retrieval index - it tells the operator what exists and where to find it.

RAG automates this process. Instead of a human deciding which documents to load, a
retrieval system takes the query, searches the document index, and returns the most
relevant results. The quality of this automation determines whether the model operates in
the smart zone (working set present, correct output) or the dumb zone (working set
incomplete, degraded output).

```python
# The manual retrieval process, made explicit:

# 1. The "index" - what exists and where
depth_map = {
  1: ["AGENTS.md", "SPEC.md"],           # Always load
  2: ["lib/bouts/DOMAIN.md",             # Load when topic is relevant
      "lib/credits/DOMAIN.md"],
  3: ["docs/internal/session-decisions.md"]  # Research only
}

# 2. The "query" - what does the current task need?
current_task = "Fix the credit settlement bug"

# 3. The "retrieval" - human judgment selects relevant docs
working_set = depth_map[1] + ["lib/credits/DOMAIN.md"]  # d1 + relevant d2

# 4. The "injection" - load into context window
# (In practice: the agent reads these files at session start)

# RAG automates steps 2-4.
# The quality of that automation is the subject of this bootcamp.
```

> **AGENTIC GROUNDING:** Every RAG system is attempting to solve the same problem that
> the BFS depth rule solves manually: "What documents does the model need for this
> specific task?" The difference is that RAG must do this automatically, for arbitrary
> queries, at machine speed. When you evaluate a RAG system, you are evaluating how well
> it approximates the working set that a knowledgeable human would have selected.

> **FIELD VS NOVEL:** RAG as a pattern is well-established (Lewis et al. 2020). The
> working set concept is well-established (Denning 1968). The novel framing here is the
> explicit isomorphism between the two: the working set model from virtual memory maps
> directly to context window management, and RAG's job is to construct the Denning working
> set per query. This framing originates from this project's context engineering
> vocabulary (SD-311) and has no equivalent in the standard RAG literature.

---

## 3. The Retrieval Spectrum

*Estimated time: 30 minutes*

Retrieval is not a single technique. It is a spectrum of approaches with different
tradeoffs in precision, recall, latency, cost, and failure modes. Understanding this
spectrum is essential because production systems almost always use a combination of
approaches, and choosing the right combination requires understanding what each approach
is good at and where it fails.

### Keyword Search: BM25 and TF-IDF

The oldest and simplest retrieval approach: match the words in the query against the
words in the documents. TF-IDF (term frequency - inverse document frequency) and its
successor BM25 are the workhorses of keyword search.

**TF-IDF** scores a document's relevance to a query by multiplying two factors:
- Term Frequency (TF): how often the query term appears in the document (more
  occurrences = more relevant)
- Inverse Document Frequency (IDF): how rare the term is across all documents (rarer
  terms are more discriminative)

A document that mentions "retrieval" 10 times in a collection where only 5% of documents
mention "retrieval" scores higher than a document that mentions "the" 100 times.

**BM25** is a refinement of TF-IDF that adds two improvements:
1. Saturation: after a term appears enough times, additional occurrences contribute
   diminishing returns (prevents long documents from dominating)
2. Document length normalization: adjusts for the fact that longer documents naturally
   have more term occurrences

```python
# BM25 scoring formula (simplified):
#
# score(D, Q) = sum over query terms q_i:
#     IDF(q_i) * (f(q_i, D) * (k1 + 1)) / (f(q_i, D) + k1 * (1 - b + b * |D|/avgdl))
#
# where:
#   f(q_i, D) = frequency of term q_i in document D
#   |D| = length of document D
#   avgdl = average document length in the collection
#   k1 = term frequency saturation parameter (typically 1.2-2.0)
#   b = document length normalization (typically 0.75)
#   IDF(q_i) = log((N - n(q_i) + 0.5) / (n(q_i) + 0.5) + 1)
#   N = total documents, n(q_i) = documents containing q_i

# Practical BM25 with the rank-bm25 library:
# Install: uv pip install rank-bm25

from rank_bm25 import BM25Okapi

documents = [
  "The retrieval system finds relevant documents for the query.",
  "Machine learning models are trained on large datasets.",
  "Information retrieval is a field of computer science.",
  "The cat sat on the mat.",
  "Dense retrieval uses embeddings for semantic matching.",
]

# BM25 requires tokenized documents
tokenized_docs = [doc.lower().split() for doc in documents]
bm25 = BM25Okapi(tokenized_docs)

# Query
query = "how does retrieval find documents?"
tokenized_query = query.lower().split()

# Get scores
scores = bm25.get_scores(tokenized_query)
ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)

for idx, score in ranked[:3]:
  print(f"  Score: {score:.3f} | {documents[idx][:60]}")
```

**Where BM25 excels:**
- Exact term matching: product names, error codes, proper nouns, identifiers
- Speed: BM25 over an inverted index is fast, even on millions of documents
- No training required: works out of the box, no embedding model needed
- Interpretable: you can see exactly which terms matched and why

**Where BM25 fails:**
- Vocabulary mismatch: "automobile" does not match "car"
- Semantic understanding: "happy" does not match "joyful"
- Question-to-statement gap: "What causes retrieval to fail?" does not share many
  terms with "Poor chunk boundaries lead to incomplete context"

### Semantic Search: Embeddings

Semantic search addresses BM25's vocabulary problem by operating in a learned vector
space. Instead of matching exact words, it maps both queries and documents to dense
vectors (embeddings) and measures similarity in that vector space.

An embedding model maps text to a fixed-dimensional vector where texts with similar
meaning are close together (high cosine similarity) and texts with different meaning are
far apart (low cosine similarity). The model learns this mapping during training on
large datasets of similar and dissimilar text pairs.

```python
# Semantic search with sentence-transformers (local, no API key):
# Install: uv pip install sentence-transformers

from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("all-MiniLM-L6-v2")

documents = [
  "The retrieval system finds relevant documents for the query.",
  "Machine learning models are trained on large datasets.",
  "Information retrieval is a field of computer science.",
  "The cat sat on the mat.",
  "Dense retrieval uses embeddings for semantic matching.",
]

# Embed all documents (done once, stored in index)
doc_embeddings = model.encode(documents)

# Embed query (done per query)
query = "how does semantic search work?"
query_embedding = model.encode([query])

# Cosine similarity (embeddings are normalized, so dot product works)
similarities = np.dot(doc_embeddings, query_embedding.T).flatten()
ranked = sorted(enumerate(similarities), key=lambda x: x[1], reverse=True)

for idx, score in ranked[:3]:
  print(f"  Similarity: {score:.3f} | {documents[idx][:60]}")
```

**Where semantic search excels:**
- Vocabulary mismatch: "automobile" and "car" map to nearby vectors
- Conceptual similarity: "password reset procedure" matches "how to change credentials"
- Cross-lingual: some models map similar meanings in different languages to nearby vectors
- Question-to-statement: the query "What causes X?" can match a passage explaining X

**Where semantic search fails:**
- Exact terms: model names, error codes, identifiers may be embedded poorly
- Negation: "not relevant" and "relevant" may have similar embeddings
- Novel terminology: domain-specific jargon not seen during embedding model training
- Subtle distinctions: embeddings may place "Python 2" and "Python 3" very close together
  despite the distinction being critical

### Hybrid Search

The practical answer in production is usually neither keyword nor semantic alone, but a
combination. Hybrid search runs both BM25 and semantic search, then fuses the results.

The simplest fusion method is Reciprocal Rank Fusion (RRF):

```python
# Reciprocal Rank Fusion
#
# For each document, sum 1/(k + rank) across all ranking lists.
# k is typically 60 (prevents over-weighting rank 1).
#
# Example:
#   Doc A: BM25 rank 1, semantic rank 5
#   Doc B: BM25 rank 3, semantic rank 1
#   Doc C: BM25 rank 2, semantic rank 8
#
#   RRF(A) = 1/(60+1) + 1/(60+5) = 0.01639 + 0.01538 = 0.03177
#   RRF(B) = 1/(60+3) + 1/(60+1) = 0.01587 + 0.01639 = 0.03226
#   RRF(C) = 1/(60+2) + 1/(60+8) = 0.01613 + 0.01471 = 0.03084
#
#   Final ranking: B > A > C

def reciprocal_rank_fusion(rankings, k=60):
  """Fuse multiple ranked lists using RRF.

  Args:
    rankings: list of lists, each containing (doc_id, score) tuples
              ordered by score descending
    k: smoothing constant (default 60)

  Returns:
    list of (doc_id, rrf_score) tuples, sorted by rrf_score descending
  """
  rrf_scores = {}
  for ranking in rankings:
    for rank, (doc_id, _score) in enumerate(ranking, start=1):
      if doc_id not in rrf_scores:
        rrf_scores[doc_id] = 0.0
      rrf_scores[doc_id] += 1.0 / (k + rank)

  return sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
```

Hybrid search captures both exact-match queries (BM25 handles "error code E-4829") and
semantic queries (embeddings handle "how do I fix a connection timeout"). Most production
vector databases now support hybrid search natively: Qdrant (sparse vectors), Weaviate
(native BM25 + vector), pgvector (Postgres full-text search + vector similarity), and
OpenAI's file_search tool (built-in hybrid search with reranking).

### The Spectrum is Not a Progression

A critical point: this spectrum is not a progression from bad to good. BM25 is not
"worse" than semantic search. Each approach has a regime where it dominates:

| Query type | Best approach | Why |
|-----------|--------------|-----|
| Exact identifier: "ERR-4829" | BM25 | Exact match, embeddings may lose the specific code |
| Conceptual: "how to handle timeouts" | Semantic | Vocabulary mismatch between query and docs |
| Mixed: "Python asyncio timeout handling" | Hybrid | "asyncio" needs exact match, "timeout handling" needs semantic |
| Named entity: "RFC 7231 status codes" | BM25 | Proper nouns and identifiers need exact matching |
| Paraphrase: "ways to make the server faster" | Semantic | Many synonyms for "optimize performance" |

Choosing the wrong approach for the query type does not produce an error. It produces
degraded results - fewer relevant documents retrieved, more irrelevant documents
cluttering the context window. This is another instance of silent failure in retrieval
systems.

> **AGENTIC GROUNDING:** When debugging a retrieval failure, the first question is: "What
> type of query is this, and is the retrieval approach matched to the query type?" An
> agent searching for error code "CONN_REFUSED" via semantic search may retrieve documents
> about connection errors in general but miss the specific document about CONN_REFUSED.
> The fix is not better embeddings. The fix is adding keyword search.

> **HISTORY:** Information retrieval as a field predates the internet. Gerard Salton's
> SMART system (1960s, Cornell University) introduced the vector space model that TF-IDF
> is based on. The core ideas - representing documents as vectors, measuring similarity
> between query and document vectors - are over 60 years old. BM25 was developed by
> Stephen Robertson and colleagues at City University London in the 1990s as a
> probabilistic extension of TF-IDF. The field's accumulated knowledge about precision,
> recall, and ranking is directly applicable to modern RAG systems. Embedding-based
> retrieval is new (2019 onward with Sentence-BERT); the evaluation methodology is not.

---

## 4. The Naive RAG Pipeline

*Estimated time: 30 minutes*

The standard RAG pipeline has six steps. Understanding each step - what it does, what it
costs, and where it can fail - is the foundation for understanding both why RAG works and
why it breaks.

### Step 1: Chunk

Documents are split into smaller pieces (chunks). This is necessary because:
- Documents are often longer than the context window budget allocated for retrieval
- Smaller chunks allow more precise retrieval (the relevant paragraph, not the
  irrelevant chapter)
- Embedding models have maximum input lengths (typically 512-8192 tokens)

The simplest chunking strategy is fixed-size: split every N characters or tokens with
some overlap. More sophisticated strategies respect document structure (paragraph breaks,
markdown headers, code function boundaries).

```python
def fixed_size_chunk(text, chunk_size=500, overlap=100):
  """Split text into fixed-size chunks with overlap.

  Args:
    text: the document text
    chunk_size: number of characters per chunk
    overlap: number of characters overlapping between consecutive chunks

  Returns:
    list of text chunks
  """
  chunks = []
  start = 0
  while start < len(text):
    end = start + chunk_size
    chunks.append(text[start:end])
    start = end - overlap  # slide window with overlap
  return chunks


# Example: chunk a paragraph
text = """Retrieval-Augmented Generation combines two components: a retrieval
system that finds relevant documents and a generation model that produces
answers conditioned on those documents. The retrieval system operates on an
index of pre-processed document chunks. Each chunk is embedded into a vector
space, and at query time, the query is embedded with the same model. The most
similar chunks are retrieved and injected into the generation model's context
window alongside the original query."""

chunks = fixed_size_chunk(text, chunk_size=200, overlap=40)
for i, chunk in enumerate(chunks):
  print(f"Chunk {i}: [{len(chunk)} chars] {chunk[:60]}...")
```

### Step 2: Embed

Each chunk is passed through an embedding model that maps text to a dense vector. The
embedding captures the semantic content of the chunk in a fixed-dimensional space.

```python
# Using sentence-transformers (local):
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")  # 384-dim, ~80MB
chunk_embeddings = model.encode(chunks)

print(f"Chunks: {len(chunks)}")
print(f"Embedding dimension: {chunk_embeddings.shape[1]}")
print(f"First embedding (first 5 values): {chunk_embeddings[0][:5]}")
```

The embedding model is a critical choice. Different models produce different vector
spaces with different properties. A chunk that is "similar" in one model's space may not
be "similar" in another's. The MTEB leaderboard (huggingface.co/spaces/mteb/leaderboard)
benchmarks embedding models across multiple tasks. For production, evaluate on your own
data - benchmark performance does not always correlate with domain-specific performance.

### Step 3: Store

Embeddings are stored in a vector database or search index that supports efficient
similarity search. At small scale (thousands of chunks), a numpy array with brute-force
cosine similarity works. At scale (millions of chunks), you need an approximate nearest
neighbor (ANN) index.

```python
# Small scale: numpy (no external dependencies)
import numpy as np

# Store embeddings as a numpy array
index = np.array(chunk_embeddings)

# Save to disk
np.save("chunk_embeddings.npy", index)

# For scale: use a vector database
# Chroma (in-memory, no setup):
# Install: uv pip install chromadb

import chromadb

client = chromadb.Client()  # in-memory, ephemeral
collection = client.create_collection(
  name="documents",
  metadata={"hnsw:space": "cosine"},
)

collection.add(
  documents=chunks,
  ids=[f"chunk_{i}" for i in range(len(chunks))],
  embeddings=chunk_embeddings.tolist(),
)

print(f"Stored {collection.count()} chunks")
```

### Step 4: Query Embed

When a user query arrives, it is embedded with the same model used for document chunks.
This produces a query vector in the same space as the document vectors.

```python
query = "How does RAG combine retrieval and generation?"
query_embedding = model.encode([query])

print(f"Query embedding shape: {query_embedding.shape}")
```

The query and documents must use the same embedding model. Mixing models (embedding
documents with model A and queries with model B) produces vectors in incompatible spaces.
The cosine similarity scores will be meaningless.

### Step 5: Retrieve Top-K

The vector database returns the K chunks whose embeddings are most similar to the query
embedding. K is a hyperparameter that trades precision against recall:
- Small K (1-3): high precision (returned chunks are likely relevant) but may miss
  relevant information
- Large K (10-20): high recall (less likely to miss relevant information) but may include
  irrelevant chunks that waste context budget

```python
# Retrieve using Chroma
results = collection.query(
  query_embeddings=query_embedding.tolist(),
  n_results=3,
)

for i, (doc, distance) in enumerate(
  zip(results["documents"][0], results["distances"][0])
):
  print(f"Result {i+1} (distance: {distance:.4f}):")
  print(f"  {doc[:80]}...")
  print()

# Retrieve using numpy (brute force)
similarities = np.dot(index, query_embedding.T).flatten()
top_k_indices = np.argsort(similarities)[::-1][:3]

for idx in top_k_indices:
  print(f"Score: {similarities[idx]:.4f} | {chunks[idx][:60]}...")
```

### Step 6: Inject into Prompt

Retrieved chunks are formatted and inserted into the model's prompt, typically in a
structured way that separates the retrieved context from the user's question.

```python
def build_rag_prompt(query, retrieved_chunks):
  """Construct a RAG prompt from query and retrieved chunks.

  Args:
    query: the user's question
    retrieved_chunks: list of (chunk_text, score) tuples

  Returns:
    formatted prompt string
  """
  context_block = "\n\n---\n\n".join(
    f"[Source {i+1}] {chunk}"
    for i, (chunk, _score) in enumerate(retrieved_chunks)
  )

  return f"""Answer the following question using ONLY the provided context.
If the context does not contain enough information to answer, say so.

Context:
{context_block}

Question: {query}

Answer:"""


# Example
retrieved = [(chunks[i], similarities[i]) for i in top_k_indices]
prompt = build_rag_prompt(query, retrieved)
print(prompt[:500])
```

### What the Naive Pipeline Gets Right

The naive pipeline is not bad. It is a working system that handles many real-world
scenarios correctly. Specifically:

1. **It separates concerns.** Chunking, embedding, storage, retrieval, and generation
   are independent stages. You can swap any component without changing the others.

2. **It provides provenance.** Every generated answer can be traced back to specific
   source chunks. This is the fundamental advantage over pure parametric generation.

3. **It is updatable.** Adding new documents means chunking, embedding, and adding to
   the index. No model retraining required. Deletion means removing from the index.

4. **It scales.** Vector databases handle millions of chunks with sub-second query
   times. The bottleneck is usually the LLM call, not the retrieval.

5. **It is debuggable.** You can inspect each stage independently: are the chunks
   well-formed? Are the embeddings reasonable? Are the right chunks retrieved? Is the
   prompt well-constructed?

For simple knowledge bases with clean documents, direct questions, and moderate
vocabulary overlap between queries and documents, the naive pipeline works well. The
problems emerge at the boundaries.

> **AGENTIC GROUNDING:** The naive RAG pipeline is the first retrieval system most
> engineers build. Its simplicity is a virtue - you can get a working prototype in an
> afternoon. The danger is shipping the prototype to production without understanding its
> failure modes. The next section covers exactly where the naive pipeline breaks. If you
> are building an agent with RAG today, read the next section before you deploy.

---

## 5. Where Naive RAG Fails

*Estimated time: 30 minutes*

The naive pipeline has systematic failure modes. Each is predictable, diagnosable, and
(usually) fixable - but only if you know what to look for. The failure modes do not
announce themselves. A naive RAG system that retrieves the wrong documents produces the
same structured, confident output as one that retrieves the right documents.

### Failure Mode 1: Chunk Boundary Destruction

Chunking is lossy. When you split a document at a fixed character count, the split point
is arbitrary. It does not respect paragraph boundaries, section boundaries, or logical
argument boundaries. Critical context can be split across two chunks:

```
Original document:
  "The refund policy changed on March 1, 2026. Before this date,
   customers could request a refund within 30 days. After this date,
   the window was extended to 60 days for premium members and remained
   30 days for standard members."

Chunk 1 (chunk_size=120):
  "The refund policy changed on March 1, 2026. Before this date,
   customers could request a refund within 30 days. After"

Chunk 2 (chunk_size=120):
  "this date, the window was extended to 60 days for premium members
   and remained 30 days for standard members."
```

A query asking "What is the refund window for premium members?" may retrieve Chunk 1
(it contains "refund" and "30 days") but not Chunk 2 (which contains the actual answer).
The model generates an answer from Chunk 1 alone: "The refund window is 30 days." This
is wrong but plausible - the classic "right answer wrong work" pattern from the slopodar.

The retrieved document appears relevant. The generated answer appears correct. But the
causal path is wrong: the answer came from the pre-change policy because the post-change
policy was severed by the chunk boundary. The assertion passes via the wrong causal path.

**Mitigation strategies:**
- Increase chunk overlap (but increases storage and can cause redundant retrieval)
- Use structure-aware chunking (split on paragraph or section boundaries)
- Use parent document retrieval (retrieve the chunk, but pass the full parent document)
- Use late chunking (embed the full document, then split post-embedding)

### Failure Mode 2: Query-Document Vocabulary Mismatch

The user's query and the relevant document may describe the same thing using different
words. This is the fundamental limitation of keyword search, but it also affects
semantic search when the vocabulary gap is in a domain-specific direction.

```
Document: "The rate limiter enforces a maximum of 100 API calls per
           minute per authenticated client, with a sliding window
           algorithm and exponential backoff on 429 responses."

Query:    "Why is my application getting throttled?"

Vocabulary mismatch:
  - "throttled" vs "rate limiter" (synonym, different register)
  - "application" vs "authenticated client" (same referent, different term)
  - "getting" vs "enforces" (active vs passive, different perspective)
```

BM25 finds zero matching terms between the query and the most relevant document.
Semantic search may partially bridge the gap (embedding models learn some synonymy), but
domain-specific terminology like "429 responses" or "sliding window algorithm" may not be
well-represented in the embedding model's training data.

**Mitigation strategies:**
- Hybrid search (combine semantic and keyword search)
- Query expansion (add synonyms or related terms to the query)
- HyDE (Gao et al. 2022 - generate a hypothetical answer, embed that instead of the
  query)
- Domain-specific embedding model fine-tuning

### Failure Mode 3: Semantically Similar but Wrong

The embedding model places texts with similar surface meaning close together. But
"similar meaning" and "relevant to the query" are not the same thing. Two documents can
be semantically similar but one is correct and the other is outdated, about a different
product, or about a different version.

```
Query: "How do I configure authentication in the v3 API?"

Retrieved (high similarity, WRONG):
  "Authentication in the v2 API uses a Bearer token passed in
   the Authorization header. Set the token in your client config:
   client.auth = BearerToken(key)"

Not retrieved (lower similarity, CORRECT):
  "The v3 API replaced token-based auth with OAuth 2.0 PKCE flow.
   See the migration guide for details on updating your client."

Why: Both documents are about "authentication" and "API" and
"configuration." The v2 document uses more of the query's vocabulary.
The embedding model cannot distinguish version numbers as critical
discriminators.
```

This is a form of stale reference propagation. The retrieval system holds both v2 and v3
documentation. The v2 documentation is closer to the query in embedding space because it
uses more similar vocabulary. The v3 documentation uses different terms ("OAuth 2.0 PKCE
flow" vs "Bearer token") precisely because the authentication method changed. The
retrieval system returns the stale reference, and the model generates an answer that
describes a state that no longer exists.

> **SLOPODAR:** This failure mode maps directly to stale reference propagation: "When
> configuration documents describe a state that no longer exists, every agent that boots
> from them will hallucinate the described state into reality." In manual context
> management, this happens when AGENTS.md references a file that has been deleted. In RAG,
> it happens when the index contains outdated documents that are semantically similar to
> current queries. The mechanism is automated but the failure mode is identical.

**Mitigation strategies:**
- Metadata filtering (filter by version, date, product before semantic search)
- Temporal weighting (prefer newer documents)
- Document lifecycle management (expire or flag outdated documents in the index)
- Cross-encoder reranking (a second model that considers query-document pairs more
  carefully)

### Failure Mode 4: Context Window Flooding

When top-K is set too high, or when many documents have similar relevance scores, the
retrieval system returns a large volume of marginally relevant content. This floods the
context window with noise, degrading generation quality.

```
Query: "What is the error handling policy?"

Retrieved (k=10):
  1. Error handling policy document (RELEVANT)
  2. Error logging configuration (PARTIALLY RELEVANT)
  3. Error monitoring dashboard setup (MARGINALLY RELEVANT)
  4. Error code reference table (MARGINALLY RELEVANT)
  5. Retry policy for external services (MARGINALLY RELEVANT)
  6. Client-side error display guidelines (MARGINALLY RELEVANT)
  7. Error budget definition for SLOs (NOT RELEVANT)
  8. Exception hierarchy design doc (NOT RELEVANT)
  9. Debugging guide for error analysis (NOT RELEVANT)
  10. Historical post-mortem: 2025 error spike (NOT RELEVANT)

The model must process all 10 documents to generate an answer.
Documents 7-10 add noise without signal. The relevant information
in document 1 competes for attention with irrelevant content.
```

This is hot context pressure applied to retrieval. More retrieved context is not
monotonically better. There is an optimal amount, and exceeding it degrades quality.

Research confirms this degradation. The "lost in the middle" phenomenon (Liu et al. 2023)
demonstrates that language models attend less to information in the middle of long
contexts. If the most relevant document ends up in position 5 of 10, surrounded by
marginally relevant content, the model may weight it less than a less relevant document
in position 1 or position 10.

**Mitigation strategies:**
- Lower K with reranking (retrieve many, rerank, keep few)
- Relevance score thresholding (discard chunks below a similarity threshold)
- Context budget management (set a token budget and stop retrieving when full)
- Maximal Marginal Relevance (MMR) - diversify results to reduce redundancy

### Failure Mode 5: Missing Query Context

The user's query may be ambiguous or underspecified. In a conversation, the query
depends on context from prior turns that the retrieval system does not have.

```
Turn 1 - User: "Tell me about the Python SDK."
Turn 2 - Agent: "The Python SDK provides client libraries for..."
Turn 3 - User: "How do I install it?"

The retrieval system sees: "How do I install it?"
It does not know "it" refers to the Python SDK.
It may retrieve generic installation guides or
installation docs for the wrong product.
```

The query "How do I install it?" contains almost zero retrieval signal. The pronoun "it"
carries no semantic content that an embedding model can use. The retrieval system needs
the conversation context to resolve the reference, but the naive pipeline only embeds
the current query.

**Mitigation strategies:**
- Query rewriting (use the LLM to rewrite the query incorporating prior context)
- Conversation-aware retrieval (concatenate or summarize conversation history with query)
- Multi-turn context tracking (maintain a conversation state that informs retrieval)

> **AGENTIC GROUNDING:** In production agent systems, every one of these failure modes
> will occur. The question is not whether but how often. The critical skill is diagnosing
> which failure mode is active when the agent produces a wrong answer. Without this
> diagnostic ability, you will waste time on the wrong fix - tuning the generation prompt
> when the problem is chunking, or adjusting embeddings when the problem is missing
> metadata filtering. Step 2 (embeddings and vector search) goes deeper into the
> embedding layer. Step 3 (RAG pipeline engineering) addresses the mitigation strategies.
> Step 4 (advanced retrieval patterns) covers the more sophisticated approaches.

---

## 6. Retrieval Quality Metrics

*Estimated time: 25 minutes*

You cannot improve what you do not measure. And you cannot diagnose where a RAG system
fails if you only measure end-to-end output quality. A RAG system has two components -
retrieval and generation - and measuring only the final answer conflates failures in
both. The retrieval may be perfect but the generation hallucinates. Or the generation may
be perfect but the retrieval returned the wrong documents. You need metrics for each
component independently.

This section covers retrieval metrics. These measure the quality of the retrieval step
alone, independent of what the generation model does with the results. This connects
directly to **Bootcamp IV Steps 1-4 (evaluation methodology)** - the same principle of
measuring components independently applies across all evaluation.

### Precision@K

Of the K documents retrieved, how many are actually relevant?

```
Precision@K = (number of relevant documents in top K) / K
```

Example:
```
Query: "refund policy for premium members"
Top 5 retrieved documents:
  1. Premium member refund policy     [RELEVANT]
  2. Standard member refund policy    [NOT RELEVANT]
  3. Premium member benefits overview [NOT RELEVANT]
  4. Refund processing workflow       [RELEVANT]
  5. Premium tier pricing             [NOT RELEVANT]

Precision@5 = 2/5 = 0.40
Precision@3 = 1/3 = 0.33
Precision@1 = 1/1 = 1.00
```

Precision@K answers: "How much noise is in my retrieved results?" High precision means
less wasted context budget. Low precision means the model must sift through irrelevant
content to find the answer.

### Recall@K

Of all the relevant documents in the collection, how many were in the top K?

```
Recall@K = (number of relevant documents in top K) / (total relevant documents)
```

Example:
```
Query: "refund policy for premium members"
Total relevant documents in collection: 4
  - Premium member refund policy
  - Refund processing workflow
  - Premium refund exceptions
  - 2026 refund policy update

Top 5 retrieved: includes 2 of these 4.

Recall@5 = 2/4 = 0.50
```

Recall@K answers: "Am I missing critical information?" Low recall means the working set
is incomplete - the model will generate without information it needs. This is the metric
that maps most directly to cold context pressure.

### The Precision-Recall Tradeoff

Increasing K improves recall (more relevant documents appear in a larger set) but
typically degrades precision (more irrelevant documents also appear). Decreasing K
improves precision but degrades recall.

```
K=1:  Precision=1.00, Recall=0.25  -- Very precise, likely missing info
K=5:  Precision=0.40, Recall=0.50  -- Moderate both
K=20: Precision=0.15, Recall=0.75  -- Good recall, lots of noise
K=50: Precision=0.08, Recall=1.00  -- All relevant docs found, massive noise
```

The right K depends on your tolerance for each type of failure:
- High-precision, low-recall: the model gets clean context but may miss critical info
- Low-precision, high-recall: the model gets all the info but drowns in noise
- The sweet spot is application-dependent and must be found empirically

### Mean Reciprocal Rank (MRR)

Where does the first relevant document appear in the ranked results?

```
MRR = average of (1 / rank of first relevant document) across queries
```

Example:
```
Query A: first relevant at rank 1  ->  1/1 = 1.000
Query B: first relevant at rank 3  ->  1/3 = 0.333
Query C: first relevant at rank 2  ->  1/2 = 0.500

MRR = (1.000 + 0.333 + 0.500) / 3 = 0.611
```

MRR is useful when you care most about finding at least one relevant document quickly.
For many RAG applications, the model needs just one good document to answer correctly.
MRR measures how often the retrieval system puts that document near the top.

### Normalized Discounted Cumulative Gain (nDCG)

nDCG measures ranking quality: are the most relevant documents ranked highest?

Unlike precision and recall (which treat relevance as binary - relevant or not), nDCG
supports graded relevance (highly relevant = 3, relevant = 2, marginally relevant = 1,
not relevant = 0).

```python
import numpy as np

def dcg_at_k(relevances, k):
  """Compute Discounted Cumulative Gain at position k.

  Args:
    relevances: list of relevance scores in ranked order
    k: number of positions to consider

  Returns:
    DCG@k value
  """
  relevances = np.array(relevances[:k])
  positions = np.arange(1, len(relevances) + 1)
  # Discount: log2(position + 1)
  discounts = np.log2(positions + 1)
  return np.sum(relevances / discounts)


def ndcg_at_k(relevances, k):
  """Compute Normalized DCG at position k.

  Args:
    relevances: list of relevance scores in ranked order
    k: number of positions to consider

  Returns:
    nDCG@k value (0 to 1)
  """
  actual_dcg = dcg_at_k(relevances, k)
  # Ideal: sort relevances descending (best possible ranking)
  ideal_relevances = sorted(relevances, reverse=True)
  ideal_dcg = dcg_at_k(ideal_relevances, k)
  if ideal_dcg == 0:
    return 0.0
  return actual_dcg / ideal_dcg


# Example: 5 retrieved documents with graded relevance
# 3 = highly relevant, 2 = relevant, 1 = marginally, 0 = not relevant
retrieved_relevances = [3, 0, 2, 0, 1]

print(f"DCG@5:  {dcg_at_k(retrieved_relevances, 5):.3f}")
print(f"nDCG@5: {ndcg_at_k(retrieved_relevances, 5):.3f}")

# What if we had perfect ranking?
ideal = sorted(retrieved_relevances, reverse=True)  # [3, 2, 1, 0, 0]
print(f"Ideal ranking: {ideal}")
print(f"Ideal DCG@5:  {dcg_at_k(ideal, 5):.3f}")
```

nDCG@K = 1.0 means the ranking is perfect (most relevant documents at the top). Lower
values mean relevant documents are buried below irrelevant ones. This metric is
sensitive to ranking order, not just which documents appear - a property that precision
and recall lack.

### Measuring Retrieval Independently

The fundamental principle: measure retrieval quality without involving the generation
model. Create a test set of (query, relevant_documents) pairs. Run queries through the
retrieval system. Score the results against the known relevant documents.

```python
def evaluate_retrieval(queries, relevant_docs, retrieval_fn, k=5):
  """Evaluate retrieval quality across a set of queries.

  Args:
    queries: list of query strings
    relevant_docs: dict mapping query -> set of relevant doc IDs
    retrieval_fn: function(query, k) -> list of (doc_id, score) tuples
    k: number of results to retrieve

  Returns:
    dict of metric name -> average value
  """
  precisions = []
  recalls = []
  mrrs = []
  ndcgs = []

  for query in queries:
    results = retrieval_fn(query, k)
    retrieved_ids = [doc_id for doc_id, _score in results]
    relevant = relevant_docs.get(query, set())

    if not relevant:
      continue

    # Precision@K
    relevant_in_k = sum(1 for doc_id in retrieved_ids if doc_id in relevant)
    precisions.append(relevant_in_k / k)

    # Recall@K
    recalls.append(relevant_in_k / len(relevant))

    # MRR
    mrr = 0.0
    for rank, doc_id in enumerate(retrieved_ids, start=1):
      if doc_id in relevant:
        mrr = 1.0 / rank
        break
    mrrs.append(mrr)

    # nDCG@K
    relevances = [1 if doc_id in relevant else 0 for doc_id in retrieved_ids]
    ndcgs.append(ndcg_at_k(relevances, k))

  return {
    "precision@k": np.mean(precisions),
    "recall@k": np.mean(recalls),
    "mrr": np.mean(mrrs),
    "ndcg@k": np.mean(ndcgs),
  }
```

This evaluation tells you whether retrieval is working *before* you involve the
generation model. If retrieval metrics are poor, no amount of prompt engineering on the
generation side will produce correct answers. Fix retrieval first.

> **AGENTIC GROUNDING:** In production agent systems, retrieval metrics are the first
> diagnostic layer. When an agent produces incorrect output, the triage sequence is:
> (1) inspect what was retrieved, (2) compute retrieval metrics against known good
> answers, (3) if retrieval metrics are acceptable, investigate generation. Without
> independent retrieval metrics, you are debugging a two-component system as if it were
> one, and you will waste time on the wrong component.

> **FIELD VS NOVEL:** Precision, recall, MRR, and nDCG are established IR metrics
> (Manning et al. 2008, Ch. 8). They are applied unchanged to RAG systems - the
> evaluation methodology is decades old. What is novel in the agentic context is the
> imperative to measure retrieval independently from generation. Many RAG tutorials
> evaluate only the final answer, making it impossible to determine whether a failure
> is a retrieval failure or a generation failure. The working set framing (Denning 1968,
> applied in this project) makes the separation obvious: did the retrieval system
> deliver the working set, or not?

---

## 7. When Not to Use RAG

*Estimated time: 15 minutes*

RAG adds complexity. It introduces an embedding model, a vector database, a chunking
strategy, a retrieval pipeline, and a prompt construction layer. Each component can fail,
each requires maintenance, and each adds latency to the response path. Before adding this
infrastructure, ask whether it is necessary.

### The Knowledge Fits in the Prompt

If your entire knowledge base is under 50,000 tokens (roughly 35,000 words), you may be
able to include it directly in the prompt. Modern context windows are large - Claude
offers 200K tokens standard and 1M in beta. Direct inclusion eliminates all retrieval
failure modes: no chunking errors, no embedding mismatches, no top-K selection problems.

```
Knowledge base size vs. approach:
  < 10K tokens:    Direct inclusion. No question.
  10K-50K tokens:  Direct inclusion likely works. Test latency and cost.
  50K-200K tokens: Borderline. Direct inclusion is expensive per query.
                   RAG may be more cost-effective at volume.
  > 200K tokens:   RAG required. Cannot fit in a single context window.
  > 1M tokens:     RAG required. Even with extended context.
```

But size is not the only consideration. Cost matters at volume. If you serve 10,000
queries per day and include 100K tokens of context in each, you are processing 1 billion
input tokens per day. At $3 per million input tokens (Sonnet-tier pricing), that is
$3,000 per day on input tokens alone. RAG that retrieves 5K tokens per query reduces
this to $150 per day. At scale, RAG is a cost optimization even when the knowledge base
would fit in the prompt.

### Training Data Suffices

For tasks where the model's parametric knowledge is sufficient, RAG adds cost and
latency without benefit. Common cases:

- General knowledge questions: "What is the capital of France?"
- Programming concepts: "Explain the difference between a list and a tuple in Python."
- Mathematical reasoning: "What is the derivative of sin(x)?"
- Creative tasks: "Write a poem about autumn."

The test: if the model produces correct answers consistently without retrieval, retrieval
adds no value. Be careful with this test - "correct most of the time" is not "correct"
in production. If accuracy matters, measure it.

### Real-Time Exceeds Indexing Speed

RAG operates on a pre-built index. Documents must be chunked, embedded, and stored
before they can be retrieved. If the information changes faster than the indexing pipeline
can process it, the index is perpetually stale.

Examples where RAG's indexing model is too slow:
- Live stock prices (changes every second)
- Real-time sensor data (changes continuously)
- Active chat conversations (new messages arrive faster than indexing)

For these cases, direct API calls or streaming data pipelines are more appropriate than
retrieval from an index. The model calls a tool (stock price API, sensor API) to get the
current value rather than searching an index that may be seconds or minutes behind.

### The Simplicity Principle

Do not add retrieval infrastructure because RAG is fashionable. Add it because the
problem requires it. The engineering decision follows the same logic as any architectural
choice: what is the simplest system that meets the requirements?

```
Decision tree:

1. Does the model need information not in its training data?
   No  -> No RAG needed. Stop here.
   Yes -> Continue.

2. Does the information fit in the prompt at acceptable cost?
   Yes -> Direct inclusion. No RAG needed. Stop here.
   No  -> Continue.

3. Does the information change faster than you can index?
   Yes -> Use real-time API/tool calls, not RAG. Stop here.
   No  -> Continue.

4. RAG is likely the right approach. Proceed to Step 2.
```

> **AGENTIC GROUNDING:** Over-engineering is a real failure mode in agent systems.
> Building a full RAG pipeline for a knowledge base that fits in the prompt adds six
> potential failure points (chunking, embedding, storage, retrieval, ranking, prompt
> construction) where zero existed before. Every additional component is a component that
> can fail, requires monitoring, and needs maintenance. The simplest system that works
> correctly is the right system.

> **FIELD VS NOVEL:** The "when not to use RAG" analysis is increasingly discussed in
> the field (Anthropic and OpenAI documentation both address context window sizing).
> The novel observation from this project is the connection to the BFS depth rule:
> AGENTS.md (a direct-inclusion approach) works because the knowledge base is small
> enough to fit in the context window. The BFS depth rule is an explicit manual policy
> for managing which documents get direct inclusion (d1) vs. on-demand retrieval (d2-d3).
> This is the same decision that the "when not to use RAG" analysis automates.

---

## Challenges

The following challenges increase in difficulty. They are designed to build practical
intuition for retrieval concepts before you work with full implementations in Step 2 and
Step 3. No external tools or API keys are required for any of these challenges.

---

## Challenge 1: Information Need Analysis

**Estimated time: 15 minutes**

**Goal:** Classify 8 scenarios by the type of information access they require.

For each scenario below, determine which category best fits:

- **A: Training data sufficient** - the model's parametric knowledge can answer correctly
- **B: Direct inclusion** - the knowledge base is small enough to include in the prompt
- **C: RAG required** - the knowledge base is too large for the prompt; retrieval needed
- **D: Real-time API** - the information changes too fast for index-based retrieval
- **E: No single approach** - multiple information access patterns are needed

**Scenarios:**

1. An agent that answers questions about a 500-page employee handbook (PDF).
2. An agent that tells users the current weather in their city.
3. An agent that explains Python syntax errors to beginners.
4. An agent that searches a company's 10,000-ticket Jira backlog for similar issues.
5. An agent that answers questions about a 3-page product FAQ.
6. An agent that monitors a live Kubernetes cluster and explains pod failures.
7. An agent that helps developers navigate a 2-million-line codebase.
8. An agent that drafts email replies using the recipient's previous correspondence
   (typically 5-20 emails per thread) and the company's communication style guide
   (12 pages).

**Verification:** For each scenario, write one sentence explaining why your
classification is correct. Consider: what is the knowledge base size? How frequently does
it change? Does the model's training data cover it?

<details>
<summary>Hints</summary>

1. 500 pages is roughly 125K-250K tokens depending on formatting. This exceeds
   comfortable direct inclusion for most models. **C: RAG required.**

2. Weather changes continuously and is location-specific. No index can stay current.
   **D: Real-time API.**

3. Python syntax is stable and well-covered in training data. The model knows this
   already. **A: Training data sufficient.**

4. 10,000 tickets with descriptions, comments, and metadata. Far too large for direct
   inclusion. **C: RAG required.**

5. 3 pages is roughly 1,500-3,000 tokens. Trivially fits in the prompt.
   **B: Direct inclusion.**

6. Pod state changes in real time. But understanding the failure requires knowledge of
   Kubernetes architecture (training data) and the specific pod's config (retrieval from
   the cluster API). **E: No single approach** - real-time API for cluster state,
   possibly RAG for runbooks.

7. 2 million lines of code. RAG required for search, but agentic code retrieval
   (iteratively reading files, following imports) is often more effective than
   embedding-based search for code. **C: RAG required** (or agentic retrieval).

8. 5-20 emails (small, direct inclusion) plus 12-page style guide (small, direct
   inclusion). Total is well under 50K tokens. **B: Direct inclusion** - no RAG needed
   despite multiple sources.

</details>

**Extension:** For each scenario you classified as C (RAG required), identify which
retrieval approach (keyword, semantic, hybrid) would likely work best, and why.

---

## Challenge 2: Naive RAG Walkthrough

**Estimated time: 20 minutes**

**Goal:** Manually simulate the naive RAG pipeline to build intuition for how chunking
and retrieval interact.

**Step 1: Chunk.** Take the following document and chunk it two ways:
- Method A: Fixed-size chunks of 150 characters with 30-character overlap
- Method B: Split on paragraph boundaries (each paragraph is a chunk)

```
Document:
---
Authentication in the Acme API uses OAuth 2.0. All requests must include
a Bearer token in the Authorization header.

Tokens are obtained from the /auth/token endpoint using client credentials.
The client ID and client secret are provided during application registration.
Tokens expire after 3600 seconds (1 hour).

Rate limiting is enforced at 100 requests per minute per token. Exceeding
this limit returns HTTP 429. The Retry-After header indicates how long to
wait before retrying.

For server-to-server integrations, use the service account flow. Service
accounts use a JWT assertion instead of client credentials. The JWT must
be signed with the RS256 algorithm using the private key from your service
account key file.
---
```

**Step 2: Query.** For each chunking method, predict which chunk(s) would best match
each of these queries using semantic similarity:
- Query 1: "How do I authenticate with the API?"
- Query 2: "What happens when I exceed the rate limit?"
- Query 3: "How do service accounts authenticate?"

**Step 3: Analyze.** Answer these questions:
- Which chunking method produces better retrieval for Query 3? Why?
- Does fixed-size chunking split any information across chunk boundaries that
  paragraph-based chunking keeps together?
- For Query 1, does either method retrieve information about service accounts? Should it?

**Verification:** Write out your chunks explicitly. Show which chunk each query would
most likely match. Identify at least one case where chunking choice changes retrieval
quality.

<details>
<summary>Hints</summary>

Method A (fixed 150 chars, 30 overlap) produces roughly 5-6 chunks. The third paragraph
about rate limiting will likely be split mid-sentence. Method B (paragraph split) produces
exactly 4 clean chunks.

Query 3 about service accounts maps to the last paragraph. In Method A, this paragraph
may be split across two chunks, requiring both to answer fully. In Method B, it is one
complete chunk.

Query 1 about authentication could reasonably match the first paragraph (OAuth 2.0) or
the last paragraph (service accounts) or both. Whether the system returns one or both
depends on K and the similarity scores.

</details>

---

## Challenge 3: Retrieval Quality Measurement

**Estimated time: 25 minutes**

**Goal:** Compute retrieval metrics by hand to understand what they measure and how they
differ.

Given the following retrieval results for 3 queries (R = relevant, N = not relevant):

```
Query A: "How to configure logging?"
  Total relevant documents in collection: 3
  Retrieved top 5: [R, N, R, N, N]

Query B: "Database connection pooling setup"
  Total relevant documents in collection: 2
  Retrieved top 5: [N, N, R, R, N]

Query C: "SSL certificate renewal process"
  Total relevant documents in collection: 4
  Retrieved top 5: [R, R, N, R, N]
```

**Compute these metrics for each query:**

1. Precision@5
2. Precision@3
3. Recall@5
4. MRR (Mean Reciprocal Rank - based on rank of first relevant document)
5. nDCG@5 (use binary relevance: relevant=1, not relevant=0)

**Then compute the average across all 3 queries for each metric.**

**Verification:** Your answers should satisfy:
- All values are between 0 and 1
- Precision@K values decrease or stay the same as K increases (not always, but typically)
- Recall@K values increase or stay the same as K increases (always, by definition)
- MRR is determined entirely by the position of the first relevant document

<details>
<summary>Hints</summary>

Query A:
- Precision@5 = 2/5 = 0.40
- Precision@3 = 2/3 = 0.67
- Recall@5 = 2/3 = 0.67
- MRR = 1/1 = 1.00 (first relevant at rank 1)
- nDCG@5: DCG = 1/log2(2) + 0 + 1/log2(4) + 0 + 0 = 1.0 + 0.5 = 1.5
  Ideal: [1,1,1,0,0] -> DCG = 1/log2(2) + 1/log2(3) + 1/log2(4) = 1.0 + 0.631 + 0.5 = 2.131
  nDCG = 1.5/2.131 = 0.704

Query B:
- Precision@5 = 2/5 = 0.40
- Precision@3 = 1/3 = 0.33
- Recall@5 = 2/2 = 1.00
- MRR = 1/3 = 0.33 (first relevant at rank 3)
- nDCG@5: DCG = 0 + 0 + 1/log2(4) + 1/log2(5) + 0 = 0.5 + 0.431 = 0.931
  Ideal: [1,1,0,0,0] -> DCG = 1.0 + 0.631 = 1.631
  nDCG = 0.931/1.631 = 0.571

Query C:
- Precision@5 = 3/5 = 0.60
- Precision@3 = 2/3 = 0.67
- Recall@5 = 3/4 = 0.75
- MRR = 1/1 = 1.00 (first relevant at rank 1)
- nDCG@5: DCG = 1/log2(2) + 1/log2(3) + 0 + 1/log2(5) + 0 = 1.0 + 0.631 + 0.431 = 2.062
  Ideal: [1,1,1,1,0] -> DCG = 1.0 + 0.631 + 0.5 + 0.431 = 2.562
  nDCG = 2.062/2.562 = 0.805

Averages:
- Precision@5: (0.40 + 0.40 + 0.60) / 3 = 0.467
- Precision@3: (0.67 + 0.33 + 0.67) / 3 = 0.556
- Recall@5: (0.67 + 1.00 + 0.75) / 3 = 0.807
- MRR: (1.00 + 0.33 + 1.00) / 3 = 0.778
- nDCG@5: (0.704 + 0.571 + 0.805) / 3 = 0.693

</details>

**Extension:** Query B has the worst MRR (0.33) but the best Recall@5 (1.00). Explain in
one paragraph why these metrics can diverge and what this tells you about the retrieval
system's behavior for that query.

---

## Challenge 4: Failure Mode Identification

**Estimated time: 20 minutes**

**Goal:** Diagnose the retrieval failure mode in each scenario.

For each RAG failure below, identify the primary failure mode from this list:
- **Chunk boundary destruction** - relevant information split across chunks
- **Vocabulary mismatch** - query and document use different terms for the same concept
- **Semantically similar but wrong** - retrieved document is topically similar but
  factually incorrect for the query
- **Context window flooding** - too many marginally relevant documents retrieved
- **Missing query context** - query depends on conversational context not available to
  retrieval

**Scenario 1:**
A customer asks "How do I cancel?" in a support chat. The previous 3 messages established
they are asking about canceling a subscription, not an order. The RAG system retrieves
the order cancellation FAQ.

**Scenario 2:**
A developer asks "How does the retry logic work?" The RAG system retrieves 15 documents:
3 about the retry configuration, 4 about error handling, 3 about timeout settings,
2 about circuit breakers, and 3 about monitoring retry rates. The model's answer is
vague and generic, drawing from all 15 documents without focusing on the retry logic
specifically.

**Scenario 3:**
An agent is asked about the 2026 pricing for the Enterprise tier. The index contains both
the 2025 pricing page and the 2026 pricing page. The retrieved document is the 2025
pricing page because it has higher embedding similarity (it mentions "Enterprise" more
frequently and in more detail). The generated answer states the 2025 price.

**Scenario 4:**
A technical document explains that "The authentication flow requires a nonce value
generated by the client" in paragraph 3, and "The nonce must be cryptographically random
and at least 128 bits" in paragraph 4. The chunks split at the paragraph boundary. A
query about "nonce requirements for authentication" retrieves paragraph 3 (which mentions
nonce but not the requirements) and misses paragraph 4 (which has the requirements but
does not mention authentication).

**Scenario 5:**
A user asks "What is our SLA for API uptime?" The relevant document uses the phrase
"service level agreement for platform availability percentage." The BM25 search finds
zero matching terms. The semantic search returns a document about "SLA for customer
support response times" - semantically similar (both about SLAs) but about the wrong SLA.

**Verification:** For each scenario, name the failure mode and state what retrieval
system change would mitigate it.

<details>
<summary>Hints</summary>

1. **Missing query context.** "How do I cancel?" contains no signal about subscription
   vs. order. Fix: query rewriting that incorporates conversation history.

2. **Context window flooding.** 15 documents is too many. Fix: lower K, add reranking
   to select only the most relevant, or use relevance score thresholding.

3. **Semantically similar but wrong.** The 2025 document is closer in embedding space
   but factually stale. Fix: metadata filtering by date/version before semantic search.
   This is stale reference propagation in the retrieval index.

4. **Chunk boundary destruction.** The nonce value and its requirements are split across
   chunks. Fix: larger chunks, more overlap, or structure-aware chunking that keeps
   related paragraphs together.

5. **Vocabulary mismatch** combined with **semantically similar but wrong.** BM25 fails
   on the vocabulary gap. Semantic search bridges it but finds the wrong SLA. Fix: hybrid
   search with metadata filtering (filter by SLA type or document category).

</details>

---

## Challenge 5: Working Set Design

**Estimated time: 25 minutes**

**Goal:** For a given agent task, design the ideal working set and analyze how a
retrieval system would construct it.

**Task description:** You are building an agent that helps new engineers onboard at a
software company. The agent answers questions about:
- Development environment setup (IDE, language versions, build tools)
- Code repository structure and conventions
- Team processes (code review, deployment, incident response)
- Architecture decisions and their rationale
- Internal tools and how to use them

The company has:
- 200 pages of documentation in Confluence (mixed quality, some outdated)
- 50 architecture decision records (ADRs)
- 15 runbooks for common procedures
- A 30-page new hire guide
- 500 README files across 80 repositories
- Slack history (2 years, 50 channels)

**Part 1: Working Set Analysis**

For each query below, identify the minimum working set - the documents that MUST be in
the context window for a correct answer. Then identify documents that are noise -
plausible to retrieve but not necessary.

- Query A: "How do I set up the development environment on my Mac?"
- Query B: "Why did we choose PostgreSQL over MongoDB for the user service?"
- Query C: "What is the deployment process for the payments service?"

**Part 2: Retrieval Strategy**

For the entire onboarding agent, answer:

1. Which document sources should be in the RAG index? Which should be excluded?
2. How would you handle the "mixed quality, some outdated" Confluence documentation?
3. Should the 30-page new hire guide be in RAG or direct inclusion? Why?
4. How would you handle queries that require information from multiple document sources
   (e.g., a deployment question that needs both the runbook and the ADR explaining why
   the process was designed that way)?
5. What metadata would you attach to each document to enable filtering?

**Verification:** Your working set for each query should be 2-5 documents. If you
identified more than 5, you may be including noise. If fewer than 2, you may be missing
dependencies.

<details>
<summary>Hints</summary>

Query A working set:
- New hire guide (dev environment section)
- The specific README for the primary development repository
- Possibly the build tool configuration documentation
Noise: All 500 READMEs. The Slack history. The ADRs.

Query B working set:
- The specific ADR for the PostgreSQL decision
- Possibly the user service architecture documentation
Noise: All other ADRs. The Confluence documentation about PostgreSQL configuration
(how to use it, not why it was chosen).

Query C working set:
- Payments service deployment runbook
- Possibly the payments service README (for build/test commands)
- Possibly the incident response runbook (what to do if deployment fails)
Noise: Other service runbooks. General deployment philosophy docs.

For Part 2:
- Exclude Slack history from the primary index (too noisy, stale conversations)
- The 30-page new hire guide is borderline - at ~7,500 tokens it fits in direct
  inclusion. But it may be better in RAG so the agent retrieves only relevant sections.
- Metadata: document type (ADR, runbook, README, guide), team/service, last updated
  date, author, status (current/deprecated)

</details>

**Extension:** The Confluence documentation has "mixed quality, some outdated" content.
Design a process for maintaining the RAG index that addresses stale reference
propagation. How do you detect outdated documents? How do you flag or remove them? What
happens if a stale document is retrieved despite your safeguards?

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What are the three fundamental limits of a language model's knowledge, and which
   does RAG address?

2. What is the working set in the context of retrieval, and what happens when it is
   incomplete?

3. Why is hybrid search (BM25 + semantic) generally preferred over either approach alone
   in production?

4. Name the six steps of the naive RAG pipeline in order.

5. What is the difference between Precision@K and Recall@K, and which maps more
   directly to cold context pressure?

6. A RAG system has Precision@5 = 0.80 and Recall@5 = 0.30. What does this tell you
   about its behavior, and what would you adjust?

7. Name three failure modes of naive RAG and one mitigation strategy for each.

8. When should you NOT use RAG?

9. What is stale reference propagation in the context of a RAG index, and how does it
   differ from the same failure mode in manual context management?

10. Why must retrieval quality be measured independently from generation quality?

---

## Recommended Reading

- **Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"
  (2020)** - https://arxiv.org/abs/2005.11401 - The foundational RAG paper. Read the
  abstract and Section 1 for the conceptual framework. The specific architecture (DPR +
  BART) is historical, but the insight that parametric and non-parametric memory can be
  combined remains foundational.

- **Manning et al., "Introduction to Information Retrieval" (2008)** -
  https://nlp.stanford.edu/IR-book/ - Freely available online. Chapter 6 (scoring and
  vector space model) and Chapter 8 (evaluation) are directly applicable to RAG systems.
  The evaluation metrics in this step come from this textbook.

- **Anthropic context window documentation** -
  https://docs.anthropic.com/en/docs/about-claude/models - Current context window sizes
  and pricing. Essential for the "when not to use RAG" decision.

- **Gao et al., "HyDE: Precise Zero-Shot Dense Retrieval without Relevance Labels"
  (2022)** - https://arxiv.org/abs/2212.10496 - The hypothetical document embedding
  approach. Read for the query transformation concept, which addresses the vocabulary
  mismatch failure mode from Section 5.

- **RAGAS evaluation framework** - https://github.com/vibrantlabsai/ragas - Framework
  for evaluating RAG systems with metrics for both retrieval and generation quality.
  Reference for Step 3 (RAG pipeline engineering).

---

## What to Read Next

**Step 2: Embeddings and Vector Search** - This step covered what retrieval is and why
it matters. Step 2 covers how it works at the implementation level: embedding models,
vector spaces, similarity metrics, approximate nearest neighbor algorithms, and vector
databases. The concepts from this step - working set construction, retrieval quality
metrics, failure mode identification - compose directly into the hands-on implementation
in Step 2.

