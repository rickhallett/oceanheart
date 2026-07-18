# Normal Computing pre-screen brief

Prepared for: Talent call, Monday 2026-06-29, 14:00 UK time
Candidate: Richard Hallett
CV source: `cv/richard-hallett-cv.html`

## One-line read

Sell Richard as a practical AI reliability/product engineer: someone who turns untrusted model output, ambiguous user behavior, and manual review loops into validated, traceable, product-grade workflows.

## Company snapshot

Normal Computing is building at the intersection of AI, semiconductor design, and physics-based hardware. Its public story has two linked tracks:

- Normal EDA: AI-native verification tooling for complex IP and SoC workflows. It generates verification collateral from specifications, supports human review, links tests back to source material, and aims to surface edge cases humans and general LLMs miss.
- Normal ASICs: physics-based/thermodynamic chips designed for stochastic, stateful, asynchronous computation, with a long-term promise around better AI efficiency per watt and dollar.

Relevant recent signal:

- Founded by former Google Brain and Google X people working around AI for the physical world and probabilistic/quantum ML.
- Offices listed in New York City, San Francisco, London, and Copenhagen.
- Public investor list includes Samsung Catalyst, Brevan Howard, ArcTern, Galvanize, Eric Schmidt, First Spark, Drive Capital, and Celesta.
- March 2026 funding release says Normal raised USD 50M led by Samsung Catalyst, bringing total funding to more than USD 85M.
- DRAMBench work shows their EDA thesis concretely: natural-language chip specs -> machine-checkable formal models -> measurable verification correctness.

## Primary role: Product Reliability Engineer

Best read: a reliability automation and AI-assisted validation role for complex technical products.

They are hiring for:

- validation systems,
- regression tooling,
- release validation,
- issue reproduction,
- debugging,
- failure-pattern documentation,
- product-engineering collaboration,
- LLM/agent workflows for testing and QA.

This maps unusually well to Richard's recent work if framed correctly. The phrase to keep coming back to is "untrusted AI output with deterministic control boundaries."

## Secondary role: Product Engineer

This was not directly applied for, but it is worth mentioning. It is the more full-stack product seat: TypeScript/React, backend APIs, AI workflows, developer tooling, technical UX, and product discovery for semiconductor engineers.

Best line:

"I applied for Product Reliability because the validation angle looked like the closest match, but I also saw the Product Engineer role. If the team thinks the better fit is full-stack AI workflow tooling, I would be interested in exploring that too."

## Fit

Strongest overlap:

- Fail-closed AI systems: LoanSlam treats model output as a proposal, validates it before customer exposure, and keeps traces for review.
- Evaluation tooling: The Pit covers traces, rubric scoring, failure tagging, and cost-per-run thinking.
- Agentic review: Sortie uses multiple models plus convergent severity gating for code review.
- Automation and CLI surfaces: Halo shows Python/SQLite/NATS/Docker/Kubernetes tool-building with explicit human/agent command surfaces.
- Full-stack shipping: EDITED, Brandwatch, Telesoft, SBS, and Oceanheart/client work show production React/TypeScript/Python/Node delivery.
- Human factors: CBT background is useful if framed as applied skill in ambiguity, careful questioning, and noticing plausible-but-wrong outputs.

The best pattern match to Normal EDA:

specification or user intent -> AI-generated proposal -> deterministic validation -> traceability -> human feedback -> regression evidence.

That is very close to both LoanSlam and Normal's public EDA vocabulary.

## Gaps

Be direct about these:

- No direct semiconductor, design verification, UVM/SystemVerilog, EDA, or hardware workflow background.
- Product Reliability may expect deeper QA/test-engineering ownership than a conventional full-stack role.
- Product Engineer may expect more polished interface/product discovery work than the current CV foregrounds.
- Normal is a deep technical company. Talent may worry about whether the candidate can ramp into hardware-domain language quickly.

Do not apologize for the gaps. Convert them into a learning mechanism:

"I would not claim semiconductor domain expertise. My way into domains is to build small executable models of the workflow: expected behavior, failure modes, traces, and checks. That is exactly how I approach reliability work."

## Sell the journey

The story should be simple:

1. "I started in human systems."
   Fifteen years as a CBT therapist means the candidate is unusually practiced at ambiguity, careful questioning, behavior under uncertainty, and safety-critical communication.

