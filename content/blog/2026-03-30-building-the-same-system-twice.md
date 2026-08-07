+++
title = "Building the Same System Twice"
date = "2026-03-30"
description = "A take-home assessment. Two implementations. One took 18 hours with 48 adversarial reviews. The other took 1 hour with zero. Both work. What does that tell us?"
tags = ["engineering-process", "tdd", "adversarial-review", "ai-augmented-development", "agents", "swarm"]

copy_metrics_version = 2
copy_word_count = 1322
copy_sentence_count = 90
copy_paragraph_count = 33
copy_not_count = 0
copy_not_ratio = 0.00000000
copy_negation_count = 12
copy_contrast_frame_count = 2
copy_short_closure_count = 9
copy_single_sentence_paragraph_count = 7
copy_first_person_count = 5
copy_contraction_count = 5
copy_editorial_signpost_count = 1
copy_repeated_ngram_count = 3
+++

A shipping startup sent me a take-home: build a carrier integration service. TypeScript, UPS API, OAuth 2.0, multi-carrier extensibility. Standard stuff.

I built it twice.

The first attempt ([pidgeon](https://github.com/rickhallett/pidgeon)) used outside-in TDD with adversarial reviews after every implementation step. 86 commits over 18 hours. 161 tests. 48 review documents across three model families.

The second attempt ([pidgeon-swarm](https://github.com/rickhallett/pidgeon-swarm)) used a design-first parallel agent swarm. 17 commits in 1 hour. 55 tests. One code review at the end.

Both produce the same output: given origin, destination, and package dimensions, return normalised shipping rate quotes from UPS. Both handle OAuth token lifecycle, response parsing, error classification, and input validation. Both are architected for multi-carrier extensibility.

The interesting question is what each approach found that the other couldn't.

## The problem

A carrier-agnostic shipping rate integration. The service wraps the UPS Rating API behind a clean interface, normalising the response into a domain model that doesn't leak carrier-specific shapes. OAuth 2.0 client-credentials flow for auth. Exponential backoff for transient failures. Zod for input validation. The architecture should support adding FedEx or DHL without touching existing carrier code.

## Approach 1: iterative TDD

Pidgeon starts with a walking skeleton - one test that forces the entire vertical slice into existence:

> "Given a rate request, get back a normalised rate quote."

Everything is hardcoded to make it green. Then I deepen. Error paths. Request building. Response normalisation. Auth lifecycle. HTTP hardening. Config. CLI. Multi-carrier registry.

After every implementation step, three models (Claude, Codex, Gemini) independently review the code. Keeping their reviews separate avoids anchoring bias. The reviews are triaged: what to fix now, what to defer, what to reject.

### The moment the process paid for itself

Round 1 reviews - three independent reviewers examining the walking skeleton - all flagged the same thing: the `Result<T>` return type on `getRates()` was decorative. The method declared it returned a Result, but every non-happy path threw an exception. The error boundary didn't exist.

This changed the build order. The original plan had request building (step 4) next. Instead, I moved error paths (step 6) ahead of everything else. Build the safe container first, then put features inside it.

This is [decision D015](https://github.com/rickhallett/pidgeon/blob/main/devlog.yml) in the devlog:

> Three cross-family adversarial reviews independently identified the missing error boundary as the highest-severity finding. Building request logic and response normalisation inside a broken boundary means every new feature inherits the same flaw.

Upfront design was unlikely to catch this. The type signature looked correct, TypeScript compiled it and the walking skeleton test passed. The behavioural flaw took fresh eyes reading the actual implementation to spot.

### What 48 reviews found

Over 11 rounds, the reviews surfaced findings that were triaged into fixes:

- **F1**: Logger wasn't wired into the UPS provider - request/retry/error events were invisible
- **F2**: Domain types were hand-written alongside Zod schemas - dual source of truth with drift risk. Fixed by deriving types via `z.infer`
- **F6**: Registry catch handler reported carrier name as `'unknown'` instead of the actual carrier
- **F7**: Aggregated results on total failure lost structured error information
- **F8**: CLI JSON output serialised errors as strings instead of preserving the full `CarrierError` structure

These bugs silently degrade observability, error reporting and the downstream consumer experience without crashing anything. They're invisible in a demo and corrosive in production.

### The numbers

```
Commits:           86
Tests:             161 (412 assertions)
Review documents:  48 (18 Claude, 17 Codex, 13 Gemini)
Decisions logged:  22 active, 16 deferred
Time:              ~18 hours across 2 sessions
```

## Approach 2: parallel agent swarm

Pidgeon-swarm starts with a brainstorming session that produces a complete design spec before any code is written. Types, error model, file map, carrier interface, registry pattern - all specified upfront. Then an implementation plan splits the work into 4 agents with non-overlapping file ownership:

- **Agent A**: Domain types, validation, config
- **Agent B**: UPS auth + HTTP client
- **Agent C**: UPS mapper + carrier implementation
- **Agent D**: Registry, service facade, exports

They execute sequentially (A → B → C → D) because each depends on the prior layer. One code review at the end catches three issues: a missing NaN guard on token expiry, a wrong error class in the registry, and a design spec update.

### What the design prevented

The swarm avoided the decorative-Result-type problem because the design spec already specified the error model correctly. The `CarrierServiceError` class with discriminated union types was designed before any code existed, making the error boundary part of the architecture from the outset.

This is the strength of design-first: if you get the design right, the implementation is a transcription exercise.

### What the design missed

The single code review caught real bugs, all at implementation level. The architecture went unchallenged after the brainstorming phase. A missing NaN guard on `expires_in`, for example, only becomes visible when parsing realistic API responses.

### The numbers

```
Commits:           17
Tests:             55
Review documents:  1
Decisions logged:  7
Time:              ~1 hour
```

## The comparison

| Dimension | Iterative TDD | Parallel Swarm |
|-----------|---------------|----------------|
| Time | 18.5 hours | 1 hour |
| Tests | 161 | 55 |
| Reviews | 48 documents | 1 code review |
| Architectural changes mid-build | Yes (D015) | None needed |
| Domain richness | Surcharges, billable weight, guaranteed delivery | Price, transit days |
| HTTP resilience | Exponential backoff, retry, 429 handling | No retry (caller's responsibility) |
| Multi-carrier | `getRatesFromAll()` with partial success | Single-carrier routing |
| Error model | `Result<T>` - never throws at boundaries | Thrown `CarrierServiceError` |
| Logging | Structured Logger interface | None |
| CLI | Commander-based `rate` subcommand | None |

The iterative approach produced a richer, more resilient system. The swarm approach produced a cleaner, simpler one in a fraction of the time.

## What I learned

### The operator's real job is triage

Across 86 commits and 48 review documents, the AI did most of the writing. The highest-value human actions were reordering the build plan after reviews, deciding which findings to fix versus defer, choosing when to stop reviewing and start refactoring, and catching when "spec compliance" was nominal rather than behavioural.

Code production moved quickly. Deciding what to do next and whether the result actually met the bar became the bottleneck.

### Velocity outpaces verification by default

AI writes code fast. Reviews find issues fast. But deciding what to do about findings - triage, prioritisation, sequencing - is slow. The stowaway commits, the TDD gaps on foundational steps, and the implementation-first review remediation all trace to the same root: throughput overwhelms the operator.

The practical fix is to build forced pauses between roles: commit the triage, switch to coder, then commit the code. The pause between roles is where quality lives.

### Fresh context beats accumulated context

The most valuable reviews were the early ones that started from scratch against the code. Later rounds found fewer critical issues partly because the models had absorbed so much prior context they were anchored by it. The first cross-family review of a new slice is worth roughly 10x the third review of the same slice.

### Process claims are easy to make and hard to sustain at machine speed

The CLAUDE.md for pidgeon contains detailed process rules: atomic commits, TDD discipline, never work on main, separate agent responsibilities. The git history shows partial compliance because maintaining discipline requires constant friction against the natural tendency, human and AI alike, to just ship the next thing.

Writing the rules took an hour. Following them under pressure across 86 commits proved harder.

### The decision record outlasts the code

For a take-home assessment, the code is table stakes. What differentiates is the reasoning: why bun over pnpm, why discriminated unions over class hierarchies, why outside-in over bottom-up, why this field set on RateQuote. A devlog entry costs minutes. Its absence costs a reviewer's trust in whether choices were deliberate.

## Which approach is right?

Each approach suits a different situation. Iterative TDD with adversarial reviews finds problems that upfront design is unlikely to predict, including the decorative Result type, the silent logger gap and the error attribution bug. Design-first parallel execution delivers faster when the design is right.

The ideal process borrows from both: front-loaded adversarial review of the design, perhaps 2 or 3 rounds rather than 11, then parallel execution with a verification gate at integration boundaries. The real skill is knowing which context demands which.

---

*Source code: [pidgeon](https://github.com/rickhallett/pidgeon) (iterative TDD) · [pidgeon-swarm](https://github.com/rickhallett/pidgeon-swarm) (parallel swarm)*
