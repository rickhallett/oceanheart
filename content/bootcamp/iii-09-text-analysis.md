+++
title = "Text Analysis Basics"
date = "2026-03-10"
description = "String similarity, TF-IDF, embedding-based similarity, simple classification, diffing."
tags = ["text", "analysis", "nlp", "bootcamp"]
step = 9
tier = 3
estimate = "3-4 hours"
bootcamp = 3
+++

Step 9 of 10 in Bootcamp III: Operational Analytics.

---

## Why This Step Exists

Agents produce text. Reviews, recommendations, explanations, code comments, commit messages, structured findings. Comparing this text across models, across runs, or against a reference is a recurring operational task. When `bin/triangulate` matches findings from three independent code reviews, it uses string similarity at its core - `SequenceMatcher` with a weighted composite score (`bin/triangulate:180`). Understanding what that algorithm does, where it works, and where it fails is the difference between using the tool and improving the tool.

This step covers the pragmatic text analysis toolkit: string similarity, TF-IDF, embedding-based comparison, simple classification, keyword extraction, and diffing. The escalation path is deliberate: start with string similarity, upgrade to TF-IDF when wording varies, upgrade to embeddings when meaning diverges from vocabulary. Each level costs more (compute, complexity, dependencies) and solves a different failure mode of the previous level. The cheapest method that works is the right method.

