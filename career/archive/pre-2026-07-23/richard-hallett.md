> Archived application-era CV source. It is not a current drafting or upload
> source. See `career/README.md` for the canonical CVs.

# Richard (Kai) Hallett

Software Engineer · Dorset · kai@oceanheart.ai · github.com/rickhallett · oceanheart.ai

Full-stack developer with 5 years shipping production code in TypeScript, Python, and Go across retail analytics (EDITED), social intelligence (Brandwatch), network security (Telesoft), and independent client work. Recent work sits close to both AI roles: client websites and portals, backend/API work, payments, deployment, and AI-assisted delivery tooling.

Before engineering I spent 15 years as a cognitive behavioural therapist. The useful carryover is practical rather than decorative: spotting plausible but wrong output, asking better questions under uncertainty, and keeping systems safe when people are involved.

## Selected work

**LoanSlam.** A fail-closed conversation engine for a regulated lending domain, built after a one-month Loans by MAL contract as my own take on how it should work. The LLM proposes each turn, a deterministic validator enforces compliance rules and blocks unsafe output before it could reach a customer, and every turn is audit-traced. There is a live demo you can drive and an evaluation reports page, both over synthetic data. Demo at x827e1872-production.up.railway.app, reports at x827e1872-production.up.railway.app/reports.

**The Pit.** Evaluation platform for multi-agent systems: observable traces, rubric scoring, failure tagging, and cost tracking per run. Built to answer the commercial question behind AI tooling: what did this run cost, what did it catch, and is the extra model call worth it? Next.js, TypeScript, Postgres, Stripe. Live at thepit.cloud.

**Sortie.** AI-assisted code review and internal delivery tooling. Three LLMs review a diff in parallel, a fourth synthesises, and merge is gated on convergent severity. In one run, a committed API key was surfaced by only one of the reviewers. github.com/rickhallett/sortie.

**Halo.** Personal engineering tool layer: CLI modules for work tracking, memory, briefing synthesis, email triage, journaling, and agent orchestration. Each module has an explicit CLI surface and isolated storage so humans and agents can use the same tools. Python, SQLite, NATS JetStream, Docker, Kubernetes. github.com/rickhallett/halo.

**Becoming Diamond.** Production client product: marketing site and gated member portal delivering a 30-day video course, with AI chat, Stripe payments, and a git-based CMS for client editing. Built across front end, backend integration, payments, content workflows, and deployment. Next.js, React 19, TypeScript, Stripe, Decap CMS.

## Experience

**2024-present · Software Engineer · Oceanheart.ai (independent)**
Client-facing full-stack work and AI delivery tooling. Recent projects include the Becoming Diamond portal, STA campaign platform, and Loans by MAL conversational engine. Work covers scoping, build planning, implementation, integration, deployment, and support.

**2026 (May-June) · Full Stack Software Developer · Loans by MAL (contract)**
Built the first version of a fail-closed AI conversation engine for a UK lending context. I implemented the Vue/TypeScript front end, the Node.js/TypeScript backend, shared Zod contracts, and deterministic safety validation. I turned an open-ended product problem into shippable slices across turn planning, retrieval, audit trail, and compliance, and used persona-driven simulation to test confused, adversarial, and vulnerable customer journeys before happy-path polish.

**2023-2024 · Software Engineer · EDITED · retail analytics**
React, TypeScript, Python. Data-visualisation features and enterprise API integrations for an AI-driven retail analytics SaaS.

**2021-2023 · Software Engineer · Brandwatch · social intelligence**
Greenfield enterprise data-visualisation platform in a team of 5. Built scalable React components, modernised legacy Backbone code, and mentored junior developers.

**2020-2021 · Full Stack Engineer · Telesoft Technologies · network security**
TypeScript, Angular, Node.js. Secure features for cybersecurity applications.

**2019-2020 · Software Developer · School Business Services**
Vue.js frontend for school financial-management software.

**2004-2026 · Cognitive Behavioural Therapist · NHS / Private Practice**
PGDip CBT, Royal Holloway, University of London. Now a small private caseload alongside engineering.

## Education and technical

PGDip Cognitive Behavioural Therapy, Royal Holloway, University of London  
PGCert Primary Mental Healthcare, University of Central Lancashire  
BSc Psychology, UWE Bristol

**Languages:** TypeScript, Python, Go, Bash  
**Frontend:** React, Next.js, Vue, Angular, Astro, Tailwind  
**Backend:** Node.js, FastAPI, REST APIs, PostgreSQL, SQLite, NATS  
**Delivery:** Git, GitHub Actions, Vercel, Docker, AWS, Terraform/OpenTofu, Kubernetes  
**AI:** LLM integration, agent/tool-layer architecture, provider-agnostic adapters, AI-assisted code review, rubric evaluation, cost/token tracking, fail-closed safety patterns  
**Client work:** scoping, estimates, production support, stakeholder communication, CMS workflows, legacy CMS content recovery, Stripe payments
