import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { BackendIdentityBindingController } from "../../src/provision/binding-controller.ts";
import {
  BindingCreateRejectedError,
  type BackendIdentityProvider,
  type BindingProviderRequest,
  type BindingReconcileResult,
} from "../../src/provision/binding-provider.ts";
import { PrivateBindingRegistry } from "../../src/provision/binding-registry.ts";
import { SubjectBindingResolver } from "../../src/provision/binding-resolver.ts";
import type { ProviderEnvironmentBinding } from "../../src/provision/binding-types.ts";
import { validManifest } from "./fixture.ts";

function providerBinding(clientId = "c0001"): ProviderEnvironmentBinding {
  const environmentId = `environment_synthetic_${clientId}`;
  return {
    environmentId,
    classification: "synthetic",
    isolation: "dedicated",
    attestedClientId: clientId,
    backend: {
      provider: "convex",
      deploymentId: `synthetic-${clientId}-backend`,
      url: `https://synthetic-${clientId}.convex.cloud`,
    },
    identity: {
      provider: "workos",
      environmentId,
      issuer: "https://api.workos.com/",
      audience: `client_synthetic${clientId}`,
    },
  };
}

class FakeBindingProvider implements BackendIdentityProvider {
  readonly name = "synthetic-convex-workos";
  creates = 0;
  reconciles = 0;
  reconcile: (request: BindingProviderRequest) => Promise<BindingReconcileResult> = async () => ({
    state: "absent",
    retrySafe: true,
  });
  create: (request: BindingProviderRequest) => Promise<ProviderEnvironmentBinding> = async (request) =>
    providerBinding(request.clientId);

  async reconcileEnvironment(request: BindingProviderRequest) {
    this.reconciles += 1;
    return this.reconcile(request);
  }

  async createEnvironment(request: BindingProviderRequest) {
    this.creates += 1;
    return this.create(request);
  }
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "studio-binding-registry-"));
  const registry = new PrivateBindingRegistry(root);
  const provider = new FakeBindingProvider();
  const controller = new BackendIdentityBindingController(
    registry,
    provider,
    () => "2026-09-11T17:00:00.000Z",
  );
  const input = {
    manifest: validManifest(),
    sourceSha: "a".repeat(40),
    credentialRefs: {
      backend: "secretref://c0001/controller/convex",
      identity: "secretref://c0001/controller/workos",
    },
    idempotencyKey: "binding:c0001:0001",
  };
  return { root, registry, provider, controller, input };
}

test("persists one provider-inspected dedicated synthetic binding and replays without create", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  let created = false;
  value.provider.reconcile = async (request) =>
    created
      ? { state: "owned", binding: providerBinding(request.clientId) }
      : { state: "absent", retrySafe: true };
  value.provider.create = async (request) => {
    created = true;
    return providerBinding(request.clientId);
  };
  const first = await value.controller.ensure(value.input);
  const second = await value.controller.ensure(value.input);
  assert.deepEqual(second, first);
  assert.equal(first.status, "ready");
  assert.equal(first.clientId, "c0001");
  assert.equal(first.scope, "dedicated");
  assert.equal(first.provenance.source, "controller-inspection");
  assert.equal(value.provider.creates, 1);
  assert.equal(value.provider.reconciles, 2);
  assert.deepEqual(await value.registry.modes("c0001"), { directory: 0o700, entry: 0o600 });
  const raw = await readFile(join(value.root, "c0001.binding.json"), "utf8");
  assert.match(raw, /secretref:\/\/c0001\/controller\/convex/);
  assert.doesNotMatch(raw, /sk_(?:test|live)_|Bearer |PRIVATE KEY/);
});

test("ambiguous create is redacted and reconciled before retry without duplicate create", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  value.provider.create = async () => {
    throw new Error(`${"sk"}_test_secretcanary lost after provider effect`);
  };
  await assert.rejects(value.controller.ensure(value.input), /uncertain; inspect before retry/);
  assert.equal(value.provider.creates, 1);
  assert.doesNotMatch(
    await readFile(join(value.root, "c0001.binding.json"), "utf8"),
    /secretcanary|sk_test_/,
  );

  value.provider.reconcile = async (request) => ({
    state: "owned",
    binding: providerBinding(request.clientId),
  });
  const recovered = await value.controller.ensure(value.input);
  assert.equal(recovered.status, "ready");
  assert.equal(value.provider.creates, 1);
});

