import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

import { proxyRequest } from "../../src/release/proxy.ts";
import type { ApplicationReleaseState } from "../../src/release/types.ts";

function args() {
  const values = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 2) values.set(process.argv[index]!, process.argv[index + 1]!);
  const required = (name: string) => { const value = values.get(name); if (!value) throw new Error(`Missing ${name}`); return value; };
  return { state: required("--state"), clientId: required("--client"), port: Number(required("--port")), ownerToken: required("--owner-token") };
}

const input = args();
const server = createServer(async (request, response) => {
  if (request.url === "/__oceanheart_router") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(`${JSON.stringify({ schemaVersion: 1, ownerToken: input.ownerToken, clientId: input.clientId, port: input.port })}\n`);
    return;
  }
  let state: ApplicationReleaseState;
  try { state = JSON.parse(await readFile(input.state, "utf8")) as ApplicationReleaseState; }
  catch { response.writeHead(503); response.end("No active application release\n"); return; }
  if (state.clientId !== input.clientId || !state.active) { response.writeHead(503); response.end("No active application release\n"); return; }
  if (request.url === "/__oceanheart_active_release") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(`${JSON.stringify({
      schemaVersion: 1, clientId: state.clientId, generation: state.generation,
      releaseId: state.active.releaseId, sourceSha: state.active.sourceSha,
      artifactDigest: state.active.artifactDigest, version: state.active.version,
      schema: state.active.compatibility.schemaVersion, dataTarget: state.active.compatibility.dataTarget,
    })}\n`);
    return;
  }
  proxyRequest(request, response, state.active.publicPort, {
    "x-oceanheart-release-id": state.active.releaseId,
    "x-oceanheart-source-sha": state.active.sourceSha,
    "x-oceanheart-artifact-digest": state.active.artifactDigest,
    "x-oceanheart-data-target": state.active.compatibility.dataTarget,
  });
});
server.listen(input.port, "127.0.0.1");
const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
