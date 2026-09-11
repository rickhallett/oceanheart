# Studio: personally maintained agents for individual practitioners

Decision date: 11 September 2026. Product owner: Richard Hallett. Tracking: [RIC-134](https://linear.app/tinyrick/issue/RIC-134). This records the product direction agreed in conversation; it does not claim the dedicated-instance architecture has been implemented.

This document supersedes the development priorities in [RAD-ROADMAP.md](RAD-ROADMAP.md). Existing implementation contracts and release evidence remain valid within their original scope. Supporting documents: [mock-client laboratory](MOCK-CLIENTS.md), [landing-page copy audit](STUDIO-COPY-AUDIT-2026-09-11.md).

## The offer

Oceanheart brings agents to people who want useful work done without having to learn agent harnesses, curate integrations, or go through the growing pains of configuring and maintaining them. The initial audience is individual practitioners: therapists, coaches, bodyworkers and other people running their own practice.

Richard supplies the practical and domain knowledge needed to turn a request into a working agentic workflow: choose the context, write specific instructions, connect tools, test realistic cases, tune behaviour, investigate failures and improve it with the person over time. Good harnesses make this possible; operating them well still takes experience.

Studio is the practitioner's confidential, controllable space for the resulting tools, work, conversations and requests for change. It gives the ongoing service a home instead of scattering its outputs through documents, emails and instructions. Its interface may differ between clients because their work differs.

Suggested language:

> Don't learn another tool. Work with a human who makes the tools work for you.

> Oceanheart helps you organise and improve the way your practice runs. Studio is your private space for the tools, results and ongoing support we build around you.

“Enterprise-grade, human-sized” describes access to capable technology through personal, experienced stewardship. It is not evidence of a particular certification or service-level agreement. Public wording must distinguish current functionality from the service and architecture being developed.

## What is being developed

The principal unit of delivery is a dedicated client instance, provisioned from a Studio template and adapted to its practitioner. This is the primary development target, rather than a later hosting enhancement. A generic task list or integration catalogue alone cannot demonstrate the intended offer.

Each instance needs a persistent identity and its own versioned working environment: code, configuration, instructions, context/source references, integration bindings, agent sessions and execution history. Its runtime, credentials and data must be scoped to that client. The exact deployment, database and identity topology remains an implementation decision; an ordinary practice row in today's shared application is not proof that this target exists.

Dedicated does not mean continuously running. Compute may start for a request, scheduled job, external event or development session and stop afterwards. The client's state, history and working version persist between runs.

The client can ask their assistant to do work and request changes to the workflow or Studio itself. An agent may implement a bespoke integration or alter that client's code and interface. The development loop must connect the request to a proposed change, examples/checks, a version and an observable result. Which actions run automatically is configured for the engagement and action type; a coding capability should not accidentally grant unrelated operational authority.

## An agent workbench

Richard needs a bench for developing and maintaining these instances. A bespoke operator console is not a prerequisite. Working with a client's agent could mean opening its harness, examining retrieval, changing instructions, replaying an execution, comparing models or evaluating a code change.

The workbench must let him:

- Select the correct client environment and resume its sessions/context.
- Inspect and version prompts, practical instructions, tool definitions and source collections.
- Compare harness, model and retrieval configurations against the same examples.
- Examine traces and outputs, annotate errors and convert corrections into regression cases.
- Build and test changes in the client's environment, then identify the version serving that client.
- Export the essential configuration, cases and records so a tool can be replaced.

Pi is the preferred harness candidate from this discussion because extensibility matters. LangGraph and LangSmith, or other services, are candidates for parts of the bench; none is selected or required by this document. Evaluate a small combination against an actual mock-client workflow before building equivalent infrastructure. A useful bench may initially be a repository, CLI/harness and existing evaluation/trace tools connected by client and run identifiers.

## Workflow contract and auditability

For “track sessions and prepare invoices”, the agent needs the session ledger, attendance/cancellation status, agreed rates, prepaid arrangements, billing periods, previous invoice references and the practitioner's instructions. Retrieval can supply relevant policy; explicit calculations and validated records determine amounts. The model must not invent attendance or pricing to complete an invoice.

Each workflow should specify its purpose, available context and tools, versioned instructions, expected output, handling of uncertainty, allowed actions and representative acceptance cases. A useful trace connects the triggering request, available input/source versions, model/configuration, tool calls and results, output, human corrections and code/release version. Private payloads belong in the client environment, not the template repository; secrets should not appear in traces.

Auditability means a reviewable record of observed interaction and execution, with an explicit retention/export policy. It does not imply visibility into hidden model reasoning or identical regeneration from a nondeterministic provider. Record concise decision explanations and evidence where they help the practitioner or maintainer.

Rehearsal and replay must not repeat external effects accidentally. Synthetic scenarios use fictional inputs and effect stubs; provider integration checks use dedicated test accounts. Actual client acceptance is separately recorded. These are tools for rapid experimentation, not a new sequence of ceremonial review gates.

## Integrations and hosting constraints

Integrate with the services that already serve the person well. Their existing mailbox is a first-class requirement, not an obstacle to remove by migration. Studio owns the presentation and workflow relationship; individual integrations may have entirely different implementations behind that boundary.

Use established connectors, workflow engines, managed retrieval and APIs where they make delivery easier and fit the deployment model. Use bespoke code where that is simpler or where a provider's commercial restrictions defeat the point. Avoid rebuilding whole website, booking, payment or knowledge platforms merely to own the feature list.

Oceanheart must be able to deploy and maintain client instances on infrastructure it controls. A free option restricted to infrastructure operated by the practitioner does not meet that requirement. n8n is excluded from the default architecture unless the exact Oceanheart-controlled deployment model is permitted without a required enterprise/embedding contract. This is the user's selection constraint, not a claim that every n8n consulting arrangement is prohibited. Do not pause the project to negotiate such a contract; use another component or custom implementation.

Helping a person set up their own Zapier account and workflows is different from embedding/white-labelling Zapier. An ordinary client-owned account may be useful with supported delegated access, suitable functionality and acceptable costs. White-label participation is not a prerequisite for this service. No provider is mandatory. Ordinary infrastructure/API usage costs remain distinct from a requirement to buy enterprise embedding rights.

Managed RAG remains a candidate for the knowledge centre. Source authority, client access, versioning and useful citations remain Oceanheart responsibilities even if ingestion, indexing and retrieval are purchased. Provider selection and benchmarks are future bounded work, not settled by naming a product here.

## Adaptation and reusable patterns

Start from a versioned template and preserve each client's working version. Client extensions are the preferred place for custom behaviour; a deeper fork is available when the work requires it. Template updates should be evaluated against that client's cases, not silently overwrite adaptations.

Harvest useful integrations and patterns after they work: extract the general implementation, remove client material, add synthetic examples, describe prerequisites and version the result. A Studio plugin marketplace is a possible later distribution channel. Neither a marketplace nor a universal plugin specification is needed to prove the first engagement.

## Development sequence

1. **Provision a dedicated mock-client instance.** Establish the reproducible instance manifest, runtime/data boundary, persistent agent workspace and trace references. Reprovision it and resume after compute stops. Provision a second instance to demonstrate independent state and versions.
2. **Use the bench on one concrete workflow.** Start with Amira's enquiry handling or Clara's session/invoice preparation. Define context and expected outcomes before tuning the model. Serve the result in that client's Studio.
3. **Adapt through conversation.** Apply a request that changes instructions, retrieval, an integration or code. Compare against the original and new examples, and expose the resulting version and behaviour.
4. **Prove client-specific differences.** Give the second practitioner different rules and check that adapting one has not changed the other. Exercise a second provider when the selected workflow needs it.
5. **Work with real practitioners.** Use what they actually need and correct as the source of further development. Extract reusable patterns when demonstrated, not from a speculative feature catalogue.

The mock cast is a laboratory, not eight products that must all be completed before inviting a real person. Marketplace, team collaboration, multimedia tooling, full platform replacement and an elaborate operator dashboard are outside the immediate sequence.

## Purpose and evidence of value

This is a practical exploration of novel, difficult engineering with people, a demonstration of Richard's skills and a potential paid service. Do not assume it will fail commercially, and do not require a conventional mass-market software business case to justify the experiment. Income and sustainable delivery remain hypotheses to test.

Track outcomes that illuminate the work: useful tasks completed, practitioner corrections, time recovered as reported or measured, adaptation time, recurring maintenance effort and per-client running cost. Synthetic passes demonstrate behaviour; they do not establish demand, income or actual time saved.

## State of this change

This is documentation only. Dedicated provisioning, the workbench, external agent workflows and conversation-driven client code changes are development targets, not newly delivered capabilities. Existing Studio components may be reused after checking their fit; this decision does not delete or replace them.

Baseline checked on Richards-Air.home: clean `studio/dev` and remote head `fd8d43bc16a3eaa89859c624b740c6c1a72a0858`. Vercel staging alias resolved to `dpl_GPJ2z1eSEZUpS5zNXaERarsKTUjf`, URL `https://oceanheart-studio-1r103ibif-rick-halletts-projects.vercel.app`, with that Git source. Staging is identified by the custom environment/alias (the raw deployment API target is null). Existing Knowledge UI acceptance receipt is historical and scoped to its tested journeys; no new authenticated acceptance run was performed for this document.

Website audit source: live `https://www.oceanheart.ai/studio`; production deployment `dpl_BzAV73Uwt2MvxnyS35pQrF8tKE9Z`, URL `https://oceanheart-bek21t151-rick-halletts-projects.vercel.app`, Git source main `b6c57a09d9556379f89fff696daf186ad4361324`. Provider metadata establishes frontend provenance, not backend deployment or complete feature acceptance. No database impact: no schema, functions, indexes, configuration or data changed.
