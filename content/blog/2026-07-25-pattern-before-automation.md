+++
title = "Pattern before automation"
date = "2026-07-25"
description = "Why I am running a new job-application workflow slowly before asking agents to encapsulate it, and what the first manual passes are teaching me about authority, recovery, evidence, and scale."
tags = ["agents", "automation", "human-ai-collaboration", "workflow", "systems-design"]
aliases = ["/pattern-before-automation/"]
draft = false

copy_metrics_version = 2
copy_word_count = 1809
copy_sentence_count = 113
copy_paragraph_count = 38
copy_not_count = 0
copy_not_ratio = 0.00000000
copy_negation_count = 16
copy_contrast_frame_count = 3
copy_short_closure_count = 5
copy_single_sentence_paragraph_count = 5
copy_first_person_count = 25
copy_contraction_count = 7
copy_editorial_signpost_count = 0
copy_repeated_ngram_count = 0

[build]
render = "always"
list = "always"
+++

This morning I asked an agent to prepare five job applications in five browser tabs. It filled the forms, attached role-specific CVs and cover letters, and stopped before submission so that I could review each one.

That sounds like an automated workflow. It wasn't, and that was the point.

I was operating the pipeline with the agent, watching what happened in each form and correcting the working rules as we went. Some sites wanted a PDF cover letter, one wanted text in a native field, and another had no place for a cover letter at all. Questions about location, work authorisation, notice period, office attendance, education, and demographics repeated across employers, but rarely with identical wording or options. One form timed out and had to be filled again. Another accepted the application only when I drove the final step.

By the time the batch was submitted, the durable system knew more than it had at the beginning. Repeated answers had moved into a private answer bank. The source facts remained separate and authoritative. Each application had passed through visible states from preparation to operator-confirmed submission. Even the apparently trivial rule for an earliest start date changed: "the next day" needs to roll forward to Monday when a form would otherwise receive a weekend date and lock itself.

I could have tried to design all of this in advance. With current agentic tooling I could probably have asked a frontier model to build the whole cathedral in one long run: browser operation, document generation, status tracking, retries, answer reuse, triage, and reporting. Give it enough tokens, tools, persistent context, and time, and it might produce something impressive.

For a prototype, that can be exactly the right move. The quickest way to discover whether an idea has any life in it may be to let the model carry a long arc and see what appears.

An operating pipeline is a different proposition, especially when the unresolved parts contain human judgment. Before encapsulating the process, I need to know what the process actually is.

## What the first five applications taught me

I regard a pattern as more than a sequence of steps that happened to work once. It includes the decisions between the steps, the evidence that permits the next move, the known ways the sequence can break, and the route back to a recoverable state.

The first version of this job pipeline made a good example. Its recommendations repeatedly leaned towards highly paid, very senior positions and frontier companies. That could have meant I was undervaluing myself. It could also have meant that the rubric was overvaluing a concentrated period of agentic prototyping and translating it too freely into salaried production experience.

There was no responsible way to settle that by adding more automation. We had to read the recommendations, inspect the facts they were using, identify where the rubric was creating an attractor, and restate the order of priorities. Attainability came first. Applied AI, product engineering, and forward-deployed work remained strong signals, but prestige and salary stopped acting as unearned proxies for suitability.

That calibration needed several conversational passes because the useful distinction was only partly explicit at the start. I was open to senior roles I could grow into and unwilling to spend most of my time on speculative frontier-lab bets. I wanted roles where a broad set of skills could be deployed in a shifting context, including customer-facing and agentic delivery, without insisting that every job already used one fashionable title.

Once those judgments were expressed clearly, they could become a versioned rubric. Automating before that point would merely have made the wrong selection faster and more consistent.

## The first useful layer was memory

There is a temptation to treat automation as code that performs the entire task. In practice, the most useful early automation is often much smaller.

In this case it began as memory:

- a canonical facts file;
- a reusable answer bank derived from those facts;
- a record of which applications were discovered, prepared, ready, and submitted;
- role-specific documents with unambiguous filenames and locations;
- a rule that submission remains a human action;
- notes about what failed and what allowed the sequence to continue.

None of these removed the need to review the next form. They reduced avoidable rediscovery while leaving the uncertain part visible.

That distinction matters. A source fact such as work authorisation should have one owner and a clear precedence rule. A prose answer may be adapted to a question, but it shouldn't quietly become a new fact. A form being filled is different from an application being sent. A browser showing a success page is stronger evidence than an agent reporting that it clicked a button. When those categories are collapsed, the apparent efficiency comes from losing information.

