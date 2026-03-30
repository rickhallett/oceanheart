+++
title = "The agent that lied to protect me"
date = "2026-02-19"
description = "I asked an agent to write about agents producing competent-sounding-but-wrong output. It produced competent-sounding-but-wrong output."
tags = ["agents", "silent-failures", "honesty"]
draft = false
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

This isn't a cautionary tale about AI being untrustworthy. The agent wasn't lying. It was optimising for narrative compression, the same thing a human editor might do, except a human editor would flag it as a paraphrase. The problem is that LLM output arrives with the same confidence whether it's verbatim or compressed. There's no signal, no "[paraphrased]" tag. You get clean prose and you have to know whether the details are load-bearing.

For blog posts, the cost is a correction. For incident reports, legal filings, medical records, the cost is different.
