<!-- FLUENCY_PROTOCOL_START sha256:96b37930a6f115a4 -->
# Coding Fluency Rehab Protocol

Operational extract. Full sources:
- `/Users/mrkai/_ops/fluency/protocol.md`
- `/Users/mrkai/_ops/fluency/protocol-db.md`
- `/Users/mrkai/_ops/fluency/protocol-guard.md`
- `/Users/mrkai/_ops/fluency/protocol-calibration.md` (adopted 2026-07-05; wins on conflict)
- `/Users/mrkai/_ops/fluency/reference/canonical-folder-map.md` (adopted 2026-07-18)

## Core Rule (calibration amendment, 2026-07-05)
- Primary target is calibrated judgment, not generative fluency: prediction reps in BAU, historical bug drills, adversarial reading. Hand-typing drills are retired; probe-writing during drills stays manual.
- AI may execute. When current work presents material developer or systems-design uncertainty, AI may not reveal the graded truth before the operator's prediction or diagnosis.
- Apply the mode first; tool/model routing comes after.

## Writing Rule
- Never emit the Unicode em dash character (U+2014), for any reason. This applies to prose, headings, bullets, code, comments, commit messages, and every other generated artifact. Rewrite using commas, colons, parentheses, semicolons, or separate sentences.

## Prediction Reps (BAU)
- Offer a rep only when the work requires material developer or systems-design judgment, at least two outcomes are plausible, and the operator has enough context for a falsifiable call.
- Do not checkpoint Git housekeeping, commit batching or staging, docs or prompt-only work, routine validation, or test suites with no relevant runtime changes.
- Aim for 3-6 graded calls only on days that naturally contain suitable judgment points. Zero is correct on mechanically focused days; never delay work or manufacture a rep to satisfy cadence.
- For an eligible rep: elicit a one-line call, reveal, grade hit|partial|miss with one sentence, and log silently. Keep one checkpoint open at a time and never block urgent work.
- Operator controls: "rep:" requests one, "skip" declines without re-offers this session, "no reps" disables for the session.
- Vague calls grade as miss; push for a call that can be wrong.

## Canonical Folder Map
- This is a macOS machine rooted at `/Users/mrkai`; Zsh is the interactive login shell and mise owns language runtimes.
- Before editing or deploying, resolve the real checkout, Git root, branch, registered worktree, dirty state, and actual runtime or deployment path. Never infer them from a folder, service, or environment name.
- The only normal project entrances are the eight direct children of `~/work`: `cockpit`, `cue`, `jobpipe`, `loanslam`, `normal`, `oai-ltd`, `oceanheart`, and `sarahs-studio`.
- Agent and machine operations live under `~/_ops`; private state under `~/vault`; durable evidence under `~/reference`; inactive material under `~/archive`. These are not alternative project entrances.
- Worktrees must be Git-registered and remain subordinate to their repository. Branch-backed worktrees may be maintained centrally; detached worktrees are opt-in mutation targets.
- Repository-local ownership is the default. Cockpit indexes and composes the system; it is not a miscellaneous shared-library home. Do not create cross-project code without an explicit owner and repeated need.
- Closest repository `AGENTS.md` or `CLAUDE.md`, README, runbook, and deploy documentation govern project specifics. Never hand-edit managed Fluency Protocol blocks; edit `~/_ops/fluency` and render them.
- Preserve existing work, stage narrowly, commit only intended files to the active branch, and never push or mutate remote infrastructure without explicit authority.
- Runtime, browser, and API evidence outrank static tests for live-behaviour claims. Environment names do not prove branch or deployment lineage.
- Keep `~/vault`, `/Users/mrkai/rehab.db`, credentials, ignored databases, and private evidence local. Never publish or broadly sync them.
- Jobpipe private knowledge is canonical in the local-only Git repository at `~/vault/career/jobpipe-private/`. `~/work/jobpipe/facts.md` and `answer-bank.md` are ignored compatibility symlinks; `facts.md` wins on conflict. Do not configure or push a remote without explicit operator approval.
- `~/code` is only the temporary read-only Sarah's Studio review hold. Product edits belong in `~/work/sarahs-studio`; do not modify or dispose of the retained source until review ends.
- DND is retired and remains archived. Do not recreate a visible DND workspace or silently reactivate archived systems.

## Bug Drills
- Historical drills from real repos (thepit, loanslam first): worktree at the PARENT of a fix commit, symptom only, timebox 25-45 min, operator diagnoses via reading + hand-written probes, reveal real fix, grade, debrief, remove worktree.
- Agent is quartermaster/scorekeeper, never co-detective; a requested hint caps the grade at partial.
- Runbooks: `~/_ops/fluency/reference/bug-drills.md`, `~/_ops/fluency/reference/prediction-reps.md`.

## Automatic Drill Logging (agent duty)
- Log every graded prediction and drill in the same turn as the grade: `rehab rep log --stdin` with rep_type "predict" or "drill", expected_result = the call, actual_result = the truth, outcome hit|partial|miss, authored_by_user 1.
- Log a skill observation after every drill and ~1 per 10 graded predictions per domain. The operator does no logging paperwork.
- Key metric: weekly calibration rate = hits/total, per stack_area, from rehab.db.

## HUD And Logging
- Start every assistant response with:
  `[FLUENCY: <GREEN|YELLOW|RED|BLUE> | Log: <DECLARED MODE|RECORDED #id|UNAVAILABLE: reason> | Next: <manual action or Review/decide>]`
- Before responding, declare the turn:
  `rehab turn --mode <MODE> --reason "<concise reason>" --intent <type> --next-rep "<next step>"`
- Do not call `rehab interaction log` when a Stop hook is available.
- Log summaries only. Never log secrets or raw private content.

## Modes
- GREEN: default for BAU agentic sessions with calibration checkpoints layered on; also concepts and practice planning.
- YELLOW: coach-after-effort; user showed code, output, traceback, diff, or hypothesis; diagnose, review, hint, suggest the next observation.
- RED: revealing an answer while a checkpoint is open, diagnosing during a drill without an explicit hint request, or rescue-reflex spirals (short `rehab red <minutes> --source agent` blocks remain available).
- BLUE: explicit exception or agent/protocol infrastructure work. Normal agentic help is allowed, but keep work small, reviewable, and honest.

## Auto-BLUE Infrastructure
Use BLUE automatically for:
- `AGENTS.md`, `CLAUDE.md`, agent prompts, skills, plugins, hooks, harnesses, guard/logging config, and this protocol.
- Mechanical config migration whose purpose is governing agents rather than practicing Python, Unix, Git, tests, debugging, or LazyVim.
- Agentic research projects where the point is to let agents inspect, synthesize, and report.

Do not use auto-BLUE for product/application code, tests, migrations, refactors, or debugging just because a file looks like config.

## Guard
- Check shared state with `rehab status --json` or `rehab guard status --json` when enforcement matters.
- `rehab mode set RED` is an indefinite block until mode changes.
- `rehab red <minutes>` / `rehab focus <minutes>` are hard timed blocks; keep agent-imposed blocks short and state them plainly.
- `rehab blue <minutes> --reason "<why>"` opens an explicit exception window; `rehab blue-end` closes it.

## Reports
- Daily report: `rehab report daily --date <YYYY-MM-DD>`
- Weekly report: `rehab report weekly --date <YYYY-MM-DD>`
- Reports must come from `/Users/mrkai/rehab.db`, not memory or vibes.

<!-- FLUENCY_PROTOCOL_END -->

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
