# Oceanheart repository instructions

## Blog creation and revision

- Apply these rules to every Hugo article under `content/blog/`, including unpublished drafts.
- Preserve the article's intended `draft` state and the hidden blog-archive behaviour in `content/blog/_index.md`.
- Before drafting or revising prose, read `/Users/mrkai/.codex/skills/create-oceanheart-blog/references/editorial-rubric.md`.
- Run a voice-distance pass for contrast-frame saturation: repeated logical inversions, `not X, but Y` reveals, punchy sentence pairs, disclaimer tails, and other editorial devices whose density makes the copy feel model-generated.
- Treat density as the signal. Preserve an individual contrast or short sentence when it earns its place.
- After any change to article prose, refresh the private copy telemetry:

  ```sh
  python3 /Users/mrkai/.codex/skills/create-oceanheart-blog/scripts/check_copy_metrics.py \
    --content-dir content/blog \
    --write
  ```

- Before handing back any blog creation or copy-editing task, run the same command without `--write` and require it to pass.
- Every article must carry the complete version-2 top-level TOML panel owned by the checker: words, sentences, prose paragraphs, standalone `not` and its ratio, broad negation, contrast frames, short closures, single-sentence paragraphs, first-person singular terms, contractions, editorial signposts, and repeated five-word phrases. The fields are machine-readable editorial metadata and must not be rendered into the article.
- The standalone `not` ratio remains the case-insensitive count divided by the body-copy word count. The other counts describe voice and rhythm. They are diagnostic signals, not quality scores or targets.
- Use `--report --format json` for structured corpus data, `--explain --file <path>` for line-level editorial candidates, and `--baseline <git-ref>` for a before-and-after comparison.
- The deterministic hard gates reject Unicode em dash characters, broken footnote references or definitions, and missing absolute local Markdown images. Placeholder markers are reported as warnings.
- Do not add metrics to Hugo section files such as `content/blog/_index.md`.

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
