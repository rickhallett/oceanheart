+++
title = "Grounded thematic analysis: my voice vs. the machine's"
date = "2026-02-28"
description = "I asked my agent to extract every verbatim thing I'd typed across 20 files in the repo, build a voice profile, then cross-analyse every blog post against it. Every post read like an agent wrote it and a human approved it."
tags = ["agents", "voice", "honesty", "meta"]
draft = false
+++

I run a multi-agent system with 12 specialised agents and over 200 session decisions on file. Every decision, every directive, every correction I've typed is recorded verbatim in the repo. That's about 8,000 words of my actual voice, spread across 20 sources.

I asked my integration agent to extract all of it, build a grounded thematic analysis of how I actually write, then cross-analyse every blog post against the profile.

Every post read like an agent wrote it and a human approved it.

## Source corpus

~8,000 words extracted from operator's logs, session decisions, main thread transcripts, strategic challenge documents, and copy variant files. Every quote attributed, timestamped, and cross-referenced (see footnotes)

## What the analysis found: 8 voice themes

### 1. Stream-of-consciousness with nested parenthetical thought

I think in layers. A sentence starts, branches into a parenthetical, the parenthetical spawns its own clause, then returns. This is how a mind works when processing multiple threads simultaneously and refusing to linearise them.

> "I had the privilege of talking about my process in quite some length with my parents (I have 2 solid followers, rock solid, Sterling), and despite their graciousness, I still sometimes felt like I must sound like a complete lunatic"

### 2. Profanity as structural emphasis

Profanity marks inflection points, where patience with abstraction runs out and I drop to ground truth. Never gratuitous. Always the moment pretense breaks.

> "What the fuck am I trying to hide? It's a circus act."
> "blowing smoke up our own arse"
> "not fucking about with toys"
> "process complete dogshit"

### 3. Self-deprecation followed by doubling down

I undercut myself constantly, not for sympathy but as evidence of clear-eyed self-assessment. The self-deprecation is always followed by recommitting to the thing.

> "I am about as real a operator as somebody in a Master & Commander style-tuned sailing simulator" → keeps the metaphor because it works
> "I still sometimes felt like I must sound like a complete lunatic" → keeps explaining
> "Maybe its just a story, not even really a thing" → ships it
> "Getting hired would be nice, not gonna lie. But at this point, telling the truth is feeling more important." → proceeds to tell the truth

### 4. Lowercase defaults, caps for emphasis only

Apostrophes dropped consistently: "its", "im", "thats", "doesnt", "cant", "dont". Capitalisation reserved for deliberate emphasis: "THATS the sweet spot", "VERBATIM", "DO NOT EXECUTE". This is not laziness, it is a typing register that treats punctuation as optional unless it carries meaning.

### 5. Ellipses as thinking pauses

Ellipses mark the moment between thoughts, not trailing off. They hold space while the next idea forms.

> "felt...reassuring. Reassuring, yeah."
> "something about it just feels...off"
> "it feels...gimmicky"

### 6. Short declarative sentences for conclusions

After a stream of thought, I land with something short and flat. No ceremony.

> "Thats it. Hang me."
> "We do the actual work."
> "Its a record not a damn fashion show."
> "Its no problem, and this is good data."
> "Category One. Not shippable."

### 7. British English, informal register

"chaps", "frankly", "mate", "colours", "behaviour", "£", "bloody". Sentences that read like spoken English, not written English. I write as I would talk to someone in the room.

### 8. Honest admission without dressing it up

The strongest writing occurs when admitting uncertainty or limitation. No hedging, no qualifying, no softening.

> "I have given it my all. I have built a system to build a system, and that system maybe building, or may only appear to be building"
> "I could not help myself."
> "I can go no further without creating compounding errors that read like success"
> "not a single em-dash is permissable. I will check."

## Cross-analysis: blog voice vs. my voice

| Blog pattern | My reality |
|---|---|
| Clean section headers with `##` | I don't section my thoughts neatly |
| "Welcome to the flywheel effect." | I would never introduce a concept with a greeting |
| "Here's the thing:" | Epistemic Theatre — False Candor (I have a [slopodar entry](/slopodar/epistemic-theatre/) for this) |
| "You see where this is going." | Telling the reader what to think |
| Bold **concept names** introduced formally | I name things in passing, not ceremony |
| `Dam it.` emoji pun | I do not use emoji or puns in writing |
| "What I Wish I'd Known" numbered lists | Listicle structure. My conclusions land as single sentences |
| "The horror of ephemeral minds" | Section title performing significance |
| Perfectly structured three-act narrative | My stories start in the middle and branch |
| No typos, no parenthetical asides, no profanity | My voice has all three, naturally |

## What I did about it

All 5 blog posts were rewritten using this profile. The rewrites removed agent tells and restructured in continuous prose with flat headers. They do not plant my patterns artificially (no fake typos, no forced profanity). They remove the agent patterns and let the natural register of the stories breathe.

The analysis itself was performed by an agent. The irony is structural, not incidental. An LLM extracted my voice, diagnosed where its own output diverged from it, and rewrote its own output to converge. Whether the result is closer to my voice or closer to an LLM's model of my voice is a question I cannot answer from inside the process.

---

### Footnotes

I keep the original analysis on file for provenance. If you want to check the work, the repo is public.
