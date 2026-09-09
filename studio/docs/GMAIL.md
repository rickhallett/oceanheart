# Gmail connection and selected import

Owners can connect Gmail with `gmail.readonly`, browse one 20-message inbox page
at a time, preview a selected plain-text message and import that message as an
enquiry. Browsing does not automatically import messages. No send, label,
mark-as-read, attachment retrieval or whole-inbox ingestion is implemented.
HTML-only messages cannot be imported; HTML is never rendered. Truncated text
and excluded attachments are labelled. Imported enquiries show their Gmail source.

Connection status and mailbox data are owner-protected. A reconnect or disconnect
changes the connection generation, clearing previous page/preview state. Import
re-fetches the selected message server-side and deduplicates by practice, mailbox
and message ID. Retrying an import opens the existing enquiry. Imported text is
untrusted source content, never an instruction or a reply authorisation.

## Server configuration

Convex requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_REDIRECT_URI`, `GMAIL_TOKEN_ENCRYPTION_KEY` and
`GMAIL_ROUTE_SIGNING_KEY`. Both keys are distinct random 32-byte values encoded as
canonical base64. Only `GMAIL_ROUTE_SIGNING_KEY` is also installed in the Next.js
staging environment. None use a `NEXT_PUBLIC_` prefix. Google tokens and PKCE
verifiers stay encrypted in internal backend storage and never enter browser
props, action results, logs or evidence.

The exact staging callback is:
`https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app/practice/integrations/gmail/callback`.
Next derives its trusted origin from the configured WorkOS callback, preserving
the existing proxy-hostname protection. Connect uses POST and exact Origin
validation. Its signed HttpOnly SameSite=Lax cookie expires after ten minutes and
binds state, browser nonce, practice, actor and WorkOS session. Cookie signatures
use a dedicated context with the existing WorkOS cookie secret. Backend begin and
complete actions additionally require short-lived HMAC proofs signed using the
separate Gmail route key. Proofs bind the same actor/session/nonce and, on callback,
the exact state and code hash. The backend rechecks ownership and atomically
consumes the one-time state before exchange. Callback responses clear the cookie,
use no-store/no-referrer, and expose only a safe result and selected practice.

Provider denial clears the browser cookie; unused server state expires. Disconnect
removes local credentials and attempts provider revocation. If revocation cannot
be confirmed, the UI reports it and points the user to their Google account.
Google Testing-mode grant expiry or revoked access requires reconnection.

## Verification and acceptance boundary

Focused tests cover Origin rejection, cookie tampering/expiry, actor/session/state
mismatch, duplicate callback state, provider denial, code-bound proofs, no automatic
mail access/import, text-only rendering, pagination, duplicate import retry and
permission/connection changes. These tests mock the provider boundary and do not
prove real Google OAuth consent or real mailbox access.

Human Google consent, followed by selecting a specific message for import, is a
separate acceptance gate. Root delivery records the deployed revision, live
connection and selected import evidence. Do not include OAuth callback URLs with
codes/state, email bodies, raw server logs, tokens or secrets in public evidence.

References: [Google server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server)
and [Gmail message listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list).

Current staging setup uses Google project `oceanheart-studio`, OAuth consent in
Testing mode, and `kai@oceanheart.ai` as the sole test user. The web client uses
the exact staging callback above. Provider and signing/encryption keys are private
outside Git and installed only in the matching staging environments; no production
variables were changed. Root retains the pre-change database baseline. Real owner
consent and selected-message import remain pending until demonstrated; implementation
and mocked tests do not move that acceptance gate to Done.