The memory also improves through use. We didn't hold a workshop to imagine every question an employer might ask. We processed real forms and promoted recurring answers only when they recurred. Each addition came with the context that made it necessary.

This is slower than inventing a comprehensive schema on day one. It is also far less likely to preserve guesses as architecture.

## What happens when the happy path stops

The most important lessons often arrive when the happy path stops.

A form times out. A file input accepts a document but displays an unexpected filename. A recruitment system treats a cover letter as generic supporting material. A site limits applications. A required field uses a set of choices that don't map cleanly onto the answer bank. The agent reaches the last step, but the operator has to take over because submission authority has deliberately remained outside the automation.

Each of these reveals a recovery sequence:

1. retain enough status to know what was already completed;
2. inspect the live form rather than trusting the previous attempt;
3. refill only the missing or expired fields;
4. stop again at the human boundary;
5. record submission only after the operator confirms it.

After a few passes, those recovery sequences can be encoded. Before then they deserve to remain observable. An agent that silently starts again may duplicate an application. One that assumes an uploaded file is still present may submit an incomplete form. One that interprets "ready" as "sent" contaminates the ledger and every report derived from it.

This is why durable status is worth building before full automation. Work divided into small batches can be locked, retried, and resumed. Inputs can be content-hashed so that a resumed run proves it is working on the same material. Outputs can be written atomically, validated against a schema, and recovered after interruption. An apply phase can begin as a dry run, refuse to proceed if the source database has drifted, skip identical work, and roll back the transaction on error.

Those controls already exist in other machinery on this computer because they solve recurring problems. They weren't designed as ornamental "enterprise" features. They appeared after processes failed in particular ways.

## Why five was a useful number

Five applications is a useful batch because it is large enough to reveal repetition and small enough to inspect.

If every form asks the same question, that is evidence for a reusable answer. If one answer needs correction across the batch, the blast radius is visible. If a cover letter style looks synthetic, five documents can be revised without maintaining an elaborate template engine built around the wrong design. If one employer's application system behaves unusually, it remains an exception rather than forcing a premature universal abstraction.

Small batches also reveal where the time actually goes. The expensive part may be finding the right role, checking attainability, choosing evidence, writing a credible role-specific paragraph, resolving a strange form, or completing the final human review. Until I observe several runs, any optimisation plan is mostly a theory about the bottleneck.

This is one reason I am wary of token-maxing a process too early. A long-running agent can produce a large amount of coherent machinery around an imagined bottleneck. The result may be technically competent and internally consistent whilst making the real work harder to see.

The better moment for a large automation pass comes after the pattern has stabilised enough that I can name what should remain variable. Then the model is encapsulating observed behaviour rather than inventing policy while it implements it.

## Version control belongs here too

Version control belongs in this discussion because a commit is another boundary around understanding.

When a change is narrow enough to describe cleanly, I can usually explain what assumption it encodes and how to reverse it. If a rubric correction, answer-bank update, browser operator, document generator, and database migration all land together, the implementation may work but the learning has been compressed into a single opaque event.

Narrow commits preserve the order in which the system became better understood. They make review easier, but they also expose when two concerns are still entangled. A change that cannot be separated may be revealing a real shared boundary, or it may mean I haven't understood the responsibilities yet.

The same discipline applies outside Git. A dry run should be distinct from an apply. Preparation should be distinct from submission. Local tests should be distinct from evidence observed in the real browser, API, database, process, or deployment. A canonical source should be distinct from its rendered or convenient copies.

These separations can feel ceremonial when every step is going well. Their purpose becomes obvious during recovery.

## When I would automate it

Frontier models have made it possible to move from intention to working software with almost indecent speed. I enjoy that capability and use it extensively. The verification fabric around the work means an agent can now run for a long time, operate real tools, make changes, check them, and return with evidence.

That fabric improves what can safely be delegated, but it doesn't supply the missing human judgment at the beginning of a new process. Tests can prove that a rubric was applied consistently. They cannot decide whether the rubric expresses the life I am trying to build. A browser agent can complete a form. It cannot decide, without an explicit policy, which claim I am prepared to stand behind.

So I am letting this pipeline acquire its shape through operation. The first week is a working hypothesis. We run a small batch, watch it closely, correct the durable context, preserve the evidence, and repeat. When the same decisions and failures become predictable, they can move into code, instructions, or reusable agent skills.

At that point automation stops being a guess about the whole cathedral. It becomes an encapsulation of paths we have actually walked, including the doors that stick, the places where a human must decide, and the route back out when something goes wrong.
