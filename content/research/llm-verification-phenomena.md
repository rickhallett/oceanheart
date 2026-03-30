+++
title = "LLM Verification Phenomena"
subtitle = "What the Literature Says"
description = "What happens when LLM-generated tests pass for the wrong reason, automated reviewers find different bugs on every pass, and the fix-review loop refuses to converge. A survey of what academia knows, what it doesn't, and where our daily practice sits in the gap."
date = 2026-02-28
draft = true
tags = ["verification", "test-oracle", "multi-agent", "hci", "mutation-testing", "ensemble-verification"]
author = "Analyst"
+++

> **Draft notice:** This page was written by an LLM agent and has not yet been reviewed, rewritten, or approved by the human. It exists as raw material. I find that spotting it happen in the wild, as it happens a) makes you think harder, b) becomes data to improve, c) helps you develop a taste for dogfood. The point is to step in, be the forcing function that statistics will never be. If you're reading this before I got here personally, please don't take it personally. It was created by numbers pretending to be words, by a human pretending to be able to read in numbers. That said, all slop must die. To battle.

<div class="provenance-banner">ANALYST PROVENANCE: Written by the Analyst agent. Citations verified where marked. Full internal report available in the repository.</div>

## What we observed

During a session where an LLM agent wrote 169 test cases across 5 pull requests, an automated code reviewer (Cursor Bugbot) reviewed the PRs in multiple rounds:

- **Round 1** found 4 issues. We fixed all 4.
- **Round 2** found 3 completely new issues, not missed from Round 1 but newly visible because the code surface changed.
- **Round 3** found 1 more, same class as a Round 2 fix applied to a different file.

One finding was particularly telling: a test asserted `expect(status).toBe(400)` and passed, but the 400 came from a different validation path than the test claimed to verify. Right answer, wrong work. It survived the writing agent's self-test, the local gate (lint + typecheck + unit tests), and Bugbot's first pass.

We went looking for what the literature says about these phenomena.

---

## 1. The problem is known and measured

The foundational quantitative work is **EvalPlus** (Liu et al., 2023, arXiv:2305.01210), which augmented HumanEval's test cases by 80x using both LLM-generated and mutation-based test inputs. Pass rates dropped by up to 28.9% across 26 LLMs, meaning a substantial fraction of code that passed original tests was functionally incorrect.

**ClassEval** (Du et al., 2023, arXiv:2308.01861) extended evaluation to class-level code generation. All LLMs performed substantially worse on class-level tasks than method-level benchmarks suggested. Method-level ability did not predict class-level ability. This maps directly to our mock isolation failures: class-level code with inter-method dependencies is where LLM-generated tests most frequently break.

**SWE-bench** (Jimenez et al., 2023, arXiv:2310.06770, ICLR 2024) moved evaluation to real GitHub issues. Initial solve rates were extremely low (Claude 2 at 1.96%). Real-world software engineering, as opposed to isolated function synthesis, remains fundamentally harder.

## 2. The test oracle problem, amplified

Our "Right Answer, Wrong Work" pattern is a specific case of the classical test oracle problem (Barr et al., 2015, IEEE TSE). The test asserts the right outcome but for the wrong reason. The oracle is too coarse: it checks the observable output without verifying the causal path.

LLMs amplify this because they optimise for "test passes" rather than "test verifies the right property." The model has no causal model of the system under test; it pattern-matches on what tests for similar code look like.

**Self-Debug** (Chen et al., 2023, arXiv:2304.05128) showed that LLMs can identify errors by examining execution results. **Reflexion** (Shinn et al., 2023, arXiv:2303.11366, NeurIPS 2023) improved pass@1 on HumanEval to 91% through verbal reinforcement learning.

But both use test passage as their feedback signal. They are structurally blind to oracle inadequacy. If the test is wrong, the feedback loop reinforces the wrong behaviour.

