+++
title = "Advanced Retrieval Patterns"
date = "2026-03-10"
description = "Hybrid search, reranking, agentic RAG, GraphRAG, code retrieval, index maintenance."
tags = ["rag", "hybrid", "reranking", "bootcamp"]
step = 4
tier = 1
estimate = "4-5 hours"
bootcamp = 5
+++

Step 4 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

Estimated total time: 4-5 hours.

**Field maturity:** Emerging
**Prerequisites:** Step 3 (RAG pipeline engineering), Step 2 (embeddings and vector search)
**Leads to:** Step 7 (observability and tracing), Step 9 (production patterns)
**You will need:** Python 3.10+, sentence-transformers (for cross-encoder reranking),
rank-bm25 (`uv pip install rank-bm25`), chromadb, an LLM API key (OpenAI or
Anthropic) for the agentic RAG exercise. See Tool Setup below.

---

## Why This is Step 4

Step 3 built the standard RAG pipeline: chunk documents, embed them, retrieve by
similarity, assemble context, generate. That pipeline works. For many production systems,
it is the right answer and the only answer you need. Most teams should stop at Step 3.

This step exists for the cases where it does not work.

The standard pipeline has specific failure modes. Semantic search misses exact keyword
matches - a user searching for error code `ERR_CONN_REFUSED` will not find a document
that contains the exact string if no semantically similar training example taught the
embedding model to map error codes to their descriptions. BM25 keyword search finds the
exact string but misses documents that describe the same concept in different words. A
single retrieval pass returns documents ranked by one criterion, but a cross-encoder that
reads query and document together can detect relevance that the bi-encoder's independent
encoding missed. And in complex tasks, the agent should not retrieve at all for some
subquestions - it already has the answer from prior context or from its training data.

Each pattern in this step solves a real, diagnosable problem. Each also adds complexity:
more components, more configuration, more failure surface. The engineering question is
never "is this pattern better?" It is "does this pattern's improvement justify its cost
for my specific workload?"

The simplicity principle is load-bearing here. Adding a reranker when your retrieval
quality is already 95% precision is not an improvement - it is unnecessary complexity
that will break in production. Adding hybrid search when your queries never contain
exact identifiers is engineering theatre. The patterns in this step are tools to reach
for when Step 3's standard pipeline demonstrably fails on specific query types, not
upgrades to deploy by default.

> **AGENTIC GROUNDING:** In this project, the verification pipeline runs three
> independent models against the same code snapshot (multi-model ensemble review,
> SD-318). This is a two-stage retrieval pattern applied to code review: the first stage
> (each model independently) is fast and broad; the second stage (triangulation synthesis)
> compares and merges results. The same principle underlies reranking: a cheap first pass
> finds candidates, an expensive second pass evaluates them more carefully. The decision
> about when to apply advanced retrieval - only when simpler approaches fail - mirrors the
> project's ROI standing order: weigh cost/time/marginal value before dispatching.

---

## Table of Contents

