# Studio landing page: second-pass review

Website PR35, `feat/website-studio`, targeting `main`. Website only; Captain visual
review remains required before merge or production release.

## Composition research

Genuine Mobbin MCP `search_sections` calls informed this pass:

- [Intercom](https://mobbin.com/sites/sections/f6f7639f-f09b-4937-9fd3-c7c2d652387e): a selector keeps a large product demonstration central. Studio uses accessible tabs for Today, Enquiries, Clients and Bookings, with readable context and direct demo links.
- [Hilos](https://mobbin.com/sites/sections/6d48fece-1cc7-4e76-a7df-956c43e6909d): sequential narrative and changing composition informed the offset introduction and numbered enquiry-to-follow-up story.
- [Descript](https://mobbin.com/sites/sections/e24b2a5a-b2f9-44c6-945d-5c06d32462d2): substantial interface views informed screenshot scale. No reference assets are copied.

Precision's actual style guide supplies the white surface, blue `#255bd7`, text
`#17212f` / `#354256` and selected surface `#edf2fe`. No all-caps eyebrows,
repeated feature-card grids, decorative shadows or low-contrast qualifications.
The narrative alternates broad product views, offset prose, sequential steps and
a semantic release-status description list.

## Source and capability boundary

- Public fictional demo: https://studio.oceanheart.ai/app?demo=1
- Application target: https://studio.oceanheart.ai/app
- Provider-verified production source: main `63aa51e8b829aab328cbecebb3ac2f8b6902957a`.
- Accepted staging source supplied by release owner and verified through provider metadata: `b1f9d9c9a8e8c57f03d3512956dde285318cef42`.
- Core clients, services, bookings, tasks, Today, enquiries and settings are implemented; core workflows were verified in staging. Production sign-in configuration and first-account acceptance remain pending. The public demo is available.
- Production Gmail OAuth remains pending. Payments, website publishing, live client portal and broader assistance are roadmap capabilities; demo balances, messages and suggestions are fictional/simulated.
- Real public-demo captures on 10 September 2026: desktop 1440 × 1000 and mobile 390 × 900. Responsive pictures preserve useful interface scale on phones. Four views use fictional Rick Hallett practice data, exported as compressed WebP.

## Verification and review

Rendered `/studio` at 1440, 390 and 320 CSS pixels: no horizontal overflow,
loaded images and no browser errors. All four product tabs and keyboard End/Home
selection checked; mobile navigation opens. Full-size screenshot links remain
available. Local evidence is untracked under
`_archive/delivery-evidence/website-studio-pass2-2026-09-10/`.

Local review: http://127.0.0.1:4173/studio . Preview deployment and Captain visual
acceptance are separate gates. No Studio app, backend, credentials or auth edits.