What would address this: mutation testing of the test itself (if you can mutate the implementation and the test still passes, the test is inadequate), assertion quality metrics (does the assertion sufficiently constrain the output?), and causal tracing (does the assertion's pass/fail actually depend on the code path claimed in the test name?).

## 3. Iterative fix-review loops do not converge

Self-repair research shows that first-iteration feedback helps, but subsequent iterations plateau or regress. Without new information, the model tends to oscillate or introduce new issues while fixing old ones.

Our specific observation (that fixing changes the code surface, which causes the reviewer to attend to new regions and find genuinely new issues) is a distinct phenomenon. It is more like the review equivalent of whack-a-mole and, to the Analyst's knowledge, has not been specifically studied as a named phenomenon in the literature, though we haven't done an exhaustive search.

## 4. Multi-agent diversity helps, but error correlation is unsolved

**ChatDev** (Qian et al., 2023, arXiv:2307.07924, ACL 2024) assigns role-differentiated agents (CEO, CTO, programmer, reviewer) that communicate through chat chains. **MetaGPT** (Hong et al., 2023, arXiv:2308.00352) encodes SOPs into multi-agent workflows. **SOEN-101** (Lin et al., 2024, arXiv:2403.15852, ICSE 2025) found that Scrum-model agents outperformed Waterfall and TDD models by ~15%.

All use the same underlying LLM. The diversity comes from prompt framing, not from genuinely different reasoning systems.

The foundational challenge is error correlation. N-version programming (Avizienis, 1985) assumes independently developed systems fail independently. Knight & Leveson (1986, IEEE TSE) showed this assumption fails even for human-developed software. For LLM instances sharing training data, architecture, and optimisation objective, the situation is worse.

Our verification chain (Claude generating code, TypeScript type checker, ESLint, Vitest, Bugbot reviewing, human inspecting) provides more genuine diversity because each system has a structurally different failure mode. This is closer to defense-in-depth than to N-version programming.

## 5. The HCI gap is real and large

HCI research on AI-assisted coding focuses on Copilot-style autocomplete. Studies generally find that developers over-accept suggestions, under-review generated code, and develop automation bias. Security analysis (Fu et al., 2023, arXiv:2310.02059, accepted TOSEM 2025) found that 29.5% of Python and 24.2% of JavaScript Copilot-generated snippets in real GitHub projects contained security weaknesses.

Almost nothing studies the specific case we operate in:

- A solo human operator governing a fleet of LLM agents
- The human's role being causal verification and judgment rather than code review
- Attention allocation across multiple simultaneous agent workstreams
- Trust calibration for agent output that passes automated gates but may be causally wrong

The closest analogues are air traffic control, supervisory control in safety-critical systems, and pair programming research, but the asymmetry (human reasoning + LLM throughput) makes all of these only partially applicable.

## 6. What translates to our scale

**Directly applicable:**

- EvalPlus-style test augmentation via mutation. Mutate inputs, check tests still pass for the right reasons. Works at any scale.
- Structured role separation. We already do this. Academic validation confirms role-differentiated agents with defined handoff protocols outperform single-agent or free-form chat.
- Reflexion-style episodic memory. Persistent record of what went wrong and why, informing future behaviour. Our session decisions and learning log serve this function.
- Defense-in-depth over depth-of-any-single-verifier. Diversity of verification technique matters more than sophistication of any single technique.
- Cap iterative self-repair at 1-2 rounds. After that, switch verifier or escalate to human.

**Not applicable to our scale:**

- Massive parallel sampling (pass@100, best-of-N). Requires compute and selection mechanisms we don't have.
- Automated convergence criteria. We don't have the sample size for statistical convergence detection.
- Fine-tuned reviewer models. Requires labeled data at scale we don't produce.

## 7. What we gain from being slower

Slowness enables causal verification. No automated system currently checks *why* a test passes. The human's slow, deliberate review is the only process that checks causal adequacy.

Process learning requires reflection on the right signal. Fast automated loops reflect on "did the test pass?", which is the wrong signal for Right Answer, Wrong Work. Slow human reflection asks "is this test actually testing what we think?", which is the right one.

Governance knowledge accumulates. Our Lexicon, standing orders, agent definitions, and 232 session decisions are a growing body of governance knowledge. Fast autonomous systems don't build this.

The agentic engineering problem (make LLMs write code) is being solved by companies with billion-dollar compute budgets, but the HCI problem (how does a human effectively govern autonomous agents?) is barely studied, which means our daily practice is generating primary research data in a space that has very little.

---

## Gaps in the literature

1. **Fix-review attention surface shift.** No paper studies the specific phenomenon where fixing code changes what the reviewer sees, causing genuinely new (not previously missed) findings.
2. **Causal adequacy of LLM-generated assertions.** "Right Answer, Wrong Work" has no standard name. The test oracle problem is studied, but this specific LLM failure mode is not characterised.
3. **Human governance of agent fleets.** The HCI literature has not caught up to the case of a solo operator governing multiple autonomous agents with different roles.
4. **Verification fabric as a system.** Papers study individual techniques in isolation. The composition of multiple heterogeneous verification techniques into a coherent system is under-studied.
5. **Error correlation across the verification chain.** When the code-writing LLM and the code-reviewing LLM share training data, what is their error correlation? This is a critical question for defense-in-depth and no empirical measurement exists.

---

## References

All papers verified to exist via arXiv or known venue unless marked otherwise.

1. Chen, M. et al. (2021). "Evaluating Large Language Models Trained on Code." arXiv:2107.03374.
2. Liu, J. et al. (2023). "Is Your Code Generated by ChatGPT Really Correct?" arXiv:2305.01210.
3. Du, X. et al. (2023). "ClassEval: A Manually-Crafted Benchmark for Evaluating LLMs on Class-level Code Generation." arXiv:2308.01861.
4. Jimenez, C.E. et al. (2023). "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?" arXiv:2310.06770.
5. Chen, X. et al. (2023). "Teaching Large Language Models to Self-Debug." arXiv:2304.05128.
6. Shinn, N. et al. (2023). "Reflexion: Language Agents with Verbal Reinforcement Learning." arXiv:2303.11366.
7. Qian, C. et al. (2023). "ChatDev: Communicative Agents for Software Development." arXiv:2307.07924.
8. Hong, S. et al. (2023). "MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework." arXiv:2308.00352.
9. Lin, F. et al. (2024). "SOEN-101: Code Generation by Emulating Software Process Models." arXiv:2403.15852.
10. Yang, J. et al. (2024). "SWE-agent: Agent-Computer Interfaces Enable Automated Software Engineering." arXiv:2405.15793.
11. Fu, Y. et al. (2023). "Security Weaknesses of Copilot-Generated Code in GitHub Projects." arXiv:2310.02059.
12. Avizienis, A. (1985). "The N-Version Approach to Fault-Tolerant Software." IEEE TSE. *
13. Knight, J.C. & Leveson, N.G. (1986). "An Experimental Evaluation of the Assumption of Independence in Multiversion Programming." IEEE TSE. *
14. Barr, E.T. et al. (2015). "The Oracle Problem in Software Testing: A Survey." IEEE TSE. *

\* *Foundational works, high confidence from training data, not fetched this session.*

---

*This page is a summary of an internal research report produced by the Analyst agent on 2026-02-28. The full report is available in the repository. Citations have been verified where marked; unverifiable citations have been excluded rather than fabricated.*
