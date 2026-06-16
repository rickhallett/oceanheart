# Oceanheart.ai — Rebuild, CV & Portfolio Brief

Last updated: 2026-06-16. Single source of truth for the site rebuild, the canonical
CV, the portfolio narrative, and the live job search. Read this first to resume work
after a context refresh.

---

## 1. Identity & contact

- Public name: **Rick**. Use "Rick" everywhere. The formal full name "Richard (Kai)
  Hallett" is fine on the CV header.
- Email: **rick@oceanheart.ai** is the intended canonical address — **alias not yet
  created**. Until it is live, **kai@oceanheart.ai** is the working address. Keep
  `kai@` on anything sent before the alias exists (the Upperdog application uses it).
- GitHub: github.com/rickhallett · Site: oceanheart.ai.
- Location: **unresolved** — the CV header says "Poole/Bournemouth", the cover letter
  says "based in Swanage". Pick one before sending more applications.

---

## 2. Canonical CV source

- Lives at **`cv/richard-hallett.md`** (this repo). Cloned from the Upperdog-tailored
  version, with "upperdog" dropped from the filename. It is the canonical content and
  structure; website and PDF are built from it.
- Cover letter: **`cv/intro-email.md`** — currently Upperdog-specific (the actual
  application letter); serves as the base/template for future applications.
- Kept as **pure-content CommonMark, no front matter**, so it is tool-agnostic:
  `cv_render.py`'s simple parser and Hugo ingestion both consume it cleanly. Keep it
  that way — front matter would break the PDF parser; inject any front matter at build.

### Build wiring still to do (the "build-friendly" requirement)
- **Website CV page:** currently `layouts/_default/cv.html` is **hardcoded** (no
  `.Content`). Plan: render the CV page from `cv/richard-hallett.md` — either make
  `content/cv.md` carry/import the canonical body and have the cv layout render
  `.Content`, or add a build step that copies `cv/richard-hallett.md` into
  `content/cv.md` with front matter. Reuse the existing cv.css styling.
- **PDF:** `jobctl/cv_render.py` (forge repo) renders markdown → HTML → PDF via
  Playwright/Chromium. Point it at `cv/richard-hallett.md`.
- The jobctl tool still has its own `richard-hallett-master.md` + tone variants; decide
  later whether jobctl should reference this canonical instead.

---

## 3. Flagship repositioning — Loans by MAL (IMPORTANT)

- **Not secret.** "Loans by MAL" can be named openly. CV and cover letter already do.
- **The flagship is NOT the 30-day MVP** built under contract. The portfolio flagship is
  **Phase 2 of the ideal roadmap** — Rick's own vision of what the bot should be, built
  after the contract on his own initiative. **It is now Rick's IP, independent of Loans
  by MAL.** The mock demo page has been **scrubbed of IP-sensitive content**.
- Status: **prototypal, not customer-ready.** Do not imply it is deployed/productised.
- **"Why only a 30-day contract?" — the honest answer (no spin):** the MVP was delivered
  within the timeframe; management decided the project wasn't a fit for their
  requirements. What Rick built afterwards is his own vision of what such a bot should
  be — still prototypal, not customer-ready.
- The existing public flagship page (`content/projects/fail-closed-llm-engine.md`) was
  written **anonymized** ("a regulated UK lender", neutral title, no repo). Now that MAL
  is nameable and the framing is "my own Phase-2 vision / my IP", that page should be
  revised (name MAL optionally, reframe as the vision piece, keep "prototypal"). See
  open decisions.

---

## 4. Portfolio & project status

Two tracks, mirroring the CV.

**Client builds (delivery proof — solo, agentic-tooling-accelerated):**
- **Becoming Diamond** — paid client: marketing site + gated member portal, AI chat,
  Stripe, Decap (git) CMS. **Online soon.** Next.js / React 19 / TS / Stripe.
- **STA / Swanage Traffic** — paid client: community campaign + registration platform.
  **Live now: swanagetraffic.org.uk.** Astro / React / Vercel.
- **Loans by MAL engine (the flagship, Phase-2 vision)** — **will soon have a live URL**
  showing: (a) the **chatbot** on a scrubbed mock loans page; (b) a **dev console** that
  shows, in real time, what the decision engine is doing as the bot is used (TurnPlan →
  deterministic validator → grounding/serving-mode → per-turn audit trace); (c) **"hell
  week" report pages** showing how Rick uses data to continually improve it.

**AI engineering (the differentiator — public on GitHub):**
- **Sortie** — AI-assisted code review; 3 LLMs in parallel + 4th synthesiser, merge
  gated on convergent severity. Provider-agnostic. (TS, Bun.)
- **Halo** — agent/tool-layer infrastructure; CLI modules, isolated stores, NATS event
  sourcing. (Python, K8s.)
- **The Pit** — evaluation platform; observable traces, rubric scoring, failure tagging,
  per-run microdollar cost ledger. (Next.js, TS, Postgres.)
- **Arcana** (multi-agent data pipeline, LLM-as-judge) and **Jeany** (content-to-
  intelligence pipeline) as supporting one-liners.

**Slop / Tells / Sloptics** — all **conceptual, lab-notes style.** Frame as field notes
and QA thinking, never as product.

---

## 5. Oceanheart site rebuild plan (consolidated exec summary)

**Strategy:** the site sells a researcher-with-a-meme; reposition it as a founder-builder
who ships production software fast (incl. paid client sites solo with agentic tooling)
and builds the fail-closed, audited AI infrastructure behind it. Mostly elevation and
reduction, not a ground-up redesign.

