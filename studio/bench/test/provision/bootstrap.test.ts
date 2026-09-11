import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const benchRoot = resolve(import.meta.dirname, "../..");

test("guest bootstrap is valid shell with checksum-pinned Node and distinct users", async () => {
  const path = join(benchRoot, "scripts/provision/bootstrap-node24.sh");
  const source = await readFile(path, "utf8");
  assert.equal(spawnSync("bash", ["-n", path]).status, 0);
  assert.match(source, /NODE_VERSION="24\.20\.0"/);
  assert.match(source, /2f2c0da162318f0de47665410c7c8c2ed3d36c8f3105de4bbc61176c70a7cbf2/);
  assert.match(source, /studio-runtime/);
  assert.match(source, /studio-builder/);
  assert.match(source, /chmod -R a\+rX,go-w "\$NODE_ROOT"/);
  assert.match(source, /runuser -u "\$SERVICE_USER" -- "\$NODE_ROOT\/bin\/node" --version/);
  assert.doesNotMatch(source, /--env|secretref|PASSWORD=|TOKEN=|KEY=/);
});

test("current bench lock resolves the two installed Pi packages at 0.85.1", () => {
  const script = join(benchRoot, "scripts/provision/verify-pi-install.ts");
  const result = spawnSync(process.execPath, [script, benchRoot], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt.versions, {
    "@earendil-works/pi-coding-agent": "0.85.1",
    "@earendil-works/pi-ai": "0.85.1",
  });
  assert.match(receipt.packageLockSha256, /^[0-9a-f]{64}$/);
});