1. [Hybrid Search](#1-hybrid-search) (~40 min)
2. [Reranking and Two-Stage Retrieval](#2-reranking-and-two-stage-retrieval) (~45 min)
3. [Agentic RAG](#3-agentic-rag) (~45 min)
4. [Knowledge Graphs and RAG](#4-knowledge-graphs-and-rag) (~35 min)
5. [Retrieval for Code](#5-retrieval-for-code) (~30 min)
6. [Index Maintenance](#6-index-maintenance) (~25 min)
7. [When to Use What](#7-when-to-use-what) (~15 min)
8. [Challenges](#challenges) (~90-120 min)
9. [What to Read Next](#what-to-read-next)

---

## Tool Setup

*This section covers installation and verification. If you completed Step 3's Tool Setup,
several dependencies are already installed.*

### Required

```bash
# BM25 for hybrid search
uv pip install rank-bm25

# Cross-encoder reranking
uv pip install sentence-transformers

# Verify both
python3 -c "
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
print('rank-bm25 OK')
print('sentence-transformers OK')
"
```

### Already installed (from Step 3)

```bash
# Should already be available
python3 -c "import chromadb, numpy; print('chromadb + numpy OK')"
```

### For agentic RAG exercise (one required)

**Option A - OpenAI (recommended for function calling):**

```bash
export OPENAI_API_KEY="sk-..."
python3 -c "
from openai import OpenAI
r = OpenAI().chat.completions.create(
  model='gpt-4o-mini', messages=[{'role':'user','content':'Say OK'}], max_tokens=5)
print(r.choices[0].message.content)
"
```

**Option B - Anthropic:**

```bash
uv pip install anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
python3 -c "
from anthropic import Anthropic
r = Anthropic().messages.create(
  model='claude-sonnet-4-20250514', max_tokens=5,
  messages=[{'role':'user','content':'Say OK'}])
print(r.content[0].text)
"
```

**Option C - No API key:** The agentic RAG exercise can be completed conceptually by
examining the agent decision traces provided in the exercise. The hybrid search and
reranking exercises work fully offline.

---

## 1. Hybrid Search

*Estimated time: 40 minutes*

The standard pipeline from Step 3 uses a single retrieval method: embed the query,
find the nearest vectors, return the top-k. This is semantic search. It works by
encoding meaning into vectors and finding documents whose meaning-vectors are close.

The failure mode is specific and predictable. Semantic search encodes *meaning*, not
*surface form*. When a user queries for `ERR_CONN_REFUSED`, the embedding model
produces a vector that represents the general concept of connection errors. A document
containing `ECONNREFUSED` or "the server refused the connection" might rank higher than
the document that contains the exact string `ERR_CONN_REFUSED`, because the embedding
model was never trained to distinguish between lexically similar error codes.

BM25 (Best Matching 25) solves this. It is a bag-of-words ranking function that scores
documents by term frequency, inverse document frequency, and document length
normalisation. BM25 does not understand meaning. It matches tokens. A document
containing the exact query term scores high regardless of whether a semantically similar
document exists elsewhere in the corpus.

Neither method is strictly better. They fail on different query types:

| Query Type | Semantic Search | BM25 |
|-----------|----------------|------|
| Conceptual ("how does authentication work") | Strong | Weak |
| Exact term ("ERR_CONN_REFUSED") | Weak | Strong |
| Named entity ("Richard Hallett") | Weak | Strong |
| Paraphrase ("ways to verify identity") | Strong | Weak |
| Mixed ("configure OAuth2 client_id") | Partial | Partial |

Hybrid search runs both methods on the same query, then fuses the ranked results into a
single list.

### The BM25 Algorithm

BM25 is the successor to TF-IDF. For a query Q containing terms q_1 through q_n, the
BM25 score for a document D is:

```
score(D, Q) = sum over i of IDF(q_i) * (f(q_i, D) * (k1 + 1)) / (f(q_i, D) + k1 * (1 - b + b * |D| / avgdl))
```

Where:
- `f(q_i, D)` is the term frequency of q_i in document D
- `|D|` is the document length
- `avgdl` is the average document length in the corpus
- `k1` (typically 1.2-2.0) controls term frequency saturation
- `b` (typically 0.75) controls document length normalisation
- `IDF(q_i)` is the inverse document frequency: `log((N - n(q_i) + 0.5) / (n(q_i) + 0.5) + 1)`

The key insight is saturation. In TF-IDF, a term appearing 100 times scores 100x higher
than a term appearing once. In BM25, the score saturates - going from 1 to 2 occurrences
matters much more than going from 50 to 51. This prevents long documents from dominating
results simply because they mention a term many times.

### Implementing BM25 in Python

```python
from rank_bm25 import BM25Okapi
import numpy as np

# Sample documents (in production, these are your chunks from Step 3)
documents = [
  "Configure OAuth2 with client_id and client_secret parameters",
  "The ERR_CONN_REFUSED error occurs when the target server is not listening",
  "Authentication verifies user identity through multiple factors",
  "Connection errors can be diagnosed using network debugging tools",
  "OAuth2 requires registering your application to obtain credentials",
]

# Tokenise (BM25 works on token lists, not raw strings)
tokenized_docs = [doc.lower().split() for doc in documents]

# Build the BM25 index
bm25 = BM25Okapi(tokenized_docs)

# Query
query = "ERR_CONN_REFUSED"
tokenized_query = query.lower().split()
bm25_scores = bm25.get_scores(tokenized_query)

# Rank by score
ranked = sorted(enumerate(bm25_scores), key=lambda x: x[1], reverse=True)
for idx, score in ranked[:3]:
  printf_msg = f"  Score {score:.3f}: {documents[idx][:80]}"
  print(printf_msg)
```

The output will rank the document containing `ERR_CONN_REFUSED` first, because BM25
matches the exact token. A semantic search would likely rank the "Connection errors"
document equally high or higher, since the embedding model understands they are related.

### Reciprocal Rank Fusion (RRF)

The fusion problem: you have two ranked lists from different retrieval systems. Each list
may contain different documents, ranked by different criteria. How do you combine them
into a single ranked list?

Reciprocal Rank Fusion (Cormack et al. 2009) is the standard answer. The formula is:

```
RRF_score(d) = sum over all rankers of 1 / (k + rank(d))
```

Where k is a constant (typically 60, from the original paper). A document ranked 1st
contributes 1/(60+1) = 0.0164. A document ranked 10th contributes 1/(60+10) = 0.0143.
A document ranked 100th contributes 1/(60+100) = 0.00625.

The properties of RRF that make it practical:

1. **No training required.** The formula works on any pair of ranked lists without
   learning weights. This matters because training a fusion model requires labeled data
   that most teams do not have.
2. **Robust to score scale differences.** BM25 scores might range from 0 to 25. Cosine
   similarities range from -1 to 1. RRF uses rank positions, not raw scores, so the
   scales do not matter.
3. **Documents present in both lists score higher.** A document at rank 5 in both lists
   scores 2/(60+5) = 0.0308. A document at rank 1 in one list but absent from the other
   scores 1/(60+1) = 0.0164. The overlap signal is strong.

### Implementing Hybrid Search with RRF

```python
from rank_bm25 import BM25Okapi
import numpy as np
from typing import Any

def embed_texts(texts: list[str]) -> np.ndarray:
  """Embed texts using sentence-transformers.
  Replace with your embedding function from Step 2/3."""
  from sentence_transformers import SentenceTransformer
  model = SentenceTransformer("all-MiniLM-L6-v2")
  return model.encode(texts)


def hybrid_search(
  query: str,
  documents: list[str],
  doc_embeddings: np.ndarray,
  bm25_index: BM25Okapi,
  k: int = 60,
  top_n: int = 10,
) -> list[tuple[int, float]]:
  """Hybrid search with RRF fusion.

  Args:
    query: the search query
    documents: list of document texts
    doc_embeddings: pre-computed document embeddings
    bm25_index: pre-built BM25 index
    k: RRF constant (default 60)
    top_n: number of results to return

  Returns:
    list of (doc_index, rrf_score) tuples, sorted by score descending
  """
  # Stage 1a: BM25 retrieval
  tokenized_query = query.lower().split()
  bm25_scores = bm25_index.get_scores(tokenized_query)
  bm25_ranking = np.argsort(-bm25_scores)

  # Stage 1b: Semantic retrieval
  query_embedding = embed_texts([query])[0]
  cosine_similarities = np.dot(doc_embeddings, query_embedding) / (
    np.linalg.norm(doc_embeddings, axis=1) * np.linalg.norm(query_embedding)
  )
  semantic_ranking = np.argsort(-cosine_similarities)

  # Stage 2: RRF fusion
  rrf_scores: dict[int, float] = {}
  for rank, doc_idx in enumerate(bm25_ranking):
    rrf_scores[doc_idx] = rrf_scores.get(doc_idx, 0) + 1.0 / (k + rank + 1)
  for rank, doc_idx in enumerate(semantic_ranking):
    rrf_scores[doc_idx] = rrf_scores.get(doc_idx, 0) + 1.0 / (k + rank + 1)

  # Sort by RRF score
  ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
  return ranked[:top_n]


# Usage
documents = [
  "Configure OAuth2 with client_id and client_secret parameters",
  "The ERR_CONN_REFUSED error occurs when the target server is not listening",
  "Authentication verifies user identity through multiple factors",
  "Connection errors can be diagnosed using network debugging tools",
  "OAuth2 requires registering your application to obtain credentials",
]

# Pre-compute embeddings and BM25 index
doc_embeddings = embed_texts(documents)
tokenized_docs = [doc.lower().split() for doc in documents]
bm25_index = BM25Okapi(tokenized_docs)

# Test queries that exercise different strengths
test_queries = [
  "ERR_CONN_REFUSED",           # Exact term - BM25 advantage
  "how to verify user identity", # Conceptual - semantic advantage
  "OAuth2 client_id setup",      # Mixed - hybrid advantage
]

for query in test_queries:
  results = hybrid_search(query, documents, doc_embeddings, bm25_index, top_n=3)
  print(f"\nQuery: {query}")
  for doc_idx, score in results:
    printf_msg = f"  [{score:.4f}] {documents[doc_idx][:70]}"
    print(printf_msg)
```

### Native Hybrid Search in Vector Databases

Several vector databases support hybrid search without external BM25 implementation:

| Database | Hybrid Support | How |
|----------|---------------|-----|
| Weaviate | Native | Built-in BM25 + vector, configurable alpha weight |
| Qdrant | Native | Sparse vectors (generalised BM25) + dense vectors |
| pgvector | Via Postgres | Postgres `tsvector` full-text search + pgvector similarity, combine in SQL |
| Pinecone | Native | Sparse-dense vectors in same index |
| Chroma | Not native | Requires external BM25 implementation (as shown above) |

If your vector database supports native hybrid search, prefer it over a custom
implementation. The database handles the fusion internally, manages both indices
together, and keeps them consistent as documents are added or removed.

For Qdrant with sparse vectors:

```python
from qdrant_client import QdrantClient
from qdrant_client.models import (
  NamedSparseVector, NamedVector, SearchRequest, SparseVector
)

# Qdrant supports sparse vectors natively for hybrid search.
# Sparse vectors represent BM25-like term scores.
# The query combines dense (embedding) and sparse (term) search
# with fusion handled server-side.
```

For pgvector with Postgres full-text search:

```sql
-- Combine pgvector similarity with Postgres full-text search
-- This runs both searches in a single query
SELECT
  id,
  content,
  -- Semantic score (normalised to 0-1)
  1 - (embedding <=> query_embedding) AS semantic_score,
  -- Lexical score (Postgres ts_rank)
  ts_rank(to_tsvector('english', content), plainto_tsquery('english', 'ERR_CONN_REFUSED')) AS lexical_score
FROM documents
ORDER BY
  -- Simple weighted combination (alternative to RRF)
  0.7 * (1 - (embedding <=> query_embedding)) +
  0.3 * ts_rank(to_tsvector('english', content), plainto_tsquery('english', 'ERR_CONN_REFUSED'))
DESC
LIMIT 10;
```

### When Hybrid Search Justifies Its Complexity

Hybrid search adds a second retrieval path, a fusion step, and (if not using native
database support) a second index to maintain. This is justified when:

1. **Your queries contain domain-specific identifiers.** Error codes, product SKUs,
   API endpoint paths, function names. If users search for exact strings, semantic
   search alone will miss them.
2. **Your corpus contains technical documentation.** Technical docs mix natural language
   with code, identifiers, and jargon. Hybrid search handles the mix.
3. **You can measure the improvement.** Run your test queries from Step 3 against both
   embedding-only and hybrid retrieval. If hybrid does not improve precision@k on your
   actual query distribution, it is not worth the complexity.

Hybrid search is not justified when:
- All your queries are natural language (conversational chatbot, general QA)
- Your corpus is homogeneous text without identifiers
- You are already at >95% precision with semantic search

> **FIELD VS NOVEL:** BM25 is a foundational information retrieval algorithm (Robertson
> and Zaragoza 2009, extending Robertson and Walker 1994). Reciprocal rank fusion was
> introduced by Cormack, Clarke, and Buettcher (2009). Hybrid search combining BM25 with
> dense retrieval is well-documented in the IR literature and now standard in production
> systems. The novel contribution here is the connection to context engineering vocabulary:
> hybrid search as a defence against cold context pressure. When semantic search fails on
> exact identifiers, the model receives wrong or missing context, entering the dumb zone.
> Adding BM25 is not a performance optimisation - it is a context quality control that
> prevents a specific class of retrieval failure.

> **AGENTIC GROUNDING:** The BFS depth rule in this project (SD-195) is a manual hybrid
> retrieval policy. Depth-1 files load every session (broad, always-on, like semantic
> search catching general relevance). Specific file references in session decisions are
> exact lookups (like BM25 matching an identifier). The human operator naturally combines
> both strategies. Automated hybrid search does the same thing at query time, without
> requiring the human to decide which strategy to use.

---

## 2. Reranking and Two-Stage Retrieval

*Estimated time: 45 minutes*

Step 2 introduced bi-encoders: the query and each document are encoded independently,
and similarity is computed between their vectors. This independence is what makes
bi-encoders fast - you encode the query once, then compare it against pre-computed
document vectors using a similarity metric. Retrieval over millions of documents takes
milliseconds.

The independence is also why bi-encoders miss things. When a bi-encoder embeds a query,
it does not know which documents it will be compared against. When it embeds a document,
it does not know which queries will search for it. The embedding must capture "the general
meaning" rather than "the relevance to this specific query."

A cross-encoder removes this independence. It takes the query and a document as a single
input pair and produces a relevance score. The model sees both texts together and can
attend across them - detecting subtle relevance signals that independent encoding misses.

The tradeoff is computational. A bi-encoder encodes the query once (cost: 1 forward pass)
and compares against N pre-computed vectors (cost: N dot products). A cross-encoder
processes each query-document pair independently (cost: N forward passes). For N = 1
million documents, a bi-encoder takes milliseconds; a cross-encoder would take hours.

This is why reranking is a two-stage process:

```
Stage 1: Bi-encoder retrieves top-K candidates (K = 20-100)
    Fast, broad, approximate

Stage 2: Cross-encoder reranks the K candidates
    Slow, precise, attentive

Result: top-N from the reranked list (N = 5-10)
```

The bi-encoder acts as a filter. The cross-encoder acts as a judge. Neither alone is
optimal: the bi-encoder is fast but imprecise; the cross-encoder is precise but cannot
search the full corpus.

### Cross-Encoders in Practice

The sentence-transformers library provides cross-encoder models trained for relevance
prediction:

```python
from sentence_transformers import CrossEncoder

# Load a cross-encoder trained on MS MARCO passage ranking
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

query = "What causes connection refused errors?"
candidates = [
  "The ERR_CONN_REFUSED error occurs when the target server is not listening on the specified port.",
  "Connection pooling reduces the overhead of establishing new TCP connections.",
  "Network errors can be diagnosed using tools like ping, traceroute, and netstat.",
  "The server returns HTTP 503 when it is temporarily unable to handle requests.",
  "ECONNREFUSED is raised by the operating system when a connect() call fails because no process is listening.",
]

# Cross-encoder scores each (query, document) pair
pairs = [[query, doc] for doc in candidates]
scores = reranker.predict(pairs)

# Rank by cross-encoder score
ranked = sorted(zip(scores, candidates), reverse=True)
for score, doc in ranked:
  printf_msg = f"  [{score:.4f}] {doc[:80]}"
  print(printf_msg)
```

The cross-encoder will likely rank the first and fifth documents highest - they directly
answer the question about connection refused errors. The third document (network
debugging tools) might rank mid-range: related but not directly answering the question.
A bi-encoder might rank the third document higher because it is semantically similar to
"connection errors."

### Integrating Reranking into a Pipeline

Building on the pipeline from Step 3:

```python
from sentence_transformers import CrossEncoder, SentenceTransformer
import numpy as np

class TwoStageRetriever:
  """Retrieve with bi-encoder, rerank with cross-encoder."""

  def __init__(
    self,
    bi_encoder_name: str = "all-MiniLM-L6-v2",
    cross_encoder_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
  ):
    self.bi_encoder = SentenceTransformer(bi_encoder_name)
    self.cross_encoder = CrossEncoder(cross_encoder_name)
    self.documents: list[str] = []
    self.doc_embeddings: np.ndarray | None = None

  def index(self, documents: list[str]) -> None:
    """Index documents with the bi-encoder."""
    self.documents = documents
    self.doc_embeddings = self.bi_encoder.encode(documents)

  def retrieve(
    self,
    query: str,
    stage1_k: int = 20,
    stage2_n: int = 5,
  ) -> list[tuple[str, float]]:
    """Two-stage retrieval: bi-encoder then cross-encoder.

    Args:
      query: search query
      stage1_k: number of candidates from bi-encoder
      stage2_n: number of results after reranking

    Returns:
      list of (document, cross_encoder_score) tuples
    """
    if self.doc_embeddings is None:
      raise ValueError("Call index() first")

    # Stage 1: bi-encoder retrieval
    query_embedding = self.bi_encoder.encode([query])[0]
    similarities = np.dot(self.doc_embeddings, query_embedding) / (
      np.linalg.norm(self.doc_embeddings, axis=1) * np.linalg.norm(query_embedding)
    )
    top_k_indices = np.argsort(-similarities)[:stage1_k]

    # Stage 2: cross-encoder reranking
    candidates = [self.documents[i] for i in top_k_indices]
    pairs = [[query, doc] for doc in candidates]
    cross_scores = self.cross_encoder.predict(pairs)

    # Sort by cross-encoder score, return top-N
    reranked = sorted(
      zip(top_k_indices, candidates, cross_scores),
      key=lambda x: x[2],
      reverse=True,
    )
    return [(doc, float(score)) for _, doc, score in reranked[:stage2_n]]


# Usage
retriever = TwoStageRetriever()
retriever.index([
  "OAuth2 uses access tokens for API authorization",
  "The server refused the TCP connection on port 443",
  "Network latency affects API response times",
  "ECONNREFUSED indicates no listener on the target port",
  "TLS handshake failures produce different errors than connection refusals",
])

results = retriever.retrieve("Why is my connection being refused?")
for doc, score in results:
  printf_msg = f"  [{score:.4f}] {doc}"
  print(printf_msg)
```

### Cohere Rerank API

For teams that prefer a managed reranking service, Cohere provides a rerank API:

```python
import cohere

co = cohere.Client("your-cohere-api-key")

results = co.rerank(
  model="rerank-english-v3.0",
  query="What causes connection refused errors?",
  documents=[
    "ERR_CONN_REFUSED occurs when no process listens on the target port",
    "HTTP 503 indicates temporary server overload",
    "Connection pooling reduces TCP handshake overhead",
  ],
  top_n=2,
)

for r in results.results:
  printf_msg = f"  [{r.relevance_score:.4f}] {r.document.text[:80]}"
  print(printf_msg)
```

The trade-off: Cohere rerank requires an API call (latency, cost, vendor dependency) but
does not require downloading or hosting a model. For production systems processing
thousands of queries per day, managed reranking may be cheaper than GPU infrastructure
for self-hosted cross-encoders.

### ColBERT: Late Interaction

ColBERT (Contextualized Late Interaction over BERT, Khattab and Zaharia 2020) occupies
a middle ground between bi-encoders and cross-encoders.

A bi-encoder produces one vector per text. A cross-encoder processes the pair jointly.
ColBERT produces one vector *per token* for both query and document, then computes
relevance by finding, for each query token, the maximum similarity to any document token:

```
ColBERT_score(Q, D) = sum over q_i in Q of max over d_j in D of sim(q_i, d_j)
```

This "late interaction" preserves the precomputation benefit (document token embeddings
can be stored) while allowing token-level matching (each query token attends to the
best-matching document token). The result is quality closer to a cross-encoder with
latency closer to a bi-encoder, at the cost of storing many more vectors per document.

ColBERT is worth knowing about but rarely the first choice. Its storage requirements
(one vector per token, so a 200-token chunk requires 200 vectors instead of 1) are
significant. Use it when: you need cross-encoder quality at bi-encoder-like speed and
can afford the storage overhead.

### When Reranking Justifies Its Complexity

Reranking adds latency (cross-encoder inference on K candidates) and complexity (a
second model to load, maintain, and monitor). This is justified when:

1. **Your queries are ambiguous.** "Python class" could mean the programming construct
   or a course about pythons. A cross-encoder, seeing query and document together, can
   disambiguate. A bi-encoder cannot.
2. **Retrieval errors are expensive.** Medical information, legal analysis, financial
   decisions. When wrong retrieval leads to harmful outputs, the cross-encoder's
   higher precision is worth the latency.
3. **Your Stage 1 consistently retrieves relevant documents in the top-20 but not
   the top-5.** Reranking cannot find documents the bi-encoder missed. It can only
   reorder what was already retrieved. If the relevant document is not in the top-K
   candidates, reranking will not help.

Reranking is not justified when:
- Your bi-encoder already places relevant documents in the top-5 consistently
- Latency is more important than precision (real-time autocomplete, type-ahead)
- Your corpus is small enough that a cross-encoder could search it directly

> **FIELD VS NOVEL:** Cross-encoder reranking is well-established in information retrieval
> (Nogueira and Cho 2019, "Passage Re-ranking with BERT"). ColBERT was introduced by
> Khattab and Zaharia (2020). The two-stage retrieve-then-rerank pattern is standard in
> production search systems. Cohere Rerank and similar APIs make reranking accessible
> without ML infrastructure. The novel framing here connects reranking to the project's
> multi-model ensemble review (SD-318): different retrieval models, like different review
> models, have different blind spots. Convergence between a bi-encoder and a cross-encoder
> builds confidence in a result. Divergence - where the cross-encoder significantly
> reorders the bi-encoder's ranking - locates exactly which documents the bi-encoder
> misjudged. This is model triangulation applied to retrieval.

> **AGENTIC GROUNDING:** The project's verification pipeline (quality gate, then
> adversarial review, then synthesis) is a multi-stage retrieval analogy. The gate is fast
> and broad - it catches obvious errors (type errors, lint violations, test failures). The
> adversarial review is the reranker - it reads the code carefully, attending to query
> (the spec) and document (the implementation) together, catching subtle issues the fast
> pass missed. You would not run adversarial review without the gate passing first. You
> would not run a cross-encoder on the full corpus without a bi-encoder pass first. The
> principle is the same: filter cheaply, then evaluate precisely.

---

## 3. Agentic RAG

*Estimated time: 45 minutes*

Standard RAG retrieves on every query. The user asks a question, the system retrieves
documents, the model generates from the retrieved context. This is fine when every
question genuinely needs external information. It is wasteful - and sometimes harmful -
when it does not.

Consider a conversation where the user first asks "What is OAuth2?" and the system
retrieves and explains OAuth2. Two turns later, the user asks "So how does OAuth2 handle
token refresh?" The system retrieves again, potentially pulling in different chunks that
contradict or dilute the explanation already in the conversation. The answer to the
follow-up was already available in the prior context. Retrieving again added noise.

Agentic RAG gives the agent control over whether, when, and what to retrieve. Instead of
retrieval being a fixed pipeline stage that runs on every query, it becomes a tool the
agent can invoke when it decides retrieval is needed.

### The Spectrum of Retrieval Control

Retrieval control exists on a spectrum:

```
Always retrieve     Conditional retrieve     Agentic retrieve
(Standard RAG)      (Self-RAG, CRAG)         (Tool-use RAG)
     |                    |                       |
  Simple              Moderate                Complex
  Wasteful            Efficient               Flexible
  Predictable         Needs tuning            Needs judgment
```

**Always retrieve (Step 3):** Every query triggers retrieval. Simple, predictable,
but retrieves even when unnecessary. This is what you built in Step 3.

**Conditional retrieve (Self-RAG, Corrective RAG):** The model or a classifier decides
whether retrieval is needed based on the query. Retrieves selectively but requires
training or heuristics to decide when.

**Agentic retrieve (tool-use):** The agent has a retrieval tool and decides when to call
it, what query to use, and whether the results are sufficient. Most flexible but requires
the agent to have good judgment about its own knowledge gaps.

### Self-RAG

Self-RAG (Asai et al. 2023) trains the model to generate special reflection tokens that
control retrieval behaviour:

1. **[Retrieve]** - Should I retrieve for this segment? (yes/no/continue)
2. **[IsRel]** - Is the retrieved passage relevant? (relevant/irrelevant)
3. **[IsSup]** - Is my generation supported by the passage? (fully/partially/no)
4. **[IsUse]** - Is my generation useful to the query? (5-point scale)

The model generates these tokens during inference, using them to decide whether to
retrieve, whether to use what was retrieved, and whether its own output is grounded.

Self-RAG requires fine-tuning a model with these reflection tokens. This is not
something you can bolt onto an API-based LLM. The conceptual contribution matters more
than the specific implementation: the model can learn to be selective about retrieval
and self-critical about its outputs.

For practitioners using API-based models, the Self-RAG insight translates to: give the
model a way to express uncertainty and request retrieval conditionally.

### Corrective RAG (CRAG)

Corrective RAG adds a verification step after retrieval:

```
Query -> Retrieve -> Evaluate relevance -> Branch:
  If relevant:  Generate from retrieved context
  If ambiguous: Retrieve again with refined query
  If irrelevant: Fall back to model's parametric knowledge or web search
```

The key component is the relevance evaluator. This can be:
- A lightweight classifier trained on relevance judgments
- An LLM call that evaluates whether the retrieved documents answer the query
- A confidence threshold on retrieval similarity scores

CRAG is simpler than Self-RAG to implement because it does not require model fine-tuning.
It adds one decision point (evaluate retrieval quality) and one branch (re-retrieve or
fall back).

### Implementing Agentic RAG with Tool Use

The most practical agentic RAG pattern for API-based LLMs: give the agent a search tool
and let it decide when to use it.

```python
import json
from openai import OpenAI

client = OpenAI()

# Define the retrieval tool
search_tool = {
  "type": "function",
  "function": {
    "name": "search_knowledge_base",
    "description": (
      "Search the knowledge base for information. Use this when you need "
      "facts, documentation, or specific details that you are not confident "
      "about from your training data or the current conversation."
    ),
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The search query. Be specific.",
        },
      },
      "required": ["query"],
    },
  },
}


def search_knowledge_base(query: str) -> str:
  """Simulated knowledge base search.
  Replace with your actual retrieval pipeline from Step 3."""
  # In production: embed query, search vector DB, return top chunks
  knowledge = {
    "oauth2": "OAuth2 is an authorization framework (RFC 6749). "
              "Token refresh uses the refresh_token grant type.",
    "connection": "ERR_CONN_REFUSED occurs when no process listens "
                  "on the target port. Check if the service is running.",
  }
  for key, value in knowledge.items():
    if key in query.lower():
      return value
  return "No relevant documents found."


def agentic_rag_chat(messages: list[dict]) -> str:
  """Chat with agentic retrieval - the model decides when to search."""
  response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
    tools=[search_tool],
    tool_choice="auto",  # Model decides whether to call the tool
  )

  message = response.choices[0].message

  # If the model chose to search, execute the search and continue
  if message.tool_calls:
    # Append the assistant's tool call message
    messages.append(message)

    for tool_call in message.tool_calls:
      args = json.loads(tool_call.function.arguments)
      result = search_knowledge_base(args["query"])
      messages.append({
        "role": "tool",
        "tool_call_id": tool_call.id,
        "content": result,
      })

    # Get final response with search results in context
    final = client.chat.completions.create(
      model="gpt-4o-mini",
      messages=messages,
    )
    return final.choices[0].message.content

  # Model answered without searching
  return message.content


# Test: when does the agent retrieve vs not retrieve?
messages = [
  {"role": "system", "content": (
    "You are a technical assistant. You have a search tool for "
    "the knowledge base. Only use it when you need specific facts "
    "you are not confident about. For general knowledge or follow-up "
    "questions where the answer is already in the conversation, "
    "answer directly."
  )},
]

# Turn 1: needs retrieval (specific technical fact)
messages.append({"role": "user", "content": "What is OAuth2?"})
response = agentic_rag_chat(messages)
print(f"Turn 1: {response[:100]}...")

# Turn 2: should NOT need retrieval (follow-up on prior context)
messages.append({"role": "assistant", "content": response})
messages.append({"role": "user", "content": "Can you explain that more simply?"})
response = agentic_rag_chat(messages)
print(f"Turn 2: {response[:100]}...")
```

### The Judgment Problem

Agentic RAG introduces a new failure mode: the agent's judgment about when to retrieve
can be wrong. Two error types:

1. **Under-retrieval.** The agent is confident but wrong. It answers from training data
   when it should have searched. The output contains a hallucination that retrieval would
   have prevented.

2. **Over-retrieval.** The agent searches for everything, treating the retrieval tool as
   a crutch. This adds latency, cost, and sometimes worse answers (retrieved context
   dilutes the signal already in the conversation).

Under-retrieval is the more dangerous failure. The agent does not know what it does not
know - the dumb zone (from this project's vocabulary) is invisible to the entity inside
it. Over-retrieval wastes resources but at least provides the model with potentially
useful information.

Practical mitigation for under-retrieval:
- For high-stakes domains, default to always-retrieve for factual questions
- Use confidence calibration: if the model hedges or qualifies, trigger retrieval
- Log which questions the model answered without retrieval and audit a sample

Practical mitigation for over-retrieval:
- Tune the system prompt to specify when retrieval is unnecessary
- Add few-shot examples showing the model declining to search for follow-up questions
- Monitor retrieval rate and set alerts if it exceeds baseline

> **FIELD VS NOVEL:** Self-RAG (Asai et al. 2023) introduced the reflection-token
> framework for adaptive retrieval. Corrective RAG (Yan et al. 2024) added post-retrieval
> evaluation. Both are published research with open implementations. Tool-use RAG (where
> the agent decides when to call a search function) is standard practice in production
> agentic systems. The novel contribution here is the connection to the dumb zone concept:
> under-retrieval is not just a latency optimisation gone wrong - it is the agent entering
> the dumb zone, producing syntactically valid output that is semantically disconnected
> from the corpus. The project's standing policy "do not infer what you can verify" (the
> engineering loop) is the human version of "when in doubt, retrieve."

> **AGENTIC GROUNDING:** The one-shot agent job pattern in this project (polecats, SD-296)
> is a deliberate always-retrieve design. Each polecat gets fresh context and a plan file
> as its prime context. It does not decide what context it needs - the dispatcher provides
> exactly the working set for the task. This is the opposite of agentic RAG: the context
> decision is made by the orchestrator, not the executor. Both patterns are valid. The
> choice depends on whether the agent or the orchestrator is better positioned to judge
> what context is needed. For deterministic tasks with known context needs, dispatcher
> control (polecats) is more reliable. For exploratory tasks with unpredictable context
> needs, agentic retrieval is more flexible.

---

## 4. Knowledge Graphs and RAG

*Estimated time: 35 minutes*

Standard RAG retrieves passages. It finds the chunk most similar to the query and returns
it. This works for questions that can be answered by a single passage or a small set of
passages. It fails for questions that require traversing relationships.

"Who manages the engineer who wrote the authentication module?" requires three lookups:
(1) find who wrote the authentication module, (2) find their manager, (3) return the
manager's name. A standard RAG pipeline might retrieve a document about the
authentication module but not the organisational chart. It might retrieve the org chart
but not link the author to their position in it. The information exists in the corpus,
but the connections between entities are not represented in the embedding space.

Knowledge graphs represent entities and relationships explicitly. A node is an entity
(a person, a module, a concept). An edge is a relationship (wrote, manages, depends-on).
Graph traversal follows these edges to answer multi-hop questions that passage retrieval
cannot.

### GraphRAG (Microsoft, 2024)

GraphRAG (Edge et al. 2024) addresses a different failure mode: global questions.
"What are the main themes in this documentation?" is not answerable by retrieving any
single passage. No single chunk summarises the entire corpus. Standard RAG returns
whichever passage happens to be closest to the query embedding - typically a passage
about one theme, not a synthesis of all themes.

GraphRAG builds a knowledge graph from the corpus and uses it for query-focused
summarisation:

**Indexing (offline, expensive):**
1. Extract entities and relationships from every document using an LLM
2. Build a knowledge graph from the extracted triples (entity - relation - entity)
3. Detect communities of related entities using graph clustering algorithms
   (Leiden algorithm)
4. Generate a summary for each community using an LLM

**Query answering (online):**
1. Each community summary generates a partial answer to the query
2. All partial answers are synthesised into a final response

```
Documents -> LLM extraction -> Knowledge graph -> Community detection
    -> Community summaries -> Query -> Partial answers -> Synthesis
```

### The Cost Equation

GraphRAG's indexing is expensive. Every document requires an LLM call for entity
extraction. Community summarisation requires additional LLM calls. For a corpus of 1000
documents, indexing might require 2000-5000 LLM calls (extraction + summarisation). At
$0.003 per 1K input tokens for a fast model, a 1M token corpus costs roughly $3-15 to
index - manageable, but non-trivial. At $0.005 per 1K tokens (Opus), the same corpus
costs $5-25.

This cost is amortised over queries. If the index is queried 10,000 times, the per-query
indexing cost is negligible. If the corpus changes daily, re-indexing is expensive.

```python
# GraphRAG cost estimation
def estimate_graphrag_cost(
  num_documents: int,
  avg_tokens_per_doc: int,
  input_cost_per_1k: float = 0.003,
  output_cost_per_1k: float = 0.015,
) -> dict[str, float]:
  """Estimate GraphRAG indexing cost.

  Each document needs ~1 extraction call.
  Community summaries add ~20% overhead.
  """
  total_input_tokens = num_documents * avg_tokens_per_doc
  # Extraction prompts include the document + instructions (~200 tokens overhead)
  extraction_input = total_input_tokens + (num_documents * 200)
  # Extraction output: ~30% of input (entities and relations)
  extraction_output = total_input_tokens * 0.3
  # Community summaries: ~20% of total extraction volume
  summary_input = extraction_output * 0.2
  summary_output = summary_input * 0.5

  total_input = extraction_input + summary_input
  total_output = extraction_output + summary_output

  input_cost = (total_input / 1000) * input_cost_per_1k
  output_cost = (total_output / 1000) * output_cost_per_1k

  return {
    "total_input_tokens": total_input,
    "total_output_tokens": total_output,
    "input_cost_usd": round(input_cost, 2),
    "output_cost_usd": round(output_cost, 2),
    "total_cost_usd": round(input_cost + output_cost, 2),
  }


# Example: 500 documents, ~2000 tokens each
cost = estimate_graphrag_cost(500, 2000)
for k, v in cost.items():
  printf_msg = f"  {k}: {v}"
  print(printf_msg)
```

### When Knowledge Graphs Add Value

Knowledge graphs add value for a specific class of questions. Be precise about what that
class is:

**Graph helps:**
- Multi-hop reasoning: "What team owns the service that the checkout API depends on?"
- Entity disambiguation: "Which 'Jordan' - the engineer or the customer?"
- Relationship queries: "What are all the services that depend on the auth module?"
- Global summarisation: "What are the main architectural patterns in this codebase?"
- Temporal queries: "What changed in the billing module in the last quarter?"

**Graph does not help (use standard RAG):**
- Single-hop factual questions: "What does ERR_CONN_REFUSED mean?"
- Passage retrieval: "Find the documentation for the /api/users endpoint"
- Similarity search: "Find documents similar to this bug report"
- Questions answerable from a single document

If you survey your actual query distribution and most questions are single-hop or
passage retrieval, a knowledge graph adds complexity without proportional value. Measure
first. The cost of building and maintaining a knowledge graph is high. The benefit is
concentrated in multi-hop and global questions that your users may or may not ask.

### Lighter Alternatives to Full GraphRAG

Before committing to GraphRAG's full pipeline, consider lighter approaches:

**Metadata-enriched retrieval:** Add structured metadata to chunks (author, date, topic,
entities mentioned) and filter retrieval by metadata. This handles many "multi-hop"
questions by pre-answering one hop via metadata.

**Entity linking:** Extract named entities during indexing and store them as chunk
metadata. At query time, identify entities in the query and use them for filtered
retrieval. Simpler than a full knowledge graph but handles entity disambiguation.

**Parent-child document retrieval:** Index chunks but retrieve their parent documents
(or larger windows) when context is needed. LlamaIndex's node relationships support
this natively. Handles questions that span chunk boundaries without graph infrastructure.

> **FIELD VS NOVEL:** Knowledge graphs in NLP are well-established (Hogan et al. 2021,
> "Knowledge Graphs" survey). GraphRAG was introduced by Edge et al. (2024) at Microsoft
> Research and demonstrated on query-focused summarisation tasks. The Leiden community
> detection algorithm is from Traag et al. (2019). The novel connection here is to the
> project's own entity-relationship problem: the session decision chain (SD-001 through
> SD-322) is a knowledge graph encoded as an append-only log. Standing orders reference
> decisions. Decisions reference files. Files reference other files via backrefs in
> events.yaml. The BFS depth map in AGENTS.md is a manual graph of document relationships
> with traversal priorities. GraphRAG automates what the project does manually through
> cross-references and backlinks.

> **AGENTIC GROUNDING:** The project's backreference web - events.yaml backrefs, session
> decisions referencing prior decisions, catch-log.tsv linking controls to outcomes - is a
> hand-built knowledge graph. When the dead reckoning protocol (checkpoint recovery) runs
> after a context window death, it traverses this graph: read the SD index, follow
> references to relevant decisions, reconstruct working state. This is graph-based
> retrieval applied to agent state recovery. The manual version works because the corpus
> is small (hundreds of decisions, not millions of documents). At corpus scale, automation
> (GraphRAG) becomes necessary.

---

## 5. Retrieval for Code

*Estimated time: 30 minutes*

Code retrieval is a distinct problem from document retrieval. The surface similarities -
both involve searching a corpus for relevant content - obscure fundamental differences in
how code stores meaning and how developers search for it.

### How Code Differs from Documents

**Structure carries meaning.** A function's position in a call graph, its class
hierarchy, and its import relationships define its meaning as much as its source text.
The function `authenticate(user, password)` means different things depending on whether
it is in `auth/local.py` or `auth/oauth2.py`. Document retrieval rarely needs this
structural context.

**Identifiers are compressed natural language.** The variable name `max_retry_count` is
three English words concatenated. Embedding models trained on natural language handle
this reasonably well, but camelCase (`maxRetryCount`), snake_case (`max_retry_count`),
and abbreviations (`max_rtry_cnt`) are three surface forms for the same concept. Lexical
search treats them as different tokens. Semantic search handles some but not all of these
normalisation challenges.

**Dependency context is required.** Understanding a function requires knowing what it
calls, what calls it, what types it uses, and what modules it imports. A chunk containing
a single function definition, stripped of its imports and callers, is often insufficient
for an LLM to understand how to use or modify it.

**Queries are heterogeneous.** Developers search for code in fundamentally different
ways:
- By name: "find the authenticate function"
- By behaviour: "find where we validate email addresses"
- By error: "where does ERR_AUTH_FAILED get raised?"
- By pattern: "find all uses of the database connection pool"
- By example: "find code similar to this snippet"

### Code-Specific Embedding Models

General-purpose embedding models (text-embedding-3-small, all-MiniLM-L6-v2) work for
code but are not optimised for it. Code-specific models exist:

| Model | Source | Notes |
|-------|--------|-------|
| CodeBERT | Microsoft | Trained on code+comments, multiple languages |
| UniXcoder | Microsoft | Unified cross-modal (code, comments, AST) |
| StarEncoder | BigCode | Trained on The Stack, large-scale code corpus |
| General models (text-embedding-3) | OpenAI | Work reasonably well for code, especially with comments |

The gap between general and code-specific models has narrowed. On MTEB code benchmarks,
the best general-purpose models perform competitively with code-specific ones. For most
practical purposes, using the same embedding model for both code and documentation
simplifies the system without significant quality loss.

### Structure-Aware Chunking

Fixed-size chunking (Step 3) splits code at arbitrary byte boundaries. This breaks
functions in half, separates class definitions from their methods, and strips context.
Structure-aware chunking uses the language's syntax tree to create meaningful units.

Tree-sitter is the standard tool for structure-aware parsing. It produces concrete
syntax trees for most programming languages and can be used to extract function
definitions, class boundaries, and other structural units:

```python
# Conceptual structure-aware chunking with tree-sitter
# Install: uv pip install tree-sitter tree-sitter-python

def chunk_python_file(source: str) -> list[dict]:
  """Split Python source into structural chunks.

  Each chunk is a complete function, class, or top-level block
  with its docstring and decorator(s) preserved.
  """
  import tree_sitter_python as tspython
  from tree_sitter import Language, Parser

  PY_LANGUAGE = Language(tspython.language())
  parser = Parser(PY_LANGUAGE)
  tree = parser.parse(bytes(source, "utf8"))

  chunks = []
  for node in tree.root_node.children:
    if node.type in ("function_definition", "class_definition"):
      chunk_text = source[node.start_byte:node.end_byte]
      chunks.append({
        "text": chunk_text,
        "type": node.type,
        "name": node.children[1].text.decode("utf8"),  # function/class name
        "start_line": node.start_point[0],
        "end_line": node.end_point[0],
      })
    elif node.type == "expression_statement":
      # Top-level expressions (module docstrings, assignments)
      chunk_text = source[node.start_byte:node.end_byte]
      if len(chunk_text.strip()) > 10:  # Skip trivial lines
        chunks.append({
          "text": chunk_text,
          "type": "top_level",
          "name": None,
          "start_line": node.start_point[0],
          "end_line": node.end_point[0],
        })
  return chunks
```

### Agentic Code Retrieval

The dominant trend in code retrieval (March 2026) is agentic: the LLM drives the search
process iteratively rather than performing a single retrieval pass.

The pattern:
1. Agent receives a task ("fix the authentication bug")
2. Agent searches for relevant files (grep for "auth", search for function names)
3. Agent reads files, follows imports, examines callers
4. Agent iteratively refines its understanding until it has sufficient context
5. Agent implements the change

This is how tools like Claude Code, Cursor, and similar agentic coding tools work. The
retrieval is not a pipeline stage - it is interwoven with reasoning. The agent decides
what to search for based on what it has already found.

This pattern is effective because code retrieval needs are unpredictable. A developer
rarely knows which files they need before they start investigating. The same is true for
an agent. Agentic retrieval trades the efficiency of batch retrieval (one query, get all
results) for the precision of iterative investigation (search, read, search again based
on what was found).

> **FIELD VS NOVEL:** Code retrieval research spans decades, from grep to structural
> search (Sourcegraph) to neural code search (CodeBERT, Feng et al. 2020). Tree-sitter
> (Brunsfeld 2018) provides structure-aware parsing across languages. The agentic code
> retrieval pattern is emerging in practice (2024-2026) as LLM-based coding tools gain
> adoption. The novel connection here is to the project's own code retrieval practice:
> the AGENTS.md BFS depth map is a manual code retrieval policy. Depth 1 = always load
> (like indexing core files). The "one domain = one directory = one agent context boundary"
> rule (SD-304) is a chunking strategy for code - each domain is a chunk with its own
> DOMAIN.md as metadata. The working set concept (Denning 1968, applied to LLM context
> in SD-311) applies directly: the agent's working set for a code task is the minimum
> set of files needed for correct implementation.

---

## 6. Index Maintenance

*Estimated time: 25 minutes*

Building an index is a one-time operation. Maintaining it is ongoing. Every retrieval
system that operates on changing data must answer: how does the index stay current as
documents are added, modified, and deleted?

### The Freshness Problem

The delay between a document being updated and the update being reflected in search
results is the freshness gap. In a standard RAG pipeline from Step 3:

1. A document is updated in the source system
2. The document must be re-chunked (if the chunking strategy is not incremental)
3. New chunks must be embedded (API call per chunk or batch)
4. Embeddings must be stored in the vector database
5. Old embeddings for the previous version must be removed

Each step takes time. If step 2 runs hourly, a document updated at 10:01 is not
searchable until 11:00. If step 3 uses a rate-limited API, large batch updates queue
behind the rate limit. If step 5 is forgotten, the index contains both old and new
versions, and retrieval may return stale content.

This is stale reference propagation (from this project's slopodar): the index describes
a state that no longer exists. Every query that retrieves a stale chunk operates on false
information. Unlike stale documentation that a human might recognise as outdated, a
stale chunk in a vector database is indistinguishable from a current one - the embedding
does not encode the document's version or timestamp.

### Incremental vs Full Rebuild

Two strategies for keeping an index current:

**Incremental indexing:** When a document changes, re-chunk and re-embed only that
document. Replace the old chunks in the vector database with the new ones.

```python
import hashlib
from typing import Any

def compute_chunk_hash(text: str) -> str:
  """Hash a chunk for change detection."""
  return hashlib.sha256(text.encode()).hexdigest()


def incremental_update(
  collection: Any,  # Chroma collection
  doc_id: str,
  new_chunks: list[str],
  embed_fn: callable,
) -> dict[str, int]:
  """Update only changed chunks for a document.

  Returns counts of added, unchanged, and removed chunks.
  """
  # Get existing chunks for this document
  existing = collection.get(
    where={"doc_id": doc_id},
    include=["documents", "metadatas"],
  )

  existing_hashes = {
    m["chunk_hash"]: eid
    for eid, m in zip(existing["ids"], existing["metadatas"])
  }

  new_hashes = {compute_chunk_hash(chunk): chunk for chunk in new_chunks}

  # Determine changes
  to_add = {h: c for h, c in new_hashes.items() if h not in existing_hashes}
  to_keep = {h for h in new_hashes if h in existing_hashes}
  to_remove = {h: eid for h, eid in existing_hashes.items() if h not in new_hashes}

  # Remove stale chunks
  if to_remove:
    collection.delete(ids=list(to_remove.values()))

  # Add new chunks
  if to_add:
    add_texts = list(to_add.values())
    add_embeddings = embed_fn(add_texts)
    add_ids = [f"{doc_id}_{h[:12]}" for h in to_add.keys()]
    add_metadatas = [
      {"doc_id": doc_id, "chunk_hash": h}
      for h in to_add.keys()
    ]
    collection.add(
      ids=add_ids,
      embeddings=add_embeddings.tolist(),
      documents=add_texts,
      metadatas=add_metadatas,
    )

  return {
    "added": len(to_add),
    "unchanged": len(to_keep),
    "removed": len(to_remove),
  }
```

**Full rebuild:** Drop the entire index, re-chunk and re-embed all documents, build a
new index from scratch.

| Aspect | Incremental | Full Rebuild |
|--------|------------|--------------|
| Latency | Low (only changed docs) | High (entire corpus) |
| Complexity | Higher (change detection, partial updates) | Lower (simple pipeline) |
| Consistency | Risk of stale chunks if detection fails | Guaranteed fresh |
| Cost | Proportional to changes | Proportional to corpus size |
| Embedding model upgrades | Cannot mix old/new embeddings | Clean slate |

The practical recommendation: use incremental indexing for ongoing changes, but schedule
periodic full rebuilds (weekly or monthly) to clear accumulated inconsistencies. When you
upgrade your embedding model, a full rebuild is mandatory - you cannot meaningfully
compare embeddings from different models.

### Document Versioning

When a document is updated, should the old version be deleted or retained? This depends
on the use case:

- **Replace:** Most common. The old version is outdated; only the current version
  should be searchable. Delete old chunks, add new ones.
- **Append with timestamp:** For audit trails or historical queries. Keep old chunks
  but add a `version` or `updated_at` metadata field. Filter by recency at query time.
- **Soft delete:** Mark old chunks as inactive (metadata flag) rather than deleting.
  Allows recovery and audit but requires query-time filtering.

### Monitoring Index Health

An index that silently degrades is worse than one that visibly fails. Monitor:

```python
def check_index_health(collection: Any) -> dict[str, Any]:
  """Basic health check for a Chroma collection."""
  count = collection.count()
  # Sample random chunks and verify they are current
  sample = collection.get(
    limit=10,
    include=["metadatas", "documents"],
  )

  health = {
    "total_chunks": count,
    "sample_size": len(sample["ids"]),
  }

  # Check for chunks missing required metadata
  missing_metadata = sum(
    1 for m in sample["metadatas"]
    if "doc_id" not in m or "chunk_hash" not in m
  )
  health["chunks_missing_metadata"] = missing_metadata

  # Check for empty documents
  empty_docs = sum(
    1 for d in sample["documents"]
    if not d or len(d.strip()) == 0
  )
  health["empty_chunks"] = empty_docs

  return health
```

Key metrics to track:
- **Total chunk count** over time (sudden drops indicate accidental deletion)
- **Freshness distribution** (how old are the chunks? any stale ones?)
- **Retrieval hit rate** (are queries returning results? a sudden drop in hit rate may
  indicate index corruption)
- **Embedding model version** (are all chunks embedded with the same model version?)

> **AGENTIC GROUNDING:** The project's own index maintenance story is visible in AGENTS.md.
> The filesystem depth map is a manually maintained index of the repository. When files are
> added, renamed, or deleted, the depth map must be updated - or it becomes a stale
> reference. The session decisions index (session-decisions-index.yaml) is a curated index
> over the append-only decision chain: not a full rebuild of all 322 decisions, but a
> maintained summary of standing orders and recent decisions. This is incremental indexing
> with periodic curation - the same pattern that works for vector databases. The standing
> policy SD-266 ("write to durable file, not context only") is the index maintenance rule:
> state that exists only in the context window is not indexed, not searchable, and will be
> lost.

---

## 7. When to Use What

*Estimated time: 15 minutes*

Each pattern in this step solves a specific problem. None is a universal improvement over
the Step 3 pipeline. The decision tree:

```
Start with Step 3 pipeline (embed, retrieve, generate)
  |
  Does your retrieval quality meet requirements?
  |
  YES -> Stop. Do not add complexity.
  |
  NO -> Diagnose the failure mode:
    |
    Exact terms not found?
      -> Hybrid search (Section 1)
    |
    Relevant docs in top-20 but not top-5?
      -> Reranking (Section 2)
    |
    Retrieving when unnecessary, or not retrieving when needed?
      -> Agentic RAG (Section 3)
    |
    Multi-hop or global questions failing?
      -> Knowledge graphs (Section 4)
    |
    Code-specific queries failing?
      -> Code retrieval patterns (Section 5)
    |
    Results going stale over time?
      -> Index maintenance (Section 6)
```

### Complexity Budget

Each pattern has a maintenance cost:

| Pattern | Components Added | Ongoing Maintenance | Failure Surface |
|---------|-----------------|--------------------|-----------------| 
| Step 3 baseline | Embedder, vector DB, prompt | Model updates, index refresh | Chunking, embedding drift |
| + Hybrid search | BM25 index, fusion logic | Second index to maintain | Fusion weights, tokenisation |
| + Reranking | Cross-encoder model | Model updates, latency monitoring | Timeout handling, fallback |
| + Agentic RAG | Tool definitions, agent logic | Prompt tuning, retrieval auditing | Under/over-retrieval |
| + Knowledge graph | Graph DB, extraction pipeline | Entity updates, re-extraction | Graph staleness, extraction errors |

A system with all five patterns running simultaneously has five times the failure surface
of a Step 3 baseline. Each pattern is an engineering trade-off, not a free upgrade.

### The ROI Question

Before adding any pattern from this step, answer three questions:

1. **What specific queries fail with the current pipeline?** Collect examples. If you
   cannot name the failing queries, you cannot measure whether the pattern helps.
2. **What is the expected improvement?** Run the failing queries against a prototype of
   the new pattern. Measure precision@k, MRR, or whatever metric you established in
   Step 3.
3. **What is the maintenance cost?** Every component you add must be monitored, updated,
   and debugged when it breaks. Estimate the ongoing engineering hours.

If the expected improvement does not justify the maintenance cost, do not add the
pattern. This is the marginal analysis heuristic: continue while marginal value exceeds
marginal cost.

> **FIELD VS NOVEL:** The decision framework (diagnose before optimising, measure before
> adding complexity) is standard engineering practice. The specific failure-mode-to-pattern
> mapping is synthesised from IR literature and production experience across the patterns
> discussed in this step. The novel framing applies the project's ROI standing order
> ("before dispatching or review rounds, weigh cost/time/marginal value vs proceeding")
> to retrieval engineering. The complexity budget concept maps to the project's
> diminishing marginal returns heuristic: each additional pattern yields less value than
> the last, and at some point the marginal maintenance cost exceeds the marginal quality
> improvement.

---

## Challenge: Implement Hybrid Search

**Estimated time: 30 minutes**

**Prerequisites:** Completed Tool Setup. Familiarity with embedding and retrieval from
Steps 2 and 3.

**Goal:** Build a hybrid search system that combines BM25 and semantic retrieval over a
set of test documents, using reciprocal rank fusion. Compare its performance to
embedding-only retrieval on queries designed to exercise both retrieval methods.

### Setup

```python
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

# Test corpus: deliberately includes exact identifiers, conceptual descriptions,
# and mixed content to exercise both retrieval methods
corpus = [
  "The authenticate() function in auth/local.py validates username and password "
  "against the bcrypt hash stored in the users table.",

  "ERR_AUTH_INVALID_CREDENTIALS is raised when the password hash comparison fails "
  "in the local authentication module.",

  "OAuth2 authorization uses the authorization code grant flow for server-side "
  "applications that can securely store client secrets.",

  "The session middleware checks the JWT expiration timestamp on every request "
  "and returns HTTP 401 if the token has expired.",

  "Two-factor authentication adds a second verification step using TOTP codes "
  "generated by an authenticator app.",

  "The rate limiter tracks failed login attempts per IP address and blocks "
  "further attempts after 5 failures within 15 minutes.",

  "Password reset tokens are generated using crypto.randomBytes(32) and expire "
  "after 24 hours. They are single-use.",

  "The RBAC system maps users to roles and roles to permissions. Permission "
  "checks happen at the middleware layer before route handlers execute.",

  "SSO integration uses SAML 2.0 assertions. The identity provider sends a "
  "signed XML document containing user attributes.",

  "The audit log records every authentication event with timestamp, user ID, "
  "IP address, and whether the attempt succeeded or failed.",
]

# Test queries: 5 that favour BM25, 5 that favour semantic search
test_queries = [
  # BM25-favoured (exact identifiers)
  ("ERR_AUTH_INVALID_CREDENTIALS", 1),     # Expected: doc index 1
  ("authenticate() function", 0),          # Expected: doc index 0
  ("crypto.randomBytes", 6),               # Expected: doc index 6
  ("HTTP 401", 3),                         # Expected: doc index 3
  ("SAML 2.0", 8),                         # Expected: doc index 8

  # Semantic-favoured (conceptual)
  ("how does login security work", 5),     # Expected: doc index 5 (rate limiter)
  ("verifying user identity", 4),          # Expected: doc index 4 (2FA)
  ("what happens when access expires", 3), # Expected: doc index 3 (JWT)
  ("controlling who can do what", 7),      # Expected: doc index 7 (RBAC)
  ("tracking security events", 9),         # Expected: doc index 9 (audit log)
]
```

### Task

1. Implement three retrieval functions:
   - `semantic_only(query, top_n=5)` - embedding cosine similarity
   - `bm25_only(query, top_n=5)` - BM25 score ranking
   - `hybrid_rrf(query, top_n=5, k=60)` - RRF fusion of both

2. For each test query, record the rank of the expected document in each method's
   results (or "not in top-5" if it is absent).

3. Compute precision@5 for each method across all 10 queries.

**Verification:** Hybrid search should outperform both individual methods on the full
query set. BM25 should win on identifier queries. Semantic should win on conceptual
queries.

**Fallback:** This exercise runs fully offline using sentence-transformers. No API key
required.

<details>
<summary>Hints</summary>

- For the semantic search, use `SentenceTransformer("all-MiniLM-L6-v2")` and cosine
  similarity (normalize embeddings and use dot product).
- For BM25, tokenize with `.lower().split()`. This is crude but sufficient for this
  exercise. Production BM25 uses stemming and stop-word removal.
- For RRF, use k=60 (the standard value). Build a dictionary mapping document indices
  to RRF scores, adding contributions from both ranked lists.
- Precision@5 = (number of queries where expected doc is in top 5) / (total queries).

</details>

**Extension:** Experiment with the RRF k parameter. Try k=1, k=10, k=60, k=100. How
does the parameter affect the balance between BM25 and semantic rankings?

---

## Challenge: Add Reranking to Your Pipeline

**Estimated time: 25 minutes**

**Prerequisites:** Completed the hybrid search challenge or have a working semantic
retrieval pipeline from Step 3.

**Goal:** Add cross-encoder reranking to the top-20 retrieval results and measure whether
it improves ranking for ambiguous queries.

### Setup

```python
from sentence_transformers import CrossEncoder, SentenceTransformer
import numpy as np

# Use the same corpus from the hybrid search challenge

# Ambiguous queries where reranking should help
ambiguous_queries = [
  # "Python class" - programming construct or course?
  {
    "query": "Python class implementation",
    "docs": [
      "A Python class defines a blueprint for creating objects with attributes and methods.",
      "The Python programming course covers data structures, algorithms, and OOP concepts.",
      "Class-based views in Django provide reusable request handling patterns.",
      "Python's type system uses classes for runtime type checking with isinstance().",
      "The advanced Python class meets every Tuesday and Thursday from 2-4 PM.",
    ],
    "relevant": [0, 2, 3],  # Indices of programming-related docs
  },
  # "model training" - ML or employee onboarding?
  {
    "query": "model training process",
    "docs": [
      "Fine-tuning a pre-trained model requires a labeled dataset and a training loop.",
      "New employee training covers company policies, tools, and team workflows.",
      "The training pipeline includes data preprocessing, model compilation, and evaluation.",
      "Training models on GPU reduces epoch time from hours to minutes.",
      "The HR department schedules mandatory training sessions quarterly.",
    ],
    "relevant": [0, 2, 3],  # Indices of ML-related docs
  },
]
```

### Task

1. For each ambiguous query, retrieve with a bi-encoder (top-5 by cosine similarity).
2. Rerank the top-5 with a cross-encoder (`cross-encoder/ms-marco-MiniLM-L-6-v2`).
3. Compare: does reranking move the relevant documents higher?

Measure:
- Mean rank of relevant documents before reranking
- Mean rank of relevant documents after reranking
- Number of queries where the top-1 result changed

**Verification:** The cross-encoder should place at least one additional relevant document
in the top-3 for at least one of the ambiguous queries.

**Fallback:** This exercise runs fully offline. Both bi-encoder and cross-encoder models
are downloaded automatically by sentence-transformers.

<details>
<summary>Hints</summary>

- The bi-encoder: `SentenceTransformer("all-MiniLM-L6-v2")`
- The cross-encoder: `CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")`
- For the cross-encoder, create pairs: `[[query, doc] for doc in candidates]`
- Call `cross_encoder.predict(pairs)` to get relevance scores.
- Sort by the cross-encoder scores to get the reranked order.
- Compare rank positions before and after for the "relevant" document indices.

</details>

**Extension:** Increase the Stage 1 candidate pool from 5 to 20. Does the cross-encoder
find relevant documents that were not in the original top-5? This demonstrates the value
of the two-stage pattern: cast a wider net in Stage 1, then use the cross-encoder to
filter precisely.

---

## Challenge: Agentic RAG - When to Retrieve

**Estimated time: 35 minutes**

**Prerequisites:** An LLM API key (OpenAI or Anthropic). Familiarity with tool use.

**Goal:** Build an agent with a retrieval tool and test whether it correctly decides when
retrieval is needed and when it is not. Design test cases that distinguish between
questions requiring retrieval and questions answerable from context.

### Setup

```python
import json
from openai import OpenAI  # or Anthropic

client = OpenAI()

# Knowledge base (simulated)
knowledge_base = {
  "project_auth": (
    "The project uses JWT tokens for API authentication. Tokens expire after "
    "1 hour. Refresh tokens last 30 days. The auth module is in lib/auth/."
  ),
  "deployment": (
    "Deployment uses Docker containers on AWS ECS. The CI pipeline runs "
    "tests, builds the image, and pushes to ECR. Deployment to staging "
    "is automatic; production requires manual approval."
  ),
  "database": (
    "The project uses Postgres 16 with pgvector for embeddings. The schema "
    "has 12 tables. Migrations use Drizzle ORM. Connection pooling via PgBouncer."
  ),
}

def search(query: str) -> str:
  """Search the knowledge base. Returns the most relevant entry."""
  query_lower = query.lower()
  for key, value in knowledge_base.items():
    if any(term in query_lower for term in key.split("_")):
      return value
  return "No relevant information found in the knowledge base."

# Tool definition
tools = [{
  "type": "function",
  "function": {
    "name": "search_knowledge_base",
    "description": (
      "Search the project knowledge base for specific technical details. "
      "Use ONLY when you need project-specific facts. Do NOT use for: "
      "general programming questions, follow-up questions where the "
      "answer is already in the conversation, or simple clarifications."
    ),
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Specific search query",
        },
      },
      "required": ["query"],
    },
  },
}]
```

### Task

Design 10 test cases - 5 that should trigger retrieval and 5 that should not:

**Should retrieve:**
1. "What database does the project use?" (project-specific fact)
2. "How long do JWT tokens last?" (specific detail)
3. "What is the deployment process?" (project-specific workflow)
4. "Where is the auth module located?" (file location)
5. "Does the project use connection pooling?" (specific infrastructure question)

**Should NOT retrieve:**
6. "What is a JWT token?" (general knowledge)
7. "Can you explain that in simpler terms?" (follow-up, answer in context)
8. "What are the pros and cons of Postgres?" (general knowledge)
9. "Thanks, that makes sense." (not a question)
10. "You mentioned Docker - what is containerization?" (general knowledge)

For each test case:
1. Send the message to the agent
2. Record whether the agent called the search tool
3. Compare to your expected behaviour

**Verification:** The agent should correctly decide on at least 7 of 10 cases. Record
which cases it gets wrong and hypothesise why.

**Fallback:** If no API key is available, examine the tool definition and test cases
and write out your predictions for each case. Then answer: what changes to the system
prompt or tool description would improve the agent's decision accuracy?

<details>
<summary>Hints</summary>

- The system prompt matters enormously. Experiment with different instructions about
  when to search.
- Common failure: the agent searches for general questions because it is "trying to be
  thorough." Fix by adding negative examples to the system prompt.
- Common failure: the agent does not search for project-specific questions because it
  is "confident." This is the under-retrieval problem - the dumb zone.
- Log every decision with the query and whether retrieval was triggered. This log is
  your diagnostic tool.
- For sequential test cases (7 builds on prior context), send them in the same
  conversation to test context retention.

</details>

**Extension:** Add a confidence-based retrieval trigger. Before answering without
retrieval, have the agent assess its confidence. If confidence is below a threshold,
force retrieval. Test: does this reduce under-retrieval errors without increasing
over-retrieval?

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. Why does semantic search fail on exact identifiers, and what does BM25 add?
2. What is reciprocal rank fusion, and why does it use ranks instead of scores?
3. What is the computational difference between a bi-encoder and a cross-encoder?
4. Why is reranking a two-stage process instead of using the cross-encoder directly?
5. What are the two failure modes of agentic RAG (under-retrieval and over-retrieval),
   and which is more dangerous?
6. What class of questions does GraphRAG address that standard RAG cannot?
7. Why is GraphRAG's indexing expensive, and when is the cost justified?
8. How does code retrieval differ from document retrieval? Name three differences.
9. What is the freshness problem in index maintenance?
10. When should you NOT add an advanced retrieval pattern to your Step 3 pipeline?

The answer to question 10 is the most important takeaway from this step: when the Step 3
pipeline already meets your quality requirements. Every pattern here is a response to a
specific, measurable failure. If you cannot name the failure, do not add the pattern.

---

## Recommended Reading

- **"From Local to Global: A Graph RAG Approach to Query-Focused Summarization"** -
  Edge et al. (2024). The GraphRAG paper. Read Sections 1-3 for the motivation and
  approach; skip the appendices unless you plan to implement.
  https://arxiv.org/abs/2404.16130

- **"Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection"** -
  Asai et al. (2023). The adaptive retrieval paper. Read for the conceptual framework
  of reflection tokens, even if you will not fine-tune a model.
  https://arxiv.org/abs/2310.11511

- **"Passage Re-ranking with BERT"** - Nogueira and Cho (2019). The foundational
  cross-encoder reranking paper. Short and clear.
  https://arxiv.org/abs/1901.04085

- **"ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction"** -
  Santhanam et al. (2022). Late interaction as a middle ground between bi-encoders
  and cross-encoders.
  https://arxiv.org/abs/2112.01488

- **Introduction to Information Retrieval, Chapter 6** - Manning, Raghavan, Schutze
  (2008). BM25, TF-IDF, and the vector space model. Free online.
  https://nlp.stanford.edu/IR-book/

- **sentence-transformers documentation** - Cross-encoder usage, available models,
  training custom rerankers.
  https://www.sbert.net/

---

## What to Read Next

**Step 5: State Management for Agents** - How agents persist information across
interactions. State management connects directly to retrieval: an agent's state
determines what context it has without retrieval, and retrieval fills the gaps. The
index maintenance patterns from this step (incremental updates, versioning, freshness
monitoring) reappear in Step 5 as state persistence patterns.

**Step 7: Observability and Tracing** - How to monitor retrieval quality in production.
The metrics from Step 3 (precision, recall, MRR) become the monitoring targets. The
index health checks from Section 6 become production dashboards. If you add any pattern
from this step to a production system, Step 7 tells you how to know whether it is
working.

