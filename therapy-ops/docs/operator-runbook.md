# Operator runbook

Status: Draft for synthetic verification

## Repository proof

From `therapy-ops/`:

```sh
npm run proof
```

Expected outcomes:

- editable source validation passes;
- the Apps Script catalog regenerates without a diff;
- the synthetic journey reaches `CLOSED`;
- unsafe or incomplete actions are blocked;
- the intake Form remains inactive;
- no external call or real client data is used;
- the test suite passes.

## Initial Workspace provisioning

This step is not approved until the practitioner reviews the current draft.

1. Create a standalone Apps Script project in the Oceanheart Workspace account.
2. Push `apps-script/appsscript.json` and `apps-script/src/*.gs`.
3. Review every requested OAuth scope before granting access.
4. Run `setupTherapyOpsDraft()`.
5. Confirm the created Form is not accepting responses.
6. Inspect the root folder, templates, system Sheet, response Sheet, and Form.
7. Record the Apps Script project identifier only in ignored local deployment
   state.

## Synthetic Workspace rehearsal

Use an obviously synthetic identity and an `example.test` email address.

For the no-external-side-effect rehearsal, run
`runTherapySyntheticWorkspaceRehearsal()` from the Apps Script editor. It uses
the fixed coded identity `OH-SYNTH001`, keeps the intake Form inactive, and
does not create a Calendar invitation, share a file, call an AI processor, or
delete a record.

After capturing evidence, run
`cleanupTherapySyntheticWorkspaceRehearsal()`. It can target only the fixed
synthetic client, moves its folder to Drive Trash, purges its system rows, and
leaves the reusable draft infrastructure in place.

1. Run `createTherapyEnquiry()`.
2. Run `confirmTherapySuitability()` with both gates set to `true`.
3. Open the returned prefilled intake URL.
4. Confirm that an urgent-safety answer other than `No` blocks progression.
5. Submit a safe synthetic response.
6. Confirm coded Admin, Clinical, and Shared folders are created.
7. Confirm the document pack is editable and retains visible review
   placeholders.
8. Record synthetic signature and payment evidence.
9. Confirm an invite cannot be sent without practitioner approval, payment,
   fallback contact confirmation, and checklist acknowledgement.
10. Confirm transcription cannot be authorised before the per-session check.
11. Confirm an unapproved AI processor or purpose is rejected.
12. Confirm a clinical draft cannot be copied to Shared without practitioner
    approval.
13. Confirm closure requires retention dates and explicit approval.
14. Confirm deletion review never deletes automatically.

## Real-use release gate

Do not change `operationalStatus` until all items are evidenced:

- scope to practise confirmed;
- supervision confirmed;
- insurer confirms remote therapy, transcription, and proposed AI processing;
- session fee, session duration, block expiry, payment method, refunds, and
  consumer cancellation terms approved;
- Article 6 basis and Article 9 condition confirmed;
- retention periods confirmed;
- approved processor schedule completed;
- complaints, emergency, and out-of-hours wording approved;
- Workspace account edition, access controls, audit, and retention verified;
- client copy reviewed;
- synthetic Workspace rehearsal completed;
- release commit recorded;
- practitioner signs and dates the release approval.

`activateTherapyIntakeForm()` then requires:

- source status `APPROVED_FOR_REAL_CLIENT_USE`;
- no unresolved configuration placeholders;
- practitioner approval;
- approval timestamp;
- exact release commit SHA.

## Routine client operation

### Before intake

- Decide suitability manually.
- Create the coded enquiry.
- Confirm adult, UK, remote-individual scope.
- Send only the generated private intake link.

### Before session one

- Review the intake response.
- Resolve any urgent-safety flag manually.
- Review the generated document pack.
- Send the agreement using Google Docs eSignature.
- Record the exact agreement, privacy, and capture-schedule versions.
- Confirm payment.
- Create the coded Calendar and Meet invitation.

### At every session

- Confirm current location and privacy.
- Confirm the fallback telephone.
- Record the session capture check.
- Start transcription only after authorization succeeds.
- Stop transcription if either person requests it.

### After a session

- Attach the transcript to the coded Clinical folder.
- Request AI processing only for an approved processor and purpose.
- Review every AI output.
- Copy only practitioner-approved material into Shared.

### At closure

- Review unused sessions and invoice balance.
- Agree the disposition of shared material.
- Set retention-review dates.
- Approve closure.
- Treat future deletion as a separate reviewed action.
