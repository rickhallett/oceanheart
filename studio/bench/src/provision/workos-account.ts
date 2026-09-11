import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  BindingConflictError,
  BindingCreateRejectedError,
  BindingEffectUncertainError,
} from "./binding-provider.ts";
import type { ProviderAuthorityResolver } from "./provider-authority.ts";
import type { ApprovedProviderTarget } from "./provider-target.ts";

const execFileAsync = promisify(execFile);

export interface SafeCommandRunner {
  run(executable: string, args: readonly string[]): Promise<string>;
}

export class ControllerCommandRunner implements SafeCommandRunner {
  async run(executable: string, args: readonly string[]) {
    try {
      const { stdout } = await execFileAsync(executable, [...args], {
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
        env: Object.fromEntries(
          ["HOME", "PATH", "TMPDIR", "LANG", "LC_ALL", "XDG_CONFIG_HOME"]
            .map((name) => [name, process.env[name]])
            .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        ),
      });
      return stdout;
    } catch {
      throw new BindingEffectUncertainError("WorkOS CLI transport failed");
    }
  }
}

type WorkosEnvironment = {
  id: string;
  name: string;
  sandbox: boolean;
  clientId: string;
};

type WorkosProject = {
  id: string;
  name: string;
  environments: WorkosEnvironment[];
};

function parseTeamId(output: string): string | undefined {
  let value: unknown;
  try { value = JSON.parse(output); } catch { return undefined; }
  if (typeof value !== "object" || value === null) return undefined;
  const team = (value as Record<string, unknown>).team;
  if (typeof team !== "object" || team === null) return undefined;
  const id = (team as Record<string, unknown>).id;
  return typeof id === "string" ? id : undefined;
}

export type WorkosInspection =
  | { state: "absent" }
  | { state: "owned"; environment: WorkosEnvironment }
  | { state: "foreign" }
  | { state: "unknown" };

function parseProjects(output: string): WorkosProject[] | undefined {
  let value: unknown;
  try { value = JSON.parse(output); } catch { return undefined; }
  if (typeof value !== "object" || value === null) return undefined;
  const projects = (value as Record<string, unknown>).projects;
  if (!Array.isArray(projects)) return undefined;
  const parsed: WorkosProject[] = [];
  for (const raw of projects) {
    if (typeof raw !== "object" || raw === null) return undefined;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.name !== "string" || !Array.isArray(item.environments))
      return undefined;
    const environments: WorkosEnvironment[] = [];
    for (const rawEnvironment of item.environments) {
      if (typeof rawEnvironment !== "object" || rawEnvironment === null) return undefined;
      const environment = rawEnvironment as Record<string, unknown>;
      if (
        typeof environment.id !== "string" || typeof environment.name !== "string" ||
        typeof environment.sandbox !== "boolean" || typeof environment.clientId !== "string"
      ) return undefined;
      environments.push(environment as WorkosEnvironment);
    }
    parsed.push({ id: item.id, name: item.name, environments });
  }
  return parsed;
}

export class WorkosAccountTransport {
  private readonly target: ApprovedProviderTarget;
  private readonly resolver: ProviderAuthorityResolver;
  private readonly runner: SafeCommandRunner;

  constructor(target: ApprovedProviderTarget, resolver: ProviderAuthorityResolver, runner: SafeCommandRunner) {
    this.target = target;
    this.resolver = resolver;
    this.runner = runner;
  }

  private command(args: readonly string[]) {
    return this.resolver.withAuthority(this.target.credentialRefs.identity, "workos", async (authority) => {
      if (authority.kind !== "workos-cli-session") throw new Error("INVALID_WORKOS_AUTHORITY");
      return this.runner.run(authority.executable, args);
    });
  }

  async inspect(): Promise<WorkosInspection> {
    let identityOutput: string;
    let output: string;
    try {
      identityOutput = await this.command(["whoami", "--json", "--mode", "ci"]);
      output = await this.command(["project", "list", "--json", "--mode", "ci"]);
    }
    catch { return { state: "unknown" }; }
    if (parseTeamId(identityOutput) !== this.target.workos.teamId) return { state: "foreign" };
    const projects = parseProjects(output);
    if (!projects) return { state: "unknown" };
    const matches = projects.filter((project) => project.id === this.target.workos.projectId);
    if (matches.length !== 1) return { state: "foreign" };
    const project = matches[0];
    const parent = project.environments.find(
      (environment) => environment.id === this.target.workos.parentEnvironmentId,
    );
    if (!parent || !parent.sandbox) return { state: "foreign" };
    const environments = project.environments.filter(
      (environment) => environment.name === this.target.workos.environmentName,
    );
    if (environments.length === 0) return { state: "absent" };
    if (environments.length !== 1 || !environments[0].sandbox) return { state: "foreign" };
    return { state: "owned", environment: environments[0] };
  }

  async createMissing(): Promise<void> {
    const before = await this.inspect();
    if (before.state === "owned") return;
    if (before.state === "foreign") throw new BindingConflictError("WorkOS target conflicts");
    if (before.state === "unknown") throw new BindingEffectUncertainError("WorkOS target inspection failed");
    try {
      await this.command([
        "environment", "create", this.target.workos.environmentName,
        "--sandbox", "--environment-id", this.target.workos.parentEnvironmentId,
        "--json", "--mode", "ci",
      ]);
    } catch (error) {
      if (error instanceof BindingCreateRejectedError) throw error;
      throw new BindingEffectUncertainError("WorkOS environment create outcome uncertain");
    }
    const after = await this.inspect();
    if (after.state !== "owned")
      throw new BindingEffectUncertainError("WorkOS environment was not confirmed");
  }
}
