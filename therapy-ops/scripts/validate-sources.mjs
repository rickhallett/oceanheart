import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCatalog,
  collectLeafKeys,
  extractPlaceholders,
  listSourceFiles,
  therapyOpsRoot,
} from "./catalog-lib.mjs";

const runtimePlaceholders = new Set([
  "agreementDate",
  "clientFullName",
  "clientSignature",
  "clientSignatureDate",
  "consentRecordedBy",
  "practitionerSignature",
  "practitionerSignatureDate",
  "routineResponseTime",
  "unusedSessionTreatment",
]);

const errors = [];
const catalog = await buildCatalog();

function requireCondition(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

requireCondition(
  catalog.service.copyVersion === catalog.copy.manifest.version,
  "Service and copy-manifest versions must match.",
);
requireCondition(
  catalog.forms.intake.version === catalog.service.copyVersion,
  "Intake form and service copy versions must match.",
);
requireCondition(
  catalog.forms.sessionCaptureCheck.version === catalog.service.copyVersion,
  "Session check and service copy versions must match.",
);
requireCondition(
  catalog.service.operationalStatus !== "APPROVED_FOR_REAL_CLIENT_USE",
  "Draft sources must not silently approve real client use.",
);
requireCondition(
  catalog.service.workspace.collectCardDetails === false,
  "The workflow must not collect payment-card details.",
);
requireCondition(
  catalog.service.workspace.automaticallyStartTranscription === false,
  "Transcription must not start automatically.",
);
requireCondition(
  catalog.service.workspace.automaticallyShareClinicalRecords === false,
  "Clinical records must not be shared automatically.",
);

const documentIds = new Set();
const documentFiles = new Set();
const configKeys = collectLeafKeys(catalog.service);

for (const document of catalog.copy.documents) {
  requireCondition(
    !documentIds.has(document.id),
    `Duplicate document id: ${document.id}`,
  );
  requireCondition(
    !documentFiles.has(document.file),
    `Duplicate document file: ${document.file}`,
  );
  documentIds.add(document.id);
  documentFiles.add(document.file);

  for (const placeholder of extractPlaceholders(document.content)) {
    requireCondition(
      configKeys.has(placeholder) || runtimePlaceholders.has(placeholder),
      `${document.file} contains unknown placeholder {{${placeholder}}}.`,
    );
  }
}

const itemIds = new Set();
for (const section of catalog.forms.intake.sections) {
  for (const item of section.items) {
    requireCondition(
      !itemIds.has(item.id),
      `Duplicate intake item id: ${item.id}`,
    );
    itemIds.add(item.id);
  }
}

for (const requiredItem of [
  "invitationCode",
  "fullName",
  "dateOfBirth",
  "email",
  "phone",
  "gpPractice",
  "emergencyContactName",
  "immediateSafetyConcern",
  "notEmergencyService",
  "privacyNoticeAcknowledged",
]) {
  requireCondition(
    itemIds.has(requiredItem),
    `Required intake item is missing: ${requiredItem}`,
  );
}

const states = new Set(catalog.workflow.states);
for (const transition of catalog.workflow.transitions) {
  requireCondition(
    states.has(transition.from),
    `Unknown transition source state: ${transition.from}`,
  );
  requireCondition(
    states.has(transition.to),
    `Unknown transition destination state: ${transition.to}`,
  );
  requireCondition(
    transition.requires.length > 0,
    `Transition ${transition.from} to ${transition.to} has no gates.`,
  );
}

for (const file of await listSourceFiles()) {
  const content = await readFile(path.join(therapyOpsRoot, file), "utf8");
  requireCondition(!content.includes("\u2014"), `${file} contains U+2014.`);
}

if (errors.length > 0) {
  for (const error of errors) {
    process.stderr.write(`ERROR: ${error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Validated ${catalog.copy.documents.length} documents, ` +
      `${itemIds.size} intake items, and ` +
      `${catalog.workflow.transitions.length} transitions.\n`,
  );
}
