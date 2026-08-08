+++
title = "The pole we hadn't looked at"
date = "2026-07-29"
description = "A fibre installation, one shared assumption, and a practical way to use an LLM as a support triage lead that chooses the next observation."
tags = ["ai", "human-ai-collaboration", "support-engineering", "troubleshooting", "systems-design"]
aliases = ["/next-observation/"]
draft = false

[build]
render = "always"
list = "never"
+++

Twenty minutes before a fibre installer arrived at my parents' house, my father and I were trying to work out where the new router should go.

The office was the natural home for it. The existing router was there, along with the telephone, power, and an Ethernet cable running up the outside of the house to my bedroom. The lounge was the easier fallback. It had an external wall, a nearby socket, and a convenient surface, although the prospect of putting a large router there had already failed a fairly decisive aesthetic review from my mother.

My father had been thinking about the route since the middle of the night. He'd followed the existing telephone cable, considered how a new line might pass beneath the eaves, found an unused television cable whose route might be reused, anticipated where the installer might object, and prepared the lounge option in case the office proved too awkward.

I recognised the method immediately. He was doing first-line support on a house: locating the constraint, modelling likely objections, and keeping a contingency ready before the person with the tools arrived.

I wanted to see where an LLM could come alongside that kind of manual reasoning. I recorded our conversation, transcribed it, supplied photographs of the rooms and exterior walls, and asked for a thin interpretive layer. What was known? What were we inferring? Which facts could be checked before the appointment?

The result was useful. It was also more revealing in its failure than in its success.

## What the model helped us establish

The LLM correctly identified that this was a routing problem rather than primarily a broadband-speed problem. Where the fibre entered the house would determine the router location, the useful life of the existing Ethernet, the quality of wireless coverage, and the fate of the telephone. It agreed that the office was the strongest topology, since keeping the router there would preserve the wired path to my room and avoid creating another connection between the lounge and office. It also identified the supplied router from a photograph and checked its capabilities.

The most useful technical test concerned the existing Ethernet cable. We had been talking as though it might be limited to 100 Mbps, which would have made it a bottleneck on the new connection. A local check showed that the path was negotiating at 1000BASE-T. That removed a real uncertainty before the engineer arrived and gave us a specific part of the existing setup worth defending.

The analysis also separated the family's working model into facts and guesses, including the distinction between the fibre termination and router, whether the existing phone number could be retained, and where a mesh unit might eventually help. It made that model explicit and tested some of its components. This was useful support work.

It also kept going.

We considered detailed Wi-Fi coverage upstairs, in the lounge, around the house, and into both gardens. We compared the office, lounge, and stairs as radio locations. We explored mesh, powerline, VoIP, wall materials, cable length, and what the provider might regard as a standard installation.

All of that was plausible. Most of it turned out to be downstream of one physical fact that none of us had established.

## The installer looked in another direction

When the installer arrived, he looked at the house from the provider's perspective. There was another pole serving a different corner of the building. From there, the fibre could come directly across, descend around the corner, pass beneath a sill, and enter the office.

My father and I had been looking at the existing telephone line and treating its origin as the likely origin of the fibre. The LLM inherited the same premise. It marked the exact fibre route as unknown, but still spent much of its effort analysing consequences of the route we had imagined.

The installer changed the geometry of the problem in a few seconds. The difficult journey around the house disappeared. The lounge fallback was unnecessary. The preferred office placement worked, and the existing gigabit Ethernet run could plug straight into the new router.

The outcome was close to our original preference, but the reason it was easy had escaped all of us. We had done quite a lot of good reasoning inside the wrong map.

That distinction matters in support engineering. A conclusion can be right while the model underneath it remains fragile. If the engineer had used another installation convention, or if that second pole had been unavailable, our elaborate branches might have become relevant. On this visit, one observation made most of them unnecessary.

## The question I should have asked first

Looking back, I had positioned the LLM as an analyst:

> Given this proposed route, what will work, what might fail, and what should we consider?

