# Google Apps Script deployment

Status: draft provisioning source

This project provisions editable Google Workspace assets from the versioned
repository sources. It is intentionally unable to accept real intake responses
while `operationalStatus` is not `APPROVED_FOR_REAL_CLIENT_USE`.

## Generated and hand-written files

- `src/GeneratedCatalog.gs` is generated. Do not edit it directly.
- `src/Core.gs` contains pure fail-closed workflow logic.
- `src/Workspace.gs` contains Google Drive, Docs, Sheets, and Forms adapters.
- `src/Main.gs` exposes the practitioner entry points.
- `appsscript.json` declares the minimum currently required services.

## Build

From `therapy-ops/`:

```sh
npm run validate
npm run build
npm test
```

## Provisioning sequence

1. Create a standalone Apps Script project in the Oceanheart Workspace account.
2. Push `appsscript.json` and every file under `src/`.
3. Review and grant the requested Workspace scopes.
4. Run `setupTherapyOpsDraft()`.
5. Inspect the returned root folder, draft Form, template Docs, and system
   Sheets.
6. Complete every configuration placeholder and professional approval.
7. Change the source operational status only through an approved review commit.
8. Rebuild and redeploy.
9. Run `activateTherapyIntakeForm()` with the recorded release approval.

Google Docs eSignature remains a manual practitioner step because the current
workflow does not assume an eSignature provisioning API.

Calendar invitation sending, file sharing, transcript attachment, AI requests,
and deletion are explicit practitioner actions. Setup does not perform them.

## Local state and identifiers

The deployed Apps Script stores Workspace file identifiers in Script
Properties. Local deployment identifiers belong in `.clasp.json`, which is
ignored by Git.

Do not commit exported Form responses, Workspace identifiers, OAuth tokens,
deployment manifests, or real client data.
