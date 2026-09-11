import { createHash } from "node:crypto";
import type { ProvisionManifest } from "./types.ts";

const fullSha = /^[0-9a-f]{40}$/;
const sha256Digest = /^sha256:[0-9a-f]{64}$/;
const clientIdPattern = /^c[0-9]{4,}$/;
const safeName = /^[a-z0-9][a-z0-9-]{1,62}$/;
const exactVersion = /^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const placeholder = /<[^>]+>|\b(?:todo|tbd|replace-me|changeme)\b/i;
const secretMaterial =
  /-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]+|\bgh[pousr]_[A-Za-z0-9]+|\bgithub_pat_[A-Za-z0-9_]+|\bwhsec_[A-Za-z0-9]+|\bBearer\s+[A-Za-z0-9._~-]+/;

export class ManifestValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid provision manifest:\n- ${issues.join("\n- ")}`);
    this.name = "ManifestValidationError";
    this.issues = issues;
  }
}

function record(value: unknown, path: string, issues: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    issues.push(`${path} must be an object`);
    return undefined;
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown> | undefined,
  allowed: readonly string[],
  path: string,
  issues: string[],
) {
  if (!value) return;
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push(`${path}.${key} is not allowed`);
  }
  for (const key of allowed) {
    if (!(key in value)) issues.push(`${path}.${key} is required`);
  }
}

function text(
  value: unknown,
  path: string,
  issues: string[],
  pattern?: RegExp,
) {
  if (typeof value !== "string" || !value.trim()) {
    issues.push(`${path} must be a non-empty string`);
    return "";
  }
  const result = value.trim();
  if (result.includes("\0") || /[\r\n]/.test(result))
    issues.push(`${path} must be one line`);
  if (placeholder.test(result)) issues.push(`${path} contains a placeholder`);
  if (secretMaterial.test(result)) issues.push(`${path} contains secret material`);
  if (pattern && !pattern.test(result)) issues.push(`${path} has an invalid format`);
  return result;
}

function nullableText(
  value: unknown,
  path: string,
  issues: string[],
  pattern: RegExp,
) {
  return value === null ? null : text(value, path, issues, pattern);
}

function integer(
  value: unknown,
  path: string,
  issues: string[],
  minimum: number,
  maximum: number,
) {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    issues.push(`${path} must be an integer from ${minimum} to ${maximum}`);
    return minimum;
  }
  return value as number;
}

function secretReference(
  value: unknown,
  clientId: string,
  path: string,
  issues: string[],
) {
  const result = text(value, path, issues);
  if (!result.startsWith(`secretref://${clientId}/`))
    issues.push(`${path} must be scoped to ${clientId}`);
  if (result.includes("..")) issues.push(`${path} cannot contain path traversal`);
  return result;
}

