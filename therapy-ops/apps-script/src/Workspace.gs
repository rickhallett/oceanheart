var TherapyOpsWorkspace = (function () {
  "use strict";

  var REGISTRY_KEY = "THERAPY_OPS_REGISTRY";
  var CLIENT_HEADERS = [
    "ClientId",
    "InvitationCode",
    "State",
    "CreatedAt",
    "UpdatedAt",
    "CopyVersion",
    "AdminFolderId",
    "ClinicalFolderId",
    "SharedFolderId",
    "AgreementDocId",
    "PrivacyDocId",
    "ConsentDocId",
    "ChecklistDocId",
    "SharedWorkspaceDocId",
    "FactsJson",
  ];
  var AUDIT_HEADERS = [
    "Timestamp",
    "ClientId",
    "Action",
    "Result",
    "ActorType",
    "DetailsJson",
  ];
  var SESSION_CHECK_HEADERS = [
    "CheckedAt",
    "ClientId",
    "SessionId",
    "ConsentVersion",
    "TranscriptionAllowedToday",
    "ApprovedAiPurposesJson",
    "CheckedBy",
  ];
  var AI_REQUEST_HEADERS = [
    "RequestedAt",
    "ClientId",
    "SessionId",
    "ProcessorId",
    "Purpose",
    "SourceFileId",
    "Status",
  ];

  function scriptProperties() {
    return PropertiesService.getScriptProperties();
  }

  function registry() {
    var value = scriptProperties().getProperty(REGISTRY_KEY);
    if (!value) {
      throw new Error("THERAPY_OPS_NOT_SETUP");
    }
    return JSON.parse(value);
  }

  function saveRegistry(value) {
    scriptProperties().setProperty(REGISTRY_KEY, JSON.stringify(value));
  }

  function moveFile(fileId, folder) {
    DriveApp.getFileById(fileId).moveTo(folder);
  }

  function createFolder(parent, name) {
    var existing = parent.getFoldersByName(name);
    return existing.hasNext() ? existing.next() : parent.createFolder(name);
  }

  function getOrCreateSheet(spreadsheet, name, headers) {
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
    return sheet;
  }

  function createSystemSpreadsheet(systemFolder) {
    var spreadsheet = SpreadsheetApp.create("Therapy Operations System");
    moveFile(spreadsheet.getId(), systemFolder);
    var firstSheet = spreadsheet.getSheets()[0];
    firstSheet.setName("Clients");
    firstSheet.appendRow(CLIENT_HEADERS);
    firstSheet.setFrozenRows(1);
    firstSheet
      .getRange(1, 1, 1, CLIENT_HEADERS.length)
      .setFontWeight("bold");
    getOrCreateSheet(spreadsheet, "Audit", AUDIT_HEADERS);
    getOrCreateSheet(
      spreadsheet,
      "Session Checks",
      SESSION_CHECK_HEADERS,
    );
    getOrCreateSheet(spreadsheet, "AI Requests", AI_REQUEST_HEADERS);
    getOrCreateSheet(spreadsheet, "Configuration", [
      "Key",
      "Value",
    ]);
    getOrCreateSheet(spreadsheet, "Copy Versions", [
      "Version",
      "Status",
      "EffectiveDate",
    ]);
    return spreadsheet;
  }

  function createIntakeResponseSpreadsheet(systemFolder) {
    var spreadsheet = SpreadsheetApp.create(
      "Therapy Intake Responses - Restricted",
    );
    moveFile(spreadsheet.getId(), systemFolder);
    return spreadsheet;
  }

  function appendMarkdown(body, markdown) {
    var lines = markdown.split(/\r?\n/);
    lines.forEach(function (line) {
      if (line.indexOf("# ") === 0) {
        body
          .appendParagraph(line.slice(2))
          .setHeading(DocumentApp.ParagraphHeading.TITLE);
      } else if (line.indexOf("## ") === 0) {
        body
          .appendParagraph(line.slice(3))
          .setHeading(DocumentApp.ParagraphHeading.HEADING1);
      } else if (line.indexOf("### ") === 0) {
        body
          .appendParagraph(line.slice(4))
          .setHeading(DocumentApp.ParagraphHeading.HEADING2);
      } else if (line.indexOf("- [ ] ") === 0) {
        body
          .appendListItem("☐ " + line.slice(6))
          .setGlyphType(DocumentApp.GlyphType.BULLET);
      } else if (line.indexOf("- ") === 0) {
        body
          .appendListItem(line.slice(2))
          .setGlyphType(DocumentApp.GlyphType.BULLET);
      } else if (/^\d+\. /.test(line)) {
        body
          .appendListItem(line.replace(/^\d+\. /, ""))
          .setGlyphType(DocumentApp.GlyphType.NUMBER);
      } else {
        body.appendParagraph(line);
      }
    });
  }

  function createTemplateDocuments(templateFolder, catalog) {
    var ids = {};
    var baseValues = catalog.service;
    catalog.copy.documents.forEach(function (definition) {
      var document = DocumentApp.create(
        catalog.service.serviceName + " - " + definition.id,
      );
      var body = document.getBody();
      body.clear();
      appendMarkdown(
        body,
        TherapyOpsCore.renderTemplate(
          definition.content,
          baseValues,
          false,
        ),
      );
      document.saveAndClose();
      moveFile(document.getId(), templateFolder);
      ids[definition.id] = document.getId();
    });
    return ids;
  }

  function createFormItem(form, definition, itemMap) {
    var item;
    if (
      definition.type === "text" ||
      definition.type === "email" ||
      definition.type === "phone"
    ) {
      item = form.addTextItem();
    } else if (definition.type === "date") {
      item = form.addDateItem();
    } else if (definition.type === "paragraph") {
      item = form.addParagraphTextItem();
    } else if (definition.type === "multiple-choice") {
      item = form.addMultipleChoiceItem();
      item.setChoiceValues(definition.options);
    } else if (definition.type === "checkboxes") {
      item = form.addCheckboxItem();
      item.setChoiceValues(definition.options);
    } else if (definition.type === "checkbox") {
      item = form.addCheckboxItem();
      item.setChoiceValues(["I confirm"]);
    } else {
      throw new Error("UNSUPPORTED_FORM_ITEM_TYPE:" + definition.type);
    }
    item.setTitle(definition.label);
    item.setRequired(Boolean(definition.required));
    if (definition.helpText) {
      item.setHelpText(definition.helpText);
    }
    itemMap[String(item.getId())] = definition.id;
    return item;
  }

  function createIntakeForm(systemFolder, responseSpreadsheet, definition) {
    var form = FormApp.create(definition.title);
    moveFile(form.getId(), systemFolder);
    form.setDescription(definition.description);
    form.setCollectEmail(Boolean(definition.settings.collectEmail));
    form.setLimitOneResponsePerUser(
      Boolean(definition.settings.limitToOneResponse),
    );
    form.setAllowResponseEdits(
      Boolean(definition.settings.allowResponseEdits),
    );
    form.setPublishingSummary(
      Boolean(definition.settings.showResponseSummary),
    );
    form.setShowLinkToRespondAgain(false);
    form.setConfirmationMessage(
      "Thank you. Your information has been received. " +
        "This form is not monitored as an emergency service.",
    );

    var itemMap = {};
    definition.sections.forEach(function (section, sectionIndex) {
      if (sectionIndex > 0) {
        form.addPageBreakItem().setTitle(section.title);
      } else {
        form.addSectionHeaderItem().setTitle(section.title);
      }
      section.items.forEach(function (item) {
        createFormItem(form, item, itemMap);
      });
    });

    form.setDestination(
      FormApp.DestinationType.SPREADSHEET,
      responseSpreadsheet.getId(),
    );
    form.setAcceptingResponses(false);
    return {
      form: form,
      itemMap: itemMap,
    };
  }

  function setup(catalog) {
    var existing = scriptProperties().getProperty(REGISTRY_KEY);
    if (existing) {
      return JSON.parse(existing);
    }

    var root = DriveApp.createFolder(
      catalog.service.workspace.rootFolderName + " - Draft",
    );
    var systemFolder = createFolder(root, "00 System");
    var templateFolder = createFolder(root, "01 Templates");
    var clientsFolder = createFolder(root, "02 Clients");
    var archiveFolder = createFolder(root, "03 Archive");

    var systemSpreadsheet = createSystemSpreadsheet(systemFolder);
    var responseSpreadsheet = createIntakeResponseSpreadsheet(systemFolder);
    var templateIds = createTemplateDocuments(templateFolder, catalog);
    var formResult = createIntakeForm(
      systemFolder,
      responseSpreadsheet,
      catalog.forms.intake,
    );

    var configurationSheet = systemSpreadsheet.getSheetByName(
      "Configuration",
    );
    configurationSheet.appendRow([
      "serviceConfigJson",
      JSON.stringify(catalog.service),
    ]);
    systemSpreadsheet.getSheetByName("Copy Versions").appendRow([
      catalog.copy.manifest.version,
      catalog.copy.manifest.status,
      catalog.copy.manifest.effectiveDate,
    ]);

    var value = {
      schemaVersion: 1,
      rootFolderId: root.getId(),
      systemFolderId: systemFolder.getId(),
      templateFolderId: templateFolder.getId(),
      clientsFolderId: clientsFolder.getId(),
      archiveFolderId: archiveFolder.getId(),
      systemSpreadsheetId: systemSpreadsheet.getId(),
      intakeResponseSpreadsheetId: responseSpreadsheet.getId(),
      intakeFormId: formResult.form.getId(),
      intakeFormPublishedUrl: formResult.form.getPublishedUrl(),
      intakeFormItemMap: formResult.itemMap,
      templateIds: templateIds,
      copyVersion: catalog.service.copyVersion,
      operationalStatus: catalog.service.operationalStatus,
    };
    saveRegistry(value);

    ScriptApp.newTrigger("handleTherapyIntakeSubmit")
      .forForm(formResult.form)
      .onFormSubmit()
      .create();

    return value;
  }

  function systemSpreadsheet() {
    return SpreadsheetApp.openById(registry().systemSpreadsheetId);
  }

  function clientsSheet() {
    return systemSpreadsheet().getSheetByName("Clients");
  }

  function auditSheet() {
    return systemSpreadsheet().getSheetByName("Audit");
  }

  function rowToClient(row) {
    return {
      clientId: row[0],
      invitationCode: row[1],
      state: row[2],
      createdAt: row[3],
      updatedAt: row[4],
      copyVersion: row[5],
      adminFolderId: row[6] || "",
      clinicalFolderId: row[7] || "",
      sharedFolderId: row[8] || "",
      agreementDocId: row[9] || "",
      privacyDocId: row[10] || "",
      consentDocId: row[11] || "",
      checklistDocId: row[12] || "",
      sharedWorkspaceDocId: row[13] || "",
      facts: row[14] ? JSON.parse(row[14]) : {},
    };
  }

  function clientToRow(record) {
    return [
      record.clientId,
      record.invitationCode,
      record.state,
      record.createdAt,
      record.updatedAt,
      record.copyVersion,
      record.adminFolderId || "",
      record.clinicalFolderId || "",
      record.sharedFolderId || "",
      record.agreementDocId || "",
      record.privacyDocId || "",
      record.consentDocId || "",
      record.checklistDocId || "",
      record.sharedWorkspaceDocId || "",
      JSON.stringify(record.facts || {}),
    ];
  }

  function findClientRow(fieldIndex, value) {
    var sheet = clientsSheet();
    var values = sheet.getDataRange().getValues();
    for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      if (String(values[rowIndex][fieldIndex]) === String(value)) {
        return {
          sheet: sheet,
          rowNumber: rowIndex + 1,
          record: rowToClient(values[rowIndex]),
        };
      }
    }
    return null;
  }

  function getClient(clientId) {
    var result = findClientRow(0, clientId);
    if (!result) {
      throw new Error("CLIENT_NOT_FOUND:" + clientId);
    }
    return result.record;
  }

  function getClientByInvitation(invitationCode) {
    var result = findClientRow(1, invitationCode);
    if (!result) {
      throw new Error("INVITATION_NOT_FOUND");
    }
    return result.record;
  }

  function saveClient(record) {
    var result = findClientRow(0, record.clientId);
    if (!result) {
      clientsSheet().appendRow(clientToRow(record));
    } else {
      result.sheet
        .getRange(result.rowNumber, 1, 1, CLIENT_HEADERS.length)
        .setValues([clientToRow(record)]);
    }
    return record;
  }

  function appendAudit(event) {
    auditSheet().appendRow([
      event.timestamp,
      event.clientId,
      event.action,
      event.result,
      event.actorType,
      JSON.stringify(event.details),
    ]);
    return event;
  }

  function valuesFromFormResponse(formResponse) {
    var itemMap = registry().intakeFormItemMap;
    var result = {};
    formResponse.getItemResponses().forEach(function (itemResponse) {
      var itemId = String(itemResponse.getItem().getId());
      var fieldId = itemMap[itemId];
      if (fieldId) {
        result[fieldId] = itemResponse.getResponse();
      }
    });
    return result;
  }

  function invitationItem() {
    var intakeForm = FormApp.openById(registry().intakeFormId);
    var itemMap = registry().intakeFormItemMap;
    var items = intakeForm.getItems();
    for (var index = 0; index < items.length; index += 1) {
      if (itemMap[String(items[index].getId())] === "invitationCode") {
        return items[index].asTextItem();
      }
    }
    throw new Error("INVITATION_ITEM_NOT_FOUND");
  }

  function prefilledIntakeUrl(invitationCode) {
    var form = FormApp.openById(registry().intakeFormId);
    return form
      .createResponse()
      .withItemResponse(invitationItem().createResponse(invitationCode))
      .toPrefilledUrl();
  }

  function clientFolder(clientId) {
    return createFolder(
      DriveApp.getFolderById(registry().clientsFolderId),
      clientId,
    );
  }

  function replaceDocumentPlaceholders(documentId, values) {
    var document = DocumentApp.openById(documentId);
    var body = document.getBody();
    Object.keys(values).forEach(function (key) {
      var value = values[key];
      var replacement =
        value === null || value === undefined ? "" : String(value);
      body.replaceText(
        "\\{\\{" + key + "\\}\\}",
        replacement.replace(/\$/g, "$$$$"),
      );
    });
    document.saveAndClose();
  }

  function copyTemplate(templateId, name, folder, values) {
    var copy = DriveApp.getFileById(templateId).makeCopy(name, folder);
    replaceDocumentPlaceholders(copy.getId(), values);
    return copy.getId();
  }

  function createSharedWorkspace(clientId, sharedFolder) {
    var document = DocumentApp.create(
      clientId + " - Collaborative workspace",
    );
    var body = document.getBody();
    body.clear();
    body
      .appendParagraph("Collaborative therapy workspace")
      .setHeading(DocumentApp.ParagraphHeading.TITLE);
    body.appendParagraph(
      "This workspace contains material deliberately agreed for client access. " +
        "It is not the complete clinical record.",
    );
    body
      .appendParagraph("What matters now")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph("");
    body
      .appendParagraph("Shared working map")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph("");
    body
      .appendParagraph("Experiments and practice")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph("");
    body
      .appendParagraph("Review")
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph("");
    document.saveAndClose();
    moveFile(document.getId(), sharedFolder);
    return document.getId();
  }

  function provisionClientRecord(record, intakeValues, catalog) {
    if (record.adminFolderId) {
      return record;
    }
    var root = clientFolder(record.clientId);
    var admin = createFolder(root, "Admin");
    var clinical = createFolder(root, "Clinical");
    var shared = createFolder(root, "Shared");
    var templateIds = registry().templateIds;
    var runtimeValues = Object.assign({}, catalog.service, {
      agreementDate: "",
      clientFullName: intakeValues.fullName,
      clientSignature: "",
      clientSignatureDate: "",
      consentRecordedBy: "",
      practitionerSignature: "",
      practitionerSignatureDate: "",
      routineResponseTime: "[ROUTINE_RESPONSE_TIME]",
      unusedSessionTreatment: "[UNUSED_SESSION_TREATMENT]",
    });

    record.adminFolderId = admin.getId();
    record.clinicalFolderId = clinical.getId();
    record.sharedFolderId = shared.getId();
    record.agreementDocId = copyTemplate(
      templateIds["therapy-agreement"],
      record.clientId + " - Therapy agreement",
      admin,
      runtimeValues,
    );
    record.privacyDocId = copyTemplate(
      templateIds["privacy-notice"],
      record.clientId + " - Privacy notice",
      admin,
      runtimeValues,
    );
    record.consentDocId = copyTemplate(
      templateIds["transcription-ai-schedule"],
      record.clientId + " - Transcription and AI schedule",
      admin,
      runtimeValues,
    );
    record.checklistDocId = copyTemplate(
      templateIds["remote-session-checklist"],
      record.clientId + " - Remote-session checklist",
      admin,
      runtimeValues,
    );
    record.sharedWorkspaceDocId = createSharedWorkspace(
      record.clientId,
      shared,
    );
    return record;
  }

  function recordSessionCheck(check) {
    systemSpreadsheet().getSheetByName("Session Checks").appendRow([
      check.checkedAt,
      check.clientId,
      check.sessionId,
      check.consentVersion,
      check.transcriptionAllowedToday,
      JSON.stringify(check.approvedAiPurposes || []),
      check.checkedBy,
    ]);
  }

  function recordAiRequest(request) {
    systemSpreadsheet().getSheetByName("AI Requests").appendRow([
      request.requestedAt,
      request.clientId,
      request.sessionId,
      request.processorId,
      request.purpose,
      request.sourceFileId,
      request.status,
    ]);
  }

  return {
    appendAudit: appendAudit,
    getClient: getClient,
    getClientByInvitation: getClientByInvitation,
    prefilledIntakeUrl: prefilledIntakeUrl,
    provisionClientRecord: provisionClientRecord,
    recordAiRequest: recordAiRequest,
    recordSessionCheck: recordSessionCheck,
    registry: registry,
    saveClient: saveClient,
    setup: setup,
    valuesFromFormResponse: valuesFromFormResponse,
  };
})();
