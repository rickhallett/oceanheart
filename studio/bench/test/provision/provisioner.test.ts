import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ProviderCreateRejectedError,
  type ProvisionProvider,
  type ReconcileResult,
  type ResourceRequest,
} from "../../src/provision/provider.ts";
import { ProvisionController } from "../../src/provision/provisioner.ts";
import { FileRegistry } from "../../src/provision/registry.ts";
import type { ResourceKind } from "../../src/provision/types.ts";
import { validManifest } from "./fixture.ts";

class FakeProvider implements ProvisionProvider {
  readonly name = "synthetic";
  readonly created = new Map<ResourceKind, number>();
  reconcile: (request: ResourceRequest) => Promise<ReconcileResult> = async () => ({
    state: "absent",
    retrySafe: true,
  });
  create: (request: ResourceRequest) => Promise<{ externalId: string }> = async (request) => ({
    externalId: `synthetic-${request.resource}`,
  });

  async reconcileResource(request: ResourceRequest) {
    return this.reconcile(request);
  }

  async createResource(request: ResourceRequest) {
    this.created.set(request.resource, (this.created.get(request.resource) ?? 0) + 1);
    return this.create(request);
  }
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "studio-bench-registry-"));
  const registry = new FileRegistry(root);
  const provider = new FakeProvider();
  const controller = new ProvisionController(
    registry,
    provider,
    () => "2026-09-11T12:00:00.000Z",
  );
  return { root, registry, provider, controller };
}

test("provisions once, persists private receipts and replays without effects", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  const first = await value.controller.provision(validManifest(), "pilot:c0001:0001");
  const second = await value.controller.provision(validManifest(), "pilot:c0001:0001");
  assert.equal(first.status, "ready");
  assert.deepEqual(second, first);
  assert.equal([...value.provider.created.values()].reduce((a, b) => a + b, 0), 4);
  assert.deepEqual(await value.registry.modes("c0001"), { directory: 0o700, entry: 0o600 });
});

test("ambiguous create is redacted and reconciled without duplicate creation", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  value.provider.create = async () => {
    throw new Error("secretcanary provider timeout after create");
  };
  await assert.rejects(
    value.controller.provision(validManifest(), "pilot:c0001:0002"),
    /uncertain; reconcile before retry/,
  );
  const raw = await readFile(join(value.root, "c0001.json"), "utf8");
  assert.doesNotMatch(raw, /secretcanary|provider timeout/);
  assert.equal(value.provider.created.get("repository"), 1);

  value.provider.reconcile = async (request) =>
    request.resource === "repository"
      ? { state: "owned", externalId: "repo-existing" }
      : { state: "absent", retrySafe: true };
  value.provider.create = async (request) => ({ externalId: `created-${request.resource}` });
  const resumed = await value.controller.provision(validManifest(), "pilot:c0001:0002");
  assert.equal(resumed.status, "ready");
  assert.equal(value.provider.created.get("repository"), 1);
});

test("persisted pending plus non-authoritative absence fails closed", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  value.provider.create = async () => {
    throw new Error("lost response");
  };
  await assert.rejects(value.controller.provision(validManifest(), "pilot:c0001:0003"));
  const entry = await value.registry.read("c0001");
  assert.ok(entry);
  entry.resources.repository.state = "pending";
  entry.status = "in_progress";
  await value.registry.write(entry);
  value.provider.reconcile = async () => ({ state: "absent", retrySafe: false });
  value.provider.create = async () => ({ externalId: "must-not-be-created" });
  await assert.rejects(
    value.controller.provision(validManifest(), "pilot:c0001:0003"),
    /prior create may have taken effect/,
  );
  assert.equal(value.provider.created.get("repository"), 1);
});

test("only explicit pre-effect rejection permits a later create retry", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  value.provider.create = async () => {
    throw new ProviderCreateRejectedError("secretcanary quota rejection");
  };
  await assert.rejects(
    value.controller.provision(validManifest(), "pilot:c0001:0004"),
    /rejected resource creation/,
  );
  assert.doesNotMatch(await readFile(join(value.root, "c0001.json"), "utf8"), /secretcanary/);
  value.provider.create = async (request) => ({ externalId: `created-${request.resource}` });
  assert.equal(
    (await value.controller.provision(validManifest(), "pilot:c0001:0004")).status,
    "ready",
  );
  assert.equal(value.provider.created.get("repository"), 2);
});

test("provider-controlled identities cannot inject receipt detail", async (t) => {
  const value = await fixture();
  t.after(() => rm(value.root, { recursive: true, force: true }));
  value.provider.create = async () => ({
    externalId: "secretcanary provider detail with spaces",
  });
  await assert.rejects(
    value.controller.provision(validManifest(), "pilot:c0001:0005"),
    /uncertain; reconcile before retry/,
  );
  assert.doesNotMatch(await readFile(join(value.root, "c0001.json"), "utf8"), /secretcanary/);
});
