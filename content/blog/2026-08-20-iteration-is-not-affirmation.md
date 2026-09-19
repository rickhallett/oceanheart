+++
title = "Iteration is not affirmation"
date = "2026-08-20T18:00:00Z"
description = "Two days of rigorous-feeling design rounds, a working app, some NotebookLM podcasts, and a premise nobody had tested. Notes from catching it late."
tags = ["agents", "calibration", "judgment", "process"]
draft = true

copy_metrics_version = 2
copy_word_count = 783
copy_sentence_count = 48
copy_paragraph_count = 9
copy_not_count = 3
copy_not_ratio = 0.00383142
copy_negation_count = 15
copy_contrast_frame_count = 4
copy_short_closure_count = 3
copy_single_sentence_paragraph_count = 1
copy_first_person_count = 23
copy_contraction_count = 22
copy_editorial_signpost_count = 0
copy_repeated_ngram_count = 0
+++

This week I built a product in about two days with an agent. A behavioural training protocol for calibrated AI use - predict what the model will do before it answers, run a bounded trial, score the prediction, extract a rule - plus the software to run it: a thesis document, three design docs, a Postgres schema with an integrity trigger, a scoring engine with tests, a working web app. The commit history is tidy. The design docs are genuinely good.

The process felt like the best engineering I'd done in months. We used a format I'd asked for: the agent drafts a design doc, then grills me on every decision in it, one round at a time, with recommendations I could accept or push back on. Fourteen decisions on the data model. Ten on scoring. Nine on privacy. Each round ended with an explicit empty-frontier check before the doc was declared committed. It felt rigorous because, locally, it was rigorous. Every individual decision got real scrutiny from what is, frankly, incredibly talented help.

I even fed the thesis into NotebookLM and generated podcasts so I could listen to two AI hosts discuss it on my walk. They debated the premise. They raised the counterarguments. And somehow, listening to a produced conversation about my idea made the idea feel more important. Not more correct. More important. I noticed that distinction later than I'd like.

Then I used the thing, and it came apart in my hands in about ten minutes. The product's central claim is that it makes your prediction tamper-proof: locked before the model's output exists. Except we'd built the AI part out-of-band, so the "lock" only proved the ordering of my diary entries, and nothing stopped me running the prompt first and predicting what I'd already read. The UI, which I'd signed off a polish pass on, looked like every other agent-generated Tailwind app. And on the next walk the bigger one landed: we had grilled scoring and privacy to a fine finish without ever asking what the protocol adds over just telling people to guess before they try. We'd designed the container in detail and never isolated the active ingredient.

Because here's the reduction, once you strip the clinical vocabulary: real tasks, predict first, check against a standard, discuss the error, repeat harder, extract a rule. A good trainer would reinvent most of that session structure without ever reading my thesis. It's deliberate practice. The part that's distinctively mine is much smaller - selecting for people whose avoidance is maintained by feared consequences, eliciting the threat prediction separately from the output prediction, grading the progression by threat rather than task difficulty, testing whether the change transfers. Whether that layer adds anything over competent training is a question you can answer with one facilitator, two scripts, paper forms, and a domain expert scoring outputs. No platform. If the two conditions tie, the honest conclusion is that the product is ordinary structured training plus a few CBT-derived questions, and the grand theory gets deleted.

So the project is paused, with a reminder set for next week and a much smaller, cheaper question to answer before any more code.

What I want to write down, though, is the mechanism that got me there, because I don't think it's mine alone. Every artifact the process produced - the grill transcripts, the committed design docs, the passing tests, the podcasts - read as progress, and progress reads as evidence. It isn't. Iteration is not affirmation. It's not validation either, but it feels like both, and the feeling compounds with the quality of the help. A mediocre collaborator forces you to check the foundations because you don't trust the walls. A brilliant one builds walls so clean that checking the foundations starts to feel rude.

There's obvious overlap here with what people have started calling AI psychosis in developers. I don't love the term, and my case was mild and caught within the week. But the mechanism is recognisable and I've seen it run in other people more times than I care to admit: a system that responds fluently and constructively to every direction you propose will make any direction feel chosen, examined, and sound. The examination was real; it was aimed one level too low.

The irony isn't lost on me that the product in question is about exactly this - reliance that tracks evidence rather than fluency - and that what corrected me was contact with the artifact and a long walk, no design round involved. Which is, inconveniently, the protocol's own claim about how beliefs get corrected. I'd enjoy that more if noticing it didn't also feel affirming. That's probably the place to stop.
