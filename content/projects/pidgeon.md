+++
title = "Pidgeon"
date = "2026-03-30"
description = "Carrier-agnostic shipping rate integration. Outside-in TDD, 48 cross-model adversarial reviews, machine-queryable decision log. 161 tests, 86 commits."
tags = ["typescript", "tdd", "adversarial-review", "ai-augmented-development"]
track = "ai"
tier = "notable"
weight = 40
repo = "https://github.com/rickhallett/pidgeon"
caseStudy = "/blog/2026-03-30-building-the-same-system-twice/"
draft = true
+++

## What it is

A TypeScript monorepo that wraps the UPS Rating API behind a carrier-agnostic interface. Given origin, destination, and package dimensions, it returns normalised shipping rate quotes with surcharges, billable weight, estimated delivery, and guaranteed delivery indicators.

## Why it's interesting

The code is table stakes. What's unusual is the development process:

**Outside-in TDD** — walking skeleton first, types extracted from working code rather than prescribed upfront. The build order was revised mid-flight when adversarial reviews identified a broken error boundary ([D015](https://github.com/rickhallett/pidgeon/blob/main/devlog.yml)).

**48 adversarial review documents** across three model families (Claude, Codex, Gemini). Each review is independent — no model reads another's findings, avoiding anchoring bias. Reviews are triaged into fix/defer/reject decisions with documented rationale.

**Machine-queryable decision log** — 22 architectural decisions in structured YAML with `choice`, `alternatives`, `rationale`, `evidence`, and `correction` fields. Every non-trivial choice explains why, what was rejected, and what would change at scale.

**Self-critical retrospective** — [LEARNINGS.md](https://github.com/rickhallett/pidgeon/blob/main/LEARNINGS.md) documents what went wrong, not just what went right. TDD discipline lapses, stowaway commits, review diminishing returns, process claims that couldn't be sustained at machine speed.

## Architecture

```
@pidgeon/core          — types, Zod validation, Result<T>, HTTP transport, CLI, carrier registry
@pidgeon/carrier-ups   — UPS OAuth 2.0, request building, response parsing, rate provider
```

- `Result<T>` at provider boundaries — `getRates()` never throws
- `CarrierError` discriminated union with `code`, `message`, `carrier`, `retriable`
- Exponential backoff retry with 429 Retry-After parsing
- `getRatesFromAll()` — parallel multi-carrier aggregation with partial success
- Zod schemas as single source of truth — types derived via `z.infer`

## Key artifacts

- [devlog.yml](https://github.com/rickhallett/pidgeon/blob/main/devlog.yml) — 22 decisions + 16 deferred items
- [BUILD_ORDER.md](https://github.com/rickhallett/pidgeon/blob/main/BUILD_ORDER.md) — outside-in build sequence with rationale
- [LEARNINGS.md](https://github.com/rickhallett/pidgeon/blob/main/LEARNINGS.md) — process retrospective
- [docs/reviews/](https://github.com/rickhallett/pidgeon/tree/main/docs/reviews) — 48 adversarial review documents
- [docs/FUTURE_WORK.md](https://github.com/rickhallett/pidgeon/blob/main/docs/FUTURE_WORK.md) — prioritised deferred items

## Numbers

| Metric | Value |
|--------|-------|
| Commits | 86 |
| Tests | 161 (412 assertions) |
| Review documents | 48 |
| Architectural decisions | 22 |
| Time | ~18 hours |

[GitHub →](https://github.com/rickhallett/pidgeon) · [Case study →](/blog/2026-03-30-building-the-same-system-twice/)
