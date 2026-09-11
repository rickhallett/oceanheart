import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";

import { verifyArtifact, applicationReleaseId } from "../../src/release/artifact.ts";
import { proxyRequest } from "../../src/release/proxy.ts";

function args() {
  const values = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) values.set(process.argv[index]!, process.argv[index + 1]!);
  const required = (name: string) => { const value = values.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
  return {
    manifest: required("--manifest"),
    publicPort: Number(required("--public-port")), applicationPort: Number(required("--application-port")),
    ownerToken: required("--owner-token"),
  };
}

const input = args();
const { manifest, payload } = await verifyArtifact(input.manifest);
const releaseId = applicationReleaseId(manifest);
const child = spawn(process.execPath, [join(payload, "server.js")], {
  cwd: payload,
  stdio: ["ignore", "inherit", "inherit"],
  env: {
    PATH: process.env.PATH ?? "/usr/bin:/bin", NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(input.applicationPort), HOSTNAME: "127.0.0.1", TMPDIR: process.env.TMPDIR ?? "/tmp",
  },
});

let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => { if (!stopping) process.exit(code ?? 1); });

const server = createServer((request, response) => {
  if (request.url === "/__oceanheart_release") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(`${JSON.stringify({
      schemaVersion: 1, ownerToken: input.ownerToken, releaseId,
      clientId: manifest.clientId, sourceSha: manifest.sourceSha,
      artifactDigest: manifest.artifactDigest, version: manifest.version,
      schema: manifest.compatibility.schemaVersion, dataTarget: manifest.compatibility.dataTarget,
      applicationPort: input.applicationPort,
    })}\n`);
    return;
  }
  proxyRequest(request, response, input.applicationPort, {
    "x-oceanheart-release-id": releaseId,
    "x-oceanheart-source-sha": manifest.sourceSha,
    "x-oceanheart-artifact-digest": manifest.artifactDigest,
    "x-oceanheart-data-target": manifest.compatibility.dataTarget,
  });
});
server.listen(input.publicPort, "127.0.0.1");