- **Positioning / hero:** lead with the capability claim ("I build fail-closed,
  fully-audited LLM systems for regulated domains") + the two-track story. Recommended
  hero headline leads with *method*, not the domain.
- **Visual:** keep Tokyo Night + JetBrains Mono. Fix the flat 0.85rem hierarchy: add one
  display font + a real type scale, and a mono metrics band under the hero. Reuse the
  dense-row table pattern as the Work index spine. Defer motion/console-chrome/imagery
  until there is a console to show. Clean the inline-style / `.tagline` debt.
- **Nav (5):** Work · Writing · About · CV · GitHub. (observatory/sloptics → footer.)
- **Homepage order:** hero (value line + metrics band + View work / Download CV) →
  Selected work → How I work (harness statement + mono badges) → 3 hand-picked case
  studies → contact. Delete the auto "Recent 5" and the draft-fed Research block.
- **Work model:** two tracks (Client builds + AI engineering), flagship-led, 3-tier
  (flagship / notable / archive) in front matter, with live / repo / case-study chips.
- **Content disposition:** publish the 4 drafted pipeline case studies; consolidate slop
  essays + tells + research into one bounded "Lab / Field notes" property framed as QA
  evidence (link sloptics.dev live); move the 324 `sd-XXX` decision stubs and 66 `tells`
  stubs out of `content/` (render decisions from `data/decisions.json` if shown at all);
  fix the `research/_index` `draft=true` bug and add a build guard; cut/spin out the
  54-file bootcamp.
- **Flagship + demo:** flagship project page written (needs the MAL/Phase-2 reframe).
  Demo plan: ship an honest captured-evidence gallery first (real lab-session traces
  stamped with commit + date), then a bounded live console + the "hell week" report
  pages. Never fake live. Plus a one-page "receipts" index linking every quantified
  claim to its git log / test / decision.
- **Roadmap by shippability:**
  - **P0 (no product code, ~one sitting):** hero + type scale + metrics band; nav trim;
    work-first homepage; publish drafts; move stubs out + fix research draft bug;
    sloptics live card; receipts page; client-builds cluster.
  - **P1 (gated):** CV build wiring (site + PDF from canonical); flagship evidence
    gallery → live console + hell-week pages; Lab consolidation; visual polish.
  - **P2:** bootcamp spin-out, WCAG contrast pass, favicon/OG image, CI build guard.

---

## 6. Infrastructure / deploy

- This repo is Vercel-linked to project **`oceanheart`** (team
  `team_OnRhYT9YIEipDIeZwJEjbXD2`); serves `oceanheart.ai`, `www.oceanheart.ai`,
  `oceanheart.vercel.app`. `vercel --prod` from here ships the live site. (`.vercel/` is
  gitignored / local-only.) Framework is unset in `.vercel/project.json` — Hugo build
  settings live in the Vercel dashboard; verify before relying on a CLI deploy.
- Vercel CLI is **not installed** (`npm i -g vercel` to enable `vercel env pull` /
  `deploy` / `logs`).

---

## 7. GitHub state

- Tidied: **12 public keepers** (arcana, becoming-diamond-nextjs, halo, nstcg-org,
  oceanheart, pidgeon, pidgeon-swarm, sortie, sortie-pi, soundsright, stain, thepit);
  **polecat + wasp** archived-but-visible; forks pruned to **leash + todomvc**;
  **thera + noclaude** archived; ~143 other archived repos made **private**.
- **Pending: re-pin** to thepit, sortie, halo, pidgeon, stain, arcana — do this *after*
  the flagship page is live so pins point at a Work section that contains it.

---

## 8. Done vs pending

**Done:**
- Flagship project page written (`content/projects/fail-closed-llm-engine.md`) — needs
  the MAL/Phase-2 reframe.
- `content/projects/sortie.md` Pit URL fixed to canonical `thepit`.
- GitHub tidy (above).
- Canonical CV cloned to `cv/richard-hallett.md`; cover letter to `cv/intro-email.md`.
- Demo-widget focus bug fixed in the `data-driven-retrieval` worktree (input no longer
  disabled while thinking; `@mousedown.prevent` on Send; focus backstop on turn end).

**Pending:**
- P0 site front-door (hero, type scale, nav, work-first homepage).
- CV build wiring (website CV page + PDF from `cv/richard-hallett.md`).
- Create `rick@oceanheart.ai` alias, then switch canonical contact from kai@ to rick@.
- Re-pin GitHub.
- Flagship reframe + dev-console gallery + hell-week pages + the loanslam live URL.
- Reconcile the Poole/Bournemouth vs Swanage location line.

---

## 9. Open decisions (these gate the next steps)

1. **Flagship page reframe.** Now that MAL is nameable and the piece is "my Phase-2
   vision / my IP, prototypal": name MAL on the site page and retitle, or keep the
   neutral title? (Changes `fail-closed-llm-engine.md`.)
2. **rick@ alias.** Create it, then flip canonical CV + site contact to rick@.
3. **Location** — Poole/Bournemouth vs Swanage; one canonical answer.
4. **CV build approach** — Hugo `.Content` from `content/cv.md`, or a build step copying
   `cv/richard-hallett.md` in.
5. **Hero headline** — method-led recommended.
6. **Slop brand** — keep any public-facing, or fully demote to the Lab as conceptual
   field notes.
