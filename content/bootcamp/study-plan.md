+++
title = "2-Week Interview Prep - Breadth Pass"
date = "2026-03-10"
description = "14-day study plan covering 17 of 51 bootcamp steps. Optimised for Anthropic red teaming interview readiness."
tags = ["study-plan", "interview", "bootcamp"]
draft = true
+++

2-week breadth pass through bootcamp material. 3-4 hours/day, ~49 hours total.
17 steps selected from 51. Cut criteria: interview ROI for Anthropic red teaming role.

---

## Rules

1. Read, don't do exercises. Conceptual fluency, not skill-building.
2. One sentence per major concept. If you can't say it in one sentence, you don't understand it yet.
3. Days 1-4 are non-negotiable. If behind, compress week 2, not week 1.
4. If a step takes less than 3.5 hours to read, re-read a previous day's notes.

---

## Week 1: Foundations + The Job Itself

### Day 1 - LLM Mechanics (3.5h)

- [ ] [How LLMs Actually Work](/bootcamp/ii-01-how-llms-work/) (II-1, tier 1, est. 5-6h)
- Transformer architecture, attention, tokenization, context windows, autoregressive generation
- The operational consequences of the math, not the math itself
- **Interview angle:** Every question about model behaviour reduces to this

### Day 2 - What Evals Measure (3.5h)

- [ ] [What Evaluations Actually Measure](/bootcamp/iv-01-what-evals-measure/) (IV-1, tier 1, est. 4-5h)
- Construct validity, content contamination, saturation, Goodhart's law
- The gap between benchmark scores and real-world capability
- **Interview angle:** This IS the job - understanding what your measurements mean

### Day 3 - Adversarial Testing (3.5h)

- [ ] [Adversarial Testing Methodology](/bootcamp/iv-06-adversarial-testing/) (IV-6, tier 2, est. 5-6h)
- Systematic failure discovery, attack taxonomies, coverage analysis
- How to find what benchmarks miss
- **Interview angle:** Direct hit on red teaming methodology

### Day 4 - Red Teaming (3.5h)

- [ ] [Red Teaming for Safety-Critical Capabilities](/bootcamp/iv-07-red-teaming/) (IV-7, tier 3, est. 5-6h)
- Safety-critical capability assessment, jailbreaking, CBRN, persuasion
- Red team operations, reporting, responsible disclosure
- **Interview angle:** The job description in step form

### Day 5 - Prompt Engineering (3.5h)

- [ ] [Prompt Engineering as System Design](/bootcamp/ii-03-prompt-engineering/) (II-3, tier 1, est. 5-6h)
- Prompts as programs, not prose. System prompts, few-shot, chain-of-thought
- Understanding construction = understanding attack surface
- **Interview angle:** You attack prompts to red team. Know how they're built.

### Day 6 - Failure Modes (3.5h)

- [ ] [Failure Modes and Recovery](/bootcamp/ii-09-failure-modes/) (II-9, tier 3, est. 4-5h)
- Hallucination, sycophancy, goal drift, mode collapse, context degradation
- Taxonomy of how agents fail and recovery strategies
- **Interview angle:** Name the failure mode, explain the mechanism, propose the test

### Day 7 - Eval Datasets (3.5h)

- [ ] [Designing Eval Datasets and Success Criteria](/bootcamp/iv-02-eval-datasets/) (IV-2, tier 1, est. 5-6h)
- Dataset construction, contamination prevention, success criteria definition
- How to build datasets that measure what you claim
- **Interview angle:** "How would you design an eval for X?" is a likely question

**Week 1 checkpoint:** Can you discuss LLM mechanics, eval methodology, adversarial testing, red teaming, and failure modes with specificity? If not, re-read days 1-4 before proceeding.

---

## Week 2: Depth + Practical Credibility

### Day 8 - Context Engineering (3.5h)

- [ ] [Context Engineering](/bootcamp/ii-04-context-engineering/) (II-4, tier 2, est. 5-6h)
- Working set theory, context window management, cold/hot pressure, compaction
- The context engineering problem: slop is a context problem, not a model problem
- **Interview angle:** Differentiated knowledge. Shows you understand the system you're testing.

### Day 9 - Scoring and Grading (3.5h)

