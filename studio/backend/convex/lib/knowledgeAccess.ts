import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type KnowledgeCapability = "read" | "contribute" | "approve";

export async function requireKnowledgeAccess(
  ctx: QueryCtx | MutationCtx,
  tenantId: Id<"tenants">,
  capability: KnowledgeCapability,
) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new ConvexError("UNAUTHENTICATED");
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_tenant_identity", (q) =>
      q.eq("tenantId", tenantId).eq("identity", user.tokenIdentifier),
    )
    .unique();
  if (membership?.role === "owner") return user;
  if (capability === "approve") throw new ConvexError("FORBIDDEN");
  const grant = await ctx.db
    .query("knowledgeAccessGrants")
    .withIndex("by_tenant_identity", (q) =>
      q.eq("tenantId", tenantId).eq("identity", user.tokenIdentifier),
    )
    .unique();
  if (
    !grant?.active ||
    (capability === "contribute" && grant.capability !== "contribute")
  )
    throw new ConvexError("FORBIDDEN");
  return user;
}
