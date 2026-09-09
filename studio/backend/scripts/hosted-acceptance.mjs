/** Explicitly invoked staging fixture creation; never used by normal CI. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { createRemoteJWKSet, jwtVerify } from "jose";

const target = process.env.STUDIO_STAGING_CONVEX_URL;
const clientId = process.env.WORKOS_CLIENT_ID;
const apiKey = process.env.WORKOS_API_KEY;
if (target !== "https://charming-albatross-632.convex.cloud" ||
    process.env.STUDIO_ACCEPTANCE_ENVIRONMENT !== "environment_01M22XATA8QP8R896NV5511N1V" ||
    clientId !== "client_01M22XATNCX2AG67KHQ4VKTSTH" ||
    !apiKey || !apiKey.startsWith("sk_test_") ||
    process.env.STUDIO_ALLOW_SYNTHETIC_FIXTURES !== "yes") {
  console.error("Refusing: explicitly select the approved staging URL, WorkOS environment/client, test API key and synthetic-fixture opt-in.");
  process.exit(1);
}
process.umask(0o077);
const directory = await mkdtemp(join(tmpdir(), "studio-staging-acceptance-"));
await chmod(directory, 0o700);
const runId = randomUUID();
const report = {runId, target, clientId, environment: process.env.STUDIO_ACCEPTANCE_ENVIRONMENT,
  startedAt:new Date().toISOString(), status:"running", checks:[], users:[], practices:[], tasks:[],
  cleanup:"After browser acceptance, delete only these recorded synthetic WorkOS users and tenant/task/membership records through a reviewed staging cleanup. No broad reset. This runner deliberately preserves fixtures for browser verification."};
const secrets = {runId, target, clientId, accounts:[]};
const save = async () => {
  await writeFile(join(directory,"credentials.json"), JSON.stringify(secrets,null,2), {mode:0o600});
  await writeFile(join(directory,"report.json"), JSON.stringify(report,null,2), {mode:0o600});
};
const check = name => {report.checks.push(name); console.log(`PASS ${name}`);};
// Never include provider error bodies, token claims or exception strings in stdout.
async function workos(path, body, auth = true) {
  const response = await fetch(`https://api.workos.com${path}`, {
    method:"POST", headers:{"Content-Type":"application/json", ...(auth ? {Authorization:`Bearer ${apiKey}`} : {})},
    body:JSON.stringify(body), signal:AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const body = await response.json().catch(()=>({}));
    const candidate = body.code ?? body.error;
    const code = typeof candidate === "string" && /^[a-z_]{1,80}$/.test(candidate) ? candidate : "unreported";
    const error = new Error(`WorkOS ${path} failed (HTTP ${response.status}, code ${code}); no retry performed. Inspect provider dashboard; challenges require separate user action.`);
    error.safe = true; throw error;
  }
  return response.json();
}
const jwks = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`));
async function createAccount(role) {
  const account = {role, email:`${role}@studio-rad-${runId}.example.com`, password:`Aa1!${randomBytes(30).toString("base64url")}`};
  secrets.accounts.push(account);
  await save();
  // Explicit staging-only synthetic fixture, not verification of a real person's email.
  const user = await workos("/user_management/users", {email:account.email,password:account.password,email_verified:true,first_name:"Studio synthetic",last_name:role});
  account.userId = user.id;
  report.users.push({role,userId:user.id,email:account.email});
  await save();
  const session = await workos("/user_management/authenticate", {client_id:clientId,client_secret:apiKey,grant_type:"password",email:account.email,password:account.password}, false);
  account.accessToken = session.access_token;
  account.refreshToken = session.refresh_token;
  await save();
  const {payload} = await jwtVerify(account.accessToken,jwks,{algorithms:["RS256"],issuer:["https://api.workos.com/",`https://api.workos.com/user_management/${clientId}`]});
  assert.equal(payload.sub,user.id);
  if(payload.iss === "https://api.workos.com/") assert.ok((Array.isArray(payload.aud) ? payload.aud : [payload.aud]).includes(clientId));
  account.identity = `${payload.iss}|${payload.sub}`;
  await save();
  return account;
}
function client(account) {
  const c = new ConvexHttpClient(target, {logger:false});
  if(account) c.setAuth(account.accessToken);
  return c;
}
async function denied(promise, code) {
  await assert.rejects(promise,error=>String(error).includes(code));
}
try {
  await save();
  const owner = await createAccount("owner"), outsider = await createAccount("outsider"), viewer = await createAccount("viewer");
  check("three synthetic accounts authenticated with real WorkOS password grants and verified JWKS signatures");
  const a = client(owner), b = client(outsider), v = client(viewer), anonymous = client();
  const practiceArgs = {name:`Staging acceptance ${runId.slice(0,8)}`,requestKey:`${runId}-practice`};
  const tenantId = await a.mutation("tenants:create",practiceArgs);
  report.practices.push({tenantId,ownerId:owner.userId}); await save();
  const otherTenant = await b.mutation("tenants:create",{name:`Synthetic isolation ${runId.slice(0,8)}`,requestKey:`${runId}-other`});
  report.practices.push({tenantId:otherTenant,ownerId:outsider.userId}); await save();
  assert.equal(await a.mutation("tenants:create",practiceArgs),tenantId);
  const taskArgs = {tenantId,title:"Verify staging task persistence",requestKey:`${runId}-task`};
  const taskId = await a.mutation("tasks:create",taskArgs);
  report.tasks.push({taskId,tenantId}); await save();
  assert.equal(await client(owner).mutation("tasks:create",taskArgs),taskId);
  await a.mutation("tasks:setCompleted",{tenantId,taskId,completed:true});
  const stored = await client(owner).query("tasks:list",{tenantId});
  assert.ok(stored.items.some(task=>task._id===taskId && task.completed && task.title===taskArgs.title));
  assert.ok((await client(owner).query("tenants:list",{})).some(t=>t._id===tenantId && t.role==="owner"));
  check("practice/task creation retries and completed task persist through fresh authenticated clients");
  const refreshed = await workos("/user_management/authenticate", {client_id:clientId,client_secret:apiKey,grant_type:"refresh_token",refresh_token:owner.refreshToken},false);
  const {payload:refreshedClaims} = await jwtVerify(refreshed.access_token,jwks,{algorithms:["RS256"],issuer:["https://api.workos.com/",`https://api.workos.com/user_management/${clientId}`]});
  assert.equal(`${refreshedClaims.iss}|${refreshedClaims.sub}`,owner.identity);
  if(refreshedClaims.iss === "https://api.workos.com/") assert.ok((Array.isArray(refreshedClaims.aud) ? refreshedClaims.aud : [refreshedClaims.aud]).includes(clientId));
  owner.accessToken=refreshed.access_token;
  owner.refreshToken=refreshed.refresh_token;
  await save();
  assert.ok((await client(owner).query("tasks:list",{tenantId})).items.some(task=>task._id===taskId && task.completed));
  check("real WorkOS refresh-token grant preserves verified identity and hosted task access");
  for (const c of [anonymous,b]) {
    const code = c===anonymous ? "UNAUTHENTICATED" : "FORBIDDEN";
    await denied(c.query("tasks:list",{tenantId}),code);
    await denied(c.mutation("tasks:create",taskArgs),code);
    await denied(c.mutation("tasks:setCompleted",{tenantId,taskId,completed:false}),code);
  }
  await denied(anonymous.query("tenants:list",{}),"UNAUTHENTICATED");
  await denied(anonymous.mutation("tenants:create",practiceArgs),"UNAUTHENTICATED");
  await denied(b.mutation("tasks:setCompleted",{tenantId:otherTenant,taskId,completed:false}),"FORBIDDEN");
  check("anonymous and cross-tenant reads/writes rejected by hosted backend");
  await a.mutation("tenants:addViewer",{tenantId,identity:viewer.identity});
  assert.ok((await v.query("tasks:list",{tenantId})).items.some(task=>task._id===taskId));
  await denied(v.mutation("tasks:create",{...taskArgs,requestKey:`${runId}-viewer`}),"FORBIDDEN");
  await denied(v.mutation("tasks:setCompleted",{tenantId,taskId,completed:false}),"FORBIDDEN");
  await a.mutation("tenants:removeViewer",{tenantId,identity:viewer.identity});
  await denied(v.query("tasks:list",{tenantId}),"FORBIDDEN");
  await denied(v.mutation("tasks:setCompleted",{tenantId,taskId,completed:false}),"FORBIDDEN");
  assert.deepEqual(await v.query("tenants:list",{}),[]);
  check("viewer reads allowed, writes denied, revocation enforced with unchanged real WorkOS token");
  await a.mutation("tasks:setCompleted",{tenantId,taskId,completed:false});
  report.status="passed";
  report.browserFixture={ownerId:owner.userId,tenantId,taskId,expectedCompleted:false};
} catch(error) {
  report.status="failed";
  report.failure=error.safe ? error.message : "Acceptance assertion or request failed; raw exception suppressed to protect session material.";
  console.error(report.failure);
  process.exitCode=1;
} finally {
  report.finishedAt=new Date().toISOString();
  await save();
  console.log(`Acceptance ${report.status}. Private evidence and browser credentials: ${directory}`);
}
