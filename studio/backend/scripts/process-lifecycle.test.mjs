import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stopProcessGroup } from "./process-lifecycle.mjs";
test("cleanup terminates descendants after their CLI parent exits", async () => {
  const parent = spawn(
    process.execPath,
    [
      "-e",
      `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(child.pid);setTimeout(()=>process.exit(7),200);`,
    ],
    { detached: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  parent.stdout.on("data", (chunk) => (output += chunk));
  await once(parent, "exit");
  assert.equal(parent.exitCode, 7);
  const pid = Number(output.trim());
  assert.ok(pid > 0);
  try {
    process.kill(pid, 0);
    await stopProcessGroup(parent);
    // A reparented zombie can remain momentarily on Linux. ps state establishes
    // that it is no longer executing rather than relying on PID existence alone.
    let state = "";
    for (let i = 0; i < 30; i++) {
      const ps = spawn("ps", ["-o", "stat=", "-p", String(pid)]);
      let value = "";
      ps.stdout.on("data", (c) => (value += c));
      await once(ps, "exit");
      state = value.trim();
      if (!state || state.startsWith("Z")) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(
      !state || state.startsWith("Z"),
      `Descendant still running: ${state}`,
    );
  } finally {
    try {
      process.kill(-parent.pid, "SIGKILL");
    } catch {}
  }
});
