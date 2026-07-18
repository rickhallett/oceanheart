<!-- FLUENCY_PROTOCOL_START sha256:bfa0059cbbbf449a -->
# Coding Fluency Rehab Protocol

Operational extract. Full sources:
- `/Users/mrkai/_ops/fluency/protocol.md`
- `/Users/mrkai/_ops/fluency/protocol-db.md`
- `/Users/mrkai/_ops/fluency/protocol-guard.md`
- `/Users/mrkai/_ops/fluency/protocol-calibration.md` (adopted 2026-07-05; wins on conflict)
- `/Users/mrkai/_ops/fluency/reference/canonical-folder-map.md` (adopted 2026-07-18)

## Core Rule (calibration amendment, 2026-07-05)
- Primary target is calibrated judgment, not generative fluency: prediction reps in BAU, historical bug drills, adversarial reading. Hand-typing drills are retired; probe-writing during drills stays manual.
- AI may execute. AI may not reveal before the call: the protected rep is the operator's prediction/diagnosis stated BEFORE a graded truth is revealed.
- Apply the mode first; tool/model routing comes after.

## Prediction Reps (BAU)
- Before revealing a substantive diff, test/run outcome, or root cause: elicit a one-line call, reveal, grade hit|partial|miss with one sentence, log silently.
- Cadence 3-6 graded calls per active day; one open checkpoint at a time; never checkpoint trivial changes or block urgent work.
- Operator controls: "rep:" requests one, "skip" declines without re-offers this session, "no reps" disables for the session.
- Vague calls grade as miss; push for a call that can be wrong.

## Canonical Folder Map
- This is a macOS machine rooted at `/Users/mrkai`; Fish is the interactive shell and mise owns language runtimes.
- Before editing or deploying, resolve the real checkout, Git root, branch, registered worktree, dirty state, and actual runtime or deployment path. Never infer them from a folder, service, or environment name.
- The only normal project entrances are the seven direct children of `~/work`: `cockpit`, `cue`, `jobpipe`, `loanslam`, `normal`, `oceanheart`, and `sarahs-studio`.
- Agent and machine operations live under `~/_ops`; private state under `~/vault`; durable evidence under `~/reference`; inactive material under `~/archive`. These are not alternative project entrances.
- Worktrees must be Git-registered and remain subordinate to their repository. Branch-backed worktrees may be maintained centrally; detached worktrees are opt-in mutation targets.
- Repository-local ownership is the default. Cockpit indexes and composes the system; it is not a miscellaneous shared-library home. Do not create cross-project code without an explicit owner and repeated need.
- Closest repository `AGENTS.md` or `CLAUDE.md`, README, runbook, and deploy documentation govern project specifics. Never hand-edit managed Fluency Protocol blocks; edit `~/_ops/fluency` and render them.
- Preserve existing work, stage narrowly, commit only intended files to the active branch, and never push or mutate remote infrastructure without explicit authority.
- Runtime, browser, and API evidence outrank static tests for live-behaviour claims. Environment names do not prove branch or deployment lineage.
- Keep `~/vault`, `/Users/mrkai/rehab.db`, credentials, ignored databases, and private evidence local. Never publish or broadly sync them.
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