That tends to produce breadth. A capable model can keep expanding the dependency graph, especially when it has photographs, specifications, and a family conversation full of legitimate concerns.

For live support work, I increasingly want a different role. The LLM should act as a triage lead whose main job is to choose the next observation.

The question at the centre of that role is:

> What are we currently treating as true, and which one observation could invalidate the largest part of our model?

In the fibre problem, the shared assumption was that the new service would approach the house from roughly the same direction as the old telephone line. The most valuable observation was the actual serving pole and provider entry route. Until we had that, precise discussion of garden Wi-Fi or mesh placement was largely premature.

This is close to differential diagnosis. Several explanations remain live; the next test should distinguish between them. The model's ability to produce a comprehensive answer matters less than its ability to notice which piece of missing evidence has the greatest leverage.

## A short uncertainty-leverage loop

I now think the useful sequence for an ad hoc support problem is:

1. **State the decision.** Name what must be chosen in the available time.
2. **Separate observations, inferences, and assumptions.** Pay particular attention to anything inherited from the existing system or the first account of the problem.
3. **Find the decision-changing unknowns.** Ask whether a different answer would actually change the action.
4. **Rank them by leverage.** A rough guide is: likelihood of changing the decision, multiplied by the consequence of being wrong, divided by the time needed to resolve it.
5. **Choose the cheapest discriminating observation.** One command, log line, measurement, wide photograph, documentation check, or question to the person with direct knowledge.
6. **Run one test and update.** Resist opening every downstream branch while the upstream geometry remains uncertain.

The stopping rule matters. Once there is a preferred action, an acceptable fallback, and a precise question for whoever owns the missing evidence, more analysis can become latency disguised as diligence.

For this installation, a better twenty-minute result would have been a tiny brief:

- We prefer the office.
- The existing run to the bedroom negotiates at one gigabit.
- Which pole and entry route will you use?

Everything else could wait until the engineer answered the third line.

The same pattern appears in software support. A 502 from an API gateway can anchor me on an application exception or the most recent stack trace, whilst the decision-changing fact is that one gateway route still points at a retired backend pool. The error is local detail; the request path and ownership boundary are the topology. An LLM that keeps explaining the exception is useful only after someone has established which system actually handled the request.

## A reusable triage prompt

This is the compact version I would use next time:

```text
We have [time] to improve this decision.

Desired outcome:
[What success looks like]

Current preferred plan:
[Present hypothesis or action]

Evidence:
[Observations, logs, images, transcript, measurements]

Act as a support-triage lead.

1. Separate direct observations, inferences, and assumptions.
2. Identify the unknowns that could change the plan.
3. Rank them by decision leverage and time to resolve.
4. Look for anchoring on the existing system or initial framing.
5. Give me only the single highest-value next observation or test.
6. Tell me how to collect it and what each result would imply.
7. Stop after that test.
```

The final instruction is doing real work. Without it, an LLM is rewarded for being helpful across the whole apparent problem. Under time pressure, I need it to be usefully incomplete.

## Coming alongside the person who knows the house

I don't want to retell this as a competition between my father's pen-and-paper method and an LLM. His reasoning supplied the goals, constraints, preferences, likely objections, and fallback. It also identified the final topology we wanted. He knew the house in a way the model couldn't recover from a hurried set of photographs and a transcript.

The LLM externalised that model, separated certainty from assumption, researched specifications, and tested the Ethernet path. The installer supplied site-specific ground truth from experience and physical access. My family retained the decision about where the equipment should live.

Those roles complemented one another, although they did so imperfectly. The LLM added real signal, particularly when it moved from prose into an observable test. It became distracting when the amount it could say was mistaken for the amount we needed to know.

As a support engineer, that is the change I want to carry forward. I still want the fast transcription, broad recall, assumption register, and ability to turn a rough conversation into a tractable model. I also want the model to interrupt that expansion early and tell me which photograph, command, measurement, or human question would make the largest part of its own analysis obsolete.

My father had already worked out how to prepare intelligently for the engineer. The next improvement belongs in how I direct the machine standing beside him.
