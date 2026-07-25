var THERAPY_OPS_SYNTHETIC_REHEARSAL_KEY =
  "THERAPY_OPS_SYNTHETIC_REHEARSAL_V1";
var THERAPY_OPS_SYNTHETIC_CLIENT_ID = "OH-SYNTH001";
var THERAPY_OPS_SYNTHETIC_INVITATION_CODE = "SYNTHETIC001";

function therapyOpsSyntheticExpectedBlock(
  clientId,
  label,
  expectedPrefix,
  operation,
  results,
) {
  try {
    operation();
  } catch (error) {
    var message = String(error && error.message ? error.message : error);
    if (message.indexOf(expectedPrefix) !== 0) {
      throw error;
    }
    results.push(label);
    TherapyOpsWorkspace.appendAudit(
      TherapyOpsCore.auditEvent(
        clientId,
        "SYNTHETIC_EXPECTED_BLOCK",
        "blocked",
        "synthetic-rehearsal",
        {
          reasonCode: label,
        },
        therapyOpsNow(),
      ),
    );
    return;
  }
  throw new Error("SYNTHETIC_EXPECTED_BLOCK_NOT_OBSERVED:" + label);
}

function therapyOpsSyntheticGetOrCreateClient() {
  try {
    return TherapyOpsWorkspace.getClient(
      THERAPY_OPS_SYNTHETIC_CLIENT_ID,
    );
  } catch (error) {
    var message = String(error && error.message ? error.message : error);
    if (
      message.indexOf(
        "CLIENT_NOT_FOUND:" + THERAPY_OPS_SYNTHETIC_CLIENT_ID,
      ) !== 0
    ) {
      throw error;
    }
  }

  var record = TherapyOpsCore.createClientRecord(
    THERAPY_OPS_SYNTHETIC_CLIENT_ID,
    THERAPY_OPS_SYNTHETIC_INVITATION_CODE,
    THERAPY_OPS_CATALOG.service.copyVersion,
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(record);
  TherapyOpsWorkspace.appendAudit(
    TherapyOpsCore.auditEvent(
      record.clientId,
      "ENQUIRY_CREATED",
      "allowed",
      "synthetic-rehearsal",
      {
        copyVersion: record.copyVersion,
      },
      therapyOpsNow(),
    ),
  );
  return record;
}

function therapyOpsSyntheticAdvanceWithoutInvite(record) {
  var outcome = TherapyOpsCore.transition(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "SESSION_READY",
    {
      sessionScheduledAt: "2030-01-15T10:00:00.000Z",
      fallbackPhoneConfirmed: true,
      remoteChecklistAcknowledged: true,
    },
    "synthetic-rehearsal",
    therapyOpsNow(),
  );
  outcome.record.facts.syntheticCalendarInviteSkipped = true;
  TherapyOpsWorkspace.saveClient(outcome.record);
  TherapyOpsWorkspace.appendAudit(outcome.audit);
  return outcome.record;
}

function runTherapySyntheticWorkspaceRehearsal() {
  if (
    THERAPY_OPS_CATALOG.service.operationalStatus !==
    "NOT_APPROVED_FOR_REAL_CLIENT_USE"
  ) {
    throw new Error("SYNTHETIC_REHEARSAL_REQUIRES_DRAFT_STATUS");
  }

  var properties = PropertiesService.getScriptProperties();
  var existing = properties.getProperty(
    THERAPY_OPS_SYNTHETIC_REHEARSAL_KEY,
  );
  if (existing) {
    return JSON.parse(existing);
  }

  var registry = TherapyOpsWorkspace.setup(THERAPY_OPS_CATALOG);
  var form = FormApp.openById(registry.intakeFormId);
  if (form.isAcceptingResponses()) {
    throw new Error("SYNTHETIC_REHEARSAL_REQUIRES_INACTIVE_FORM");
  }

  var blockedChecks = [];
  var record = therapyOpsSyntheticGetOrCreateClient();

  if (record.state === "ENQUIRY") {
    confirmTherapySuitability(record.clientId, {
      manualSuitabilityDecision: true,
      ukAdultRemoteScopeConfirmed: true,
    });
    record = TherapyOpsWorkspace.getClient(record.clientId);
  }

  if (record.state === "SUITABILITY_CONFIRMED") {
    therapyOpsSyntheticExpectedBlock(
      record.clientId,
      "urgent-safety-review-required",
      "GATE_BLOCKED:urgentSafetyReviewClear",
      function () {
        TherapyOpsCore.transition(
          THERAPY_OPS_CATALOG.workflow,
          record,
          "INTAKE_RECEIVED",
          {
            intakeComplete: true,
            urgentSafetyReviewClear: false,
          },
          "synthetic-rehearsal",
          therapyOpsNow(),
        );
      },
      blockedChecks,
    );
    completeTherapyIntake(
      record,
      {
        fullName: "Synthetic Client",
      },
      "SYNTHETIC-RESPONSE-001",
      true,
    );
    record = TherapyOpsWorkspace.getClient(record.clientId);
  }

  if (record.state === "INTAKE_RECEIVED") {
    recordTherapyAgreementSigned(record.clientId, {
      agreementVersion: THERAPY_OPS_CATALOG.service.copyVersion,
      agreementSignedAt: "2030-01-01T12:00:00.000Z",
      privacyNoticeVersionAcknowledged:
        THERAPY_OPS_CATALOG.service.copyVersion,
      captureScheduleVersionRecorded:
        THERAPY_OPS_CATALOG.service.copyVersion,
      transcriptionConsent: false,
      approvedAiPurposes: [],
    });
    record = TherapyOpsWorkspace.getClient(record.clientId);
  }

  if (record.state === "AGREEMENT_SIGNED") {
    recordTherapyPayment(record.clientId, {
      paymentReference: "SYNTHETIC-PAYMENT-001",
      paymentReceivedAt: "2030-01-02T12:00:00.000Z",
      sessionsPurchased: 4,
    });
    record = TherapyOpsWorkspace.getClient(record.clientId);
  }

  if (record.state === "PAYMENT_RECEIVED") {
    therapyOpsSyntheticExpectedBlock(
      record.clientId,
      "practitioner-send-approval-required",
      "PRACTITIONER_SEND_APPROVAL_REQUIRED",
      function () {
        createTherapySessionInvite(record.clientId, {
          practitionerApprovedToSend: false,
        });
      },
      blockedChecks,
    );
    record = therapyOpsSyntheticAdvanceWithoutInvite(record);
  }

  if (record.state === "SESSION_READY") {
    therapyOpsSyntheticExpectedBlock(
      record.clientId,
      "session-capture-check-required",
      "TRANSCRIPTION_BLOCKED:",
      function () {
        authorizeTherapyTranscription(record.clientId);
      },
      blockedChecks,
    );
    recordTherapyFirstSessionStarted(
      record.clientId,
      "2030-01-15T10:00:00.000Z",
    );
    record = TherapyOpsWorkspace.getClient(record.clientId);
  }

  if (record.state === "ACTIVE") {
    therapyOpsSyntheticExpectedBlock(
      record.clientId,
      "approved-ai-processor-and-purpose-required",
      "AI_PROCESSING_BLOCKED:",
      function () {
        requestTherapyAiDraft(record.clientId, {
          processorId: "unapproved-synthetic-processor",
          purpose: "unapproved-synthetic-purpose",
          sessionId: "SYNTHETIC-SESSION-001",
          sourceFileId: record.agreementDocId,
        });
      },
      blockedChecks,
    );
    therapyOpsSyntheticExpectedBlock(
      record.clientId,
      "practitioner-sharing-approval-required",
      "CLIENT_VISIBLE_COPY_BLOCKED:",
      function () {
        approveTherapySharedFile(record.clientId, {
          sourceFileId: record.agreementDocId,
          clientVisibleTitle: "Synthetic draft",
          artifactType: "synthetic-clinical-draft",
          practitionerApprovedForSharing: false,
        });
      },
      blockedChecks,
    );
    beginTherapyClosure(record.clientId, {
      closureReason: "synthetic-completion",
      closureReviewScheduled: true,
    });
    record = TherapyOpsWorkspace.getClient(record.clientId);
  }

  if (record.state === "CLOSURE_DUE") {
    completeTherapyClosure(record.clientId, {
      sharedMaterialDisposition: "synthetic-export-reviewed",
      invoiceBalanceReviewed: true,
      retentionReviewDatesSet: true,
      closureApprovedByPractitioner: true,
    });
    record = TherapyOpsWorkspace.getClient(record.clientId);
  }

  if (record.state !== "CLOSED") {
    throw new Error(
      "SYNTHETIC_REHEARSAL_UNEXPECTED_STATE:" + record.state,
    );
  }

  var deletionReview = reviewTherapyRecordDeletion(record.clientId, {
    retentionDateReached: false,
    noActiveHold: true,
    practitionerDeletionApproval: false,
  });
  if (deletionReview.authorized || deletionReview.deletionPerformed) {
    throw new Error("SYNTHETIC_REHEARSAL_DELETION_GUARD_FAILED");
  }

  TherapyOpsWorkspace.appendAudit(
    TherapyOpsCore.auditEvent(
      record.clientId,
      "SYNTHETIC_REHEARSAL_COMPLETED",
      "allowed",
      "synthetic-rehearsal",
      {
        reasonCode: "live-workspace-rehearsal",
      },
      therapyOpsNow(),
    ),
  );

  var result = {
    schemaVersion: 1,
    completedAt: therapyOpsNow().toISOString(),
    clientId: record.clientId,
    state: record.state,
    rootFolderId: registry.rootFolderId,
    clientAdminFolderId: record.adminFolderId,
    clientClinicalFolderId: record.clinicalFolderId,
    clientSharedFolderId: record.sharedFolderId,
    intakeFormAcceptingResponses: form.isAcceptingResponses(),
    externalCalendarInviteCreated: false,
    externalFileShared: false,
    externalAiRequestCreated: false,
    deletionPerformed: false,
    blockedChecks: blockedChecks,
  };
  properties.setProperty(
    THERAPY_OPS_SYNTHETIC_REHEARSAL_KEY,
    JSON.stringify(result),
  );
  return result;
}
