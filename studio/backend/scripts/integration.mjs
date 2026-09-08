import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdir,
  cp,
  writeFile,
  symlink,
  rm,
  readFile,
  mkdtemp,
  stat,
} from "node:fs/promises";
import { createServer } from "node:net";
import { resolve, basename } from "node:path";
import { homedir } from "node:os";
import { once } from "node:events";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { ConvexHttpClient } from "convex/browser";
const root = resolve(import.meta.dirname, "..");
const cli = resolve(root, "node_modules/convex/bin/main.js");
await mkdir(resolve(root, ".local"), { recursive: true });
const runDir = await mkdtemp(resolve(root, ".local", "integration-"));
const issuer = "https://studio-test.invalid";
const audience = "studio-local-verification";
const report = {
  runtime: "real local Convex backend over HTTP",
  authentication:
    "RS256 bearer JWT verified by backend; no admin identity injection",
  checks: [],
};
const check = (name) => {
  report.checks.push(name);
  console.log(`PASS ${name}`);
};
const env = {
  ...process.env,
  CONVEX_AGENT_MODE: "anonymous",
  CONVEX_TELEMETRY_DISABLED: "1",
};
for (const key of Object.keys(env))
  if (
    key.startsWith("CONVEX_") &&
    !["CONVEX_AGENT_MODE", "CONVEX_TELEMETRY_DISABLED"].includes(key)
  )
    delete env[key];
