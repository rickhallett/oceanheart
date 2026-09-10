import { sourceLibraryChecks } from "./source-library-checks.mjs";
import {gmailChecks} from "./gmail-checks.mjs";
import {randomBytes} from "node:crypto";
import { enquiryChecks } from "./enquiry-checks.mjs";
import { bookingWorkflowChecks } from "./booking-workflow-checks.mjs";
import { bookingHoursChecks } from "./booking-hours-checks.mjs";
import { recordManagementChecks } from "./record-management-checks.mjs";
import { settingsChecks } from "./settings-checks.mjs";
import { catalogChecks } from "./catalog-checks.mjs";
import { taskMaintenanceChecks } from "./task-maintenance-checks.mjs";
import { todayChecks } from "./today-checks.mjs";
import { clientNotesChecks } from "./client-notes-checks.mjs";
import { stopProcessGroup } from "./process-lifecycle.mjs";
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
    "RS256 bearer JWT verified by backend; Gmail transitions use an allowlisted local-only test adapter, never hosted source.",
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
    if (backend && backend.exitCode !== null)
      throw new Error(`Local backend exited unexpectedly: ${backend.exitCode}`);
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
  // This allowlisted adapter exists ONLY in the isolated local copy, never hosted source.
  await writeFile(resolve(runDir,"convex/gmailTest.ts"), `import {action} from "./_generated/server";
import {internal} from "./_generated/api";
import {v} from "convex/values";
export const transition=action({args:{name:v.union(v.literal("consume"),v.literal("finish"),v.literal("importMessage"),v.literal("disconnect"),v.literal("expireState")),args:v.any()},handler:async(ctx,{name,args}):Promise<any>=>ctx.runMutation(internal.gmailInternal[name],args)});
`);
  for (const file of ["package.json", "tsconfig.json", "auth-policy.ts"])
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
  const boundConfig = JSON.parse(
    await readFile(
      resolve(runDir, ".convex/local/default/config.json"),
      "utf8",
    ),
  );
  assert.equal(
    boundConfig.ports.cloud,
    cloudPort,
    "Backend selected an unexpected port; refusing to use it",
  );
  assert.equal(
    boundConfig.ports.site,
    sitePort,
    "HTTP backend selected an unexpected port; refusing to use it",
  );
  // Only an ephemeral public verification key is installed. The signing key stays
  // in this process and is never written or exposed to the backend/CLI.
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: "integration",
    alg: "RS256",
    use: "sig",
  };
  const gmailSigning=randomBytes(32).toString("base64"),gmailEncryption=randomBytes(32).toString("base64");
  const jwks =
    "data:text/plain;charset=utf-8;base64," +
    Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64");
  await writeFile(
    resolve(runDir, ".auth.env"),
    `STUDIO_AUTH_MODE=local-jwt\nWORKOS_CLIENT_ID=\nCLERK_JWT_ISSUER_DOMAIN=\nSTUDIO_AUTH_ISSUER=${issuer}\nSTUDIO_AUTH_AUDIENCE=${audience}\nSTUDIO_AUTH_JWKS=${jwks}\nGOOGLE_CLIENT_ID=synthetic-client\nGOOGLE_CLIENT_SECRET=synthetic-secret\nGOOGLE_REDIRECT_URI=https://studio.invalid/practice/integrations/gmail/callback\nGMAIL_TOKEN_ENCRYPTION_KEY=${gmailEncryption}\nGMAIL_ROUTE_SIGNING_KEY=${gmailSigning}\n`,
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
  await cp(
    resolve(runDir, "convex/_generated"),
    resolve(root, ".local/generated"),
    { recursive: true },
  );
  assert.equal(
    (await readFile(resolve(runDir, "convex/_generated/api.d.ts"), "utf8")).split("\n").filter(line=>!line.includes("gmailTest")).join("\n"),
    await readFile(resolve(root, "convex/_generated/api.d.ts"), "utf8"),
    "Generated API drift: inspect .local/generated and update the committed types",
  );
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
  if (process.env.STUDIO_INTEGRATION_SLICE === "source-library") {
    await sourceLibraryChecks({alice,bob,viewer,anonymous,viewerIdentity:`${issuer}|viewer`,check});
  } else {
  const tenantA = await alice.mutation("tenants:create", {
      name: "Practice A",
    }),
    tenantB = await bob.mutation("tenants:create", { name: "Practice B" });
  await assert.rejects(anonymous.query("tenants:list", {}), /UNAUTHENTICATED/);
  assert.deepEqual(await alice.query("tenants:list", {}), [
    { _id: tenantA, name: "Practice A", role: "owner" },
  ]);
  assert.deepEqual(await bob.query("tenants:list", {}), [
    { _id: tenantB, name: "Practice B", role: "owner" },
  ]);
  assert.deepEqual(await viewer.query("tenants:list", {}), []);
  check("practice discovery derives only the authenticated user's memberships");
  await assert.rejects(anonymous.mutation("tenants:create", {name:"Denied"}), /UNAUTHENTICATED/);
  await assert.rejects(alice.mutation("tenants:create", {name:" "}), /INVALID_NAME/);
  const practiceRequest = {name:"Explicit retry practice", requestKey:"practice-retry"};
  const practiceRetries = await Promise.all([alice.mutation("tenants:create", practiceRequest), alice.mutation("tenants:create", practiceRequest)]);
  assert.equal(practiceRetries[0], practiceRetries[1]);
  await assert.rejects(alice.mutation("tenants:create", {...practiceRequest,name:"Different"}), /IDEMPOTENCY_MISMATCH/);
  check("practice creation validates input and repeated requests create one practice");
  const seedArgs={sourceTenantId:tenantA,ownerIdentity:`${issuer}|alice`};
  await assert.rejects(command(["run","--env-file",".push.env","demoSeed:seedRick",JSON.stringify({...seedArgs,ownerIdentity:`${issuer}|bob`})]),/OWNER_REQUIRED/);
  await assert.rejects(alice.mutation("demoSeed:seedRick",seedArgs));
  const seeded=JSON.parse(await command(["run","--env-file",".push.env","demoSeed:seedRick",JSON.stringify(seedArgs)]));
  assert.equal(seeded.created,true);assert.equal(seeded.clients,24);assert.equal(seeded.bookings,48);
  const demoPage=await alice.query("clients:list",{tenantId:seeded.tenantId,paginationOpts:{numItems:50,cursor:null}});
  assert.equal(demoPage.page.length,23);
  const demoClient=demoPage.page[0];
  await alice.mutation("clients:saveNotes",{tenantId:seeded.tenantId,clientId:demoClient._id,text:"An edit to keep",expectedRevision:0});
  const retried=JSON.parse(await command(["run","--env-file",".push.env","demoSeed:seedRick",JSON.stringify(seedArgs)]));
  assert.equal(retried.created,false);assert.equal(retried.tenantId,seeded.tenantId);
  assert.equal((await alice.query("clients:notes",{tenantId:seeded.tenantId,clientId:demoClient._id})).text,"An edit to keep");
  await assert.rejects(bob.query("clients:list",{tenantId:seeded.tenantId,paginationOpts:{numItems:50,cursor:null}}),/FORBIDDEN/);
  check("demo seed is internal, owner-bound, isolated and retry-safe without overwriting edits");
  const taskArgs = {tenantId:tenantA,title:"First live task",requestKey:"task-one"};
  const taskClients = await Promise.all(Array.from({length:8},()=>client("alice")));
  const taskIds = await Promise.all(taskClients.map(c=>c.mutation("tasks:create",taskArgs)));
  assert.equal(new Set(taskIds).size,1);
  const taskId = taskIds[0];
  assert.equal(await alice.mutation("tasks:create",taskArgs),taskId);
  await assert.rejects(alice.mutation("tasks:create",{...taskArgs,title:"Different"}),/IDEMPOTENCY_MISMATCH/);
  for (const caller of [anonymous,bob]) {
    const error = caller === anonymous ? /UNAUTHENTICATED/ : /FORBIDDEN/;
    await assert.rejects(caller.query("tasks:list",{tenantId:tenantA}),error);
    await assert.rejects(caller.mutation("tasks:create",taskArgs),error);
    await assert.rejects(caller.mutation("tasks:setCompleted",{tenantId:tenantA,taskId,completed:true}),error);
  }
  await assert.rejects(bob.mutation("tasks:setCompleted",{tenantId:tenantB,taskId,completed:true}),/FORBIDDEN/);
  for (const title of [" ","x".repeat(201),"line\nbreak"]) await assert.rejects(alice.mutation("tasks:create",{...taskArgs,title,requestKey:"invalid"}),/INVALID_TITLE/);
  for (const requestKey of [""," padded","x".repeat(129)]) await assert.rejects(alice.mutation("tasks:create",{...taskArgs,requestKey}),/INVALID_REQUEST_KEY/);
  await alice.mutation("tasks:setCompleted",{tenantId:tenantA,taskId,completed:true});
  await alice.mutation("tasks:setCompleted",{tenantId:tenantA,taskId,completed:true});
  const freshAlice = await client("alice");
  assert.equal((await freshAlice.query("tasks:list",{tenantId:tenantA})).items[0].completed,true);
  await alice.mutation("tasks:setCompleted",{tenantId:tenantA,taskId,completed:false});
  assert.equal((await freshAlice.query("tasks:list",{tenantId:tenantA})).items[0].completed,false);
  const secondTask = await alice.mutation("tasks:create",{...taskArgs,title:"Second task",requestKey:"task-two"});
  assert.equal((await alice.query("tasks:list",{tenantId:tenantA})).items[0]._id,secondTask);
  check("tasks persist across clients; anonymous, cross-tenant and invalid commands denied; eight concurrent retries create one task; completion and reopening persist; newest-first ordering");
  await taskMaintenanceChecks({
    alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity:`${issuer}|viewer`,clientForOwner:()=>client("alice"),check,
    seedForeignLinkedTask:async(foreignClientId)=>{
      const malformed={tenantId:tenantA,title:"Malformed foreign-linked task",completed:false,createdAt:Date.now(),createdBy:`${issuer}|alice`,requestKey:"malformed-foreign-linked-task",clientId:foreignClientId};
      await writeFile(resolve(runDir,"malformed-foreign-linked-task.json"),JSON.stringify([malformed]));
      await command(["import","--env-file",".push.env","--table","tasks","--append","malformed-foreign-linked-task.json"]);
      const task=(await alice.query("tasks:list",{tenantId:tenantA})).items.find(item=>item.title===malformed.title);
      assert.ok(task,"malformed foreign-linked task import was not visible to native task query");
      return task._id;
    },
    seedBoundaryTasks:async()=>{
      const legacy={tenantId:tenantA,title:"Legacy task",completed:false,createdAt:1,createdBy:`${issuer}|alice`,requestKey:"legacy-task"};
      await writeFile(resolve(runDir,"legacy-task.json"),JSON.stringify([legacy]));
      await command(["import","--env-file",".push.env","--table","tasks","--append","legacy-task.json"]);
      const legacyTask=(await alice.query("tasks:list",{tenantId:tenantA,filter:"open"})).items.find(task=>task.title==="Legacy task");
      assert.ok(legacyTask,"legacy task import was not visible to native task query");
      const rows=[
        ...Array.from({length:201},(_,index)=>({tenantId:tenantA,title:`Open boundary task ${index}`,completed:false,createdAt:index+2,createdBy:`${issuer}|alice`,requestKey:`open-boundary-${index}`})),
        ...Array.from({length:201},(_,index)=>({tenantId:tenantA,title:`Completed boundary task ${index}`,completed:true,createdAt:index+203,createdBy:`${issuer}|alice`,requestKey:`completed-boundary-${index}`})),
        ...Array.from({length:250},(_,index)=>({tenantId:tenantA,title:`Removed boundary task ${index}`,completed:false,removedAt:index+1,createdAt:index+404,createdBy:`${issuer}|alice`,requestKey:`removed-boundary-${index}`})),
      ];
      await writeFile(resolve(runDir,"task-boundary.json"),JSON.stringify(rows));
      await command(["import","--env-file",".push.env","--table","tasks","--append","task-boundary.json"]);
      return legacyTask._id;
    },
  });
  await catalogChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity:`${issuer}|viewer`,clientForOwner:()=>client("alice"),check,prefix:"catalog-local"});
  await recordManagementChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity:`${issuer}|viewer`,clientForOwner:()=>client("alice"),check,prefix:"managementlocal"});
  await clientNotesChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity:`${issuer}|viewer`,clientForOwner:()=>client("alice"),check});
  await settingsChecks({alice,bob,viewer,anonymous,viewerIdentity:`${issuer}|viewer`,clientForOwner:()=>client("alice"),check,prefix:"settings-local"});
  await writeFile(resolve(runDir,"legacy-clients.json"),JSON.stringify(Array.from({length:101},(_,i)=>({tenantId:tenantA,name:i===0?"Legacy backfill fixture":`Migration auxiliary ${i}`,email:"legacy@example.com",createdAt:123,createdBy:`${issuer}|alice`,requestKey:`legacy-fixture-${i}`}))));
  await command(["import","--env-file",".push.env","--table","clients","--append", "legacy-clients.json"]);
  let backfillCursor=null,backfillUpdated=0,backfillPages=0;
  do {
    const batch=JSON.parse(await command(["run","--env-file",".push.env","migrations:backfillClientSearch",JSON.stringify({cursor:backfillCursor})]));
    assert.ok(batch.scanned<=100);backfillUpdated+=batch.updated;backfillPages++;
    if(batch.isDone)break;backfillCursor=batch.continueCursor;assert.ok(backfillPages<10);
  }while(true);
  assert.equal(backfillUpdated,101);assert.ok(backfillPages>=2);
  const migrated=await alice.query("clients:list",{tenantId:tenantA,search:"backfill",paginationOpts:{numItems:50,cursor:null}});
  assert.equal(migrated.page.length,1);assert.equal(migrated.page[0].name,"Legacy backfill fixture");assert.equal(migrated.page[0].email,"legacy@example.com");assert.equal(migrated.page[0].createdAt,123);assert.equal(migrated.page[0].revision,0);
  const migrationId=migrated.page[0]._id;
  await command(["run","--env-file",".push.env","migrations:backfillClientSearch",JSON.stringify({cursor:null})]);
  assert.equal((await alice.query("clients:list",{tenantId:tenantA,search:"backfill",paginationOpts:{numItems:50,cursor:null}})).page[0]._id,migrationId);
  check("internal bounded backfill makes legacy contacts searchable, preserves fields/ID and is repeatable");
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
  await denied(alice.mutation("bookings:create", {...booking,practitionerId:"other",requestKey:"other"}),"BOOKING_CONFLICT");
  check("same interval isolated by tenant; alternate practitioner keys cannot bypass single lane");
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
  for (const identity of [
    "",
    " ",
    "\t\n",
    `${issuer}|viewer `,
    ` ${issuer}|viewer`,
  ]) {
    for (const operation of ["tenants:addViewer", "tenants:removeViewer"]) {
      await denied(
        alice.mutation(operation, { tenantId: tenantA, identity }),
        "INVALID_IDENTITY",
      );
    }
  }
  check(
    "membership add and remove reject empty, whitespace and padded opaque identities",
  );
  await alice.mutation("tenants:addViewer", {
    tenantId: tenantA,
    identity: `${issuer}|viewer`,
  });
  assert.deepEqual(await viewer.query("tenants:list", {}), [
    { _id: tenantA, name: "Practice A", role: "viewer" },
  ]);
  await denied(viewer.query("bookings:list", window),"FORBIDDEN");
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
  assert.equal((await viewer.query("tasks:list",{tenantId:tenantA})).items.length,200);
  await denied(viewer.mutation("tasks:create",{...taskArgs,requestKey:"viewer"}),"FORBIDDEN");
  await denied(viewer.mutation("tasks:setCompleted",{tenantId:tenantA,taskId,completed:false}),"FORBIDDEN");
  check("viewer can read tasks, cannot create or complete them");
  check("viewer cannot read booking contacts, book or grant membership");
  await alice.mutation("tenants:removeViewer", {
    tenantId: tenantA,
    identity: `${issuer}|viewer`,
  });
  await denied(viewer.query("bookings:list", window), "FORBIDDEN");
  assert.deepEqual(await viewer.query("tenants:list", {}), []);
  await denied(viewer.query("tasks:list",{tenantId:tenantA}),"FORBIDDEN");
  await denied(viewer.mutation("tasks:setCompleted",{tenantId:tenantA,taskId,completed:false}),"FORBIDDEN");
  check("membership revocation applies with the same still-valid JWT to tasks and bookings");
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
  assert.equal(boundaryWindow.items.length, 1);
  assert.equal(boundaryWindow.hasMore, false);
  check("list includes overlapping intervals using half-open window semantics");
  for (let i = 0; i < 201; i++)
    await alice.mutation("bookings:create", {
      ...booking,
      practitionerId: "pagination",
      startsAt: start + 10 * hour + i * 60000,
      endsAt: start + 10 * hour + (i + 1) * 60000,
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
  const bookingFixtures=await bookingWorkflowChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity:`${issuer}|viewer`,clientForOwner:()=>client("alice"),check,prefix:"booking-local"});
  await bookingHoursChecks({alice,bob,viewer,check,prefix:"hours-local"});
  const oldStart=Date.UTC(2041,0,10,9),oldArgs={tenantId:tenantA,practitionerId:"pre-upgrade",startsAt:oldStart,endsAt:oldStart+3600000,clientLabel:"Pre-upgrade booking",requestKey:"pre-upgrade"};
  await writeFile(resolve(runDir,"legacy-bookings.json"),JSON.stringify([{...oldArgs,createdBy:`${issuer}|alice`}]));
  await command(["import","--env-file",".push.env","--table","bookings","--append","legacy-bookings.json"]);
  const oldRow=(await alice.query("bookings:list",{tenantId:tenantA,from:oldStart,to:oldStart+86400000})).items[0];
  assert.equal(oldRow.status,"scheduled");assert.equal(oldRow.revision,0);assert.equal(oldRow.legacy,true);
  await denied(alice.mutation("bookings:createLinked",{tenantId:tenantA,...bookingFixtures,startsAt:oldStart,requestKey:"against-pre-upgrade"}),"BOOKING_CONFLICT");
  await alice.mutation("bookings:cancel",{tenantId:tenantA,bookingId:oldRow._id,expectedRevision:0});
  await alice.mutation("bookings:cancel",{tenantId:tenantA,bookingId:oldRow._id,expectedRevision:0});
  assert.equal(await alice.mutation("bookings:create",oldArgs),oldRow._id);
  assert.deepEqual((await alice.query("bookings:history",{tenantId:tenantA,bookingId:oldRow._id})).items.map(e=>e.action),["cancelled"]);
  check("pre-upgrade booking without optional fields blocks overlap, lists safely and cancels/retries with its original ID");
  const overnight=await alice.mutation("bookings:createLinked",{tenantId:tenantA,...bookingFixtures,startsAt:oldStart+14.5*3600000,requestKey:"overnight"});
  const midnight=Date.UTC(2041,0,11);
  assert.ok((await alice.query("bookings:list",{tenantId:tenantA,from:midnight,to:midnight+86400000})).items.some(r=>r._id===overnight));
  assert.ok(!(await alice.query("bookings:list",{tenantId:tenantA,from:midnight+3600000,to:midnight+86400000})).items.some(r=>r._id===overnight));
  check("overnight bookings remain visible the next day until their exclusive end instant");
  await gmailChecks({alice,bob,viewer,anonymous,tenantA,tenantB,issuer,command,runDir,check,signing:gmailSigning});
  await enquiryChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity:`${issuer}|viewer`,clientForOwner:()=>client("alice"),check,prefix:"enquiry-local"});
  await todayChecks({
    alice,bob,viewer,anonymous,viewerIdentity:`${issuer}|viewer`,check,
    seedRows:async({tenantA:todayTenantA,tenantB:todayTenantB,day,from,to})=>{
      const shift=(offset)=>{const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);};
      const createdAt=Date.now()+100000;
      const tasks=[
        ...Array.from({length:201},(_,index)=>({tenantId:todayTenantA,title:`Newer future task ${index}`,completed:false,dueDate:shift(1),createdAt:createdAt+index,createdBy:`${issuer}|alice`,requestKey:`today-future-${index}`,revision:0})),
        {tenantId:todayTenantA,title:"Removed today task",completed:false,dueDate:day,removedAt:createdAt,createdAt:createdAt+202,createdBy:`${issuer}|alice`,requestKey:"today-removed",revision:1},
        {tenantId:todayTenantA,title:"Previous day task",completed:false,dueDate:shift(-1),createdAt:createdAt+203,createdBy:`${issuer}|alice`,requestKey:"today-previous",revision:0},
        {tenantId:todayTenantA,title:"Undated task",completed:false,createdAt:createdAt+204,createdBy:`${issuer}|alice`,requestKey:"today-undated",revision:0},
        ...Array.from({length:201},(_,index)=>({tenantId:todayTenantB,title:`Today capped task ${index}`,completed:index%2===0,dueDate:day,createdAt:createdAt+300+index,createdBy:`${issuer}|bob`,requestKey:`today-cap-${index}`,revision:0})),
      ];
      await writeFile(resolve(runDir,"today-tasks.json"),JSON.stringify(tasks));
      await command(["import","--env-file",".push.env","--table","tasks","--append","today-tasks.json"]);
      const hour=60*60*1000;
      const booking=(tenantId,clientLabel,startsAt,endsAt,requestKey,status="scheduled")=>({tenantId,practitionerId:"practice",startsAt,endsAt,clientLabel,requestKey,status,revision:0,createdBy:tenantId===todayTenantA?`${issuer}|alice`:`${issuer}|bob`});
      const bookings=[
        booking(todayTenantA,"Prior overnight",from-hour,from+hour/2,"today-prior"),
        booking(todayTenantA,"Exact start",from,from+hour/2,"today-exact"),
        booking(todayTenantA,"Ends at start",from-hour,from,"today-ends-at-start"),
        booking(todayTenantA,"Starts next day",to,to+hour,"today-starts-next"),
        booking(todayTenantA,"Cancelled today",from+2*hour,from+3*hour,"today-cancelled","cancelled"),
        {...booking(todayTenantA,"Legacy scheduled",from+4*hour,from+5*hour,"today-legacy"),status:undefined},
        booking(todayTenantB,"Other tenant boundary",from+hour,from+2*hour,"today-other-tenant"),
        ...Array.from({length:201},(_,index)=>booking(todayTenantB,`Today capped booking ${index}`,from+6*hour,from+7*hour,`today-booking-cap-${index}`)),
      ];
      await writeFile(resolve(runDir,"today-bookings.json"),JSON.stringify(bookings));
      await command(["import","--env-file",".push.env","--table","bookings","--append","today-bookings.json"]);
    },
  });
  await sourceLibraryChecks({alice,bob,viewer,anonymous,viewerIdentity:`${issuer}|viewer`,check});
  }
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
  await stopProcessGroup(backend);
  await rm(runDir, { recursive: true, force: true });
}
