import assert from "node:assert/strict";

export async function clientNotesChecks({alice,bob,viewer,anonymous,tenantA,tenantB,viewerIdentity,clientForOwner,check}) {
  const clientId=await alice.mutation("clients:create",{tenantId:tenantA,name:"Private notes fixture",requestKey:"client-notes-fixture"});
  const args={tenantId:tenantA,clientId};
  const read=()=>alice.query("clients:notes",args);
  assert.deepEqual(await read(),{text:"",revision:0});
  for(const caller of [anonymous,bob,viewer]) {
    await assert.rejects(caller.query("clients:notes",args));
    await assert.rejects(caller.mutation("clients:saveNotes",{...args,text:"denied",expectedRevision:0}));
  }
  for(const fn of ["clients:notes","clients:saveNotes"]) {
    const payload={...args,tenantId:tenantB,...(fn.endsWith("saveNotes")?{text:"foreign",expectedRevision:0}:{})};
    await assert.rejects(fn.endsWith("saveNotes")?bob.mutation(fn,payload):bob.query(fn,payload),/FORBIDDEN/);
  }
  await alice.mutation("tenants:addViewer",{tenantId:tenantA,identity:viewerIdentity});
  try {
    await assert.rejects(viewer.query("clients:notes",args),/FORBIDDEN/);
    await assert.rejects(viewer.mutation("clients:saveNotes",{...args,text:"viewer",expectedRevision:0}),/FORBIDDEN/);
  } finally { await alice.mutation("tenants:removeViewer",{tenantId:tenantA,identity:viewerIdentity}); }
  const text="Prefer afternoon appointments.\nCall before arrival. <script>plain text</script>";
  const saved=await alice.mutation("clients:saveNotes",{...args,text,expectedRevision:0});
  assert.deepEqual(saved,{text,revision:1});
  assert.deepEqual(await alice.mutation("clients:saveNotes",{...args,text,expectedRevision:0}),saved);
  assert.deepEqual(await (await clientForOwner()).query("clients:notes",args),saved);
  await assert.rejects(alice.mutation("clients:saveNotes",{...args,text:"x".repeat(4001),expectedRevision:1}),/INVALID_NOTES/);
  await assert.rejects(alice.mutation("clients:saveNotes",{...args,text:"other",expectedRevision:-1}),/INVALID_REVISION/);
  await assert.rejects(alice.mutation("clients:saveNotes",{...args,text:"stale",expectedRevision:0}),/REVISION_CONFLICT/);
  await alice.mutation("clients:update",{...args,name:"Updated private notes fixture",expectedRevision:0});
  await alice.mutation("clients:setArchived",{...args,archived:true,expectedRevision:1});
  assert.deepEqual(await read(),saved);
  const list=await alice.query("clients:list",{tenantId:tenantA,archived:true,paginationOpts:{numItems:50,cursor:null}});
  const row=list.page.find(r=>r._id===clientId);assert.equal(row.revision,2);
  assert.ok(!("privateNotes" in row));assert.ok(!("notesRevision" in row));
  assert.equal((await alice.query("clients:list",{tenantId:tenantA,archived:true,search:"afternoon",paginationOpts:{numItems:50,cursor:null}})).page.length,0);
  const callers=await Promise.all([clientForOwner(),clientForOwner()]);
  const raced=await Promise.allSettled(callers.map((c,i)=>c.mutation("clients:saveNotes",{...args,text:`Competing ${i}`,expectedRevision:1})));
  assert.equal(raced.filter(r=>r.status==="fulfilled").length,1);
  assert.ok(raced.some(r=>r.status==="rejected"&&String(r.reason).includes("REVISION_CONFLICT")));
  assert.equal((await read()).revision,2);
  assert.deepEqual(await alice.mutation("clients:saveNotes",{...args,text:"",expectedRevision:2}),{text:"",revision:3});
  assert.deepEqual(await alice.mutation("clients:saveNotes",{...args,text:"",expectedRevision:2}),{text:"",revision:3});
  await assert.rejects(alice.mutation("clients:saveNotes",{...args,text,expectedRevision:0}),/REVISION_CONFLICT/);
  assert.deepEqual(await read(),{text:"",revision:3});
  check("private client notes enforce owner/tenant access, bounded text, independent revisions, concurrent edit protection, clear/retry semantics and exclusion from list/search");
}
