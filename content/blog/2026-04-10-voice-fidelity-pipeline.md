+++
title = "Voice fidelity without the RLHF circus"
date = "2026-04-10"
description = "Making AI output sound like one specific human, using structured rubrics and 20-50 scored examples instead of a quarter-million dollars of fine-tuning infrastructure."
tags = ["ai-engineering", "rlhf", "voice-fidelity", "eval", "dpo"]
draft = true

copy_metrics_version = 1
copy_word_count = 723
copy_not_count = 7
copy_not_ratio = 0.00968188
+++

I'm building a content pipeline for Aura — Daoist practitioner, Qi Gong teacher, someone whose audience knows her voice in three sentences. The AI-generated content needs to sound like *her*, not like a wellness content mill with the temperature turned up.

The obvious move is RLHF. Train a reward model, run PPO, fine-tune weights until the model speaks in her cadence. That's a quarter-million-dollar infrastructure problem for a single voice. There's a leaner way.

## Three stages

**INGEST.** Collect everything she's actually said. Session recordings, writing, social posts, voice notes. Then structure it — not as a bag of words, but as a style corpus with explicit markers. Tone registers: where does she shift from warm to authoritative? Vocabulary signatures: which terms does she never deviate from? Cadence: short declarations or long breath-paced paragraphs? The ratio of warmth to precision, the way she lands a point.

**EVAL.** From the corpus, derive a scoring rubric. Five dimensions, each 1-10:

- **Vocabulary fidelity** — Her actual words, not synonyms, not "wellness speak"
- **Tone match** — Warmth-to-authority ratio in the right zone
- **Domain accuracy** — UHT lineage terms, practice names, tradition-specific language transcribed correctly
- **Cadence** — Sentence rhythm matches her patterns
- **Absence of slop** — No "in today's fast-paced world," no "unlock your potential," none of it

Seed this with LLM-as-judge baselines. Have a frontier model score a batch of outputs against the rubric before any human touches the system.

**TUNE.** Aura enters the loop. She scores generated content on the rubric dimensions. "This one sounds like me — 8. This one's close but the tone is off — 5. This one is generic garbage — 2."

High scores are "chosen," low scores are "rejected." Structured preference pairs — the same input that drives DPO — except you're using them for prompt-level optimisation. Dynamic few-shot selection, style-conditioned system prompts, retrieval-augmented example injection.

Twenty to fifty scored outputs is enough to move the needle hard.

## Can this get 80% of fine-tuning quality?

Yeah. I think it can.

The dirty secret of RLHF is that most of the lift comes from the preference signal, not the weight updates. Full RLHF — PPO, reward model training, policy optimization — is expensive machinery designed for general alignment across millions of users. I'm aligning one voice for one client. The problem space is radically smaller.

**Structured rubrics do the heavy lifting.** When you decompose "sounds like Aura" into 4-5 scored dimensions, you've turned a vibes problem into a measurement problem. LLM-as-judge with a well-constructed rubric already correlates 0.7-0.8 with human preference — Zheng et al. (2023) showed that's comparable to inter-annotator agreement between humans themselves. That's not a ceiling, that's parity.

**Few-shot preference pairs are shockingly effective.** The DPO paper (Rafailov et al., 2023) showed direct preference optimisation matches or exceeds PPO-based RLHF on summarisation and dialogue — without a separate reward model. But the deeper insight: even without weight updates, preference pairs used for few-shot selection and prompt conditioning produce meaningful style transfer. You don't always need to move the weights. Sometimes you just need to show the model what "right" looks like, repeatedly, with structure.

**The corpus is the moat.** Retrieve the 3-5 most relevant examples of how Aura *actually said something similar*, inject them as few-shot context, and you're doing style transfer without any training. The retrieval quality is the differentiator. That alone might be 60% of the lift.

## What the last 20% costs

Fine-tuning. LoRA on a smaller model. And the moment you fine-tune, you're managing model artifacts, versioning, inference infrastructure, and regression testing across base model updates. That's a different business.

## The play

Build the rubric and eval pipeline first. It's valuable regardless — you need it to *know* whether fine-tuning is worth the spend. If prompt engineering plus structured few-shot gets you to the point where Aura reads the output and says "yeah, that's me" — you're done. Ship it.

If she consistently scores 6/10 on tone and you can't push past it, *then* you have a quantified case for fine-tuning, and you already have the preference dataset to do it. No cold start.

The pipeline is the product either way. The fine-tuning is an optional turbocharger you bolt on when the data tells you to — not before.
