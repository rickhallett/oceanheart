# Richard (Kai) Hallett

Forward Deployed Engineer

---

Product engineer with 6.5 cumulative years of professional software engineering since April 2019 across salaried roles, contracts, client delivery, and independent product development. I work best where the problem is still moving: embedding with the people affected, finding the operational constraint behind the brief, and carrying a useful system from discovery through production and handoff.

My recent focus has been applied AI and agentic systems, including evaluation, guardrails, fail-closed design, and provider-agnostic delivery. Before engineering, I spent fifteen years as a cognitive behavioural therapist in the NHS and private practice. That background transfers directly to high-stakes discovery, stakeholder trust, and noticing when confident output is wrong.

## Selected engagements

**[Loans by MAL](https://mal-demo.up.railway.app/) - regulated UK lender, contract (2026).** Turned regulatory constraints into a fail-closed conversational system: an untrusted LLM proposes each turn, a deterministic policy validator overrides unsafe output before it reaches a customer, and every turn is audit-traced. Hardened the engine against adversarial, confused, oversharing, and vulnerable personas before happy-path testing. Defined scope across concurrent epics, presented technical direction to C-suite stakeholders, and benchmarked providers on accuracy, cost, and safety behind a swappable adapter. Vue, TypeScript, Node.js, Zod, Terraform, AWS.

**[Sarah Mozer Studio](https://www.sarahmozer.org) - independent client engagement (2026).** Led discovery, implementation, deployment, and ongoing support for a Dorset artist's production commerce system. Built a typed Next.js and TinaCMS catalogue, live Stripe Checkout, a Neon-backed order projection, fail-closed finite-stock controls, and a protected owner guide around a low-administration operating model. Verified paid checkout and signed webhook processing end to end in test mode, then staged the live cutover with production read-back. Continued into owner enablement, using the live CMS, repository rules, and annotated screenshots to help the client edit safely while keeping payment and inventory fields protected.

**[Becoming Diamond](https://becoming-diamond.vercel.app/) - coaching business (2025).** Took the product from brief to revenue-ready: an animated marketing site and gated member portal with course content, AI chat, profiles, Stripe payments, and a git-based CMS the client could edit independently. Next.js, React 19, TypeScript, Tailwind, Stripe.

## Selected systems

**[LoanSlam production deployment](https://mal-demo.up.railway.app/) - full Nuxt website with an embedded assistant.** A synthetic-data rendition of the complete lending journey, using the current fail-closed conversation engine alongside evaluation reports and observable traces that turn safety claims into inspectable evidence. Nuxt, Vue, TypeScript, Node.js, Zod.

**[Sortie](https://github.com/rickhallett/sortie) - ensemble AI code review.** Three LLMs review a diff in parallel, a fourth synthesises, and merge is gated on convergent severity. Across six runs on a shipping codebase, 76.9% of distinct findings were surfaced by exactly one of the three reviewing models. One of those model-unique findings was a committed API key. TypeScript, Bun.

**[The Pit](https://thepit.cloud) - agent evaluation and cost visibility.** Structured multi-agent contests with observable traces, rubric scoring, failure tagging, and per-run microdollar cost accounting. Next.js, TypeScript, Postgres, Stripe.

## Experience

**Oct 2024-present | Software Engineer | Oceanheart.ai, independent.** Client-facing product delivery and independent engineering across applied AI, evaluation systems, commerce, content workflows, deployment, and support.

**May-Jun 2026 | Full Stack Engineer | Loans by MAL, contract.** Built the regulated conversational system above across Vue and TypeScript front end, Node.js and TypeScript backend, shared Zod contracts, deterministic safety validation, and Terraform on AWS.

**Nov 2023-Mar 2024 | Software Engineer | EDITED, retail analytics.** React, TypeScript, and Python data-visualisation features plus enterprise API integrations for an AI-driven retail analytics product.

**Jun 2021-Nov 2023 | Software Engineer | Brandwatch, social intelligence.** Built a greenfield enterprise data-visualisation platform in a team of five, modernised legacy Backbone code, and mentored junior developers.

**Sep 2020-Feb 2021 | Full Stack Engineer | Telesoft Technologies, network security.** TypeScript, Angular, Node.js, Express, and secure features for cybersecurity applications.

**Mar-Aug 2020 | Web and Frontend Developer | Appius.** CMS modules, customer portals, REST integrations, and responsive interfaces using .NET, JavaScript, and Vue.js.

**Apr 2019-Mar 2020 | Software Developer | School Business Services.** Vue.js front end for school financial-management software.

**2004-2026 | Cognitive Behavioural Therapist | NHS and private practice.** Fifteen years of clinical practice; maintained a small private caseload alongside engineering.

## Education

**PGDip Cognitive Behavioural Therapy** - Royal Holloway, University of London

**PGCert Primary Mental Healthcare** - University of Central Lancashire

**BSc Psychology** - UWE Bristol

## Technical

**Languages:** TypeScript, Python, Go, Bash

**AI engineering:** agent and tool-layer architecture, evaluation harnesses, guardrails, fail-closed safety design, provider-agnostic multi-model pipelines, adversarial persona simulation, cost and token accounting

**Product engineering:** React, Next.js, Vue, Node.js, FastAPI, REST APIs, PostgreSQL, NATS

**Cloud and delivery:** AWS, Terraform, Docker, Kubernetes, Vercel, GitHub Actions, Grafana, Prometheus

**Client-facing:** discovery, scoping, C-suite communication, regulatory translation, production deployment, live support, operational handoff
