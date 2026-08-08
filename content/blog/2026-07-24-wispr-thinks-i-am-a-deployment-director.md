+++
title = "Wispr thinks I am a Deployment Director"
date = "2026-07-24"
description = "What 3,748 dictated AI prompts reveal about voice as the practical front door to my agents, deployment work, and everyday computing."
tags = ["agents", "voice", "wispr", "workflow", "human-ai-collaboration"]
aliases = ["/wispr/"]
draft = false

[build]
render = "always"
list = "always"
+++

[Wispr Flow](https://wisprflow.ai/) has decided I am a Deployment Director.

I wouldn't normally let a product-generated personality profile choose the title of an article. This one was irritatingly specific.

![Wispr Flow's voice profile naming me a Deployment Director and describing spoken orchestration of deployment work with OpenAI Codex.](/images/blog/2026-07-24-wispr-voice-profile.png)

The explanation says that my dictations orchestrate complex deployment workflows across platforms such as codex, claude, pi, hermes et al. That is close enough to my actual working day that it has almost escaped the category of flattering nonsense.

The companion card is more revealing. Wispr puts 77 per cent beside 3,748 AI prompts. Its other categories include 537 general tasks, 267 personal messages, 36 documents, 44 emails, and four work messages.

![Wispr Flow's breakdown of my dictated work, led by 3,748 AI prompts at 77 per cent.](/images/blog/2026-07-24-wispr-where-you-flow.png)

Those are Wispr's own categories, so I wouldn't pretend they form a controlled study. They still describe the centre of gravity accurately: I speak to agents far more than I use dictation to write emails or messages.

This is a close-up of the voice layer in [I do not use AI for one thing](/blog/2026-07-23-i-do-not-use-ai-for-one-thing/). That article covers the larger system: terminal agents, computer use, parallel workers, persistent context, private telemetry, and the practice I use to keep my own judgment visible. Wispr sits near the beginning of all of it. It makes the initial explanation cheap.

## The cheapest complete brief

I type quickly, but a keyboard still encourages me to edit while I am thinking. I shorten the sentence, tidy the sequence, and sometimes leave out the awkward clause that would take another minute to explain.

That awkward clause is often the useful part.

When I speak, I am more likely to include the uncertainty, the exception, the thing that must remain untouched, and the evidence that would persuade me the task is finished. I can explain why a seemingly obvious route is wrong, remember a related change halfway through, and then return to the original objective without losing the thread.

A typical instruction can include: begin in this repository; check which registered worktree contains the current version; preserve unrelated changes; make the article a draft; use the supplied images; build it locally; leave publication to me. Speaking makes that level of context feel proportionate even for a small job.

I don't regard this as a special prompting technique. It is ordinary speech made available inside whichever application already contains the work.

## The extra clauses carry the judgment

An agent can usually infer the mechanical middle of a task. It can find files, follow references, run checks, operate a browser, and assemble an output. The dangerous omissions tend to sit at the edges: which source is authoritative, which existing work belongs to somebody else, what must stay private, whether a change should be published, and what kind of evidence counts.

Voice gives me room to state those boundaries before the agent starts.

For deployment work, I can describe the current state, the desired state, the rollback boundary, and the live route that needs checking. During an investigation I can say what I suspect while also naming the evidence that would change my mind. For writing, I can explain the purpose, the reader, and the part that still feels unresolved before there is any polished copy to react to.

The resulting prompt may be longer, but length isn't the point. I have externalised more of the judgment that would otherwise remain in my head.

## A prompt becomes the first artefact

Wispr turns the spoken brief into text in the place where I am already working. I can inspect it, correct a filename or technical term, and decide whether it says what I mean before the agent receives it.

That matters because speech is loose. I repeat myself, change direction, use pronouns with questionable referents, and occasionally discover the actual request near the end of the sentence. A useful voice tool doesn't require me to sound like a person reading prepared copy. It gives that messy thinking a textual form which can be checked.

Once submitted, the text also becomes part of the task record. I can compare the result with what I asked for. If the agent wandered, I can distinguish a poor execution from a vague instruction. If it made a sensible inference, I can decide whether that inference belongs in the persistent project guidance next time.

This feedback loop is one reason voice works better for me than treating every prompt as disposable chat.

## Why there are so many AI prompts

The 3,748 figure makes sense because an AI prompt can now begin work in almost any part of the computer.

Some requests are substantial: investigate a production failure, draft an article from evidence, reorganise a project, or coordinate several agents across separate branches. Others remove a tiny piece of friction: find the canonical file, explain an unfamiliar setting, compare two outputs, rename a batch of assets, or check whether a page really changed.

I would postpone many of the small jobs if each one required me to translate the intention into a sequence of interfaces and commands. With voice, I can state the destination and the constraints. The agent handles much of the translation, then the existing checks tell me whether it arrived.

That is also why the AI category so thoroughly outweighs email and messaging in Wispr's summary. Dictation saves some typing in a message. In an agent instruction, the same speech can initiate research, tool use, implementation, and verification.

## I still use the keyboard

My day isn't hands-free. I read diffs, inspect rendered pages, correct names, write small probes, use conventional interfaces, and take over when direct manipulation is simpler.

Wispr changes where that keyboard time goes. I spend less of it carrying the same intention across applications and more of it reviewing the evidence produced by the work.

Faster delegation makes the surrounding controls more important. The agent still needs the right repository and branch. Unrelated work still needs protecting. Tests, static checks, browser evidence, and human review still have to earn their claims. A fluent spoken instruction can accelerate a bad idea as readily as a good one.

Wispr is upstream of those controls. It helps me express the objective and the judgment around it; the rest of the working system determines what may safely happen next.

The title on the profile is grander than I would have chosen. Still, Deployment Director catches something. Much of my day now begins by saying what I am trying to do, what must remain intact, and how I will know when it is finished. Wispr makes that speech available wherever the work already is.
