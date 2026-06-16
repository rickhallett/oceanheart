+++
title = "AI-Augmented Photo Curation Pipeline"
date = "2026-04-05"
description = "Building a resume-safe, multi-pass system that turns 4,700 unsorted iPhone photos into a categorised library — using metadata heuristics, perceptual hashing, and Claude's vision API."
tags = ["agents", "vision", "pipeline", "python", "engineering"]
draft = true
+++

My Photos library had become a junk drawer. 4,691 items spanning six years: travel photos mixed with screenshots of WiFi passwords, AI-generated art alongside blurry pocket shots, receipts next to family portraits. Apple's "Memories" feature kept surfacing a screenshot of a Slack thread next to a sunset in Portugal.

I didn't need to delete everything. I needed to *understand* what I had, sort it, and flag the obvious waste. Manually reviewing 4,700 photos would take days. But throwing every image at an LLM vision API would cost ~$14 and take hours — and most of that spend would be wasted on screenshots and duplicates that metadata alone could catch.

The question became: **what's the cheapest correct pipeline?**

## Architecture: Filter Cheap, Label Expensive

The core insight is a cost funnel. Each stage is more expensive and more capable than the last, and each stage reduces the volume flowing into the next.

```
4,691 photos
    │
    ▼
┌─────────────────────────┐
│  Stage 0: Metadata      │  Free. ~6 minutes.
│  Filter                 │  Screenshots, burst dupes,
│                         │  screen recordings, tiny files
└────────────┬────────────┘
             │ 434 flagged (9.3%)
             ▼
         4,257 survive
             │
             ▼
┌─────────────────────────┐
│  Stage 1: Perceptual    │  Free. Runs inside Stage 0.
│  Deduplication          │  pHash + union-find clustering
└────────────┬────────────┘
             │ 188 near-duplicates flagged
             ▼
┌─────────────────────────┐
│  Stage 2: Claude Vision │  ~$0.003/photo. ~50 min.
│  Taxonomy labelling     │  Category, tags, quality,
│                         │  one-sentence description
└────────────┬────────────┘
             │ 3,335 labelled
             ▼
    15 native Photos.app albums
```

Stage 0 eliminated 434 photos — nearly 10% — before a single API call. The metadata filters are deliberately conservative: Apple's `screenshot` and `screen_recording` flags are reliable, and burst deduplication only removes non-selected, non-key burst frames.

### Perceptual Deduplication

The more interesting part of Stage 0 is perceptual hashing. Rather than comparing files byte-for-byte (which misses resaved or slightly cropped duplicates), every surviving photo gets a perceptual hash via `imagehash.phash`. Photos within a Hamming distance of 6 are grouped using union-find, and all but one representative from each group are flagged.

```python
# Union-find with path compression groups near-duplicates
for i in range(len(keys)):
    for j in range(i + 1, len(keys)):
        if hashes[keys[i]] - hashes[keys[j]] <= threshold:
            union(keys[i], keys[j])
```

This caught 188 near-duplicates that weren't burst photos — things like the same meme saved from two different apps, or a photo that got re-imported during a device migration.

## State Machine: Resume-Safe by Design

The pipeline processes thousands of photos over minutes to hours. Network failures happen. API rate limits hit. The laptop lid closes. I needed something that could crash at any point and resume without re-processing or double-counting.

The answer is a SQLite state database where each photo's UUID is the primary key, and each pipeline stage writes its result as a separate column:

