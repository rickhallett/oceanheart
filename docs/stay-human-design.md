# Stay human — card-front website direction

Local design branch: `design/stay-human-card-fronts`.
Base: `4d18f9f` (`feat/coastal-restyle`), the newest integrated website checkout on 6 September 2026. It includes the merged production SVG-arrow fixes. The original checkouts and their unrelated changes were preserved.

## Preview

```sh
npm ci --prefix website
npm run dev --prefix website -- --host 0.0.0.0 --port 4317
```

Open http://localhost:4317. This branch has not been deployed or pushed.

## Six fronts, one site

- **01 Stay human:** oversized live HTML heading, near-black, warm ivory, small sea-grey rule; widely tracked lowercase wordmark in navigation and footer.
- **02 Tidal horizon:** a full-width transition below the homepage opening and the AI guidance page opening.
- **03 Confluence:** native SVG currents across the systems page and connected-practices section. The geometry is a new responsive interpretation of the reference.
- **04 Embodied:** a shadowed movement image on the therapeutic-practice page.
- **05 Heart of water:** wave imagery on the about page.
- **06 Touchstone:** warm ivory, dark stone and mineral vein for selected work, notes, engineering, CV and their detail pages.

The artwork copies are unchanged approved PNG originals. CSS windows and masks keep their baked-in lettering outside the visible image treatments. Headings, labels and the brand wordmark are accessible HTML; decorative art is hidden from assistive technology. Functional links retain ordinary spacing. Arial/Helvetica is a repeatable approximation of the generated card typography, not an extracted or identified font.

The coastal theme switch is absent in this trial so the entire navigation presents one coherent direction. Existing service copy, booking destinations, project content, notes, canonical metadata and routes remain available.

## Verification

- `npx tsc --noEmit` from `website`: passed.
- `npm run build --prefix website`: passed; 22 routes exported, none skipped.
- Browser screenshots captured at 1440×1000 and 390×844 for home, all three practices, about, selected work, notes, engineering and CV.
- Additional overflow checks at 320px and 768px across the seven primary pages: passed.
- Mobile menu open/close, Escape and focus restoration, navigation to therapy, and booking link presence: passed, no browser runtime errors in the interaction check.
- Review PNGs are local in `output/stay-human-review/` and excluded from Git.

The browser checks used local Chromium, not physical iOS/Android devices. The unchanged Hugo archive and deployment integration were not rebuilt for this local visual trial. Full-resolution approved artwork is retained (about 6.9 MB across four images); further asset optimization can follow selection of this direction.

## Review refinements

The first review increased desktop and portrait-tablet navigation to 16px, with a separate navigation row between 801px and 1100px. Phone navigation retains its prior size. The shared practice/about artwork now starts at 36% of the desktop page width and uses a longer multi-stop overlay into the text. About-page role spans use three light neutral shades, retaining the wording “experience designer”. The horizon question is now “do you know what’s coming next?” in lowercase, with generous tracking.

After these refinements, TypeScript and the 22-route build passed again. Nine pages were captured and checked for horizontal overflow at 1440×1000, 834×1194 and 390×844. The exact question was checked at all three sizes, and the phone menu and Escape interaction passed. Updated local evidence is in `output/stay-human-review/refinements/`.

## Quiet capsule selection

Booking CTAs now follow the selected Quiet capsule study: transparent resting surface, subdued 1px border, 100px radius, 50px minimum height, 12px × 24px padding, normal-spaced 15px text at weight 400, and a gentle 200ms hover inversion. The shared booking selector covers the appointment links in page openings and closing booking sections; destinations are unchanged. Keyboard focus remains explicitly visible and reduced-motion preferences disable the color transition. The homepage exploration link retains its underline treatment. The horizon question is set to 0.74 opacity.

TypeScript and the 22-route build passed. Desktop and phone browser checks confirmed 50px touch targets, capsule radius, keyboard focus, hover appearance, no horizontal overflow on the checked booking page, the homepage underline, and computed question opacity. Screenshots are in `output/stay-human-review/capsules/`.

## Phone spacing and practice-list refinement

A `max-width: 600px` refinement increases opening top breathing room and gives text adaptive side gutters (about 28px at 390px, 23px at 320px). The homepage heading now scales down at narrow phone widths to retain its two-line shape and complete punctuation. The supporting heading is slightly smaller. Interior openings gain roughly 25–30px of top space on typical phones, while depth-page openings gain a modest inset.

The three-ways list pairs each number with its service label, reduces practice headings from 28px to 24px and body text from 18px to 16px, and sets deliberate label/title/body/link spacing. The section heading and connected-practices text are also slightly quieter. Content, destinations, left alignment and interactions are retained. These rules do not affect tablet or desktop widths.

TypeScript and the 22-route build passed. Browser checks covered five routes at 320×740, 375×812, 390×844 and 430×932: no horizontal overflow; complete homepage heading glyph bounds; booking targets remain at least 50px high. The homepage exploration CTA remained within each checked first viewport. Updated screenshots are in `output/stay-human-review/mobile-spacing/`.

## Consistent phone typography throughout the site

The approved phone approach now extends through all interior routes. Service/about and work/index headings share a restrained responsive scale and light weight; long titles (over 60 characters) use a smaller reading-page scale. Interior prose is 16px/1.65, with consistent small labels, title/intro spacing, listing hierarchy, article subheads, project captions, disclosure spacing and closing booking sections. The new rules are limited to 600px and below. Content and destinations are unchanged. The homepage question's explicitly requested opacity is now 0.1, preserving the user's edit.

Audit: all 21 content routes at 320, 375, 390, 430, 834 and 1440px (126 route/viewport combinations), including the three practices, about, selected work, notes and blog index, engineering, CV, seven project details and four articles. All returned 200 with one H1, complete heading bounds, no horizontal overflow, booking targets at least 50px and no observed browser runtime errors. All seven project detail pages also passed keyboard disclosure and expanded-content overflow checks at 320px. TypeScript and the full 22-route static build passed. The approved 390px homepage opening screenshot is byte-identical to the previous version. Evidence and the audit JSON are in `output/stay-human-review/mobile-consistency/`.
