+++
title = "I do not use AI for one thing"
date = "2026-07-23"
description = "Voice dictation, computer use, terminal agents, parallel work, client systems, prompt governance, private telemetry, and a way to check whether speed is improving or hiding my judgment."
tags = ["agents", "computer-use", "context-engineering", "human-ai-collaboration", "workflow"]
draft = false
aliases = ["/ai/"]

[build]
render = "always"
list = "always"
+++

People keep asking how I use AI, as though there should be one answer.

The obvious answer is software development. I use Claude and Codex for implementation, investigation, refactoring, test design and review. That answer is true, but it now describes a surprisingly small part of the change.

AI has become an input method, a computer interface, a research partner, a set of workers, a component inside customer systems, a review mechanism, a practice opponent and, increasingly, something I build an operating system around.

Those uses carry different risks, need different forms of human control and become more interesting as they compound.

{{< claude-coach url="https://claude.ai/share/44d6347a-ca6f-4b83-90a4-c88504741a3a" >}}

## I start by speaking

I type quickly. On a very good run I might reach 100 words per minute. I estimate that I can dictate at more than 250.

The practical difference is that speaking makes a complete brief cheaper. I am more likely to explain the awkward edge case, name the thing I am uncertain about, say what must not change and describe what a good result would look like. At a keyboard, even a fast one, there is a small pressure to compress. With voice, I can think out loud and let the structure emerge.

That changes which jobs I bother to start.

I now use voice-first agents to organise files and folders, develop naming conventions, audit drives and backup processes, configure scheduled jobs, and assemble research pipelines. These mundane tasks tend to accumulate because each one involves several tools, a little research, and enough fiddling to make postponement attractive.

A spoken objective can become a directory inventory, a proposed convention, a dry-run, an implementation and a verification pass. I still decide what the convention means. I no longer have to manually translate that decision through every intermediate interface.

Research works the same way. I can define the question, have agents gather primary sources, retain provenance, separate quotation from inference, compare disagreements and produce a reusable report rather than a one-off answer. I use AI less as an oracle than as the operator of a research process whose evidence I can inspect.

The reduction in friction also makes the work more enjoyable, which matters when enjoyment changes how readily and thoroughly I maintain the systems I depend on.

## The agent can use the computer I am talking about

Command-line agency was the first large change. Codex's Luna, Terra and Sol models are all useful terminal operators for me. They can inspect a real repository, follow a process through files and commands, make a bounded change, and prove what happened.

Computer use closes another gap. The agent can work with the browser or desktop application that contains the actual state, rather than asking me to describe the screen, copy text into a chat, translate the answer back into clicks and then report what changed.

This is much more useful than the phrase "browser automation" suggests.

One recent example began with a WhatsApp screenshot from Sarah, who was learning the TinaCMS interface behind her studio website. In one ChatGPT desktop thread, the agent read her question, inspected the live CMS in Chrome, checked the repository schema and owner guide, distinguished two nearly identical plus buttons, opened one real product without changing it, and produced four pixel-accurate annotated screenshots plus a short reply I could send.

