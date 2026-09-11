import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { resolve } from "node:path";

export const help = `studio-bench — synthetic client workbench

Usage:
  studio-bench run clara --fixture CL-01 [--config baseline] [--state-dir PATH]
  studio-bench eval clara [--output-dir PATH] [--state-dir PATH]
  studio-bench plan MANIFEST
  studio-bench inspect CLIENT --state-dir PATH
  studio-bench export-template --source-repo PATH --sha FULL_SHA --output-dir PATH

Run/eval use fictional records and the pinned Pi SDK with a deterministic model
transport. They make no paid inference, mailbox or billing calls. Local execution
is not hosted environment acceptance. State defaults outside the repository.
`;

export class UsageError extends Error {}

export interface CliOptions {
  command: "help" | "run" | "eval" | "plan" | "inspect" | "export-template";
  subject?: string;
  fixture?: string;
  configuration: string;
  stateDir: string;
  outputDir?: string;
  sourceRepo?: string;
  sha?: string;
}

export function parseCli(argv: string[]): CliOptions {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        fixture: { type: "string" },
        config: { type: "string" },
        "state-dir": { type: "string" },
        "output-dir": { type: "string" },
        "source-repo": { type: "string" },
        sha: { type: "string" },
      },
    });
  } catch {
    throw new UsageError("Invalid command options. Use --help for supported arguments.");
  }
  const { values, positionals } = parsed;
  const [command = "help", subject, ...extra] = positionals;
  const stateDir = resolve(String(values["state-dir"] ?? `${homedir()}/.local/state/oceanheart-bench`));
  const base = { configuration: String(values.config ?? "baseline"), stateDir };
  if (values.help || command === "help") return { ...base, command: "help" };
  if (!["run", "eval", "plan", "inspect", "export-template"].includes(command) || extra.length) {
    throw new UsageError("Unknown command or unexpected positional arguments. Use --help.");
  }
  const allowed: Record<string, string[]> = {
    run: ["fixture", "config", "state-dir"],
    eval: ["state-dir", "output-dir"],
    plan: [],
    inspect: ["state-dir"],
    "export-template": ["source-repo", "sha", "output-dir"],
  };
  if (Object.keys(values).some((key) => !allowed[command].includes(key))) {
    throw new UsageError("This command does not accept one or more supplied options. Use --help.");
  }
  if ((command === "run" || command === "eval") && subject !== "clara") {
    throw new UsageError("The pilot supports the fictional Clara workflow only.");
  }
  if (command === "run" && !values.fixture) throw new UsageError("run requires --fixture.");
  if ((command === "inspect" || command === "plan") && !subject) throw new UsageError("This command requires a subject.");
  if (command === "export-template" && (subject || !values.sha || !values["source-repo"] || !values["output-dir"])) {
    throw new UsageError("export-template requires --source-repo, --sha and --output-dir.");
  }
  return {
    ...base,
    command: command as CliOptions["command"],
    subject,
    fixture: values.fixture as string | undefined,
    outputDir: values["output-dir"] ? resolve(String(values["output-dir"])) : undefined,
    sourceRepo: values["source-repo"] ? resolve(String(values["source-repo"])) : undefined,
    sha: values.sha as string | undefined,
  };
}
