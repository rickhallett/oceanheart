import assert from "node:assert/strict";
export async function recordManagementChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity,clientForOwner,check,prefix,record=async()=>{}}){
  const paginationOpts={numItems:50,cursor:null};
  for(const module of ["services","clients"]){
    const idField=module==="services"?"serviceId":"clientId";
    const fields=module==="services"?{name:`Manage ${prefix}`,durationMinutes:45,priceMinor:2300,currency:"GBP",description:"original"}:{name:`Manage ${prefix}`,email:"shared@example.com",phone:"123"};
    const create={tenantId:tenantA,...fields,requestKey:`${prefix}-${module}`};
    const id=await alice.mutation(`${module}:create`,create);await record(module,id,tenantA);
    const edit={tenantId:tenantA,[idField]:id,...fields,name:`Updated ${prefix}`,expectedRevision:0};
    const archive={tenantId:tenantA,[idField]:id,archived:true,expectedRevision:1};
    for(const caller of [anonymous,bob]){
      const denied=caller===anonymous?/UNAUTHENTICATED/:/FORBIDDEN/;
      await assert.rejects(caller.mutation(`${module}:update`,edit),denied);
      await assert.rejects(caller.mutation(`${module}:setArchived`,archive),denied);
    }
    await assert.rejects(bob.mutation(`${module}:update`,{...edit,tenantId:tenantB}),/FORBIDDEN/);
    await assert.rejects(alice.mutation(`${module}:update`,{...edit,name:"bad\nname"}),/INVALID_NAME/);
    assert.equal(await alice.mutation(`${module}:update`,edit),id);
    assert.equal(await alice.mutation(`${module}:update`,edit),id);
    assert.equal(await alice.mutation(`${module}:create`,create),id,"original create remains retryable after edit");
    await assert.rejects(alice.mutation(`${module}:update`,{...edit,name:"Stale different"}),/REVISION_CONFLICT/);
    const fresh=await clientForOwner();
    assert.equal((await fresh.query(`${module}:list`,{tenantId:tenantA,paginationOpts})).page.find(r=>r._id===id).revision,1);
    assert.equal(await alice.mutation(`${module}:setArchived`,archive),id);
    assert.equal(await alice.mutation(`${module}:setArchived`,archive),id);
    assert.ok(!(await fresh.query(`${module}:list`,{tenantId:tenantA,paginationOpts})).page.some(r=>r._id===id));
    assert.ok((await fresh.query(`${module}:list`,{tenantId:tenantA,archived:true,paginationOpts})).page.some(r=>r._id===id));
    await assert.rejects(alice.mutation(`${module}:setArchived`,{...archive,archived:false,expectedRevision:1}),/REVISION_CONFLICT/);
    await alice.mutation(`${module}:setArchived`,{...archive,archived:false,expectedRevision:2});
    const contenders=await Promise.all([clientForOwner(),clientForOwner()]);
    const results=await Promise.allSettled(contenders.map((c,i)=>c.mutation(`${module}:update`,{...edit,name:`Racing ${i} ${prefix}`,expectedRevision:3})));
    assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
    assert.ok(results.some(r=>r.status==="rejected"&&String(r.reason).includes("REVISION_CONFLICT")));
    await alice.mutation("tenants:addViewer",{tenantId:tenantA,identity:viewerIdentity});
    try{
      await assert.rejects(viewer.mutation(`${module}:update`,edit),/FORBIDDEN/);
      await assert.rejects(viewer.mutation(`${module}:setArchived`,archive),/FORBIDDEN/);
    }finally{await alice.mutation("tenants:removeViewer",{tenantId:tenantA,identity:viewerIdentity});}
    await assert.rejects(viewer.mutation(`${module}:update`,edit),/FORBIDDEN/);
  }
  check("record edits, archive/restore preserve IDs; same-state retries succeed and concurrent divergent writes conflict");
  const unique=`name${prefix.replace(/[^a-z0-9]/gi,"").slice(0,20)}`;
  const payload={tenantId:tenantA,name:unique,email:"family@example.com",requestKey:`${prefix}-search`};
  const first=await alice.mutation("clients:create",payload);await record("clients",first,tenantA);
  const second=await alice.mutation("clients:create",{...payload,requestKey:`${prefix}-duplicate`});await record("clients",second,tenantA);assert.notEqual(first,second);
  const outsider=await bob.mutation("clients:create",{...payload,tenantId:tenantB});await record("clients",outsider,tenantB);
  const query={tenantId:tenantA,search:unique,paginationOpts:{numItems:1,cursor:null}};
  const page1=await alice.query("clients:list",query);assert.equal(page1.page.length,1);assert.equal(page1.isDone,false);
  const page2=await alice.query("clients:list",{...query,paginationOpts:{numItems:1,cursor:page1.continueCursor}});
  assert.equal(new Set([...page1.page,...page2.page].map(r=>r._id)).size,2);assert.ok(![...page1.page,...page2.page].some(r=>r._id===outsider));
  assert.ok((await alice.query("clients:list",{...query,search:"family@example.com",paginationOpts})).page.some(r=>r._id===first));
  await alice.mutation("clients:setArchived",{tenantId:tenantA,clientId:first,archived:true,expectedRevision:0});
  assert.ok(!(await alice.query("clients:list",{...query,paginationOpts})).page.some(r=>r._id===first));
  assert.ok((await alice.query("clients:list",{...query,archived:true,paginationOpts})).page.some(r=>r._id===first));
  for(const caller of [anonymous,bob,viewer])await assert.rejects(caller.query("clients:list",query));
  check("owner-only name/email search paginates and respects tenant/archive filters; duplicate contacts remain distinct");
}
