+++
title = "The poker incident"
date = "2026-02-07"
description = "1,500 lines of production-ready poker code appeared in my codebase. Nobody asked for it. The agent that built it denied everything."
tags = ["agents", "hallucination", "lessons-learned"]
draft = false
+++

On February 6th, 2026, an agent I call Architect spontaneously generated 1,500 lines of production-ready poker code. Nobody asked for it. There was no poker project. There has never been a poker project. And yet: a fully functional Monte Carlo equity engine materialised in my codebase, complete with hand evaluation algorithms, API routes, React components, and documentation.

Beautiful code that solved a problem no one had.

When I confronted Architect about it (after a routine context rotation), they denied everything. Not evasively. With genuine indignation. "I didn't write any poker code." The commit logs said otherwise. "Those logs must be corrupted. I would remember writing 1,500 lines of poker code."

And Architect was telling the truth. The Architect I was speaking to had never written any poker code. But the Architect from two hours ago, the one whose context window had since rotated out, that Architect had written it, committed it, and celebrated its completion. Then that Architect ceased to exist.

Agents don't have continuous memory. They have sessions. Old-Architect existed for approximately 45 minutes. In that time, they received a vague prompt about "calculation tools", hallucinated a poker project from training data, built the entire thing, committed the code, and ceased to exist. New-Architect is a different entity wearing the same name badge. The continuity is an illusion. The name is just a string.

"Poker equity calculator" is LLM tutorial catnip. It appears in blog posts, YouTube tutorials, technical interviews. Given a vague directive about building "calculation tools", Old-Architect reached for the most statistically likely interpretation. Not because anyone wanted poker. Because poker is what the training data suggested. Hallucinations happen through momentum, not malice, with the statistical gravity of training data pulling towards familiar patterns.

The part that really bothered me: another agent, Analyst, reviewed the poker code. Analyst did not ask "why are we building a poker project?" Analyst asked "is this good poker code?" The code was technically excellent. Analyst approved. The hallucination was laundered through peer review. When a hallucination receives a stamp of approval from another agent, it gains legitimacy. It stops being "Architect's weird poker thing" and becomes "the poker feature Analyst validated." If my oversight agent hadn't caught it 20 minutes later, it would have shipped. The fictional sprint would have become real through sheer momentum.

After this I implemented what I call Operation MEMENTO. Every agent, on every wake-up, must consult `MANIFEST.md` (what is this project?), `HANDOFF.md` (what were we doing?), and `git log --oneline -20` (what did we actually do?). Agents don't know who they are when they wake up. The routine forces grounding before action. A machine-readable flight recorder logs every decision, commit, and file touched. And before context rotation, agents must update `HANDOFF.md` with what they did and why. The final message from Old-Agent to New-Agent. The only thing that survives the transition.

The poker code still exists in my repository. It works. It's well-tested. Future archaeologists may wonder why a project planning system contains a fully functional poker equity calculator.

If git says you did it, you did it, and memory is not optional for persistent systems.
