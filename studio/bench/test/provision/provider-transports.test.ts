import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { BackendIdentityBindingController } from "../../src/provision/binding-controller.ts";
import { hashManifest } from "../../src/provision/manifest.ts";
import { ConvexManagementTransport } from "../../src/provision/convex-management.ts";
import { ConvexWorkosBindingProvider } from "../../src/provision/convex-workos-provider.ts";
import {
  ControllerProviderAuthorityResolver,
  type ProviderAuthorityRegistration,
} from "../../src/provision/provider-authority.ts";
import {
  readApprovedProviderTarget,
  validateApprovedProviderTarget,
  type ApprovedProviderTarget,
} from "../../src/provision/provider-target.ts";
import { PrivateBindingRegistry } from "../../src/provision/binding-registry.ts";
import {
  WorkosAccountTransport,
  type SafeCommandRunner,
} from "../../src/provision/workos-account.ts";
import { validManifest } from "./fixture.ts";

const secretCanary = ["convex", "team", "secret", "canary"].join("-");
const convexRef = "secretref://c0001/controller/convex";
const workosRef = "secretref://c0001/controller/workos";

function target(): ApprovedProviderTarget {
  return {
    schemaVersion: 1,
    clientId: "c0001",
    mode: "synthetic",
    scope: "dedicated",
    sourceSha: "a".repeat(40),
    manifestHash: hashManifest(validManifest()),
    approvedAt: "2026-09-11T18:00:00.000Z",
    credentialRefs: { backend: convexRef, identity: workosRef },
    convex: {
      teamId: 41,
      projectName: "Studio c0001 synthetic",
      deploymentReference: "dev/c0001/runtime",
      deploymentType: "dev",
    },
    workos: {
      teamId: "team_synthetic0001",
      projectId: "project_synthetic0001",
      parentEnvironmentId: "environment_parent0001",
      environmentName: "Studio c0001 synthetic",
    },
  };
}

class ProviderFixture {
  project: Record<string, unknown> | undefined;
  deployment: Record<string, unknown> | undefined;
  workosCreated = false;
  convexProjectCreates = 0;
  convexDeploymentCreates = 0;
  workosCreates = 0;
  loseProjectResponse = false;
  loseWorkosResponse = false;

  readonly runner: SafeCommandRunner = {
    run: async (_executable, args) => {
      if (args[0] === "whoami") return JSON.stringify({
        team: { id: "team_synthetic0001", name: "Synthetic team" },
        environment: { id: "environment_parent0001", sandbox: true },
      });
      if (args[0] === "project" && args[1] === "list") return JSON.stringify({
        projects: [{
          id: "project_synthetic0001",
          name: "Synthetic project",
          environments: [
            {
              id: "environment_parent0001",
              name: "Staging",
              sandbox: true,
              clientId: "client_parent0001",
            },
            ...(this.workosCreated ? [{
              id: "environment_client0001",
              name: "Studio c0001 synthetic",
              sandbox: true,
              clientId: "client_synthetic0001",
            }] : []),
          ],
        }],
      });
      if (args[0] === "environment" && args[1] === "create") {
        this.workosCreates += 1;
        this.workosCreated = true;
        if (this.loseWorkosResponse) {
          this.loseWorkosResponse = false;
          throw new Error(`lost ${secretCanary}`);
        }
        return JSON.stringify({ id: "environment_client0001" });
      }
      throw new Error("unexpected command");
    },
  };

