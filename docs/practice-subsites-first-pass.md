# Stay Human flagship and separate development offering

Local review branch: `feat/practice-subsites`. Replaces the abandoned talk/make/body draft. No publication or DNS changes have been made.

The flagship leads with Kai’s chosen wording: “Stay human. Make room for yourself in a world that asks a lot.” It contains ACT, breathwork, deep tissue massage, events and a focused about page. The existing design and photography are retained.

Events have space for meditation, breathwork and somatic movement classes in Swanage, Poole and Bournemouth. Dates and venues are explicitly unconfirmed. Interest goes to an email enquiry; no events or bookings have been created.

Existing therapy and massage prices and appointment URLs are retained from the previous site. Breathwork uses an email enquiry without inventing a price, duration or booking URL. ACT wording is grounded in https://contextualscience.org/act and linked from the page; no outcome guarantees have been added. Qualifications and accreditation wording are carried over from existing content.

Development is available locally at `/dev`, with existing systems, AI guidance, portfolio, engineering and CV pages using dev navigation. Production link routing selects `dev.oceanheart.ai` for these pages and www for wellbeing. A host-conditioned Vercel rewrite maps the dev homepage to its static export. Existing URLs remain available for compatibility. Provider routing, domain aliases, DNS, TLS and any migration redirects require live review before release. Shared article archives and permanent share routes are preserved.

Validation: `npm ci --prefix website`, `bash scripts/build-production.sh`, `node scripts/check-practice-routing.mjs`, `cd website && npx tsc --noEmit`. Browser checks cover desktop/mobile layout, menu operation and client errors.

## Card-theme version

Uses `stay-human/website/app/stay-human.css`, the existing CardArt component and approved card-front assets as its design source. Oversized split homepage type, horizon image, currents, heart-of-water About artwork and quiet capsule booking links replace the earlier silhouette theme. All new wellbeing content and dev separation remain. No portrait is currently rendered; About remains a possible location once a photograph is selected. The pre-theme source files are retained locally in `/tmp/oceanheart-before-card-theme`.

Build and TypeScript passed; browser checks passed at 1440 and 390px across seven routes, with extra 320/834px checks including About. No horizontal overflow or runtime errors observed; mobile menu and Escape checks passed.

## Integrated-practice exploration

The latest direction centres one integrative practice on lived experience and the room to feel, notice and choose. Main navigation is now Practice, Sessions, Events and About; modality pages remain available as supporting explanations. The new opening is “Room for your experience”; the earlier “Make room for yourself…” invitation remains below. This is a local copy/design exploration, not publication.

About distinguishes personal spiritual inquiry, existing training, researcher-practitioner orientation and future study interests. No new professional credentials, physiological mechanisms, client outcomes or AI data-handling policies were invented. Session copy makes invitations, pacing and touch conditional on agreement. No new rates or booking products were created.

`inquiry-room-v1.png` is an AI-generated abstract visual study, copied unchanged from the built-in image tool. It depicts translucent material around negative space; it is decorative and does not represent anatomy or treatment results. Source of prior version: `/tmp/oceanheart-before-integrated`.
