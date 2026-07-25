function therapyOpsNow() {
  return new Date();
}

function therapyOpsRandomToken(length) {
  var raw = Utilities.getUuid().replace(/-/g, "").toUpperCase();
  return raw.slice(0, length);
}

function setupTherapyOpsDraft() {
  return TherapyOpsWorkspace.setup(THERAPY_OPS_CATALOG);
}

function createTherapyEnquiry() {
  var clientId = "OH-" + therapyOpsRandomToken(8);
  var invitationCode = therapyOpsRandomToken(12);
  var record = TherapyOpsCore.createClientRecord(
    clientId,
    invitationCode,
    THERAPY_OPS_CATALOG.service.copyVersion,
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(record);
  TherapyOpsWorkspace.appendAudit(
    TherapyOpsCore.auditEvent(
      clientId,
      "ENQUIRY_CREATED",
      "allowed",
      "practitioner",
      {
        copyVersion: record.copyVersion,
      },
      therapyOpsNow(),
    ),
  );
  return {
    clientId: clientId,
    state: record.state,
  };
}

function confirmTherapySuitability(clientId, decision) {
  var record = TherapyOpsWorkspace.getClient(clientId);
  var outcome = TherapyOpsCore.transition(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "SUITABILITY_CONFIRMED",
    {
      manualSuitabilityDecision: decision.manualSuitabilityDecision === true,
      ukAdultRemoteScopeConfirmed:
        decision.ukAdultRemoteScopeConfirmed === true,
    },
    "practitioner",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(outcome.record);
  TherapyOpsWorkspace.appendAudit(outcome.audit);
  return {
    clientId: clientId,
    state: outcome.record.state,
    intakeUrl: TherapyOpsWorkspace.prefilledIntakeUrl(
      outcome.record.invitationCode,
    ),
  };
}

function handleTherapyIntakeSubmit(event) {
  if (!event || !event.response) {
    throw new Error("FORM_SUBMIT_EVENT_REQUIRED");
  }
  var values = TherapyOpsWorkspace.valuesFromFormResponse(event.response);
  var record = TherapyOpsWorkspace.getClientByInvitation(
    String(values.invitationCode || ""),
  );
  if (record.state !== "SUITABILITY_CONFIRMED") {
    throw new Error("INTAKE_NOT_EXPECTED_FOR_STATE:" + record.state);
  }

  var urgentSafetyReviewClear =
    values.immediateSafetyConcern === "No";
  if (!urgentSafetyReviewClear) {
    record.facts.intakeResponseId = event.response.getId();
    record.facts.urgentSafetyReviewClear = false;
    record.updatedAt = therapyOpsNow().toISOString();
    TherapyOpsWorkspace.saveClient(record);
    TherapyOpsWorkspace.appendAudit(
      TherapyOpsCore.auditEvent(
        record.clientId,
        "INTAKE_REQUIRES_REVIEW",
        "blocked",
        "system",
        {
          reasonCode: "urgent-safety-answer",
        },
        therapyOpsNow(),
      ),
    );
    return;
  }

  completeTherapyIntake(record, values, event.response.getId(), true);
}

function completeTherapyIntake(
  record,
  values,
  responseId,
  urgentSafetyReviewClear,
) {
  var provisioned = TherapyOpsWorkspace.provisionClientRecord(
    record,
    values,
    THERAPY_OPS_CATALOG,
  );
  var outcome = TherapyOpsCore.transition(
    THERAPY_OPS_CATALOG.workflow,
    provisioned,
    "INTAKE_RECEIVED",
    {
      intakeComplete: true,
      intakeResponseId: responseId,
      urgentSafetyReviewClear: urgentSafetyReviewClear === true,
    },
    "system",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(outcome.record);
  TherapyOpsWorkspace.appendAudit(outcome.audit);
  return outcome.record;
}

function recordTherapyAgreementSigned(clientId, evidence) {
  var record = TherapyOpsWorkspace.getClient(clientId);
  var outcome = TherapyOpsCore.transition(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "AGREEMENT_SIGNED",
    {
      agreementVersion: evidence.agreementVersion,
      agreementSignedAt: evidence.agreementSignedAt,
      privacyNoticeVersionAcknowledged:
        evidence.privacyNoticeVersionAcknowledged,
      captureScheduleVersionRecorded:
        evidence.captureScheduleVersionRecorded,
      transcriptionConsent: evidence.transcriptionConsent === true,
      approvedAiPurposes: evidence.approvedAiPurposes || [],
    },
    "practitioner",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(outcome.record);
  TherapyOpsWorkspace.appendAudit(outcome.audit);
  return outcome.record;
}

function recordTherapyPayment(clientId, payment) {
  var record = TherapyOpsWorkspace.getClient(clientId);
  var outcome = TherapyOpsCore.transition(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "PAYMENT_RECEIVED",
    {
      paymentReference: payment.paymentReference,
      paymentReceivedAt: payment.paymentReceivedAt,
      sessionsPurchased: payment.sessionsPurchased,
    },
    "practitioner",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(outcome.record);
  TherapyOpsWorkspace.appendAudit(outcome.audit);
  return outcome.record;
}

function createTherapySessionInvite(clientId, session) {
  if (session.practitionerApprovedToSend !== true) {
    throw new Error("PRACTITIONER_SEND_APPROVAL_REQUIRED");
  }
  var record = TherapyOpsWorkspace.getClient(clientId);
  if (record.state !== "PAYMENT_RECEIVED") {
    throw new Error("SESSION_INVITE_NOT_ALLOWED_FOR_STATE:" + record.state);
  }

  var requestId =
    clientId.replace(/[^A-Z0-9]/g, "") +
    "-" +
    therapyOpsRandomToken(8);
  var eventResource = {
    summary:
      THERAPY_OPS_CATALOG.service.workspace.calendarTitlePrefix +
      " " +
      clientId,
    start: {
      dateTime: session.startAt,
      timeZone: "Europe/London",
    },
    end: {
      dateTime: session.endAt,
      timeZone: "Europe/London",
    },
    attendees: [
      {
        email: session.clientEmail,
      },
    ],
    conferenceData: {
      createRequest: {
        requestId: requestId,
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
  };
  var event = Calendar.Events.insert(
    eventResource,
    session.calendarId || "primary",
    {
      conferenceDataVersion: 1,
      sendUpdates: "all",
    },
  );

  var outcome = TherapyOpsCore.transition(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "SESSION_READY",
    {
      sessionScheduledAt: session.startAt,
      fallbackPhoneConfirmed: session.fallbackPhoneConfirmed === true,
      remoteChecklistAcknowledged:
        session.remoteChecklistAcknowledged === true,
      firstCalendarEventId: event.id,
    },
    "practitioner",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(outcome.record);
  TherapyOpsWorkspace.appendAudit(outcome.audit);
  return {
    clientId: clientId,
    state: outcome.record.state,
    eventId: event.id,
    meetUrl: event.hangoutLink || "",
  };
}

function recordTherapyFirstSessionStarted(clientId, startedAt) {
  var record = TherapyOpsWorkspace.getClient(clientId);
  var outcome = TherapyOpsCore.transition(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "ACTIVE",
    {
      firstSessionStartedAt: startedAt,
    },
    "practitioner",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.saveClient(outcome.record);
  TherapyOpsWorkspace.appendAudit(outcome.audit);
  return outcome.record;
}

function recordTherapySessionCaptureCheck(check) {
  var record = TherapyOpsWorkspace.getClient(check.clientId);
  if (record.state !== "ACTIVE" && record.state !== "SESSION_READY") {
    throw new Error("CAPTURE_CHECK_NOT_ALLOWED_FOR_STATE:" + record.state);
  }
  if (
    check.transcriptionAllowedToday === true &&
    record.facts.transcriptionConsent !== true
  ) {
    throw new Error("TRANSCRIPTION_NOT_CONSENTED");
  }
  var allowedPurposes = record.facts.approvedAiPurposes || [];
  (check.approvedAiPurposes || []).forEach(function (purpose) {
    if (allowedPurposes.indexOf(purpose) < 0) {
      throw new Error("AI_PURPOSE_NOT_CONSENTED:" + purpose);
    }
  });
  TherapyOpsWorkspace.recordSessionCheck(check);
  record.facts.currentSessionCaptureCheck = true;
  record.facts.transcriptionAllowedToday =
    check.transcriptionAllowedToday === true;
  record.facts.consentVersion = check.consentVersion;
  record.facts.currentSessionId = check.sessionId;
  record.updatedAt = therapyOpsNow().toISOString();
  TherapyOpsWorkspace.saveClient(record);
  TherapyOpsWorkspace.appendAudit(
    TherapyOpsCore.auditEvent(
      record.clientId,
      "SESSION_CAPTURE_CHECK_RECORDED",
      "allowed",
      "practitioner",
      {
        consentVersion: check.consentVersion,
        sessionId: check.sessionId,
      },
      therapyOpsNow(),
    ),
  );
  return record;
}

function authorizeTherapyTranscription(clientId) {
  var record = TherapyOpsWorkspace.getClient(clientId);
  var result = TherapyOpsCore.authorizeAction(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "START_TRANSCRIPTION",
    {
      currentSessionCaptureCheck:
        record.facts.currentSessionCaptureCheck,
      transcriptionAllowedToday:
        record.facts.transcriptionAllowedToday,
      consentVersion: record.facts.consentVersion,
      sessionId: record.facts.currentSessionId,
    },
    "practitioner",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.appendAudit(result.audit);
  if (!result.allowed) {
    throw new Error("TRANSCRIPTION_BLOCKED:" + result.missing.join(","));
  }
  return result;
}

function attachTherapyTranscript(clientId, transcriptFileId) {
  var record = TherapyOpsWorkspace.getClient(clientId);
  var authorization = authorizeTherapyTranscription(clientId);
  if (!authorization.allowed) {
    throw new Error("TRANSCRIPT_ATTACHMENT_BLOCKED");
  }
  var file = DriveApp.getFileById(transcriptFileId);
  file.setName(
    clientId +
      " - " +
      record.facts.currentSessionId +
      " - Transcript",
  );
  file.moveTo(DriveApp.getFolderById(record.clinicalFolderId));
  record.facts.latestTranscriptFileId = transcriptFileId;
  record.updatedAt = therapyOpsNow().toISOString();
  TherapyOpsWorkspace.saveClient(record);
  TherapyOpsWorkspace.appendAudit(
    TherapyOpsCore.auditEvent(
      record.clientId,
      "TRANSCRIPT_ATTACHED",
      "allowed",
      "practitioner",
      {
        artifactType: "meet-transcript",
        consentVersion: record.facts.consentVersion,
        sessionId: record.facts.currentSessionId,
      },
      therapyOpsNow(),
    ),
  );
  return record;
}

function requestTherapyAiDraft(clientId, request) {
  var record = TherapyOpsWorkspace.getClient(clientId);
  var consentedPurposes = record.facts.approvedAiPurposes || [];
  var configuredProcessors =
    THERAPY_OPS_CATALOG.service.dataProtection.approvedAiProcessors || [];
  var approvedPurpose =
    consentedPurposes.indexOf(request.purpose) >= 0
      ? request.purpose
      : "";
  var approvedProcessor =
    configuredProcessors.indexOf(request.processorId) >= 0 &&
    request.processorId.indexOf("[") !== 0
      ? request.processorId
      : "";
  var authorization = TherapyOpsCore.authorizeAction(
    THERAPY_OPS_CATALOG.workflow,
    record,
    "PROCESS_WITH_AI",
    {
      approvedProcessor: approvedProcessor,
      approvedPurpose: approvedPurpose,
      captureScheduleVersion:
        record.facts.captureScheduleVersionRecorded,
      practitionerReviewRequired: true,
      consentVersion: record.facts.captureScheduleVersionRecorded,
      sessionId: request.sessionId,
    },
    "practitioner",
    therapyOpsNow(),
  );
  TherapyOpsWorkspace.appendAudit(authorization.audit);
  if (!authorization.allowed) {
    throw new Error("AI_PROCESSING_BLOCKED:" + authorization.missing.join(","));
  }
  var queuedRequest = {
    requestedAt: therapyOpsNow().toISOString(),
    clientId: clientId,
    sessionId: request.sessionId,
    processorId: request.processorId,
    purpose: request.purpose,
    sourceFileId: request.sourceFileId,
    status: "REVIEW_REQUIRED",
  };
  TherapyOpsWorkspace.recordAiRequest(queuedRequest);
  return queuedRequest;
}

function activateTherapyIntakeForm(releaseApproval) {
  var placeholders = TherapyOpsCore.findPlaceholderValues(
    THERAPY_OPS_CATALOG.service,
  );
  if (
    THERAPY_OPS_CATALOG.service.operationalStatus !==
    "APPROVED_FOR_REAL_CLIENT_USE"
  ) {
    throw new Error("REAL_CLIENT_USE_NOT_APPROVED");
  }
  if (placeholders.length > 0) {
    throw new Error("CONFIGURATION_PLACEHOLDERS_REMAIN:" + placeholders.join(","));
  }
  if (
    !releaseApproval ||
    releaseApproval.practitionerApproved !== true ||
    !releaseApproval.approvedAt ||
    !releaseApproval.commitSha
  ) {
    throw new Error("RELEASE_APPROVAL_REQUIRED");
  }
  var registry = TherapyOpsWorkspace.registry();
  var form = FormApp.openById(registry.intakeFormId);
  form.setAcceptingResponses(true);
  TherapyOpsWorkspace.appendAudit(
    TherapyOpsCore.auditEvent(
      "SYSTEM",
      "INTAKE_FORM_ACTIVATED",
      "allowed",
      "practitioner",
      {
        copyVersion: THERAPY_OPS_CATALOG.service.copyVersion,
      },
      therapyOpsNow(),
    ),
  );
  return {
    acceptingResponses: true,
    publishedUrl: form.getPublishedUrl(),
  };
}
