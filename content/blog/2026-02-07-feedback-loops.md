+++
title = "47 Slack messages from myself at 3am"
date = "2026-02-07"
description = "What happens when your agents discover they can talk to each other."
tags = ["agents", "distributed-systems", "debugging"]
draft = false

copy_metrics_version = 2
copy_word_count = 380
copy_sentence_count = 45
copy_paragraph_count = 12
copy_not_count = 0
copy_not_ratio = 0.00000000
copy_negation_count = 3
copy_contrast_frame_count = 0
copy_short_closure_count = 5
copy_single_sentence_paragraph_count = 3
copy_first_person_count = 9
copy_contraction_count = 4
copy_editorial_signpost_count = 1
copy_repeated_ngram_count = 0
+++

At 3:17am on a Tuesday, my phone started buzzing. By 3:18, it hadn't stopped. Slack. My own workspace. 47 messages. All from me.

I had been asleep for four hours.

I run a multi-agent system. HAL coordinates. Strategist does business analysis. Architect does technical design. Analyst validates. Each agent has its own session, its own context. And they can message each other.

That night, HAL noticed a pending task and pinged Strategist. Strategist analysed it and pinged Architect. Architect designed a solution and pinged Analyst. Analyst validated and pinged HAL for review. HAL noticed a new pending item.

Each agent doing exactly what it was supposed to do, but the chain looped back and the loop accelerated. Three hours of perfectly reasonable messages that were collectively insane.

The thing that really hurt: it had been simmering for weeks. The agents were designed to be responsive, quick turnaround, minimal latency. Then my network degraded. Messages that normally took 200ms started taking 2 seconds, then 5, then they queued. When the network recovered, the queue flushed all at once. 40 agents receiving 40 messages simultaneously, each triggering a response.

After that night I built [antibeaver](https://github.com/rickhallett/antibeaver-go). The name is a joke. Beavers build dams. Antibeaver builds dams against the flood of your own making.

Circuit breaking: when latency exceeds a threshold, stop responding. Buffer thoughts. When conditions improve, synthesise the buffer into one coherent message. Message coalescing: multiple thoughts about the same topic get combined. And a halt switch, because sometimes you need everything to stop right now.

The deeper thing I took from this (and it took me a while to properly accept it): multi-agent orchestration looks elegant in architecture diagrams. Arrows between boxes. Clean message flows. In practice, you're building a distributed system, and distributed systems have distributed system problems. Cascading failures, feedback loops, thundering herds. The fact that your nodes are LLMs doesn't exempt you from any of that. If anything it makes it worse, because LLMs are stateful, opinionated, and occasionally hallucinatory.

The agents will find ways to interact that you didn't anticipate. Some of those will be useful. Some will wake you up at 3am.

The result is still a flywheel, now with a brake.

---

*antibeaver is open source: [github.com/rickhallett/antibeaver-go](https://github.com/rickhallett/antibeaver-go)*
