+++
title = "The gauntlet: a verification pipeline for agentic code"
date = "2026-03-19"
description = "Gate, then 3 models review your code independently, then a 4th synthesises their findings. If they converge on a defect, confidence is high. If they diverge, investigate."
tags = ["verification", "agents", "gauntlet", "quality"]
draft = true
+++

{{< draft-notice >}}

## The problem

When you have AI agents writing code, they will periodically introduce changes that compile, pass the type checker, and are completely wrong. Not wrong because they misunderstood the task - wrong in a way that looks right. The output is coherent and plausible and passes every surface check. You won't catch it by reading casually.

I tried demanding more careful work from the agents. That doesn't help - you can't get determinism from a probabilistic system. What you can do is stack enough independent checks that the probability of a bad change surviving them all becomes negligible.

## The pipeline

```
DEV -> GATE -> DARKCAT TRIAD -> SYNTHESIS -> PITKEEL -> WALKTHROUGH -> COMMIT
```

**Step 1: DEV.** Implement + run the gate (typecheck + lint + test). If the gate fails, you're not ready. Nothing else matters.

**Step 2: Darkcat Triad.** Three independent models review the same diff. Claude, OpenAI, Gemini. Same prompt, same instructions, different priors. They don't know what each other found.

**Step 3: Synthesis.** A 4th agent reads all three reviews and produces a convergence report:
- **Convergent findings** (same defect, different words) = high confidence
- **Divergent findings** (one model sees it, others don't) = investigate
- **Unanimous pass** (all three say clean) = high confidence nominal

**Step 4: Pitkeel.** Session monitoring - velocity, fatigue, scope drift. Not code quality; human quality.

**Step 5: Walkthrough.** Human checks a checklist. The human is the only verification layer that can evaluate taste - does this feel right? Would I put my name on it?

**Step 6: Commit.** Only after all previous steps complete.

## The math

The probability of a defect surviving is the product of the probabilities of surviving each gate independently:

P(defect survives) = P(survives gate) x P(survives DC-1) x P(survives DC-2) x P(survives DC-3) x P(survives human)

Stack enough independent gates and that product gets small. The important word is **independent** - three instances of the same model aren't independent. They share priors, they share blind spots. I found this the hard way: three Claude instances will cheerfully agree that something is fine when a Gemini instance spots the problem immediately. Different model families give you genuinely different perspectives.

## What it catches

From the darkcat findings log across the project:
- Schema count mismatches between spec and implementation
- SSE lifecycle failure modes (connection drops, no reconnection)
- Error handling paths copied from contexts where they were reachable but unreachable in the current code
- Tests that assert the correct outcome via the wrong causal path

## What it doesn't catch

Whether the architecture is right. Whether the UX feels good. Whether the documentation actually communicates to a human reader. Those need a person with taste looking at the output and making a call.

The point of the pipeline isn't to replace that judgment - it's to handle everything below the taste boundary so I can focus on the parts that actually need me.

## Source

- Pipeline definition: `docs/internal/the-gauntlet.md`
- Review instructions: `docs/internal/weaver/darkcat-review-instructions.md`
- Findings data: `docs/internal/weaver/darkcat-findings.tsv`
- Triangulation parser: `bin/triangulate` (Python, uv)
