+++
title = "Dispatches and deep arcs"
date = "2026-07-23"
description = "A 37-day trace of how I work with agents: hundreds of one-turn dispatches, a small number of deep systems arcs, and 6.4 billion cache-heavy tokens behind them."
tags = ["agents", "human-ai-collaboration", "telemetry", "context-engineering", "workflow"]
draft = true

copy_metrics_version = 1
copy_word_count = 1682
copy_not_count = 9
copy_not_ratio = 0.00535077

[build]
render = "always"
list = "never"
+++

People sometimes ask how much I use AI. I can now give them an answer without pretending that volume is the same thing as value.

On 23 July 2026 I froze a 37-day snapshot of my private agent telemetry. It contained 2,182 completed assistant turns across 471 identified conversations. I had used an agent on 36 of the 37 days. The median active day contained 47 turns.

Those are large numbers, but they are not the interesting result.

The interesting result is the shape.

My work with agents has developed two ends. At one end are dispatches: bounded questions, checks and changes that are complete after one response. At the other are deep arcs: conversations that carry a system through investigation, implementation, tests, live interfaces, documentation and verification.

I described the range of uses in [I do not use AI for one thing](/blog/2026-07-23-i-do-not-use-ai-for-one-thing/). This is what those uses look like when measured.

## The two currents

Forty-three per cent of identified conversations ended after one assistant turn. Those 203 dispatches represented only 9.4 per cent of all identified turns.

At the other end, just 48 conversations passed ten turns. They were 10.2 per cent of conversations, but contained 46.3 per cent of all identified turns.

