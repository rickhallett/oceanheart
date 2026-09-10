# Studio possibilities: local page variant

Created 2026-09-10. Owner: Codex, task `01a08ac5-a57b-71e1-9cee-ee98519a2e9f`.

## Brief and editorial direction

Create a separate variant of the Studio marketing page with detailed examples of human need, adaptable software, and practical workflows around Studio. Keep the approved page's readable white/blue design. Use the original approved Oceanheart campaign artwork. Prioritise copy over a visual redesign.

The page explains three connected parts: the maintained Studio product, direct work with Rick/Oceanheart, and improvements to the practitioner's whole working environment. Competitive differentiation is secondary to helping people participate, sustain a practice, express an idea, protect their attention and shape the tools they use.

Six interactive journeys cover enquiries, rescheduling, groups, accessible resources, capacity and leave. Five tool groups show possibilities around Google Workspace, Microsoft 365, meetings, payments, resources and community communications. Seven expandable ideas develop the wider vision. Each journey connects a recognisable difficulty, a potential intervention and a human outcome.

Current product screenshots and the public fictional demo are separate from proposed integrations and adaptations. The examples are illustrations, not functioning client operations. Contact links open an email draft; the page makes no submissions. This local variant has `noindex, nofollow` metadata.

## Authority and location

- Host: Mac (`Richards-Air.home`). Repository: `/Users/oai/work/oceanheart/studio-possibilities`.
- Branch: `feat/studio-possibilities`; intended integration target: website `main`.
- Baseline: `0c07191d1fe0fcc3cd5142c3c16c0665c76be332`, fetched from `origin/main` on 2026-09-10.
- User-specified source: `http://127.0.0.1:4173/studio`, served by the `website-studio` checkout at `b41fe327eda6f2ae16bc81f31741e9a426019133`.
- The website subtree has no diff between that local source and the fetched baseline.
- Production alias inspection returned Vercel deployment `dpl_FrEiDriYwvQ1u1hmpkgqRpyaAKjG`, production, READY, `oceanheart-c3g50kc05-rick-halletts-projects.vercel.app`. The CLI inspect response did not include a source-SHA attestation; the workspace release record associates it with the baseline above.
- Existing source checkout contained untracked `_archive/` evidence. It was preserved. This work uses its own registered worktree and port.
- No push, PR, merge or deployment is part of this local preview task. Linear tooling was unavailable in this session; this receipt does not imply that a Linear issue was updated.

## Original assets

The user supplied 42 approved images in `/Users/oai/work/oceanheart/assets/studio-concepts/`. A thumbnail contact sheet was inspected. The initial version used these unchanged file copies:

| Source filename | Website asset | SHA-256 |
| --- | --- | --- |
| `IMG_9803.PNG` | `public/images/studio-possibilities/street-level.png` | `9469048b2ed5be92b1dded0bf77df415fa2ed952e1856407e05f3a785f41f2ad` |
| `C1CA2282-B600-4752-B217-C907581B63A3.png` | `public/images/studio-possibilities/tide-turning.png` | `fa9892d7e971052aa245fded07b9e802c9fffe6948673d5d5f416a761a554899` |

Both images are 1054 × 1492. The originals remain in the asset collection. The revised hero uses a faithful light-theme ImageGen edit of approved original `EB6FBE44-1F44-4456-9466-F5709EC55FCE.png`, saved as `public/images/studio-possibilities/enterprise-human-light.png`. The original is preserved. The tide poster remains unchanged. The portrait now reuses the about page asset `rick-portrait-looking-left-v2.png` with CSS edge fading.

## Run and review

From `website/`:

```sh
npm run dev -- --hostname 127.0.0.1 --port 4183
```

Open `http://127.0.0.1:4183/studio/possibilities`. The original `/studio` route remains intact in both this checkout and the original preview on port 4173. The server is intentionally retained for user review. `--hostname` is required; `--host` is not a supported vinext flag and can leave this server bound only to IPv6 localhost.

Dependencies currently use an ignored symlink to the installed `website-studio/website/node_modules`. For an independent fresh checkout, install from `website/package-lock.json` with `npm ci`. No private environment file was copied.

## Verification

- TypeScript `tsc --noEmit`: passed.
- `npm run build`: passed; static export includes `/studio/possibilities`, with 52 routes prerendered.
- HTTP 200 verified for the root and variant at the explicit IPv4 address.
- Real browser: all six journeys tested through steps 1–3 and reset; all five tool selectors tested; scenario keyboard navigation, an expandable idea and the product screenshot tabs checked.
- Layout inspected at desktop, 390px and 320px viewport overrides; no horizontal document overflow. Browser warning/error log empty during the checks.
- CodeRabbit reviewed the four new source files. Three minor findings were addressed: vertical tab ordering at tablet widths, consistent panel references, and ambiguous rescheduling copy. Follow-up checks target those changes.
- Original `/studio` page, CSS and product explorer have no diff from the baseline.
- No database impact: marketing route, explanatory local component state and static assets only. No identity, database, payment, inbox or booking API is called by the new interactions.

Future implementation or publication should verify the relevant integrations, account permissions and product claims at that time. The current preview demonstrates communication and interaction design only.

## Browser feedback revision — 2026-09-10

Applied the 19 annotated comments: stronger opening about agency; faithful light edition of the enterprise poster; no eyebrows; overlapping Studio/Oceanheart composition; compact SVG link arrows and no scenario arrows; removed explanatory caveats, connection footnote, portrait caption and variant footer; coloured Google and Microsoft marks; about-page portrait with fading. Preserved the Studio + Oceanheart name and the praised tide section copy and placement. Future edits should preserve the explicit no-eyebrows preference.

Mobbin MCP layout reference: [Ploy overlapping forms](https://mobbin.com/sites/sections/c3a0c0ec-ad38-47e0-81b6-4db0654fee47). Used as composition guidance, with original implementation.

This revision passed production build and TypeScript. Browser inspection covered desktop hero, connected foundation, coloured selectors and faded portrait, plus 390px and 320px layout checks. Zero `.p-kicker` elements remain. Microsoft selector state verified. The earlier full interaction coverage remains applicable; interaction logic was unchanged.

## Second visual revision

Replaced the foundation circles with ImageGen artwork using the page palette (#255BD7, #17212F, #F4F7FD, #EDF3FF, #ADC3EF and white), retaining equivalent accessible alt text. Removed the links and result tagline. Applied the requested hero, button, Google outcome, collaboration and closing copy verbatim. Increased portrait side fading and enlarged desktop hero art from a 420px to 490px maximum with a wider grid allocation. Build and TypeScript passed; generated graphic, larger poster and portrait inspected in the browser. Original artwork preserved.

## Six hero studies

Six ImageGen edits of the approved light poster isolate the palm, building and flame effects and explore text placement: image only, title above, caption below, text alongside, split title and opposite corners. Originals are preserved; no main-page hero selection changed. Comparison route: `/studio/possibilities/artwork`, marked noindex. All six assets verified loaded in the local browser; build passed. Files: `public/images/studio-possibilities/hero-study-1.png` through `hero-study-6.png`.
