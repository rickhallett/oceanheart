+++
title = "Building the Same System Three Times"
date = "2026-03-30"
description = "A third implementation of the same shipping rate service - this time with 4 parallel workers gated by Sortie's multi-model adversarial review. Pre-merge quality gates caught security issues that 48 post-hoc reviews missed."
tags = ["engineering-process", "sortie", "adversarial-review", "swarm", "tdd"]

copy_metrics_version = 2
copy_word_count = 925
copy_sentence_count = 57
copy_paragraph_count = 22
copy_not_count = 1
copy_not_ratio = 0.00108108
copy_negation_count = 9
copy_contrast_frame_count = 1
copy_short_closure_count = 11
copy_single_sentence_paragraph_count = 7
copy_first_person_count = 2
copy_contraction_count = 3
copy_editorial_signpost_count = 0
copy_repeated_ngram_count = 0
+++

This is Part 2 of [Building the Same System Twice](/blog/2026-03-30-building-the-same-system-twice/). If you haven't read that, the short version: I built a carrier integration service (TypeScript, UPS API, OAuth 2.0) twice from the same spec. Once with outside-in TDD and 48 adversarial reviews over 18 hours. Once with a parallel agent swarm in 1 hour.

Then I built it a third time.

## Why a third time?

The first two implementations answered "what does iterative review find that upfront design misses, and vice versa?" The third implementation asks a different question: **what happens when the adversarial review runs _before_ merge, not after?**

[Pidgeon](https://github.com/rickhallett/pidgeon) ran 48 reviews after the code was already integrated. [Pidgeon-swarm](https://github.com/rickhallett/pidgeon-swarm) ran one review at the end. The third implementation - `pidgeon-swarm-sortie-test` - runs [Sortie](/projects/sortie/) at every merge boundary. Four parallel workers build on separate branches. Each merge triggers a 3-model review (Claude, Gemini, Codex). Critical or major convergent findings block the merge until remediated. Max 2 remediation cycles.

Same spec. Same domain. New process variable: pre-merge adversarial gating.

## The setup

Four workers with non-overlapping file ownership:

- **Worker A**: Domain types, validation, config
- **Worker B**: UPS auth + HTTP client
- **Worker C**: UPS mapper + carrier implementation
- **Worker D**: Service facade, registry, integration

Each worker builds on its own branch. When it's ready to merge, Sortie runs the pipeline: 3 models review the diff in parallel, a 4th-model debrief synthesises findings with convergence analysis, triage evaluates severity against the configured blocking rules. The worker can't merge until the verdict passes.

The git history shows this structure clearly:

```
merge: worker-a/domain-types
merge: worker-b/ups-auth-client
merge: worker-c/ups-mapper-carrier
merge: worker-d/service-registry
```

15 commits total. 99 tests, 229 assertions.

## What pre-merge review caught

The Sortie review cycles found two things that the post-hoc approach in pidgeon missed entirely across 48 review documents:

**HTTPS URL validation on UPS endpoints.** The config loader in pidgeon (and pidgeon-swarm) accepts any URL string for the UPS rating and token endpoints. Someone could configure `http://` and send OAuth credentials over plaintext. The Sortie review flagged this as a security issue. The fix: validate that configured URLs use HTTPS on known UPS domains.

**NaN guards in monetary parsing.** UPS returns monetary values as strings. The mapper calls `parseFloat()` without checking the result. If UPS returns a malformed price string, `NaN` propagates silently into the rate quote, leaving the caller with a price of `NaN` instead of a structured error. The Sortie review caught this. The fix: NaN guard after every `parseFloat()` with a structured error if parsing fails.

Both are silent correctness issues that leave well-formed fixtures and ordinary test suites untouched, then surface in production when real data arrives in unexpected shapes. Pidgeon's 48 post-hoc adversarial reviews missed them.

## Why post-hoc missed them

Pidgeon's post-hoc reviews found and fixed 8 tagged issues (F1-F8), including structural problems like the decorative Result type (D015) that changed the entire build order. Those architectural findings sat outside the likely reach of pre-merge gating because the error boundary problem existed in the walking skeleton before any branch structure existed.

The difference is scope. Post-hoc review looks at the entire codebase and tends to find architectural and design issues. Pre-merge review looks at a single diff and tends to find implementation issues - the NaN guard, the HTTPS validation, the missing edge case. Different zoom levels catch different bugs.

## The numbers

| Metric | pidgeon | pidgeon-swarm | pidgeon-swarm-sortie-test |
|--------|---------|---------------|---------------------------|
| Commits | 86 | 17 | 15 |
| Tests | 161 | 55 | 99 |
| Assertions | 412 | - | 229 |
| Impl LOC | ~1,454 | ~700 | ~850 |
| Test LOC | ~3,911 | ~600 | ~1,450 |
| Test:code ratio | 2.7:1 | 0.86:1 | 1.7:1 |
| Review method | 48 post-hoc reviews | 1 code review | Pre-merge Sortie (3 models per merge) |
| Time | ~18 hours | ~1 hour | ~2 hours |

## What converged across all three

All three projects independently arrived at the same core decisions:

- Bun runtime with native `bun:test`
- Zod as single source of truth for validation + type inference
- Native `fetch` - no external HTTP client
- Carrier plugin pattern: interface + registry + service facade
- Domain boundary: UPS shapes never leak to callers
- In-memory token cache with 60-second refresh buffer
- Environment-based config with Zod validation
- Named exports with explicit return types

When three different build processes converge on the same choices, those choices are probably correct for the domain.

## What diverged

| Decision | pidgeon | swarm variants |
|----------|---------|----------------|
| Error boundary | `Result<T>` (never throws) | Thrown `CarrierError` |
| Package structure | Monorepo (hard enforcement) | Flat `src/` (convention) |
| Retry strategy | Exponential backoff middleware | 401 retry only |
| Carrier capabilities | Optional interface methods | Single `getRates` |
| TypeScript strictness | Maximum (3 extra flags) | Standard strict |

Pidgeon's monorepo is the only one that enforces the dependency direction at the toolchain level. The flat projects rely on discipline - a domain file _could_ import from `carriers/ups/` without any build failure.

## The real finding

Neither approach dominates. Each optimises for something different:

| Project | Optimises for |
|---------|---------------|
| pidgeon | **Longevity** - future developers, extensibility, documented decisions |
| pidgeon-swarm | **Clarity** - minimal, readable, quick to understand |
| pidgeon-swarm-sortie-test | **Process** - demonstrates swarm + adversarial review workflow |

The ideal workflow combines pidgeon's scope and documentation with Sortie's pre-merge quality gating. Start with the walking skeleton and outside-in TDD to get the architecture right. Then use parallel workers with pre-merge review to fill in the implementation. Post-hoc review for architecture. Pre-merge review for correctness. Different tools for different zoom levels.

The useful finding is that **review timing determines what you find.** Earlier review catches implementation bugs before they integrate; later review sees architectural issues with full context. The practical question is where to put the gates.

---

*Source code: [pidgeon](https://github.com/rickhallett/pidgeon) (iterative TDD) · [pidgeon-swarm](https://github.com/rickhallett/pidgeon-swarm) (parallel swarm) · [sortie](https://github.com/rickhallett/sortie) (the review tool) · [comparative review](/projects/sortie/) (full analysis)*
