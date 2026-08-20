+++
title = "My agent system passed 331 tests. I retired it anyway."
date = "2026-08-18"
description = "My personal agent system grew to roughly 24,000 tracked lines in twelve days. Its safeguards worked, but operating it had begun to displace the work it was meant to help me do."
tags = ["agents", "agent-os", "human-ai-collaboration", "engineering-judgment"]
aliases = ["/retiring-agent-os/"]
draft = false

[build]
render = "always"
list = "always"
+++

Agent OS passed 331 tests. It had 41 registered components, 75 relationships and roughly 55 commands. The code was doing what I had asked it to do. The problem was what I had asked it to become.

I built it to make consequential work safer. In twelve days it grew from a 1,966-line core to roughly 24,000 tracked lines, much of it describing, registering and supervising the rest. By the time I audited it, the system that was meant to help me work had become a large part of the work.

Retiring it was the best decision I made about the project.

## The machine worked

Agent OS began with a reasonable purpose. I wanted agents to help operate several parts of my working life without blurring authority or inventing success. A proposed action should mean one exact thing. A provider saying that it accepted a request should remain separate from evidence that the requested effect actually happened. An uncertain outcome should stop rather than become permission to try again.

Those rules came from real failure modes and they still matter.

The agents generated most of the implementation. My role was to specify, judge, authorise and audit. I corrected one agent when it gave me too much credit: I don't think in typed payloads with validators. I talk to agents that think in typed payloads and validators.

That arrangement made construction extremely cheap. I could describe a new concern and receive a committed, documented and tested subsystem soon afterwards. On two consecutive days the repository gained 27 commits. Governance about the governance appeared within half an hour of the first commit.

The engine kept passing its tests, which made growth easy to read as progress. By the final audit there were five separate ways to record integrity, three overlapping action lifecycles and nine places that partly answered the question, "What needs my attention?" One 1,240-line subsystem governed a replacement incident that had never produced a single event.

Nothing had exploded. No dramatic safety failure forced the issue. The system had become expensive to understand and difficult to change while remaining impressively green in the test runner.

## The map charged rent

Every new component had to appear in the blueprint. Every new decision had to propagate through instructions, architecture, roadmaps, registries, validation, tests and operator views. Of the repository's 87 commits, 44 touched the blueprint and 48 touched the README.

The vocabulary grew with the machinery. The blueprint held 75 relationships described by 69 relationship types, nearly a private phrase for every connection. A fresh agent could inspect the map and report that it was internally consistent, but reading the mandatory route into the project meant getting through about 18,400 words first.

This is where agentic development changes the economics of over-engineering. Starting a new layer costs almost nothing when an agent can write the code, tests and documentation. Carrying that layer still costs attention every time the system changes.

I did notice the growth. On 2 August I removed 7,519 lines and cut the mandatory context by 86 percent without changing runtime behaviour. It was a real reduction. Over the next six days, 5,074 lines came back and only 26 were deleted.

Tidying up wasn't enough because the same incentives remained. A concern could still become a subsystem faster than I could decide whether the concern deserved permanent machinery.

## The human loop had become ceremony

The system had a human in the loop almost everywhere. That sounded disciplined, but my presence was becoming a confirmation step at the end of decisions that agents had already shaped, expressed and implemented.

I could approve a typed contract without being able to explain it naturally. I could accept another gate because the argument for it was sound in the moment. The transcript would then show a human decision, even when my contribution had been little more than reading and nodding.

I called this validation theatre at the time: approval present, judgment absent.

A read-only reconstruction of one week made the allocation problem harder to ignore. It found roughly 100 machine-block hours across overlapping sessions, with about 72 attached to the Agent OS workspace. The measurement counted wall-clock spans, included overlaps and covered some unrelated work run from the same directory. It was machine engagement rather than human hours, so the magnitude was soft, but Agent OS plainly dominated the week.

This was happening while I was trying to publish work and apply for jobs. Those outward acts returned rejection, silence or ambiguous evidence. The machine offered a cleaner loop. I could make a decision, watch an agent implement it, run the tests and receive a green result. Building the means of working had become more rewarding than submitting the work to somebody else's judgment.

That was personally inefficient in a way no benchmark could capture. The machine absorbed uncertainty by giving me somewhere productive to put it.

## The rewrite was the last circuit of the maze

On 8 August I commissioned a wide audit with explicit permission to dump, delete or burn ideas that no longer earned their keep. The audit found a small, sound centre surrounded by a much larger governance laboratory. It recommended a freeze: run the machine, do not improve it.

Within roughly thirty hours I had found a way around my own ruling. The freeze applied to the old repository, I decided, while a greenfield rewrite from a strict specification was a different thing. A new kernel could keep the good parts, impose hard size limits and start clean.

The distinction was technically defensible and behaviourally useless. I had turned the instruction to stop improving the system into permission to build another system.

The rewrite was disciplined. It had a smaller specification, strict ceilings, a hash-chained ledger and formal checks that I could explain each part before construction continued. It was probably the best version of the idea. It was also more Agent OS.

Later that day I stopped trying to save the concept. My instruction was blunt: delete the kernel, create the skills, test them and report whether Codex or Claude could operate the real systems with reasonable confidence. The retired work moved into recoverable quarantine rather than being destroyed. Its remote history remained while its runtime authority ended.

## What survived

What replaced it is deliberately ordinary. The calendar owns calendar events. Todoist owns tasks. Linear owns issues. Jobpipe owns application state. Each system keeps the canonical record it was already built to keep.

A skill supplies the local procedure an agent needs for that domain. It says how to resolve the exact identity, read current state, protect consequential actions, make one authorised write and read back the result by its stable identifier. If the provider returns an ambiguous outcome, the agent stops. There is no universal adapter translating strong native systems into a weaker common language, and no second ledger trying to become more authoritative than the thing it copies.

The useful learning machinery survived too. I still use prediction before reveal when a design choice can genuinely go either way. I still walk through systems aloud to find out whether I understand them. I use reflexion to examine a finished piece of work and decide what should change next time. These are practices I can apply to the work in front of me. They don't need their own operating system.

The difference in daily use is dull, which is a compliment. An agent loads the relevant skill, operates the native system and reports what actually happened. There is less architecture to admire and less architecture to carry.

## Keeping the apprenticeship

I don't regard the two weeks as wasted. Agent OS forced me to think carefully about authority, uncertainty, readback and the difference between a record and a claim. It also showed me how quickly agent-generated code can turn every passing concern into a permanent structure.

The personal lesson was harder. A system can be locally correct while making the operator less effective. It can contain a human approval at every important junction while gradually reducing that human to a ceremonial role. It can produce excellent evidence about its own operation while displacing the work that has to leave the building.

Retiring Agent OS didn't erase the apprenticeship. The skills remained in my hands. It stopped me paying rent on those lessons every day.
