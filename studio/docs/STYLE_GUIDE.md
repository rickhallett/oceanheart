# Oceanheart Studio style guide

Canonical direction: Precision, revised with user review on 9 September 2026.

This guide governs future editions of the practice workspace (`/app`). It supersedes the original Precision design proposal and older visual defaults. Public marketing pages and `/practice` are separate surfaces. Preserve the existing information architecture unless a task explicitly changes it.

## Design intent

Professional, quiet, compact and intentional. Use typography, alignment and space to express hierarchy. Stripe informed the relative scale of text and controls; it is a reference for discipline, not a template to copy.

The workspace is one continuous white surface. Navigation, the inner app pane, cards and panels should merge visually. Do not reintroduce grey card fills, enclosing borders, gradients, decorative shadows or nested card frames. A component called `Card` does not need to look like a card.

## Colour

| Role | Value | Use |
| --- | --- | --- |
| Canvas | `#ffffff` | Navigation, page, panels and ordinary table surfaces |
| Primary text | `#17212f` | Headings and important values |
| Body text | `#354256` | Answers and prose |
| Secondary text | `#657389` | Labels, metadata and secondary descriptions |
| Placeholder | `#7b8798` | Empty input hints |
| Action / focus | `#255bd7` | Primary actions, links and focus boundary |
| Selected surface | `#edf2fe` | Selected navigation and options |
| Field border | `#d8dfe8` | Inputs and outlined controls |

Status labels retain restrained semantic tints and readable text. Their wording must convey the state without relying on colour. Modals, menus and notifications may retain a boundary or shadow because they overlay other content. Do not remove input boundaries or selected-state indicators in pursuit of a borderless page.

## Typography

| Element | Size | Weight / treatment |
| --- | --- | --- |
| Page title | 28px desktop; 25px narrow screens | 600, compact tracking |
| Section heading | 16px | 600 |
| Record heading | 14px | 500–600 |
| Body, navigation, table values | 14px | 400; selected navigation 600 |
| Secondary metadata | 13px | 400 |
| Input values and placeholders | 13px | 400, matching sizes |
| Action buttons | 13px | 500, 20px line height |
| Table headings, small labels, statuses | 12px | Restrained emphasis |

Use approximately 1.5 line height; longer answer text uses 1.6–1.65. Do not enlarge placeholders, filled input values or mobile buttons independently. Do not use bold input text. Select values must remain readable and fit without wrapping or clipping.

The 13px mobile text-field decision follows explicit visual review. Real-device focus behaviour, including iOS input zoom, remains a verification item; do not suppress browser zoom to conceal it.

## Layout and spacing

- Desktop sidebar: 224px. Top bar: 56px. Main content inset: 36px desktop, 24px intermediate, 16px narrow screens.
- Use a spacing scale of 4, 8, 12, 16, 20, 24, 28 and 36px.
- Keep labels close to their values (5–8px). Use 8px between related details, and 24–36px between independent entries or sections.
- Avoid decorative section rules. Plain lists and tables use consistent alignment and whitespace.
- Background removal must cover table sections and rows as well as their outer container: transparent cells over a grey `tbody` are still a grey table.
- Match the visual height of adjacent input/action pairs. Avoid stretched full-width buttons when a short label suffices.

## Controls

Standard standalone action buttons are 34px high, with 13px labels, 20px line height, 5px vertical and 10px horizontal padding. Use approximately 5px corner radii. Match inline task inputs to 34px with border-box sizing. Multiline fields use content-appropriate heights.

Composite controls (search icon + input, or assistant input + Ask) have one outer boundary. Remove borders, shadows and outlines from the inner input. Apply the visible focus treatment to the outer control with `:focus-within`: blue border and a subtle 2px outline. Preserve keyboard focus visibility.

Use text-only actions when the label is enough. Answer details, Contact support and Ask have no arrows. Do not append arrows to routine actions as decoration. Icons should communicate a specific function and remain subordinate to the label.

Select wrappers and fields must have consistent widths, with the indicator inside the control. Keep selected values on one line; allow enough space for the longest normal value and the indicator. The assistant audience wrapper is 190px. Supported browsers use `appearance: base-select` for an in-page picker; native selection remains the fallback. Verify menus in actual browser/device conditions, not only closed-state screenshots.

Tab bars must not show a one-pixel vertical overflow scrollbar. Keep horizontal navigation available on small screens. Labels and selection underlines must remain legible.

## Content patterns

### Assistant

Use a single reading column, maximum 680px, with a composer maximum 560px.

1. **You asked** label followed by the question.
2. **Answer** label followed by the answer, separated from the question by about 28px.
3. Supporting source, then the secondary actions Answer details and Contact support.
4. A clearly labelled Ask a question / Ask another question composer, separated from the preceding turn by about 36px.
5. Answer from selector beneath the composer.

Keep the input compact. Avoid floating chat bubbles, oversized empty fields, scattered actions or large unexplained gaps. History and approvals are plain lists: no card fill or border, 8px within an entry, 28px between entries. Badges, title, description and supporting metadata belong together.

### Records and details

Client history puts date/time, service and status on separate lines on mobile. Email and phone are separate lines. Session facts use semantic label/value pairs (`dl`, `dt`, `dd`), with 5px label-to-value spacing and 18px between mobile facts. Do not concatenate unrelated values into a compressed row.

### Dialogs

Choose width from content, not a universal large default:

| Kind | Maximum width | Examples |
| --- | --- | --- |
| Compact | 400px | Reset confirmation |
| Form | 480px | Add client, booking, service, support request |
| Reading | 560px | Session details, answer/source evidence |
| Editor | 640px | Client detail, source editing |

Constrain to the viewport with side clearance and scroll access. Keep title and close button from colliding. Actions size to their text. Mobile label/value groups stack; do not squeeze desktop columns into the modal.

## Language

Use direct product language: Schedule, Tasks, Support, Setup. Avoid cosy slogans, aspirational filler and demo-tour footnotes. Do not add explanatory footers to ordinary pages. Keep prototype limitations in the appropriate context rather than repeating them below every table. Studio operations was removed; do not restore it as incidental navigation cleanup.

## Implementation and maintenance

Current implementation is in `src/components/workspace/precision.css`, shared controls in `src/components/studio-controls.tsx`, dialog primitives in `src/components/workspace/context.tsx`, and domain components alongside them. `src/theme.ts` contains the underlying Chakra theme.

The CSS currently includes successive review overrides and older declarations. This guide records the intended end state, not every historical rule. When editing a component, consolidate its superseded declarations where practical and inspect computed styles. Avoid adding another override without checking specificity and Chakra defaults. Do not run shared dependency type generation merely for styling changes.

## Acceptance checklist

- Inspect the actual page at desktop and 400px mobile; check 320px for wrapping/overflow-sensitive work.
- Review empty, populated, focused, selected and disabled states relevant to the change.
- Verify that panel, row and ancestor backgrounds produce the intended white surface.
- Check adjacent control heights, filled text versus placeholders, menu placement and long values.
- Use keyboard navigation and confirm focus remains visible; test the affected interaction once.
- Capture and inspect screenshots. Computed CSS alone does not establish visual acceptance.
- Run TypeScript for markup/component changes; run relevant functional checks for behaviour changes. Do not treat old exact colour/radius assertions as authoritative over this guide.
- Do not claim a full regression pass from a narrow screenshot check.

Review evidence is under `evidence/dialogs/`, including `plain-table-payments.png`, `decision-list.png`, `assistant-spacing-400.png`, `focus-assistant.png` and `task-matched-height.png`. These are historical checkpoints: later refinements and this guide take precedence over an older screenshot.
