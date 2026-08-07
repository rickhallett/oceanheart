+++
title = "Human OS"
date = "2026-07-24"
description = "An early-stage launch cockpit for a creative collaborator: one calm shared surface for decisions and experiments, with private source material, explicit human authority, and agent machinery kept behind it."
tags = ["human-ai-collaboration", "workflow", "linear", "onboarding", "context-engineering"]
track = "ai"
tier = "notable"
weight = 15
status = "early collaboration"
caseStudy = "/blog/2026-07-24-the-first-feature-was-a-pleasant-place-to-begin/"
+++

{{< claude-coach
  prompt="Read https://www.oceanheart.ai/projects/human-os/ and interrogate the operating architecture with me: the boundary between Linear and the private repository, human authority over agent-ready work, the dedicated-workspace privacy decision, and whether the experiment cadence will hold up in a real collaboration."
  title="Interrogate this architecture"
  description="Open a Claude conversation primed to examine the sources of truth, privacy boundary, human-agent handoffs, and pace of the collaboration."
  action="Discuss it with Claude" >}}


## What it is

Human OS is an early-stage, two-week launch cockpit for a creative collaborator. It is designed to let useful work begin without asking the collaborator to become a project manager or learn an agent stack first.

The shared surface is deliberately small: Linear holds current work, decisions, owners, and short updates; a private Git repository holds research, source records, and evidence; Excalidraw is available when a picture explains the system better.

## What I built

- A dedicated Linear workspace so the collaboration has its own privacy boundary.
- A five-phase project, initial decision backlog, labels, views, issue template, and onboarding guide.
- A simple default workflow, with labels describing the kind of attention needed rather than adding bespoke process states.
- Idempotent setup through the Linear API, followed by a live read-back of the resulting workspace.
- Explicit boundaries for human decisions, agent-ready work, private material, and participant data.

The project remains deliberately provisional. Discovery and human priorities determine which two or three interventions are worth testing; the machinery does not set the pace.

[Read the build note &rarr;](/blog/2026-07-24-the-first-feature-was-a-pleasant-place-to-begin/)
