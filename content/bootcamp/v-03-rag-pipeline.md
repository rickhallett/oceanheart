+++
title = "RAG Pipeline Engineering"
date = "2026-03-10"
description = "Chunking strategies, query processing, context assembly, citation, RAG evaluation."
tags = ["rag", "pipeline", "engineering", "bootcamp"]
step = 3
tier = 1
estimate = "5-6 hours"
bootcamp = 5
+++

Step 3 of 9 in Bootcamp V: Agent Infrastructure in Practice.

---

Estimated total time: 5-6 hours.

**Field maturity:** Established (core pipeline), Emerging (advanced query processing)
**Prerequisites:** Step 1 (the retrieval problem), Step 2 (embeddings and vector search)
**Leads to:** Step 4 (advanced retrieval patterns), Step 7 (observability)
**You will need:** Python 3.10+, an OpenAI API key (or sentence-transformers for local
embeddings), chromadb, tiktoken, an LLM API key (OpenAI or Anthropic). See Tool Setup below.

---

## Why This is Step 3

Steps 1 and 2 provided the problem and the primary tool. Step 1 established that agents
need external knowledge and defined what retrieval quality means: precision, recall, MRR.
Step 2 gave you embeddings and vector search - the machinery for finding semantically
related documents. With those two pieces, you can retrieve documents relevant to a query.
But retrieval alone does not answer questions. A list of relevant chunks is not a response
a user can act on.

A RAG system is an engineering pipeline, not a single API call. Between the user's question
and the generated answer lie at least eight distinct processing stages, each with
engineering decisions that affect output quality. How you split documents into chunks
determines whether the right information can be retrieved at all. How you process the
user's query determines whether you search for the right thing. How you assemble retrieved
chunks into a prompt determines whether the model has enough context to generate a faithful
answer or so much that the signal drowns in noise.

The naive RAG pipeline - split documents into fixed chunks, embed them, retrieve the top-k
by cosine similarity, concatenate them into a prompt, generate - works surprisingly well
for simple cases. This is both the pattern's strength and its trap. The simple version works
for demo queries on clean documents. It fails on real workloads: messy document formats,
ambiguous queries, chunks that split critical information across boundaries, retrieved
context that overwhelms the generation model with irrelevant material.

This step walks through the full pipeline end to end. For each stage, you will see the
engineering decisions, the tradeoffs, and the failure modes. The goal is not "build a RAG
system" - the goal is to understand each stage well enough to diagnose failures when the
system produces wrong answers. Every section connects back to a practical debugging
question: when the output is wrong, which stage broke?

> **AGENTIC GROUNDING:** In this project, the AGENTS.md filesystem depth map is a manual
> retrieval policy: depth 1 files load every session, depth 2 files load when the topic is
> relevant, depth 3+ files require deliberate research (BFS depth rule, SD-195). A RAG
> pipeline automates exactly this decision. The pipeline's chunking strategy is the automated
> equivalent of deciding what granularity of information to make retrievable. Its query
> processing is the automated equivalent of a human operator reformulating "what went wrong?"
> into specific searches across specific files at specific depths.

---

## Table of Contents

