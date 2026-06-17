+++
title = "Pidgeon Swarm"
date = "2026-03-30"
description = "Same spec as Pidgeon, rebuilt in 1 hour using design-first parallel agent execution. 55 tests, 17 commits. A direct comparison of process vs velocity."
tags = ["typescript", "swarm", "agents", "parallel-execution"]
track = "ai"
tier = "archive"
weight = 50
repo = "https://github.com/rickhallett/pidgeon-swarm"
caseStudy = "/blog/2026-03-30-building-the-same-system-twice/"
draft = true
+++

## What it is

The same carrier integration service as [Pidgeon](/projects/pidgeon/), built from the same spec in a fundamentally different way. Design-first, then parallel agent execution.

## Why it exists

To answer a specific question: what happens when you skip the iterative review process and invest instead in upfront design?

## Process

1. **Brainstorming** — complete design spec produced before any code: types, error model, file map, carrier interface, registry pattern
2. **Planning** — 15 tasks mapped to 4 agents with a dependency graph
3. **Execution** — sequential agent dispatch (A → B → C → D), each producing tests and implementation as a unit
4. **Review** — single code review at the end, catching 3 issues

The entire implementation took 1 hour from init to done.

## Architecture

```
src/domain/         — carrier-agnostic types, Zod validation, discriminated error union
src/carriers/ups/   — OAuth 2.0 auth, HTTP client, request/response mapper, carrier impl
src/registry.ts     — carrier plugin discovery
src/service.ts      — CarrierService facade with validation
```

- `CarrierServiceError` with discriminated `CarrierError` type
- `CarrierService` facade validates input before routing to carrier
- Conditional `Shop`/`Rate` request option based on service level
- Centralised test fixtures — realistic UPS API payloads
- No retry logic — `retryable` flag on errors delegates to caller

## What it found vs what it missed

**The design prevented** the decorative-Result-type problem that Pidgeon's reviews caught. The error model was correct by specification.

**The design missed** implementation-level bugs (NaN guard on token expiry, wrong error class in registry) that only surface when writing actual code against real API shapes.

## Numbers

| Metric | Value |
|--------|-------|
| Commits | 17 |
| Tests | 55 |
| Review documents | 1 |
| Architectural decisions | 7 |
| Time | ~1 hour |

[GitHub →](https://github.com/rickhallett/pidgeon-swarm) · [Case study →](/blog/2026-03-30-building-the-same-system-twice/)
