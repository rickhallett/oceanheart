#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { SubjectBindingResolver, type SubjectBindingAuthorization } from "../../src/provision/binding-resolver.ts";
import { ControllerBindingRegistryAdapter } from "../../src/provision/server-binding-adapter.ts";
import type { BackendIdentityBinding, BindingRegistryEntry } from "../../src/provision/binding-types.ts";
import { createClaraRuntimeBridge, listenOnLoopback } from "../../src/provision/clara-runtime-bridge.ts";
import { PiWorkflowRuntime } from "../../src/runtime/pi-adapter.ts";
import { AuthenticatedClaraRuntime } from "../../src/server/authenticated-runtime.ts";
import type { EnvironmentBindingRegistry, VerifiedPrincipal } from "../../src/server/binding.ts";
import { PiDurableRuntimeAdapter } from "../../src/server/runtime-adapter.ts";
import { WorkOsJwtIdentityVerifier } from "../../src/server/workos-jwt-verifier.ts";

function argumentsMap(args: string[]) {
  const output = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value) throw new Error("USAGE_INVALID");
    output.set(name.slice(2), value);
  }
  return output;
}

async function jsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

class ReloadingBindingRegistry implements EnvironmentBindingRegistry {
  private readonly binding: BackendIdentityBinding;
  private readonly authorizationsPath: string;

  constructor(binding: BackendIdentityBinding, authorizationsPath: string) {
    this.binding = binding;
    this.authorizationsPath = authorizationsPath;
  }

  async resolveAuthorized(principal: VerifiedPrincipal) {
    const input = await jsonFile<{ schemaVersion: 1; authorizations: SubjectBindingAuthorization[] }>(this.authorizationsPath);
    if (input.schemaVersion !== 1 || !Array.isArray(input.authorizations)) return null;
    return new ControllerBindingRegistryAdapter(new SubjectBindingResolver({
      bindings: [this.binding],
      authorizations: input.authorizations,
    })).resolveAuthorized(principal);
  }
}

const args = argumentsMap(process.argv.slice(2));
const required = ["binding", "authorizations", "state-root", "port"] as const;
for (const name of required) if (!args.has(name)) throw new Error(`MISSING_${name.toUpperCase().replaceAll("-", "_")}`);
const entry = await jsonFile<BindingRegistryEntry>(args.get("binding")!);
if (entry.state !== "ready" || !entry.binding) throw new Error("BINDING_NOT_READY");
const binding = entry.binding;
const runtime = new PiWorkflowRuntime({ root: args.get("state-root")! });
const durable = new PiDurableRuntimeAdapter(runtime, {
  clientId: binding.clientId,
  environmentId: binding.environmentId,
  backendDeploymentId: binding.backend.deploymentId,
});
const identity = new WorkOsJwtIdentityVerifier({
  environmentId: binding.identity.environmentId,
  audience: binding.identity.audience,
  issuer: binding.identity.issuer,
  jwksUrl: `https://api.workos.com/sso/jwks/${binding.identity.audience}`,
  diagnostic: (code) => process.stderr.write(`${JSON.stringify({ event: "workos_verification_denied", code })}\n`),
});
const authenticated = new AuthenticatedClaraRuntime({
  policy: {
    mode: "hosted",
    environmentId: binding.environmentId,
    provider: "workos",
    audience: binding.identity.audience,
    issuer: binding.identity.issuer,
  },
  identity,
  bindings: new ReloadingBindingRegistry(binding, args.get("authorizations")!),
  runtimeFor: (resolved) => resolved.clientId === binding.clientId ? durable : null,
});
const server = createClaraRuntimeBridge(authenticated);
await listenOnLoopback(server, Number(args.get("port")));

async function stop() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  runtime.close();
  process.exit(0);
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
