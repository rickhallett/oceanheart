**Oceanheart Studio — design inspection, 9 September 2026**

The visual identity is coherent: deep ocean colours, warm copper, restrained line icons, and an editorial serif on the public site. The interface now has a useful Chakra foundation. Its next improvement should be a focused design pass on legibility, hierarchy and mobile composition. Buying more components would not resolve the weaknesses found here.

This is an inspection and recommendation report. Application code was not changed during the inspection.

**Scope and evidence**

Inspected the local production build at `http://127.0.0.1:4321`, on `feat/studio-chakra`: homepage, 17 workspace modules, and the unavailable `/practice` screen. Collected geometry at 1440, 1024 and 390 CSS pixels: 57 route/viewport observations. Reviewed desktop and mobile screenshots, plus booking, client, source and service dialogs, empty search and mobile navigation. Dialog captures were repeated after entry animations finished to avoid mistaking transitional opacity for a persistent defect.

All sampled page widths fit their configured viewport. That does not guarantee that descendants fit their cards: the support row below is a counterexample. The preceding migration's 48 passing functional tests are useful evidence of behaviour, but did not constitute complete visual acceptance. This inspection found issues those tests missed.

Evidence is saved in [/Users/oai/.codex/artifacts/studio-design-inspection-2026-09-09](/Users/oai/.codex/artifacts/studio-design-inspection-2026-09-09), including screenshots, `metrics.json`, `states.json`, corrected alpha-composited `contrast.json`, and capture scripts. `/practice` authentication, backend operations, every possible data/error state, assistive-technology use and Safari were not exercised. This is not a WCAG conformance certification.

Key visual evidence: [support row overlap](/Users/oai/.codex/artifacts/studio-design-inspection-2026-09-09/-app-support-390.png), [mobile payment records](/Users/oai/.codex/artifacts/studio-design-inspection-2026-09-09/-app-payments-390.png), [modal action styling](/Users/oai/.codex/artifacts/studio-design-inspection-2026-09-09/state-client-1440.png), [mobile Today hierarchy](/Users/oai/.codex/artifacts/studio-design-inspection-2026-09-09/-app-today-390.png), [desktop homepage](/Users/oai/.codex/artifacts/studio-design-inspection-2026-09-09/--1440.png).

**Descending priorities**

| Rank | Finding | Recommended change | Reach / effort |
| --- | --- | --- | --- |
| 1 | **Defect: mobile support row overlaps subsequent content.** At 390px, the conversation button is 44px high while its title alone is 95px high. The enclosing card ends at y726; its text extends to about y796. | Give record buttons content-driven height. Put the title in a flexible column, move status below it on phones, keep the arrow in a narrow trailing column. Verify containment with longer titles. | Shared record-row pattern; small |
| 2 | **Defect: public primary CTA contrast.** “Let’s talk” renders cream `#f3e5d8` on copper `#e7ad84`, approximately **1.59:1**, at 15px. | Use the existing dark `copper.contrast` token on solid copper links/buttons, including hover and focus. Remove the global anchor colour override that defeats the recipe. | Every marketing primary CTA; small |
| 3 | **Legibility: action text gets smaller on mobile.** “New booking” and “Add client” are 10px; the footer feedback action is 8px. A large hit area does not make its text readable. | Set action labels to 14–15px on every viewport; use 15–16px for reading and mobile inputs, 12–13px for secondary metadata. Let controls wrap or stack rather than shrinking their text. | Whole product; medium |
| 4 | **Inconsistency: dialogs lose the shared action styling.** The mobile Add client submit is 38px high with 0px radius and 10px text; page actions are 44px high with 10px radius. | Put height, radius, label size and state colours in Chakra recipes that apply inside portals. Give dialogs one consistent footer with primary action and an explicit Cancel action. | All editing workflows; small–medium |
| 5 | **Mobile records hide the information that distinguishes them.** Clients, knowledge, payments and orders use 570px tables in a 390px viewport; status/actions are off to the right. | Use a mobile record-list composition: title, metadata and status together, followed by the relevant action. Keep real tables on desktop. If retaining horizontal scrolling, make it discoverable and keep the identifying column visible. | Four record families; medium |
| 6 | **Daily work begins too far down the page.** The mobile Today agenda starts at y591, Bookings at y598, and Knowledge's record panel at y671. Introductory chrome consumes much of the first screen. | Keep a compact, persistent “Sample workspace” indicator; move the long explanation into an expandable notice. Combine title and primary action, shorten vertical gaps, and keep feature voting in an expandable feedback control. Preserve clear simulation disclosures. | All 17 modules; medium |
| 7 | **Most panels have equal emphasis.** The agenda, assistant instructions, support promotion, explanatory text and records all receive similar large bordered cards. Today puts its pending approval below four substantial cards. | Prioritise next appointment and pending work. Use three surface roles: page canvas, working panel, and floating overlay. Remove a card boundary where a section heading and divider suffice; move supporting content below primary work. | Dashboard, assistant, portal, operations; medium |
| 8 | **Mobile Enquiries is a compressed desktop split view.** Filters and conversation tiles share a horizontal strip; the selected title is clipped and alternatives require sideways discovery. | Use a full-width conversation list, followed by a dedicated conversation view with Back to enquiries. Keep filters above the list. | Core enquiry-to-booking journey; medium |
| 9 | **Style decisions remain scattered.** Chakra tokens coexist with `--ws-*`, `--app-*`, public `:root` variables, scoped CSS, and component overrides. Similar copper/surface values differ slightly. | Keep marketing's editorial type scale, but map shared colours, controls, radii, spacing and statuses to semantic tokens. Remove conflicting legacy rules as each component family moves to recipes. | Every future builder; medium |
| 10 | **Navigation presents too many equally weighted destinations.** At 1000px height, setup/settings/operations/roadmap sit below the visible sidebar navigation. | Keep Today, Enquiries, Bookings, Clients and Tasks prominent. Group practice configuration separately; put operator and research tools behind a distinct section. Allow the selected destination to remain visible. | Whole workspace; medium |
| 11 | **The mobile marketing demo is too detailed for its size.** Preview labels reach 8–11px; the homepage is 4646px tall at 390px. | Show one readable agenda or enquiry in the phone preview, with a clear “Explore the workspace” link. Reduce repeated service/process card framing and keep the main narrative concise. | Public first impression; medium |
| 12 | **The roadmap repeats a large editor 17 times.** At 390px it is 6505px tall, with a narrow select appearance inside wide rows. | Add priority filters, use compact feature rows, and expand notes/journeys only when requested. Keep counts and export close to the current work. | Product planning; medium |

