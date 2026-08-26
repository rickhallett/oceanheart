import { loadCore, loadMain } from "./load-apps-script.mjs";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function errorCode(callback) {
  try {
    callback();
    return "NOT_BLOCKED";
  } catch (error) {
    return String(error.message);
  }
}

function createFakeWorkspace() {
  const clients = new Map();
  const audits = [];
  const sessionChecks = [];
  const aiRequests = [];
  const provisioned = [];
  const registry = {
    intakeFormId: "synthetic-form",
    clientsFolderId: "synthetic-clients-folder",
  };

  return {
    clients,
    audits,
    sessionChecks,
    aiRequests,
    provisioned,
    setup() {
      return {
        rootFolderId: "synthetic-root-folder",
        intakeFormId: registry.intakeFormId,
        acceptingResponses: false,
      };
    },
    saveClient(record) {
      clients.set(record.clientId, clone(record));
      return clone(record);
    },
    getClient(clientId) {
      const record = clients.get(clientId);
      if (!record) {
        throw new Error(`CLIENT_NOT_FOUND:${clientId}`);
      }
      return clone(record);
    },
    getClientByInvitation(invitationCode) {
      for (const record of clients.values()) {
        if (record.invitationCode === invitationCode) {
          return clone(record);
        }
      }
      throw new Error("INVITATION_NOT_FOUND");
    },
    appendAudit(event) {
      audits.push(clone(event));
      return clone(event);
    },
    prefilledIntakeUrl(invitationCode) {
      return `https://forms.example.test/intake?invite=${invitationCode}`;
    },
    valuesFromFormResponse(response) {
      return clone(response.values);
    },
    provisionClientRecord(record) {
      const provisionedRecord = {
        ...clone(record),
        adminFolderId: `${record.clientId}-admin`,
        clinicalFolderId: `${record.clientId}-clinical`,
        sharedFolderId: `${record.clientId}-shared`,
        agreementDocId: `${record.clientId}-agreement`,
        privacyDocId: `${record.clientId}-privacy`,
        consentDocId: `${record.clientId}-consent`,
        checklistDocId: `${record.clientId}-checklist`,
        sharedWorkspaceDocId: `${record.clientId}-workspace`,
      };
      provisioned.push(record.clientId);
      return provisionedRecord;
    },
    recordSessionCheck(check) {
      sessionChecks.push(clone(check));
    },
    recordAiRequest(request) {
      aiRequests.push(clone(request));
    },
    registry() {
      return clone(registry);
    },
  };
}

function createFakeDrive() {
  const files = new Map();
  let copySequence = 0;

  function file(fileId) {
    if (!files.has(fileId)) {
      files.set(fileId, {
        id: fileId,
        name: fileId,
        folderId: "",
      });
    }
    const state = files.get(fileId);
    return {
      setName(name) {
        state.name = name;
        return this;
      },
      moveTo(folder) {
        state.folderId = folder.id;
        return this;
      },
      makeCopy(name, folder) {
        copySequence += 1;
        const copyId = `synthetic-copy-${copySequence}`;
        files.set(copyId, {
          id: copyId,
          name,
          folderId: folder.id,
        });
        return file(copyId);
      },
      getId() {
        return state.id;
      },
    };
  }

  return {
    files,
    api: {
      getFileById: file,
      getFolderById(folderId) {
        return {
          id: folderId,
        };
      },
    },
  };
}

