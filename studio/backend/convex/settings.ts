import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireMember } from "./lib/access";
import * as catalog from "./lib/catalog";
import { availabilityObject, canonical, currentSettings, settingsFields } from "./lib/settings";

export const get = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    await requireMember(ctx, tenantId);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new ConvexError("FORBIDDEN");
    const current = currentSettings(tenant);
    return {
      name: current.name,
      ...(tenant.timeZone ? { timeZone: tenant.timeZone } : {}),
      revision: tenant.revision ?? 0,
      ...(current.tagline ? { tagline: current.tagline } : {}),
      ...(current.contactEmail ? { contactEmail: current.contactEmail } : {}),
      ...(current.contactPhone ? { contactPhone: current.contactPhone } : {}),
      ...(current.address ? { address: current.address } : {}),
      availability: current.availability,
    };
  },
});

export const update = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    tagline: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    address: v.optional(v.string()),
    availability: availabilityObject,
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.tenantId, true);
    catalog.expectedRevision(args.expectedRevision);
    const data = settingsFields(args);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new ConvexError("FORBIDDEN");
    const current = currentSettings(tenant);
    // Accept a retried already-applied desired state without bumping the
    // revision; a divergent stale edit is rejected below.
    if (canonical(current) === canonical(data))
      return tenant.revision ?? 0;
    if ((tenant.revision ?? 0) !== args.expectedRevision)
      throw new ConvexError("REVISION_CONFLICT");
    await ctx.db.patch(args.tenantId, {
      name: data.name,
      tagline: data.tagline,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      address: data.address,
      availability: data.availability,
      revision: (tenant.revision ?? 0) + 1,
    });
    return (tenant.revision ?? 0) + 1;
  },
});