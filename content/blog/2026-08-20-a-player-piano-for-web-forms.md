+++
title = "A player piano for web forms"
date = "2026-08-20"
description = "Measuring a compiled browser executor against a model-in-the-loop baseline on the same form, to test whether an agentic pipeline can pay inference for novelty instead of paying it for every action."
tags = ["agents", "automation", "systems-design", "workflow", "experiments"]
aliases = ["/pianola/"]
draft = false

[build]
render = "always"
list = "always"
+++

Most browser agents ask a model what to do before every click. That puts inference on the hot path, so the cost of a run scales with the number of actions in it. Fill thirty fields and you pay for thirty decisions, every time, even when the form hasn't changed since yesterday.

Pianola is a small project built around the opposite premise: an agent driving a browser should pay inference for novelty. The name is the design. The model is the pianist, invited in to perform a form once. The performance compiles into a roll - a declarative JSON plan you can read before it runs. A deterministic executor, the mechanism, replays the roll over raw Chrome DevTools Protocol at machine speed for as long as the form stays the same. When the form changes and the roll tears, you call the pianist back for one repair, and the repaired roll serves every run after.

That's the claim. It's falsifiable, so the first thing the repo grew was the instrument to falsify it.

## Two arms, one action layer

Same fixture form, two arms. One arm replays a compiled plan. The other puts Opus 5 in the loop, deciding every action from a per-turn snapshot of the form.

The part I care most about defending is what the arms share. Both drive the browser through one extracted action layer: the same trusted input dispatch, the same locate strategies, the same raw CDP transport (Puppeteer or Playwright would've shipped faster, and would've hidden exactly the layer this project studies). I did that refactor for experiment validity. If each arm drove the browser its own way, the table below would compare two implementations. With the layer shared, the decision-maker is the only variable.

The baseline also got deliberately favorable settings: effort low, compact snapshots, one small JSON action per turn. Both arms finish at the same deterministic asserts, because I don't accept the model's own "done" claim as a finish line. I wanted a compiled-replay win, if one came, to be a win over a lean baseline.

## The table

| arm | model calls | tokens (in/out) | wall | asserts |
|---|---|---|---|---|
| compiled replay | 0 | 0 / 0 | 112.8 ms | 6/6 |
| model-in-the-loop (Opus 5, effort low) | 5 | 6125 / 119 | 16.2 s | 4/4 |

Roughly 143x on wall clock. Before the run I predicted the baseline at 10 calls and 45 seconds; it came in at 5 calls and 16.2 seconds, which my calibration log grades as a miss. Opus drove the loop cleanly - no wasted turns, no parse failures, and a correct refusal to touch submit - so the gap can't be blamed on a flailing model.

The call structure matters more than the ratio. The baseline spent one call per action plus one to declare done: O(actions) with a small constant. On a four-action fixture that constant looks harmless. A thirty-field application form scales the calls and the snapshot tokens linearly, while the compiled arm stays flat plus one authoring call. Marginal cost per run came out around $0.034 for the baseline at list prices, and about zero for replay.

One caveat went straight into the devlog: 99.2 percent of baseline wall time was model inference, so the comparison is inference latency against local execution. That is precisely the thesis, but fixture-sized snapshots (about 1.2K tokens per turn) understate what perceiving a real form costs. Live numbers for the baseline would be larger, not smaller.

## The live confirmation

A fixture proves the mechanism without proving the premise survives contact with production. So the next roll was compiled against a real form in my job-application pipeline, a live production SPA, and played attended from a headless scratch profile.

7/7 steps, 6 verifications, 1.23 s of wall, 0 model calls. Name, email, resume PDF, LinkedIn and GitHub URLs all landed and read back correct. Of that 1.23 s, 322 ms was waiting for the SPA to render; essentially all of it was network and paint, none of it inference. The 143x gap in the fixture table was not a fixture artifact.

Nothing was submitted. The plan schema has no submit action, which is a property of the format rather than a promise: a human finishes every performance.

## Where the cost actually lives

The cost model is short enough to state in one breath. One authoring call per novel form. Zero calls per replay. One repair call when a roll tears, and the repair persists in the roll, so every later run inherits it free.

The first tear happened usefully early, on the fixture. The upload step failed with "Could not find node with given id" because the executor handed setFileInputFiles a nodeId it had no right to use. One fix (pass the objectId alone), no blind retry, and the replay came back clean. That one was an executor bug, no fault of the form, but the recovery has the shape the design bets on: diagnose once, amend, and the amendment persists.

What I don't know yet is the real tear rate. A form that changes weekly turns the authoring call into a subscription; a form that never changes makes it a one-off purchase. The fixture can't answer that, and neither can one live form.
