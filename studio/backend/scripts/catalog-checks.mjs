import assert from "node:assert/strict";
export async function catalogChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity,clientForOwner,check,prefix,record=async()=>{}}) {
  const paginationOpts={numItems:50,cursor:null};
  const svc={tenantId:tenantA,name:" Synthetic service ",durationMinutes:60,priceMinor:1250,currency:"GBP",description:" ",requestKey:`${prefix}-service`};
  const contact={tenantId:tenantA,name:" Synthetic contact ",email:" ",phone:" ",requestKey:`${prefix}-client`};
  for(const [module,args] of [["services",svc],["clients",contact]]) {
    for(const [caller,error] of [[anonymous,/UNAUTHENTICATED/],[bob,/FORBIDDEN/]]) {
      await assert.rejects(caller.query(`${module}:list`,{tenantId:tenantA,paginationOpts}),error);
      await assert.rejects(caller.mutation(`${module}:create`,args),error);
    }
    const callers=await Promise.all(Array.from({length:6},()=>clientForOwner()));
    const ids=await Promise.all(callers.map(c=>c.mutation(`${module}:create`,args)));
    assert.equal(new Set(ids).size,1); await record(module,ids[0],tenantA);
    const normalized={...args,name:args.name.trim()};
    if(module==="services") delete normalized.description; else {delete normalized.email;delete normalized.phone;}
    assert.equal(await alice.mutation(`${module}:create`,normalized),ids[0]);
    await assert.rejects(alice.mutation(`${module}:create`,{...args,name:"Changed"}),/IDEMPOTENCY_MISMATCH/);
    const rows=(await (await clientForOwner()).query(`${module}:list`,{tenantId:tenantA,paginationOpts})).page;
    const row=rows.find(r=>r._id===ids[0]); assert.ok(row); assert.equal(row.name,args.name.trim());
    for(const field of ["createdBy","requestKey","tenantId","email","phone","description"]) assert.ok(!(field in row));
    if(module==="services") {assert.equal(row.priceMinor,1250);assert.equal(row.durationMinutes,60);assert.equal(row.currency,"GBP");assert.equal(row.active,true);}
    for(const name of [" ","x".repeat(101),"bad\nname","bad\tname","bad\u2028name"]) await assert.rejects(alice.mutation(`${module}:create`,{...args,name}),/INVALID_NAME/);
    for(const numItems of [0,51,1.5]) await assert.rejects(alice.query(`${module}:list`,{tenantId:tenantA,paginationOpts:{numItems,cursor:null}}),/INVALID_PAGE_SIZE/);
    await assert.rejects(alice.mutation(`${module}:create`,{...args,requestKey:" padded"}),/INVALID_REQUEST_KEY/);
    const other=await bob.mutation(`${module}:create`,{...args,tenantId:tenantB}); await record(module,other,tenantB);
    assert.ok(!(await alice.query(`${module}:list`,{tenantId:tenantA,paginationOpts})).page.some(r=>r._id===other));
  }
  for(const durationMinutes of [0,1441,1.5]) await assert.rejects(alice.mutation("services:create",{...svc,durationMinutes}),/INVALID_DURATION/);
  for(const priceMinor of [-1,100000001,0.5]) await assert.rejects(alice.mutation("services:create",{...svc,priceMinor}),/INVALID_PRICE/);
  await assert.rejects(alice.mutation("services:create",{...svc,currency:"USD"}));
  await assert.rejects(alice.mutation("services:create",{...svc,description:"x".repeat(2001)}),/INVALID_DESCRIPTION/);
  for(const email of ["missing-at", "a@b", "x".repeat(255)]) await assert.rejects(alice.mutation("clients:create",{...contact,email}),/INVALID_EMAIL/);
  for(const phone of ["x".repeat(41),"a\nb"]) await assert.rejects(alice.mutation("clients:create",{...contact,phone}),/INVALID_PHONE/);
  check("services and contacts persist with normalized concurrent retry keys; validation and cross-tenant boundaries enforced");
  await alice.mutation("tenants:addViewer",{tenantId:tenantA,identity:viewerIdentity});
  try {
    assert.ok((await viewer.query("services:list",{tenantId:tenantA,paginationOpts})).page.length);
    await assert.rejects(viewer.query("clients:list",{tenantId:tenantA,paginationOpts}),/FORBIDDEN/);
    await assert.rejects(viewer.mutation("services:create",svc),/FORBIDDEN/);
    await assert.rejects(viewer.mutation("clients:create",contact),/FORBIDDEN/);
  } finally {await alice.mutation("tenants:removeViewer",{tenantId:tenantA,identity:viewerIdentity});}
  await assert.rejects(viewer.query("services:list",{tenantId:tenantA,paginationOpts}),/FORBIDDEN/);
  await assert.rejects(viewer.query("clients:list",{tenantId:tenantA,paginationOpts}),/FORBIDDEN/);
  check("viewer can read services only; revoked membership immediately denies catalogue access");
  // Force native cursor traversal with a one-row page; no dependence on pre-existing fixtures.
  for(const [module,args] of [["services",svc],["clients",contact]]) {
    const extra=await alice.mutation(`${module}:create`,{...args,name:"Second record",requestKey:`${prefix}-${module}-second`}); await record(module,extra,tenantA);
    let cursor=null, seen=new Set(), pages=0;
    do {
      const result=await alice.query(`${module}:list`,{tenantId:tenantA,paginationOpts:{numItems:1,cursor}});
      assert.ok(result.page.length<=1);
      for(const row of result.page){assert.ok(!seen.has(row._id));seen.add(row._id);}
      pages++; if(result.isDone) break; cursor=result.continueCursor;
      assert.ok(pages<500,"Unexpected fixture volume");
    }while(true);
    assert.ok(pages>=2); assert.ok(seen.has(extra));
  }
  check("native pagination traverses boundaries without duplicate rows and terminates");
}
