+++
title = "What remains when you subtract the interface?"
date = "2026-03-21"
description = "Every piece of software can be decomposed into computation, interface, and feedback. For an agent, the interface is overhead."
tags = ["agent-native", "taxonomy", "software"]
draft = true

copy_metrics_version = 2
copy_word_count = 294
copy_sentence_count = 17
copy_paragraph_count = 8
copy_not_count = 1
copy_not_ratio = 0.00340136
copy_negation_count = 2
copy_contrast_frame_count = 1
copy_short_closure_count = 4
copy_single_sentence_paragraph_count = 1
copy_first_person_count = 5
copy_contraction_count = 0
copy_editorial_signpost_count = 0
copy_repeated_ngram_count = 0
+++

{{< draft-notice >}}

## The decomposition

Every piece of software does three things: computation, interface, and feedback. Computation is the work - transforming data, applying rules, producing output. Interface is how a human sees and controls the computation. Feedback is how the system reports results back.

For an agent operating programmatically, the interface is overhead. Syntax highlighting, progress bars and drag-and-drop are human perception affordances, and they consume the majority of engineering effort in most software.

So I asked: what happens when you subtract the interface? What remains?

## The method

I assessed 48 software categories across 10 sections. For each one I identified:

- **Core operations** - what the software actually computes
- **GUI tax** - what the graphical interface adds beyond computation
- **CLI/API surface** - whether programmatic access exists today
- **Agent-native form** - what the software looks like without a GUI
- **Taste boundary** - where human judgment remains irreducible
- **Verdict** - fully reducible, mostly reducible, taste-required, or irreducible

The verdicts describe what is possible today with existing tools and APIs, rather than speculating about future capabilities.

## The taxonomy

The 48 categories break into 10 sections: productivity, development, creative, communication, system/infrastructure, data/analysis, web/content, finance/business, consumer, and additional engineering. Each section gets its own post in this series.

The short version: about three quarters of what I assessed can be done entirely or mostly from a CLI or API. The exceptions cluster around creative work (where someone needs to look at the output) and two things that are just fundamentally human activities - video calls and gaming.

What surprised me was how much of daily software, from an agent's perspective, is GUI chrome over operations that were always available programmatically. Not in theory - right now, with existing tools.

## Source

- Full taxonomy: `docs/research/agent-native-software-taxonomy.md`
- Series: posts 01-10 cover each section in detail