<style>
  .working-signature {
    --ws-bg: var(--bg, var(--paper));
    --ws-text: var(--text, var(--ink-2));
    --ws-bright: var(--text-bright, var(--ink));
    --ws-muted: var(--muted, var(--faint));
    --ws-border: var(--bg-tertiary, var(--rule));
    --ws-dispatch: var(--blue, var(--accent));
    --ws-deep: var(--orange, var(--ink));
    margin: 2rem 0;
    color: var(--ws-text);
    font-family: var(--font-mono);
  }

  .working-signature * {
    box-sizing: border-box;
  }

  .working-signature .signature-meta,
  .working-signature .token-head,
  .working-signature .token-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.45rem 1rem;
  }

  .working-signature .signature-meta {
    padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--ws-border);
    font-size: var(--fs-xs);
  }

  .working-signature strong {
    color: var(--ws-bright);
    font-weight: 500;
  }

  .working-signature .signature-chart {
    display: block;
    width: 100%;
    height: auto;
    margin-top: 0.55rem;
    overflow: visible;
  }

  .working-signature .grid-line {
    stroke: var(--ws-border);
    stroke-width: 1;
  }

  .working-signature .axis-label,
  .working-signature .tick-label,
  .working-signature .mark-label {
    fill: var(--ws-muted);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 400;
  }

  .working-signature .mark-label-strong {
    fill: var(--ws-bright);
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
  }

  .working-signature .dispatch-line {
    fill: none;
    stroke: var(--ws-dispatch);
    stroke-width: 3;
  }

  .working-signature .deep-line {
    fill: none;
    stroke: var(--ws-deep);
    stroke-width: 3;
  }

  .working-signature .middle-line {
    fill: none;
    stroke: var(--ws-muted);
    stroke-width: 1.5;
  }

  .working-signature .middle-line-dashed {
    stroke-dasharray: 5 5;
  }

  .working-signature .dispatch-mark {
    fill: var(--ws-dispatch);
    stroke: var(--ws-bg);
    stroke-width: 2;
  }

  .working-signature .deep-mark {
    fill: var(--ws-deep);
    stroke: var(--ws-bg);
    stroke-width: 2;
  }

  .working-signature .middle-mark {
    fill: var(--ws-bg);
    stroke: var(--ws-muted);
    stroke-width: 1.5;
  }

  .working-signature .signature-emphasis {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem 1.2rem;
    margin-top: -0.15rem;
    font-size: var(--fs-xs);
  }

  .working-signature .emphasis-item {
    display: grid;
    grid-template-columns: 0.7rem 1fr;
    gap: 0.55rem;
    align-items: start;
  }

  .working-signature .swatch {
    width: 0.7rem;
    height: 0.7rem;
    margin-top: 0.25rem;
    border-radius: 999px;
    background: var(--ws-dispatch);
  }

  .working-signature .swatch.deep {
    border-radius: 2px;
    background: var(--ws-deep);
    transform: rotate(45deg);
  }

  .working-signature .mobile-signature {
    display: none;
  }

  .working-signature .token-section {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--ws-border);
  }

  .working-signature .token-head {
    color: var(--ws-text);
  }

  .working-signature .token-head span:last-child,
  .working-signature .token-foot {
    color: var(--ws-muted);
    font-size: var(--fs-xs);
  }

  .working-signature .token-bar {
    display: flex;
    width: 100%;
    height: 1rem;
    margin: 0.7rem 0 0.6rem;
    overflow: hidden;
    border: 1px solid var(--ws-border);
    border-radius: 999px;
    background: var(--ws-border);
  }

  .working-signature .token-cache-read {
    width: 94.84%;
    background: var(--ws-muted);
  }

  .working-signature .token-input {
    width: 3.52%;
    background: var(--ws-dispatch);
  }

  .working-signature .token-cache-create {
    width: 1.18%;
    background: var(--ws-deep);
  }

  .working-signature .token-output {
    width: 0.46%;
    min-width: 2px;
    background: var(--ws-bright);
  }

  .working-signature .token-legend {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.55rem 1rem;
    font-size: var(--fs-xs);
  }

  .working-signature .legend-item {
    display: grid;
    grid-template-columns: 0.55rem 1fr;
    gap: 0.4rem;
    align-items: start;
    color: var(--ws-muted);
  }

  .working-signature .legend-key {
    width: 0.55rem;
    height: 0.55rem;
    margin-top: 0.2rem;
    border-radius: 2px;
    background: var(--ws-muted);
  }

  .working-signature .legend-key.input {
    background: var(--ws-dispatch);
  }

  .working-signature .legend-key.create {
    background: var(--ws-deep);
  }

  .working-signature .legend-key.output {
    background: var(--ws-bright);
  }

  .working-signature .token-foot {
    margin-top: 0.7rem;
  }

  .working-signature figcaption {
    margin-top: 1rem;
    color: var(--ws-muted);
    font-size: var(--fs-xs);
  }

  @media (max-width: 620px) {
    .working-signature .signature-chart,
    .working-signature .signature-emphasis {
      display: none;
    }

    .working-signature .mobile-signature {
      display: grid;
      gap: 0.8rem;
      margin-top: 1rem;
      font-size: var(--fs-xs);
    }

    .working-signature .mobile-head,
    .working-signature .mobile-row {
      display: grid;
      grid-template-columns: minmax(4.5rem, 0.9fr) repeat(2, minmax(0, 1fr));
      gap: 0.55rem;
      align-items: center;
    }

    .working-signature .mobile-head {
      color: var(--ws-muted);
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--ws-border);
    }

    .working-signature .mobile-value {
      position: relative;
      min-height: 2.2rem;
      padding-top: 1.15rem;
      color: var(--ws-bright);
    }

    .working-signature .mobile-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 0.55rem;
      max-width: 100%;
      border-radius: 999px;
      background: var(--ws-muted);
    }

    .working-signature .mobile-row.dispatch .mobile-bar {
      background: var(--ws-dispatch);
    }

    .working-signature .mobile-row.deep .mobile-bar {
      background: var(--ws-deep);
    }

    .working-signature .mobile-row.dispatch > span:first-child,
    .working-signature .mobile-row.deep > span:first-child {
      color: var(--ws-bright);
      font-weight: 500;
    }

    .working-signature .token-legend {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>

<figure class="working-signature">
  <div class="signature-meta" aria-label="Snapshot totals">
    <span><strong>2,182</strong> recorded assistant turns</span>
    <span><strong>471</strong> identified conversations</span>
    <span><strong>36 of 37</strong> active days</span>
  </div>

  <svg class="signature-chart" viewBox="0 0 704 340" role="img" aria-labelledby="signature-title signature-description">
    <title id="signature-title">Conversation depth compared by share of conversations and share of turns</title>
    <desc id="signature-description">Single-turn conversations are 43.1 per cent of conversations but 9.4 per cent of turns. Conversations with 11 or more turns are 10.2 per cent of conversations but 46.3 per cent of turns.</desc>
    <text class="axis-label" x="170" y="24" text-anchor="middle">share of conversations</text>
    <text class="axis-label" x="534" y="24" text-anchor="middle">share of turns</text>
    <line class="grid-line" x1="126" y1="40" x2="578" y2="40"></line>
    <line class="grid-line" x1="126" y1="165" x2="578" y2="165"></line>
    <line class="grid-line" x1="126" y1="290" x2="578" y2="290"></line>
    <text class="tick-label" x="90" y="44" text-anchor="end">50%</text>
    <text class="tick-label" x="90" y="169" text-anchor="end">25%</text>
    <text class="tick-label" x="90" y="294" text-anchor="end">0%</text>
    <path class="dispatch-line" d="M170 74.5 C280 74.5 424 243 534 243"></path>
    <path class="middle-line middle-line-dashed" d="M170 187 C280 187 424 234.5 534 234.5"></path>
    <path class="middle-line" d="M170 159.5 C280 159.5 424 124.5 534 124.5"></path>
    <path class="deep-line" d="M170 239 C280 239 424 58.5 534 58.5"></path>
    <circle class="dispatch-mark" cx="170" cy="74.5" r="6"></circle>
    <circle class="dispatch-mark" cx="534" cy="243" r="6"></circle>
    <circle class="middle-mark" cx="170" cy="187" r="5"></circle>
    <circle class="middle-mark" cx="534" cy="234.5" r="5"></circle>
    <circle class="middle-mark" cx="170" cy="159.5" r="5"></circle>
    <circle class="middle-mark" cx="534" cy="124.5" r="5"></circle>
    <rect class="deep-mark" x="164" y="233" width="12" height="12" rx="2" transform="rotate(45 170 239)"></rect>
    <rect class="deep-mark" x="528" y="52.5" width="12" height="12" rx="2" transform="rotate(45 534 58.5)"></rect>
    <text class="mark-label-strong" x="154" y="69" text-anchor="end">1 turn</text>
    <text class="mark-label-strong" x="154" y="85" text-anchor="end">43.1%</text>
    <text class="mark-label" x="154" y="194" text-anchor="end">2-3 turns</text>
    <text class="mark-label" x="154" y="210" text-anchor="end">20.6%</text>
    <text class="mark-label" x="154" y="137" text-anchor="end">4-10 turns</text>
    <text class="mark-label" x="154" y="153" text-anchor="end">26.1%</text>
    <text class="mark-label-strong" x="154" y="248" text-anchor="end">11+ turns</text>
    <text class="mark-label-strong" x="154" y="264" text-anchor="end">10.2%</text>
    <text class="mark-label-strong" x="550" y="52" text-anchor="start">46.3%</text>
    <text class="mark-label" x="550" y="129" text-anchor="start">33.1%</text>
    <text class="mark-label" x="550" y="229" text-anchor="start">11.1%</text>
    <text class="mark-label-strong" x="550" y="250" text-anchor="start">9.4%</text>
    <text class="tick-label" x="170" y="320" text-anchor="middle">471 conversations</text>
    <text class="tick-label" x="534" y="320" text-anchor="middle">2,163 identified turns</text>
  </svg>

  <div class="signature-emphasis" aria-hidden="true">
    <div class="emphasis-item">
      <span class="swatch"></span>
      <span><strong>Dispatches:</strong> 203 one-turn conversations produced 203 turns.</span>
    </div>
    <div class="emphasis-item">
      <span class="swatch deep"></span>
      <span><strong>Deep arcs:</strong> 48 conversations produced 1,002 turns.</span>
    </div>
  </div>

  <div class="mobile-signature" aria-label="Conversation depth comparison">
    <div class="mobile-head">
      <span>depth</span>
      <span>conversations</span>
      <span>turns</span>
    </div>
    <div class="mobile-row dispatch">
      <span>1 turn</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:86.2%"></span>43.1%</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:18.8%"></span>9.4%</span>
    </div>
    <div class="mobile-row">
      <span>2-3</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:41.2%"></span>20.6%</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:22.2%"></span>11.1%</span>
    </div>
    <div class="mobile-row">
      <span>4-10</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:52.2%"></span>26.1%</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:66.2%"></span>33.1%</span>
    </div>
    <div class="mobile-row deep">
      <span>11+</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:20.4%"></span>10.2%</span>
      <span class="mobile-value"><span class="mobile-bar" style="width:92.6%"></span>46.3%</span>
    </div>
  </div>

  <div class="token-section">
    <div class="token-head">
      <span><strong>6.40B</strong> recorded tokens</span>
      <span><strong>94.8%</strong> cache reads</span>
    </div>
    <div class="token-bar" role="img" aria-label="Token mix: 94.8 per cent cache reads, 3.5 per cent fresh input, 1.2 per cent cache creation, and 0.5 per cent model output, including reasoning">
      <span class="token-cache-read"></span>
      <span class="token-input"></span>
      <span class="token-cache-create"></span>
      <span class="token-output"></span>
    </div>
    <div class="token-legend">
      <span class="legend-item"><span class="legend-key"></span><span><strong>6.07B</strong> cache read</span></span>
      <span class="legend-item"><span class="legend-key input"></span><span><strong>225.3M</strong> fresh input</span></span>
      <span class="legend-item"><span class="legend-key create"></span><span><strong>75.2M</strong> cache creation</span></span>
      <span class="legend-item"><span class="legend-key output"></span><span><strong>29.5M</strong> model output, including reasoning</span></span>
    </div>
    <div class="token-foot">
      <span><strong>$11.29k</strong> all-token API-price equivalent</span>
      <span><strong>$1.67k</strong> attributable to model output</span>
      <span>37-day local-log snapshot</span>
    </div>
  </div>

  <figcaption>
    Snapshot captured on 23 July 2026 at 21:29 BST. The final day is partial. Conversation analysis excludes 19 turns without an identified conversation.
  </figcaption>
</figure>

Whilst this isn't a conventional bimodal distribution with two statistical peaks on one axis, it's still bimodal in the operating sense. Conversation count is concentrated at the shallow end, while interaction volume is concentrated at the deep end.

The middle exists. Another 220 conversations ran for between two and ten turns. They contain normal iterative work: clarify the target, inspect the result, make a correction, verify it. But it is the two ends that explain what is distinctive about this system.

## Dispatches

A dispatch is not necessarily a trivial question. It is a task whose useful unit is one bounded response.

Examples include:

- resolve the exact checkout, branch, runtime and deployment path before a change;
- run one focused health check and identify the next action;
- confirm whether a page, scheduled job or production route is actually live;
- turn a spoken objective into a scoped brief or checklist;
- inspect one source of truth and settle a precise implementation question.

Many of these tasks are short because the surrounding context is already present. The agent knows the repository rules, the current working directory, the available tools and what counts as evidence. A concise exchange can therefore carry more context than its visible length suggests.

The specific value here is that a small uncertainty was removed before it could contaminate a large piece of work.

## Deep arcs

A deep arc carries state across several kinds of evidence.

One began with a WhatsApp screenshot from Sarah asking how to edit the products in her studio CMS. The work moved through her message, the live browser, the repository schema, the owner guide and four annotated screenshots before producing an answer she could use. The useful capability was maintaining the boundaries of the same real task across all of them, even though no individual step was especially exotic.

Another recurring arc is evaluation work on a conversational system for a regulated lender. A change may pass through implementation, route hardening, direct API simulations, failure classification, comparison against earlier evidence and production verification. The model can propose an answer, but it's deterministic software and human review that retain authority over what is safe to expose.

The agent operating layer itself also produces deep arcs. A change to a protocol can touch the source instructions, renderer, harness-specific output, hooks, local telemetry, guard behaviour and live process verification. The implementation may be small; the proof surface is not.

Deep arcs are where an agent stops looking like a clever answer box and starts looking like a situated operator. They are also where drift, context loss and confident wrongness become more expensive.

## Work arrives in pulses

The 2,182 turns were not evenly spread across the 37 days.

Using a 30-minute gap to separate activity clusters, the database contains 182 distinct pulses. The median active day had five. The median pulse contained five turns and lasted 23 minutes, although the variation was enormous. More than 80 per cent of all turns occurred inside clusters containing at least ten turns.

I didn't work continuously for the span between the first and last interaction. It measures agent contact as opposed to hours worked. A morning check, an afternoon build and an evening research question can create a long daily span with large gaps between them.

Forty-four per cent of the interactions occurred at weekends - I don't personally regard that as a performance metric - it's evidence that the system is mixed into personal projects, writing, maintenance, and curiosity, as well as conventional weekday software work.

## The token traffic is stranger than the conversation count

I ran `ccusage` over the same 37-day period. It found 6.40 billion recorded tokens across Codex, Claude, Hermes and a small amount of other command-line agent use.

That number needs immediate decomposition.

Approximately 6.07 billion tokens, 94.8 per cent of the total, were cache reads. Fresh input accounted for 225.3 million tokens. Model output accounted for 29.5 million. For Codex, that includes its separately reported reasoning tokens.

It's probably clear even to those who don't understand the mechanics of LLMs that I didn't read 6.4 billion unique tokens in that time. The number describes a cache-heavy system repeatedly loading and reusing working context.

`ccusage` estimates an all-token API-price equivalent of about $11,290 for the period. Approximately $1,670 of that estimate comes from model output. Cache reads account for about $6,400, fresh input for $2,490 and cache creation for $734.

The estimate is useful as a common pricing lens on the computational scale, regardless of accounting claims.

The token logs and the interaction database are separate instruments. Costs assigned to individual projects would be invented precision.

## Volume is not value

None of these numbers measures productivity.

A one-turn dispatch might prevent an expensive deployment mistake. A forty-turn arc might represent difficult systems work, or it might represent an agent wandering in the wrong direction. More tokens can mean richer context, and they can also mean repetition, poor scoping, and failure to stop.

The activity trace can tell me:

- how frequently I use agents;
- whether the work is shallow, iterative or sustained;
- how activity is distributed across days;
- which harnesses and broad project areas dominate;
- whether context reuse is high;
- whether I am recording enough evidence to inspect the process later.

It cannot tell me whether a feature was good, whether a client was helped, whether the architecture was right or whether the work should have happened at all.

Those questions still require judgment.

## Measuring the person inside the loop

That is why the same database now records a second kind of event.

Before an agent reveals a substantive test result, diff or root cause, I can state a falsifiable prediction. The result is then revealed and the call is graded hit, partial or miss. Historical bug drills create a longer version using real defects from earlier repositories.

At the snapshot cutoff, I had made 31 graded calls: 16 hits, nine partials and six misses, including three bug drills. The simple hit rate was 51.6 per cent.

That sample is too small and too unevenly distributed to support a strong trend. It is useful precisely because it is not flattering enough to become a vanity metric. The question is whether heavy delegation is sharpening my judgment or allowing it to disappear behind plausible output.

## What I would measure next

The current instruments are good enough to reveal the two currents, but they are not yet good enough to explain every outcome.

The next useful additions would be:

1. a shared local identifier joining an interaction to its token usage without storing raw private content;
2. a smaller, stable vocabulary for the type of work being performed;
3. outcome evidence that distinguishes a verified result from a long conversation;
4. monthly frozen snapshots so genuine changes can be separated from one unusually busy week;
5. enough graded predictions to compare judgment across technical domains.

I want an inspectable record of how the working system is changing.

The first 37 days show a system with two characteristic motions.

It dispatches small uncertainties quickly.

It also stays with difficult systems long enough to carry them across boundaries.

The amount of activity is striking. The division of labour is more useful.

## Method and limits

The interaction figures come from a frozen, read-only snapshot of a local SQLite database. One interaction represents one completed assistant turn. Raw prompts, conversation identifiers, client material and private paths were excluded from this analysis.

The token figures come from `ccusage` over local command-line agent logs for 17 June through 23 July 2026, grouped in Europe/London time. Its cost field combines model-specific prices for fresh input, model output, cache reads and cache creation. It is an estimate, not a billing record.

The final date and current ISO week were incomplete when captured. Historical project directories have also moved during the period, so project-level path labels require sanitisation before publication.

This is a trace of agent contact and computational usage. Any indication that it might be anything else is either the fault of the author or the agent who wrote it.