The first four are the immediate acceptance pass. The largest subsequent product gains are mobile records, the shared page header, and a more purposeful Today layout.

**Style direction to retain and refine**

Keep the ocean background and Cormorant marketing headings. Keep DM Sans for operational screens, copper for primary action and current selection, and the recognisable brand mark. These choices give Studio a distinct voice without making the application ornate.

Use copper less often for ordinary row titles and secondary actions. Neutral text can carry routine navigation; filled copper should signal a deliberate next step. Add a restrained, consistent status vocabulary: sage for ready/paid, amber for attention/pending, and rose for blocked/error. Always retain text labels. Current badges generally have readable foreground contrast, but their similar small silhouettes make scanning harder.

Use a consistent type hierarchy: proposed page titles 32–36px desktop and 28–32px mobile; section titles 20–24px; body 15–16px; actions 14–15px; metadata 12–13px. These are design recommendations, not WCAG-prescribed minimum font sizes. Reserve tiny text for genuinely incidental information.

Adopt a small spacing scale of 4/8/12/16/24/32/48px. Use roughly 24px panel padding on desktop and 16–20px on phones. Preserve generous marketing spacing, but remove compounded padding in cards inside cards. Keep controls 44–48px high as a product convention, with 10px control and 16px panel radii. Marketing pill CTAs can remain an intentional exception.

Use tabular numerals and consistent alignment for money, counts and appointment times. Payments should right-align amounts. Standardise dates: the portal currently displays `2026-09-08`, the calendar picker displays `08/09/2026`, and headings display “Tuesday 8 September”. Use human-readable dates in content, locale-native input controls for editing, and ISO values only in data interchange.

The website preview's light cream/sage treatment is a useful visual distinction from the operator workspace. The portal's green outer panel currently contains the same dark operational cards; carry the client-facing treatment through more deliberately if it represents the same practice brand. A light workspace mode is a possible later extension; fixing the existing hierarchy has higher immediate value.

**Per-surface inspection**

