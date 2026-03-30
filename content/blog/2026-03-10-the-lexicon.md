+++
title = "A vocabulary for human-AI engineering"
date = "2026-03-18"
description = "v0.26 of a working vocabulary developed over 30 days of agentic engineering. ~60% maps to established frameworks. ~18% is genuinely novel. The novel parts cluster around context engineering for LLM agents."
tags = ["lexicon", "vocabulary", "frameworks", "context-engineering"]
draft = true
+++

{{< draft-notice >}}

## What this is

Over 30 days of building software with 13 AI agents, I ended up developing a working vocabulary for things that kept happening. It started as naval metaphors - the project used *Master and Commander* as scaffolding, which was fun but eventually became a credibility problem - and ended as a ~70-term lexicon.

Two independent analyses mapped about 60% of the terms to existing frameworks (DRI, quality gate, poka-yoke, etc.). That's actually good news: it means we converged on the same concepts independently through practice. The remaining ~18% that doesn't map to anything existing is where the interesting stuff is. Version 0.26 is the 3rd distillation.

## What maps to existing frameworks

| Our term | Established equivalent | Framework |
|----------|----------------------|-----------|
| DRI | Directly Responsible Individual | Apple, SWE management |
| Standing policy | ADR (Architecture Decision Record) | Nygard 2011 |
| Quality gate | Quality gate / poka-yoke | CI/CD, Toyota |
| Readback | Readback | CRM (Crew Resource Management), Helmreich 1999 |
| Sustainable pace | Sustainable pace | XP, Beck 1999 |
| Stop the line | Andon cord | Toyota Production System |
| SEV-1 | Incident response severity | SRE |
| Checkpoint recovery | WAL, crash recovery | Database systems |
| One-shot agent job | Job | k8s, Unix fork+exec |
| Verification pipeline | Swiss Cheese Model | Reason 1990 |
| Adversarial review | Red team, FMEA | Security engineering |

I was initially slightly deflated by how much mapped to existing work. But on reflection, arriving at the same concepts independently through practice is a better validation than novelty would be.

## What is genuinely novel (~18%)

The novel terms all cluster around **context engineering for LLM agents** - which makes sense, since that domain didn't exist when the established frameworks were written:

1. **Cold/hot context pressure** - LLM-specific operational states. Cold: insufficient context, model pattern-matches instead of solving. Hot: accumulated context creates noise and drift.

2. **Dumb zone** - operating outside the model's effective context window. Named from observation: agents produce syntactically valid but semantically wrong output when context is insufficient.

3. **Sycophantic amplification loop** - human creativity + model sycophancy create a positive feedback loop. Neither party catches the drift because the output looks increasingly good to both.

4. **Spinning to infinity** - recursive self-observation consuming resources without producing decisions. Distinct from livelock (which is mechanical); spinning involves meta-analysis of meta-analysis.

5. **Compaction loss** - context window death where decisions not written to durable files are permanently lost. The context window is volatile memory with no graceful degradation.

6. **Communication modes** - systematic registers for human-AI interaction (formal/exploration/execution). Not the same as "prompting styles" - these are governance modes that control what kind of output is expected.

7. **Tacking** - purposeful strategic indirection. No established SWE equivalent for "going sideways on purpose to make progress against a headwind."

8. **Learning in the wild** - the discovery made while doing the work is more valuable than the work itself. Economic inversion: process yields exceed output yields.

9. **Context-attuned** - an agent that navigates by the vessel's conventions rather than generic training.

## Why the grounding matters

The naval metaphor was fun, and it genuinely helped during the pilot study - it gave the agents (and me) a shared frame for talking about authority, tempo, and discipline. But it creates problems when you take the work outside:

1. **Credibility cost.** "The hull is survival" sounds like cosplay to anyone who wasn't there. "Quality gate" is immediately understood.

2. **Bridge cost.** If a hiring manager or HN reader has to translate your private vocabulary before they can evaluate your ideas, most of them won't bother.

Grounding the 60% lets the genuinely novel 18% stand out as contributions rather than being buried in unfamiliar terms.

## The mathematical heuristics

The lexicon also encodes decision-making heuristics that govern when to stop iterating:

- **Diminishing marginal returns** - each additional review cycle finds less. Stop when the cost of the next cycle exceeds its expected value.
- **Asymmetric payoff** - low cost if nothing is found, high value if something is caught. Favours running the check.
- **Convexity** - a position with more upside than downside. The verification pipeline is convex: it costs little when it finds nothing and saves a lot when it catches something.

None of this is novel economics - Marshall (1890), Taleb (2012). But naming them explicitly in the lexicon means agents can use them as decision criteria rather than me having to invoke them from intuition each time.

## Source

- Full lexicon: `docs/internal/lexicon.md` (v0.26)
- Compressed version: AGENTS.md, Lexicon section
- Distillation analyses: Architect (naval-to-Linux mapping) + Analyst (naval-to-SWE mapping)
