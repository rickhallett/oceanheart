import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { therapyOpsRoot } from "./catalog-lib.mjs";

async function runFile(context, relativePath) {
  const source = await readFile(
    path.join(therapyOpsRoot, "apps-script", "src", relativePath),
    "utf8",
  );
  vm.runInContext(source, context, {
    filename: relativePath,
  });
}

export async function loadCore() {
  const context = vm.createContext({
    console,
  });
  await runFile(context, "GeneratedCatalog.gs");
  await runFile(context, "Core.gs");
  return context;
}

export async function loadMain(context) {
  await runFile(context, "Main.gs");
  return context;
}
