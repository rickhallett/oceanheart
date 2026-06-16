+++
title = "Building a Cost-Aware Intelligence Pipeline"
date = "2026-04-05"
description = "How I built a system that tracks every penny it spends on AI — and why that's the whole point."
tags = ["engineering", "data", "llm", "cost", "architecture", "jeany"]
draft = true
+++

There are roughly 200 RSS feeds publishing substantive AI content daily — newsletters, company blogs, research feeds, tech publications. If you read them all, you'd know everything happening in the AI content economy. Nobody reads them all.

So I built a pipeline to do it: ingest every feed, extract entities and topics using LLMs, track costs down to the penny, and surface patterns in a dashboard. The project is called Jeany — a microservice intelligence platform for analysing the AI content economy.

But this isn't a write-up about building a data pipeline. Plenty of those exist. This is about a design decision I made on day one that shaped every subsequent decision: **cost tracking is not a feature. It's the architecture.**

## The Decision That Changed Everything

Most LLM-powered projects treat API costs as an operational concern — something you monitor in your provider dashboard and optimise when the bill arrives. I decided to make cost a first-class data type, tracked with the same rigour as the content itself.

From the project's decision log:

> *"Cost tracking is first-class from day zero — not bolted on later."*
>
> *"Every data point traces back to raw source with timestamp and collection cost."*

This means every item in the system has a known cost of acquisition. Not estimated. Not averaged. Recorded at the moment of spend, converted to GBP at the exchange rate captured at the start of that pipeline run, stored in a TimescaleDB hypertable for time-series analysis.

The question the system answers isn't just "what are AI newsletters talking about?" — it's "what did it cost to learn that, and is it worth it?"

## Architecture

The pipeline is five Python services, a Next.js dashboard, and a Go CLI, running on Docker Compose locally and Kubernetes in production:

```
RSS Feeds (83 sources)
    │
    ▼
┌─────────┐     ┌──────────┐     ┌──────────────┐
│ ingest   │────▶│ process   │────▶│ cost-ledger  │
│ service  │     │ service   │     │ service      │
└─────────┘     └──────────┘     └──────────────┘
                     │                    │
              entity extraction    cost event recording
              topic classification  run finalisation
                     │                    │
                     ▼                    ▼
              ┌─────────────────────────────────┐
              │  PostgreSQL + TimescaleDB        │
              │  items, entities, topics,        │
              │  cost_events (hypertable)        │
              └─────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │  api service  │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │   dashboard   │
                    └───────────────┘
```

Every arrow in that diagram carries cost data alongside content data. The cost-ledger service isn't a monitoring sidecar — it's a core pipeline stage with its own Celery queue, its own database writes, and its own finalisation logic.

## Three Design Problems Worth Talking About

### 1. The Taxonomy Explosion

The first version of topic classification was simple: give the LLM an article title and summary, ask it to generate 1-3 topic labels. Free-form, unconstrained.

After processing 664 items, I had 1,515 unique topic labels. A 2.3:1 ratio of topics to items, with 63 fragmented stems — "llm-safety", "llm safety", "LLM Safety", "ai-safety", "AI Safety" all appearing as distinct topics.

The root cause was obvious in retrospect: unconstrained generation with no awareness of existing labels. The LLM generates a new label for almost every item because it has no memory of what it's already said.

The fix was a two-pass classification system:

**Pass 1** presents the top 80 existing topics (by usage frequency) and asks the model to pick 1-3 that fit. If it finds matches, stop. One LLM call, and the taxonomy converges.

**Pass 2** fires only if nothing fits. It asks for exactly one new broad topic with constraints: 2-4 words, lowercase, not a near-duplicate of existing topics. The first 30 existing topics are included as negative examples.

The taxonomy is self-bootstrapping. Early items create seed topics. Subsequent items converge on them. Over time, the distribution stabilises. The cost impact is marginal — Pass 1 uses slightly more tokens (taxonomy in the prompt) but Pass 2 is rarely needed, so average cost per item stays flat.

From the decision log:

