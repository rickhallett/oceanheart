# Current design authority

The canonical guide for future editions is [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md), updated after user review on 9 September 2026. The original proposal and verification notes below are historical; their grey canvas, borders and larger mobile controls have been superseded.

# Precision

A compact, light operations workspace. This direction treats the product as daily professional software: neutral surfaces, disciplined spacing, restrained blue actions, and clear hierarchy.

## System

- White navigation and work surfaces on a soft grey canvas. Ink text and cool secondary text; saturated blue reserved for actions, selection and focus.
- 224px sidebar, 34px desktop navigation rows, 56px toolbar and a consistent 36px content inset. Mobile controls retain at least44px touch targets where actions are presented as buttons; native fields use16px type to avoid mobile zoom.
- 28px page titles,16px panel headings,13px table content and12px metadata. Body weight400, labels500, emphasis600.
- 1px borders,5–8px radii, no panel shadows or gradients. Tables fill their containers instead of sitting inside padded duplicate frames. Statuses use small rectangular tints.
- Appointment schedules are divider rows. The assistant is a reading canvas, with a restrained outgoing message and a bordered composer. Settings use tighter form spacing.
- Today headings now read Schedule, Tasks, Latest enquiry and Support. The old demo-tour footer is removed.

## Implementation

`src/theme.ts` defines palette, recipes, typography and global light mode. `src/components/workspace/precision.css` implements the alternative shell and domain composition. Legacy literal text colours and gradients in workspace.css were replaced to prevent low contrast under the light palette. StudioProvider selects this theme only for /app. Public marketing and the separate /practice area retain their original theme through theme-public.ts.

This is an isolated copy of the user's current source, including uncommitted work. Original project remains untouched. Dependencies are symlinked; no shared dependency type generation was run.

## Verification

Production build (`npx next build --webpack`) passed. Existing complete54-case Playwright run:52 passed,2 failed. Both failures are the same legacy exact appearance assertion: dialog button radius expected10px, received6px. The new radius is intentional. Tests were not weakened. Functional coverage includes dialogs and focus recovery, navigation and search, responsive routes, state recovery, source snapshots, safe approval application and notifications.

Inspected1440px desktop and390px mobile screenshots of Today, Clients, Knowledge, populated Assistant, Add client dialog, Settings and Shop. Inspected desktop Bookings, Enquiries and Portal. Route capture covered all17 app routes. Additional320px audit verifies no horizontal page overflow on every app route and adds a client through the form.

The initial screenshot audit caught low-contrast legacy peach/grey text and boxed appointment rows. These were corrected and screenshots recaptured. Screenshots under `evidence/` are the final review set (Today, Clients, Assistant and Add client at1440/390). `evidence/audit-320.json` records the narrow-viewport check.

## Run

Preview: http://127.0.0.1:4331/app

`STUDIO_PREVIEW=1 npx next dev --webpack --hostname 127.0.0.1 --port 4331`. Preview output is isolated in `.next-preview`; production build remains `.next`.

The product remains a functional local prototype. Backend/account integrations are unchanged. This is a design alternative for comparison, not a production deployment.

## Typography refinement — Stripe reference

Inspected the user's live Stripe Home and Product catalogue screens on 9 September 2026. Computed examples: page title28px/36px700; navigation14px400 (selected600); tabs14px/20px with selected600. Precision retains its existing structure and28px heading. Navigation and everyday actions/record text are14px, secondary metadata13px, table/navigation captions and status labels12px. Mobile inputs retain16px. No navigation, workflow or layout structure changes.

Verified24 route/viewport combinations across1440/390/320 and Add client dialog opening/dismissal. Screenshots and audit in evidence/typography.

Dialog sizing is now content-specific:400px confirmation,480px forms,560px reading/session/support detail,640px source editors/client history, each capped to the viewport. Typecheck passed; verified form sizing at1440/390/320 and source editor opening. Roadmap native-select wrapper and field now share144px width; the formerly detached arrow stays inside and option text is visible. Priority summary wraps into two columns on small screens. Priority changes persist after reload, and filter buttons expose pressed state. Evidence in evidence/dialogs.
