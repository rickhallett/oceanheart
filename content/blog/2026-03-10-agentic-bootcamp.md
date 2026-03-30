+++
title = "The Agentic Engineering Bootcamp"
date = "2026-03-10"
description = "A first-principles curriculum for SWEs who steer AI agents. Five bootcamps, 51 steps, 208-259 hours. From Linux primitives to evaluation pipelines."
tags = ["bootcamp", "agentic-engineering", "linux", "learning"]
+++

## The observation

I spent a month building software with AI agents and tracking where things went wrong. The taxonomy of agent-native software that came out of it showed something I should have expected: 75% of software categories reduce to CLI and API operations. Pipes, text streams, file descriptors, process management. The agent-native stack is Linux.

But the substrate is only the beginning. Once you can verify system-level output, you face a harder problem: evaluating whether an agent's reasoning is sound, whether its retrieval is relevant, whether its memory is coherent, and whether your evaluation of all these things is itself rigorous. The verification problem is fractal - it exists at every layer.

## The problem

When an agent constructs a pipeline that silently drops data on a broken pipe, or generates a shell script with a quoting bug that only surfaces on filenames containing spaces, or claims a process is healthy when it's a zombie - the human operator has to catch it. That's the job now. You steer and verify.

If you don't understand what a file descriptor is, you can't diagnose why an agent's redirection is wrong. If you don't understand process groups and signals, you can't tell whether an agent's cleanup logic actually works. If you don't understand how `set -euo pipefail` interacts with subshells, you can't evaluate whether an agent's error handling is real or cosmetic.

This creates what I've been calling an oracle problem. The human is supposed to be the final verification layer. But if the human doesn't understand the substrate, errors pass through every layer uncaught. The verifier becomes the vulnerability.

The same problem scales upward. If you don't understand how LLM tokenisation affects prompt engineering, you can't tell whether an agent's context window is being used well. If you don't understand evaluation methodology, you can't tell whether your "95% accuracy" metric measures what you think it measures. If you don't understand retrieval, you can't tell whether an agent's RAG pipeline is returning relevant documents or just similar-looking ones.

## What I built

A structured self-study curriculum in five parts.

### Bootcamp I: Linux Substrate (12 steps, 51-65 hours)

The foundation. Starting from the process model and building up through shell, filesystems, text processing, Python CLI tools, Make, git internals, process observation, containers, networking, and process supervision.

The ordering follows a dependency graph. Step 1 is the Unix process model - fork, exec, file descriptors, pipes, signals - because everything else composes on top of it. Shell is step 2 because shell is the language that orchestrates processes. Filesystems are step 3 because state lives on disk.

```
Process model
  -> Shell language
     -> Text pipelines (grep/sed/awk/jq)
     -> Make/Just (orchestrates shell recipes)
     -> Python CLI tools (when shell hits its ceiling)
  -> Filesystem as state
     -> Git internals (versioned filesystem)
  -> Process observation (strace/lsof/ss)
     -> Container internals (namespaced processes)
  -> Networking
  -> Process supervision
  -> Advanced bash
```

### Bootcamp II: Agentic Engineering Practices (11 steps, 50-61 hours)

How LLMs work mechanistically (tokenisation, attention, generation), agent architecture patterns, prompt and context engineering, tool design, verification methodology, the human-AI interface, multi-model strategies, failure mode taxonomy, governance, and the cost/security/legal dimensions. This is the conceptual layer that sits between knowing the substrate and being effective at steering agents.

### Bootcamp III: Operational Analytics (10 steps, 32-40 hours)

Data analysis with Python for engineering decision-making. Tabular data with pandas, descriptive statistics, SQL analytics, statistical testing, time series analysis, visualisation, log analysis, cost modelling, text analysis, and notebook workflows. Not data science for its own sake - analytics as a tool for understanding what your agents are doing, how much they cost, and whether they're improving.

### Bootcamp IV: Evaluation and Adversarial Testing (9 steps, 39-48 hours)

What evaluations measure and what they don't. Dataset design, scoring and grading (including LLM-as-judge), agent evaluation with frameworks like Inspect AI, evaluation infrastructure and CI/CD integration, adversarial testing methodology, red teaming for safety, interpreting results without fooling yourself, and building an evaluation culture. This is directly aligned with the work being done at Anthropic and other frontier labs on AI safety evaluation.