> *"Prompt eval revealed 1515 unique topics for 664 items (2.3x ratio) with 63 fragmented stems. The open-ended prompt generates a new label for almost every item. Root cause: unconstrained generation with no awareness of existing labels."*

This decision has its own arc in the log. Decision 13 chose free-form generation deliberately — "thematic analysis should be induced from the ground up, not imposed top-down." Decision 51 reversed it when the data made the cost of that principle clear. The log captures both the original reasoning and the correction. The evolution of understanding is more valuable than the final answer.

### 2. The Cost Ceiling Problem

If the pipeline runs unattended and an LLM provider changes pricing, or a bug causes retry storms, costs compound silently. The system needed a circuit breaker.

The implementation is deliberately simple. Before each pipeline run starts, the ingest service queries total spend:

```python
def check_cost_ceiling(engine):
    ceiling = os.environ.get("COST_CEILING_USD")
    if ceiling is None:
        return True, get_total_spend(engine), None

    total = get_total_spend(engine)
    return total < float(ceiling), total, float(ceiling)
```

If spend exceeds the ceiling, the pipeline refuses to start and publishes a `pipeline.paused` event. It's a pre-flight check, not a mid-flight kill switch — once a run starts, it completes. This is intentional: partial runs are harder to reason about than completed runs that were expensive.

The cost ceiling is an environment variable, not a database setting, because I want it to survive container restarts without database access and be visible in deployment manifests.

### 3. The Cadence Problem

The pipeline started with 12 feeds, polled hourly. For BI, I needed to scale to 80+ sources across newsletters, company blogs, tech publications, arXiv, YouTube, and podcasts. But polling all 83 feeds every hour means 83 HTTP requests/hour plus hundreds of LLM calls — rate limit pressure from both feed hosts and the LLM provider.

The insight was that publishing cadence varies enormously. Ben's Bites publishes daily. Apple's Machine Learning blog publishes monthly. Polling a monthly blog every hour is 720 wasted requests between actual content.

The `feeds` table already had a `poll_cadence` interval column — it just wasn't wired up. I replaced the global hourly poll with a scheduler that runs every 15 minutes and queries:

```sql
SELECT id, url, name, etag, last_modified_header, max_items_per_poll
FROM feeds
WHERE active = true
  AND (last_polled IS NULL OR last_polled + poll_cadence < now())
```

Feeds naturally stagger because they fall due at different times. A daily feed gets polled once a day. A weekly feed once a week. The 15-minute check just finds whoever's due.

Three additional safeguards prevent the first run from being catastrophic:

- **HTTP conditional requests**: The system sends `If-None-Match` and `If-Modified-Since` headers and skips parsing entirely on 304 Not Modified. No new items means no LLM spend.
- **Per-feed item cap**: `max_items_per_poll` (default 20) prevents back-catalogue floods. OpenAI's blog RSS returns 903 entries. Without the cap, the first poll would dispatch 903 items to the LLM. With it, 20 items are processed and the rest are deferred to subsequent cycles.
- **URL deduplication**: Items are deduped by URL before LLM processing. Cross-feed syndication (common in the newsletter ecosystem) is caught before it costs anything.

The result: 83 feeds produce roughly 40-50 HTTP requests per day total, and 20-50 genuinely new items that warrant LLM processing.

## What Cost-Awareness Actually Looks Like

Every cost event in the system is a row in a TimescaleDB hypertable:

| Field | Purpose |
|-------|---------|
| `timestamp` | When the spend occurred |
| `service` | Which microservice (ingest, process) |
| `stage` | Pipeline stage (extraction, classification) |
| `model` | LLM model used |
| `prompt_tokens` | Input tokens consumed |
| `completion_tokens` | Output tokens generated |
| `cost_usd` | Calculated USD cost |
| `cost_gbp` | GBP cost at run-time exchange rate |
| `item_id` | Which content item |
| `run_id` | Which pipeline run |

This isn't a monitoring table. It's a business intelligence table. Because every cost event links to an item, and every item links to a feed, and every feed has a platform and cadence, the system can answer questions like:

