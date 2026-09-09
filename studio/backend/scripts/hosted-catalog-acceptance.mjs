/** Explicit staging acceptance using existing synthetic users only. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, stat, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConvexHttpClient } from "convex/browser";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { recordManagementChecks } from "./record-management-checks.mjs";
import { catalogChecks } from "./catalog-checks.mjs";
const target=process.env.STUDIO_STAGING_CONVEX_URL,clientId=process.env.WORKOS_CLIENT_ID,key=process.env.WORKOS_API_KEY,fixture=process.env.STUDIO_EXISTING_CREDENTIALS;
if(target!=="https://charming-albatross-632.convex.cloud" || clientId!=="client_01M22XATNCX2AG67KHQ4VKTSTH" || process.env.STUDIO_ACCEPTANCE_ENVIRONMENT!=="environment_01M22XATA8QP8R896NV5511N1V" || !key?.startsWith("sk_test_") || !fixture || process.env.STUDIO_ALLOW_SYNTHETIC_FIXTURES!=="yes") {
  console.error("Refusing: approved staging target, test credentials, existing private fixture and opt-in required.");process.exit(1);
}
process.umask(0o077);
const directory=await mkdtemp(join(tmpdir(),"studio-catalog-acceptance-"));
const report={target,clientId,startedAt:new Date().toISOString(),status:"running",checks:[],records:[]};
const save=()=>writeFile(join(directory,"report.json"),JSON.stringify(report,null,2),{mode:0o600});
try {
  assert.equal((await stat(fixture)).mode & 0o077,0,"Credential file must be private");
  const data=JSON.parse(await readFile(fixture,"utf8"));
  assert.equal(data.target,target);assert.equal(data.clientId,clientId);
  const jwks=createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`));
  const accounts={};
  for(const role of ["owner","outsider","viewer"]) {
    const account=data.accounts.find(a=>a.role===role);
    assert.ok(account && /^[^@]+@studio-rad-[a-f0-9-]+\.example\.com$/.test(account.email),"Only recorded synthetic subdomain users allowed");
    const response=await fetch("https://api.workos.com/user_management/authenticate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:clientId,client_secret:key,grant_type:"password",email:account.email,password:account.password}),signal:AbortSignal.timeout(30000)});
    if(!response.ok) {const body=await response.json().catch(()=>({}));const candidate=body.code??body.error;const code=typeof candidate==="string"&&/^[a-z_]{1,80}$/.test(candidate)?candidate:"unreported";report.failure=`WorkOS authenticate HTTP ${response.status} (${code})`;throw new Error("Authentication failed");}
    const session=await response.json();
    const {payload}=await jwtVerify(session.access_token,jwks,{algorithms:["RS256"],issuer:["https://api.workos.com/",`https://api.workos.com/user_management/${clientId}`]});
    assert.equal(payload.sub,account.userId);
    if(payload.iss==="https://api.workos.com/") assert.ok((Array.isArray(payload.aud)?payload.aud:[payload.aud]).includes(clientId));
    accounts[role]={token:session.access_token,identity:`${payload.iss}|${payload.sub}`};
  }
  const client=role=>{const c=new ConvexHttpClient(target,{logger:false});if(role)c.setAuth(accounts[role].token);return c;};
  const alice=client("owner"),bob=client("outsider");
  const tenantA=(await alice.query("tenants:list",{})).find(t=>t.role==="owner")?._id;
  const tenantB=(await bob.query("tenants:list",{})).find(t=>t.role==="owner")?._id;
  assert.ok(tenantA && tenantB && tenantA!==tenantB,"Existing isolated practices required");
  report.tenants=[tenantA,tenantB];
  await catalogChecks({alice,bob,viewer:client("viewer"),anonymous:client(),tenantA,tenantB,viewerIdentity:accounts.viewer.identity,clientForOwner:async()=>client("owner"),prefix:randomUUID(),check:name=>{report.checks.push(name);console.log(`PASS ${name}`);},record:async(table,id,tenantId)=>{report.records.push({table,id,tenantId});await save();}});
  await recordManagementChecks({alice,bob,viewer:client("viewer"),anonymous:client(),tenantA,tenantB,viewerIdentity:accounts.viewer.identity,clientForOwner:async()=>client("owner"),prefix:randomUUID(),check:name=>{report.checks.push(name);console.log(`PASS ${name}`);},record:async(table,id,tenantId)=>{report.records.push({table,id,tenantId});await save();}});
  report.status="passed";
}catch{report.status="failed";report.failure??="Acceptance assertion/request failed; raw details suppressed to protect credentials.";console.error(report.failure);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();await save();console.log(`Catalogue acceptance ${report.status}; non-secret record manifest: ${directory}`);}
