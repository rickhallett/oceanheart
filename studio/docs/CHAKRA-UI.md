# Chakra UI foundation

Oceanheart Studio uses the free, open-source `@chakra-ui/react` package (lockfile version 3.37.0), Emotion and Lucide icons. No paid component catalogue, template subscription or Untitled UI dependency is required. The original migration covered the public homepage, all 17 workspace modules and the then-current `/practice` frontend. The component map below records the current implementation.

## Component map

| Surface | Chakra components | Purpose-built composition retained |
| --- | --- | --- |
| Public homepage | Container, Grid, SimpleGrid, Flex, Heading, Text, Card, Button, Link | Ocean illustration, brand mark, editorial sections and typography |
| Interactive homepage preview | Card, Button, Checkbox, Badge, Stack | Sample agenda, dates and fictional practice data |
| Workspace frame | Flex, Box, Breadcrumb, Button, Drawer, Dialog, Combobox | Module navigation, feature matching and browser persistence |
| Shared workspace primitives | Card, Badge, Field, Avatar, EmptyState, Dialog, Toast | Small compatibility helpers preserving workflow call sites |
| Today, calendar, clients, tasks | Stat, Card, Checkbox, SegmentGroup, Table, Button, Field, Input, NativeSelect | Agenda and booking layouts, client details and task transitions |
| Services, website, portal, payments, shop | Card, Table, SegmentGroup, Switch, Field, Input, NativeSelect, Textarea | Service/editor forms, shop and portal compositions |
| Assistant, knowledge, operations | Tabs, Table, Card, Field, Button | Conversation/evidence presentation, approval queue and audience filtering |
| Setup, settings, support, roadmap | Checkbox, Switch, Card, Field, Input, NativeSelect, Textarea | Setup choices, connection states and roadmap prioritisation |
| `/practice` frontend | Shared StudioProvider; scoped semantic HTML controls and CSS | WorkOS AuthKit sessions, Convex practice selection and persisted tasks |

The public and prototype workspace surfaces use Chakra components for buttons, inputs, selects, textareas, tables and modal dialogs. The authenticated task slice uses scoped native controls as recorded above. Semantic HTML remains appropriate for page landmarks, links inside `asChild`, forms and disclosure content. Domain behaviour is still application code: Chakra does not provide a booking engine, grounded assistant or payment service.

## Where to extend it

- `src/theme.ts`: shared semantic colours, typography and component recipes. Keep appearance decisions here when they apply to several screens.
- `src/components/studio-provider.tsx`: one client provider used by the server root layout.
- `src/components/studio-controls.tsx`: thin native-event adapters that preserve existing form handlers. Prefer direct Chakra composition for new interfaces.
- `src/components/workspace/context.tsx`: shared panels, fields, badges, modals and toasts.
- `src/components/workspace/shell-chakra.css` and `content-chakra.css`: domain layout and legacy integration rules. Existing `workspace.css` still supplies useful domain styling; this is not a CSS-free rewrite.
- `src/app/globals.css`: public site layout and brand treatment.

Use explicit component variants rather than inferring appearance from class names. Reuse `Card + Field + controls` for editors; `Table.ScrollArea + Table` for desktop records; `Dialog + Field + Button` for actions; `Tabs + Card` for multi-view workspaces; `Stat + SimpleGrid` for summaries. Clients, knowledge, payments and orders use mobile record cards that keep identity, status and actions visible together. The inactive desktop/mobile representation is hidden from the accessibility tree.

Buttons that submit forms must declare `type="submit"`. Preserve names, native validation, disabled states and event payloads when changing controls. `StudioSelect` forwards disabled state to both the root and native field because the enclosing Field context can otherwise override it.

Chakra preflight establishes the browser defaults its recipes expect; domain CSS explicitly supplies editorial spacing. Disabling preflight in this installed version emitted a malformed empty reset layer before the global base layer, dropping global styles in browser verification. Keep preflight enabled. Font variable classes live on `html` so root-level aliases and portalled dialogs can resolve them.

## Build and verification

```sh
npm ci
npm run theme:types
npm run dev
npm run build
npm run typecheck
STUDIO_TEST_PORT=4320 npm run test:e2e -- --workers=4
```

