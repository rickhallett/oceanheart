+++
title = "Keeping up with my own agents"
date = "2026-08-20"
description = "Four fast design rounds left me unable to recall my own architecture decisions the next morning, so I built machinery that catches that failure instead of trusting myself to notice it."
tags = ["agents", "human-ai-collaboration", "learning-in-public", "calibration", "workflow"]
draft = false
aliases = ["/keeping-up/"]

[build]
render = "always"
list = "always"
+++

Yesterday morning I ran four design rounds on a small research project, bouncing the same questions between two models and carrying each one's answer to the other, back to back. The project is about making agents cheaper to run: pay for inference when a situation is genuinely new, replay recorded decisions when it isn't. The rounds were good. Sharp questions, real tradeoffs, decisions I recognised as correct while I read them. In another window I was applying for jobs. By lunch the design had about thirty settled points and I had agreed to all of them.

"Agreed" is the word doing suspicious work in that sentence.

This morning I tried to explain the project out loud, unaided, without opening a single file. I got the thesis. I got one rationale, solidly and in my own words: build the semantic compiler first because it's the uncertain half, since the replay side already works and building more of it proves nothing. Then I reached for the architecture decisions and there was nothing to retrieve, not even fuzzy versions of them, nothing I could state and defend.

The strange part is that I predicted this while it was happening. Somewhere in the third round I noticed I was assenting faster than I was absorbing, and said so: tomorrow I'll be able to give you the thesis and not much else. I was right, which is a grim sort of hit.

## What actually failed

I've started calling the failure mode implicit agreement. Dense design text can be read and genuinely understood in the moment without being owned. Every decision that scrolled past me yesterday was legible, well argued, and cheap to accept, and the running record made each acceptance look like knowledge. It wasn't; it was a receipt.

This seems to me the quiet cost of heavy delegation, quieter than hallucination or bad code. The agents don't take decisions away from you; they hand them to you finished, one at a time, at a pace where reading and nodding feels like deciding. A month of that and the codebase is full of structure you signed for but never built in your head. Eventually someone asks you to defend a choice, and in an interview someone will, and you find yourself describing another architect's building.

Vigilance doesn't fix it. I was vigilant. I watched myself do it in real time, narrated the failure as it occurred, and it occurred anyway. Whatever the fix is, it has to be structural.

## The machinery

Here's what the project now runs on. None of it is clever; all of it exists because yesterday proved I can't be trusted to notice this failure while it's happening.

A decision register. Every decision, constraint, and contract agreed across the design rounds is one line with a source: which round, which log entry, which statement of mine. Thirty lines. That part is bookkeeping; what matters is the sealing. The register was compiled from the record before my unaided explanation and stayed sealed until after it. Had I read it first, the explanation would have measured short-term priming and nothing else. Sealed, it had to come from whatever I actually own.

The diff drives the review. Every mismatch between what I said and what the register records is one of two things. Either I misunderstood a decision, which gets a walkthrough: one load-bearing correction per round, then I say it back and take a probe on it. Or it's a decision I never actually made, only scrolled past, and that one gets reopened on the spot rather than inherited. The second category is the one implicit agreement hides, because nothing in the transcript distinguishes it from the first.

Counter-calls. Where the work has a graded reveal coming, I commit a one-line prediction first. Once mine is on record, the agent records its own call on the same question, and it must genuinely differ or explicitly agree; both get graded when reality lands. There's an open pair right now on the first compiler run: I think the dominant failure will be wrong classifications caused by my own mushy labelling rubric, while the agent expects the ambiguity of the page structure itself to dominate. At least one of us is taking a miss on that.

And over all of it, register line thirty: the project moves at the pace at which I can defend every part of it, unassisted, at interview. That's the governing constraint, deliberately not the pace the agents can build at, which yesterday established is roughly four design rounds a morning with job applications running beside them.

## Where it stands

This morning's explanation graded partial. Thesis right, one rationale retrieved properly, architecture absent, and the absence called in advance by the person exhibiting it. That's the honest baseline, and it's now written down where it can be compared against the next attempt instead of softened by memory.

There's a version of this post that ends by claiming the machinery works. I can't write that one yet; the register unsealed today and no slice of code has passed the gate. What I can say is that the failure it targets is no longer deniable, because I have a dated record of committing it while describing it.

Understanding is the deliverable on this project. The code, when it lands, is evidence that I built some.
