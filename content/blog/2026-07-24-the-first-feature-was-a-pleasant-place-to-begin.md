+++
title = "The first feature was a pleasant place to begin"
date = "2026-07-24"
description = "Early decisions from setting up a pleasant launch cockpit where a creative collaborator can run observable experiments without first becoming a project manager."
tags = ["agents", "human-ai-collaboration", "onboarding", "context-engineering", "experiments", "workflow"]
draft = false
aliases = ["/olivia/"]

copy_metrics_version = 2
copy_word_count = 2233
copy_sentence_count = 131
copy_paragraph_count = 51
copy_not_count = 7
copy_not_ratio = 0.00313480
copy_negation_count = 22
copy_contrast_frame_count = 4
copy_short_closure_count = 4
copy_single_sentence_paragraph_count = 12
copy_first_person_count = 35
copy_contraction_count = 8
copy_editorial_signpost_count = 1
copy_repeated_ngram_count = 0

[build]
render = "always"
list = "always"
+++

I have been setting up a two-week launch cockpit with my friend Olivia. She has built a substantial creative and educational world, has some timely public opportunities emerging, and is curious about what working with an AI engineer might make possible.

She is creative first, and she should not have to acquire specialist AI or project-management literacy before the collaboration becomes useful.

That creates an easy failure mode. I could assemble a technically impressive collection of agents, automations, databases and dashboards, then ask Olivia to learn the machine before she receives any benefit from it. I would have reduced my own friction by transferring it to her.

One of the first design decisions was therefore that the cockpit should feel pleasant to enter.

## The experience starts before the login

Olivia and I haven't completed our first discovery meeting yet. Much of what matters will only become clear when I understand how she actually works: where enquiries arrive, what she repeats, what she enjoys doing personally, where information gets lost, and which parts of the relationship with a participant must remain entirely human.

Even so, I could usefully research the public shape of her work, separate observed facts from hypotheses, record the initial communication, and map ten places where better infrastructure might reduce friction. Those targets include the public route into an offer, cross-channel messaging, enquiry handling, onboarding, evidence, content reuse and parts of the creative operation.

The list is a menu. A two-week cockpit probably has room for two or three useful interventions, depending on what already exists behind the scenes. Pretending otherwise would make the first conversation a defence of my plan instead of an inquiry into her priorities.

That distinction has shaped the onboarding. Olivia should arrive to find that I have paid attention, whilst still being able to say that the whole model is wrong.

## One working surface, with the machinery behind it

The project has a hard initial constraint: the collaboration should cost nothing.

I had agents compare the free plans and open-source options for project coordination, diagramming, walkthroughs and creative work. Linear, Trello, Excalidraw, Miro, Canva, Penpot, GitHub Projects and Plane all had plausible roles. The difficult part wasn't finding capable tools. It was deciding which capabilities Olivia should have to encounter.

The first arrangement is deliberately small:

1. Linear holds the current work, decisions, owners and short updates.
2. A private Git repository holds the research, source records, working assets and evidence.
3. Excalidraw is available when a journey or technical explanation will be easier to understand as a picture.

Trello remains a fallback if Linear proves unpleasant. Canva may become useful for a specific creative deliverable. Neither has been added pre-emptively, because two task systems would create two versions of the truth and another login would need to earn its place.

Git is important to me and almost irrelevant to Olivia's first experience. She shouldn't have to understand branches, Markdown or repository structure to tell me that a message sounds wrong. The repository lets me and the agents preserve provenance and maintain durable assets; Linear is the shared surface where she can see what is happening.

## A dedicated room

