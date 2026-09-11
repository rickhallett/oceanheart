import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { BackendIdentityBindingController } from "../../src/provision/binding-controller.ts";
import { ConvexManagementTransport } from "../../src/provision/convex-management.ts";
import { ConvexWorkosBindingProvider } from "../../src/provision/convex-workos-provider.ts";
import {
  ControllerProviderAuthorityResolver,
  type ProviderAuthorityRegistration,
} from "../../src/provision/provider-authority.ts";
import { readApprovedProviderTarget } from "../../src/provision/provider-target.ts";
import { PrivateBindingRegistry } from "../../src/provision/binding-registry.ts";
import { prepareBindingRequest, hashBindingRequest } from "../../src/provision/binding-validation.ts";
import { ControllerCommandRunner, WorkosAccountTransport } from "../../src/provision/workos-account.ts";

function option(name: string) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error("INVALID_PROVIDER_BIND_ARGUMENTS");
  return process.argv[index + 1];
}

async function main() {
  const target = await readApprovedProviderTarget(option("--target"));
  const manifest = JSON.parse(await readFile(option("--manifest"), "utf8")) as unknown;
  const idempotencyKey = option("--idempotency-key");
  const convexVariable = option("--convex-token-env");
  const workosExecutable = option("--workos-cli");
  const registrations = new Map<string, ProviderAuthorityRegistration>([
    [target.credentialRefs.backend, {
      provider: "convex",
      kind: "environment",
      variable: convexVariable,
    }],
    [target.credentialRefs.identity, {
      provider: "workos",
      kind: "workos-cli-session",
      executable: workosExecutable,
    }],
  ]);
  const resolver = new ControllerProviderAuthorityResolver(registrations);
  const provider = new ConvexWorkosBindingProvider(
    target,
    new ConvexManagementTransport(target, resolver),
    new WorkosAccountTransport(target, resolver, new ControllerCommandRunner()),
  );
  if (process.argv.includes("--inspect-only")) {
    const request = prepareBindingRequest({
      manifest,
      sourceSha: target.sourceSha,
      credentialRefs: target.credentialRefs,
    });
    const requestHash = hashBindingRequest(request);
    const operationId = createHash("sha256").update(`${requestHash}:${idempotencyKey}`).digest("hex");
    const observation = await provider.reconcileEnvironment({ ...request, operationId, idempotencyKey });
    process.stdout.write(`${JSON.stringify(observation)}\n`);
    return;
  }
  const controller = new BackendIdentityBindingController(
    new PrivateBindingRegistry(option("--registry")),
    provider,
  );
  const binding = await controller.ensure({
    manifest,
    sourceSha: target.sourceSha,
    credentialRefs: target.credentialRefs,
    idempotencyKey,
  });
  process.stdout.write(`${JSON.stringify(binding)}\n`);
}

main().catch((error: unknown) => {
  const name = error instanceof Error && /^[A-Za-z][A-Za-z]+Error$/.test(error.name)
    ? error.name
    : "ProviderBindingError";
  process.stderr.write(`${name}\n`);
  process.exitCode = 1;
});