async function port() {
  const s = createServer();
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  const p = s.address().port;
  await new Promise((r) => s.close(r));
  return p;
}
async function command(args) {
  const p = spawn(process.execPath, [cli, ...args], {
    cwd: runDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  p.stdout.on("data", (d) => (output += d));
  p.stderr.on("data", (d) => (output += d));
  const [code] = await once(p, "exit");
  if (code !== 0) throw new Error(`convex ${args[0]} failed: ${output}`);
  return output;
}
async function until(test, label) {
  const end = Date.now() + 180000;
  while (Date.now() < end) {
    if (await test()) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout: ${label}`);
}
let backend,
  logs = "";
try {
  // Convex 1.45.0 otherwise falls back to legacy home state for this fixed
  // agent name. Fail before starting the CLI rather than touching another DB.
  const legacy = resolve(
    homedir(),
    ".convex",
    "anonymous-convex-backend-state",
    "anonymous-agent",
  );
  if (
    await stat(legacy).then(
      () => true,
      () => false,
    )
  )
    throw new Error(
      "Refusing test: legacy anonymous-agent state exists; use a clean CI worker.",
    );
  await cp(resolve(root, "convex"), resolve(runDir, "convex"), {
    recursive: true,
  });
  for (const file of ["package.json", "tsconfig.json"])
    await cp(resolve(root, file), resolve(runDir, file));
  await symlink(
    resolve(root, "node_modules"),
    resolve(runDir, "node_modules"),
    "dir",
  );
  const cloudPort = await port();
  let sitePort = await port();
  while (sitePort === cloudPort) sitePort = await port();
  backend = spawn(
    process.execPath,
    [
      cli,
      "dev",
      "--skip-push",
      "--local-cloud-port",
      String(cloudPort),
      "--local-site-port",
      String(sitePort),
      "--tail-logs",
      "disable",
    ],
    { cwd: runDir, env, stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  backend.stdout.on("data", (d) => (logs += d));
  backend.stderr.on("data", (d) => (logs += d));
  await until(async () => {
    if (backend.exitCode !== null) throw new Error(logs);
    try {
      return (await fetch(`http://127.0.0.1:${cloudPort}/instance_name`)).ok;
    } catch {
      return false;
    }
  }, "local backend startup");
  await until(async () => {
    try {
      return (await readFile(resolve(runDir, ".env.local"), "utf8")).includes(
        "CONVEX_DEPLOYMENT=",
      );
    } catch {
      return false;
    }
  }, "local deployment configuration");
  // Only an ephemeral public verification key is installed. The signing key stays
  // in this process and is never written or exposed to the backend/CLI.
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "integration",
    alg: "RS256",
    use: "sig",
  };
  const jwks =
    "data:text/plain;charset=utf-8;base64," +
    Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64");
  await writeFile(
    resolve(runDir, ".auth.env"),
    `STUDIO_AUTH_ISSUER=${issuer}\nSTUDIO_AUTH_AUDIENCE=${audience}\nSTUDIO_AUTH_JWKS=${jwks}\n`,
  );
  await command(["env", "set", "--from-file", ".auth.env"]);
  const localConfig = JSON.parse(
    await readFile(
      resolve(runDir, ".convex/local/default/config.json"),
      "utf8",
    ),
  );
  await writeFile(
    resolve(runDir, ".push.env"),
    `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:${cloudPort}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${localConfig.adminKey}\n`,
    { mode: 0o600 },
  );
  // Explicit completed push against the existing local instance; no stale log
  // readiness heuristic and no privileged identity is used by the API tests.
  await command(["dev", "--once", "--env-file", ".push.env"]);
  const token = async (sub, opts = {}) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "integration", typ: "JWT" })
      .setIssuer(opts.issuer ?? issuer)
      .setAudience(opts.audience ?? audience)
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime(opts.expiry ?? "5m")
      .sign(opts.key ?? privateKey);
  const client = async (sub, opts) => {
    const c = new ConvexHttpClient(`http://127.0.0.1:${cloudPort}`, {
      logger: false,
    });
    if (sub) c.setAuth(await token(sub, opts));
    return c;
  };
  const alice = await client("alice"),
    bob = await client("bob"),
    viewer = await client("viewer"),
    anonymous = await client();
  const tenantA = await alice.mutation("tenants:create", {
      name: "Practice A",
    }),
    tenantB = await bob.mutation("tenants:create", { name: "Practice B" });
  const start = Date.UTC(2030, 0, 10, 9);
  const hour = 3600000;
  const booking = {
    tenantId: tenantA,
    practitionerId: "rick",
    startsAt: start,
    endsAt: start + hour,
    clientLabel: "Synthetic client",
    requestKey: "first",
  };
  const window = {
    tenantId: tenantA,
    practitionerId: "rick",
    from: start,
    to: start + 24 * hour,
  };
  const denied = async (p, code) =>
    assert.rejects(p, (e) => String(e).includes(code));
  await denied(anonymous.query("bookings:list", window), "UNAUTHENTICATED");
  await denied(
    anonymous.mutation("bookings:create", booking),
    "UNAUTHENTICATED",
  );
  check("anonymous reads and writes rejected");
  await denied(bob.query("bookings:list", window), "FORBIDDEN");
  await denied(bob.mutation("bookings:create", booking), "FORBIDDEN");
  check("cross-tenant reads and writes rejected");
  // Requests travel over independent HTTP clients, so there is no client mutation queue.
  const contenders = await Promise.all(
    Array.from({ length: 12 }, () => client("alice")),
  );
  const same = await Promise.all(
    contenders.map((c) => c.mutation("bookings:create", booking)),
  );
  assert.equal(new Set(same).size, 1);
  assert.equal((await alice.query("bookings:list", window)).items.length, 1);
  check("12 concurrent identical requests produce one booking and one id");
  await denied(
    alice.mutation("bookings:create", {
      ...booking,
      clientLabel: "Changed payload",
    }),
    "IDEMPOTENCY_MISMATCH",
  );
  check("request-key reuse with changed payload rejected");
  const overlapResults = await Promise.allSettled(
    contenders.map((c, i) =>
      c.mutation("bookings:create", {
        ...booking,
        startsAt: start + 2 * hour,
        endsAt: start + 3 * hour,
        requestKey: `race-${i}`,
      }),
    ),
  );
  assert.equal(
    overlapResults.filter((r) => r.status === "fulfilled").length,
    1,
  );
  assert.equal(
    overlapResults.filter(
      (r) =>
        r.status === "rejected" &&
        String(r.reason).includes("BOOKING_CONFLICT"),
    ).length,
    11,
  );
  check(
    "12 concurrent different overlapping requests: one success, 11 conflicts",
  );
  await denied(
    alice.mutation("bookings:create", {
      ...booking,
      startsAt: start - 1000,
      endsAt: start + hour + 1000,
      requestKey: "contains",
    }),
    "BOOKING_CONFLICT",
  );
  await denied(
    alice.mutation("bookings:create", {
      ...booking,
      startsAt: start + 1000,
      endsAt: start + 2000,
      requestKey: "contained",
    }),
    "BOOKING_CONFLICT",
  );
  check("containing and contained intervals both conflict");
  await alice.mutation("bookings:create", {
    ...booking,
    startsAt: start + hour,
    endsAt: start + 2 * hour,
    requestKey: "adjacent",
  });
  check("half-open adjacent bookings accepted");
  await bob.mutation("bookings:create", { ...booking, tenantId: tenantB });
  await alice.mutation("bookings:create", {
    ...booking,
    practitionerId: "other",
    requestKey: "other",
  });
  check("same interval isolated by tenant and practitioner");
  await denied(
    alice.mutation("bookings:create", {
      ...booking,
      endsAt: start,
      requestKey: "zero",
    }),
    "INVALID_INTERVAL",
  );
  await denied(
    alice.mutation("bookings:create", {
      ...booking,
      endsAt: start + 25 * hour,
      requestKey: "long",
    }),
    "INVALID_INTERVAL",
  );
  check("zero and excessive duration rejected");
  await alice.mutation("tenants:addViewer", {
    tenantId: tenantA,
    identity: `${issuer}|viewer`,
  });
  assert.equal((await viewer.query("bookings:list", window)).items.length, 3);
  await denied(
    viewer.mutation("bookings:create", { ...booking, requestKey: "viewer" }),
    "FORBIDDEN",
  );
  await denied(
    viewer.mutation("tenants:addViewer", {
      tenantId: tenantA,
      identity: `${issuer}|bob`,
    }),
    "FORBIDDEN",
  );
  check("viewer can read, cannot book or grant membership");
  await alice.mutation("tenants:removeViewer", {
    tenantId: tenantA,
    identity: `${issuer}|viewer`,
  });
  await denied(viewer.query("bookings:list", window), "FORBIDDEN");
  check("membership revocation applies with the same still-valid JWT");
  const wrongKeys = await generateKeyPair("RS256");
  for (const [name, opts] of [
    ["wrong signature", { key: wrongKeys.privateKey }],
    ["wrong issuer", { issuer: "https://wrong.invalid" }],
    ["wrong audience", { audience: "wrong-app" }],
    ["expired token", { expiry: Math.floor(Date.now() / 1000) - 60 }],
  ]) {
    const bad = await client("alice", opts);
    await assert.rejects(bad.query("bookings:list", window));
    check(`${name} rejected by real backend`);
  }
  const boundaryWindow = await alice.query("bookings:list", {
    ...window,
    from: start + 1,
    to: start + hour,
  });
  assert.equal(boundaryWindow.items.length, 0);
  assert.equal(boundaryWindow.hasMore, false);
  check("list uses starts-within half-open window semantics");
  for (let i = 0; i < 201; i++)
    await alice.mutation("bookings:create", {
      ...booking,
      practitionerId: "pagination",
      startsAt: start + i * 60000,
      endsAt: start + (i + 1) * 60000,
      requestKey: `page-${i}`,
    });
  const limited = await alice.query("bookings:list", {
    ...window,
    practitionerId: "pagination",
  });
  assert.equal(limited.items.length, 200);
  assert.equal(limited.hasMore, true);
  assert.equal(limited.limit, 200);
  check("list truncation explicitly reported with hasMore and limit");
  check("type-generated tenant-scoped API deployed successfully");
  await mkdir(resolve(root, ".local"), { recursive: true });
  await writeFile(
    resolve(root, ".local", "last-report.json"),
    JSON.stringify(
      { ...report, verifiedAt: new Date().toISOString() },
      null,
      2,
    ) + "\n",
  );
  await mkdir(resolve(root, ".local/reports"), { recursive: true });
  await cp(
    resolve(root, ".local/last-report.json"),
    resolve(root, ".local/reports", `${basename(runDir)}.json`),
  );
  console.log(
    JSON.stringify({
      passed: report.checks.length,
      report: ".local/last-report.json",
    }),
  );
} catch (error) {
  console.error(error);
  console.error(logs.slice(-5000));
  process.exitCode = 1;
} finally {
  if (backend && backend.exitCode === null) {
    backend.kill("SIGINT");
    await Promise.race([
      once(backend, "exit"),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    if (backend.exitCode === null)
      try {
        process.kill(-backend.pid, "SIGKILL");
      } catch {}
  }
  await rm(runDir, { recursive: true, force: true });
}
