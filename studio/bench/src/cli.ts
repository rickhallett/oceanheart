#!/usr/bin/env node
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { help, parseCli, UsageError, type CliOptions } from "./cli-options.ts";
import { inspectRuns } from "./inspect.ts";
import { adaptedConfiguration, baselineConfiguration } from "./eval/configuration.ts";

const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

async function configuration(id: string) {
  const document = JSON.parse(await readFile(new URL("../fixtures/clara/workflow-configurations.json", import.meta.url), "utf8"));
  const selected = id === "baseline" ? document.configurations[0] : document.configurations.find((item: {id: string}) => item.id === id);
  if (!selected) throw new UsageError("Unknown workflow configuration.");
  return selected;
}

async function selectedConfiguration(root: string, clientId: string, requested: string) {
  if (requested !== "active") return { id: requested, source: "explicit" as const };
  const { ClaraConfigurationStore } = await import("./adaptation/release.ts");
  const store = new ClaraConfigurationStore(root, clientId);
  const active = await store.active();
  if (!active) return { id: baselineConfiguration, source: "default-baseline" as const };
  const artifact = await store.artifact(active.artifactDigest);
  if (artifact.version !== active.version) throw new Error("ACTIVE_CONFIGURATION_MISMATCH");
  return { id: active.version, source: "active-release" as const, releaseId: active.activeReleaseId, artifactDigest: active.artifactDigest, artifact };
}

async function run(options: CliOptions) {
  const { loadClaraFixtures } = await import("./eval/fixtures.ts");
  const { PiWorkflowRuntime } = await import("./runtime/pi-adapter.ts");
  const fixtures = await loadClaraFixtures();
  const fixture = fixtures.find((item) => item.caseId === options.fixture);
  if (!fixture) throw new UsageError("Unknown fixture. Use a case ID from the Clara suite.");
  const selection = await selectedConfiguration(options.stateDir, fixture.input.clientId, options.configuration);
  const selected = await configuration(selection.id);
  const { configuredClaraInput } = await import("./eval/configuration.ts");
  const { configuredInputForArtifact } = await import("./adaptation/configuration.ts");
  const runtime = new PiWorkflowRuntime({ root: options.stateDir });
  try {
    const key = createHash("sha256").update(JSON.stringify({fixture, configuration: selected})).digest("hex");
    const input = selection.artifact
      ? configuredInputForArtifact(fixture, selection.artifact)
      : configuredClaraInput(fixture, selected.id);
    const job = await runtime.startRun({clientId: fixture.input.clientId, actor: "studio-bench-cli", idempotencyKey: key, configurationVersion: selected.id, input});
    const tracePath = join(options.stateDir, "exports", `${job.id}.json`);
    await mkdir(join(options.stateDir, "exports"), {recursive: true, mode: 0o700});
    await writeFile(tracePath, JSON.stringify(runtime.exportTrace(job.clientId, job.id), null, 2) + "\n", {mode: 0o600});
    print({runId: job.id, clientId: job.clientId, configuration: selected.id, configurationSource: selection.source, activeReleaseId: selection.releaseId, artifactDigest: selection.artifactDigest, status: job.status, result: job.result, tracePath, evidence: "real Pi SDK; deterministic in-process transport; synthetic invoice effects; durable runtime state retained across configuration changes"});
    if (!["succeeded", "waiting_for_input"].includes(job.status)) process.exitCode = 1;
  } finally { runtime.close(); }
}

async function adapt(options: CliOptions) {
  const { loadClaraFixtures } = await import("./eval/fixtures.ts");
  const { artifactDigest, baselineArtifact, requestedArtifact } = await import("./adaptation/configuration.ts");
  const { evaluateAdaptation } = await import("./adaptation/evaluate.ts");
  const { ClaraConfigurationStore } = await import("./adaptation/release.ts");
  const fixtures = await loadClaraFixtures();
  const fixture = fixtures.find((item) => item.caseId === options.fixture);
  if (!fixture) throw new UsageError("Unknown adaptation fixture.");
  const baseline = baselineArtifact(await configuration(baselineConfiguration), fixture.clientId);
  const candidate = requestedArtifact(await configuration(adaptedConfiguration), fixture, {
    effectiveDate: options.effectiveDate!,
    newRateMinor: options.newRateMinor!,
  });
  const baselineDigest = artifactDigest(baseline);
  const candidateDigest = artifactDigest(candidate);
  const store = new ClaraConfigurationStore(options.stateDir, fixture.clientId);
  const before = await store.ensureBaseline(baseline);
  const evaluation = await evaluateAdaptation({
    stateDir: options.stateDir,
    outputDir: options.outputDir ?? join(options.stateDir, "reports", "adaptation"),
    baseline,
    baselineDigest,
    candidate,
    candidateDigest,
  });
  if (!evaluation.accepted) {
    print({status: "rejected", active: before, evaluation});
    process.exitCode = 1;
    return;
  }
  const activated = await store.activate(candidate, evaluation, before.activeReleaseId);
  print({status: activated.reused ? "already_active" : "activated", request: {fixture: fixture.caseId, effectiveDate: options.effectiveDate, newRateMinor: options.newRateMinor}, evaluation, release: activated.release, active: activated.active, runtimeState: "preserved; existing draft/session reservations are not reset"});
}