- [ ] [Scoring and Grading Methods](/bootcamp/iv-03-scoring-grading/) (IV-3, tier 1, est. 5-6h)
- Rubric design, LLM-as-judge, inter-rater reliability, calibration
- How to grade model outputs reliably
- **Interview angle:** Practical eval skill. "How would you score this?" needs a real answer.

### Day 10 - Verification and Quality (3.5h)

- [ ] [Verification and Quality for Probabilistic Systems](/bootcamp/ii-06-verification/) (II-6, tier 2, est. 6-7h)
- Swiss cheese model, probabilistic verification, gate design
- How to build confidence when the system is non-deterministic
- **Interview angle:** Red teaming is verification. This is the theory underneath.

### Day 11 - Agent Evaluation (3h)

- [ ] [Evaluating Agents and Workflows](/bootcamp/iv-04-agent-evaluation/) (IV-4, tier 2, est. 5-6h)
- Multi-step agent eval, trajectory analysis, tool use assessment
- How to evaluate systems that act, not just generate
- **Interview angle:** Agents are the frontier. Knowing how to eval them is rare.

### Day 12 - Agent Architecture (3h)

- [ ] [Agent Architecture Patterns](/bootcamp/ii-02-agent-architecture/) (II-2, tier 1, est. 4-5h)
- ReAct, tool use, routing, orchestration, memory patterns
- Know the structure of what you're testing
- **Interview angle:** You cannot red team what you do not understand architecturally.

### Day 13 - Process Model + Communicating Results (3.5h)

- [ ] [The Unix Process Model](/bootcamp/01-process-model/) (I-1, tier 1, est. 4-6h) - SKIM (2h)
- File descriptors, pipes, signals, fork/exec/wait
- Enough to discuss without fumbling, not enough to implement from scratch
- **Interview angle:** Practical credibility. Shows systems depth.

- [ ] [Interpreting and Communicating Eval Results](/bootcamp/iv-08-interpreting-results/) (IV-8, tier 3, est. 3-4h) - READ (1.5h)
- How to present findings, confidence intervals, actionable recommendations
- **Interview angle:** Interview = communicating results. This is the meta-skill.

### Day 14 - Human-AI Interface + Review (3.5h)

- [ ] [The Human-AI Interface](/bootcamp/ii-07-human-ai-interface/) (II-7, tier 2, est. 5-6h) - READ (2h)
- Bainbridge's ironies, cognitive deskilling, oversight design, HITL/HOTL
- The human side of AI safety
- **Interview angle:** Red teaming exists because humans cannot verify probabilistic systems unaided.

- [ ] Review and consolidate (1.5h)
- Re-read day 1-4 notes
- For each of the 17 steps, write one sentence: "This matters because..."
- Identify the 3 weakest areas, re-skim those sections

---

## What's Cut and Why

| Cut | Reason |
|-----|--------|
| Bootcamp III (all 10 steps) | Analytics is useful but not interview-differentiating |
| Bootcamp V (all 9 steps) | RAG/infrastructure is implementation, not red teaming |
| I-2 through I-12 | Shell, awk, containers, git - practical skills, not conceptual |
| II-5 Tool Design | Nice to have; IV-4 covers the testing angle |
| II-8 Multi-Model Verification | Interesting but niche for interview |
| II-10 Governance | Organizational, not technical |
| II-11 Cost/Security/Legal | Not interview-differentiating |
| IV-5 Eval Infrastructure | Implementation detail |
| IV-9 Eval Culture | Organizational, not technical |

---

## Priority Tiers for Time Pressure

If you lose days, cut from the bottom:

**Tier A - Never cut (days 1-4, 14h):**
II-1 LLM Mechanics, IV-1 What Evals Measure, IV-6 Adversarial Testing, IV-7 Red Teaming

**Tier B - Cut only if desperate (days 5-7, 10.5h):**
II-3 Prompt Engineering, II-9 Failure Modes, IV-2 Eval Datasets

**Tier C - Cut if behind schedule (days 8-14, 24.5h):**
II-4 Context Engineering, IV-3 Scoring, II-6 Verification, IV-4 Agent Eval,
II-2 Agent Architecture, I-1 Process Model, IV-8 Communicating Results,
II-7 Human-AI Interface
