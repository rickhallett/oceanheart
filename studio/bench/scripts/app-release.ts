import { resolve } from "node:path";

import { packageStudioApplication, verifyStudioSource } from "../src/release/artifact.ts";
import { LocalApplicationReleaseController } from "../src/release/controller.ts";

const command = process.argv[2];
const values = new Map<string, string>();
for (let index = 3; index < process.argv.length; index += 2) values.set(process.argv[index]!, process.argv[index + 1]!);
const required = (name: string) => { const value = values.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
const number = (name: string) => Number(required(name));

if (command === "package") {
  await verifyStudioSource(resolve(required("--repository-root")), required("--source-sha"), required("--studio-tree"));
  const result = await packageStudioApplication({
    builtStudioRoot: resolve(required("--studio-root")),
    destinationRoot: resolve(required("--destination")),
    clientId: required("--client"), sourceSha: required("--source-sha"), studioTreeSha: required("--studio-tree"),
    version: required("--version"),
    compatibility: { schemaVersion: required("--schema"), dataTarget: required("--data-target"), change: "none" },
    health: { path: values.get("--health-path") ?? "/app?demo=1", status: Number(values.get("--health-status") ?? "200"), contains: values.get("--health-contains") ?? "oceanheart Studio" },
  });
  console.log(JSON.stringify(result, null, 2));
} else {
  const controller = new LocalApplicationReleaseController({
    stateRoot: resolve(required("--state")), clientId: required("--client"),
  });
  if (command === "activate") console.log(JSON.stringify(await controller.activate({
    manifestPath: resolve(required("--manifest")), routerPort: number("--router-port"),
    publicPort: number("--public-port"), applicationPort: number("--application-port"),
    timeoutMs: Number(values.get("--timeout-ms") ?? "60000"),
  }), null, 2));
  else if (command === "rollback") console.log(JSON.stringify(await controller.rollback({
    targetReleaseId: required("--release"), routerPort: number("--router-port"),
    publicPort: number("--public-port"), applicationPort: number("--application-port"),
    timeoutMs: Number(values.get("--timeout-ms") ?? "60000"),
  }), null, 2));
  else if (command === "status") console.log(JSON.stringify(await controller.state(), null, 2));
  else if (command === "stop") console.log(JSON.stringify(await controller.stop(), null, 2));
  else throw new Error("Usage: app-release.ts package|activate|rollback|status|stop ...");
}
