# Application design foundations

The application should feel substantial, calm and precise at ordinary desktop zoom. Typography must distinguish an action, a person, a supporting detail and a page heading without relying only on colour.

`src/styles/application-tokens.css` supplies shared primitives to both the full `/app` prototype and the authenticated `/practice` surface. The marketing site keeps its separate editorial typography.

## Type hierarchy

- DM Sans throughout the application, with variable weight 450 for body text, 550 for labels/actions and 600 for headings and important data.
- Desktop reading text is 14–15px. Supporting metadata is 12–13px; 11px is reserved for compact status and peripheral context.
- Page headings are 36–43px; panel titles typically 22–26px. Names and primary row labels receive more emphasis than dates, duration and status.
- Numbers use tabular figures where comparison matters. Do not shrink primary controls to fit a crowded row: change the arrangement at the relevant breakpoint.

## Components and rhythm

- Controls share a 44px minimum height and a 10px radius. Labels remain visible and focus outlines remain explicit.
- Panels use a 16px radius, a restrained inset highlight and subtle shadow. Slightly raised blue surfaces and visible dividers separate content from the surrounding canvas.
- Use the shared 4/8/12/16/24/32 spacing scale. Desktop cards have 28–32px internal space, while related controls and rows use smaller intervals.
- Active navigation has a copper inset marker, a stronger label and a quiet background. Navigation scrolls independently when it exceeds the viewport.
- Preserve message wrapping, empty/error states, modal focus boundaries and mobile navigation behaviour while adjusting appearance.

## Verification for this pass

All 17 prototype routes were rendered at 1440px, 1024px and 390px: 51 route/viewport checks with no page errors or horizontal document overflow. Desktop captures cover every route, with individual inspection of Today, enquiries, services, assistant and the real sign-in surface. The existing functional desktop/mobile suite passes: 40 checks with two secretless-only cases intentionally skipped when local provider configuration is present.

Rendered samples and the per-route report are kept in `/tmp/studio-ui-pass` for this review; that temporary directory is not part of the repository.
