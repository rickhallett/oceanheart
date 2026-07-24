+++
title = "Voice fidelity without the RLHF circus"
date = "2026-04-10"
description = "Making AI output sound like one specific human, using structured rubrics and 20-50 scored examples instead of a quarter-million dollars of fine-tuning infrastructure."
tags = ["ai-engineering", "rlhf", "voice-fidelity", "eval", "dpo"]
draft = true

copy_metrics_version = 1
copy_word_count = 709
copy_not_count = 3
copy_not_ratio = 0.00423131
+++

I'm building a content pipeline for Aura - Daoist practitioner, Qi Gong teacher, someone whose audience knows her voice in three sentences. The AI-generated content needs to sound like *her*, not like a wellness content mill with the temperature turned up.

The obvious move is RLHF: train a reward model, run PPO and fine-tune weights until the model speaks in her cadence. For a single voice, that turns into a quarter-million-dollar infrastructure problem, so I'm taking a leaner route.

## Three stages

**INGEST.** Collect everything she's actually said: session recordings, writing, social posts and voice notes. Then structure it as a style corpus with explicit markers rather than a bag of words. Tone registers: where does she shift from warm to authoritative? Vocabulary signatures: which terms does she never deviate from? Cadence: short declarations or long breath-paced paragraphs? The ratio of warmth to precision, the way she lands a point.

**EVAL.** From the corpus, derive a scoring rubric. Five dimensions, each 1-10:

- **Vocabulary fidelity** - Her actual words, not synonyms, not "wellness speak"
- **Tone match** - Warmth-to-authority ratio in the right zone
- **Domain accuracy** - UHT lineage terms, practice names, tradition-specific language transcribed correctly
- **Cadence** - Sentence rhythm matches her patterns
- **Absence of slop** - No "in today's fast-paced world," no "unlock your potential," none of it

Seed this with LLM-as-judge baselines. Have a frontier model score a batch of outputs against the rubric before any human touches the system.

**TUNE.** Aura enters the loop. She scores generated content on the rubric dimensions. "This one sounds like me - 8. This one's close but the tone is off - 5. This one is generic garbage - 2."

High scores are "chosen," low scores are "rejected." Structured preference pairs - the same input that drives DPO - except you're using them for prompt-level optimisation. Dynamic few-shot selection, style-conditioned system prompts, retrieval-augmented example injection.

Twenty to fifty scored outputs should be enough to tell us whether this is moving the needle.

## Can this get 80% of fine-tuning quality?

Yeah. I think it can.

Most of the lift in RLHF comes from the preference signal, with weight updates providing one way to apply it. Full RLHF is expensive machinery designed for general alignment across millions of users. I'm aligning one voice for one client, which makes the problem space radically smaller.

**Structured rubrics do the heavy lifting.** When you decompose "sounds like Aura" into 4-5 scored dimensions, you've turned a vibes problem into a measurement problem. LLM-as-judge with a well-constructed rubric already correlates 0.7-0.8 with human preference. Zheng et al. (2023) found that this was comparable to inter-annotator agreement between humans themselves.

**Few-shot preference pairs are shockingly effective.** The DPO paper (Rafailov et al., 2023) showed direct preference optimisation matching or exceeding PPO-based RLHF on summarisation and dialogue without a separate reward model. More relevant here, preference pairs used for few-shot selection and prompt conditioning can produce meaningful style transfer before any weights move. The model sees what "right" looks like repeatedly and with structure.

**The corpus is the moat.** Retrieve the 3-5 most relevant examples of how Aura *actually said something similar*, inject them as few-shot context, and you're doing style transfer without any training. The retrieval quality is the differentiator. That alone might be 60% of the lift.

## What the last 20% costs

The remaining route is fine-tuning, perhaps with LoRA on a smaller model. The moment you take it, you're managing model artifacts, versioning, inference infrastructure, and regression testing across base model updates, which is a different business.

## The play

Build the rubric and eval pipeline first because you need it to *know* whether fine-tuning is worth the spend. If prompt engineering plus structured few-shot gets you to the point where Aura reads the output and says "yeah, that's me", ship it.

If she consistently scores 6/10 on tone and you can't push past it, *then* you have a quantified case for fine-tuning, along with the preference dataset needed to start.

The pipeline is the product either way. Fine-tuning remains an optional turbocharger to bolt on if the data says the additional machinery is justified.