async function rollback(options: CliOptions) {
  const { ClaraConfigurationStore } = await import("./adaptation/release.ts");
  const store = new ClaraConfigurationStore(options.stateDir, "c-clara-synthetic");
  const result = await store.rollback(options.release!);
  print({status: "rolled_back", ...result, runtimeState: "preserved; rollback does not replay or clear prior draft effects"});
}

async function evaluate(options: CliOptions) {
  const { loadClaraFixtures } = await import("./eval/fixtures.ts");
  const { default: ClaraWorkflowProvider } = await import("./eval/promptfoo-clara-provider.ts");
  const { buildComparisonReport, writeComparisonReport } = await import("./eval/report.ts");
  const document = JSON.parse(await readFile(new URL("../fixtures/clara/workflow-configurations.json", import.meta.url), "utf8"));
  const fixtures = await loadClaraFixtures();
  const batch = randomUUID();
  const outputDir = options.outputDir ?? join(options.stateDir, "reports", batch);
  await mkdir(outputDir, {recursive: true, mode: 0o700});
  const runs = [];
  for (const selected of document.configurations) {
    for (const fixture of fixtures) {
      const provider = new ClaraWorkflowProvider({config: {configurationVersion: selected.id, runtimeRoot: join(options.stateDir, "eval", batch, selected.id, fixture.caseId)}});
      const response = await provider.callApi("Prepare the synthetic invoice draft.", {vars: {fixture}});
      const result = JSON.parse(response.output);
      // Persist the actual audit record beside the report so trace links resolve locally.
      const traceName = `${selected.id}-${fixture.caseId}-${result.trace.runId}.json`;
      const tracePath = join(outputDir, traceName);
      await writeFile(tracePath, JSON.stringify(response.metadata.trace, null, 2) + "\n", {mode: 0o600});
      result.trace.href = traceName;
      runs.push({fixture, result});
    }
  }
  const report = buildComparisonReport(document.configurations, runs);
  const paths = await writeComparisonReport(outputDir, report);
  print({batch, total: report.results.length, passed: report.results.filter((item) => item.pass).length, ...paths, evidence: "synthetic SDK/tool evaluation; no live inference or hosted acceptance"});
  if (report.results.some((item) => !item.pass)) process.exitCode = 1;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCli(argv);
  if (options.command === "help") {process.stdout.write(help); return;}
  if (options.command === "inspect") {print(inspectRuns(options.stateDir, options.subject!)); return;}
  if (options.command === "run") {await run(options); return;}
  if (options.command === "eval") {await evaluate(options); return;}
  if (options.command === "adapt") {await adapt(options); return;}
  if (options.command === "rollback") {await rollback(options); return;}
  if (options.command === "plan") {
    const { validateManifest, hashManifest } = await import("./provision/manifest.ts");
    const { resourceKinds } = await import("./provision/types.ts");
    const manifest = validateManifest(JSON.parse(await readFile(options.subject!, "utf8")));
    print({schemaVersion: 1, clientId: manifest.clientId, manifestHash: hashManifest(manifest), executable: false, operations: resourceKinds.map((resource) => ({resource, action: "reconcile-then-create"})), limits: ["Provider adapter and account resource plan must be validated before execution.", "This command validates intent; it creates no resources and makes no price claim."]});
    return;
  }
  if (options.command === "export-template") {
    const { exportStudioAtSha } = await import("./provision/export.ts");
    print(await exportStudioAtSha({repositoryRoot: options.sourceRepo!, sourceRepository: "rickhallett/oceanheart", sourceSha: options.sha!, destination: options.outputDir!}));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Provider and filesystem exceptions can contain sensitive arguments or raw content.
    process.stderr.write(`${error instanceof UsageError ? error.message : "Bench command failed. Check the selected fixture, local state and configuration; no raw error content is exported."}\n`);
    process.exitCode = 1;
  });
}
