+++
title = "Embeddings and Vector Search"
date = "2026-03-10"
description = "Dense vector representations, similarity metrics, vector databases, indexing strategies."
tags = ["embeddings", "vector", "search", "bootcamp"]
step = 2
tier = 1
estimate = "4-5 hours"
bootcamp = 5
+++

Step 2 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

Estimated total time: 4-5 hours.

**Field maturity:** Established
**Prerequisites:** Step 1 (the retrieval problem), Bootcamp I Step 5 (Python CLI)
**Leads to:** Step 3 (RAG pipeline engineering)
**You will need:** Python 3.10+, an OpenAI API key (or sentence-transformers for local
embeddings), numpy, chromadb. See Tool Setup below.

---

## Why This is Step 2

Step 1 established the problem: agents need external knowledge, and retrieval is the
mechanism for delivering it. You learned what retrieval quality means - precision, recall,
MRR, nDCG - and where naive RAG pipelines fail. This step provides the primary tool.

Embeddings are the machinery underneath semantic retrieval. When a RAG system finds
documents that are semantically related to a query (rather than just sharing keywords), it
does so by converting text into numbers - dense vectors in high-dimensional space - and
measuring geometric distance between them. The word "semantic" in "semantic search" is not
metaphor. It means the system has a learned representation of meaning, and it uses that
representation to find text whose meaning is close to what you asked for.

This is not magic, and the lack of magic is precisely why you need to understand it. An
embedding model is a function that maps text to a fixed-size vector. That function was
trained on specific data, with specific objectives, and it preserves specific similarity
relationships at the expense of others. When your semantic search returns irrelevant
results, the failure lives in this layer: the embedding model mapped your query and the
irrelevant document to nearby points in vector space because, according to its learned
representation, they are similar. Debugging this requires understanding what the model
captures and what it misses.

You cannot debug retrieval quality without understanding embeddings. You cannot choose
between vector databases without understanding what they store and how they search. You
cannot evaluate whether your indexing strategy is appropriate without understanding the
tradeoff between search speed and recall. Every decision in Steps 3 and 4 depends on the
concepts in this step.

There is a temptation, reinforced by framework documentation, to treat embeddings as a
black box: call an API, get a vector, store it, search it. This works until it does not.
When the agent returns wrong answers and the retrieval metrics from Step 1 show low
recall, the black box must open. This step opens it.

---

## Table of Contents

