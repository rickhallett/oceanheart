type TechnicalAccount = {
  basis: string;
  lanes: { label: string; steps: string[] }[];
  sections: { title: string; text: string }[];
};

export const projectTechnical: Record<string, TechnicalAccount> = {
  'sarah-mozer-studio': {
    basis: 'Architecture checked against the catalogue configuration, checkout and webhook implementation. This is a code account, not a fresh live-payment test.',
    lanes: [
      { label: 'Content', steps: ['Artwork', 'Sellable formats', 'Catalogue and Stripe price'] },
      { label: 'Purchase', steps: ['Validated cart', 'Finite-stock reservation', 'Stripe Checkout'] },
      { label: 'Settlement', steps: ['Signed Stripe event', 'Reservation transition', 'Paid-order record'] },
    ],
    sections: [
      { title: 'Catalogue and ownership', text: 'One catalogue row represents one sellable format. An artwork grouping ID connects an original, print and card derived from the same painting. Product IDs, Stripe price IDs and inventory policy have technical ownership; the CMS describes that boundary separately from editable words and images.' },
      { title: 'Checkout and finite stock', text: 'The server resolves submitted product IDs to canonical catalogue entries and Stripe prices. Originals are restricted to quantity one. Finite-stock lines require an enabled inventory path and a reservation; unavailable stock, cart conflicts or database failures stop checkout. A fingerprint binds the attempt to its cart, and the attempt ID becomes the Stripe idempotency key.' },
      { title: 'Payment events and recovery', text: 'Webhook construction verifies the raw body with the Stripe signature. The handler distinguishes paid, pending asynchronous, expired and failed sessions, filters application ownership, and passes event and reservation IDs to the inventory repository before persisting a paid order. A definitive checkout-creation failure may release a new reservation; an uncertain failure retains it rather than assuming no payment session exists.' },
    ],
  },
  'becoming-diamond': {
    basis: 'Based on the existing published delivery account. Exact access-control and webhook implementation have not been re-audited for this page.',
    lanes: [
      { label: 'Customer journey', steps: ['Public website', 'Stripe membership', 'Gated course portal'] },
      { label: 'Content workflow', steps: ['Client edits in Decap', 'Versioned Git content', 'Course and site'] },
    ],
    sections: [
      { title: 'Membership and course access', text: 'The product joins a public acquisition surface to an authenticated member portal. Stripe handles the membership payment lifecycle; the portal provides access to the sequenced 30-day video course. Payment state and content access are separate concerns within the overall product.' },
      { title: 'A bounded AI component', text: 'The assistant occupies one part of the member experience and is scoped to course material. It sits alongside course delivery, profiles and membership rather than replacing the surrounding customer journey. The published account does not specify the retrieval or enforcement mechanism, so no stronger grounding guarantee is claimed here.' },
      { title: 'Client-owned content', text: 'Decap provides an editing interface over Git-backed content. Content changes are versioned and reversible without requiring the client to edit source code. Delivery covered the frontend, backend integrations, payments, content workflow and deployment on Vercel.' },
    ],
  },
  'loanslam': {
    basis: 'Describes the independent synthetic-data engine in the published technical account, not the proprietary contracted system or a fresh production-readiness assessment.',
    lanes: [
      { label: 'Proposal', steps: ['Retrieved synthetic corpus', 'Model TurnPlan', 'Zod contract'] },
      { label: 'Authority', steps: ['Policy validator', 'Answer, fallback or handoff', 'Per-turn audit trace'] },
    ],
    sections: [
      { title: 'Typed proposal, deterministic decision', text: 'The planner returns a TurnPlan containing an action, UI primitive, collected facts and cited corpus items. Zod parses that boundary. Plain-code validation then decides the final action, including whether grounding supports an answer and whether the proposed UI matches the permitted action.' },
      { title: 'Failure and escalation', text: 'The documented rules block unsupported account-specific promises and requests for forbidden financial credentials. Vulnerability signals take priority in routing. Malformed planner output becomes a recorded fallback. The trace retains the proposed action, final action, override reasons, retrieved items and safety flags.' },
      { title: 'Evaluation and maturity', text: 'Synthetic persona journeys and stochastic scenario generation exercise the conversation boundary. A separate signal extractor is documented in shadow mode, allowing recommended and actual routing to be compared without changing behaviour. Active signal-constrained routing was still described as in progress; that distinction is retained here.' },
    ],
  },
  'human-os': {
    basis: 'Architecture checked against the private platform’s routes and corpus, inference-validation, resurfacing and persistence code. No client corpus, correspondence or participant records are included here.',
    lanes: [
      { label: 'Grounding', steps: ['Authored archive', 'Canonical records and scoped packs', 'Snapshot-bound source references'] },
      { label: 'Exploration', steps: ['Ask and The Arc', 'Era-bounded Speak', 'Citations back to source'] },
      { label: 'Continuity', steps: ['Resurfaced work and discoveries', 'Explicitly kept Notebook items', 'Controlled sharing'] },
      { label: 'Invitations', steps: ['Approved source pack', 'Draft and human edit', 'Explicit sent confirmation'] },
    ],
    sections: [
      { title: 'A personal archive as an interface', text: 'The mobile-first platform organises access into distinct rooms: Ask, The Arc, People, Patterns and a Notebook, with invitation and source-management surfaces alongside them. The Arc presents work through time; Speak offers an explicitly bounded encounter with an earlier period of the author’s writing. This is a generated interpretation grounded in that period, not a recovered memory or a claim to reproduce the person.' },
      { title: 'Following one question through the system', text: 'Suppose the reader chooses an earlier year and asks what the author was writing about. The selected period limits the material supplied to the model. That material carries references to a particular version of the archive, so a citation can be resolved against the same source set used to produce the answer. Validation checks the returned references and quotations against that set. The reader can then open a source sheet to inspect the original passage. Those checks support traceability; they do not establish that every interpretation is correct.' },
      { title: 'Corpus contracts and provenance', text: 'The corpus layer separates snapshot resolution, structured records and pack artifacts. Queries carry snapshot IDs; filesystem artifacts use integrity checks. Scoped packs supply the model context, and generated citations are checked against the supplied source inventory. Quote validation checks text against those sources. Source sheets let the reader inspect the material behind a response.' },
      { title: 'Different kinds of persistence', text: 'Daily resurfacing is a deterministic function of date and corpus, preferring anniversaries without a scheduled model call. Speak’s conversation is held in memory. Notebook items are deliberately kept and have explicit share and take-back actions. Store interfaces support filesystem and Convex implementations; these are distinct persistence choices, not a claim that all conversations are automatically retained.' },
      { title: 'From discovery to an invitation', text: 'The invitation surface combines an approved source pack with voice rules and an editable draft. Its state machine distinguishes preparation from a human confirmation that something was sent. Source-pack records use supersession rather than silently rewriting earlier facts. The wider teaching-integration specification contains additional planned capabilities; those are not presented as delivered features here.' },
    ],
  },
  'the-pit': {
    basis: 'Based on the published architecture and staged delivery record. The account separates the arena from the evaluation work; a public interface capture is not a fresh backend audit.',
    lanes: [
      { label: 'Arena', steps: ['Authenticated request and limits', 'Model execution and streamed output', 'Stored run and traces'] },
      { label: 'Evaluation design', steps: ['Task and contestants', 'Rubric and failure classification', 'Comparison and cost accounting'] },
    ],
    sections: [
      { title: 'Execution and product boundaries', text: 'The documented arena uses a Next.js request path with authentication, request validation, credit and rate-limit checks before model execution. Server-sent events carry output to the client. Postgres, Redis caching and payment integration support the surrounding product.' },
      { title: 'Evaluation as a separate layer', text: 'The delivery record distinguishes a shipped arena from feature-branch task, run, contestant and trace work. Rubric judging, failure taxonomy, scorecards and per-run cost economics appear as subsequent phases. A useful evaluation needs both the task context and an inspectable execution record; a fluent debate alone is not evidence of task performance.' },
      { title: 'Reviewing the platform itself', text: 'The engineering account also records adversarial code review, tree-bound attestations and architectural decisions around development. These concern the process used to build the platform, separately from the controls applied to agents running inside it.' },
    ],
  },
  'sortie': {
    basis: 'Based on the published Python implementation account. Other material names a TypeScript/Bun version; this describes the documented design without asserting version equivalence.',
    lanes: [
      { label: 'Review', steps: ['One Git tree and diff', 'Independent model reviewers', 'Debrief synthesis'] },
      { label: 'Gate', steps: ['Convergence and severity', 'Policy-based merge decision', 'Attestation and ledger'] },
    ],
    sections: [
      { title: 'Parallel review and synthesis', text: 'A configurable roster reviews the same change independently. A further model synthesises findings into a structured debrief. Code, tests and documentation have separate review modes so the question and prompt can match the artifact being inspected.' },
      { title: 'The decision boundary', text: 'In the documented configuration, findings independently identified by at least two reviewers are convergent. Convergent critical or major findings can block a merge; single-reviewer findings remain recorded as advisory. That policy makes agreement actionable, but can also leave a serious single-reviewer finding non-blocking. It is a tradeoff to inspect, not a correctness guarantee.' },
      { title: 'Binding review to the artifact', text: 'Attestations are keyed to the Git tree rather than only a commit label. A change to the staged content invalidates the match with the reviewed tree. The structured ledger retains findings, dispositions and cost data so the review process can itself be evaluated.' },
    ],
  },
  'halo': {
    basis: 'Based on the published tool-layer architecture, with the tracking write and event-publication path checked against the current source. The running cluster and comparative performance have not been tested for this account.',
    lanes: [
      { label: 'Command path', steps: ['Person or agent', 'Shared typed CLI', 'Module-owned store'] },
      { label: 'Event path', steps: ['Emitted actions', 'NATS JetStream', 'Consumers and SQLite projections'] },
    ],
    sections: [
      { title: 'One operational surface', text: 'Modules for activities such as work tracking, briefing and orchestration expose explicit CLI commands. A human and an agent reach the same tool contract, avoiding a separate agent-only interface with different behaviour.' },
      { title: 'Local records and event delivery', text: 'Modules own isolated data stores, while an event stream supplies consumers with updates for their queryable views. Local writes and event delivery are separate operations. In the tracking path, a record is saved before publication is attempted, and the command ignores the publisher’s failure result. A local save can therefore succeed without the event reaching the stream. Replay alone cannot recover an event that was never published; the current implementation does not guarantee complete recovery from the event stream.' },
      { title: 'What would justify the machinery?', text: 'The records and domain tools can be assessed separately from the distributed advisor system that uses them. A useful next comparison would give one capable agent the same records and tools, then compare accepted outcomes, corrections, missed actions, operating cost and maintenance time on real tasks. That comparison has not yet established whether the fleet earns its additional complexity. Simplification remains a direction to test, not a claimed result.' },
      { title: 'Operating scope', text: 'The published implementation uses Python, SQLite, NATS JetStream, Docker and Kubernetes. It is personal infrastructure with distributed-runtime concerns, rather than a packaged client offering or the client-facing Human OS platform.' },
    ],
  },
};