[Linear's free plan](https://linear.app/pricing) is generous enough for this project, including human collaborators, projects, documents and API access, although its permissions affected the architecture.

[Free human members are administrators](https://linear.app/docs/members-roles), there is no restricted guest role on that plan, and [private teams are available on Business and Enterprise](https://linear.app/docs/private-teams). Adding Olivia to an existing workspace would therefore expose unrelated material and give her administrative access to a room that wasn't designed for this collaboration, so I created a dedicated Human OS workspace.

This is partly a privacy decision, but it also changes the social feeling of the software. Olivia will not arrive as a guest in my engineering headquarters. We will enter a small room containing only the work we have agreed to do together.

## Keep the workflow boring

It is very easy to express every nuance of a project as a new status. Needs Olivia, Agent Ready, Waiting, Parked, In Review and Blocked can all become columns. Each extra state then asks a new collaborator to understand another part of the designer's private ontology.

I kept Linear's default progression:

1. Backlog
2. Todo
3. In Progress
4. Done

The nuances are labels. **needs: olivia** means that her language, choice, source material, review or approval is required. **agent-ready** means there is enough context for an agent to make useful progress. **blocked** means that a named dependency has stopped the work.

The difference matters because labels answer "what kind of attention is needed?" while status answers "where is the work?" Olivia can ignore most of the structure and still understand those two questions.

I also left cycles and estimates disabled. They may become useful later, although neither helps with the first five minutes.

## Build around the decisions she can make

The workspace contains one project, **Deeper Living OS 2.0 Launch Cockpit**, divided into five broad phases: discovery, the public offer, enquiry and onboarding, messaging and launch assets, then evidence and review.

I didn't convert all ten research targets into an intimidating backlog. The first six issues are the decisions and maps needed to choose the real work:

- confirm the canonical offer and its duration;
- map the journey from discovery to onboarding;
- inventory the active public channels, forms and reusable assets;
- select the two-week cockpit targets;
- define evidence that would make the work genuinely testimonial-worthy;
- agree the participant-data and AI boundaries.

Five of those issues currently need Olivia. That could easily become a queue of homework with her name on it, so the intended use is more specific. A request should contain the question, enough context to answer it, a recommended option where I have one, the alternatives and their consequences. Her contribution might be one sentence in a comment.

The assigned human still owns the outcome. **agent-ready** doesn't mean that an issue has been handed to a mysterious autonomous employee. It says that research, organisation, comparison or drafting can now continue within the recorded boundaries.

## Treat each workflow as an experiment

The intended workflows are experiments. We may begin with a hypothesis that one approved offer record will reduce message drift, or that mapping the enquiry journey will reveal where people wait, repeat themselves or lose context. The first version should be small enough to test against reality and easy enough to change when the hypothesis is incomplete.

Each active issue therefore needs a starting condition, a concrete intervention and some way of recognising what happened. It also records the human owner, the agent's role, the source material, the privacy boundary and the next human decision. The amount of structure should remain proportional to the experiment. A revised welcome message doesn't need a research programme, although "this seems better" probably isn't enough to learn from it either.

The different tools contribute different kinds of observability. Linear shows the current state, the owner, the decision and what is waiting. Git preserves the source material, approved artefacts and changes over time. A before-and-after example, a response-time observation, a broken-link check, a short note from Olivia or a participant-safe aggregate can provide evidence about the effect.

Observability only becomes useful when it changes action. An audit that produces a long document and no decision has probably created more reading. For the first cockpit, useful work should lead towards an approved change in a real form, message, page, handoff or operating routine. It may also lead to a deliberate decision to leave something alone.

Then we reflect. What changed? What became easier? What felt generic, intrusive or unexpectedly helpful? Did the intervention remove work, move it somewhere else, or alter a part of the experience that Olivia valued? The answer determines whether we keep it, revise it, run another experiment or stop.

That makes iteration a human learning loop as well as an agent workflow. The agents can prepare the next version quickly. Olivia and I still need enough exposure to the current version to know what the next version is for.

## Explain the system from her side

I wrote a start guide inside Linear called **Olivia's Human OS cockpit guide**.

It begins with "what is what": workspace, team, project, milestone, issue, status, label, assignee, comment and document. The definitions are deliberately practical. An issue is one concrete outcome, question, decision or task. A comment is where an answer should live if we may need to find it later. An assignee is the human accountable for the result even when an agent does some of the work.

The guide then shows four ordinary examples:

- making a family of messages more consistent;
- finding and reducing friction in onboarding;
- preparing a creative asset from source material;
- making a decision asynchronously.

Each example moves between human input and agent work. Olivia supplies source language or judgment. An agent can audit, organise or prepare options. The issue returns to her when the work needs voice, taste or approval, and we only call it complete once there is evidence that the result is useful.

There is also a five-minute route into the workspace: open the project, skim the milestones, find the Needs Olivia view, leave one comment and move an issue only when its real state changes.

The last line is probably the most important:

> You do not need to learn Linear before contributing. A sentence in the right issue is enough.

## Do the scaffolding before she arrives

I created the workspace through Linear's live API. The key remained in a local environment file with owner-only permissions, outside Git.

After verifying that the key belonged to the dedicated Human OS workspace, I used idempotent operations to create the project, milestones, labels, views, issue template, guide and initial backlog. Running the setup again would find the existing objects rather than duplicate them.

I then read the state back through the API. The launch view contained the six intended issues, Needs Olivia contained five, and the agent queue contained the one task with enough public context to begin. Cycles and estimates remained disabled, and the existing Linear welcome tasks remained untouched.

This technical work contributes to the user experience because Olivia does not need to watch me assemble the furniture. Her first view can contain a coherent project rather than an empty workspace followed by an afternoon of notifications.

I stopped before sending an invitation because I did not have a confirmed email address. Guessing a collaborator's identity at the final step would have been a strange way to demonstrate careful onboarding.

## Agent speed makes pace a design decision

I can now ask agents to inspect every public channel, compare several tools, create a project structure, draft messages and prepare implementation options in the time it once took me to organise the notes. That speed is genuinely useful. It also makes it very cheap to produce more work than two people can understand.

A large backlog can appear persuasive because every item is well written. Ten parallel experiments can look efficient because the agents are available. We could generate copy variants much faster than Olivia can inhabit them and tell whether any still sound like her.

So the cockpit needs to slow us down in particular places. We will choose a small number of active experiments, state what we expect before changing anything, and pause long enough to observe the result. Twice-weekly updates will record what completed, what comes next, what is blocked, what needs Olivia and where the evidence lives. The update is short because its job is to expose the state, not perform activity.

I think this becomes more important as the agents become faster. Their production rate no longer provides a sensible cadence for the collaboration. The pace has to leave room for attention, experience, disagreement and the sort of reflection that arrives after using something rather than while watching it being generated.

## Pleasantness is a systems property

I usually encounter user experience as an interface question: wording, layout, navigation, responsiveness. Those things matter, although the early experience of this cockpit depends just as much on decisions that sit behind the screen.

There is one shared task system because synchronising two would create doubt. The workspace is dedicated because the free permission model otherwise creates an avoidable privacy problem. The default statuses remain because a bespoke workflow would ask Olivia to learn my categories. The research lives elsewhere because private correspondence and participant information do not belong in a project tracker. Agent work is visible as a label and a recorded role, while human authority remains explicit.

Most of the cockpit is still provisional, and I expect the first meeting to change the offer, the priorities, the language, the tools and the plan.

What I wanted to complete in advance was the translation work. Olivia should be able to arrive as an artist, educator and founder, say what feels important, and see how that becomes visible work without first adopting the habits of an AI engineer.

If the onboarding succeeds, Linear will recede fairly quickly. We will be talking about her launch, her participants, her voice and the places where she wants more room to think. The cockpit will help both of us remember what we decided, observe what happened, and give the next iteration a reason to exist.
