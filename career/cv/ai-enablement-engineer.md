# Richard Hallett

AI Enablement Engineer

---

I turn ambiguous, high-consequence work into AI-supported systems that people can trust and operate without depending on me. I start with the people and the process: where time, risk, and rework accumulate; whether the answer should be AI, deterministic automation, or a process change; and what evidence would show that it worked. Then I take the smallest useful intervention through architecture, production, measurement, and handoff.

I bring more than six years of professional software delivery and fifteen years of CBT practice across the NHS and private work. Recent work includes a fail-closed conversational engine for a regulated lender, agent evaluation and review systems, and client platforms operated independently by non-technical owners.

## Selected delivery

**Loans by MAL - regulated UK lender, contract (2026).** Delivered a customer-facing conversational system solo, from first conversation to working system in four weeks. The model produced a structured proposal for each turn; deterministic code enforced hard compliance boundaries before anything reached a customer. Credentials and vulnerability cases routed to a human, and every turn entered an audit trace. Hardened the system against adversarial, confused, oversharing, and vulnerable personas before happy-path testing. Defined scope across concurrent epics and presented technical direction to C-suite stakeholders. Vue, TypeScript, Node.js, Zod, Terraform, AWS.

**[Becoming Diamond](https://becoming-diamond.vercel.app/) - coaching business (2025).** Took the product from brief to revenue-ready: an animated marketing site and gated member portal with course content, AI chat, profiles, Stripe payments, and a git-based CMS. The client can update routine content without booking an engineer. Next.js, React 19, TypeScript, Tailwind, Stripe.

**Swanage Traffic Alliance - community campaign (2025).** Built the registration and campaign platform for a local traffic consultation. Non-technical volunteers run the administration flow without engineering support. Astro, React, Vercel.

## AI-native working practice

**[Sortie](https://github.com/rickhallett/sortie) - ensemble AI code review.** Sends the same diff independently to Claude, Codex, and Gemini, then uses a fourth pass to compare the findings. Convergent findings can block a merge on severity; single-model findings remain visible without becoming automatic blockers. Across six runs on a shipping codebase, 76.9 percent of findings appeared in only one review. One of those findings was a committed API key. TypeScript, Bun.

**The Pit - agent evaluation and cost visibility.** Runs structured contests between agents, retains an observable trace for each run, scores against explicit rubrics, tags failures, and records per-run cost down to microdollars. It answers three practical questions about a change: did quality move, what broke, and what did it cost? Next.js, TypeScript, Postgres, Stripe.

I use coding agents behind review gates in daily delivery. I own the problem framing, architecture, constraints, review, verification, and delivery decisions. I remain accountable for deciding whether the output is correct and safe to ship, regardless of who typed each line.

## Experience

**Oct 2024-present | Software Engineer | Oceanheart.ai, independent.** Client-facing delivery across process discovery, product engineering, applied AI, evaluation systems, deployment, support, and operational handoff.

**May-Jun 2026 | Full Stack Engineer | Loans by MAL, contract.** Delivered the regulated conversational system above across Vue and TypeScript front end, Node.js and TypeScript backend, shared Zod contracts, deterministic safety validation, and Terraform on AWS.

**Nov 2023-Mar 2024 | Software Engineer | EDITED, retail analytics.** Built React, TypeScript, and Python data-visualisation features and enterprise API integrations for an AI-driven retail analytics product.

**Jun 2021-Nov 2023 | Software Engineer | Brandwatch, social intelligence.** Built a greenfield enterprise data-visualisation platform in a team of five, modernised legacy Backbone code, and mentored junior developers.

**Sep 2020-Feb 2021 | Full Stack Engineer | Telesoft Technologies, network security.** Built secure cybersecurity application features using TypeScript, Angular, Node.js, and Express.

**Mar-Aug 2020 | Web and Frontend Developer | Appius.** Built CMS modules, customer portals, REST integrations, and responsive interfaces using .NET, JavaScript, and Vue.js.

**Apr 2019-Mar 2020 | Software Developer | School Business Services.** Built Vue.js interfaces for school financial-management software.

**2004-present | Cognitive Behavioural Therapist | NHS and private practice.** Worked across NHS and private practice; maintain a small private caseload alongside engineering.

## Education

**PGDip Cognitive Behavioural Therapy** - Royal Holloway, University of London

**PGCert Primary Mental Healthcare** - University of Central Lancashire

**BSc Psychology** - UWE Bristol

## Technical

**AI engineering:** agent and tool-layer architecture, evaluation harnesses, guardrails, fail-closed safety design, provider-agnostic multi-model pipelines, adversarial persona simulation, cost and token accounting

**Languages:** TypeScript, Python, Go, Bash

**Product engineering:** React, Next.js, Vue, Node.js, FastAPI, REST APIs, PostgreSQL, NATS

**Cloud and delivery:** AWS, Terraform, Docker, Kubernetes, Vercel, GitHub Actions, Grafana, Prometheus

**Enablement:** process discovery, scoping, C-suite communication, regulatory translation, production deployment, measurement, live support, operational handoff