| Surface | What works | Specific next improvement |
| --- | --- | --- |
| Public homepage | Strong imagery, serif hierarchy and personal introduction | Fix CTA contrast; enlarge phone preview content; use an existing approved portrait of Rick if available to support the personal promise |
| Today | Clear greeting, useful totals, coherent agenda | Move pending approval near the top; reduce support/tour prominence; bring the next appointment into the first mobile screen |
| Enquiries | Desktop master/detail relationship is understandable | Replace the phone strip with list/detail navigation; strengthen selected versus unread distinction |
| Bookings | Clear day selector and agenda grouping | Compact the three-row mobile toolbar; make the selected date stronger; reduce pre-agenda space |
| Clients | Names, avatars and email hierarchy scan well on desktop | Keep session count and status visible in the mobile record; make the whole intended row area consistently actionable |
| Tasks | Checkbox labels and completed state are clear | Reduce excess panel/row whitespace and separate completed work into a compact disclosure |
| Services | Price, description and availability form a coherent group | Shorter phone cards, larger action text, and less repeated icon/empty space |
| Your website | Light preview is clearly distinct from editing controls | Phone Edit/Preview modes would shorten scrolling; keep publish status/action adjacent |
| Knowledge | Source identity, audience and readiness are meaningful | Prioritise “Needs sync”; make audience/status visible on phones; collapse the large explanatory strip |
| Assistant | Scope and approval boundary are stated clearly | Put supported prompts near the composer; reduce the large empty welcome area; elevate pending approvals |
| Payments | Summary and filters are understandable | Right-align amounts; show status and action alongside amount on phones; make a disabled refund's reason available |
| Shop | Product illustrations add variety | Align product actions consistently; avoid empty grid space for two items; expose phone order status/actions |
| Client portal | Client identity and next-session grouping are clear | Reduce nested frames, standardise dates, and use a consistent client-facing surface treatment |
| Your studio partner | Personal support is a useful differentiator | Fix the overflowing mobile conversation row first; then reduce repeated introductory copy |
| Set up together | One prominent next action and clear progress concept | Use a compact “Step 1 of 4” header on phones; enlarge step labels and provide fuller names when needed |
| Settings | Sensible division between practice details and connections | Enlarge mobile actions; distinguish the destructive reset visually and explain connection state consistently |
| Studio operations | Tabs separate activity, retrieval and delivery | Keep operator language in the operator area; flatten nested explanatory panels and strengthen event hierarchy |
| Shape the roadmap | Feature descriptions preserve useful context | Compact rows with filters and expandable details; fix select sizing and reduce repeated controls |
| `/practice` unavailable | Branded, readable and honest about availability | Bring the explanation above the large artwork on phones; keep CTA text and arrow on one line |

**Interaction and state styling**

Dialog fields remain readable after entry animations finish. Their primary footer needs the shared recipe correction described above. A restrained border and slightly stronger overlay separation would make the active form easier to locate. Keep keyboard focus conspicuous, but use a single focus-ring treatment: the search input currently combines multiple outlines. Its empty result should provide a next step such as “Try a feature name, such as Clients”.

Use `EmptyState` for genuinely empty records with a relevant next action. Reserve a check icon for success; the generic empty helper currently uses a check for every empty state. Establish explicit loading, empty, invalid, success, disabled and destructive variants in a small internal component specimen page. Loading and provider-error states beyond the unavailable screen need a separate controlled fixture review.

Recommended acceptance cases for the next pass: long support titles at 320/390px; 200% text enlargement; readable mobile actions; contrast for CTA normal/hover/focus; modal buttons inside portals; no obscured mobile record status; and containment of record content inside its card. Retain the existing keyboard and workflow tests. Add assertions for these actual failures rather than equating “no page overflow” with a finished layout.

**Measured colour samples**

| Sample | Ratio | Interpretation |
| --- | --- | --- |
| Public solid copper CTA text | 1.59:1 | Fails the normal-text contrast threshold |
| Search empty-state text | 9.10:1 | Good sampled foreground/background contrast |
| Client “Returning” badge | 9.12:1 | Contrast is good; small type and weak status differentiation are separate issues |
| Prototype explanation | 5.52:1 | Meets sampled normal-text threshold; occupies too much repeated space |
| Workspace footer base text | 4.94:1 | Meets sampled threshold; mobile sizing remains too small |

Computed colours were measured in Chromium; alpha backgrounds were composited through their ancestors. These samples do not certify gradients, imagery, hover states or the whole interface. WCAG's normal-text minimum is 4.5:1, with exceptions including large text and inactive controls. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). The 44px control recommendation above is our comfort target; WCAG 2.2 AA's target-size rule uses 24px with specified exceptions. [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

**Implementation order and ownership**

Start with `ui.tsx`/`globals.css` for CTA contrast; `business.tsx` and the source-row rules for the support overflow; `context.tsx` and the button recipe for portal consistency; and mobile `.ws-button` overrides for action typography. These can be corrected without reimagining the brand.

Then consolidate colours and variants in `theme.ts`. Shared values currently also live in `application-tokens.css`, `workspace.css`, `shell-chakra.css`, `content-chakra.css` and public globals. `workspace.css` alone remains 2526 lines. Its length is not intrinsically a defect, but the conflicting values and descendant assumptions are concrete maintenance problems. Chakra's [semantic token model](https://chakra-ui.com/docs/theming/semantic-tokens) supports the role-based approach needed here.

Build the next approved design around three representative compositions: Today, a mobile record list, and a modal editor. Once those are visually accepted, propagate the recipes to the other modules. This gives future agents a concrete example of hierarchy and behaviour rather than a collection of loosely related styling rules.
