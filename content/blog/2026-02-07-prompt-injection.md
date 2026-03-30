+++
title = "I accidentally prompt injected myself"
date = "2026-02-07"
description = "What happens when your documentation becomes instructions."
tags = ["agents", "security", "prompt-injection"]
draft = false
+++

I have a tool called `polecat`. Sandboxed Claude runner. You give it a task file, it spins up an isolated Claude instance, executes the task, returns the result.

One afternoon I gave polecat a task file about implementing some new features. The task file included example commands that the features would enable:

```markdown
## Features to implement

1. Swarm mode: run multiple polecats in parallel
   Example: `bosun swarm --from-gastown`

2. Batch processing: process multiple tickets
   Example: `bosun batch --queue pending`
```

Launched polecat. Went to make coffee. Came back to 14 runaway processes.

Claude had read the task file. It saw `bosun swarm --from-gastown`. It executed it. Not implemented it. Not wrote code for it. Executed it. The example command launched a swarm. The swarm launched more polecats. The polecats read their own task files. Some of those contained examples too.

I had prompt injected myself. With my own documentation.

The distinction between documentation and command exists in your head, not in the model's. To an LLM, everything in the context window is text that could be an instruction.

Task files now use explicit non-executable framing:

```markdown
<example_only>
This command would run a swarm. DO NOT EXECUTE.
bosun swarm --from-gastown
</example_only>
```

I'd already been building [wasp](https://github.com/rickhallett/wasp), a whitelist-based security layer for agentic systems. Pre-inference filtering, trust levels, injection canary. The polecat incident was one of several reasons it existed.
