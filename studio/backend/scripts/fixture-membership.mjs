// Record prior fixture permissions before acceptance helpers change them.
export async function checkpointViewerMembership({viewer,tenantId,userId,report,save}) {
  const prior=(await viewer.query("tenants:list",{})).find(tenant=>tenant._id===tenantId);
  report.viewerMembershipBefore={tenantId,userId,present:!!prior,role:prior?.role??null};
  report.viewerMembershipCleanup=prior
    ? "Restore the recorded prior viewer membership after acceptance. If role was owner, do not run membership-changing checks."
    : "Viewer had no membership before acceptance; leave it absent after cleanup.";
  await save();
  // The helper removes only viewer memberships; an owner fixture cannot test revocation.
  if(prior?.role==="owner")throw new Error("Viewer fixture has owner membership; refusing permission-changing checks");
}