test("persisted pending plus provider absence stays uncertain", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  value.provider.create = async () => { throw new Error("lost response"); };
  await assert.rejects(value.controller.ensure(value.input));
  const entry = await value.registry.read("c0001");
  assert.ok(entry);
  entry.state = "pending";
  delete entry.failure;
  await value.registry.write(entry);
  value.provider.reconcile = async () => ({ state: "absent", retrySafe: true });
  await assert.rejects(
    value.controller.ensure(value.input),
    /prior environment create may have taken effect/,
  );
  assert.equal(value.provider.creates, 1);
});

test("only explicit pre-effect rejection permits a later create", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  value.provider.create = async () => {
    throw new BindingCreateRejectedError("secretcanary quota");
  };
  await assert.rejects(value.controller.ensure(value.input), /rejected binding creation/);
  assert.doesNotMatch(await readFile(join(value.root, "c0001.binding.json"), "utf8"), /secretcanary/);
  let created = false;
  value.provider.create = async (request) => {
    created = true;
    return providerBinding(request.clientId);
  };
  value.provider.reconcile = async (request) =>
    created
      ? { state: "owned", binding: providerBinding(request.clientId) }
      : { state: "absent", retrySafe: true };
  assert.equal((await value.controller.ensure(value.input)).status, "ready");
  assert.equal(value.provider.creates, 2);
});

test("production, shared and mismatched-client observations fail closed", async (t) => {
  for (const mutate of [
    (binding: ProviderEnvironmentBinding) => ({ ...binding, classification: "production" as const }),
    (binding: ProviderEnvironmentBinding) => ({ ...binding, isolation: "shared" as const }),
    (binding: ProviderEnvironmentBinding) => ({ ...binding, attestedClientId: "c0002" }),
    (binding: ProviderEnvironmentBinding) => ({
      ...binding,
      backend: { ...binding.backend, url: "https://u@synthetic-c0001.convex.cloud" },
    }),
  ]) {
    const value = await fixture();
    t.after(() => rm(value.root, { recursive: true, force: true }));
    value.provider.reconcile = async () => ({ state: "owned", binding: mutate(providerBinding()) });
    await assert.rejects(
      value.controller.ensure(value.input),
      /does not match the dedicated synthetic client binding/,
    );
    assert.equal(value.provider.creates, 0);
  }
});

test("verified subject resolves a server-configured binding without caller client selection", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  let created = false;
  value.provider.create = async (request) => { created = true; return providerBinding(request.clientId); };
  value.provider.reconcile = async (request) => created
    ? { state: "owned", binding: providerBinding(request.clientId) }
    : { state: "absent", retrySafe: true };
  const binding = await value.controller.ensure(value.input);
  const identity = {
    issuer: binding.identity.issuer,
    audience: binding.identity.audience,
    subject: "user_synthetic_owner",
  };
  const resolver = new SubjectBindingResolver({
    bindings: [binding],
    authorizations: [{
      ...identity,
      clientId: binding.clientId,
      environmentId: binding.environmentId,
    }],
  });
  assert.equal(resolver.resolve(identity).clientId, "c0001");
  await assert.rejects(
    Promise.resolve().then(() => resolver.resolve({ ...identity, subject: "user_foreign" })),
    /UNAUTHORIZED_SUBJECT/,
  );
  await assert.rejects(
    Promise.resolve().then(() => resolver.resolve({ ...identity, audience: "client_wrong0000" })),
    /UNAUTHORIZED_SUBJECT/,
  );
});

test("source, credential and persisted registry identity cannot be caller-forged", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  await assert.rejects(
    value.controller.ensure({ ...value.input, sourceSha: "d".repeat(40) }),
    /BINDING_SOURCE_MISMATCH/,
  );
  await assert.rejects(
    value.controller.ensure({
      ...value.input,
      credentialRefs: {
        ...value.input.credentialRefs,
        backend: `${"sk"}_test_secretcanary`,
      },
    }),
    /INVALID_BINDING_CREDENTIAL_REFERENCE/,
  );

  let created = false;
  value.provider.create = async (request) => { created = true; return providerBinding(request.clientId); };
  value.provider.reconcile = async (request) => created
    ? { state: "owned", binding: providerBinding(request.clientId) }
    : { state: "absent", retrySafe: true };
  await value.controller.ensure(value.input);
  const path = join(value.root, "c0001.binding.json");
  const persisted = JSON.parse(await readFile(path, "utf8"));
  persisted.state = "invented-ready";
  delete persisted.binding;
  await writeFile(path, `${JSON.stringify(persisted)}\n`, { mode: 0o600 });
  await assert.rejects(value.registry.read("c0001"), /Binding registry identity is invalid/);
  assert.throws(() => new PrivateBindingRegistry("/"), /specific absolute directory/);
  await assert.rejects(value.registry.read("../outside"), /client ID is invalid/);
});
