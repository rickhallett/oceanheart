# Richard Hallett

AI Automation & Enablement Engineer

---

I turn ambiguous, repetitive work into AI-supported systems that people can trust and operate without depending on me. I start with the people and the process: where time, risk, waiting, and rework accumulate; whether the answer should be AI, deterministic automation, custom software, or a process change; and what evidence would show that it worked. Then I carry the smallest useful intervention through architecture, production, measurement, support, and handoff.

I bring more than six years of professional software delivery and fifteen years of CBT practice across the NHS and private work. I use AI heavily in engineering while retaining responsibility for the architecture, review, debugging, and delivery decisions. Recent work includes regulated conversational systems, customer portals, commerce and payment workflows, agent evaluation, signed webhooks, and owner-facing tools for non-technical clients.

## Selected delivery

**Loans by MAL - regulated UK lender, contract (2026).** Delivered a customer-facing conversational system solo from first conversation to working system in four weeks. The model produced a structured proposal for each turn; deterministic code enforced hard compliance boundaries before anything reached a customer. Credentials and vulnerability cases routed to a human, and every turn entered an audit trace. Hardened the system against adversarial, confused, oversharing, and vulnerable personas before happy-path testing. Defined scope across concurrent epics and presented technical direction to C-suite stakeholders. Vue, TypeScript, Node.js, Zod, Terraform, AWS.

**[Sarah Mozer Studio](https://www.sarahmozer.org) - independent artist (2026).** Led discovery, implementation, deployment, and ongoing support for a production commerce system. Built the typed catalogue, Stripe Checkout, signed webhook processing, Neon-backed order projection, finite-stock controls, and a protected CMS workflow. The owner can update products and content without touching code. Next.js, TypeScript, TinaCMS, Stripe, Neon, Vercel.

**[Becoming Diamond](https://becoming-diamond.vercel.app/) - coaching business (2025).** Took the product from brief to revenue-ready: a marketing site and gated member portal with course content, AI chat, profiles, Stripe payments, and a git-based CMS. The client can update routine content without booking an engineer. Next.js, React 19, TypeScript, Stripe.

## Automation and AI systems

**[Sortie](https://github.com/rickhallett/sortie) - ensemble AI code review.** Sends the same diff independently to Claude, Codex, and Gemini, then compares the findings. Convergent findings can block a merge on severity; single-model findings remain visible without becoming automatic blockers. Across six runs on a shipping codebase, 76.9 percent of findings appeared in only one review. One finding exposed a committed API key. TypeScript, Bun.

**The Pit - agent evaluation and cost visibility.** Runs structured contests between agents, retains an observable trace for each run, scores against explicit rubrics, tags failures, and records per-run cost. It answers three operational questions about a change: did quality move, what broke, and what did it cost? Next.js, TypeScript, PostgreSQL, Stripe.

## Experience

**Oct 2024-present | Software Engineer | Oceanheart.ai, independent.** Client-facing delivery across process discovery, product engineering, applied AI, integrations, deployment, support, and operational handoff.

**May-Jun 2026 | Full Stack Engineer | Loans by MAL, contract.** Delivered the regulated conversational system above across a Vue and TypeScript front end, Node.js and TypeScript backend, shared Zod contracts, deterministic safety validation, and Terraform on AWS.

**Nov 2023-Mar 2024 | Software Engineer | EDITED, retail analytics.** Built React, TypeScript, and Python data-visualisation features and enterprise API integrations for an AI-driven retail analytics product.

**Jun 2021-Nov 2023 | Software Engineer | Brandwatch, social intelligence.** Built a greenfield enterprise data-visualisation platform in a team of five, modernised legacy Backbone code, and mentored junior developers.

**Sep 2020-Feb 2021 | Full Stack Engineer | Telesoft Technologies, network security.** Built secure cybersecurity application features using TypeScript, Angular, Node.js, and Express.

**Mar-Aug 2020 | Web and Frontend Developer | Appius.** Built CMS modules, customer portals, REST integrations, and responsive interfaces using .NET, JavaScript, and Vue.js.

**Apr 2019-Mar 2020 | Software Developer | School Business Services.** Built Vue.js interfaces for school financial-management software.

**2004-2026 | Cognitive Behavioural Therapist | NHS and private practice.** Worked across NHS and private practice and maintained a small private caseload alongside engineering.

## Education

**PGDip Cognitive Behavioural Therapy** - Royal Holloway, University of London

**PGCert Primary Mental Healthcare** - University of Central Lancashire

**BSc Psychology** - UWE Bristol

## Technical

**Automation and backend:** TypeScript, Python, Node.js, FastAPI, REST APIs, PostgreSQL, signed webhooks, NATS, payment and content workflows

**AI engineering:** LLM APIs, agent and tool-layer architecture, evaluation harnesses, guardrails, fail-closed safety design, provider-agnostic multi-model pipelines, adversarial simulation, cost and token accounting

**Cloud and delivery:** AWS, Terraform, Docker, Kubernetes, Vercel, GitHub Actions, Grafana, Prometheus

**Enablement:** process discovery, workflow mapping, scoping, C-suite communication, regulatory translation, production deployment, live support, measurement, operational handoff