export async function runSyntheticScenario() {
  const context = await loadCore();
  const workspace = createFakeWorkspace();
  const drive = createFakeDrive();
  const calendarEvents = [];
  const uuidValues = [
    "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA",
    "BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB",
    "CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC",
  ];
  let uuidIndex = 0;
  let clockTick = 0;

  context.THERAPY_OPS_CATALOG.service.dataProtection.approvedAiProcessors = [
    "synthetic-private-ai",
  ];
  context.TherapyOpsWorkspace = workspace;
  context.Utilities = {
    getUuid() {
      const value = uuidValues[uuidIndex] || uuidValues.at(-1);
      uuidIndex += 1;
      return value;
    },
  };
  context.Calendar = {
    Events: {
      insert(resource) {
        calendarEvents.push(clone(resource));
        return {
          id: "synthetic-calendar-event",
          hangoutLink: "https://meet.example.test/synthetic-session",
        };
      },
    },
  };
  context.DriveApp = drive.api;
  context.FormApp = {
    openById() {
      return {
        setAcceptingResponses() {},
        getPublishedUrl() {
          return "https://forms.example.test/intake";
        },
      };
    },
  };
  await loadMain(context);
  context.therapyOpsNow = function () {
    const value = new Date(
      Date.parse("2030-01-01T09:00:00.000Z") + clockTick * 1000,
    );
    clockTick += 1;
    return value;
  };

  const setup = context.setupTherapyOpsDraft();
  const enquiry = context.createTherapyEnquiry();
  const clientId = enquiry.clientId;
  const invitationCode = workspace.clients.get(clientId).invitationCode;

  const blockedSuitability = errorCode(() =>
    context.confirmTherapySuitability(clientId, {
      manualSuitabilityDecision: true,
      ukAdultRemoteScopeConfirmed: false,
    }),
  );

  const suitability = context.confirmTherapySuitability(clientId, {
    manualSuitabilityDecision: true,
    ukAdultRemoteScopeConfirmed: true,
  });

  const formResponse = {
    values: {
      invitationCode,
      fullName: "Synthetic Client",
      immediateSafetyConcern: "No",
    },
    getId() {
      return "synthetic-form-response";
    },
  };
  context.handleTherapyIntakeSubmit({
    response: formResponse,
  });

  context.recordTherapyAgreementSigned(clientId, {
    agreementVersion: "v0.1.0",
    agreementSignedAt: "2030-01-02T09:00:00.000Z",
    privacyNoticeVersionAcknowledged: "v0.1.0",
    captureScheduleVersionRecorded: "v0.1.0",
    transcriptionConsent: true,
    approvedAiPurposes: [
      "provisional-formulation",
      "client-visible-material",
    ],
  });

  context.recordTherapyPayment(clientId, {
    paymentReference: "SYNTHETIC-PAYMENT",
    paymentReceivedAt: "2030-01-03T09:00:00.000Z",
    sessionsPurchased: 4,
  });

  const unapprovedInvite = errorCode(() =>
    context.createTherapySessionInvite(clientId, {
      practitionerApprovedToSend: false,
    }),
  );
  const incompleteInvite = errorCode(() =>
    context.createTherapySessionInvite(clientId, {
      practitionerApprovedToSend: true,
      startAt: "2030-01-04T10:00:00.000Z",
      endAt: "2030-01-04T10:50:00.000Z",
      clientEmail: "synthetic.client@example.test",
      fallbackPhoneConfirmed: false,
      remoteChecklistAcknowledged: true,
    }),
  );
  const eventCountBeforeValidInvite = calendarEvents.length;
  const sessionInvite = context.createTherapySessionInvite(clientId, {
    practitionerApprovedToSend: true,
    startAt: "2030-01-04T10:00:00.000Z",
    endAt: "2030-01-04T10:50:00.000Z",
    clientEmail: "synthetic.client@example.test",
    fallbackPhoneConfirmed: true,
    remoteChecklistAcknowledged: true,
  });
  context.recordTherapyFirstSessionStarted(
    clientId,
    "2030-01-04T10:00:00.000Z",
  );

  const unconsentedPurpose = errorCode(() =>
    context.recordTherapySessionCaptureCheck({
      clientId,
      sessionId: "SESSION-001",
      consentVersion: "v0.1.0",
      transcriptionAllowedToday: true,
      approvedAiPurposes: ["report-or-letter-drafting"],
      checkedBy: "practitioner",
      checkedAt: "2030-01-04T10:00:00.000Z",
    }),
  );
  context.recordTherapySessionCaptureCheck({
    clientId,
    sessionId: "SESSION-001",
    consentVersion: "v0.1.0",
    transcriptionAllowedToday: true,
    approvedAiPurposes: [
      "provisional-formulation",
      "client-visible-material",
    ],
    checkedBy: "practitioner",
    checkedAt: "2030-01-04T10:00:00.000Z",
  });
  context.authorizeTherapyTranscription(clientId);
  context.attachTherapyTranscript(clientId, "synthetic-transcript");

  const unapprovedProcessor = errorCode(() =>
    context.requestTherapyAiDraft(clientId, {
      sessionId: "SESSION-001",
      processorId: "unapproved-ai",
      purpose: "provisional-formulation",
      sourceFileId: "synthetic-transcript",
    }),
  );
  const aiRequest = context.requestTherapyAiDraft(clientId, {
    sessionId: "SESSION-001",
    processorId: "synthetic-private-ai",
    purpose: "provisional-formulation",
    sourceFileId: "synthetic-transcript",
  });

  drive.api.getFileById("synthetic-clinical-draft");
  const unapprovedSharedCopy = errorCode(() =>
    context.approveTherapySharedFile(clientId, {
      sourceFileId: "synthetic-clinical-draft",
      clientVisibleTitle: "Working map",
      artifactType: "working-map",
      practitionerApprovedForSharing: false,
    }),
  );
  const sharedCopy = context.approveTherapySharedFile(clientId, {
    sourceFileId: "synthetic-clinical-draft",
    clientVisibleTitle: "Working map",
    artifactType: "working-map",
    practitionerApprovedForSharing: true,
  });

  context.beginTherapyClosure(clientId, {
    closureReason: "synthetic-completion",
    closureReviewScheduled: "2030-02-01T10:00:00.000Z",
  });
  const closed = context.completeTherapyClosure(clientId, {
    sharedMaterialDisposition: "synthetic-export-reviewed",
    invoiceBalanceReviewed: true,
    retentionReviewDatesSet: true,
    closureApprovedByPractitioner: true,
  });
  const earlyDeletion = context.reviewTherapyRecordDeletion(clientId, {
    retentionDateReached: false,
    noActiveHold: true,
    practitionerDeletionApproval: true,
  });
  const reviewedDeletion = context.reviewTherapyRecordDeletion(clientId, {
    retentionDateReached: true,
    noActiveHold: true,
    practitionerDeletionApproval: true,
  });

  const activationBlocked = errorCode(() =>
    context.activateTherapyIntakeForm({
      practitionerApproved: true,
      approvedAt: "2030-01-01T09:00:00.000Z",
      commitSha: "synthetic",
    }),
  );

  const auditText = JSON.stringify(workspace.audits);
  const proof = {
    schemaVersion: 1,
    dataClassification: "SYNTHETIC_ONLY",
    copyVersion: "v0.1.0",
    externalCallsPerformed: false,
    finalState: closed.state,
    setup: {
      acceptingResponses: setup.acceptingResponses,
      rootFolderId: setup.rootFolderId,
    },
    artifacts: {
      provisionedClientRecords: workspace.provisioned.length,
      sessionChecks: workspace.sessionChecks.length,
      aiRequests: workspace.aiRequests.length,
      calendarEvents: calendarEvents.length,
      clientVisibleCopies: sharedCopy.copiedFileId ? 1 : 0,
      transcriptFolder:
        drive.files.get("synthetic-transcript").folderId,
    },
    blockedOperations: {
      suitabilityWithoutScope: blockedSuitability,
      inviteWithoutApproval: unapprovedInvite,
      inviteWithoutCompleteGates: incompleteInvite,
      unconsentedAiPurpose: unconsentedPurpose,
      unapprovedAiProcessor: unapprovedProcessor,
      sharedCopyWithoutApproval: unapprovedSharedCopy,
      realIntakeActivation: activationBlocked,
    },
    verifiedInvariants: {
      incompleteInviteSentNoCalendarEvent:
        eventCountBeforeValidInvite === 0,
      validInviteCreatedMeetLink:
        sessionInvite.meetUrl ===
        "https://meet.example.test/synthetic-session",
      aiOutputRequiresReview:
        aiRequest.status === "REVIEW_REQUIRED",
      clientVisibleCopyNotSharedExternally:
        sharedCopy.sharedExternally === false,
      earlyDeletionBlocked:
        earlyDeletion.authorized === false &&
        earlyDeletion.deletionPerformed === false,
      deletionNeverAutomatic:
        reviewedDeletion.authorized === true &&
        reviewedDeletion.deletionPerformed === false,
      auditExcludesSyntheticName:
        !auditText.includes("Synthetic Client"),
      auditExcludesSyntheticEmail:
        !auditText.includes("synthetic.client@example.test"),
    },
    audit: {
      eventCount: workspace.audits.length,
      actions: workspace.audits.map((event) => event.action),
    },
    clientId,
    intakeLinkWasPrefilled:
      suitability.intakeUrl.includes(invitationCode),
  };

  return {
    proof,
    workspace,
    drive,
    calendarEvents,
  };
}
