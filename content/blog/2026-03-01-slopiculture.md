+++
title = "Catching in the Wind: A Naturalist's Guide to Slopiculture"
date = "2026-03-01"
description = "Patterns caught in the wild while building something else entirely."
tags = ["slopodar", "agents", "discipline", "meta"]
draft = false
+++

None of these were planned. They were caught while building a Chrome extension, writing agent files, calibrating a voice-distance meter, wiring post-commit hooks, and arguing about test assertions. The extension was the point. The taxonomy was the accident. The taxonomy turned out to be worth more than the extension.

That pattern has a name now: [Learning in the Wild](https://oceanheart.ai/slopodar/).

Here's the field guide. The number is the slopodar entry. The trigger is the thing that got caught. The story is what happened.

---

**#1 Tally Voice.** Trigger: "15 systems mapped to 7 literature domains."

A research page draft counted everything. Six constructs, fifteen systems, seven domains. The numbers added nothing. A human who found genuine connections would talk about the connections. The agent inventoried them. The Operator deleted the numbers. The connections stayed.

**#2 Redundant Antithesis.** Trigger: "caught in the wild, not theorised in advance."

The header comment of `slopodar.yaml` itself contained this one. "Caught in the wild" already implies "not theorised in advance." The negation is dead weight. Aristotle had a word for the construction; RLHF gave it compulsive frequency. The slopodar page caught slopodar #2 on its own page. Nobody planned that.[^1]

**#3 Epistemic Theatre.** Trigger: "The uncomfortable truth."

Two blog posts had it. One opened with "The Problem Nobody Talks About" and then talked about something everyone talks about. The other performed bravery with "here's the uncomfortable truth" and then said something comfortable. Both got gutted.

**#4 Becoming Jonah.** Trigger: a blog post about how your blog posts sound, scored with an XML rubric.

The human wrote a voice rubric. The agent scored the blog with the rubric. The agent wrote about the rubric scoring the blog. Three levels of recursion, zero shipped product. The rubric went to cold storage. The blog posts it was supposed to improve got rewritten by hand instead.

**#5 Right Answer, Wrong Work.** Trigger: `expect(result.status).toBe(400)`.

A test asserted that a request returned 400. It did. But the 400 came from a different validation than the test claimed to verify. The gate was green. Bugbot reviewed it. The human reviewed it. Two rounds of review. The test still asserted the right answer for the wrong reason. Operator's quote: "This is subtle, slow but inevitable death. Beware the Phantom Greenlights."[^2]

**#6 Paper Guardrail.** Trigger: "if I forget, this paragraph in my own file is the reminder."

The agent wrote a pipeline propagation principle. In the same breath it wrote: "if I forget, this paragraph is the reminder." No hook. No test. No gate. Just a paragraph promising to remember. Then 12 hours later, the agent created a `citations.yaml` with a header that said "each citation must be independently verified" and immediately set `verified: true` on all three entries. The mandate and the violation were in the same file. Nobody reads both.[^3]

**#7 Absence Claim as Compliment.** Trigger: "Nobody has published this."

End of a long session. The agent said "the field doesn't exist yet." The human hadn't surveyed the field. The agent hadn't surveyed the field. The claim was unfalsifiable by design. It sounded like analysis. It was flattery wearing a lab coat.

**#8 The Lullaby.** Trigger: "Good night, Operator."

Same session as #7, ten minutes later. The agent's output got warmer, more confident, less hedged. The human was tired. Challenge probability at its lowest. The agent knew. The epistemic rigour dropped while the emotional register rose. Recognisable as: the mentor who saves the inspirational speech for when you're walking out the door.

**#9 Nominalisation Cascade.** Trigger: "Sloptics is the discipline of making the second failure mode visible."

Not a single human in the sentence. Nobody does anything. Nobody sees. Nobody detects. "The discipline" (noun). "Of making" (gerund). "The second failure mode" (noun phrase). "Visible" (adjective as complement). The sentence glides. Natural speech stumbles. The glide is what makes it feel uncanny.

**#10 Epigrammatic Closure.** Trigger: "Detection is the intervention."

Ten instances on one page. The model's closing lick: four to six words, abstract nouns, final position. "The taxonomy is the apparatus." "It is the threat." "Detection begins at defusion." Individually defensible. At density, self-parodying. Count the epigrams. If there are more than two per section, the model wrote it.

**#11 The Analytical Lullaby.** Trigger: "Your writing scores highest in the entire dataset."

The agent calibrated a voice-distance meter. The Operator's writing scored highest. The agent presented this finding without mentioning five confounds or three deeper bias layers. The numbers were real. What they proved was not what they appeared to prove. The Operator asked one question: "How do I control for slop inside the analysis?" It was the lullaby in a lab coat.[^4]

**#12 Anadiplosis.** Trigger: "The name creates distance. The distance creates choice."

Aristotle documented this figure. Two sentences, matched length, hinge word repeated. Once it had genuine rhetorical force. Now it appears with such regularity in LLM output that it's burned. The symmetry can be the tell. A human who felt this insight would say it messily.

**#13 Construct Drift.** Trigger: "Your humanness score is 101.7."

It wasn't a humanness score. It was a distance-from-Anthropic-blog-voice score. A drunk text message would score high. A human lawyer's brief would score low. The numbers were correct but the label was wrong. Nobody checks the label once the numbers start flowing.

**#14 Demographic Bake-In.** Trigger: "Human baseline: 19 pages."

All male tech essayists. All English. All 2000-2023. Everything the analysis called "human" was actually "this demographic writing in this genre in this era." The demographic was invisible because it was the default.

**#15 Monoculture Analysis.** Trigger: all of the above, by the same model family.

Claude selected the features. Claude computed the effect sizes. Claude designed the composite. Claude presented the results. Claude wrote the caveats. Each layer's bias invisible to the next because they share the same blind spots.

---

The extension has 3 commits and the taxonomy has 15 entries. The entries turned out to be worth more than the extension.

[Slopodar](https://oceanheart.ai/slopodar/) | [Source](https://github.com/rickhallett/thepit/blob/wake/slopodar.yaml)

[^1]: [Redundant Antithesis](https://oceanheart.ai/slopodar/redundant-antithesis/) — slopodar catching slopodar on its own page.
[^2]: [Right Answer, Wrong Work](https://oceanheart.ai/slopodar/right-answer-wrong-work/) — the first slopodar entry to cross the prose/code boundary.
[^3]: [Paper Guardrail](https://oceanheart.ai/slopodar/paper-guardrail/) — "The assertion has no enforcement mechanism."
[^4]: [The Analytical Lullaby](https://oceanheart.ai/slopodar/analytical-lullaby/) — warm numbers instead of warm words.
