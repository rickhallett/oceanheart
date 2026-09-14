# Lab notebook publication and repository separation

Captured 14 September 2026 from Richard's product reflection. This records direction and open questions; it is not an implementation or release decision.

## Why this matters

Oceanheart's attention to design and openness about its infrastructure are meaningful parts of the work. The coding harness, agent workflows and supporting infrastructure are a rich area for technical exploration. That work deserves a visible, durable record alongside the product presentation.

The intent is to document what is being explored and learned with enough specificity for readers to judge it. Technical depth should remain visible as the product positioning develops, without assuming that a polished presentation establishes superiority over other builders.

## Publication direction

Create a lab book or notebook-style publication: a very simple static build from Markdown. Keep writing and publishing lightweight. A useful entry could record the question, approach, observations, limitations and next experiment; this is a suggested shape, not a required publishing system.

The existing Hugo roots are a candidate to reuse. At the captured website source, `hugo.toml` and `content/` remain available. Their suitability for a separate publication still needs a small assessment.

A dedicated subdomain is one possibility. `labnotes.oceanheart.ai` is a working example, with a better name still welcome. No name, DNS change or hosting choice has been agreed.

A small standalone repository is another option if it makes publication simpler. Whether a separate repository or publication adds credibility is an open question. Keep the initial effort proportionate to the value of the writing.

## Repository boundary to carry forward

Separate the Oceanheart website presentation layer and the Studio application into distinct repositories. Richard identified this as a meaningful separation of concerns to pursue. The existing separate release lines do not complete that repository separation.

When this becomes an implementation task, decide the placement of the lab publication alongside that boundary. Preserve existing content, URLs and source history, and identify the build and deployment dependencies before moving code.

## Open decisions

- Publication name and URL, including whether to use a subdomain.
- Reuse of the Hugo foundation versus a minimal standalone static build.
- Where the writing source belongs after the website/Studio split.
- Whether the publication provides enough value and credibility to justify its upkeep.
- Scope and timing of the repository split.

This capture authorizes no publication launch, repository migration or deployment.
