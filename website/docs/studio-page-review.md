# Studio landing page: review brief

Website PR35, `feat/website-studio`. This page tells the product story through
practitioner workflows, the current release boundary and four real Precision
screenshots. It is a website change only.

## Source and capability boundary

- Demo: https://studio.oceanheart.ai/app?demo=1
- Signed-in app: https://studio.oceanheart.ai/app
- Release baseline supplied for this work: main `63aa51e8b829aab328cbecebb3ac2f8b6902957a`, staging `b1f9d9c9a8e8c57f03d3512956dde285318cef42`.
- Current application scope: clients, services, bookings, tasks, Today,
  enquiries and settings. Production Gmail OAuth is pending.
- Demo screenshot capture: 10 September 2026, 1440 × 1000 viewport.
  Today, enquiries, clients and bookings use the fictional Rick Hallett practice.
  Images are lossily compressed WebP exports of actual browser captures.
- Demo balances, messages and assistant actions are fictional/simulated.
  Payment processing, website publishing, live portal and broader assistance
  remain roadmap work. No customer, traction, outcome or revenue claims are made.

## Visual review

Local `/studio` rendered at 1440, 390 and 320 CSS pixels. Images load, no horizontal
overflow or browser errors, mobile navigation opens. Full-size screenshot links
let visitors inspect the interface on narrow displays. Homepage Studio section
also checked at desktop and mobile widths.

Local evidence directory (not committed):
`_archive/delivery-evidence/website-studio-enhancement-2026-09-10/`.

Website build and TypeScript checks pass. Root packaging requires Hugo 0.159.1,
which is absent locally; its share-route/retirement checks pass. Hosted CI is the
remaining packaging check. Preview availability is separate from visual approval.

Captain visual review and iteration are required before merge or production
release. No Studio application, backend, authentication or credential changes.