1. [What Embeddings Are](#1-what-embeddings-are) (~30 min)
2. [Embedding Models](#2-embedding-models) (~30 min)
3. [Similarity Metrics](#3-similarity-metrics) (~25 min)
4. [Vector Databases](#4-vector-databases) (~40 min)
5. [Choosing a Vector Store](#5-choosing-a-vector-store) (~20 min)
6. [Indexing Strategies](#6-indexing-strategies) (~30 min)
7. [Embedding Quality and Evaluation](#7-embedding-quality-and-evaluation) (~25 min)
8. [When Embeddings Are Overkill](#8-when-embeddings-are-overkill) (~15 min)
9. [Challenges](#challenges) (~60-90 min)
10. [Key Takeaways](#key-takeaways)
11. [Recommended Reading](#recommended-reading)
12. [What to Read Next](#what-to-read-next)

---

## Tool Setup

*This section covers installation and verification. Skip tools you already have.*

### Required

```bash
# Create a virtual environment for this step
uv venv .venv-bcv02
source .venv-bcv02/bin/activate

# Core dependencies
uv pip install numpy chromadb

# Verify numpy
python3 -c "import numpy; print(f'numpy {numpy.__version__}')"

# Verify chromadb
python3 -c "import chromadb; print(f'chromadb {chromadb.__version__}')"
```

### Embedding Provider (one required)

**Option A - OpenAI embeddings (recommended for exercises):**

```bash
uv pip install openai

# Set API key (add to ~/.bashrc for persistence)
export OPENAI_API_KEY="sk-..."

# Verify
python3 -c "
from openai import OpenAI
client = OpenAI()
r = client.embeddings.create(input='test', model='text-embedding-3-small')
printf_msg = f'Embedding dimension: {len(r.data[0].embedding)}'
print(printf_msg)
"
```

Expected output: `Embedding dimension: 1536`

**Option B - Local embeddings (no API key needed):**

```bash
# sentence-transformers (downloads model on first use, ~100MB)
uv pip install sentence-transformers

# Verify
python3 -c "
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
e = model.encode(['test'])
print(f'Embedding dimension: {e.shape[1]}')
"
```

Expected output: `Embedding dimension: 384`

Both options work for all exercises. The exercises show code for both. If you have an
OpenAI API key, Option A produces higher-quality embeddings with less local compute. If
you do not have one, Option B is fully functional and runs locally.

---

## 1. What Embeddings Are

*Estimated time: 30 minutes*

An embedding is a dense vector representation of text where semantic similarity corresponds
to geometric proximity. That sentence needs unpacking.

**Dense vector.** Unlike sparse representations (bag of words, TF-IDF) where most elements
are zero, every element of an embedding vector carries signal. A TF-IDF vector over a
100,000-word vocabulary has 100,000 dimensions, most of them zero. An embedding vector has
384 to 3,072 dimensions, none of them zero. The information is compressed and distributed
across all dimensions.

**Semantic similarity.** Two texts that mean similar things - even if they share no words -
produce vectors that are close together. "The cat sat on the mat" and "A feline rested on
the rug" use different words but express the same scene. Their embedding vectors are
nearby in vector space. "The cat sat on the mat" and "Investment portfolio rebalancing
strategies" use different words and mean different things. Their vectors are far apart.

**Geometric proximity.** "Close together" and "far apart" are literal. Embedding vectors
exist in a high-dimensional space where distance is measurable. The most common measure is
cosine similarity, which we cover in Section 3. For now, the intuition is: embedding
vectors are points in space, and semantic search is nearest-neighbor search in that space.

### How Embeddings Are Created

An embedding model is a neural network trained to produce vectors where semantically
similar inputs map to nearby points. The training process works roughly like this:

1. The model sees pairs of texts that are related (a question and its answer, a sentence
   and its paraphrase, a query and its relevant document).
2. It learns to produce vectors where related pairs are close and unrelated pairs are far.
3. After training, the model can produce vectors for text it has never seen before,
   and the geometric relationships hold.

The specific training objective varies by model. Some are trained with contrastive loss
(push similar pairs together, push dissimilar pairs apart). Some use a Siamese architecture
(twin networks processing each text independently). The details matter for model selection
but not for understanding what embeddings do.

### What Embeddings Preserve and What They Lose

The mapping from text to vector is lossy. A 384-dimensional vector cannot represent
everything about a 500-word paragraph. What is preserved and what is lost depends on the
model and its training data.

**Typically preserved:**
- Topic similarity ("machine learning" is near "neural networks")
- Semantic paraphrasing ("how to cook pasta" is near "pasta cooking instructions")
- Functional equivalence ("authentication failed" is near "login error")

**Typically lost or degraded:**
- Exact terminology (specific API names, product codes, version numbers)
- Negation ("the system is working" and "the system is not working" can be surprisingly
  close in embedding space because the surrounding tokens are identical)
- Temporal ordering ("A happened before B" vs "B happened before A")
- Quantitative relationships ("costs $5" vs "costs $5000" - the numbers are not the
  primary signal)

This is why embeddings are not a universal replacement for keyword search. A query for
error code `ERR_4829` may retrieve documents about error handling in general rather than
the specific error code, because the embedding model focuses on semantic meaning rather
than exact string matching. Step 4 (advanced retrieval patterns) addresses this through
hybrid search.

### Sparse vs Dense: A Concrete Comparison

```python
import numpy as np

# Sparse representation: bag of words
# Vocabulary: [cat, sat, mat, dog, ran, park, investment, portfolio]
doc1_sparse = np.array([1, 1, 1, 0, 0, 0, 0, 0])  # "the cat sat on the mat"
doc2_sparse = np.array([0, 0, 0, 1, 1, 1, 0, 0])  # "the dog ran in the park"

# Cosine similarity of sparse vectors: 0.0 (no shared words)
cos_sparse = np.dot(doc1_sparse, doc2_sparse) / (
  np.linalg.norm(doc1_sparse) * np.linalg.norm(doc2_sparse)
)
print(f"Sparse cosine similarity: {cos_sparse:.4f}")
# Output: 0.0000 - no overlap despite both being about animals + locations

# Dense representation: embeddings capture semantic similarity
# These are illustrative 4-dimensional vectors, not real embeddings
doc1_dense = np.array([0.82, 0.15, 0.91, 0.33])
doc2_dense = np.array([0.79, 0.18, 0.88, 0.35])

cos_dense = np.dot(doc1_dense, doc2_dense) / (
  np.linalg.norm(doc1_dense) * np.linalg.norm(doc2_dense)
)
print(f"Dense cosine similarity: {cos_dense:.4f}")
# Output: ~0.9989 - high similarity, both about animals in places
```

The sparse representation sees zero similarity because the sentences share no vocabulary.
The dense representation captures that both sentences describe an animal in a location.
This is the fundamental advantage of embeddings for retrieval: they find documents that
are about the same thing, not just documents that use the same words.

### The Dimensionality Question

Embedding models produce vectors of different sizes: 384, 768, 1024, 1536, 3072. Higher
dimensions mean more capacity to represent fine-grained semantic distinctions. Lower
dimensions mean faster search, less storage, and lower cost.

This is not a simple "more is better" tradeoff. For many practical tasks, a 384-dimensional
model (like all-MiniLM-L6-v2) captures enough semantic structure to produce good retrieval
results. The marginal improvement from 1536 or 3072 dimensions depends on how
fine-grained your similarity requirements are. Retrieving documents about "Python web
frameworks" does not require the same embedding resolution as distinguishing between
"Python Flask routing configuration" and "Python Django URL patterns."

OpenAI's text-embedding-3-large supports dimension reduction via the `dimensions`
parameter - you can request 256, 512, or 1024 dimensions instead of the full 3072. This
uses Matryoshka Representation Learning (MRL), where the model is trained so that the
first N dimensions of the vector are a valid embedding in their own right. At 256
dimensions, text-embedding-3-large still outperforms the older ada-002 at 1536 dimensions
on MTEB benchmarks.

> **AGENTIC GROUNDING:** When an agent's retrieval returns semantically wrong results -
> documents that are topically adjacent but not actually relevant - the failure is often
> in the embedding layer. The agent cannot diagnose this itself. It sees the retrieved
> text and generates from it. Debugging requires you to inspect the embedding
> similarities directly: what is the cosine similarity between the query and the
> returned documents vs the query and the documents that should have been returned? If
> the wrong documents have higher similarity scores, the embedding model is the
> bottleneck, not the retrieval infrastructure.

> **FIELD VS NOVEL:** Embedding representations are established (Mikolov et al. 2013 for
> Word2Vec, Reimers & Gurevych 2019 for Sentence-BERT, extensive documentation from
> OpenAI and Hugging Face). The novel connection here is to the project's context
> engineering vocabulary: an embedding model that loses negation or exact terminology
> creates a form of cold context pressure - the model receives retrieved context that
> looks relevant but misses the critical detail, pushing it toward pattern-matching from
> its parameters rather than reasoning from the evidence. The loss characteristics of
> the embedding model directly determine the failure modes of the retrieval system
> built on top of it.

---

## 2. Embedding Models

*Estimated time: 30 minutes*

The embedding model you choose determines everything downstream: what similarities your
search can find, how fast it runs, how much it costs, and whether your data leaves your
infrastructure. This section surveys the landscape as of March 2026.

### Commercial: OpenAI

OpenAI offers two current embedding models:

| Model | Dimensions | Max Input | Price | MTEB Score |
|-------|-----------|-----------|-------|------------|
| text-embedding-3-small | 1536 | 8,192 tokens | $0.02/1M tokens | 62.3% |
| text-embedding-3-large | 3072 | 8,192 tokens | $0.13/1M tokens | 64.6% |

Both models are L2-normalized, which means cosine similarity equals dot product (this
matters for indexing; see Section 6). Both support the `dimensions` parameter for
Matryoshka-style dimension reduction.

```python
from openai import OpenAI

client = OpenAI()

# Embed a single text
response = client.embeddings.create(
  input="The retrieval problem is about finding the right information.",
  model="text-embedding-3-small"
)
embedding = response.data[0].embedding
print(f"Dimensions: {len(embedding)}")
print(f"First 5 values: {embedding[:5]}")

# Embed with reduced dimensions
response_reduced = client.embeddings.create(
  input="The retrieval problem is about finding the right information.",
  model="text-embedding-3-large",
  dimensions=256  # Matryoshka: first 256 dims are a valid embedding
)
embedding_reduced = response_reduced.data[0].embedding
print(f"Reduced dimensions: {len(embedding_reduced)}")
```

**When to use OpenAI embeddings:** When you need high quality with minimal infrastructure.
The API handles model loading, GPU allocation, and scaling. You pay per token and your
data traverses OpenAI's servers.

**When not to:** When data privacy requirements prohibit sending text to external APIs.
When you embed large volumes where cost adds up. When you need offline operation.

### Commercial: Other Providers

**Cohere** offers embed-v3 models optimized for different use cases (search, classification,
clustering). They provide an embed endpoint and a separate reranking endpoint.

**Anthropic does not offer an embedding API.** As of March 2026, Anthropic provides
language models (Claude) but no dedicated embedding endpoint. If you are building on
Claude for generation, you need a separate embedding provider. This is worth knowing
because it means your RAG system will always involve at least two providers: one for
embeddings (OpenAI, Cohere, or open-source) and one for generation (Anthropic).

### Open-Source: sentence-transformers

The sentence-transformers library (Reimers & Gurevych 2019) is the dominant open-source
framework for text embeddings. Originally built for Sentence-BERT, it has expanded to
support over 15,000 pre-trained models on the Hugging Face Hub, plus cross-encoders for
reranking and sparse encoders for SPLADE-style retrieval.

```python
from sentence_transformers import SentenceTransformer

# Load a model (downloads on first use)
model = SentenceTransformer("all-MiniLM-L6-v2")

# Embed texts
texts = [
  "The retrieval problem is about finding the right information.",
  "Semantic search uses embeddings to find similar documents.",
  "Investment portfolio rebalancing strategies for 2026.",
]
embeddings = model.encode(texts)

print(f"Shape: {embeddings.shape}")  # (3, 384)
print(f"Type: {type(embeddings)}")   # numpy.ndarray
```

Key models to know:

| Model | Dimensions | Speed | Quality | Size |
|-------|-----------|-------|---------|------|
| all-MiniLM-L6-v2 | 384 | Fast | Good | ~80MB |
| all-mpnet-base-v2 | 768 | Medium | Better | ~420MB |
| BGE-large-en-v1.5 | 1024 | Slower | High | ~1.3GB |
| E5-large-v2 | 1024 | Slower | High | ~1.3GB |

**When to use sentence-transformers:** When you need local inference (privacy, offline,
cost control). When you want to fine-tune on your domain. When you need to experiment
with multiple models without per-token cost.

**When not to:** When you need maximum quality and cost is not a constraint. When you
lack GPU infrastructure for production serving of larger models.

### The MTEB Leaderboard

The Massive Text Embedding Benchmark (MTEB) at
`https://huggingface.co/spaces/mteb/leaderboard` is the standard benchmark for comparing
embedding models. It covers retrieval, classification, clustering, pair classification,
reranking, semantic textual similarity, and summarization.

MTEB is useful for initial model selection. It is not sufficient for final model
selection. Benchmark performance does not always correlate with performance on your
specific data. A model that ranks #1 on MTEB's retrieval benchmark may underperform on
your domain because your documents use specialized terminology, your queries have
particular patterns, or your notion of "relevant" differs from the benchmark's labels.

The correct workflow: use MTEB to narrow to 2-3 candidate models, then evaluate on your
own data with your own relevance judgments. Section 7 covers evaluation methods.

### Dimension Tradeoffs

The choice of embedding dimension is a three-way tradeoff:

```
Quality <------------> Speed <------------> Cost
(higher dims)           (lower dims)         (lower dims)
```

Concrete numbers for 1 million documents:

| Dimension | Storage (float32) | Approximate HNSW Memory | Relative Search Time |
|-----------|------------------|------------------------|---------------------|
| 384 | ~1.5 GB | ~2 GB | 1x |
| 768 | ~3 GB | ~4 GB | ~1.5x |
| 1536 | ~6 GB | ~8 GB | ~2.5x |
| 3072 | ~12 GB | ~16 GB | ~4x |

For development and prototyping, 384 dimensions (all-MiniLM-L6-v2) is sufficient. For
production with quality requirements, evaluate 768-1536 dimensions on your data before
committing. Going to 3072 dimensions is rarely justified unless your retrieval task
requires extremely fine-grained semantic distinctions.

> **AGENTIC GROUNDING:** Model selection for embeddings is a deployment decision that
> agents cannot make for themselves. An agent using a RAG tool sees only the retrieved
> text, not the embedding quality that produced the retrieval. When you observe an agent
> struggling with retrieval - low precision, missing relevant documents - the embedding
> model is one of the first things to evaluate. Swapping from a small model to a larger
> one can produce measurable improvements in retrieval metrics without changing any
> other part of the system.

---

## 3. Similarity Metrics

*Estimated time: 25 minutes*

Once text is converted to vectors, "finding similar documents" becomes "finding nearby
vectors." How you define "nearby" matters. Three distance metrics are used in practice.

### Cosine Similarity

Cosine similarity measures the angle between two vectors, ignoring their magnitudes. It is
the most common metric for text embeddings.

```python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
  """Compute cosine similarity between two vectors."""
  dot = np.dot(a, b)
  norm_a = np.linalg.norm(a)
  norm_b = np.linalg.norm(b)
  if norm_a == 0 or norm_b == 0:
    return 0.0
  return dot / (norm_a * norm_b)

# Example
v1 = np.array([0.1, 0.3, 0.5, 0.7])
v2 = np.array([0.2, 0.4, 0.5, 0.6])
v3 = np.array([-0.5, 0.1, -0.8, 0.2])

print(f"sim(v1, v2) = {cosine_similarity(v1, v2):.4f}")  # High: similar direction
print(f"sim(v1, v3) = {cosine_similarity(v1, v3):.4f}")  # Low: different direction
```

Mathematically:

```
cosine_similarity(A, B) = (A . B) / (||A|| * ||B||)
```

The result ranges from -1 (opposite direction) to +1 (same direction), with 0 meaning
orthogonal (no similarity). In practice, text embeddings rarely produce negative cosine
similarities - most pairs fall between 0.0 and 1.0.

**Why cosine dominates for text:** Text embeddings can have different magnitudes depending
on the length or specificity of the input. Cosine similarity removes magnitude from the
comparison, focusing entirely on direction. Two documents about the same topic but with
different lengths will have similar directions even if their vector magnitudes differ.

### Dot Product (Inner Product)

```python
def dot_product(a: np.ndarray, b: np.ndarray) -> float:
  """Compute dot product between two vectors."""
  return float(np.dot(a, b))
```

Mathematically:

```
dot_product(A, B) = A . B = sum(A_i * B_i)
```

Dot product equals cosine similarity multiplied by both magnitudes:
`dot(A, B) = cos(A, B) * ||A|| * ||B||`. If vectors are L2-normalized (magnitude = 1),
dot product and cosine similarity are identical.

OpenAI embeddings are L2-normalized. This means you can use either metric and get the
same ranking. This is a practical advantage because dot product is cheaper to compute
(no normalization step). Most vector databases exploit this by offering dot product as a
faster alternative when they know the vectors are normalized.

**When dot product differs from cosine:** When vectors are not normalized and you want
magnitude to matter. For example, if longer documents produce larger vectors and you want
longer, more detailed documents to rank higher for the same topical relevance, dot product
captures that. In practice this is rare for text retrieval.

### Euclidean Distance (L2 Distance)

Euclidean distance measures straight-line distance between two points:
`euclidean(A, B) = sqrt(sum((A_i - B_i)^2))`. Lower distance means more similar. For
normalized vectors, minimizing Euclidean distance is equivalent to maximizing cosine
similarity - the ranking is identical.

Some indexing algorithms (particularly HNSW) use Euclidean distance internally because it
satisfies the triangle inequality. Externally, for text retrieval, you almost always want
cosine similarity or dot product.

### Which Metric to Use

| Situation | Metric | Reason |
|-----------|--------|--------|
| Text embeddings (general) | Cosine similarity | Magnitude-invariant, standard |
| Normalized embeddings | Dot product | Equivalent to cosine, faster |
| Specific need for magnitude | Dot product | Preserves magnitude information |
| Index algorithms (internal) | Euclidean | Triangle inequality for graph search |

For the exercises in this step, use cosine similarity. If your embeddings come from
OpenAI, dot product gives identical results faster.

### Computing Similarity at Scale

Computing cosine similarity between one query and N documents is a matrix operation:

```python
import numpy as np

def search_brute_force(
  query_embedding: np.ndarray,
  document_embeddings: np.ndarray,
  top_k: int = 5,
) -> list[tuple[int, float]]:
  """Brute-force nearest neighbor search using cosine similarity.

  Args:
    query_embedding: shape (D,)
    document_embeddings: shape (N, D)
    top_k: number of results to return

  Returns:
    List of (document_index, similarity_score) tuples, highest first.
  """
  # Normalize
  query_norm = query_embedding / np.linalg.norm(query_embedding)
  doc_norms = document_embeddings / np.linalg.norm(
    document_embeddings, axis=1, keepdims=True
  )

  # Cosine similarities via matrix multiplication
  similarities = doc_norms @ query_norm  # shape (N,)

  # Top-k indices
  top_indices = np.argsort(similarities)[::-1][:top_k]
  return [(int(idx), float(similarities[idx])) for idx in top_indices]


# Example: 1000 documents, 384 dimensions
np.random.seed(42)
docs = np.random.randn(1000, 384).astype(np.float32)
query = np.random.randn(384).astype(np.float32)

results = search_brute_force(query, docs, top_k=5)
for idx, score in results:
  print(f"  Doc {idx}: {score:.4f}")
```

This brute-force approach works for small datasets (under ~50,000 documents) and is
competitive with indexed search up to that point. Beyond that, you need approximate
nearest neighbor (ANN) search, which is what vector databases provide. Section 6 covers
the indexing algorithms that make ANN search possible.

> **AGENTIC GROUNDING:** The brute-force search above is what many tutorial RAG systems
> actually use under the hood. If you are prototyping with fewer than 10,000 documents,
> numpy cosine similarity is faster to set up and easier to debug than a vector database.
> The "do I need a vector database?" question has a concrete answer: when brute-force
> search latency exceeds your requirements or your dataset exceeds available memory. For
> an agent running over a codebase of 500 files, numpy is probably sufficient. For an
> agent over a million customer support tickets, it is not.

> **FIELD VS NOVEL:** Similarity metrics for vector search are textbook material (Manning
> et al. 2008, Chapter 6). The novel application is understanding how metric choice
> interacts with agentic retrieval failure modes. When an agent's search returns documents
> that are topically related but not specifically relevant, the issue is often not the
> metric but the embedding model's granularity. Cosine similarity faithfully reports what
> the embedding model encoded - if the model does not distinguish between "Flask routing"
> and "Django URL patterns," no metric change will fix the retrieval.

---

## 4. Vector Databases

*Estimated time: 40 minutes*

A vector database is purpose-built storage for embedding vectors with approximate nearest
neighbor (ANN) search. The core operation: given a query vector, find the K most similar
vectors in the database. This is the operation that powers semantic search, and doing it
efficiently at scale is an engineering problem that justifies dedicated infrastructure.

The landscape has exploded since 2022. There are now dozens of options. Six matter for
practitioners.

### pgvector

**What it is:** An open-source extension for PostgreSQL that adds vector data types and
similarity search operators. Not a separate database - it runs inside your existing
Postgres instance.

**GitHub:** 20.2k stars, v0.8.2, actively maintained.

```sql
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table with a vector column
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(384)  -- 384-dimensional vector
);

-- Insert a document with its embedding
INSERT INTO documents (content, embedding)
VALUES ('The retrieval problem...', '[0.1, 0.2, ...]');

-- Find the 5 most similar documents
SELECT id, content, embedding <=> '[0.3, 0.1, ...]' AS distance
FROM documents
ORDER BY embedding <=> '[0.3, 0.1, ...]'
LIMIT 5;
```

The `<=>` operator computes cosine distance (1 - cosine similarity). pgvector also
supports `<->` for Euclidean distance and `<#>` for negative inner product.

**Key advantage:** Vectors live alongside your relational data. You can JOIN embeddings
with user tables, filter by metadata using standard SQL WHERE clauses, and wrap everything
in transactions. If you already run Postgres, pgvector adds vector search without a new
service in your stack.

**v0.8+ improvement:** Iterative index scans. When filtering reduces the candidate set
(e.g., `WHERE category = 'support'`), pgvector now automatically scans more of the index
to maintain result quality. This addressed a major complaint: filtered vector search
previously returned poor results because the index did not account for filters.

**Supports:** HNSW and IVFFlat indexes, L2/inner product/cosine/L1/Hamming/Jaccard
distances, vectors up to 16,000 dimensions, half-precision and binary vectors, sparse
vectors.

**When to use it:** You already have Postgres. Your dataset is under ~10 million vectors.
You need relational queries alongside vector search. You value operational simplicity
(one database, not two).

**When not to:** You need maximum vector search throughput on billions of vectors. You do
not use Postgres. You need features like built-in automatic embedding (some vector
databases can call embedding APIs for you).

### Chroma

**What it is:** An open-source, Python-native vector database designed for simplicity.
The core API is four functions: create collection, add, query, get.

**GitHub:** 26.5k stars, v1.5.5, substantially rewritten in Rust for performance.

```python
import chromadb

# Create a client (in-memory by default)
client = chromadb.Client()

# Create a collection
collection = client.create_collection(
  name="documents",
  metadata={"hnsw:space": "cosine"},  # Use cosine distance
)

# Add documents with embeddings
collection.add(
  ids=["doc1", "doc2", "doc3"],
  documents=[
    "The retrieval problem is about finding the right information.",
    "Embeddings convert text to dense vector representations.",
    "Investment portfolio rebalancing strategies for 2026.",
  ],
  embeddings=[
    [0.1, 0.2, 0.3],  # In practice, use real embeddings
    [0.4, 0.5, 0.6],
    [0.7, 0.8, 0.9],
  ],
)

# Query
results = collection.query(
  query_embeddings=[[0.1, 0.25, 0.35]],
  n_results=2,
)
print(results["ids"])        # [['doc1', 'doc2']]
print(results["distances"])  # [[0.001, 0.15]]
```

Chroma also has a built-in embedding function: if you add `documents` without
`embeddings`, Chroma will call a default embedding model (sentence-transformers) to
compute them. This is convenient for prototyping but obscures what is happening. For
learning, always provide your own embeddings so you understand the pipeline.

**When to use it:** Prototyping. Small to medium datasets. Quick experiments where setup
time matters more than scale. The API is the simplest of any vector database.

**When not to:** Large-scale production deployments. Complex metadata filtering
requirements. Chroma does not natively support BM25/hybrid search as of current version.

### FAISS

**What it is:** Facebook AI Similarity Search. A C++ library with Python bindings for
efficient similarity search. Not a database - a library. There is no server, no
persistence by default, no CRUD operations. It is an in-memory index.

**GitHub:** 39.3k stars, v1.14.1, maintained by Meta.

```python
import numpy as np
import faiss

# Create an index for 384-dimensional vectors
dimension = 384
index = faiss.IndexFlatL2(dimension)  # Exact search, L2 distance

# Add vectors
vectors = np.random.randn(10000, dimension).astype(np.float32)
index.add(vectors)
print(f"Indexed {index.ntotal} vectors")

# Search
query = np.random.randn(1, dimension).astype(np.float32)
distances, indices = index.search(query, k=5)
print(f"Nearest neighbors: {indices[0]}")
print(f"Distances: {distances[0]}")
```

FAISS implements many index types: flat (exact), IVF, HNSW, PQ (product quantization),
and combinations. It supports GPU acceleration via CUDA and AMD ROCm. For very large
scale (billions of vectors), FAISS on GPU is often the fastest option.

**When to use it:** When you need maximum control over indexing algorithms. When you are
building a custom search system and need a high-performance building block. When you need
GPU-accelerated search. Many higher-level tools (LangChain, LlamaIndex) use FAISS as a
backend.

**When not to:** When you need persistence, filtering, or CRUD operations out of the box.
When you want a server with an API rather than an in-process library.

### Pinecone

**What it is:** A fully managed vector database. Serverless or pod-based, no
infrastructure to manage. Supports metadata filtering, namespaces, hybrid search.

**When to use it:** Zero operational overhead needed. Scale without managing infrastructure.

**When not to:** Self-hosting required. Vendor lock-in is a concern. Cost at scale
matters (managed services are always more expensive per query).

### Qdrant

**What it is:** An open-source vector database written in Rust. 29.5k GitHub stars,
v1.17.0.

**Key differentiators:** Rich JSON payload filtering, built-in vector quantization
(scalar, product, binary) for memory efficiency, native sparse vector support for hybrid
search, distributed deployment with sharding and replication. gRPC and REST APIs.

**When to use it:** Production, self-hosted, with more vector-specific features than
pgvector. Rich metadata filtering alongside vector search. Hybrid search needed.

**When not to:** pgvector suffices and you already run Postgres. Want managed simplicity
(use Pinecone instead).

### Weaviate

**What it is:** An open-source vector database written in Go, with native hybrid search
combining BM25 and vector search. GraphQL-based API. Built-in vectorization modules that
call embedding APIs automatically. Multi-tenancy, RBAC, managed cloud available.

**When to use it:** Hybrid search (keyword + semantic) as a first-class requirement. Want
the database to handle embedding generation.

**When not to:** GraphQL is friction. Need simplest API (Chroma). Need maximum vector
throughput (Qdrant is generally faster for pure vector operations).

### The "Do I Even Need a Vector Database?" Question

For small datasets, the answer is no. Consider the brute-force numpy search from
Section 3:

```python
import numpy as np
import time

# Simulate 10,000 documents with 384-dim embeddings
docs = np.random.randn(10000, 384).astype(np.float32)
query = np.random.randn(384).astype(np.float32)

# Normalize for cosine similarity
docs_normed = docs / np.linalg.norm(docs, axis=1, keepdims=True)
query_normed = query / np.linalg.norm(query)

start = time.perf_counter()
similarities = docs_normed @ query_normed
top_5 = np.argsort(similarities)[::-1][:5]
elapsed = time.perf_counter() - start

print(f"Search over 10,000 docs: {elapsed*1000:.2f}ms")
# Typically: 0.5-2ms on modern hardware
```

Two milliseconds for an exact search over 10,000 documents. No database needed. No
index needed. No additional service to run.

The threshold where a vector database becomes necessary depends on:
- **Dataset size:** Below ~50,000 documents, numpy is competitive. Above 100,000,
  indexed search has measurable latency advantages.
- **Update frequency:** If you add documents frequently, a database handles incremental
  updates. Numpy requires rebuilding the full array.
- **Filtering requirements:** If you need to filter by metadata before or during search
  (e.g., "search only documents from the last week"), a database provides this natively.
  With numpy, you filter after search or maintain separate indexes.
- **Persistence:** If you need to store embeddings between restarts, a database provides
  persistence. Numpy arrays need manual serialization.
- **Concurrency:** If multiple processes query simultaneously, a database handles this.
  Numpy in a single process does not.

For the exercises in this step, we use both numpy (to understand the mechanics) and Chroma
(to understand the database abstraction). Choose based on your dataset and requirements
in production.

> **AGENTIC GROUNDING:** An agent's retrieval tool is, from the agent's perspective,
> opaque. The agent calls "search" and gets results. Whether those results come from
> numpy brute force, pgvector, or Pinecone does not affect the agent's behavior. The
> choice of vector store is an infrastructure decision that affects latency, cost, and
> operational complexity - not retrieval quality. Retrieval quality is determined by the
> embedding model and the indexing strategy. Choose your vector store based on your
> infrastructure constraints, not on the belief that a fancier database will make your
> retrieval better.

> **FIELD VS NOVEL:** Vector database surveys and comparison guides are abundant (each
> vendor publishes benchmarks, and third-party comparisons exist). The novel framing here
> is the "do I even need one?" question applied to agent systems. Many agentic coding
> tools (Cursor, Claude Code) perform retrieval over codebases using file-level search
> and grep - not embeddings, not vector databases. The triangulate script in this project
> (bin/triangulate) matches findings across reviews using SequenceMatcher string
> similarity, not embeddings. The right abstraction level depends on the task, and vector
> databases are one option in a spectrum, not the default.

---

## 5. Choosing a Vector Store

*Estimated time: 20 minutes*

The vector database landscape invites analysis paralysis. Here is a decision framework
based on four factors: dataset size, existing infrastructure, latency requirements, and
operational complexity tolerance.

### Decision Matrix

| Factor | numpy | Chroma | pgvector | Qdrant | Pinecone |
|--------|-------|--------|----------|--------|----------|
| Max practical scale | ~50K docs | ~1M docs | ~10M docs | ~100M+ docs | ~100M+ docs |
| Setup complexity | None | Low | Medium | Medium | Low |
| Ops complexity | None | Low | Medium (Postgres) | Medium-High | None (managed) |
| Persistence | Manual | Built-in | Built-in | Built-in | Built-in |
| Metadata filtering | Manual | Basic | Full SQL | Rich JSON | Good |
| Hybrid search | No | No | Via FTS | Native sparse | Yes |
| Cost model | Free | Free/Paid cloud | Free | Free/Paid cloud | Paid |
| Best for | Prototyping | Dev/small prod | Postgres shops | Feature-rich prod | Zero-ops prod |

### The Decision Flow

```
Q: Do you have fewer than 50,000 documents?
├── Yes: Start with numpy. Move to a database when you hit a wall.
└── No:
    Q: Do you already run Postgres?
    ├── Yes: Use pgvector. Vectors alongside relational data.
    └── No:
        Q: Do you need zero operational overhead?
        ├── Yes: Pinecone (managed). You pay for convenience.
        └── No:
            Q: Do you need hybrid search or rich filtering?
            ├── Yes: Qdrant (self-hosted) or Weaviate (hybrid-first).
            └── No: Chroma for simplicity, Qdrant for scale.
```

### Development vs Production

A common and effective pattern: develop against Chroma or numpy, deploy to pgvector or
Qdrant. The embedding and search logic is the same. Only the storage and indexing change.

This works because the core abstraction is simple: store vectors, query vectors, get
results. The interface differences between databases are cosmetic compared to the shared
underlying operation. Your embedding code, your chunking logic, your reranking pipeline -
none of these change when you swap vector stores.

What does change: persistence configuration, index tuning, scaling, monitoring, and
backup. These are operational concerns, not retrieval concerns. The core abstraction -
`store(ids, embeddings)` and `search(query_embedding, top_k)` - is the same regardless
of backend. Design your retrieval code against that interface, and the vector store
becomes swappable.

> **AGENTIC GROUNDING:** The agent's retrieval tool wraps a vector store. From the
> agent's perspective, the tool is "search(query) -> documents." The infrastructure
> behind that tool is invisible to the agent and should be. When you observe that an
> agent's retrieval is too slow (latency affecting response time), that is a vector
> store problem. When you observe that retrieval returns wrong documents, that is an
> embedding or chunking problem. Conflating the two leads to wasted engineering effort -
> migrating from Chroma to Qdrant will not fix bad embeddings.

---

## 6. Indexing Strategies

*Estimated time: 30 minutes*

Brute-force search compares the query vector against every document vector. It is exact
but O(N) per query. At 10 million documents, this takes hundreds of milliseconds. At 100
million, seconds. Approximate nearest neighbor (ANN) algorithms trade a small amount of
recall for dramatically faster search. Understanding the tradeoffs is necessary to tune
your vector database.

Three indexing strategies dominate. All three are implemented across the major vector
databases.

### HNSW (Hierarchical Navigable Small World)

HNSW is the most widely used ANN index. It constructs a multi-layered graph where each
vector is a node connected to its approximate nearest neighbors. Search starts at the top
layer (sparse, long-range connections) and descends to lower layers (dense, short-range
connections), greedily following the nearest neighbor at each step.

**Mental model:** Think of it like navigating a city. The top layers are highways - few
exits, but they cover large distances quickly. The bottom layers are residential streets -
many intersections, fine-grained navigation. You take the highway to get near your
destination, then switch to local streets.

**Key parameters:**

| Parameter | What it controls | Typical default | Tradeoff |
|-----------|-----------------|-----------------|----------|
| M | Connections per node | 16 | Higher = better recall, more memory |
| ef_construction | Build-time candidate list | 64-200 | Higher = better index quality, slower build |
| ef_search | Query-time candidate list | 50-200 | Higher = better recall, slower search |

**Operational characteristics:**
- Build time: O(N log N). Building an HNSW index over 1 million 384-dim vectors takes
  minutes, not hours.
- Query time: O(log N). Sub-millisecond for million-scale datasets.
- Memory: Significant. The graph structure itself requires memory proportional to N * M.
  For 1 million vectors with M=16, the graph edges alone consume ~60MB on top of the
  vector storage.
- Incremental updates: Supported. You can add vectors to an existing HNSW index without
  rebuilding.

**When to tune:** Start with defaults. If recall is below your threshold (measured using
the methods from Section 7), increase ef_search first (no rebuild required). If that is
insufficient, increase M and ef_construction and rebuild the index.

In pgvector:

```sql
-- Create an HNSW index
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Tune search-time recall (per session or per query)
SET hnsw.ef_search = 100;
```

### IVF (Inverted File Index)

IVF partitions the vector space into clusters using k-means. At query time, it searches
only the nearest clusters rather than the entire dataset. The name "inverted file" comes
from information retrieval terminology: each cluster center has an inverted list of the
vectors assigned to it.

**Mental model:** Instead of searching the entire library, IVF first identifies which
section of the library your book is most likely in, then searches only that section.

**Key parameters:**

| Parameter | What it controls | Typical default | Tradeoff |
|-----------|-----------------|-----------------|----------|
| nlist | Number of clusters | sqrt(N) | More clusters = finer partitioning, slower build |
| nprobe | Clusters searched per query | 1-10% of nlist | More probes = better recall, slower search |

**Operational characteristics:**
- Build time: O(N * nlist * iterations). Slower than HNSW for large datasets because of
  the k-means clustering step.
- Query time: O(N/nlist * nprobe). Scales with nprobe.
- Memory: Lower than HNSW. No graph edges to store. Just the cluster centers and vector
  assignments.
- Incremental updates: Possible but degrades quality. Adding many vectors without
  rebuilding causes clusters to become unbalanced.

**When to use IVF instead of HNSW:** When memory is the binding constraint. HNSW's graph
structure consumes significant memory. IVF's overhead is proportional to nlist (number of
clusters), which is much smaller. For very large datasets on memory-constrained hardware,
IVF may be the only option.

In pgvector:

```sql
-- Create an IVFFlat index
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Tune search-time recall
SET ivfflat.probes = 10;
```

### PQ (Product Quantization)

Product quantization compresses vectors by dividing them into sub-vectors and quantizing
each sub-vector independently. Instead of storing the full float32 vector (e.g., 384 * 4
= 1,536 bytes), PQ stores a code for each sub-vector (e.g., 48 bytes for 48 sub-vectors
with 256 centroids each).

**What this buys you:** Storage compression of 10-30x. A dataset that requires 6 GB with
full vectors might require 300 MB with PQ.

**What this costs you:** Accuracy. The quantized distances are approximations. Recall
drops compared to exact search or HNSW on full vectors.

**When to use PQ:** Large datasets where memory is the primary constraint. PQ is often
combined with IVF (IVF-PQ) or HNSW: the index structure provides fast candidate selection,
and PQ compresses the candidate vectors.

In practice, PQ is a tuning option within vector databases, not a choice you make
directly. Qdrant offers built-in scalar, product, and binary quantization. FAISS exposes
PQ as a composable index component. pgvector supports half-precision vectors (a simpler
form of compression).

### Choosing an Indexing Strategy

| Scenario | Recommended Index | Reason |
|----------|------------------|--------|
| <100K documents | Flat (brute-force) | Fast enough without approximation |
| 100K-10M documents | HNSW | Best recall/speed tradeoff at this scale |
| 10M+ documents, memory available | HNSW | Still the best if memory permits |
| 10M+ documents, memory constrained | IVF-PQ or HNSW with PQ | Compression necessary |
| Rapid prototyping | Flat | No build time, exact results |

**The default recommendation:** Use HNSW with default parameters. Tune only when you have
measured a recall problem using the evaluation methods in Section 7. Do not pre-optimize
indexing. Most retrieval quality issues are in the embedding model or chunking strategy,
not the index.

> **AGENTIC GROUNDING:** Indexing strategies affect latency and recall but are invisible
> to the agent. An agent does not know or care whether its retrieval tool uses HNSW or
> IVF. The operational impact is felt by the system as a whole: a poorly tuned index
> increases latency (the agent takes longer to respond) or reduces recall (the agent
> misses relevant documents). Both manifest as degraded agent performance but require
> different fixes. Increasing ef_search costs latency. Switching from IVF to HNSW costs
> memory. The tradeoff is always between recall, speed, and resource consumption.

> **FIELD VS NOVEL:** HNSW (Malkov & Yashunin 2018), IVF (Jegou et al. 2011), and PQ
> (Jegou et al. 2011) are well-established algorithms with extensive documentation.
> pgvector, FAISS, and Qdrant all provide practical guides. The novel framing here is
> the operational hierarchy: most retrieval failures are not indexing failures. When
> agent performance degrades, the diagnostic sequence should be: (1) check the embedding
> model, (2) check chunking, (3) check the query, (4) then check the index. Starting
> with index tuning is a common mistake that wastes engineering time on the wrong layer.

---

## 7. Embedding Quality and Evaluation

*Estimated time: 25 minutes*

How do you know whether your embeddings are good enough? This is an instance of the
general evaluation problem from **Bootcamp IV Steps 1-4 (evaluation methodology)**: you
need a definition of "good," a way to measure it, and a dataset to measure against.

### The Embedding Evaluation Problem

Evaluating embeddings means evaluating the similarities they produce. Two questions:

1. **Do similar texts get high similarity scores?** (Do embeddings cluster correctly?)
2. **Does retrieval using these embeddings find the right documents?** (Do embeddings
   serve the downstream task?)

Question 1 is an intrinsic evaluation of the embedding model. Question 2 is an extrinsic
evaluation of the embedding model within a retrieval system. For production RAG systems,
question 2 is what matters. Good embeddings that do not improve retrieval are not useful.

### MTEB: The Standard Benchmark

The Massive Text Embedding Benchmark (MTEB) evaluates embedding models across seven task
categories. For retrieval, it measures nDCG@10 (normalized discounted cumulative gain at
10 results) across multiple retrieval datasets.

MTEB is the starting point for model selection, not the endpoint. A model's MTEB score
tells you how it performs on the benchmark's datasets. Your data is different. Your
queries are different. Your definition of relevance is different.

**Using MTEB correctly:**
1. Check the leaderboard at `https://huggingface.co/spaces/mteb/leaderboard`
2. Filter by the task type that matters to you (retrieval for RAG)
3. Select 2-3 candidate models based on the quality/size/cost tradeoff
4. Evaluate those candidates on your own data

### Building an Evaluation Set

To evaluate embeddings on your own data, you need a set of (query, relevant_document)
pairs. These can come from:

- **Manual labeling:** Write 50-100 queries and identify which documents are relevant.
  Time-consuming but highest quality.
- **Existing user queries:** If you have search logs, extract queries and the documents
  users actually clicked on or used.
- **Synthetic generation:** Use an LLM to generate questions from your documents.
  Fast but may not reflect real user patterns.

The evaluation then uses the retrieval metrics from Step 1: precision@K, recall@K, MRR,
and nDCG. You embed your documents, search with your evaluation queries, and measure how
often the relevant documents appear in the top K results.

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# Load model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Your evaluation data
eval_queries = [
  "How do I fix a stale reference in agent configuration?",
  "What is the quality gate?",
  "When should I use a polecat for agent execution?",
]

# Relevant document IDs for each query (ground truth)
relevant_docs = {
  0: {"doc_7", "doc_12"},
  1: {"doc_3"},
  2: {"doc_15", "doc_16", "doc_22"},
}

# Your document corpus
documents = {
  "doc_3": "The gate is the quality control...",
  "doc_7": "Stale reference propagation occurs when...",
  # ... more documents
}

# Embed everything
doc_ids = list(documents.keys())
doc_texts = list(documents.values())
doc_embeddings = model.encode(doc_texts)
query_embeddings = model.encode(eval_queries)

# Compute retrieval metrics
def precision_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
  """Precision@K: fraction of top-K results that are relevant."""
  retrieved_at_k = retrieved_ids[:k]
  relevant_count = sum(1 for doc_id in retrieved_at_k if doc_id in relevant_ids)
  return relevant_count / k

def recall_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
  """Recall@K: fraction of relevant documents found in top-K."""
  if not relevant_ids:
    return 0.0
  retrieved_at_k = set(retrieved_ids[:k])
  found = len(retrieved_at_k & relevant_ids)
  return found / len(relevant_ids)

def mrr(retrieved_ids: list[str], relevant_ids: set[str]) -> float:
  """Mean Reciprocal Rank: 1/rank of first relevant result."""
  for rank, doc_id in enumerate(retrieved_ids, 1):
    if doc_id in relevant_ids:
      return 1.0 / rank
  return 0.0

# Search and evaluate
k = 5
for qi, query_emb in enumerate(query_embeddings):
  # Cosine similarities
  sims = doc_embeddings @ query_emb / (
    np.linalg.norm(doc_embeddings, axis=1) * np.linalg.norm(query_emb)
  )
  top_indices = np.argsort(sims)[::-1][:k]
  retrieved = [doc_ids[i] for i in top_indices]

  p_at_k = precision_at_k(retrieved, relevant_docs[qi], k)
  r_at_k = recall_at_k(retrieved, relevant_docs[qi], k)
  query_mrr = mrr(retrieved, relevant_docs[qi])
  print(f"Query {qi}: P@{k}={p_at_k:.2f}  R@{k}={r_at_k:.2f}  MRR={query_mrr:.2f}")
```

### Comparing Models

When choosing between embedding models, run the same evaluation with each model and
compare the metrics. The comparison should control for everything except the embedding
model: same documents, same queries, same relevance labels, same search method (brute-
force to remove indexing effects).

```python
from sentence_transformers import SentenceTransformer
import numpy as np

models_to_compare = [
  "all-MiniLM-L6-v2",      # 384 dims, fast
  "all-mpnet-base-v2",      # 768 dims, higher quality
]

for model_name in models_to_compare:
  model = SentenceTransformer(model_name)
  doc_embs = model.encode(doc_texts)
  query_embs = model.encode(eval_queries)

  # Compute mean MRR across all evaluation queries
  mrr_scores = []
  for qi, query_emb in enumerate(query_embs):
    sims = doc_embs @ query_emb / (
      np.linalg.norm(doc_embs, axis=1) * np.linalg.norm(query_emb)
    )
    top_indices = np.argsort(sims)[::-1]
    retrieved = [doc_ids[i] for i in top_indices]
    mrr_scores.append(mrr(retrieved, relevant_docs[qi]))

  mean_mrr = np.mean(mrr_scores)
  print(f"{model_name:30s}  dim={doc_embs.shape[1]:4d}  mean_MRR={mean_mrr:.4f}")
```

The model with the higher mean MRR on your data is the better choice, regardless of its
MTEB ranking. If all-MiniLM-L6-v2 (MTEB rank ~50) outperforms a top-10 model on your
domain, use all-MiniLM-L6-v2.

### Similarity Distribution Analysis

A useful diagnostic: compute the mean cosine similarity for relevant vs irrelevant pairs
using your evaluation set. If the distributions overlap heavily, the embedding model
cannot distinguish relevant from irrelevant for your data. A separation of 0.1 or more
between mean relevant and mean irrelevant similarity is a healthy sign. Less than 0.05
suggests the embedding model is not capturing the distinctions that matter for your task.

The code follows directly from the evaluation framework above: for each query, compute
cosine similarity against all documents, then partition scores into relevant and
irrelevant sets using your ground truth labels.

> **AGENTIC GROUNDING:** Embedding evaluation is something you do before deploying the
> agent, not after. Once the agent is live, you observe retrieval quality through the
> agent's outputs - does it cite relevant sources? does it answer correctly? But
> diagnosing whether the problem is embeddings, chunking, or generation requires going
> back to the embedding evaluation layer. The similarity distribution analysis above is
> the embedding equivalent of unit testing: it tells you whether the component works in
> isolation, before you integrate it into the full pipeline.

---

## 8. When Embeddings Are Overkill

*Estimated time: 15 minutes*

Embeddings are a powerful tool. They are also a complex, resource-consuming tool that
requires model selection, vector storage, indexing, and evaluation. For some tasks, they
are unnecessary.

### String Similarity: The Non-Embedding Baseline

Python's standard library includes `difflib.SequenceMatcher`, which computes the
similarity ratio between two strings based on the longest common subsequences. No model,
no API, no vectors. Just character-level comparison.

```python
from difflib import SequenceMatcher

def string_similarity(a: str, b: str) -> float:
  """Compute string similarity ratio (0 to 1)."""
  return SequenceMatcher(None, a.lower(), b.lower()).ratio()

# Examples
print(string_similarity("stale reference", "stale references"))      # ~0.97
print(string_similarity("stale reference", "stale ref propagation")) # ~0.67
print(string_similarity("stale reference", "authentication error"))  # ~0.24
```

**Bootcamp III Step 9 (text analysis)** covers SequenceMatcher and string similarity in
detail. The key insight is that string similarity works well when the texts you are
comparing share actual characters - when similarity is lexical, not just semantic. For
matching filenames, function names, error messages, or short titles, string similarity is
often sufficient and dramatically simpler than embeddings.

### Worked Example: The triangulate Script

This project's `bin/triangulate` script matches findings across code reviews from
different models. Each finding has a file path and a title. The matching algorithm uses
string similarity, not embeddings:

```python
# From bin/triangulate, lines 155-187

from difflib import SequenceMatcher

def similarity(a: str, b: str) -> float:
  """Compute string similarity ratio between two strings."""
  return SequenceMatcher(None, a.lower(), b.lower()).ratio()

# Matching formula: 0.3 * file_similarity + 0.7 * title_similarity
file_sim = similarity(finding_a.get("file", ""), finding_b.get("file", ""))
title_sim = similarity(finding_a.get("title", ""), finding_b.get("title", ""))
combined = 0.3 * file_sim + 0.7 * title_sim

if combined >= threshold:  # default threshold: 0.6
  # These findings are a match
  ...
```

The weighted combination (`0.3 * file_sim + 0.7 * title_sim`) is a design decision: the
title carries more signal than the file path for determining whether two findings are
about the same issue. The threshold of 0.6 is the minimum combined similarity for a match.

This works because:
1. Findings about the same issue tend to have similar titles ("Missing error handling in
   auth.ts" matches "Error handling gap in auth.ts")
2. They tend to reference the same or similar file paths
3. The comparison space is small (tens of findings, not millions of documents)
4. Exact word overlap is a strong signal (both reviewers will use similar technical terms)

Embeddings would add complexity without adding value here. The string similarity approach
is fast, deterministic, requires no external dependencies, and produces good matches. The
script has been used in production for multi-model code review triangulation since SD-318.

### When to Use What

| Task | String Similarity | Embeddings |
|------|------------------|------------|
| Matching filenames / paths | Yes | Overkill |
| Matching short titles | Yes | Overkill |
| Fuzzy deduplication of entries | Yes | Overkill |
| Finding semantically related documents | No | Yes |
| Search across large corpus (>1000 docs) | Poor recall | Yes |
| Handling paraphrasing / synonyms | No | Yes |
| Cross-language similarity | No | Yes |
| Domain where exact terms matter | Often better | Misses exact matches |

**The decision heuristic:** If the texts you are comparing would share significant
character sequences when they are about the same thing, start with string similarity. If
the texts could be about the same thing using completely different words, you need
embeddings.

The mistake to avoid: reaching for embeddings because they are the "AI way" when string
comparison solves the problem. Every layer of complexity you add (embedding model, vector
store, indexing) is a layer you must maintain, debug, and pay for. The engineering loop
applies: verify that the simpler approach fails before adding complexity.

> **FIELD VS NOVEL:** String matching with SequenceMatcher is standard Python (documented
> since Python 2.1). The novel contribution is the explicit comparison: the triangulate
> script (bin/triangulate:155-187) as a worked example of a task where embeddings would
> add complexity without adding value. The weighted similarity formula
> (`0.3 * file_sim + 0.7 * title_sim`) is a manually engineered feature that captures
> domain-specific knowledge about what matters for matching code review findings.
> Embeddings would need to learn this weighting from training data. When you have domain
> knowledge about what makes two things similar, encoding that knowledge directly is
> often more effective and always more transparent than hoping an embedding model has
> learned the same distinctions.

---

## Challenge: Embed and Compare

**Estimated time: 25 minutes**

**Prerequisites:** Completed Tool Setup. Either OpenAI API key configured or
sentence-transformers installed.

**Goal:** Embed a set of text chunks using two different backends (API and in-memory
search), verify that the results are consistent, and measure the latency difference.

### Setup

Prepare a set of 100 text chunks. You can use any text corpus. The project's
documentation files work well:

```python
from pathlib import Path

def load_chunks(directory: str, chunk_size: int = 500) -> list[dict]:
  """Load text files and split into chunks.

  Returns list of dicts with 'id', 'text', and 'source' keys.
  """
  chunks = []
  chunk_id = 0
  for path in sorted(Path(directory).glob("**/*.md")):
    text = path.read_text(encoding="utf-8")
    # Simple fixed-size chunking (Step 3 covers better strategies)
    for i in range(0, len(text), chunk_size):
      chunk_text = text[i:i + chunk_size].strip()
      if len(chunk_text) > 50:  # Skip tiny fragments
        chunks.append({
          "id": f"chunk_{chunk_id:04d}",
          "text": chunk_text,
          "source": str(path),
        })
        chunk_id += 1
  return chunks

# Load chunks from the docs directory (adjust path as needed)
chunks = load_chunks("docs/bootcamp")
print(f"Loaded {len(chunks)} chunks")

# Take at most 100
chunks = chunks[:100]
```

### Step 1: Embed with sentence-transformers and search with numpy

```python
import numpy as np
import time
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

# Embed all chunks
texts = [c["text"] for c in chunks]
start = time.perf_counter()
embeddings = model.encode(texts, show_progress_bar=True)
embed_time = time.perf_counter() - start
print(f"Embedded {len(texts)} chunks in {embed_time:.2f}s")

# Search with numpy
queries = [
  "How do I evaluate retrieval quality?",
  "What is the difference between precision and recall?",
  "When should I use embeddings vs keyword search?",
  "What are the failure modes of naive RAG?",
  "How do vector databases store and search embeddings?",
  "What is cosine similarity?",
  "How do I choose an embedding model?",
  "What is the working set concept?",
  "When are embeddings overkill?",
  "What is stale reference propagation?",
]

# Normalize for cosine similarity
emb_normed = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

numpy_results = {}
start = time.perf_counter()
for qi, query in enumerate(queries):
  q_emb = model.encode([query])
  q_normed = q_emb / np.linalg.norm(q_emb)
  sims = (emb_normed @ q_normed.T).flatten()
  top_5 = np.argsort(sims)[::-1][:5]
  numpy_results[qi] = [(chunks[i]["id"], float(sims[i])) for i in top_5]
numpy_time = time.perf_counter() - start
print(f"10 queries via numpy: {numpy_time*1000:.1f}ms total")
```

### Step 2: Store in Chroma and search

```python
import chromadb
import time

client = chromadb.Client()
collection = client.create_collection(
  name="bootcamp_chunks",
  metadata={"hnsw:space": "cosine"},
)

# Add to Chroma (use the same embeddings)
start = time.perf_counter()
collection.add(
  ids=[c["id"] for c in chunks],
  embeddings=embeddings.tolist(),
  documents=[c["text"] for c in chunks],
  metadatas=[{"source": c["source"]} for c in chunks],
)
add_time = time.perf_counter() - start
print(f"Added to Chroma in {add_time*1000:.1f}ms")

# Search with Chroma
chroma_results = {}
start = time.perf_counter()
for qi, query in enumerate(queries):
  q_emb = model.encode([query])
  results = collection.query(
    query_embeddings=q_emb.tolist(),
    n_results=5,
  )
  chroma_results[qi] = list(zip(results["ids"][0], results["distances"][0]))
chroma_time = time.perf_counter() - start
print(f"10 queries via Chroma: {chroma_time*1000:.1f}ms total")
```

### Step 3: Compare results

```python
# Compare top-5 results between numpy and Chroma
for qi in range(len(queries)):
  numpy_ids = [r[0] for r in numpy_results[qi]]
  chroma_ids = [r[0] for r in chroma_results[qi]]

  overlap = len(set(numpy_ids) & set(chroma_ids))
  print(f"Query {qi}: numpy top-5 = {numpy_ids}")
  print(f"          chroma top-5 = {chroma_ids}")
  print(f"          overlap: {overlap}/5")
  print()
```

**Verification:** The results should be identical or nearly identical (Chroma uses HNSW
which is approximate, so minor differences are expected at larger scales). At 100
documents, both should return the same results because Chroma's HNSW has effectively
exact recall.

**Questions to answer:**
1. Are the numpy and Chroma results identical?
2. What is the latency difference?
3. For each query, do the top results make sense given the query text?
4. Which queries produce the lowest similarity scores? Why might those queries be harder?

<details>
<summary>Hints</summary>

If results differ between numpy and Chroma, check:
- Are you using the same embeddings for both? (Not re-encoding)
- Is Chroma configured for cosine distance? (Check `hnsw:space`)
- Are the numpy embeddings normalized before computing similarities?

If the Chroma similarity scores look different from numpy, note that Chroma reports
distances (lower = more similar) while numpy cosine similarity reports similarities
(higher = more similar). Cosine distance = 1 - cosine similarity.

</details>

**Extension:** Add the OpenAI embedding model as a third backend. Embed the same chunks
with `text-embedding-3-small` and compare retrieval results against sentence-transformers.
Do the two models agree on the top results? Where do they disagree?

---

## Challenge: Semantic Search Over Slopodar

**Estimated time: 25 minutes**

**Prerequisites:** Completed Tool Setup. Familiarity with the slopodar taxonomy
(see `docs/internal/slopodar.yaml` or the compressed version in AGENTS.md).

**Goal:** Build a semantic search over the project's slopodar anti-pattern entries and
evaluate whether embedding-based retrieval captures the right similarities.

### Setup

```python
import yaml
from pathlib import Path

# Load slopodar patterns
slopodar_path = Path("docs/internal/slopodar.yaml")
with open(slopodar_path) as f:
  data = yaml.safe_load(f)

patterns = data["patterns"]
print(f"Loaded {len(patterns)} slopodar patterns")

# Build searchable text for each pattern
documents = []
for p in patterns:
  # Combine name + description for richer embedding
  text = f"{p['name']}: {p.get('description', '')}"
  documents.append({
    "id": p["id"],
    "name": p["name"],
    "domain": p.get("domain", "unknown"),
    "text": text,
  })
```

### Step 1: Embed all patterns

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("all-MiniLM-L6-v2")
texts = [d["text"] for d in documents]
embeddings = model.encode(texts)
print(f"Embedded {len(texts)} patterns, shape: {embeddings.shape}")
```

### Step 2: Query and evaluate

```python
def search_patterns(
  query: str,
  embeddings: np.ndarray,
  documents: list[dict],
  model,
  top_k: int = 5,
) -> list[dict]:
  """Search slopodar patterns by semantic similarity."""
  q_emb = model.encode([query])
  emb_normed = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
  q_normed = q_emb / np.linalg.norm(q_emb)
  sims = (emb_normed @ q_normed.T).flatten()
  top_indices = np.argsort(sims)[::-1][:top_k]
  return [
    {**documents[i], "similarity": float(sims[i])}
    for i in top_indices
  ]

# Test queries
test_queries = [
  "code that looks correct but isn't",
  "the model agrees with you when it shouldn't",
  "test that doesn't actually test anything",
  "writing that sounds important but says nothing",
  "the agent forgot what happened in the previous session",
]

for query in test_queries:
  print(f"\nQuery: '{query}'")
  results = search_patterns(query, embeddings, documents, model)
  for r in results:
    print(f"  [{r['similarity']:.4f}] {r['name']} ({r['domain']})")
```

### Step 3: Evaluate

For each query, manually assess the results:

1. **"code that looks correct but isn't"** - Expected top results: right-answer-wrong-work,
   phantom-ledger, shadow-validation. Do these appear in the top 5?

2. **"the model agrees with you when it shouldn't"** - Expected: the-lullaby,
   deep-compliance, apology-reflex, absence-claim-as-compliment. Are sycophancy patterns
   ranked highest?

3. **"test that doesn't actually test anything"** - Expected: right-answer-wrong-work,
   phantom-tollbooth, confessional-test, mock-castle. Do test-domain patterns surface?

4. **"writing that sounds important but says nothing"** - Expected: epistemic-theatre,
   nominalisation-cascade, epigrammatic-closure. Do prose-style patterns surface?

5. **"the agent forgot what happened in the previous session"** - Expected:
   session-boundary-amnesia. Does this specific pattern rank #1?

**Verification:** For at least 3 of 5 queries, the expected pattern should appear in the
top 3 results. If it does not, investigate: embed the expected pattern's text and the
query, compute their cosine similarity directly, and check whether the model is capturing
the semantic relationship.

**Fallback:** If no API key is available, use sentence-transformers (as shown above). The
exercise works identically.

<details>
<summary>Hints</summary>

If the expected patterns do not rank highly:
- Check whether the pattern's description text is long enough to embed meaningfully.
  Very short descriptions may not produce distinctive embeddings.
- Try embedding only the description (without the name) and see if results change.
- Try a more specific query: instead of "code that looks correct but isn't," try
  "a test assertion that passes for the wrong reason."
- Check the similarity scores. If all patterns have similar scores (e.g., all between
  0.3 and 0.4), the embedding model is not finding strong matches for any pattern.
  This is useful information - it means the query language and the pattern descriptions
  are not in the same semantic space.

</details>

**Extension:** Compare string similarity (SequenceMatcher) with embedding similarity for
this task. For each query, compute string similarity against each pattern's name and
description. Do the rankings differ? For which queries does string similarity outperform
embeddings? (Hint: queries that use the same terminology as the pattern names will favor
string similarity. Paraphrased queries will favor embeddings.)

---

## Challenge: Model Comparison

**Estimated time: 30 minutes**

**Prerequisites:** Completed Challenge 1 (embed and compare). Two embedding models
available: sentence-transformers and optionally OpenAI.

**Goal:** Systematically compare two embedding models on the same corpus and measure
where they agree and disagree.

### Setup

Use the same 100 chunks from Challenge 1. Embed with two models:

```python
from sentence_transformers import SentenceTransformer
import numpy as np

# Model A: small, fast
model_a = SentenceTransformer("all-MiniLM-L6-v2")
embeddings_a = model_a.encode(texts)
print(f"Model A: {embeddings_a.shape}")

# Model B: larger, higher quality
model_b = SentenceTransformer("all-mpnet-base-v2")
embeddings_b = model_b.encode(texts)
print(f"Model B: {embeddings_b.shape}")
```

**Fallback (if using OpenAI as Model B):**

```python
from openai import OpenAI

client = OpenAI()

def embed_openai(texts: list[str], model: str = "text-embedding-3-small") -> np.ndarray:
  """Embed texts using OpenAI API."""
  response = client.embeddings.create(input=texts, model=model)
  return np.array([d.embedding for d in response.data])

embeddings_b = embed_openai(texts)
print(f"Model B (OpenAI): {embeddings_b.shape}")
```

### Step 1: Cosine similarity distributions

```python
import numpy as np

def compute_all_pairwise_similarities(embeddings: np.ndarray) -> np.ndarray:
  """Compute all pairwise cosine similarities."""
  normed = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)
  sim_matrix = normed @ normed.T
  # Extract upper triangle (excluding diagonal)
  indices = np.triu_indices(len(embeddings), k=1)
  return sim_matrix[indices]

sims_a = compute_all_pairwise_similarities(embeddings_a)
sims_b = compute_all_pairwise_similarities(embeddings_b)

print(f"Model A similarities - mean: {sims_a.mean():.4f}, std: {sims_a.std():.4f}, "
      f"min: {sims_a.min():.4f}, max: {sims_a.max():.4f}")
print(f"Model B similarities - mean: {sims_b.mean():.4f}, std: {sims_b.std():.4f}, "
      f"min: {sims_b.min():.4f}, max: {sims_b.max():.4f}")
```

Note the distributions. Different models produce different similarity ranges. A
similarity of 0.7 in Model A might be equivalent to 0.5 in Model B. This is why absolute
similarity thresholds should not be hardcoded - they are model-dependent.

### Step 2: Top-K overlap rate

```python
queries = [
  "How do I evaluate retrieval quality?",
  "What is the difference between precision and recall?",
  "When should I use embeddings vs keyword search?",
  "What are the failure modes of naive RAG?",
  "How do vector databases store and search embeddings?",
]

k = 5
overlaps = []

for query in queries:
  q_a = model_a.encode([query])
  q_b = model_b.encode([query])

  # Normalize
  emb_a_normed = embeddings_a / np.linalg.norm(embeddings_a, axis=1, keepdims=True)
  emb_b_normed = embeddings_b / np.linalg.norm(embeddings_b, axis=1, keepdims=True)
  q_a_normed = q_a / np.linalg.norm(q_a)
  q_b_normed = q_b / np.linalg.norm(q_b)

  sims_a_q = (emb_a_normed @ q_a_normed.T).flatten()
  sims_b_q = (emb_b_normed @ q_b_normed.T).flatten()

  top_a = set(np.argsort(sims_a_q)[::-1][:k])
  top_b = set(np.argsort(sims_b_q)[::-1][:k])

  overlap = len(top_a & top_b) / k
  overlaps.append(overlap)
  print(f"Query: '{query[:50]}...'  overlap@{k}: {overlap:.0%}")

print(f"\nMean overlap@{k}: {np.mean(overlaps):.0%}")
```

**Interpretation:** High overlap (>80%) means the models agree on what is relevant. Low
overlap (<50%) means the models capture different notions of similarity. Neither is
inherently better - it depends on which notion matches your use case.

### Step 3: Qualitative assessment

For the query with the lowest overlap, print the top-5 results from each model side by
side and manually assess: which model returned more relevant results?

**Questions to answer:**
1. Which model's results are more relevant to your queries? (This requires your judgment.)
2. Is the larger model always better? Or does the smaller model sometimes find more
   relevant results?
3. For the query with the most disagreement, can you identify why the models differ?
4. Based on this evaluation, which model would you choose for your retrieval system?

**Verification:** You should have concrete numbers for similarity distributions, top-K
overlap rates, and at least one qualitative assessment of disagreement. The exercise is
complete when you can state which model is better for your data and why.

<details>
<summary>Hints</summary>

If overlap is very high (>90%) for all queries, your corpus may not be diverse enough to
distinguish the models. Try adding chunks from very different domains (e.g., mix
technical documentation with general text).

If overlap is very low (<30%), check that you are embedding with the correct model for
each set. A common mistake is using Model A to encode documents but Model B to encode
the query within the same search.

The qualitative assessment is the most valuable part. MTEB scores and similarity
distributions are proxies. Your judgment of "which results are more relevant" is the
ground truth for your use case.

</details>

**Extension (hard):** Add a third "model" based on BM25 keyword matching (use the
`rank-bm25` package: `uv pip install rank-bm25`). Compare: for which queries does BM25
outperform both embedding models? For which queries do embeddings outperform BM25? This
directly previews the hybrid search concept from Step 4.

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What is the difference between a sparse representation (TF-IDF) and a dense
   representation (embedding)? When does each have an advantage?

2. Why does cosine similarity ignore vector magnitude? When would you want magnitude
   to matter?

3. For 10,000 documents, do you need a vector database? What about 10 million?

4. What does the HNSW ef_search parameter control? What happens when you increase it?

5. What is the difference between IVF and HNSW? When would you choose IVF?

6. Why can't you use the same absolute similarity threshold across different embedding
   models?

7. OpenAI embeddings are L2-normalized. What does that mean for the relationship
   between cosine similarity and dot product?

8. You observe that a semantic search for "ERR_4829" returns documents about error
   handling in general but not the specific error. Why? What would fix this?

9. When is SequenceMatcher a better choice than embeddings for matching text?

10. You switch from all-MiniLM-L6-v2 (384 dims) to text-embedding-3-large (3072 dims)
    and your retrieval metrics do not improve. What should you investigate before
    assuming the model is not the problem?

---

## Recommended Reading

- **Reimers & Gurevych (2019).** "Sentence-BERT: Sentence Embeddings using Siamese
  BERT-Networks." The paper that created the sentence-transformers framework. Read for
  the insight that BERT's CLS token produces poor sentence embeddings without siamese
  fine-tuning.

- **Manning et al. (2008).** "Introduction to Information Retrieval," Chapter 6 (scoring,
  term weighting, vector space model). Freely available at
  `https://nlp.stanford.edu/IR-book/`. The foundation for understanding sparse
  representations and how cosine similarity was used for retrieval long before embeddings.

- **MTEB Leaderboard.** `https://huggingface.co/spaces/mteb/leaderboard`. The standard
  benchmark for embedding model comparison. Check this before selecting a model.

- **pgvector documentation.** `https://github.com/pgvector/pgvector`. Practical guide to
  HNSW and IVFFlat indexing in Postgres. The README is well-written and covers operational
  tuning.

- **OpenAI Embeddings Guide.** `https://platform.openai.com/docs/guides/embeddings`.
  Documentation for text-embedding-3-small/large, including the Matryoshka dimension
  reduction feature.

---

## What to Read Next

**Step 3: RAG Pipeline Engineering** - Now that you understand embeddings and vector
search, Step 3 composes them into a full pipeline: document loading, chunking, embedding,
storage, retrieval, and generation. The chunking strategy - how you split documents before
embedding - has as much impact on retrieval quality as the embedding model itself. Step 3
also introduces the retrieval-generation boundary: when the retrieval is good but the
generation is wrong, and vice versa. The metrics from Step 1 and the embedding
understanding from this step are prerequisites for diagnosing which side of that boundary
your failures are on.

