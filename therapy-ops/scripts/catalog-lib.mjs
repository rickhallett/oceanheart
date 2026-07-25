import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const therapyOpsRoot = path.resolve(scriptsDirectory, "..");

export async function readJson(relativePath) {
  const absolutePath = path.join(therapyOpsRoot, relativePath);
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

export async function readText(relativePath) {
  return readFile(path.join(therapyOpsRoot, relativePath), "utf8");
}

export async function buildCatalog() {
  const service = await readJson("config/service.json");
  const copyManifest = await readJson(
    `copy/${service.copyVersion}/manifest.json`,
  );
  const intakeForm = await readJson("forms/intake-form.json");
  const sessionCaptureCheck = await readJson(
    "forms/session-capture-check.json",
  );
  const clientWorkflow = await readJson("schemas/client-workflow.json");

  const documents = [];
  for (const entry of copyManifest.documents) {
    documents.push({
      ...entry,
      content: await readText(
        `copy/${service.copyVersion}/${entry.file}`,
      ),
    });
  }

  return {
    generatedSchemaVersion: 1,
    service,
    copy: {
      manifest: copyManifest,
      documents,
    },
    forms: {
      intake: intakeForm,
      sessionCaptureCheck,
    },
    workflow: clientWorkflow,
  };
}

export async function listSourceFiles() {
  const roots = ["config", "copy", "docs", "forms", "schemas"];
  const results = [];

  async function walk(relativeDirectory) {
    const entries = await readdir(path.join(therapyOpsRoot, relativeDirectory), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else {
        results.push(relativePath);
      }
    }
  }

  for (const root of roots) {
    await walk(root);
  }

  return results.sort();
}

export function collectLeafKeys(value, result = new Set()) {
  if (Array.isArray(value)) {
    return result;
  }
  if (!value || typeof value !== "object") {
    return result;
  }
  for (const [key, child] of Object.entries(value)) {
    if (
      child === null ||
      typeof child !== "object" ||
      Array.isArray(child)
    ) {
      result.add(key);
    } else {
      collectLeafKeys(child, result);
    }
  }
  return result;
}

export function extractPlaceholders(text) {
  const placeholders = new Set();
  for (const match of text.matchAll(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g)) {
    placeholders.add(match[1]);
  }
  return placeholders;
}
