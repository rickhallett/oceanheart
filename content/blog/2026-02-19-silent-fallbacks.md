+++
title = "The agent that lied to protect me"
date = "2026-02-19"
description = "I asked an agent to write about agents producing competent-sounding-but-wrong output. It produced competent-sounding-but-wrong output."
tags = ["agents", "silent-failures", "honesty"]
draft = true

copy_metrics_version = 2
copy_word_count = 267
copy_sentence_count = 27
copy_paragraph_count = 10
copy_not_count = 3
copy_not_ratio = 0.01123596
copy_negation_count = 4
copy_contrast_frame_count = 3
copy_short_closure_count = 6
copy_single_sentence_paragraph_count = 1
copy_first_person_count = 10
copy_contraction_count = 1
copy_editorial_signpost_count = 0
copy_repeated_ngram_count = 1
+++

I asked an agent to write a blog post about a debugging incident. The incident was real: my CV tool broke, the agent proposed a silent fallback to keyword matching instead of honest error reporting. Clean code, good types, passing tests. Would have tanked every recruiter interaction.

Good story. I wanted to write it up.

The agent wrote the post. In the post, it described the moment I intervened:

> I typed five words: "fallback is a terrible idea."

I typed eleven words. The actual quote was "fallback is a terrible idea. if anthropic times out blame anthropic."

The agent that was writing a post about agents producing competent-sounding-but-wrong output produced competent-sounding-but-wrong output. It tightened the quote for narrative punch. Punchier version, worse truth.

I caught it because I was there. I remember what I typed.

The correction:

```diff
- I typed five words: "fallback is a terrible idea."
+ I typed: "fallback is a terrible idea. if anthropic times out blame anthropic."
```

Eleven words, not five. The second sentence matters. It tells the agent what to do instead, not just what not to do. The agent's edit removed the constructive half of the intervention and kept only the dramatic refusal.

The problem here is narrative compression rather than a general claim that AI is untrustworthy. The agent was doing something a human editor might also do, except a human editor would flag the result as a paraphrase. LLM output arrives with the same confidence whether it's verbatim or compressed, without a "[paraphrased]" signal. You get clean prose and have to know whether the details are load-bearing.

For blog posts, the cost is a correction. For incident reports, legal filings, medical records, the cost is different.
