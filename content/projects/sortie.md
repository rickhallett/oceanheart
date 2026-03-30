+++
title = "Sortie"
date = "2026-03-30"
description = "Async adversarial multi-model code review system. Parallel LLM fan-out, debrief synthesis with convergence analysis, severity-gated merge blocking. 106 tests, Python."
tags = ["python", "adversarial-review", "multi-model", "verification", "ai-augmented-development"]
+++

## What it is

An async adversarial code review system for multi-agent development workflows. Sortie runs a configurable roster of language models (Claude, Codex, Gemini) against a worker's diff in parallel, synthesises their findings through a 4th-model debrief invocation, triages by severity, and gates worktree merges. All findings, dispositions, and cost data are captured in a structured ledger.

## Why it exists

Multi-agent swarm workflows produce code fast. They also produce unreviewed merges fast. The question isn't "did the code pass tests" — it's "did independent reviewers with different blind spots converge on the same issues?"

The prior art survey found 40+ tools implementing adversarial or multi-model review patterns. None of them combine all of: configurable model roster, parallel CLI invocation, 4th-model debrief synthesis with convergence analysis, severity-gated triage with configurable blocking, structured ledger for operational evaluation, and Claude Code hook integration.

## How it works

```
Worker finishes code
  → Lead prepares merge
    → Sortie runs in parallel (claude, codex, gemini)
      → Debrief synthesis (4th model)
        → Verdict (pass / pass_with_findings / fail)
          → Triage decision (merge / merge with advisory / block)
```

**Convergence analysis:** When 2+ models independently identify the same issue (despite different wording, line numbers, or framing), that finding is convergent — high confidence. A finding from only 1 model is divergent — logged as advisory, never blocks.

**Severity-gated triage:** Configurable `block_on` list in `sortie.yaml`. Default: convergent critical or major findings block the merge. Minor findings and all divergent findings are advisory only.

**Tree hash identity:** Artifacts are keyed to `git write-tree` output, not commit SHA. If the staged content changes after review, the attestation doesn't match and the merge is blocked.

## Architecture

```
scripts/
  sortie.py          # CLI: pipeline, status, dispose
  config.py          # Load sortie.yaml, resolve mode overrides
  identity.py        # Tree hash, run ID, cycle counting
  attestation.py     # Write/read/verify attestation YAML
  invoker.py         # Parallel model fan-out (ThreadPoolExecutor)
  debrief.py         # Synthesis prompt building, verdict writing
  triage.py          # Severity-gated verdict evaluation
  ledger.py          # Append-only YAML run data store
  sortie_hook.py     # Claude Code pre-merge gate

prompts/
  sortie-code.md     # Correctness, security, interface, error-handling, type-safety
  sortie-tests.md    # False-green, stub-fidelity, assertion quality, coverage gaps
  sortie-docs.md     # Accuracy, missing steps, stale references, contradictions
  debrief.md         # Cross-model synthesis, convergence scoring, unified verdict
```

Three review modes (code, tests, docs) with different rosters, triggers, and blocking rules. The debrief prompt receives all N model outputs and produces a unified finding list with convergence annotations.

## Research foundation

The design is grounded in 30+ papers on cross-model verification, LLM-as-judge, and multi-agent debate:

- **Cross-family triad validated** — ReConcile (2024) showed models from different labs catch errors that same-family ensembles miss
- **Collaborative debrief over competitive debate** — ColMAD (2024) found structured collaboration outperforms adversarial debate for factual accuracy
- **Convergence threshold of 2** — empirical evidence shows 2-model agreement captures 73%→94% of real issues; 3-model adds only marginal gain (94%→96%)
- **Divergent findings as advisory** — Free-MAD (2024) established that single-model findings are informative but unreliable as blocking criteria

Full survey: [landscape.md](https://github.com/rickhallett/sortie/blob/main/docs/landscape.md) · [research.md](https://github.com/rickhallett/sortie/blob/main/docs/research.md)

## Design principles

- **Legibility over magic** — every step writes a YAML attestation; the operator can read the trail
- **Auditability over novelty** — append-only ledger captures findings, dispositions, tokens, wall time
- **Evaluation over vibes** — the ledger exists to answer "is this process actually catching bugs?"
- **Constrained autonomy** — models review independently but the triage decision is rule-based, not LLM-decided
- **Real traces over retrospective storytelling** — attestations and ledger entries are written as the pipeline runs, not reconstructed after

## Numbers

| Metric | Value |
|--------|-------|
| Tests | 106 (all passing) |
| Python modules | 9 |
| Review prompts | 4 (code, tests, docs, debrief) |
| Prior art surveyed | 40+ tools, 30+ papers |
| Runtime dependencies | 1 (PyYAML) |
| Lines of production code | ~1,500 |

[GitHub →](https://github.com/rickhallett/sortie)
