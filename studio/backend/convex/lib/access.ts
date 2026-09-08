import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  write = false,
) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new ConvexError("UNAUTHENTICATED");
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_tenant_identity", (q) =>
      q.eq("tenantId", tenantId).eq("identity", user.tokenIdentifier),
    )
    .unique();
  if (!membership || (write && membership.role !== "owner"))
    throw new ConvexError("FORBIDDEN");
  return user;
}