export function validateManifest(value: unknown): ProvisionManifest {
  const issues: string[] = [];
  const root = record(value, "manifest", issues);
  exactKeys(
    root,
    [
      "schemaVersion",
      "clientId",
      "mode",
      "template",
      "code",
      "runtime",
      "harness",
      "configuration",
      "data",
      "credentials",
      "limits",
      "evaluationSet",
    ],
    "manifest",
    issues,
  );

  const clientId = text(root?.clientId, "manifest.clientId", issues, clientIdPattern);
  if (root?.schemaVersion !== 1) issues.push("manifest.schemaVersion must equal 1");
  if (root?.mode !== "synthetic") issues.push("manifest.mode must equal synthetic");

  const template = record(root?.template, "manifest.template", issues);
  exactKeys(template, ["version", "sourceSha"], "manifest.template", issues);
  const code = record(root?.code, "manifest.code", issues);
  exactKeys(code, ["repository", "releaseSha"], "manifest.code", issues);
  const runtime = record(root?.runtime, "manifest.runtime", issues);
  exactKeys(
    runtime,
    [
      "provider",
      "region",
      "runtimeName",
      "developmentName",
      "vmId",
      "artifactDigest",
    ],
    "manifest.runtime",
    issues,
  );
  const harness = record(root?.harness, "manifest.harness", issues);
  exactKeys(harness, ["kind", "version", "profile"], "manifest.harness", issues);
  const configuration = record(root?.configuration, "manifest.configuration", issues);
  exactKeys(
    configuration,
    ["instructionsVersion", "toolsetVersion", "modelProfile"],
    "manifest.configuration",
    issues,
  );
  const data = record(root?.data, "manifest.data", issues);
  exactKeys(data, ["backendRef", "retrievalRef"], "manifest.data", issues);
  const credentials = record(root?.credentials, "manifest.credentials", issues);
  exactKeys(credentials, ["model", "mail"], "manifest.credentials", issues);
  const limits = record(root?.limits, "manifest.limits", issues);
  exactKeys(
    limits,
    ["maxConcurrentRuns", "maxRunSeconds", "maxToolCalls"],
    "manifest.limits",
    issues,
  );

  const repository = text(
    code?.repository,
    "manifest.code.repository",
    issues,
    repositoryPattern,
  );
  if (clientId && repository && !repository.endsWith(`/studio-${clientId}`))
    issues.push("manifest.code.repository must end with the scoped client repository name");

  const runtimeName = text(runtime?.runtimeName, "manifest.runtime.runtimeName", issues, safeName);
  const developmentName = text(
    runtime?.developmentName,
    "manifest.runtime.developmentName",
    issues,
    safeName,
  );
  if (clientId && runtimeName && runtimeName !== `studio-${clientId}-runtime`)
    issues.push("manifest.runtime.runtimeName must use the scoped client runtime name");
  if (clientId && developmentName && developmentName !== `studio-${clientId}-builder`)
    issues.push("manifest.runtime.developmentName must use the scoped client builder name");
  if (runtimeName && runtimeName === developmentName)
    issues.push("runtime and development names must differ");
  if (runtime?.provider !== "exe.dev")
    issues.push("manifest.runtime.provider must equal exe.dev");
  if (harness?.kind !== "pi") issues.push("manifest.harness.kind must equal pi");
  if (harness?.profile !== "workflow")
    issues.push("manifest.harness.profile must equal workflow");

  const backendRef = text(data?.backendRef, "manifest.data.backendRef", issues);
  if (clientId && !backendRef.startsWith(`synthetic://${clientId}/`))
    issues.push("manifest.data.backendRef must be a client-scoped synthetic reference");
  const retrievalRef =
    data?.retrievalRef === null
      ? null
      : text(data?.retrievalRef, "manifest.data.retrievalRef", issues);
  if (
    retrievalRef &&
    clientId &&
    !retrievalRef.startsWith(`synthetic://${clientId}/`)
  )
    issues.push("manifest.data.retrievalRef must be a client-scoped synthetic reference");

  const mail =
    credentials?.mail === null
      ? null
      : secretReference(credentials?.mail, clientId, "manifest.credentials.mail", issues);

  const parsed: ProvisionManifest = {
    schemaVersion: 1,
    clientId,
    mode: "synthetic",
    template: {
      version: text(template?.version, "manifest.template.version", issues, exactVersion),
      sourceSha: text(template?.sourceSha, "manifest.template.sourceSha", issues, fullSha),
    },
    code: {
      repository,
      releaseSha: nullableText(code?.releaseSha, "manifest.code.releaseSha", issues, fullSha),
    },
    runtime: {
      provider: "exe.dev",
      region: text(runtime?.region, "manifest.runtime.region", issues, safeName),
      runtimeName,
      developmentName,
      vmId: nullableText(runtime?.vmId, "manifest.runtime.vmId", issues, safeName),
      artifactDigest: nullableText(
        runtime?.artifactDigest,
        "manifest.runtime.artifactDigest",
        issues,
        sha256Digest,
      ),
    },
    harness: {
      kind: "pi",
      version: text(harness?.version, "manifest.harness.version", issues, exactVersion),
      profile: "workflow",
    },
    configuration: {
      instructionsVersion: text(
        configuration?.instructionsVersion,
        "manifest.configuration.instructionsVersion",
        issues,
        fullSha,
      ),
      toolsetVersion: text(
        configuration?.toolsetVersion,
        "manifest.configuration.toolsetVersion",
        issues,
        fullSha,
      ),
      modelProfile: text(
        configuration?.modelProfile,
        "manifest.configuration.modelProfile",
        issues,
        safeName,
      ),
    },
    data: { backendRef, retrievalRef },
    credentials: {
      model: secretReference(
        credentials?.model,
        clientId,
        "manifest.credentials.model",
        issues,
      ),
      mail,
    },
    limits: {
      maxConcurrentRuns: integer(
        limits?.maxConcurrentRuns,
        "manifest.limits.maxConcurrentRuns",
        issues,
        1,
        4,
      ),
      maxRunSeconds: integer(
        limits?.maxRunSeconds,
        "manifest.limits.maxRunSeconds",
        issues,
        30,
        3600,
      ),
      maxToolCalls: integer(
        limits?.maxToolCalls,
        "manifest.limits.maxToolCalls",
        issues,
        1,
        100,
      ),
    },
    evaluationSet: text(
      root?.evaluationSet,
      "manifest.evaluationSet",
      issues,
      /^mock-clients\/CL-[0-9]{2}$/,
    ),
  };

  if (issues.length) throw new ManifestValidationError([...new Set(issues)]);
  return parsed;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonical(child)]),
    );
  return value;
}

export function canonicalManifest(manifest: ProvisionManifest) {
  return JSON.stringify(canonical(manifest));
}

export function hashManifest(manifest: ProvisionManifest) {
  return createHash("sha256").update(canonicalManifest(manifest)).digest("hex");
}
