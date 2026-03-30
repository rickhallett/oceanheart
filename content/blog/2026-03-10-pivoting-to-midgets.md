+++
title = "From SaaS to containers: why I pivoted to agent-native Linux"
date = "2026-03-17"
description = "I built a SaaS product with 13 agents and 274 passing tests. Then I realised the conventions were the output, not the code."
tags = ["midgets", "pivot", "agents", "linux", "containers"]
draft = true
+++

{{< draft-notice >}}

## What The Pit was

The Pit was a SaaS debate platform. I built it over 30 days with 13 AI agents, a governance system I was developing alongside it, and a verification pipeline that got more elaborate every week. 274 tests passing. TypeScript, Next.js, the full modern stack. It worked.

I didn't realise until near the end that the product wasn't what I'd actually been building.

## What actually came out

The SaaS is archived on a git branch. What actually came out of the month was different:

- A **vocabulary** for talking about human-AI engineering failure modes - 40 named anti-patterns caught in the wild, which I call the slopodar
- A **layer model** (L0-L12) mapping the full stack from model weights to human operator
- **Named foot guns** - 6 failure modes specific to human-AI teams that I kept tripping over (spinning to infinity, high on own supply, dumb zone, context pressure, compaction loss, cognitive deskilling)
- A **verification pipeline** where 3 different models review the same diff independently, then a 4th synthesises their findings
- **Operational conventions** that compound - a lexicon, a readback protocol, formatting conventions that reduce ambiguity

The interesting thing is that all of this transfers to any project. The SaaS doesn't.

## Why midgets

The thesis: on Linux, you create bespoke, minimal, agent-native software. The machine is the agent's sandbox.

A Docker container (Ubuntu 24.04 + Xvfb + fluxbox + xdotool + scrot) where an AI agent can see the screen, click, type, and control applications through a `steer` CLI wrapper. 10/10 tests passed.

Three ideas:

1. **Agent-native software** - text interfaces, composable primitives, structured feedback. Built for agents, not adapted from human GUI apps.
2. **Operational training** - through trial and error, the human-agent system develops custom conventions that compound over time. Distinct from ML training.
3. **Linux as agent OS** - Linux never abandoned the CLI. Every GUI is optional. The system is fully operable from a terminal.

## What carries forward

The governance system, the anti-pattern taxonomy, the vocabulary, the verification discipline - all of it came with me to the new project. It's process infrastructure, not tied to any particular product.

The Pit's product code sits on `phase2`, frozen. The conventions travel.

## Source

- Product code (archived): `github.com/rickhallett/thepit-v2`, branch `phase2` (274/274 green)
- Governance (active): `github.com/rickhallett/midgets`
- POC: Dockerfile, `steer/`, `test-poc.sh` (10/10)