I wrote that up as [The agent knew which plus button Sarah meant](https://www.oceanheart.ai/blog/2026-07-23-the-agent-knew-which-plus-button-she-meant/).

The achievement was moving through the whole task without losing its context. The message explained the human problem. The live browser proved the current interface. The schema defined what the fields meant. Repository instructions defined which fields Sarah could safely own. The guide defined the intended workflow.

That is context engineering in a form I care about: the right source answering the right part of the problem.

It also leaves room for disagreement. In an earlier experiment, an agent gave me a careful deploy-hook system when one scheduled command would do. I challenged the premise and it immediately dropped the unnecessary machinery. Computer agency is valuable because it can act. Human judgment remains valuable because an agent can execute the wrong shape of solution extremely well.

## Sometimes AI is inside the thing I am building

Using AI to build software is different from building AI into software.

For a regulated UK lender, I built [a conversational system](/projects/fail-closed-llm-engine/) in which the model could propose a response but could not decide what was safe to show a customer. Deterministic software retained authority over grounding, safety boundaries and escalation. The system kept audit traces and could route sensitive cases towards human handling.

For a coaching business, I integrated an AI assistant into a wider member portal containing course material, profiles, payments and client-managed content. The assistant occupied one bounded part of the customer journey instead of floating beside the real work.

I use the same distinction in evaluation tooling. Models can review code independently, classify failures, compare providers or synthesise findings. The surrounding system decides what evidence is retained, what severity blocks a merge, what disagreement means and when a human must decide.

My preferred rule is simple: a model may propose, classify or generate, while authority remains elsewhere.

## Sometimes I need several agents, but I still need to see them

One agent is often enough. Sometimes the problem genuinely has parallel parts.

I use Herdr as a terminal control surface with multiple visible panels. An agent can investigate one subsystem while another reviews an API boundary, runs a separate evidence pass, or works on a different project entirely. Each panel remains inspectable. I can see the command history, open the working tree, interrupt a bad direction or take over.

That differs from asking one model to pretend that it held a meeting with itself.

The useful parallelism comes from explicit task boundaries, separate context, real artefacts and a way to join the work afterwards. I have built reusable skills around model APIs and local tools so that repeated workflows can be reused instead of reconstructed from a long prompt every time.

Voice makes delegation cheaper. Command-line agency makes each delegated task capable of reaching a real result. Herdr makes the parallel work visible. Reusable skills make the good parts repeatable.

The combination is where the larger speedup appears.

## I build an operating layer around the agents

Once agents can act across real projects, an operating model needs more than a better prompt.

I maintain persistent instructions at several levels. Global guidance describes how I work, what evidence counts, how private state is handled and what an agent should do before changing anything. Repository guidance describes the local architecture, commands, ownership boundaries and verification path. The current environment identifies the actual checkout, branch, worktree and runtime. The live request supplies the immediate objective.

This is persistent context engineering. It is deliberately layered because the sources have different authority. A machine-level rule should not need to know the details of Sarah's product catalogue. A repository-level rule should not redefine the privacy boundary for the whole machine.

I also treat agent governance as code. The instructions specify when an agent should execute, coach, stop, verify or ask for a human call. They define which evidence outranks which, how unrelated work must be preserved, and which external actions require explicit authority.

Rather than copying the long-form sources around by hand, a renderer compiles them into compact, hash-stamped blocks for Codex, Claude, Hermes and project instruction files. It preserves repository-owned text outside the managed markers. It defaults to a dry-run, reports every target and supports repeated convergence checks.

The propagation is deliberate rather than magical. Repository-wide updates are manual because one command can otherwise dirty several active branches. The goal is controlled consistency across harnesses without pretending they all expose the same lifecycle.

## Hooks connect the conversation to real state

Prompts describe desired behaviour. Hooks and tools let the surrounding system observe or enforce parts of it.

Different harnesses expose different events, but the general lifecycle is useful: session start, before a tool runs, after a tool runs and when a turn ends. I use those seams for things such as Herdr state, policy checks, command rewriting, local ledgers and interaction logging.

The logging is intentionally private and summary-only. A local SQLite database can answer the questions I care about from interaction modes, graded predictions, drills, blockers and skill observations, without storing raw prompts, private client material or secrets.

I can ask what proportion of predictions were right, which technical domains are producing misses, whether practice is happening, and whether the protocol is changing behaviour or merely decorating it.

I also inspect the prompt that the model actually received. Codex can render its model-visible input as JSON. That lets me confirm the global instruction layer, the repository layer, the environment and the task rather than trusting that a file with a plausible name must have loaded.

This is prompt observability and provenance. Hashes, dry-runs, tests and live process checks may be unromantic, but they turn "the agent knows this" into a falsifiable statement.

I also use AI to evaluate AI-produced writing. One agent can extract a corpus of my own words, another can identify repeated stylistic tells, and a draft can be compared with evidence rather than a vague request to "sound like me." The point is to make the gap between generated prose and authored prose visible, rather than pursue self-imitation for its own sake.

## More speed creates a calibration problem

The more capable the agents became, the less useful my original idea of "AI discipline" turned out to be.

I first built a Coding Fluency Rehab Protocol around recovering manual typing and tool fluency. Then I instrumented it. A month of data showed zero manual reps against more than 500 AI interactions per week.

The easy interpretation would have been that I lacked discipline. The more useful interpretation was that the target was wrong.

The valuable skill had moved from typing to reading a situation, predicting what will happen, identifying risk, choosing an architecture and recognising when a plausible result is wrong. Heavy delegation creates a real danger here: my judgment may be improving or decaying, but if I never state a view before the agent reveals the answer, I cannot tell.

So the protocol changed.

> AI may execute. AI may not reveal before the call.

Before a substantive diff, test result or root-cause diagnosis is revealed, I can make a one-line falsifiable prediction. Then the result is shown and the call is graded hit, partial or miss. The agent does the execution. I keep a scored judgment loop inside ordinary work.

Historical bug drills provide a deeper version. An agent selects a real bug-fix commit, prepares an isolated worktree at its parent and presents only the symptom. I diagnose by reading and by writing small probes. The real fix is then revealed and compared with my explanation. During the drill the agent acts only as quartermaster and scorekeeper.

That is human-AI calibration and AI-assisted deliberate practice. AI is being used to preserve a human capability that easier AI use could otherwise make invisible.

## Some boundaries need more than another instruction

The operating system has modes for ordinary agentic work, coaching after effort, protected practice and explicit infrastructure exceptions. These change what kind of help is appropriate before model or tool routing begins.

For protected practice, a local network guard can block the reflexive chat interfaces for a fixed period and close the desktop apps while leaving the coding harness available to hold the exercise. It is a friction wall, not a cryptographic prison. I remain the administrator and can deliberately override it.

That distinction matters. A prompt is a request to a model. A guard, hook, permission boundary or deterministic validator changes what the system can actually do.

I use both, but I do not confuse them.

## The short taxonomy

If I need compact labels for all of this, these are the ones I use:

- voice-first interaction;
- command-line and computer agency;
- operational automation and research pipelines;
- multimodal, bounded context engineering;
- AI inside customer products;
- deterministic authority around model output;
- visible multi-agent orchestration;
- reusable skills and tool composition;
- persistent global and project instructions;
- agent governance as code;
- prompt compilation and cross-harness distribution;
- lifecycle hooks and workflow automation;
- prompt observability and provenance;
- private interaction telemetry and evaluation;
- human-AI calibration;
- AI-assisted deliberate practice;
- safety and capability gating;
- evidence-led workflow redesign;
- model and tool routing;
- situated operations and ownership.

The list looks excessive only if "using AI" means opening a chat box and asking for text. In my work, voice reduces the cost of explaining an intention. Computer use closes the gap between explanation and action. Terminal agents can carry work to a verified result. Multiple visible agents can work in parallel. Persistent context and governance keep them situated. Hooks and telemetry make the process observable. Calibration keeps my own judgment in the loop.

I use AI to do work, to build products, to operate other agents and to test whether I can still judge the results.

Together, those different uses have changed the shape of a working day.