2. "Then I became a production engineer."
   Five years of real product work: React, TypeScript, Python, Node, data visualization, enterprise APIs, secure apps, deployment, client delivery.

3. "Now the two halves have converged in AI reliability."
   The strongest recent work is not chatbot wrapping. It is controlled AI systems where model output is untrusted until validated, traceable, and useful to a human.

4. "Normal is interesting because it is doing the hard version."
   Their problem is not generic AI UX. It is making AI useful inside technical systems where correctness, traceability, and expert review matter.

## 30-second pitch

I am a full-stack and AI engineer with about five years shipping production TypeScript, Python, and Node systems, after a first career as a CBT therapist. My recent work has focused on fail-closed AI workflows: LoanSlam uses an LLM to propose conversation turns but validates them deterministically before they reach a customer; The Pit and Sortie are about evaluation, traceability, failure tagging, and model-assisted review. I have not worked directly in semiconductors, but the Product Reliability role looks close to the work I have been doing: turning ambiguous workflows and untrusted AI output into tests, validators, traces, and repeatable reliability systems.

## If they ask "Why Normal?"

Because Normal looks like one of the few companies applying AI to a genuinely hard correctness problem. The EDA work is about specs, generated collateral, traceability, human feedback, and measurable quality. That is much more interesting to me than a generic chat interface. My recent work has been about the same control problem in a different domain.

## If they ask "Why this role?"

Product Reliability looks like the cleanest match because it asks for AI-assisted validation, debugging, regression tooling, release confidence, failure reproduction, and automation. I can bring practical engineering judgment, full-stack context, and unusually strong instincts around ambiguity and failure modes.

## If they ask "What is the gap?"

The honest gap is semiconductor domain experience. I would not pretend otherwise. The offset is that I have repeatedly had to model unfamiliar, high-stakes workflows by finding expected behavior, turning it into executable checks, and using traces to make failure visible. I would want to pair quickly with domain experts and encode what they know into tests, validators, and review loops.

## Questions to ask

- For Product Reliability, what are the highest-friction validation workflows today: generated collateral quality, regression coverage, release confidence, or issue reproduction?
- Where are agents already helping, and where are they still too brittle?
- How does the team currently measure quality of generated verification artifacts?
- How much of the role is writing tests/tooling versus working directly with product engineers and users?
- Is semiconductor/domain knowledge expected on entry, or is the team more interested in reliability automation and AI-agent fluency?
- Would Product Engineer be a better fit if the team wants full-stack AI workflow tooling rather than reliability specialization?

## Phrases to use

- "model output as proposal, not truth"
- "deterministic validation around probabilistic systems"
- "traceable failure modes"
- "turn manual review into durable checks"
- "human-in-the-loop without making the human the whole safety system"
- "small executable models of expected behavior"

## Phrases to avoid

- "I can pick up semiconductors quickly" without explaining the mechanism.
- "My therapy background makes me good with AI" as a standalone claim.
- "I am senior enough to..." The CV is strongest when concrete, not inflated.
- "Fail-closed" every sentence. Use it once, then show the mechanism.

## Best closing

I am very interested in the Product Reliability role because it sits exactly where my recent work has been strongest: AI-assisted engineering, validation, failure analysis, and product reliability. I am also open to the Product Engineer track if the team thinks my full-stack product background is the better match.

## Sources

- Product Reliability Engineer: https://jobs.ashbyhq.com/NormalComputing/8eeba301-de75-4a09-b174-b027ae721301
- Product Engineer: https://jobs.ashbyhq.com/NormalComputing/6228a7ca-2a62-47ce-99dd-08bed646db94
- Normal Computing about: https://www.normalcomputing.com/about
- Normal EDA: https://www.normalcomputing.com/solutions/eda
- Normal ASICs: https://www.normalcomputing.com/solutions/asics
- DRAMBench: https://www.normalcomputing.com/blog/from-specifications-to-formal-models-autoformalizing-memory-chips-with-drambench
- Funding release: https://www.prnewswire.com/news-releases/normal-computing-raises-50m-led-by-samsung-catalyst-to-accelerate-silicon-design-and-solve-ai-hardware-energy-crisis-302724819.html
