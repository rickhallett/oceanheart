# Studio landing-page copy audit

11 September 2026. Read-only audit delegated to Astra with low reasoning, as requested by Richard. Product context: [Product direction](PRODUCT-DIRECTION.md). No website copy was edited or deployed.

## Observed source and limits

[Live Studio landing page](https://www.oceanheart.ai/studio). The apex `https://oceanheart.ai/studio` redirected there and returned HTTP 200. The worker retrieved live HTML through curl after web-open failed. It reviewed text in the delivered HTML; interactive tabs and carousel states were not exercised. This is not an exhaustive review of content fetched only after interaction or a visual acceptance test.

Root independently resolved website provider metadata: production deployment `dpl_BzAV73Uwt2MvxnyS35pQrF8tKE9Z`, URL `https://oceanheart-bek21t151-rick-halletts-projects.vercel.app`, main source `b6c57a09d9556379f89fff696daf186ad4361324`. These are audit-time observations, not permanent alias guarantees. The quotes below are observed live copy; replacements are proposals.

## Assessment

The page already communicates personal support, bespoke engineering and gradual adaptation. The main mismatch is emphasis: it introduces Studio through practice-management features and customisation, while the clarified offer centres personally configured, tested and maintained agents, delivered through a dedicated Studio.

Preserve approachable language. Explain the work an agent can help with and how Richard prepares and maintains it. Harnesses, retrieval systems, model comparisons and deployment topology belong in engineering documents.

## Priority changes

| Priority | Placement and observed copy | Reason | Proposed replacement |
| --- | --- | --- | --- |
| P1 | Hero: “Studio brings clients, enquiries, appointments and tasks together.” | Defines the offer by application features | “Don't learn another tool. Work with a human who makes the tools work for you.” Supporting text: “Oceanheart helps independent practitioners put AI agents to work on everyday administration. Rick shapes their instructions, connects the information they need, tests how they work and helps keep them useful as your practice changes.” |
| P1 | Hero support: “Work with Rick at Oceanheart to adapt it, connect your everyday tools and build the things your particular practice needs.” | Good intent; specify the role of Studio | “We're developing Studio as your private place to see the results, review proposed actions and ask for changes.” Use present-tense capability wording only once those journeys are delivered. |
| P1 | Audience: “For independent therapists, coaches, bodyworkers and small practices.” | Narrow current scope to individual practitioners | “For independent therapists, coaches, bodyworkers and other individual practitioners.” |
| P1 | Foundation: “Studio gives your practice a shared foundation.” | Shared is ambiguous under the dedicated-instance direction | “We're building Studio so your practice can have its own setup, shaped around your work and adapted over time.” |
| P1 | Accordion: “Help a small team hold the work together” | Team workflows are outside the initial audience | “Track the sessions. Prepare the paperwork.” Example request: “The work is done. The invoicing still takes my evening.” Body: “We can shape an agent around your session records, rates and cancellation rules to prepare an invoice for your review. Try ordinary cases and awkward exceptions together, then improve the instructions as your practice changes.” |
| P1 | Availability labels: “Shape with Rick” / “Develop together” | Distinguish the current demo from the proposed service | “Try the current workspace” with “Explore the fictional practice demo”; “Build your first workflow” with “Bring one recurring administrative job. Agree the context, instructions and checks it needs”; “Adapt it through use” with “Review the results with Rick and improve the workflow as you learn what helps.” |
| P2 | Biography: “I work with AI every day to investigate, prototype and build.” | Explain ongoing agent stewardship | “I work with AI every day. I turn a practical need into instructions, context and a working workflow, then test the results and refine them with you.” |
| P2 | Closing: “Start with something that takes too much effort, an idea you haven't been able to try. I can help you think bigger.” | Focus the initial engagement | “Bring one piece of administration you keep putting off. We'll work out whether an agent could help, what it needs to know and how you'll judge the result.” |

## Add

Near the existing personal-support section:

> **Capable agents. Someone who knows your work.**
>
> Getting useful work from an agent takes context, clear instructions and practice. Rick helps build that setup around you, checks it against realistic examples and stays involved as your needs change.

Near an enquiry or invoice example, explain the intended traceability in concrete terms:

> We're building a record of the information behind a result, what the agent did and what needs your attention. Corrections help us improve the workflow with you.

The phrase “Enterprise-grade, human-sized” was not present in the retrieved live text. If reintroduced, explain it immediately as “Capable AI tools, configured and maintained with personal attention to your practice.” Do not use it as an unsubstantiated certification, availability or service-level claim.

## Retain

- “Good software. Someone on your side. A way to make it yours.”
- “Keep the tools that serve you.” This supports the existing-mailbox requirement.
- Conditional wording in the enquiry example: “An AI assistant could…”
- “Rehearse a change before people depend on it”, including fictional cases and awkward exceptions.
- “You work with the person who can understand the difficulty, make the change and help keep it working.”
- “A working relationship can continue after the first build.”
- The current-demo label and fictional-practice explanation.

## De-emphasise or remove

- Team handoffs and shared administrative views in the solo-practitioner phase.
- Group/community expansion as a major promise.
- Change “capacity or team change” to “services, capacity or working preferences change”.
- Workbench product names and deployment jargon in public copy.
- Marketplace promises before useful patterns have emerged from actual engagements.

## Proposed page narrative

1. The practitioner wants administrative help without becoming an AI specialist.
2. Richard configures, tests and maintains an agentic workflow around their practice.
3. Studio is being developed as the private place for results, review and requests.
4. Demonstrate an enquiry workflow and a session-to-invoice workflow, with accurate availability labels.
5. Clearly separate today's working demo from what is being built with early practitioners.
6. Invite one real example for an initial conversation.

Dedicated instances are central to engineering. Their practical consequence for the public page is a setup shaped around the practitioner and maintained over time. A later copy implementation should start from the then-current deployed website source and go through the website release line; this Studio documentation branch is not a website release candidate.