1. [The Full RAG Pipeline](#1-the-full-rag-pipeline) (~30 min)
2. [Document Preprocessing](#2-document-preprocessing) (~25 min)
3. [Chunking Strategies](#3-chunking-strategies) (~45 min)
4. [Query Processing](#4-query-processing) (~35 min)
5. [Context Assembly](#5-context-assembly) (~25 min)
6. [Citation and Grounding](#6-citation-and-grounding) (~25 min)
7. [RAG Evaluation](#7-rag-evaluation) (~35 min)
8. [Failure Mode Analysis](#8-failure-mode-analysis) (~25 min)
9. [Challenges](#challenges) (~90-120 min)
10. [What to Read Next](#what-to-read-next)

---

## Tool Setup

*This section covers installation and verification. If you completed Step 2's Tool Setup,
most dependencies are already installed.*

### Required

```bash
# Core dependencies (if not already installed from Step 2)
uv pip install chromadb tiktoken openai numpy

# Verify
python3 -c "import chromadb, tiktoken; print('OK')"
```

### For LLM generation (one required)

**Option A - OpenAI (recommended):**

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

**Option C - Local embeddings only (no API key):**

```bash
uv pip install sentence-transformers
python3 -c "
from sentence_transformers import SentenceTransformer
m = SentenceTransformer('all-MiniLM-L6-v2')
print(f'Embedding dim: {m.encode([\"test\"]).shape[1]}')
"
```

---

## 1. The Full RAG Pipeline

*Estimated time: 30 minutes*

A RAG pipeline has eight stages. Most tutorials collapse them into three ("chunk, embed,
retrieve") and wonder why production systems fail. Here is the full pipeline with the
engineering decision at each stage made explicit:

```
 OFFLINE (indexing)                   ONLINE (query time)
 ==================                  ====================

 [Documents]                         [User Query]
      |                                   |
      v                                   v
 1. Preprocess                       5. Query Process
    (parse, clean, metadata)            (expand, transform, decompose)
      |                                   |
      v                                   v
 2. Chunk                            6. Retrieve
    (split, preserve context)           (search, filter, rank)
      |                                   |
      v                                   v
 3. Embed                            7. Assemble Context
    (text -> vectors)                   (order, dedup, budget, cite)
      |                                   |
      v                                   v
 4. Index                            8. Generate
    (store in vector DB)                (LLM answers from context)
```

The left column runs once per document corpus (or incrementally). The right column runs
once per user query. This asymmetry is fundamental: indexing amortizes over many queries
and can be slow. Query-time processing must be fast because a user is waiting.

Each stage has a failure mode that surfaces downstream. A preprocessing failure that strips
table formatting from a PDF propagates through every subsequent stage - the table data is
gone and no amount of query processing recovers it. A chunking failure that splits a
definition across two chunks means neither chunk contains the complete information. A query
processing failure that does not expand an acronym means the system searches for "SRE" when
the documents say "site reliability engineering."

The key insight: RAG quality is limited by the weakest stage. You cannot compensate for bad
chunking with better retrieval, or for bad preprocessing with better generation. Diagnosis
requires testing each stage independently.

Here is a minimal end-to-end pipeline. Every subsequent section improves one or more of
these stages.

```python
import os, json, chromadb, tiktoken
from openai import OpenAI

CHUNK_SIZE = 500       # tokens per chunk
CHUNK_OVERLAP = 50     # overlap between chunks
TOP_K = 5              # chunks to retrieve

client = OpenAI()
enc = tiktoken.encoding_for_model("gpt-4o-mini")
collection = chromadb.Client().create_collection("demo")


def preprocess(path):
  """Stage 1: Read file, extract text + metadata."""
  with open(path) as f:
    text = f.read()
  return text, {"source": path, "format": os.path.splitext(path)[1]}


def chunk_text(text):
  """Stage 2: Split into overlapping token-based chunks."""
  tokens = enc.encode(text)
  chunks, start = [], 0
  while start < len(tokens):
    end = start + CHUNK_SIZE
    chunks.append(enc.decode(tokens[start:end]))
    start = end - CHUNK_OVERLAP
  return chunks


def index_document(path):
  """Stages 1-4: Preprocess, chunk, embed (via Chroma), index."""
  text, meta = preprocess(path)
  for i, chunk in enumerate(chunk_text(text)):
    collection.add(
      documents=[chunk], ids=[f"{path}::chunk_{i}"],
      metadatas=[{**meta, "chunk_index": i}])


def retrieve(query, top_k=TOP_K):
  """Stage 6: Retrieve top-k chunks by similarity."""
  return collection.query(query_texts=[query], n_results=top_k)


def assemble_context(results):
  """Stage 7: Build context string with source attribution."""
  parts = []
  for i, (doc, meta) in enumerate(
    zip(results["documents"][0], results["metadatas"][0])):
    parts.append(f"[Source {i+1}: {meta['source']}]\n{doc}")
  return "\n\n---\n\n".join(parts)


def generate(query, context):
  """Stage 8: Generate answer grounded in retrieved context."""
  return client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content":
       "Answer based on the provided context. Cite sources as [Source N]. "
       "If context is insufficient, say so explicitly."},
      {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}],
    temperature=0.1,
  ).choices[0].message.content


def rag_query(query):
  """Full pipeline: process -> retrieve -> assemble -> generate."""
  results = retrieve(query)
  context = assemble_context(results)
  return generate(query, context)
```

This pipeline works for simple questions on clean documents. It will also fail in specific,
predictable ways that the rest of this step addresses:

- Documents with tables or structured data lose structure in preprocessing (Section 2)
- Fixed-size chunking splits information at arbitrary boundaries (Section 3)
- The query passes through unchanged, missing vocabulary mismatches (Section 4)
- Context assembly is naive concatenation with no budget management (Section 5)
- Citations are requested but not verified (Section 6)
- There is no measurement of retrieval or generation quality (Section 7)

> **FIELD VS NOVEL:** The RAG pipeline architecture (Lewis et al. 2020) and information
> retrieval fundamentals (Manning et al. 2008) are well-established. Extensive tutorials
> exist from LangChain, LlamaIndex, and provider documentation. The novel contribution
> here is framing each pipeline stage as a failure isolation boundary - the same pattern
> as the verification pipeline in this project (Swiss Cheese Model, Reason 1990), where
> errors are caught not by one perfect stage but by independent stages that each catch
> different failure types.

---

## 2. Document Preprocessing

*Estimated time: 25 minutes*

Preprocessing transforms raw documents into clean text with structured metadata. It is the
least discussed and most consequential stage. The quality ceiling of your entire RAG system
is set here: information lost or corrupted during preprocessing cannot be recovered by any
downstream stage.

### 2.1 The Format Problem

| Format | What you get | What you lose | Common failure |
|--------|-------------|---------------|----------------|
| Markdown | Clean text, headers, structure | Nothing (ideal input) | Embedded HTML, complex tables |
| HTML | Rich structure, links | Boilerplate, nav, ads | Extracting content vs chrome |
| PDF | Visual layout, tables | Text extraction errors | Multi-column interleaving |
| Code | Exact text, indentation | Structure without AST | Comments/code/docstrings conflated |
| CSV/JSON | Structured data | Schema context | Rows chunked without headers |

Markdown is the ideal RAG input format. It carries structure in the text itself: headers,
lists, code blocks are all visible to the tokenizer. The project's documentation (AGENTS.md,
SPEC.md, every DOMAIN.md) is markdown precisely because it is simultaneously human-readable,
machine-parseable, and tokenizer-friendly.

PDF is the worst common input. A PDF describes where to draw characters on a page, not what
the text means. Extracting text requires reconstructing reading order from character
positions, detecting columns, identifying headers from font size, and handling tables where
cells are independent text fragments. Every PDF library (PyMuPDF, pdfplumber, Unstructured)
makes different accuracy/speed tradeoffs.

```python
import os, json

def preprocess_markdown(path):
  """Extract text and structural metadata from markdown."""
  with open(path) as f:
    text = f.read()
  headers = []
  for line in text.split("\n"):
    if line.startswith("#"):
      level = len(line) - len(line.lstrip("#"))
      headers.append({"level": level, "title": line.lstrip("#").strip()})
  return text, {
    "source": path, "format": "markdown",
    "headers": json.dumps(headers),
    "title": headers[0]["title"] if headers else os.path.basename(path),
  }
```

### 2.2 Metadata Extraction

Metadata - source, date, author, section headers, domain tags - serves as filterable
attributes in the vector store. Without metadata, retrieval is pure semantic similarity.
With metadata, you can combine filters with similarity: "find chunks about authentication
from the last 30 days" is a metadata filter plus semantic search. This combination handles
queries that semantic similarity alone cannot.

```python
from datetime import datetime

def extract_metadata(path, text):
  """Extract metadata for vector store filtering."""
  stat = os.stat(path)
  meta = {
    "source": path,
    "filename": os.path.basename(path),
    "format": os.path.splitext(path)[1].lstrip("."),
    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
  }
  if path.endswith(".md"):
    lines = text.split("\n")
    for line in lines:
      if line.startswith("# "):
        meta["title"] = line[2:].strip()
        break
    meta["section_count"] = str(sum(1 for l in lines if l.startswith("## ")))
  return meta
```

The metadata schema depends on your query patterns. Metadata nobody queries is wasted
storage. Metadata users need but you did not extract means unanswerable queries.

> **AGENTIC GROUNDING:** In this project, each domain directory has a DOMAIN.md that serves
> as metadata for the domain's source files: architectural boundaries, data flow constraints,
> security requirements. An agent loading `lib/bouts/` first reads `lib/bouts/DOMAIN.md` to
> understand what the directory contains. This is metadata-first retrieval: load the metadata,
> then decide which source files to load. A RAG system's metadata filtering implements this
> pattern at scale.

### 2.3 Preprocessing Quality

Preprocessing quality determines retrieval quality. This is measurable, not a platitude. If
your PDF extractor garbles table data, every downstream stage works correctly on incorrect
data. The embedding model faithfully embeds the garbled text, the vector store faithfully
indexes it, retrieval faithfully returns it.

The preprocessing stage is where you should spend diagnostic effort first when RAG quality
is poor. Before tuning chunk sizes, before query expansion, before reranking - verify that
the text you are indexing is correct.

```python
def verify_preprocessing(path, processed_text):
  """Check extraction quality by comparing word coverage."""
  with open(path) as f:
    original = f.read()
  orig_words = set(original.lower().split())
  proc_words = set(processed_text.lower().split())
  if not orig_words:
    return {"coverage": 0.0, "status": "empty"}
  coverage = len(orig_words & proc_words) / len(orig_words)
  return {
    "coverage": round(coverage, 3),
    "lost_sample": sorted(orig_words - proc_words)[:10],
    "status": "ok" if coverage > 0.95 else "check_extraction",
  }
```

> **FIELD VS NOVEL:** Document preprocessing for search is established (Apache Tika,
> Unstructured, Textract). The project vocabulary adds a diagnostic lens: preprocessing
> failure is a form of stale reference propagation (slopodar) - the index describes text
> that does not accurately represent the original document. The detection mechanism is the
> same: compare the indexed representation against the source.

---

## 3. Chunking Strategies

*Estimated time: 45 minutes*

Chunking is the most impactful engineering decision in the offline pipeline. It determines
the granularity of retrievable information. Chunk too large and the embedding becomes a
diluted average of multiple topics - retrieval returns the chunk but most content is
irrelevant. Chunk too small and critical context splits across boundaries - the answer needs
information from two chunks but retrieval returns only one.

There is no universally correct chunk size. The right size depends on document structure,
query patterns, embedding model, and context budget. This section covers three strategies
and the overlap mechanism.

### 3.1 Fixed-Size Chunking (by Token Count)

Split text into chunks of N tokens with M tokens of overlap. This is what the minimal
pipeline in Section 1 uses.

```python
import tiktoken

def fixed_chunk(text, size=500, overlap=50, model="gpt-4o-mini"):
  """Split text into fixed-size token chunks with overlap."""
  enc = tiktoken.encoding_for_model(model)
  tokens = enc.encode(text)
  chunks, start = [], 0
  while start < len(tokens):
    end = min(start + size, len(tokens))
    chunks.append({"text": enc.decode(tokens[start:end]),
                    "tokens": end - start, "start": start})
    start += size - overlap
  return chunks
```

| Advantage | Disadvantage |
|-----------|-------------|
| Exact token count - easy to budget | Ignores semantic boundaries |
| No parsing, works on any text | Splits mid-sentence, mid-paragraph |
| O(n) with no analysis overhead | A chunk might start mid-concept |

The overlap mitigates boundary splitting. Typical values: 10-20% of chunk size. OpenAI's
file search uses 800 tokens with 400 overlap (50% - unusually high, maximizes boundary
safety at the cost of 2x storage).

**Use when:** Documents are homogeneous prose with no structural hierarchy. You need
predictable chunk counts. Speed matters more than boundary quality.

**Avoid when:** Documents have tables, code blocks, or hierarchical structure where
splitting a table row from its header makes the data meaningless.

### 3.2 Semantic Chunking (by Document Structure)

Semantic chunking respects document structure: split at headers, paragraph boundaries, or
other natural break points. A markdown file splits at `##` headers. A code file splits at
function boundaries.

```python
import re

def semantic_chunk_markdown(text, max_tokens=1000, model="gpt-4o-mini"):
  """Split markdown at section boundaries, subdividing large sections."""
  enc = tiktoken.encoding_for_model(model)
  sections = re.split(r'\n(?=## )', text)
  chunks = []
  h1 = ""

  for section in sections:
    lines = section.strip().split("\n")
    if not lines:
      continue
    header = ""
    for line in lines:
      if line.startswith("# ") and not line.startswith("## "):
        h1 = line.strip()
      elif line.startswith("## "):
        header = line.strip()

    section_text = section.strip()
    tcount = len(enc.encode(section_text))

    if tcount <= max_tokens:
      chunks.append({"text": section_text, "tokens": tcount,
                      "header": header or h1})
    else:
      # Split large sections at paragraph boundaries
      paras = section_text.split("\n\n")
      buf, buf_tokens = [], 0
      for para in paras:
        pt = len(enc.encode(para))
        if buf_tokens + pt > max_tokens and buf:
          chunks.append({"text": "\n\n".join(buf), "tokens": buf_tokens,
                          "header": header or h1})
          buf, buf_tokens = [para], pt
        else:
          buf.append(para)
          buf_tokens += pt
      if buf:
        chunks.append({"text": "\n\n".join(buf),
                        "tokens": len(enc.encode("\n\n".join(buf))),
                        "header": header or h1})
  return chunks
```

| Advantage | Disadvantage |
|-----------|-------------|
| Chunks contain complete semantic units | Variable sizes (some tiny, some large) |
| Headers provide natural chunk labels | Format-specific parsing required |
| High retrieval quality on structured docs | Small sections produce weak embeddings |

**Use when:** Documents have consistent, meaningful structure (technical docs, markdown).
**Avoid when:** Documents lack structure (raw text dumps, OCR output).

### 3.3 Recursive Chunking

Recursive chunking attempts the best of both: respect semantic boundaries where they exist,
fall back to smaller boundaries when chunks are too large:

1. Try splitting at the largest boundary (`\n## ` for markdown H2 headers)
2. If any chunk exceeds the size limit, split at the next boundary (`\n\n` for paragraphs)
3. Continue through sentences (`. `), words (` `), and characters as needed

LangChain's `RecursiveCharacterTextSplitter` implements this pattern. Here is the mechanism:

```python
class RecursiveChunker:
  """Split text at decreasing boundary levels with overlap."""

  def __init__(self, chunk_size=500, overlap=50, separators=None,
               model="gpt-4o-mini"):
    self.chunk_size = chunk_size
    self.overlap = overlap
    self.seps = separators or [
      "\n## ", "\n### ", "\n\n", "\n", ". ", " ", ""]
    self.enc = tiktoken.encoding_for_model(model)

  def _tc(self, text):
    return len(self.enc.encode(text))

  def _split_on(self, text, sep):
    if sep == "":
      return list(text)
    parts = text.split(sep)
    result = [parts[0]]
    for p in parts[1:]:
      result.append(sep + p)
    return [p for p in result if p.strip()]

  def chunk(self, text):
    return self._split(text, 0)

  def _split(self, text, sep_idx):
    if self._tc(text) <= self.chunk_size:
      return [text.strip()] if text.strip() else []
    if sep_idx >= len(self.seps):
      return self._force(text)

    parts = self._split_on(text, self.seps[sep_idx])
    if len(parts) <= 1:
      return self._split(text, sep_idx + 1)

    chunks, cur = [], ""
    for part in parts:
      combined = cur + part if cur else part
      if self._tc(combined) <= self.chunk_size:
        cur = combined
      else:
        if cur.strip():
          chunks.append(cur.strip())
        if self._tc(part) > self.chunk_size:
          chunks.extend(self._split(part, sep_idx + 1))
        else:
          cur = part
    if cur.strip():
      chunks.append(cur.strip())
    return self._overlap(chunks)

  def _force(self, text):
    tokens = self.enc.encode(text)
    chunks, start = [], 0
    while start < len(tokens):
      end = min(start + self.chunk_size, len(tokens))
      t = self.enc.decode(tokens[start:end]).strip()
      if t:
        chunks.append(t)
      start += self.chunk_size - self.overlap
    return chunks

  def _overlap(self, chunks):
    if self.overlap <= 0 or len(chunks) <= 1:
      return chunks
    result = [chunks[0]]
    for i in range(1, len(chunks)):
      prev_tokens = self.enc.encode(chunks[i - 1])
      overlap_text = self.enc.decode(prev_tokens[-self.overlap:])
      result.append(overlap_text + chunks[i])
    return result
```

**Why recursive chunking is the default recommendation:** It respects structure when
structure exists, degrades gracefully when absent, keeps chunk sizes predictable, and the
separator hierarchy is configurable per document type.

The LangChain equivalent for comparison:

```python
# uv pip install langchain-text-splitters
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
  chunk_size=500, chunk_overlap=50,
  separators=["\n## ", "\n### ", "\n\n", "\n", ". ", " ", ""],
  length_function=lambda t: len(tiktoken.encoding_for_model("gpt-4o-mini").encode(t)),
)
chunks = splitter.split_text(document_text)
```

### 3.4 Overlap and Chunk Size Tradeoffs

Overlap preserves context across boundaries. Without it, a sentence straddling two chunks
appears as a fragment in both, and neither fragment is retrievable for the full meaning.

```
 No overlap:
 [Chunk 1: ...auth system requires]  [Chunk 2: a valid JWT token...]
                                      ^ boundary splits the sentence

 With 50-token overlap:
 [Chunk 1: ...auth system requires a valid JWT token signed with...]
                  [Chunk 2: ...requires a valid JWT token signed with RS256...]
                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                   overlap - sentence complete in both chunks
```

| Overlap % | Use case | Cost |
|-----------|----------|------|
| 0% | Structured docs with natural boundaries | Boundary loss risk |
| 10-15% | General prose | Good balance |
| 20-25% | Dense technical content | Safer boundaries, more storage |
| 50% | Critical documents (OpenAI default) | Maximum safety, 2x chunks |

Chunk size affects every pipeline stage:

| Size | Embedding quality | Retrieval precision | Generation quality |
|------|------------------|--------------------|--------------------|
| Small (100-200 tokens) | Specific, focused | High precision, low recall | Missing context |
| Medium (300-500 tokens) | Balanced | Good precision/recall | Usually sufficient |
| Large (800-1500 tokens) | Diluted, multi-topic | Low precision, high recall | Noise from irrelevant content |

The right size depends on your documents and queries. FAQ answers need small chunks (each
FAQ is a natural unit). Long technical articles need larger chunks (section heading +
explanation is a natural unit). The exercises guide you through empirical comparison.

> **AGENTIC GROUNDING:** This project's BFS depth rule (SD-195) is a manual chunking
> strategy: AGENTS.md is one "chunk" at depth 1. Domain files (lib/bouts/DOMAIN.md) are
> chunks at depth 2. Full source code is depth 3+ material. The depth levels correspond to
> decreasing relevance and increasing granularity - the same tradeoffs that automated
> chunking manages.

> **FIELD VS NOVEL:** Chunking strategies are well-established (Manning et al. 2008;
> LangChain and LlamaIndex provide production implementations). The novel framing is
> chunking as context budget management: each chunk costs tokens from a finite L3 budget
> (context window dynamics). Oversized chunks create hot context pressure - the same failure
> as loading too many depth-1 files into an agent's boot sequence (SD-195, L8 saturation).
> The engineering question is not "best chunk size?" but "best signal-to-noise ratio within
> the context budget?"

---

## 4. Query Processing

*Estimated time: 35 minutes*

The user's query is rarely the optimal search query. A user types "how does auth work?" but
the documents say "the authentication system validates JWT tokens against the RS256 public
key." The vocabulary does not match. The question is broad; the relevant documents are
specific. The user asks a compound question needing information from multiple topics.

Query processing transforms the user's query into search queries more likely to retrieve
relevant documents. This is often the most impactful improvement to a basic RAG pipeline -
more impactful than changing chunk size or adding reranking.

### 4.1 Query Expansion

Add synonyms, acronyms, and related terms before embedding:

```python
def expand_query_llm(query, client):
  """Use an LLM to generate alternative search queries."""
  r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content":
       "Generate 3-5 search queries to help answer the user's question. "
       "Include synonyms, related terms, alternative phrasings. "
       "One query per line, no numbering."},
      {"role": "user", "content": query}],
    temperature=0.3, max_tokens=200)
  expansions = r.choices[0].message.content.strip().split("\n")
  return [query] + [e.strip() for e in expansions if e.strip()]
```

Query expansion addresses vocabulary mismatch at the cost of precision: the expanded query
casts a wider net, catching documents with different terminology, but also catching
documents that are merely related rather than relevant.

### 4.2 HyDE: Hypothetical Document Embedding

HyDE (Gao et al. 2022) is counterintuitive. Instead of embedding the user's query,
generate a hypothetical answer using an LLM, then embed that answer for retrieval.

The insight: in embedding space, a relevant-looking answer is closer to real relevant
documents than a short question is. "What causes memory leaks in Python?" is a short
interrogative. A hypothetical answer - "Memory leaks in Python are commonly caused by
circular references the GC cannot resolve, globals holding references to large objects, and
C extensions not releasing allocated memory" - looks like the documents you want to find,
even if it contains errors.

```python
def hyde_retrieve(query, client, collection, top_k=5):
  """Generate hypothetical answer, embed it, find real documents nearby."""
  r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content":
       "Write a short, detailed paragraph answering the following question. "
       "Write as documentation. Include technical details. Inaccuracies are OK - "
       "the goal is text that looks like the right kind of document."},
      {"role": "user", "content": query}],
    temperature=0.7, max_tokens=300)
  hypo_doc = r.choices[0].message.content

  # Embed the hypothetical doc (not the query) and retrieve
  results = collection.query(query_texts=[hypo_doc], n_results=top_k)
  return {"query": query, "hypothetical_doc": hypo_doc, "results": results}
```

**When HyDE helps:** Complex questions where the query embedding is far from relevant
documents. Domain-specific terminology mismatches. Questions requiring synthesis.

**When HyDE hurts:** Simple factual lookups (query is already close enough). Time-sensitive
queries where the LLM's knowledge is outdated. High-throughput systems where an extra LLM
call per query is too expensive.

> **AGENTIC GROUNDING:** HyDE mirrors what a skilled operator does intuitively. When an
> operator cannot find a file by searching for the problem ("sycophantic drift detection"),
> they imagine what the solution document would look like ("it would mention controls, L9
> thread position, and catch-log entries") and search for those terms instead. HyDE
> automates this. The operator's ability to imagine the right document depends on domain
> knowledge; HyDE's quality similarly depends on the LLM's parametric knowledge.

### 4.3 Query Decomposition

Complex questions require information from multiple topics. "How does authentication
interact with billing?" needs chunks about auth, billing, and their interface. A single
query embedding might not retrieve all three.

```python
def decompose_and_retrieve(query, client, collection, top_k_per=3):
  """Break query into sub-queries, retrieve for each, merge results."""
  r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content":
       "Break this question into 2-4 simpler sub-questions. "
       "Each should be answerable from a single document section. "
       "One per line, no numbering."},
      {"role": "user", "content": query}],
    temperature=0.2, max_tokens=200)
  sub_queries = [q.strip() for q in r.choices[0].message.content.split("\n")
                 if q.strip()]

  all_results = {}  # chunk_id -> (doc, meta, distance)
  for sq in sub_queries:
    res = collection.query(query_texts=[sq], n_results=top_k_per)
    for doc, meta, cid, dist in zip(
      res["documents"][0], res["metadatas"][0],
      res["ids"][0], res["distances"][0]):
      if cid not in all_results or dist < all_results[cid][2]:
        all_results[cid] = (doc, meta, dist)

  sorted_res = sorted(all_results.values(), key=lambda x: x[2])
  return {"original": query, "sub_queries": sub_queries,
          "chunks": [(d, m) for d, m, _ in sorted_res]}
```

**The three techniques compared:**

| Technique | Cost | Best for | Failure mode |
|-----------|------|----------|--------------|
| Query expansion | 1 LLM call | Vocabulary mismatch | Over-expansion retrieves noise |
| HyDE | 1 LLM call | Domain gap between query and docs | Bad hypothetical misleads retrieval |
| Decomposition | 1 + N LLM calls | Multi-topic questions | Decomposition misses real structure |

These compose in practice. A production pipeline might decompose a complex query, apply
HyDE to each sub-query, and merge results. Whether this is worth the cost depends on
latency requirements and query complexity.

> **FIELD VS NOVEL:** Query expansion is established IR (Manning et al. 2008, Ch 9). HyDE
> (Gao et al. 2022) is recent but published. Query decomposition is an emerging agentic
> pattern. The novel framing: these are automated calibration of the working set (Denning
> 1968 applied to LLM context). The query as typed specifies a partial working set; query
> processing completes it. Cold context pressure - the model falling back to pattern-matching
> from training data - is what happens when query processing fails to construct the right
> working set.

---

## 5. Context Assembly

*Estimated time: 25 minutes*

Retrieval returns a ranked list of chunks. Context assembly transforms that list into a
prompt the generation model can use effectively. This is where retrieval concerns (ranking,
relevance) meet LLM concerns (context window limits, attention patterns, instruction
following).

### 5.1 Ordering

The order of chunks in the prompt affects generation quality. LLMs exhibit primacy bias (more
attention to the beginning), recency bias (more attention to the end), and reduced attention
to content in the middle ("lost in the middle," documented in Step 2).

Three strategies: **relevance-first** (default - highest-scoring chunks at the start, where
the model attends most), **chronological** (preserves narrative flow when chunks come from
the same document), and **sandwich** (best chunks at start and end, weakest in the middle,
exploiting attention patterns).

### 5.2 Deduplication

Overlapping chunks produce redundant content. Two chunks sharing 50 tokens of overlap might
both score highly, and concatenating them wastes context budget on duplicate text.

```python
from difflib import SequenceMatcher

def deduplicate(chunks, threshold=0.7):
  """Remove near-duplicate chunks, keeping first (highest-ranked)."""
  unique = []
  for chunk in chunks:
    if not any(SequenceMatcher(None, chunk["text"], k["text"]).ratio() > threshold
               for k in unique):
      unique.append(chunk)
  return unique
```

Deduplication recovers retrieval slots. If two of your top-5 are near-duplicates, you
effectively have four unique pieces of information. Deduplicating and backfilling from
position 6 gives you five.

### 5.3 Source Attribution and Context Budget

Every chunk needs a source tag for citation. The context must also respect a token budget.

```python
def assemble_with_budget(chunks, max_tokens=4000, model="gpt-4o-mini"):
  """Assemble context with source attribution, respecting token budget."""
  enc = tiktoken.encoding_for_model(model)
  parts, total, source_map = [], 0, {}

  for i, chunk in enumerate(chunks):
    src_id = f"Source {i+1}"
    src_file = chunk.get("metadata", {}).get("source", "unknown")
    header = chunk.get("metadata", {}).get("header", "")
    tag = f"[{src_id}: {src_file}" + (f" > {header}]" if header else "]")

    text = f"{tag}\n{chunk['text']}"
    tokens = len(enc.encode(text))
    if total + tokens > max_tokens:
      break

    parts.append(text)
    total += tokens
    source_map[src_id] = {"file": src_file, "header": header}

  return "\n\n---\n\n".join(parts), source_map
```

The context budget controls a fundamental tradeoff. Every token of retrieved context costs
money and attention. Larger context windows (200k+ tokens) make it tempting to retrieve many
chunks, but more context is not monotonically better. Each additional chunk:

1. Costs input tokens (direct API cost)
2. Dilutes signal-to-noise (irrelevant content competes for attention)
3. Increases risk of contradictory information
4. Reduces token budget for the model's output

> **AGENTIC GROUNDING:** This is the context budget problem that this project navigates
> manually. AGENTS.md is compressed to ~700 lines because every token of agent role context
> costs L3 budget and risks L8 saturation. The standing order "aggressive offloading to
> durable storage and subagent dispatch" (hot context pressure countermeasure) is the manual
> equivalent of context budget management in RAG. Over-retrieval is the automated version
> of the same failure: loading too much into a finite context window until signal degrades.

> **FIELD VS NOVEL:** Context window management is an active research area (Xu et al. 2024,
> "lost in the middle"). The project vocabulary provides precise terminology: hot context
> pressure names the failure mode of over-retrieval. The context quality loop (lexicon v0.26)
> predicts that degraded generation feeds back into worse future context if saved - the same
> compound degradation as technical debt (Cunningham 1992), applied to retrieval.

---

## 6. Citation and Grounding

*Estimated time: 25 minutes*

A RAG system that generates answers without citing sources has the same trust problem as a
model without retrieval: the user cannot verify the answer. Citation connects generated
claims to retrieved evidence. Grounding ensures the model generates from context rather than
parametric knowledge.

### 6.1 The Hallucination Problem in RAG

RAG does not eliminate hallucination. It reduces it by providing relevant context, but the
model can still:

1. **Ignore context** and generate from parametric memory (strong prior overrides weak context)
2. **Synthesize across chunks** in ways no individual chunk supports
3. **Extrapolate** beyond context ("X, therefore Y" where Y is not in any document)
4. **Cite incorrectly** (says [Source 2] but the claim is not in Source 2)

Each failure mode requires a different mitigation. The first is a prompt engineering problem.
The second and third are faithfulness problems. The fourth is a citation accuracy problem.

### 6.2 Faithful Generation

```python
FAITHFUL_PROMPT = """Answer based ONLY on the provided context documents.
Rules:
1. Every factual claim must cite its source: [Source N].
2. Multiple sources supporting one claim: [Source 1][Source 3].
3. If context is insufficient, say so explicitly. Do NOT use general knowledge.
4. If sources contradict, note the contradiction.
5. Do not infer or extrapolate beyond what sources state."""


def generate_faithful(query, context, source_map, client):
  """Generate with citation, return answer and cited source list."""
  import re
  r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content": FAITHFUL_PROMPT},
      {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}],
    temperature=0.1)
  answer = r.choices[0].message.content
  cited = set(re.findall(r'\[Source (\d+)\]', answer))
  return {
    "answer": answer,
    "cited": {f"Source {n}": source_map.get(f"Source {n}", "?") for n in cited},
    "uncited": {k: v for k, v in source_map.items()
                if k not in [f"Source {n}" for n in cited]},
  }
```

Low temperature (0.1) reduces creative generation. The system prompt strongly constrains
output. These are heuristic controls, not guarantees - the model can still hallucinate.

### 6.3 Citation Verification

Citation accuracy is verifiable. You can automatically check whether a cited source
actually supports the claim:

```python
import re

def verify_citations(answer, chunks, client):
  """Check each [Source N] citation against the cited chunk."""
  sentences = re.split(r'(?<=[.!?])\s+', answer)
  results = []

  for sentence in sentences:
    sources = re.findall(r'\[Source (\d+)\]', sentence)
    if not sources:
      results.append({"sentence": sentence, "verdict": "UNCITED"})
      continue
    for sn in sources:
      idx = int(sn) - 1
      if idx >= len(chunks) or idx < 0:
        results.append({"sentence": sentence, "source": sn, "verdict": "INVALID"})
        continue
      r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
          {"role": "system", "content":
           "Does the source support the claim? Answer SUPPORTED, PARTIAL, "
           "or UNSUPPORTED with a brief reason."},
          {"role": "user", "content":
           f"Claim: {sentence}\n\nSource:\n{chunks[idx]['text']}"}],
        temperature=0.0, max_tokens=80)
      verdict = r.choices[0].message.content.split()[0]
      results.append({"sentence": sentence, "source": sn, "verdict": verdict})

  verdicts = [r["verdict"] for r in results]
  total_cited = sum(1 for v in verdicts if v != "UNCITED")
  supported = verdicts.count("SUPPORTED") + verdicts.count("PARTIAL")
  return {
    "results": results,
    "support_rate": round(supported / total_cited, 3) if total_cited else 0,
  }
```

This uses an LLM as judge, which inherits LLM biases. For critical applications, human
verification of a sample is necessary. But automated verification catches the most common
failures: citations to wrong sources, citations where the source lacks the claimed info,
and citations to nonexistent sources.

> **SLOPODAR:** Citation verification is susceptible to shadow validation: you build a
> verification system that works for simple claims ("The port is 5432 [Source 3]") but fails
> for synthesized claims, implicit inferences, and numerical conclusions. The most complex
> claims are exactly where automated verification is weakest. Detection: test your verifier
> on claims you know are wrong. If it passes them, your validation covers the easy cases
> and skips the critical path.

> **FIELD VS NOVEL:** Citation in NLG is an active research area (Rashkin et al. 2023).
> The novel framing: citation verification is structurally identical to right-answer-wrong-work
> (slopodar) - the output looks correct (citation format is right) but the causal path is
> wrong (the cited source does not support the claim). Detection requires the same discipline:
> trace the claim to the source, do not just verify the output format.

---

## 7. RAG Evaluation

*Estimated time: 35 minutes*

A RAG system has two independent components that can fail: retrieval (did we find the right
documents?) and generation (did we generate a faithful answer?). Evaluating only the final
answer conflates these failures. A wrong answer might be caused by bad retrieval, bad
generation, or both. Separate evaluation is not optional - it is the only way to diagnose
which stage needs improvement.

### 7.1 Retrieval Quality

These metrics were introduced in Step 1. Here is the implementation for a RAG pipeline:

```python
def evaluate_retrieval(queries, ground_truth, collection, top_k=5):
  """Evaluate precision@k, recall@k, and MRR across a test set.

  ground_truth: dict mapping query -> list of relevant chunk IDs.
  """
  precisions, recalls, rrs = [], [], []
  for query in queries:
    expected = set(ground_truth.get(query, []))
    if not expected:
      continue
    retrieved = collection.query(query_texts=[query], n_results=top_k)["ids"][0]
    hits = sum(1 for r in retrieved if r in expected)
    precisions.append(hits / len(retrieved) if retrieved else 0)
    recalls.append(hits / len(expected))
    rr = 0
    for rank, doc_id in enumerate(retrieved, 1):
      if doc_id in expected:
        rr = 1.0 / rank
        break
    rrs.append(rr)

  n = len(precisions)
  return {
    "queries": n,
    "precision@k": round(sum(precisions) / n, 4) if n else 0,
    "recall@k": round(sum(recalls) / n, 4) if n else 0,
    "mrr": round(sum(rrs) / n, 4) if n else 0,
  }
```

Building ground truth (which chunks are relevant per query) requires human judgment. This is
the most time-consuming part of RAG evaluation, and it is irreplaceable. Automated relevance
judgments (LLM as judge) are useful for rapid iteration but must be validated against human
judgments for your domain.

### 7.2 Generation Quality

Three dimensions:

- **Faithfulness:** Does the answer contain only information from context? Unfaithful claims are hallucinations.
- **Relevance:** Does the answer address the question asked?
- **Completeness:** Does the answer use all relevant information from context?

```python
def evaluate_generation(query, answer, context, client):
  """LLM-as-judge evaluation of generation quality."""
  r = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
      {"role": "system", "content": """Score 0-5 on each dimension:
FAITHFULNESS: Only claims supported by context? (5=all, 0=many unsupported)
RELEVANCE: Addresses the question? (5=directly, 0=not at all)
COMPLETENESS: Uses all relevant context? (5=all, 0=most ignored)
Format: DIMENSION: N - brief justification"""},
      {"role": "user", "content":
       f"Question: {query}\n\nContext:\n{context}\n\nAnswer:\n{answer}"}],
    temperature=0.0, max_tokens=200)
  return r.choices[0].message.content
```

### 7.3 RAGAS Framework

RAGAS (vibrantlabsai/ragas) provides standardized RAG evaluation metrics:

| RAGAS Metric | Dimension | What it measures |
|-------------|-----------|------------------|
| Faithfulness | Generation | Fraction of claims supported by context |
| Answer Relevance | Generation | How relevant the answer is to the question |
| Context Precision | Retrieval | Are retrieved chunks relevant? |
| Context Recall | Retrieval | Are all needed chunks retrieved? |

```python
# uv pip install ragas datasets
from ragas import evaluate
from ragas.metrics import (faithfulness, answer_relevancy,
                            context_precision, context_recall)
from datasets import Dataset

data = {"question": queries, "answer": answers,
        "contexts": contexts, "ground_truth": ground_truths}
results = evaluate(Dataset.from_dict(data),
                   metrics=[faithfulness, answer_relevancy,
                            context_precision, context_recall])
```

RAGAS uses LLM-as-judge internally, inheriting LLM biases. Use for rapid iteration;
validate with human evaluation for production decisions.

### 7.4 Why Independent Measurement Matters

**Scenario A:** Retrieval is excellent but generation is unfaithful (model ignores context).
End-to-end: wrong answer. Fix: generation prompt, not retrieval.

**Scenario B:** Retrieval fails but generation is faithful (accurately summarizes irrelevant
chunks). End-to-end: wrong answer. Fix: retrieval or chunking, not generation.

Without independent measurement, both look identical. With it, you know which stage to fix.
This is the same principle as the verification pipeline: testing only the end state
conflates failures from different sources.

> **AGENTIC GROUNDING:** Independent stage evaluation mirrors the engineering loop: "Read ->
> Verify -> Write -> Execute -> Confirm." When the gate fails, you diagnose which check
> failed (typecheck? lint? test?) and fix that stage. RAG evaluation follows the same
> discipline: do not retrain the whole pipeline when the answer is wrong. Find the broken
> stage first.

---

## 8. Failure Mode Analysis

*Estimated time: 25 minutes*

Every RAG pipeline fails. The engineering question is not "will it fail?" but "how does it
fail, and what does the user experience when it does?"

### 8.1 Retrieval Failure: Nothing Relevant Found

Causes: document not in index, indexing bug skipped the file, embedding model maps query
and relevant documents far apart, metadata filters too restrictive.

**Diagnostic:** Retrieve more chunks than usual and examine the distance distribution. A
tight cluster (all results equally distant) means the index contains nothing relevant and
results are noise. A spread distribution (some closer, some far) means the top results may
be partially relevant.

```python
def diagnose_retrieval(query, collection, top_k=20):
  """Examine distance distribution to diagnose retrieval failures."""
  results = collection.query(query_texts=[query], n_results=top_k)
  dists = results["distances"][0] if results["distances"] else []
  sources = [m.get("source", "?") for m in results["metadatas"][0]]
  spread = (max(dists) - min(dists)) if dists else 0
  return {
    "top_distances": dists[:5],
    "spread": round(spread, 4),
    "unique_sources": len(set(sources)),
    "pattern": "NOISE" if spread < 0.05 else "SPREAD",
  }
```

**Graceful degradation:** The system must say "I don't have enough information" rather than
hallucinate. This requires explicit instructions in the generation prompt.

### 8.2 Chunking Failure: Boundary Splits

The relevant document exists but critical information was split across chunks. The
definition starts in chunk 7, the explanation continues in chunk 8. Retrieval returns chunk
8 (explanation without definition) and the answer is incomplete.

**Diagnostic:** Check whether adjacent chunks (by chunk_index in the same source) contain
the missing information. If they do, the fix is more overlap, semantic chunking, or parent
document retrieval (covered in Step 4).

### 8.3 Ambiguous Query

The query matches multiple topics equally. "How does the system handle errors?" retrieves
chunks about error handling from auth, billing, database, and API - each relevant but to a
different interpretation.

**Diagnostic:** High source diversity with similar relevance scores signals ambiguity. The
fix: ask the user for clarification (if interactive), use metadata filtering to scope the
domain, or use query decomposition.

### 8.4 Contradictory Context

Retrieved chunks contain contradictory information - the 2023 doc says OAuth 2.0, the 2024
doc says API keys. Both are in the index, both are retrieved, and the model must reconcile
them. This is often caused by stale documents in the index. The fix is operational: keep
the index current and add temporal metadata to prefer recent information.

### 8.5 Failure Mode Summary

| Failure mode | Pipeline stage | Symptom | Fix |
|-------------|---------------|---------|-----|
| Nothing relevant | Retrieval / indexing | Wrong answer, confident | Check distance distribution |
| Boundary split | Chunking | Incomplete answer | More overlap, semantic chunking |
| Ambiguous query | Query processing | Scattered, unfocused | Decomposition, metadata filters |
| Contradictory context | Index maintenance | Inconsistent answer | Temporal metadata, dedup |
| Unfaithful generation | Generation | Claims not in context | Citation verification, prompt tuning |
| Context overload | Context assembly | Ignores relevant chunks | Reduce budget, better ordering |

**The design principle:** the system should tell the user when it lacks information, not
hallucinate. Graceful degradation is an explicit design choice, not an afterthought.

> **FIELD VS NOVEL:** RAG failure analysis is emerging (Barnett et al. 2024, "Seven Failure
> Points When Engineering a RAG System"). The project vocabulary sharpens it. Stale reference
> propagation (slopodar) names the mechanism of contradictory context: the index describes a
> state that no longer exists, and every query hitting those chunks gets corrupted. Shadow
> validation (slopodar) names chunking failure: the strategy is tested on simple documents
> where boundaries align with paragraphs, and passes - but fails on complex documents
> (tables, nested code, multi-part definitions) where boundaries actually matter.

---

## Challenge: Build a RAG Pipeline

**Estimated time: 30-40 minutes**

**Prerequisites:** Completed Tool Setup. Bootcamp markdown files available (the
`docs/bootcamp/` directory or downloaded from the repository).

**Goal:** Build a RAG pipeline over bootcamp documentation. Implement recursive chunking,
Chroma storage, retrieval with context assembly, and generation.

```python
import os, glob, chromadb, tiktoken
from openai import OpenAI

client = OpenAI()
chroma = chromadb.Client()
coll = chroma.get_or_create_collection("bootcamp", metadata={"hnsw:space": "cosine"})

# Collect and index documents
DOCS_DIR = "docs/bootcamp/"  # adjust path
md_files = glob.glob(os.path.join(DOCS_DIR, "*.md"))
printf_msg = f"Found {len(md_files)} files"
print(printf_msg)

chunker = RecursiveChunker(chunk_size=400, overlap=40)  # from Section 3.3
total = 0
for path in md_files:
  with open(path) as f:
    text = f.read()
  chunks = chunker.chunk(text)
  for i, ct in enumerate(chunks):
    coll.add(documents=[ct], ids=[f"{os.path.basename(path)}::chunk_{i}"],
             metadatas=[{"source": path, "filename": os.path.basename(path),
                         "chunk_index": i}])
  total += len(chunks)
  printf_msg = f"  {path}: {len(chunks)} chunks"
  print(printf_msg)

printf_msg = f"Total: {total} chunks indexed"
print(printf_msg)

# Query
query = "What should I know about process observation?"
results = coll.query(query_texts=[query], n_results=5)

for i, (doc, meta, dist) in enumerate(zip(
  results["documents"][0], results["metadatas"][0], results["distances"][0])):
  printf_msg = f"Result {i+1} (dist {dist:.4f}): {meta['filename']}, chunk {meta['chunk_index']}"
  print(printf_msg)
  printf_msg = f"  {doc[:150]}..."
  print(printf_msg)

# Generate answer
ctx_parts = [f"[Source {i+1}: {m['filename']}]\n{d}"
             for i, (d, m) in enumerate(zip(
               results["documents"][0], results["metadatas"][0]))]
ctx = "\n\n---\n\n".join(ctx_parts)

answer = client.chat.completions.create(
  model="gpt-4o-mini",
  messages=[
    {"role": "system", "content": "Answer from context. Cite as [Source N]."},
    {"role": "user", "content": f"Context:\n{ctx}\n\nQuestion: {query}"}],
  temperature=0.1).choices[0].message.content

print("\n=== Answer ===")
print(answer)
```

**Fallback:** Without an API key, use sentence-transformers for embeddings (Chroma's
default) and skip generation - print retrieved chunks as the "answer" and manually verify
whether they answer the question.

**Verification:**
1. The query should retrieve chunks from steps about process management or /proc.
2. Are retrieved chunks from the right step(s)? Wrong-step results indicate chunking or
   embedding problems.
3. Does the answer cite sources? Are citations accurate?

<details>
<summary>Hints</summary>

- Poor retrieval? Try chunk_size 300-600 for markdown documentation.
- Chunks from unrelated steps? Chunks may be too small, losing topic context. Try larger
  chunks with headers preserved.
- Generic answer? Strengthen the grounding instruction in the system prompt.

</details>

**Extension:** Add query expansion (Section 4.1). Before querying Chroma, generate 3
alternative phrasings with an LLM. Retrieve for each and merge results. Does this improve
answers for ambiguous queries?

---

## Challenge: Chunking Strategy Comparison

**Estimated time: 30-40 minutes**

**Prerequisites:** Completed the first challenge (documents available, Chroma working).

**Goal:** Compare three chunking strategies on the same corpus using 10 test queries.
Measure precision@5 to determine which strategy retrieves the most relevant chunks.

```python
import os, re, tiktoken, chromadb

enc = tiktoken.encoding_for_model("gpt-4o-mini")
chroma = chromadb.Client()

# 10 test queries with expected source files (adjust filenames to yours)
TEST = {
  "What is a process in Linux?": ["bcv-01-retrieval-problem.md"],
  "How do embeddings represent text?": ["bcv-02-embeddings-vector-search.md"],
  "What is cosine similarity?": ["bcv-02-embeddings-vector-search.md"],
  "How does RAG work?": ["bcv-03-rag-pipeline.md"],
  "What is chunking in RAG?": ["bcv-03-rag-pipeline.md"],
  "What metrics measure retrieval quality?": ["bcv-01-retrieval-problem.md"],
  "How do vector databases index embeddings?": ["bcv-02-embeddings-vector-search.md"],
  "What is query expansion?": ["bcv-03-rag-pipeline.md"],
  "How should context be assembled?": ["bcv-03-rag-pipeline.md"],
  "What causes RAG failures?": ["bcv-03-rag-pipeline.md"],
}


def make_chunks(strategy_name, md_files):
  """Generate chunks using one of three strategies."""
  chunks = []
  for path in md_files:
    with open(path) as f:
      text = f.read()
    fname = os.path.basename(path)

    if strategy_name == "fixed_500":
      tokens = enc.encode(text)
      start = 0
      while start < len(tokens):
        chunks.append({"text": enc.decode(tokens[start:start+500]), "source": fname})
        start += 450
    elif strategy_name == "fixed_1000":
      tokens = enc.encode(text)
      start = 0
      while start < len(tokens):
        chunks.append({"text": enc.decode(tokens[start:start+1000]), "source": fname})
        start += 900
    elif strategy_name == "semantic":
      for section in re.split(r'\n(?=## )', text):
        if section.strip():
          chunks.append({"text": section.strip(), "source": fname})
  return chunks


def eval_strategy(name, chunks):
  """Index, query, measure precision@5, clean up."""
  cname = name.replace(" ", "_")
  coll = chroma.get_or_create_collection(cname, metadata={"hnsw:space": "cosine"})
  for i, c in enumerate(chunks):
    coll.add(documents=[c["text"]], ids=[f"{c['source']}::{i}"],
             metadatas=[{"source": c["source"]}])

  precs = []
  for query, expected in TEST.items():
    res = coll.query(query_texts=[query], n_results=5)
    sources = [m["source"] for m in res["metadatas"][0]]
    precs.append(sum(1 for s in sources if s in expected) / 5)

  chroma.delete_collection(cname)
  avg = sum(precs) / len(precs)
  printf_msg = f"{name}: {len(chunks)} chunks, precision@5 = {avg:.4f}"
  print(printf_msg)
  return avg


for name in ["fixed_500", "fixed_1000", "semantic"]:
  eval_strategy(name, make_chunks(name, md_files))
```

**Verification:**
1. Semantic chunking typically has higher precision on well-structured markdown.
2. Fixed 500-token chunks typically beat 1000-token (more focused embeddings).
3. If all strategies score similarly, your queries may be too easy.

<details>
<summary>Hints</summary>

- Similar scores across strategies? Try queries that require distinguishing between related
  topics in different files.
- Semantic chunking poor? Check chunk sizes - very large sections have diluted embeddings.

</details>

**Extension:** Add recursive chunking (Section 3.3) with 400-token targets as a fourth
strategy. Does it outperform fixed-size on structured documents while staying competitive on
unstructured text?

---

## Challenge: Citation Implementation

**Estimated time: 40-50 minutes**

**Prerequisites:** Working RAG pipeline from Challenge 1. An LLM API key for generation and
verification.

**Goal:** For each generated sentence, annotate which chunk it draws from. Evaluate what
percentage of generated claims have source support.

```python
import re
from openai import OpenAI

client = OpenAI()

CITE_PROMPT = """Answer using ONLY the provided context.
Every factual sentence must end with [Source N]. Multiple sources: [Source 1][Source 3].
No factual sentence without a citation. If context is insufficient, say so."""

test_queries = [
  "What is the retrieval problem in agent systems?",
  "How do embeddings represent semantic similarity?",
  "What chunking strategies are available for RAG?",
  "How should retrieved context be assembled?",
  "What are common RAG failure modes?",
]

for query in test_queries:
  # Retrieve
  res = coll.query(query_texts=[query], n_results=5)
  chunks = [{"text": d, "source": m.get("filename", "?")}
            for d, m in zip(res["documents"][0], res["metadatas"][0])]

  # Generate with citations
  ctx = "\n\n---\n\n".join(
    f"[Source {i+1}: {c['source']}]\n{c['text']}" for i, c in enumerate(chunks))
  answer = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "system", "content": CITE_PROMPT},
              {"role": "user", "content": f"Context:\n{ctx}\n\nQuestion: {query}"}],
    temperature=0.1).choices[0].message.content

  # Verify each citation
  sentences = re.split(r'(?<=[.!?])\s+', answer)
  supported, total_cited = 0, 0
  for sent in sentences:
    sources = re.findall(r'\[Source (\d+)\]', sent)
    if not sources:
      continue
    for sn in sources:
      total_cited += 1
      idx = int(sn) - 1
      if idx >= len(chunks):
        continue
      v = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
          {"role": "system", "content":
           "Does the source support the claim? SUPPORTED, PARTIAL, or UNSUPPORTED."},
          {"role": "user", "content":
           f"Claim: {sent}\n\nSource:\n{chunks[idx]['text']}"}],
        temperature=0.0, max_tokens=50).choices[0].message.content
      if "SUPPORTED" in v or "PARTIAL" in v:
        supported += 1

  rate = round(supported / total_cited, 3) if total_cited else 0
  printf_msg = f"{query[:50]}... support_rate={rate} ({supported}/{total_cited})"
  print(printf_msg)
```

**Fallback:** Without an LLM API, write three paragraphs answering one query manually, add
[Source N] citations, and verify your own citations against the retrieved chunks.

**Verification:**
1. Support rate should exceed 0.7 for well-grounded answers.
2. Examine UNSUPPORTED verdicts - genuine hallucinations or verification errors?
3. The LLM judge can be wrong. Spot-check 5-10 verdicts manually.

<details>
<summary>Hints</summary>

- Low support rate? Strengthen the citation instruction in the system prompt.
- Many uncited sentences? Filter out connecting phrases ("In summary," "Based on this,")
  before computing rates.
- Judge errors? Spot-check manually - LLM judges are biased toward SUPPORTED.

</details>

**Extension:** Extract atomic claims instead of using whole sentences. Use an LLM to
decompose "The system uses OAuth 2.0 with RS256 signing" into two claims and verify each.
Compare sentence-level vs claim-level support rates.

---

## Key Takeaways

Before moving on, verify you can answer these without looking anything up:

1. What are the eight stages of a RAG pipeline, and which run offline vs online?

2. Why does preprocessing quality set the ceiling for the entire pipeline?

3. What are the tradeoffs between fixed-size, semantic, and recursive chunking? When would
   you choose each?

4. What is chunk overlap, and what problem does it solve? What does it cost?

5. How does HyDE work, and why is a hypothetical answer closer in embedding space to
   relevant documents than the original query?

6. What is the context budget problem? What happens when you retrieve too many chunks?
   Too few?

7. Why must retrieval and generation quality be evaluated independently?

8. Name three RAG failure modes and the pipeline stage responsible for each.

9. How does the BFS depth rule (depth 1/2/3) relate to automated retrieval in a RAG
   pipeline?

10. What is shadow validation in the context of RAG, and how do you detect it?

---

## Recommended Reading

- **Lewis et al. (2020).** "Retrieval-Augmented Generation for Knowledge-Intensive NLP
  Tasks." NeurIPS 2020. The paper that named the pattern. The specific implementation
  (DPR + BART) is historical; the conceptual framework remains current.
  https://arxiv.org/abs/2005.11401

- **Gao et al. (2022).** "Precise Zero-Shot Dense Retrieval without Relevance Labels"
  (HyDE). Read Section 2 for the core insight and Section 4 for empirical results.
  https://arxiv.org/abs/2212.10496

- **Manning et al. (2008).** "Introduction to Information Retrieval." Free online.
  Chapters 8 (evaluation) and 9 (query expansion) are directly relevant.
  https://nlp.stanford.edu/IR-book/

- **RAGAS documentation.** https://docs.ragas.io/ - Standardized RAG evaluation metrics.

- **Barnett et al. (2024).** "Seven Failure Points When Engineering a RAG System."
  Systematic analysis of where RAG pipelines break.

- **LangChain RAG tutorial.** https://python.langchain.com/docs/tutorials/rag/ - The
  framework approach. Read after understanding the mechanisms in this step.

---

## What to Read Next

**Step 4: Advanced Retrieval Patterns** - This step used single-stage dense retrieval:
embed the query, search the index, return top-k. Step 4 covers what happens when that is
not enough. Hybrid search (BM25 + dense), cross-encoder reranking, parent document
retrieval, and multi-index strategies. These are the techniques that move a RAG system from
"works on demos" to "works on real workloads." If your pipeline from the challenges has
retrieval quality problems, Step 4 provides the tools to fix them.