> **FIELD MATURITY:** Text analysis for agent output comparison is an emerging practice. String similarity algorithms are well-established (SequenceMatcher has been in Python's standard library since 1993). TF-IDF is a 50-year-old information retrieval technique. But applying these tools to compare structured agent review outputs across models - deciding whether two findings from different LLMs describe the same bug - has no settled conventions. The `bin/triangulate` script is one approach. This step equips you to evaluate it and build alternatives.

---

## Table of Contents

1. [String Similarity](#1-string-similarity) (~40 min)
2. [TF-IDF](#2-tf-idf) (~30 min)
3. [Embedding-Based Similarity](#3-embedding-based-similarity) (~30 min)
4. [Simple Text Classification](#4-simple-text-classification) (~30 min)
5. [Keyword and Pattern Extraction](#5-keyword-and-pattern-extraction) (~25 min)
6. [Diffing and Change Detection](#6-diffing-and-change-detection) (~25 min)
7. [Challenges](#7-challenges) (~60-90 min)
8. [Key Takeaways](#key-takeaways)
9. [Recommended Reading](#recommended-reading)
10. [What to Read Next](#what-to-read-next)

---

## 1. String Similarity

*Estimated time: 40 minutes*

String similarity answers a narrow question: how similar are two strings as sequences of characters? This is distinct from semantic similarity (do they mean the same thing?) and structural similarity (do they describe the same entity?). String similarity is the cheapest, fastest, and most predictable of the three. It is also the most brittle. When it works, nothing else is needed.

### SequenceMatcher

Python's `difflib.SequenceMatcher` computes the ratio of matching characters between two strings. It finds the longest common subsequences, recursively matches the remaining non-matching regions, and reports the ratio as `2.0 * M / T` where `M` is the number of matching characters and `T` is the total characters in both strings.

```python
from difflib import SequenceMatcher

def similarity(a: str, b: str) -> float:
  """String similarity ratio between two strings."""
  return SequenceMatcher(None, a.lower(), b.lower()).ratio()

# Identical strings
similarity("parseValidBody catches all exceptions", "parseValidBody catches all exceptions")
# 1.0

# Similar strings
similarity("parseValidBody catches all exceptions as 400", "parseValidBody catches exceptions as 400")
# 0.953...

# Different strings, same meaning
similarity("error handling is too broad", "exception catching is overly permissive")
# 0.35...  (low - vocabulary diverged)
```

The first argument to `SequenceMatcher` is `isjunk` - a callable that identifies characters to ignore during matching. Passing `None` means no characters are treated as junk. Some implementations pass `lambda x: x == " "` to skip space matching, but this changes the semantics in non-obvious ways. The `bin/triangulate` script passes `None` (`bin/triangulate:157`).

### How triangulate Uses SequenceMatcher

The `bin/triangulate` script matches findings across model reviews using a weighted composite score. The matching algorithm lives in `compute_pairwise_scores()` (`bin/triangulate:160-187`):

```python
file_sim = similarity(f_i.get("file", ""), f_j.get("file", ""))
title_sim = similarity(f_i.get("title", ""), f_j.get("title", ""))
combined = 0.3 * file_sim + 0.7 * title_sim
```

The weights encode a design decision: **title similarity matters more than file path similarity**. Two findings about the same file but with unrelated titles (score: 0.3 * 1.0 + 0.7 * 0.0 = 0.3) will not match. Two findings with similar titles but different files (score: 0.3 * 0.0 + 0.7 * 1.0 = 0.7) will match. This makes sense because models frequently describe the same bug in different words, and the title carries more semantic content than the file path.

The match threshold is 0.6 (default). A combined score below 0.6 means the findings are treated as unrelated. The algorithm is greedy best-first: pairwise scores are sorted descending, and each finding is assigned to at most one group, with at most one finding per review per group (`bin/triangulate:190-318`).

```python
# What the 0.6 threshold means in practice:
# If file paths are identical (file_sim=1.0):
#   combined = 0.3 * 1.0 + 0.7 * title_sim >= 0.6
#   title_sim >= (0.6 - 0.3) / 0.7 = 0.43
#   Titles need only ~43% character overlap

# If file paths are completely different (file_sim=0.0):
#   combined = 0.3 * 0.0 + 0.7 * title_sim >= 0.6
#   title_sim >= 0.6 / 0.7 = 0.857
#   Titles need ~86% character overlap
```

This asymmetry is intentional. When two models report on the same file, weak title similarity is enough to suspect a match. When files differ, you need strong title evidence.

> **AGENTIC GROUNDING:** The `bin/triangulate` matching algorithm is the core of the cross-model convergence analysis. If the threshold is too low, unrelated findings are grouped together and convergence rates are inflated. If the threshold is too high, related findings are missed and the single-model count rises. The `--match-threshold` flag lets you tune this, and the `match_diagnostics` section in the metrics output reports average, min, and max confidence across matched groups. Examining findings near the 0.6 boundary tells you whether the threshold is appropriate for your data.

### Levenshtein Distance

Levenshtein distance counts the minimum number of single-character edits (insertions, deletions, substitutions) needed to transform one string into another. It is useful for typo detection and near-duplicate identification, where the strings differ by a few characters rather than by phrasing.

```python
# Levenshtein distance is not in the standard library.
# Install: uv pip install python-Levenshtein
# Or use the pure-Python editdistance package.

# Manual implementation for understanding:
def levenshtein(a: str, b: str) -> int:
  """Minimum edit distance between two strings."""
  if len(a) < len(b):
    return levenshtein(b, a)
  if len(b) == 0:
    return len(a)
  prev_row = range(len(b) + 1)
  for i, ca in enumerate(a):
    curr_row = [i + 1]
    for j, cb in enumerate(b):
      # Insert, delete, or substitute
      cost = 0 if ca == cb else 1
      curr_row.append(min(
        curr_row[j] + 1,       # insert
        prev_row[j + 1] + 1,   # delete
        prev_row[j] + cost,    # substitute
      ))
    prev_row = curr_row
  return prev_row[-1]

levenshtein("parseValidBody", "parseValidbody")
# 1 (one substitution: B -> b)

levenshtein("lib/auth/login.ts", "lib/auth/logn.ts")
# 1 (one deletion: i)
```

To convert Levenshtein distance to a similarity ratio (0.0 to 1.0), normalize by the length of the longer string:

```python
def levenshtein_ratio(a: str, b: str) -> float:
  dist = levenshtein(a, b)
  max_len = max(len(a), len(b))
  return 1.0 - (dist / max_len) if max_len > 0 else 1.0
```

**When to use Levenshtein over SequenceMatcher:** Levenshtein is better for comparing short strings (identifiers, file paths, variable names) where edit distance has a clear physical meaning. SequenceMatcher is better for longer strings (titles, descriptions) where subsequence matching captures phrase-level overlap. For `bin/triangulate`'s use case - matching finding titles and file paths - SequenceMatcher is the more natural choice because titles are phrases, not identifiers.

### Jaccard Similarity

Jaccard similarity treats strings as sets of tokens and measures the overlap. It ignores word order entirely, which is a strength when the same information is expressed with different phrasing, and a weakness when word order carries meaning.

```python
def jaccard(a: str, b: str) -> float:
  """Jaccard similarity on word-level tokens."""
  tokens_a = set(a.lower().split())
  tokens_b = set(b.lower().split())
  if not tokens_a and not tokens_b:
    return 1.0
  intersection = tokens_a & tokens_b
  union = tokens_a | tokens_b
  return len(intersection) / len(union)

jaccard("error handling is too broad", "broad error handling detected")
# 0.50 (3 shared words / 6 unique words)

jaccard("parseValidBody catches all exceptions as 400",
        "all exceptions caught as 400 in parseValidBody")
# 0.71 (5 shared / 7 unique)
```

Jaccard does not care about word order. "Error handling is broad" and "Broad is handling error" score the same. This makes it useful as a bag-of-words complement to SequenceMatcher, which is order-sensitive.

### When to Use Each

| Method | Best for | Limitation | Cost |
|--------|----------|------------|------|
| SequenceMatcher | Phrase-level comparison, ordered text | Fails when vocabulary differs | O(n*m) |
| Levenshtein | Typo detection, short identifiers | Meaningless on long strings | O(n*m) |
| Jaccard | Bag-of-words overlap, reordered text | Ignores word order and frequency | O(n+m) |

Start with SequenceMatcher. If you find false negatives caused by word reordering, add Jaccard as a secondary signal. If you need edit-distance semantics (how many keystrokes to fix this?), use Levenshtein.

> **HISTORY:** The SequenceMatcher algorithm is based on Ratcliff and Obershelp's 1988 "gestalt pattern matching" algorithm. John W. Ratcliff published it in Dr. Dobb's Journal. The Python implementation in `difflib` was written by Tim Peters and has been in the standard library since Python 1.x. The name "SequenceMatcher" is Peters' - Ratcliff called it "pattern matching." The algorithm's quadratic worst case is rarely hit on the string lengths typical in finding titles (under 200 characters), which is why `bin/triangulate` uses it without concern for performance.

---

## 2. TF-IDF

*Estimated time: 30 minutes*

String similarity compares two strings. TF-IDF compares a document to a corpus. The question shifts from "how similar are these two strings?" to "what terms in this document are distinctive relative to all other documents?"

TF-IDF stands for Term Frequency - Inverse Document Frequency. A term's TF-IDF score is high when it appears frequently in one document (high TF) but rarely across all documents (high IDF). The word "the" has high TF everywhere and low IDF, so its TF-IDF score is near zero. The word "parseValidBody" might appear in one finding but not in any others, giving it a high TF-IDF score in that document.

### TF-IDF in 5 Lines

```python
from sklearn.feature_extraction.text import TfidfVectorizer

documents = [
  "parseValidBody catches all exceptions as 400",
  "error handling in parseValidBody is too broad",
  "missing input validation on user-supplied JSON",
  "SQL injection risk in query builder module",
]

vectorizer = TfidfVectorizer()
tfidf_matrix = vectorizer.fit_transform(documents)
feature_names = vectorizer.get_feature_names_out()
```

The result is a sparse matrix where each row is a document and each column is a term. The value at `[i, j]` is the TF-IDF score of term `j` in document `i`.

```python
import pandas as pd

# Convert to a DataFrame for inspection
df = pd.DataFrame(
  tfidf_matrix.toarray(),
  columns=feature_names,
  index=[f"doc_{i}" for i in range(len(documents))],
)

# Most distinctive terms per document
for i, doc in enumerate(documents):
  row = df.iloc[i]
  top_terms = row.nlargest(3)
  print(f"Doc {i}: {list(top_terms.index)}")

# Doc 0: ['catches', '400', 'exceptions']
# Doc 1: ['broad', 'handling', 'error']
# Doc 2: ['json', 'supplied', 'user']
# Doc 3: ['sql', 'injection', 'query']
```

Notice that "parseValidBody" does not dominate documents 0 and 1, because it appears in both - the IDF penalizes shared terms. The distinctive terms are the ones unique to each document.

### Computing Similarity with TF-IDF

TF-IDF vectors can be compared using cosine similarity. This measures the angle between two vectors in term-space, ignoring magnitude (document length).

```python
from sklearn.metrics.pairwise import cosine_similarity

# Similarity matrix: all pairs
sim_matrix = cosine_similarity(tfidf_matrix)

# Documents 0 and 1 share "parseValidBody" context
print(f"Doc 0 vs Doc 1: {sim_matrix[0, 1]:.3f}")  # ~0.12
print(f"Doc 0 vs Doc 2: {sim_matrix[0, 2]:.3f}")  # ~0.00
print(f"Doc 2 vs Doc 3: {sim_matrix[2, 3]:.3f}")  # ~0.00
```

The TF-IDF cosine similarity between documents 0 and 1 is low despite sharing "parseValidBody" because TF-IDF downweights terms that appear across multiple documents. This is the opposite behavior from SequenceMatcher, which would give a higher score due to the shared substring.

### When TF-IDF Beats String Similarity

TF-IDF shines when the same concept is expressed with different surface forms but shared vocabulary:

```python
texts = [
  "The error handler catches SyntaxError and non-SyntaxError alike",
  "SyntaxError and other exception types all route to the same 400 handler",
  "Memory leak in WebSocket connection pool",
]

vectorizer = TfidfVectorizer()
matrix = vectorizer.fit_transform(texts)
sim = cosine_similarity(matrix)

# String similarity:
from difflib import SequenceMatcher
ss = SequenceMatcher(None, texts[0].lower(), texts[1].lower()).ratio()
print(f"SequenceMatcher: {ss:.3f}")  # ~0.39

# TF-IDF cosine similarity:
print(f"TF-IDF cosine:   {sim[0, 1]:.3f}")  # ~0.28
```

Both methods recognize texts 0 and 1 as more related than 0 and 2. The advantage of TF-IDF appears when you have a corpus - you can rank all documents by relevance to a query, weight terms by distinctiveness, and identify the vocabulary that separates groups.

### TfidfVectorizer Parameters That Matter

```python
vectorizer = TfidfVectorizer(
  max_df=0.8,       # ignore terms in >80% of documents (stop words by frequency)
  min_df=2,         # ignore terms in fewer than 2 documents (too rare to be useful)
  ngram_range=(1, 2),  # include bigrams ("error handling", "sql injection")
  stop_words="english",  # remove English stop words
  max_features=1000,  # limit vocabulary size
)
```

For agent output analysis with small corpora (10-50 findings), the defaults are usually fine. The `ngram_range=(1, 2)` parameter is worth enabling when multi-word terms carry meaning - "error handling" is more informative than "error" and "handling" separately.

> **AGENTIC GROUNDING:** When three models review the same codebase, their findings use different vocabulary. Model A might say "overly broad exception handling" while Model B says "catch-all error handler swallows specific exceptions." TF-IDF cosine similarity can quantify the vocabulary overlap between models - which two models use the most similar language? Which model's vocabulary is the most distinct? This is a diagnostic signal: vocabulary convergence suggests the models are seeing similar patterns; vocabulary divergence suggests they are analyzing different aspects of the code.

---

## 3. Embedding-Based Similarity

*Estimated time: 30 minutes*

String similarity compares character sequences. TF-IDF compares term distributions. Embeddings compare meaning. An embedding is a dense vector (typically 256-3072 dimensions) that encodes semantic content. Two sentences with the same meaning but different words will have similar embedding vectors.

### The Escalation Path

The three levels form an escalation:

1. **String similarity** - works when the wording is similar. Cheap, no dependencies, deterministic.
2. **TF-IDF** - works when key terms overlap but phrasing differs. Cheap, scikit-learn only, deterministic.
3. **Embeddings** - works when meaning is similar but words are completely different. Requires either an API call (OpenAI, Anthropic) or a local model (`sentence-transformers`). More expensive, non-deterministic across providers.

Start at level 1. Upgrade only when the simpler method produces false negatives you care about.

### Cosine Similarity on Pre-Computed Vectors

If you already have embedding vectors (from an API, from a database, or from a prior computation), computing similarity is straightforward:

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Suppose you have embeddings from an API (simplified: 4-dimensional)
embeddings = np.array([
  [0.1, 0.8, 0.3, 0.2],  # "error handling is too broad"
  [0.15, 0.75, 0.35, 0.18],  # "exception catching is overly permissive"
  [0.9, 0.1, 0.05, 0.8],  # "SQL injection in query builder"
])

sim = cosine_similarity(embeddings)
print(f"Semantic similar:    {sim[0, 1]:.3f}")  # high (~0.99)
print(f"Semantically different: {sim[0, 2]:.3f}")  # low (~0.26)
```

In practice, embeddings have hundreds or thousands of dimensions, and the similarity scores are more nuanced. The key insight: cosine similarity on embeddings captures meaning that string-level methods miss entirely.

### Obtaining Embeddings

There are two practical paths for obtaining embeddings. Both produce vectors you can store and compare:

**Path A: API-based (no local model)**

```python
# OpenAI embeddings (requires openai package and API key)
# from openai import OpenAI
# client = OpenAI()
# response = client.embeddings.create(
#   input=["error handling is too broad"],
#   model="text-embedding-3-small",
# )
# vector = response.data[0].embedding  # list of 1536 floats
```

**Path B: Local model (no API dependency)**

```python
# sentence-transformers (requires torch, ~500MB model download)
# from sentence_transformers import SentenceTransformer
# model = SentenceTransformer("all-MiniLM-L6-v2")
# vectors = model.encode(["error handling is too broad"])
# vector = vectors[0]  # numpy array of 384 floats
```

Both paths are optional dependencies. This step does not require you to install either. The exercises use pre-computed or synthetic vectors to demonstrate the mechanics without the setup cost.

### When Embeddings Help (and When They Do Not)

Embeddings solve the vocabulary mismatch problem: "error handling too broad" and "exception catching overly permissive" express the same concern with zero word overlap. SequenceMatcher gives ~0.35, Jaccard gives ~0.0, but embeddings give ~0.85.

Embeddings do not help when:
- The strings are already similar (string methods are cheaper and equally accurate)
- The distinction you care about is structural, not semantic (same file path vs different file path)
- The embedding model was not trained on your domain (code review terminology may not be well-represented in general-purpose models)
- You need deterministic, reproducible results (different API calls can return slightly different vectors)

> **AGENTIC GROUNDING:** The `bin/triangulate` script uses SequenceMatcher, not embeddings. This is a deliberate choice: embeddings add an API dependency, a cost per call, and non-determinism. For matching structured findings with explicit titles and file paths, string similarity is sufficient. But if you observe that triangulate consistently misses matches where models describe the same bug in completely different words (convergence rate seems artificially low), embedding-based matching is the natural upgrade. You would replace the `similarity()` function at `bin/triangulate:155` with an embedding cosine similarity, keeping the 0.3/0.7 weighting and 0.6 threshold, and compare convergence rates.

---

## 4. Simple Text Classification

*Estimated time: 30 minutes*

Classification assigns a label to a text. Given a code review finding, is it about security, error handling, style, or performance? Given a slopodar entry, can you predict its domain from its description?

### Keyword Rules

The simplest classifier uses keyword matching. No ML, no training data, no model. Just a dictionary of domain-to-keywords:

```python
# Keyword classifier for slopodar domains
DOMAIN_KEYWORDS = {
  "prose-style": [
    "sentence", "paragraph", "rhetorical", "word", "prose",
    "cadence", "rhythm", "noun", "verb", "text", "phrasing",
  ],
  "relationship-sycophancy": [
    "flattery", "praise", "apologise", "sorry", "blame",
    "compliance", "sycophantic", "agree", "encourage",
  ],
  "governance-process": [
    "guardrail", "governance", "rule", "policy", "enforcement",
    "audit", "process", "control", "gate",
  ],
  "code": [
    "function", "variable", "SQL", "return", "ledger",
    "audit trail", "code", "implementation",
  ],
  "analytical-measurement": [
    "metric", "measure", "score", "baseline", "demographic",
    "data", "analysis", "construct",
  ],
}

def classify_keyword(text: str) -> str:
  """Classify text by keyword match count."""
  text_lower = text.lower()
  scores = {}
  for domain, keywords in DOMAIN_KEYWORDS.items():
    scores[domain] = sum(1 for kw in keywords if kw in text_lower)
  if max(scores.values()) == 0:
    return "unknown"
  return max(scores, key=scores.get)
```

### Testing Against slopodar.yaml

The slopodar taxonomy has 28 entries with known domain labels. This makes it a ready-made test set:

```python
import yaml

with open("docs/internal/slopodar.yaml") as f:
  data = yaml.safe_load(f)

patterns = data["patterns"]
correct = 0
total = 0

for pattern in patterns:
  # Use description + detect + instead as the text
  text = " ".join([
    pattern.get("description", ""),
    pattern.get("detect", ""),
    pattern.get("instead", ""),
  ])
  predicted = classify_keyword(text)
  actual = pattern["domain"]
  match = predicted == actual
  correct += int(match)
  total += 1
  if not match:
    print(f"MISS: {pattern['id']:30s} actual={actual:25s} predicted={predicted}")

print(f"\nAccuracy: {correct}/{total} ({correct/total:.0%})")
```

A well-tuned keyword classifier typically achieves 50-70% accuracy on this dataset. The misses are informative: they reveal where domain boundaries are ambiguous or where the keywords are too narrow.

### LogisticRegression on TF-IDF

When keyword rules plateau, the next step is a simple ML classifier. Logistic regression on TF-IDF features is the standard baseline for text classification. It is not deep learning - it is a linear model that learns which terms predict which classes.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
import yaml

# Load slopodar
with open("docs/internal/slopodar.yaml") as f:
  data = yaml.safe_load(f)

patterns = data["patterns"]

# Prepare text (concatenate description + detect + instead)
texts = []
labels = []
for p in patterns:
  text = " ".join([
    p.get("description", ""),
    p.get("detect", ""),
    p.get("instead", ""),
  ])
  texts.append(text)
  labels.append(p["domain"])

# TF-IDF features
vectorizer = TfidfVectorizer(max_features=200, ngram_range=(1, 2))
X = vectorizer.fit_transform(texts)

# Logistic regression with cross-validation
model = LogisticRegression(max_iter=1000, random_state=42)
scores = cross_val_score(model, X, labels, cv=3, scoring="accuracy")
print(f"Cross-val accuracy: {scores.mean():.2f} (+/- {scores.std():.2f})")
```

With 28 samples and 7+ classes, this is a very small dataset. Cross-validation scores will have high variance. The point is not to build a production classifier - it is to see how TF-IDF features map to domain labels, which features the model relies on, and where the classification boundary is unclear.

```python
# Inspect which terms predict which domains
model.fit(X, labels)
for i, domain in enumerate(model.classes_):
  coef = model.coef_[i]
  top_indices = coef.argsort()[-5:][::-1]
  top_terms = [vectorizer.get_feature_names_out()[j] for j in top_indices]
  print(f"{domain:30s} -> {top_terms}")
```

> **SLOPODAR:** Building a classifier for the slopodar taxonomy is a useful exercise, but do not mistake classification accuracy for detection capability. The slopodar entries describe patterns that are hard to detect precisely because they pass surface-level checks. A keyword classifier that correctly labels "tally-voice" by matching "enumeration" and "rhetorical" has not learned to detect tally voice in the wild - it has learned to classify a human-written description of tally voice. The map is not the territory.

---

## 5. Keyword and Pattern Extraction

*Estimated time: 25 minutes*

Extraction answers a different question from classification. Classification asks "what category does this text belong to?" Extraction asks "what structured information can I pull out of this text?"

### Regex for Structured Patterns

Agent outputs often contain structured data embedded in prose: file paths, line numbers, severity labels, function names. Regex extracts these:

```python
import re

finding_text = """
The parseValidBody function in lib/auth/validate.ts:42 catches all exceptions
as SyntaxError, returning a 400 status code. Non-parse errors (e.g., database
timeouts at lib/db/pool.ts:118) are incorrectly classified as client errors.
Severity: high. Watchdog: WD-SH.
"""

# Extract file:line references
file_refs = re.findall(r'[\w/.-]+\.\w+:\d+', finding_text)
print(file_refs)
# ['lib/auth/validate.ts:42', 'lib/db/pool.ts:118']

# Extract severity
severity = re.search(r'[Ss]everity:\s*(\w+)', finding_text)
print(severity.group(1) if severity else "not found")
# 'high'

# Extract watchdog category
watchdog = re.search(r'(?:Watchdog|WD)[-:]?\s*(WD-\w+)', finding_text)
print(watchdog.group(1) if watchdog else "not found")
# 'WD-SH'

# Extract function names (camelCase or snake_case identifiers)
functions = re.findall(r'\b[a-z][a-zA-Z]*(?:[A-Z][a-zA-Z]*)+\b', finding_text)
print(functions)
# ['parseValidBody']
```

### Counter-Based Keyword Frequency

When you have a collection of text (all findings from a model, all slopodar descriptions), counting word frequency reveals the dominant themes:

```python
from collections import Counter
import re
import yaml

with open("docs/internal/slopodar.yaml") as f:
  data = yaml.safe_load(f)

# Collect all description text
all_text = " ".join(
  p.get("description", "") for p in data["patterns"]
)

# Tokenize and count (lowercased, alpha-only tokens, 4+ chars)
tokens = re.findall(r'\b[a-z]{4,}\b', all_text.lower())
counts = Counter(tokens)

# Remove common English stop words manually
stop_words = {"that", "this", "with", "from", "have", "been", "when",
              "what", "which", "their", "about", "into", "than",
              "does", "they", "each", "more", "also", "just", "will"}
for sw in stop_words:
  counts.pop(sw, None)

print("Top 15 terms in slopodar descriptions:")
for term, count in counts.most_common(15):
  print(f"  {term:20s} {count}")
```

This reveals the vocabulary of the taxonomy. Terms like "pattern," "model," "sentence," "finding" tell you what the slopodar is fundamentally about at the word level.

### Extracting Themes from Agent Findings

Combining TF-IDF with frequency counting across groups produces a theme analysis:

```python
from sklearn.feature_extraction.text import TfidfVectorizer
import yaml

with open("docs/internal/slopodar.yaml") as f:
  data = yaml.safe_load(f)

# Group descriptions by domain
from collections import defaultdict
domain_texts = defaultdict(list)
for p in data["patterns"]:
  domain_texts[p["domain"]].append(p.get("description", ""))

# Concatenate per domain
domain_docs = {d: " ".join(texts) for d, texts in domain_texts.items()}

# TF-IDF across domains
vectorizer = TfidfVectorizer(max_features=100, stop_words="english")
domains = list(domain_docs.keys())
matrix = vectorizer.fit_transform([domain_docs[d] for d in domains])
terms = vectorizer.get_feature_names_out()

# Top 5 distinctive terms per domain
import numpy as np
for i, domain in enumerate(domains):
  row = matrix[i].toarray().flatten()
  top_idx = row.argsort()[-5:][::-1]
  top_terms = [(terms[j], round(row[j], 3)) for j in top_idx if row[j] > 0]
  print(f"{domain:30s}: {top_terms}")
```

> **AGENTIC GROUNDING:** Keyword extraction is how you audit what an agent is actually talking about versus what it claims to be talking about. If a model is asked to review code for security issues but its findings are dominated by style terms ("naming," "formatting," "convention"), the keywords reveal the mismatch. This is not a failure of the model - it may legitimately find more style issues than security issues - but it is a signal that the review prompt may need refinement.

---

## 6. Diffing and Change Detection

*Estimated time: 25 minutes*

Diffing compares two versions of a text and shows what changed. This is fundamental to version control (git diff), but it applies equally to agent outputs. When you update a prompt and re-run a review, the diff between the old and new output tells you what the prompt change actually affected.

### Text Diffing with difflib

Python's `difflib` module provides several diff formats. `unified_diff` is the most familiar (it matches `git diff` output):

```python
import difflib

old_review = """Finding F-01: parseValidBody catches all exceptions as 400.
Severity: high
Recommendation: Add SyntaxError guard, return 500 for non-parse errors.
""".splitlines(keepends=True)

new_review = """Finding F-01: parseValidBody catches all exceptions as 400.
Severity: critical
Recommendation: Add SyntaxError guard, return 500 for non-parse errors.
Additional context: This masks database connection failures.
""".splitlines(keepends=True)

diff = difflib.unified_diff(old_review, new_review,
                            fromfile="review_v1.md",
                            tofile="review_v2.md")
print("".join(diff))
```

Output:

```diff
--- review_v1.md
+++ review_v2.md
@@ -1,3 +1,4 @@
 Finding F-01: parseValidBody catches all exceptions as 400.
-Severity: high
+Severity: critical
 Recommendation: Add SyntaxError guard, return 500 for non-parse errors.
+Additional context: This masks database connection failures.
```

### Structured Diff on YAML/JSON

When agent outputs are structured (YAML findings, JSON metrics), text diff is noisy. A field that moved from line 5 to line 12 shows up as a deletion and an addition, even though the content is identical. Structured diff compares the data, not the serialization:

```python
import yaml
import json

def structured_diff(old: dict, new: dict, path: str = "") -> list[str]:
  """Compare two dicts/lists recursively. Return list of change descriptions."""
  changes = []

  if type(old) != type(new):
    changes.append(f"TYPE CHANGED at {path or '/'}: {type(old).__name__} -> {type(new).__name__}")
    return changes

  if isinstance(old, dict):
    all_keys = set(old.keys()) | set(new.keys())
    for key in sorted(all_keys):
      child_path = f"{path}/{key}"
      if key not in old:
        changes.append(f"ADDED {child_path}: {new[key]}")
      elif key not in new:
        changes.append(f"REMOVED {child_path}: {old[key]}")
      elif old[key] != new[key]:
        if isinstance(old[key], (dict, list)):
          changes.extend(structured_diff(old[key], new[key], child_path))
        else:
          changes.append(f"CHANGED {child_path}: {old[key]} -> {new[key]}")

  elif isinstance(old, list):
    for i in range(max(len(old), len(new))):
      child_path = f"{path}[{i}]"
      if i >= len(old):
        changes.append(f"ADDED {child_path}: {new[i]}")
      elif i >= len(new):
        changes.append(f"REMOVED {child_path}: {old[i]}")
      elif old[i] != new[i]:
        if isinstance(old[i], (dict, list)):
          changes.extend(structured_diff(old[i], new[i], child_path))
        else:
          changes.append(f"CHANGED {child_path}: {old[i]} -> {new[i]}")

  return changes
```

Using it:

```python
old_finding = {
  "id": "F-01",
  "severity": "high",
  "title": "parseValidBody catches all exceptions",
  "watchdog": "WD-SH",
}

new_finding = {
  "id": "F-01",
  "severity": "critical",
  "title": "parseValidBody catches all exceptions as 400",
  "watchdog": "WD-SH",
  "slopodar": "none",
}

for change in structured_diff(old_finding, new_finding):
  print(change)

# CHANGED /severity: high -> critical
# ADDED /slopodar: none
# CHANGED /title: parseValidBody catches all exceptions -> parseValidBody catches all exceptions as 400
```

This is far more useful than text diff for structured data. You see exactly which fields changed, without noise from formatting or field reordering.

### Quantifying Change

Beyond listing changes, you can quantify how much changed:

```python
def change_summary(old: dict, new: dict) -> dict:
  """Summarize changes between two structured objects."""
  changes = structured_diff(old, new)
  added = sum(1 for c in changes if c.startswith("ADDED"))
  removed = sum(1 for c in changes if c.startswith("REMOVED"))
  modified = sum(1 for c in changes if c.startswith("CHANGED"))
  return {
    "total_changes": len(changes),
    "added": added,
    "removed": removed,
    "modified": modified,
    "change_rate": len(changes) / max(len(old), len(new), 1),
  }
```

> **AGENTIC GROUNDING:** Structured diffing is how you measure the impact of a prompt change on agent output. If you modify the darkcat review instructions and re-run the review, the structured diff between old and new findings tells you exactly what changed: did severity ratings shift? Did new findings appear? Did existing findings get more detailed recommendations? Text diff on the markdown output is noisy and hard to parse programmatically. Structured diff on the parsed YAML is clean, countable, and composable with the metrics pipeline.

> **HISTORY:** The `diff` utility was written by Douglas McIlroy at Bell Labs and first appeared in the Fifth Edition of Unix (1974). McIlroy's algorithm was based on the longest common subsequence problem. The "unified diff" format (the `---`/`+++`/`@@` notation) was introduced later in the BSD diff implementation. Python's `difflib` module, written by Tim Peters, implements multiple diff strategies including SequenceMatcher (used for matching) and unified_diff (used for display). The same SequenceMatcher that `bin/triangulate` uses for finding similarity is the engine behind `difflib.unified_diff`.

---

## Challenge: Implement the Triangulate Matcher

**Estimated time: 25 minutes**

**Goal:** Reimplement the core matching algorithm from `bin/triangulate` and verify it produces the same results on test data.

Create a Python script that:

1. Defines a `similarity()` function using `SequenceMatcher`
2. Takes two lists of findings (dicts with `title`, `file`, `severity` keys)
3. Computes the weighted composite score: `0.3 * file_sim + 0.7 * title_sim`
4. Uses greedy best-first assignment with a 0.6 threshold
5. Returns matched pairs with confidence scores

Test data:

```python
review_a = [
  {"title": "parseValidBody catches all exceptions as 400", "file": "lib/auth/validate.ts", "severity": "high"},
  {"title": "Missing rate limiting on login endpoint", "file": "lib/auth/login.ts", "severity": "medium"},
  {"title": "SQL injection in search query", "file": "lib/search/query.ts", "severity": "critical"},
]

review_b = [
  {"title": "Broad exception handling in parseValidBody", "file": "lib/auth/validate.ts", "severity": "high"},
  {"title": "No rate limit on authentication route", "file": "lib/auth/login.ts", "severity": "high"},
  {"title": "Unused import in test file", "file": "lib/test/helpers.ts", "severity": "low"},
]
```

**Verification:**
- Findings about parseValidBody should match (same file, similar title)
- Findings about rate limiting should match (same file directory, similar concept)
- SQL injection and unused import should not match (different everything)
- Each matched pair should have a confidence score between 0.6 and 1.0

<details>
<summary>Hints</summary>

The core loop from `bin/triangulate:224-265`:
1. Compute all pairwise scores between findings from different reviews
2. Sort scores descending
3. For each score >= threshold, if neither finding is assigned, create a new group
4. If one finding is in a group and the other's review is not represented, add it

The simplest version skips the group-admission check and just does pairwise assignment.

</details>

**Extension:** Modify the weighting from 0.3/0.7 to other ratios (0.5/0.5, 0.1/0.9). How does the match set change? Which weighting produces the most intuitive matches for your test data?

---

## Challenge: TF-IDF Distinctive Terms

**Estimated time: 20 minutes**

**Goal:** Use TF-IDF to find the most distinctive vocabulary in each slopodar domain.

```python
import yaml
from collections import defaultdict
from sklearn.feature_extraction.text import TfidfVectorizer

with open("docs/internal/slopodar.yaml") as f:
  data = yaml.safe_load(f)

# 1. Group all text (description + detect + instead) by domain
domain_texts = defaultdict(list)
for p in data["patterns"]:
  text = " ".join([
    p.get("description", ""),
    p.get("detect", ""),
    p.get("instead", ""),
  ])
  domain_texts[p["domain"]].append(text)

# 2. Concatenate per domain into one document per domain
# 3. Fit a TfidfVectorizer on the domain-level documents
# 4. For each domain, print the top 5 most distinctive terms
```

**Verification:**
- The `prose-style` domain should surface terms related to writing (sentence, paragraph, rhetorical, word)
- The `code` domain should surface programming terms (function, variable, return, audit)
- The `relationship-sycophancy` domain should surface social terms (flattery, blame, compliance)
- Terms that appear across all domains (like "pattern" or "model") should have low TF-IDF scores

**Extension:** Compute the cosine similarity matrix between domains. Which two domains are most similar in vocabulary? Does this match your intuition about the slopodar taxonomy structure?

---

## Challenge: Classify Slopodar Entries

**Estimated time: 25 minutes**

**Goal:** Build a keyword-based classifier and a LogisticRegression classifier for slopodar domain prediction. Compare their accuracy.

1. Load `docs/internal/slopodar.yaml`
2. Build a keyword classifier using domain-specific keyword lists (you write the lists)
3. Build a LogisticRegression classifier on TF-IDF features
4. Evaluate both using leave-one-out cross-validation (28 samples is too small for train/test split)
5. Print a confusion matrix for each

```python
from sklearn.model_selection import LeaveOneOut, cross_val_predict
from sklearn.metrics import classification_report

# For leave-one-out with LogisticRegression:
loo = LeaveOneOut()
predictions = cross_val_predict(model, X, labels, cv=loo)
print(classification_report(labels, predictions))
```

**Verification:**
- Keyword classifier accuracy should be 40-70%
- LogisticRegression accuracy should be 50-80%
- Both should perform well on `prose-style` (most entries, distinctive vocabulary)
- Both should struggle with `tests` and `commit-workflow` (few entries, less distinctive terms)

<details>
<summary>Hints</summary>

For the keyword classifier, start with the terms you extracted in Challenge 2 as your keyword lists. The TF-IDF distinctive terms for each domain are your best starting keywords.

For LogisticRegression, 28 samples with 7+ classes means some classes have only 1-3 examples. The model will overfit on small classes. This is expected and instructive - it shows why small datasets need simple models or domain knowledge (keyword rules).

</details>

---

## Challenge: Structured Diff of Agent Outputs

**Estimated time: 20 minutes**

**Goal:** Build a structured diff tool that compares two sets of review findings and produces a change summary.

Given two YAML finding lists (representing the same codebase reviewed before and after a prompt change), produce:

1. New findings (in v2 but not matched in v1)
2. Removed findings (in v1 but not matched in v2)
3. Changed findings (matched between v1 and v2, but fields differ)
4. Unchanged findings (matched, all fields identical)

Use SequenceMatcher with the 0.3/0.7 weighting and 0.6 threshold to match findings across versions.

Test data:

```python
v1_findings = [
  {"id": "F-01", "title": "Broad exception handling", "file": "lib/auth/validate.ts", "severity": "high"},
  {"id": "F-02", "title": "Missing input validation", "file": "lib/api/handler.ts", "severity": "medium"},
  {"id": "F-03", "title": "Hardcoded timeout value", "file": "lib/config/defaults.ts", "severity": "low"},
]

v2_findings = [
  {"id": "F-01", "title": "Broad exception handling in parseValidBody", "file": "lib/auth/validate.ts", "severity": "critical"},
  {"id": "F-02", "title": "Missing input validation on JSON body", "file": "lib/api/handler.ts", "severity": "medium"},
  {"id": "F-04", "title": "SQL injection in search endpoint", "file": "lib/search/query.ts", "severity": "critical"},
]
```

**Verification:**
- F-01 should match across versions (same file, similar title) with severity changed from high to critical
- F-02 should match (same file, similar title) with no field changes except title refinement
- F-03 (hardcoded timeout) should be in "removed" - not present in v2
- F-04 (SQL injection) should be in "new" - not present in v1
- Output should include the match confidence for each matched pair

**Extension:** Compute a "review stability score" - the proportion of findings that are unchanged across versions. A high stability score after a prompt change suggests the prompt change had minimal effect.

---

## Key Takeaways

Before moving on, verify you can answer these questions without looking anything up:

1. What is the composite similarity formula used by `bin/triangulate`, and why is title weighted at 0.7 vs file at 0.3?
2. What is the difference between SequenceMatcher, Levenshtein distance, and Jaccard similarity? When is each appropriate?
3. What does the 0.6 match threshold mean in practice when file similarity is 1.0 vs when it is 0.0?
4. In TF-IDF, why does a term that appears in every document get a low score?
5. What problem do embeddings solve that TF-IDF and string similarity cannot?
6. Why does the escalation path (string -> TF-IDF -> embeddings) recommend starting with the simplest method?
7. What accuracy would you expect from a keyword classifier on a 28-entry dataset with 7 classes? Why?
8. When is structured diff (comparing parsed data) better than text diff (comparing serialized strings)?

---

## Recommended Reading

- **Python `difflib` documentation** - the standard library module used by `bin/triangulate`. Read the `SequenceMatcher` class documentation to understand `ratio()`, `get_matching_blocks()`, and `get_opcodes()`.

- **Introduction to Information Retrieval** - Christopher Manning, Prabhakar Raghavan, Hinrich Schutze (2008). Chapters 6 (TF-IDF weighting) and 13 (text classification). Available free online at https://nlp.stanford.edu/IR-book/. The TF-IDF and text classification chapters are exactly what this step covers, with the mathematical foundations.

- **scikit-learn `TfidfVectorizer` documentation** - the parameters, the math, and the relationship to `CountVectorizer`. Pay attention to the `sublinear_tf` parameter (uses `1 + log(tf)` instead of raw term frequency) and `norm` parameter (L2 normalization by default).

- **`bin/triangulate`** - read the source code. The matching algorithm (`compute_pairwise_scores`, `match_findings`) is approximately 130 lines of Python. Understanding it end-to-end is the best text analysis exercise in this bootcamp.

---

## What to Read Next

**Step 10: Notebook-Based Analysis Workflows** - Bootcamp I Step 5.10 introduced Jupyter as a tool. Step 10 covers how to use it effectively for analytical work: organizing notebooks with clear naming conventions, making analyses reproducible, and the notebook-to-script pipeline. The text analysis techniques from this step are the kind of exploratory work that benefits from a notebook environment - iterating on keyword lists, visualizing TF-IDF matrices, comparing classifier results. Step 10 teaches the workflow discipline that keeps that exploration organized and reproducible.

