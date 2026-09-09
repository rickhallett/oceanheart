import {test} from "node:test";
import assert from "node:assert/strict";
import {checkpointViewerMembership} from "./fixture-membership.mjs";
test("permission checkpoint saves exact selected-tenant prior membership before continuing",async()=>{
  for(const role of [null,"viewer"]){
    const report={};let persisted;
    await checkpointViewerMembership({viewer:{query:async()=>[{_id:"other",role:"owner"},...(role?[{_id:"selected",role}]:[])]},tenantId:"selected",userId:"synthetic-user",report,save:async()=>{persisted=structuredClone(report);}});
    assert.deepEqual(persisted.viewerMembershipBefore,{tenantId:"selected",userId:"synthetic-user",present:role!==null,role});
  }
});
test("checkpoint failure or owner fixture stops before permission-changing checks",async()=>{
  let saved=false;
  await assert.rejects(checkpointViewerMembership({viewer:{query:async()=>[{_id:"selected",role:"owner"}]},tenantId:"selected",userId:"synthetic-user",report:{},save:async()=>{saved=true;}}),/owner membership/);
  assert.equal(saved,true);
  await assert.rejects(checkpointViewerMembership({viewer:{query:async()=>[]},tenantId:"selected",userId:"synthetic-user",report:{},save:async()=>{throw new Error("disk unavailable");}}),/disk unavailable/);
});