The build regenerates theme typings automatically. Regenerate after changing theme tokens during development. Both development and production builds explicitly use Webpack: the Turbopack trial produced Emotion hydration mismatches in browser verification. This follows the [Chakra Next.js integration guidance](https://chakra-ui.com/docs/get-started/frameworks/next-app).

The browser suite exercises existing workflows plus semantic tables, keyboard tabs, search navigation/dismissal and focus return. It visits 19 surfaces at 1440px, 1024px and 390px, checking configured viewport width, document width, browser errors and homepage typography. Desktop and phone captures are written under `test-results` for visual review. Compare widths in CSS pixels; phone screenshots include the device pixel ratio.

The secretless suite verifies `/practice`'s unavailable state. Historical migration boundary: authenticated Clerk/Convex journeys were not exercised during the original UI migration. Current WorkOS/Convex acceptance is recorded in [WORKOS-PRACTICE.md](WORKOS-PRACTICE.md). Prototype interactions remain local to the browser and retain their existing simulation and approval boundaries.

## Migration acceptance — 9 September 2026

Production Webpack build and TypeScript passed. All 48 Playwright tests passed across desktop and mobile Chromium, including 57 route/viewport checks with no browser errors or document overflow. Desktop and mobile screenshots were reviewed; this caught and resolved a narrow-screen hero grid expansion and missing global reset styles that interaction-only checks had missed. Regression assertions now cover those failures. Authenticated provider operations and deployment remain outside this local acceptance result.

## Design polish acceptance — 9 September 2026

Implemented priorities 1–8 from `DESIGN-INSPECTION-2026-09-09.md`, plus shared token consolidation, navigation grouping and a simpler phone marketing preview:

1. Support conversations grow with their title, with status on a separate phone row.
2. Solid copper marketing actions retain dark text across interaction states.
3. Captions are 12px; actions 14px; body text 15px; reading text and inputs 16px. Normal weight is 500 and action labels use 600. Appointment names retain their stronger size on phones.
4. Portalled forms share the button recipe and explicit Cancel/submit actions, with 44px minimum height and 10px control radius.
5. Mobile record cards preserve status and relevant actions; desktop records retain semantic tables.
6. Sample-workspace and feature-feedback explanations are expandable; page introductions take less space.
7. Today puts pending approval before agenda/tasks and summaries. Assistant prompts sit beside the composer; secondary content uses headings and dividers instead of repeated full cards.
8. Mobile Enquiries uses a full-width list followed by a dedicated conversation and Back to enquiries action.

`src/theme.ts` owns shared values and recipes; root-level `--app-*`, `--ws-*` and public aliases reference those tokens so portals resolve them too. `--app-caption` is explicitly 12px. Controls and primary panels use stronger 2px borders; quiet row separators retain 1px. Domain layout remains in CSS.

The final production build and all **52 Playwright tests passed**, including the 57 route/viewport observations and additional 320px checks of the homepage, Today, support, payments and Enquiries. At the narrowest width, summary statistics stack instead of squeezing their text. New assertions cover support containment, visible mobile record actions, CTA colour, modal control size/borders and mobile list/detail navigation. Keyboard focus tests include the new Cancel action. Final desktop/phone captures and four dialog forms were visually reviewed after entry animations. State captures are preserved in `/Users/oai/.codex/artifacts/studio-design-polish-2026-09-09`; route captures are in `test-results`.

Historical acceptance on `feat/studio-chakra`: this pass verified local UI only; it did not verify the then-current Clerk/Convex journeys or deployment. Current WorkOS task acceptance is recorded separately.

## Canvas feedback — 9 September 2026

The subsequent human review supersedes the earlier sample-notice and feature-feedback treatments: both repeated controls are removed, along with the header prototype badge and footer feedback action. Page descriptions now state their function directly. Avoid cosy filler such as “a little breathing room”; use lowercase `oceanheart` in branding, visible copy and metadata.

Today and Tasks share compact checkbox rows (no inter-row gap, 44px minimum height). The desktop enquiry list uses 32% of its container, with a 280px minimum; its filters use shorter, content-sized controls. Mobile list/detail navigation is retained. Calendar week buttons no longer include decorative dots. Removed the marked calendar/email explanatory footnotes and the enquiry escalation shortcut.

Feature search keeps its results inline inside the dialog and uses `disableLayer`: the dialog owns dismissal. Registering a second dismissable layer here assigned `pointer-events: none` to the results. The regression test now exercises both keyboard selection and ordinary pointer clicks after reopening search.

Status badges share opaque semantic backgrounds: green for returning/active/completed states, blue for new/open states, amber for pending/attention states, rose for failures/cancellations, and slate for neutral metadata. The text label remains visible in every case. Colours live in `theme.ts`; the shared Pill component resolves status semantics for desktop tables, mobile records and dialogs.

Portal review restores distinct bordered cards for sessions, payments and the associated client actions on a solid background. Shared native selects use zero vertical padding within their 44px height to centre text correctly. Knowledge now places Sync all beside Add source in the toolbar; the explanatory disclosure and rehearsal footnote are removed.

Assistant review uses a centred conversation canvas with unframed responses, compact outgoing messages, starter questions only before the first turn, and a dedicated Answer details dialog instead of a disclosure. Citation snapshots remain directly accessible. The citation regression also verifies opening the trace panel, Escape dismissal and focus return.

Knowledge separates source identity from its explicit View source action in both table and phone layouts. Its toolbar actions use a compact 36px height; desktop search inputs use 14px type, while phone inputs retain 16px.

Latest browser review: compact Shop product rows replace decorative product cards; Support uses a compact request list without the introductory slogan. Setup uses Practice details. Inputs use regular weight and Sample data text uses secondary sizing. Payments filters use flat underlines, Stripe label is reduced, and toast widths are bounded to the viewport. The 54-test suite passed after these changes; subsequent visual inspection corrected Support grid columns and Knowledge identity alignment. Use the development server on 4321 for ongoing review, keeping production builds separate from the active preview.

## Authenticated task slice update

The current `/practice` route replaces the historical Clerk and booking UI with
WorkOS AuthKit, practice selection and persisted tasks. Its compact white controls
use scoped semantic HTML and CSS under the shared `StudioProvider`. See
[the current integration contract](WORKOS-PRACTICE.md); the acceptance notes above
describe the earlier component migration.