```sql
CREATE TABLE photos (
    uuid TEXT PRIMARY KEY,
    filename TEXT,
    filter_result TEXT,    -- 'passed' | 'flagged' | NULL (pending)
    filter_reason TEXT,    -- 'screenshot' | 'burst_duplicate' | 'perceptual_dup' | ...
    triage_result TEXT,    -- reserved for local vision pre-filter
    label_result TEXT,     -- 'people' | 'travel' | 'saved-art' | 'error' | NULL
    label_confidence REAL,
    label_reason TEXT,     -- full JSON: {category, tags, quality, description}
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

Each stage only queries for rows where its column is `NULL` — meaning "not yet processed". If the process crashes after labelling 500 of 1,000 photos, re-running the same command skips the 500 already done and picks up at 501. No flags, no lock files, no separate "checkpoint" mechanism. The data *is* the checkpoint.

WAL mode means reads and writes don't block each other, so I can query evaluation stats while a labelling batch is running.

## Taxonomy Design

Getting the categories right was harder than getting the code right. Early iterations had too many categories (Claude would hedge between similar options) or too few (a "miscellaneous" bucket that ate 40% of photos).

The final taxonomy has 16 categories, 7 tags, and 3 quality levels:

```python
CATEGORIES = {
    "people":      "Portraits, selfies, group shots",
    "travel":      "Landmarks, scenery, cityscapes",
    "life-moment": "Events, milestones, everyday memories",
    "pet-animal":  "Pets, wildlife, animals",
    "food-drink":  "Food, restaurants, drinks",
    "fitness":     "Workouts, sport, physical milestones",
    "my-creative": "Your own art, writing, projects",
    "saved-art":   "Downloaded artwork, memes, illustrations",
    "document":    "Receipts, contracts, IDs, reference",
    "note":        "Whiteboards, handwritten notes",
    "screenshot":  "App UI, notifications, web pages",
    "chat":        "Messaging interfaces, DMs",
    "product":     "Product listings, unboxing, hardware",
    "accidental":  "Blurry, dark, pocket shots",
    "duplicate":   "Near-duplicate of a better version",
    "unknown":     "Cannot determine content",
}
```

Two design rules proved critical:

**"saved-art" vs "my-creative"** — Without explicit guidance, Claude would classify AI-generated art you downloaded identically to photos of your own paintings. The prompt rule: *"If it looks like polished digital art or a meme clearly downloaded from the internet, it is saved-art. If it looks like a photo of something the user made or a work-in-progress, it is my-creative."* This split the largest bucket meaningfully.

**"screenshot" vs "document"** — Similar ambiguity. A photo of a printed contract and a screenshot of a PDF viewer both contain text, but the curation action differs. The rule: *"Screenshots show app UI, browser chrome, or status bars. Documents are photos of physical paper or cropped reference images."*

The prompt itself is generated from the taxonomy module, so they can't drift apart:

```python
_cat_block = "\n".join(f'  - "{k}": {v}' for k, v in CATEGORIES.items())
PROMPT = f"You are labelling a personal photo library...\n{_cat_block}\n..."
```

## The Calibration Loop

The prompt went through several iterations. The workflow:

```
1. photobooth reset -y              # Clear state
2. photobooth scan --skip-triage    # Run filter + Claude labelling
3. photobooth evaluate              # Check distributions
4. Inspect flags, adjust prompt
5. Repeat
```

The key metric isn't accuracy (no ground truth yet) — it's **distribution shape**. If `unknown` exceeds 5%, the categories have gaps. If one category exceeds 40%, it's too broad and needs splitting. If `accidental` is under 1%, the prompt is probably miscategorising junk as `life-moment`.

Final distribution across 3,335 labelled photos:

| Category | Count | % |
|---|---|---|
| saved-art | 954 | 28.4% |
| life-moment | 624 | 18.5% |
| people | 446 | 13.3% |
| travel | 279 | 8.3% |
| screenshot | 208 | 6.2% |
| document | 202 | 6.0% |
| my-creative | 181 | 5.4% |
| product | 112 | 3.3% |
| pet-animal | 98 | 2.9% |
| fitness | 87 | 2.6% |
| food-drink | 78 | 2.3% |
| note | 36 | 1.1% |
| accidental | 16 | 0.5% |
| chat | 11 | 0.3% |
| unknown | 3 | 0.1% |

The tag distribution tells its own story — 62% of photos tagged `aesthetic`, 45% `has-face`, 32% `from-internet`. The saved-art proportion (28.4%) was higher than expected; turns out six years of saving Midjourney outputs and illustration references adds up.

## Edge Cases and Operational Reality

The theory is clean. Real photos aren't.

**iCloud-optimized originals.** Most photos on a modern iPhone aren't stored locally — they're low-resolution thumbnails with the full image in iCloud. The `osxphotos` library reports these photos exist but can't export them without triggering a download. Solution: a separate `photobooth download` command that pre-fetches originals to a local cache, decoupling iCloud latency from the labelling pipeline.

**HEIC everywhere.** iPhones shoot HEIC by default. The cache stores everything with a `.jpg` extension (a simplification that bit me), but the actual bytes might be HEIC or PNG. The `downsample_to_bytes` function handles this by routing through Pillow with `pillow-heif` registered, converting everything to JPEG before sending to Claude.

**Videos in a photo pipeline.** 895 of the 4,691 items turned out to be videos. They pass metadata filtering — they're not screenshots or bursts — but Claude's vision API can't meaningfully classify a video from nothing. These remain unlabelled pending a thumbnail-extraction approach.

**Transient API failures.** The first 1,000-photo batch hit a 17.5% error rate — 133 `BadRequestError`s from the Anthropic API. Initial investigation pointed at a media-type mismatch (files weren't actually JPEG), but reproducing the errors manually showed they all succeeded on retry. The state machine design meant the fix was a one-line SQL update, not a re-architecture:

```sql
UPDATE photos
SET label_result = NULL, label_confidence = NULL, label_reason = NULL
WHERE label_result = 'error' AND label_reason LIKE '%BadRequest%';
-- 133 rows reset, re-run picks them up automatically
```

## Testing Without Dependencies

The pipeline depends on Apple Photos (via `osxphotos` and `photoscript`), the Anthropic API, Ollama, and a physical photo library. The test suite depends on none of them.

66 tests mock every external boundary. A mock `PhotoInfo` object simulates Photos library entries with controllable attributes (`.screenshot`, `.burst`, `.original_filesize`). The Anthropic client is replaced with a fixture that returns canned JSON. Even `photoscript.PhotosLibrary` is mocked to verify album creation without Photos.app running.

This means CI can run the full test suite on any machine — no API keys, no macOS Photos database, no GPU for Ollama.

## Cost

The full run across 3,335 photos cost approximately **$10** in Claude Haiku API calls. Each photo is downsampled to 512px max dimension before encoding, keeping the base64 payload under 100KB. At ~$0.003/photo, the metadata filter saved roughly $1.30 by eliminating 434 photos before they reached the API — modest in absolute terms, but the principle scales: a 50,000-photo library would save $15 on filtering alone.

## What This Isn't (Yet)

This pipeline categorises. It doesn't yet *evaluate* — and that's an important distinction.

The distribution looks reasonable, the albums are browsable, and spot-checking suggests Claude is mostly right. But "mostly right" isn't a measurement. Two things are next:

**Human ground truth.** A stratified sample of 200–300 photos, manually labelled, compared against Claude's classifications. This gives per-category precision and recall, and — critically — a confusion matrix showing *where* the model struggles. Does it confuse `document` with `screenshot`? Does `life-moment` absorb photos that should be `people`? The taxonomy can't improve without knowing where it's wrong.

**Cross-model verification.** Running the same sample through a second model (GPT-4o, Gemini Pro Vision, or a local model like LLaVA when the Metal compatibility issues resolve) and comparing agreement rates. High agreement on a category means the taxonomy is unambiguous. Low agreement means either the category definition is fuzzy or the boundary between categories is genuinely hard — both useful signals for refining the taxonomy and the prompt.

The infrastructure already supports this: the state DB can store labels from multiple models in additional columns, and the evaluation CLI can compute confusion matrices from any two label columns. The calibration loop just needs a ground-truth column to close.

---

*Built with Python 3.13, Claude Haiku (claude-haiku-4-5), osxphotos, photoscript, Pillow, imagehash. ~1,400 lines of application code, ~950 lines of tests.*
