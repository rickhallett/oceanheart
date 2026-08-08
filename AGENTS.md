# Oceanheart repository instructions

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