### Bootcamp V: Agent Infrastructure in Practice (9 steps, 36-45 hours)

The retrieval problem and why naive similarity search is insufficient. Embeddings and vector search, RAG pipeline engineering, advanced retrieval patterns (hybrid search, reranking, agentic RAG), state management, conversation memory, observability and tracing, debugging agent systems, and production deployment patterns. Grounded in the project's own file-based state architecture as a worked example.

## How I ranked it

Three criteria for ordering within each bootcamp:

**Compositional leverage.** Does understanding this concept make everything above it easier? The process model scores highest in Bootcamp I because file descriptors, pipes, and signals appear in every subsequent step. In Bootcamp IV, understanding what evaluations actually measure scores highest because every subsequent step depends on knowing what you're trying to quantify.

**Return per hour.** How much capability does each hour of study produce? Text pipelines score well in Bootcamp I. Prompt engineering scores well in Bootcamp II. Both open large surface areas of practical work for relatively small time investment.

**Irreplaceability.** Can an agent compensate for the operator's ignorance, or must the operator know this? If an agent generates a shell script and you don't understand process substitution, the agent can't help you verify its own output. If an agent writes an evaluation harness and you don't understand the difference between accuracy and calibration, the agent's metrics are uninformative. You either understand the concepts or you don't, and the agent's confidence is uninformative either way.

## The dependency structure across bootcamps

The five bootcamps are ordered by dependency, not difficulty.

Bootcamp I (substrate) is prerequisite for everything. You cannot debug agent-generated shell scripts, containers, or deployment configurations without understanding how the operating system works.

Bootcamp II (agentic practices) requires I. You need the substrate knowledge to understand what agents are actually doing when they "write code" or "use tools."

Bootcamp III (analytics) requires I and benefits from II. Data analysis skills feed directly into evaluation and debugging work.

Bootcamp IV (evaluation) requires II and benefits from III. You cannot build meaningful evaluations without understanding what agents are, and analytics skills make evaluation data actionable.

Bootcamp V (infrastructure) requires I, II, and benefits from IV. Production agent systems need substrate knowledge, agentic understanding, and ideally evaluation methodology to validate that the infrastructure works.

## What it is not

This is self-study material I wrote for myself and am publishing because it might be useful to others. It is not a certified programme. There is no credential at the end. The only test is whether you can read agent-generated code and tell when it's wrong - at the system level, at the prompt level, and at the evaluation level.

Each step has interactive challenges you run in the same environment you're learning about. There are no separate lab setups. The terminal you're reading in is the terminal you practice in.

Where a concept has a good origin story - Ken Thompson's fork, Doug McIlroy's pipes, Linus Torvalds's git object model, the BLEU score's limitations - I include it. Not for decoration. Historical context creates memory anchors that make the mental model stick.

Every section connects explicitly to agentic engineering. The question "why does this matter when agents write code?" gets a concrete answer for every topic.

## Who this is for

Software engineers who work with AI agents and want to be competent at governing the full stack of output - from shell scripts to evaluation pipelines. You probably already write code daily. You might use agents for development. You may have noticed that you sometimes can't tell whether an agent's output is correct, and that bothers you.

The total estimated time is 208 to 259 hours across all five bootcamps. That is a substantial investment. But you don't need to do all five. The first three steps of Bootcamp I (process model, shell, filesystem) are roughly 20 hours and change how you read everything an agent produces at the system level. Bootcamp IV alone (evaluation and adversarial testing) is 39-48 hours and covers the methodology that frontier AI labs use to assess model safety and capability.

## Source

- Curriculum overview: [/bootcamp/](/bootcamp/)
- Bootcamp I steps: `docs/bootcamp/01-process-model.md` through `12-advanced-bash.md`
- Bootcamp II-V outlines: `docs/bootcamp/BOOTCAMP-{II,III,IV,V}-OUTLINE.md`
- Derived from: `docs/research/agent-native-software-taxonomy.md`
- Conventions: no emojis, no em-dashes, all examples runnable on Arch/Debian/Ubuntu
