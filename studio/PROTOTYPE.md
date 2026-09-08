# Practice workspace prototype

Live entry: `/app`. The original marketing page remains at `/`, with an Explore the app link below its workspace preview.

## Purpose

A lived, browser-persistent representation of the practitioner service, used to choose an MVP before building integrations and infrastructure. Seventeen screens cover Today, enquiries, bookings, clients, tasks, services, website editing, client portal, knowledge, assistant/approvals, payments, shop, personal support, onboarding, settings, operator tools, and roadmap decisions.

## Try these journeys

1. **Enquiry to booking:** Enquiries → Sophie → prepare example reply → send to approval queue → Assistant → Needs your approval → approve reply. Return to Sophie's conversation and book her free first conversation on Thursday 10 September at 11:00. The calendar and client history reflect it.
2. **A client's view:** Client portal → choose a sample client → send a message. The same message appears in the practitioner's enquiry inbox. Sample payments update the Payments view.
3. **Knowledge lifecycle:** Add a text source or edit an existing one → see Needs sync → sync it → ask a matching question in Assistant → inspect the citation. Team-only sources are excluded in Public answers mode. Unknown or clinical questions show abstention/handoff paths.
4. **Payment approval:** Payments → request a refund → approve or decline in Assistant. Approved refunds target the corresponding sample payment.
5. **Your first version:** On any feature choose Essential, Next, Later, or Not needed. Add notes in Shape the roadmap and export the JSON build plan. Selections also carry through the setup wizard.
6. **A personal service:** Create a support request, add a sample message and resolve/reopen it. Assistant handoffs include their question and response context.

## State and boundaries

`model.ts` contains typed sample entities and the feature catalogue. `context.tsx` owns browser-local persistence (key `oceanheart-studio-workspace-v1`), feedback and accessible dialogs. The domain view components share these entities. `workspace.css` scopes the app styling, using the same font families and colour direction as the marketing site.

All data is fictional. No authentication, email delivery, external API access, payment processing, real model calls, document parsing or cloud provisioning takes place. The knowledge assistant uses a labelled local keyword search and source excerpts. Connection toggles and operator release controls simulate state only. Availability text is descriptive; the booking form validates session overlaps. Editing the website is saved by Publish demo. Reset clears local sample changes and roadmap choices.

The client portal is a persona preview, not an authorised client data boundary. Use fictional information only. Browser storage is not a clinical record system. Priorities are local to the current browser; export them to move the plan between browsers or devices.

## Verified before publication

- Next.js production build and strict TypeScript checks.
- All 17 routes render at 390px and 1250px without horizontal overflow.
- Draft → approval → replied conversation; booking creation appears on the selected calendar day.
- Source-supported sample answer includes a document citation.
- Feature priority survives navigation and full reloads.
- Responsive dashboard, assistant and roadmap inspected visually.
- Browser error log clean in the tested local session.
