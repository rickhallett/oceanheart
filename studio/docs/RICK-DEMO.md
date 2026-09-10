# Rick Hallett demonstration dataset

Fictional content in `backend/convex/lib/demoData.ts` is shared by the public sample and operator-only authenticated seed: 24 clients, 10 services, 20 enquiries, 36 tasks and 48 appointments. The public sample also demonstrates payments, support, knowledge and shop records. Contacts use example.com and the UK drama telephone range. No email or payment is sent.

The public sample uses 10 September 2026 and its own local-storage key `oceanheart-studio-rick-demo-v1`. Earlier sample edits remain under their original key.

`demoSeed:seedRick` is internal. The operator supplies a source tenant and its exact owner identity. One transaction creates a separate Rick Hallett — Demo Practice with the same owner, preserving all source records. A fixed creator/request key makes retries return the original demo tenant without overwriting edits. It never runs automatically. Dates are anchored to the London-local seed date, with past/upcoming appointments, open/completed tasks and archived/retired examples.

Staging seed: `charming-albatross-632`, tenant `jd75twx1tbhws9agbs2rqeg9kn8e5237`. Second invocation returned `created:false`. Production currently serves the public sample without backend configuration; never wire production to staging data or treat sample payment states as provider receipts.

Enquiry detail reference: [Intercom on Mobbin](https://mobbin.com/apps/intercom-web-e2b63d2e-e001-426a-93f3-b5bd11346744/6e269961-628f-4a8b-b490-a34aea334a69/screens). Conversation/reply occupy a reading column; related records/actions sit alongside and stack on mobile in the white Precision shell.

Native integration verifies internal-only access, owner checks, tenant isolation and retry preservation of edits. Release evidence records frontend/backend tests, browser checks, exact revisions and deployment outcomes.
