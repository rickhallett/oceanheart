# Oceanheart repository instructions

## Learning in public

Oceanheart treats public learning as part of product work. The current inquiry
is AI instruments for relational practice, with verification as the discipline
underneath it.

- At the end of significant research, design, or implementation work, check for
  a public-learning candidate. Trigger the check earlier, at the next safe
  boundary, when a finding changes the roadmap, overturns an important
  assumption, exposes a reusable failure mode, or gives practitioners or
  builders evidence they could use. Routine implementation does not trigger it.
- For a candidate, prepare a private brief addressed directly to Kai in plain
  internal working language. Include source pointers, what happened, what
  changed, what remains uncertain, and why it may matter outside the project.
  Preserve the rough terms that carry the insight. Do not write a headline,
  hook, polished narrative, article draft, or social copy. Editorial shaping
  begins only after Kai chooses to develop the candidate.
- Give the private brief to one fresh-context agent without supplying
  a preferred story. Ask it to report to Kai on the honest central claim,
  likely audience, suitable Oceanheart form, missing evidence, privacy or IP
  risks, and what can be cut. Add an independent evidence or privacy reviewer
  when a consequential clinical, safety, privacy, or efficacy claim is
  involved.
- The review must recommend developing, holding, or keeping the candidate
  private, with a direct reason. A failed experiment or change of mind is a
  valid candidate. Do not force weak evidence into outreach.
- Bind factual claims to the exact source, test, commit, or artifact. Separate
  observation, reported experience, inference, hypothesis, and decision. Label
  synthetic and prototype results plainly. They are not evidence of clinical
  benefit, safety, efficacy, or readiness for live use.
- Give publication reviewers only public sources, synthetic material, or a
  separately approved and minimized evidence packet. Keep identifiable or
  reconstructable client material, health data, private practitioner
  reflections, participant data, private conversations, credentials, and
  unpublished third-party material out of their context and out of Git.
  `draft = true` is not a privacy control in a public repository.
- This checkpoint authorizes only a private, uncommitted review brief. It does
  not authorize publication, outreach, changes to article draft state, commits,
  merges, pushes, or deployment. Each external effect requires Kai's explicit
  instruction and the existing Oceanheart editorial and release checks.

## Lab execution

This public repository owns Oceanheart's site source, research that is safe for
public Git, and approved publication artifacts. Executable prototypes,
synthetic fixtures, evaluation outputs, and private study material belong in
the future private lab repository. Do not add executable prototypes here.
Until that repository exists, use these rules for architecture decisions here.

- One lab, separate benches, no heavy plumbing. Each instrument owns its app
  folder, dependencies, run command, tests, and output area. Shared code and
  orchestration must earn their place through repeated need. At first, share
  only versioned synthetic fixtures and a small data contract.
- Use registered local worktrees as the default change isolation. Create one
  worktree per concurrent feature or experiment, not per app. Keep one writer
  per worktree, let reviewers inspect read-only, and integrate through one clean
  review path.
- Worktrees isolate Git files, not running resources. Give concurrent runs
  distinct ports, temporary directories, data stores, service names, and test
  namespaces in already-authorized test accounts.
- Treat cloud environments as overflow, not the default. Use them for
  independent, headless, synthetic workloads that reproduce from an approved
  exact reviewed commit and setup script, and are long or heavy enough to
  justify remote execution. This does not decide cloud versus local model
  inference; benchmark both on the actual retrieval, latency, abstention, and
  provenance tasks.
- Remote runs are synthetic-only. Local execution is not a safety or authority
  boundary. Client-data processing, recording, private clinical work, and
  live-care trials remain behind their separate approval and governance gates.
- Before adopting cloud as a standing route, compare setup time, completion
  time, review and integration effort, failures, cost, and measured local
  resource pressure on representative tasks.

## Blog creation and revision

- Preserve the article's intended `draft` state and the hidden blog-archive behaviour in `content/blog/_index.md`.
- Before drafting or revising prose, read `/Users/mrkai/.codex/skills/create-oceanheart-blog/references/editorial-rubric.md`.
- Run a voice-distance pass for contrast-frame saturation: repeated logical inversions, `not X, but Y` reveals, punchy sentence pairs, disclaimer tails, and other editorial devices whose density makes the copy feel model-generated.
- Treat density as the signal. Preserve an individual contrast or short sentence when it earns its place.
- Before handing back an article change, run the checker in read-only diagnostic mode:

  ```sh
  python3 /Users/mrkai/.codex/skills/create-oceanheart-blog/scripts/check_copy_metrics.py \
    --content-dir content/blog \
    --explain
  ```

- Require a zero exit status. The deterministic hard gates reject Unicode em dash characters, broken footnote references or definitions, and missing absolute local Markdown images.

## Share-friendly blog routes

- Keep each article's dated Hugo URL as its canonical SEO URL.
- Every article with `draft = false` and `[build] render = "always"` must define
  at least one short, stable, site-relative root alias in top-level TOML
  frontmatter, for example `aliases = ["/ai/"]`.
- Use Hugo `aliases` as the source of truth. Do not hand-edit generated
  `/blog/` entries in `vercel.json`.
- After changing article aliases, run:

  ```sh
  node scripts/sync-share-routes.mjs --write
  node scripts/sync-share-routes.mjs --check
  ```

- `build.sh` must keep the `--check` gate so stale, duplicate, malformed,
  missing, or root-colliding aliases fail before deployment.
- Choose human-readable aliases that remain permanently tied to one article.
  Never repoint an existing permanent share route to a newer article.
- Preserve both generated Vercel source forms, with and without a trailing
  slash, until production evidence proves Vercel normalizes them identically.
- Verify short routes as `308`, their `Location` headers as the dated canonical
  paths, followed responses as `200`, and canonical plus Open Graph metadata on
  the destination.
- Read the root `README.md` before changing, publishing, or diagnosing share
  routes.

## Fluency block removal (transition note, 2026-07-25)

The machine-context protocol block was removed from this repository's
instruction files on main. Local feature branches cut before 2026-07-25 may
still carry it. When merging into main, resolve AGENTS.md in favor of main
and do not reintroduce the block. Remove this note once every branch is clean.
