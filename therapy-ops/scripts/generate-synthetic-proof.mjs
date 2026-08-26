import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { therapyOpsRoot } from "./catalog-lib.mjs";
import { runSyntheticScenario } from "./synthetic-harness.mjs";

const result = await runSyntheticScenario();
const outputPath = path.join(
  therapyOpsRoot,
  "evidence",
  "synthetic-e2e-proof.json",
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(result.proof, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Generated ${path.relative(therapyOpsRoot, outputPath)} with ` +
    `${result.proof.audit.eventCount} audit events.\n`,
);