- What's the cost per insight by source type?
- Which feeds have the highest entity density per pound spent?
- Is the two-pass classifier actually cheaper than the single-pass was?
- At current growth rates, what will this cost in six months?

The exchange rate is captured once per pipeline run — not per item, not per day. From the decision log:

> *"The computational cost of one exchange rate fetch per pipeline run is trivial. The business intelligence value of historically accurate GBP costs compounds over time. Designing for data density that is affordable from the outset is the right default — if capturing a signal is cheap now and expensive to reconstruct later, capture it now."*

## The Stack

For the technically inclined:

- **Services**: Python 3.13, FastAPI, Celery, httpx, Polars
- **Dashboard**: Next.js 14, React, Recharts, Tailwind
- **CLI**: Go, Cobra
- **Database**: PostgreSQL + TimescaleDB (cost_events hypertable)
- **Queue**: Redis + Celery (three queues: ingest, process, cost)
- **Containers**: Docker Compose (dev), k3s/Kustomize (local prod), GKE target
- **Observability**: Prometheus, Grafana, Loki, Tempo, OpenTelemetry, Sentry
- **LLM**: Claude Haiku via OpenRouter (single API key, model-swap is a string change)
- **Testing**: pytest + hypothesis, great_expectations, Vitest + RTL, Playwright, Go test
- **CI**: GitHub Actions, layered jobs per test tier

Design decisions that mattered:

- **SQLAlchemy Core without the ORM** — the natural unit of work in a data pipeline is a query, not an object graph.
- **OpenRouter instead of direct SDK** — single billing view, model swaps are a config change, no custom abstraction layer needed.
- **TimescaleDB from day zero** — it's a Postgres superset. Starting with it avoids a migration when you need time-series queries. You always need time-series queries.

## The Decision Log

The project maintains a machine-readable decision log (`devlog.yaml`) with 51 entries as of writing. Every architectural choice records the decision, the alternatives considered, and the reasoning. Not because documentation is virtuous — because decisions without recorded reasoning can't be evaluated later.

Some favourites:

> **Decision 9, Celery vs Redis Streams**: "Current workload is a simple publish-consume pattern where Redis Streams would suffice. But the pipeline will almost certainly need conditional routing, task chains, and per-stage retry policies. Celery provides these natively. Its configuration footguns are finite, well-documented, and a one-time setup cost."

> **Decision 22, Observable scripts**: "A batch re-dispatch of 205 items ran with no timeout, no progress indicator, and no error handling. If it had hung or failed silently, there would have been no signal. The convention: never fire into a void."

> **Decision 11, Human verification gates**: "Unit tests and CI prove code works as code. They do not behaviourally validate that the system does what it should. Context anxiety is real — there is always a gap between 'tests pass' and 'this is correct.'"

## What I'd Do Differently

**Start with the two-pass classifier.** The free-form approach was a deliberate choice (induce taxonomy from data, don't impose it). The reasoning was sound. But the cleanup cost of 1,515 fragmented topics was real. I'd start with the two-pass system and let the first ~50 items bootstrap the taxonomy in a controlled way.

**Set a lower default item cap.** 20 per feed is fine for newsletters (they have 10-20 items in their RSS). For company blogs with years of back-catalogue, 5 would have been more appropriate for the first run.

**Build the cost dashboard before the content dashboard.** I built content visualisation first because it's the end-user deliverable. But the cost data is what makes this project interesting. The cost-per-insight metrics should have been front and centre from the start.

## Current State

As of writing:

- 83 validated feed sources across 7 platforms
- 1,355 items ingested, ~700 processed with entity extraction and topic classification
- Per-feed cadence scheduling (daily to fortnightly)
- Full cost attribution down to individual items
- Live dashboard with SSE updates
- Running on Docker Compose locally, Kubernetes manifests ready for GKE

The pipeline runs continuously. Every 15 minutes, it checks what's due. Most checks find nothing — the feeds that publish daily are the only ones that regularly produce new items. The system is designed to be boring in operation and interesting in analysis.