  readonly fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${secretCanary}`);
    if (init?.method === "GET" && url.pathname === "/v1/teams/41/projects")
      return Response.json({ items: this.project ? [this.project] : [], pagination: {} });
    if (init?.method === "POST" && url.pathname === "/v1/teams/41/create_project") {
      this.convexProjectCreates += 1;
      this.project = {
        id: 501,
        name: "Studio c0001 synthetic",
        slug: "studio-c0001-synthetic",
        teamId: 41,
        teamSlug: "oceanheart",
      };
      if (this.loseProjectResponse) {
        this.loseProjectResponse = false;
        throw new Error(`lost ${secretCanary}`);
      }
      return Response.json({ projectId: 501, id: 501, slug: "studio-c0001-synthetic" });
    }
    if (init?.method === "GET" && url.pathname === "/v1/projects/501/list_deployments")
      return Response.json(this.deployment ? [this.deployment] : []);
    if (init?.method === "POST" && url.pathname === "/v1/projects/501/create_deployment") {
      this.convexDeploymentCreates += 1;
      this.deployment = {
        id: 601,
        name: "synthetic-runtime-601",
        deploymentType: "dev",
        projectId: 501,
        reference: "dev/c0001/runtime",
        deploymentUrl: "https://synthetic-runtime-601.convex.cloud",
        kind: "cloud",
      };
      return Response.json(this.deployment);
    }
    return Response.json({ code: "not_found", message: secretCanary }, { status: 404 });
  };
}

function providerFixture(value = new ProviderFixture()) {
  const registrations = new Map<string, ProviderAuthorityRegistration>([
    [convexRef, { provider: "convex", kind: "environment", variable: "BENCH_CONVEX_TOKEN" }],
    [workosRef, { provider: "workos", kind: "workos-cli-session", executable: "/usr/local/bin/workos" }],
  ]);
  const resolver = new ControllerProviderAuthorityResolver(registrations, {
    BENCH_CONVEX_TOKEN: secretCanary,
  });
  const approved = validateApprovedProviderTarget(target());
  return {
    value,
    approved,
    provider: new ConvexWorkosBindingProvider(
      approved,
      new ConvexManagementTransport(approved, resolver, {
        fetcher: value.fetcher,
        baseUrl: "https://api.convex.dev/v1",
      }),
      new WorkosAccountTransport(approved, resolver, value.runner),
    ),
  };
}

async function controllerFixture(value = new ProviderFixture()) {
  const provider = providerFixture(value);
  const root = await mkdtemp(join(tmpdir(), "provider-transport-"));
  const registry = new PrivateBindingRegistry(root);
  const controller = new BackendIdentityBindingController(
    registry,
    provider.provider,
    () => "2026-09-11T18:01:00.000Z",
  );
  return {
    ...provider,
    root,
    registry,
    controller,
    input: {
      manifest: validManifest(),
      sourceSha: "a".repeat(40),
      credentialRefs: { backend: convexRef, identity: workosRef },
      idempotencyKey: "binding:c0001:provider:0001",
    },
  };
}

test("real provider transports create registered dev and sandbox targets then replay", async (t) => {
  const fixture = await controllerFixture();
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  const first = await fixture.controller.ensure(fixture.input);
  const second = await fixture.controller.ensure(fixture.input);
  assert.deepEqual(second, first);
  assert.equal(first.backend.deploymentId, "601");
  assert.equal(first.identity.environmentId, "environment_client0001");
  assert.equal(first.identity.audience, "client_synthetic0001");
  assert.deepEqual(
    [fixture.value.convexProjectCreates, fixture.value.convexDeploymentCreates, fixture.value.workosCreates],
    [1, 1, 1],
  );
});

test("lost Convex project response resumes the registered partial target without duplicate project", async (t) => {
  const state = new ProviderFixture();
  state.loseProjectResponse = true;
  const fixture = await controllerFixture(state);
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await assert.rejects(fixture.controller.ensure(fixture.input), /uncertain/);
  assert.equal(state.convexProjectCreates, 1);
  const binding = await fixture.controller.ensure(fixture.input);
  assert.equal(binding.status, "ready");
  assert.deepEqual(
    [state.convexProjectCreates, state.convexDeploymentCreates, state.workosCreates],
    [1, 1, 1],
  );
});

test("lost WorkOS create response is reconciled without duplicate environment or secret leakage", async (t) => {
  const state = new ProviderFixture();
  state.loseWorkosResponse = true;
  const fixture = await controllerFixture(state);
  t.after(() => rm(fixture.root, { recursive: true, force: true }));
  await assert.rejects(fixture.controller.ensure(fixture.input), /uncertain/);
  assert.equal((await fixture.registry.read("c0001"))?.state, "effect_uncertain");
  assert.equal(state.workosCreates, 1);
  assert.equal((await fixture.controller.ensure(fixture.input)).status, "ready");
  assert.equal(state.workosCreates, 1);
  assert.doesNotMatch(JSON.stringify(await fixture.registry.read("c0001")), new RegExp(secretCanary));
});

test("provider inspection refuses shared production or unregistered targets before writes", async () => {
  const state = new ProviderFixture();
  state.project = {
    id: 501,
    name: "Studio c0001 synthetic",
    slug: "studio-c0001-synthetic",
    teamId: 41,
    teamSlug: "oceanheart",
  };
  state.deployment = {
    id: 601,
    name: "wrong-production",
    deploymentType: "prod",
    projectId: 501,
    reference: "dev/c0001/runtime",
    deploymentUrl: "https://wrong-production.convex.cloud",
    kind: "cloud",
  };
  const fixture = providerFixture(state);
  const request = {
    schemaVersion: 1 as const,
    clientId: "c0001",
    mode: "synthetic" as const,
    manifestHash: hashManifest(validManifest()),
    sourceSha: "a".repeat(40),
    providers: { backend: "convex" as const, identity: "workos" as const },
    credentialRefs: { backend: convexRef, identity: workosRef },
    operationId: "c".repeat(64),
    idempotencyKey: "binding:c0001:provider:0001",
  };
  assert.deepEqual(await fixture.provider.reconcileEnvironment(request), { state: "foreign" });
  await assert.rejects(
    fixture.provider.reconcileEnvironment({ ...request, clientId: "c0002" }),
    /does not match approved target/,
  );
  assert.deepEqual(
    [state.convexProjectCreates, state.convexDeploymentCreates, state.workosCreates],
    [0, 0, 0],
  );
});

test("approved target registration must be a private regular file and contains no authority value", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "provider-target-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, "c0001.provider-target.json");
  await writeFile(path, `${JSON.stringify(target())}\n`, { mode: 0o600 });
  assert.equal((await readApprovedProviderTarget(path)).clientId, "c0001");
  await chmod(path, 0o644);
  await assert.rejects(readApprovedProviderTarget(path), /NOT_PRIVATE/);
  assert.throws(
    () => validateApprovedProviderTarget({
      ...target(),
      credentialRefs: { backend: secretCanary, identity: workosRef },
    }),
    /INVALID_APPROVED_PROVIDER_TARGET/,
  );
  assert.throws(
    () => validateApprovedProviderTarget({ ...target(), leakedCredential: secretCanary } as never),
    /INVALID_APPROVED_PROVIDER_TARGET/,
  );
  assert.throws(
    () => validateApprovedProviderTarget({
      ...target(),
      convex: { ...target().convex, projectName: ["sk", "test", "recognizablecredential"].join("_") },
    }),
    /INVALID_APPROVED_PROVIDER_TARGET/,
  );
});
