import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export default defineSchema({
  tenants: defineTable({ name: v.string(), createdBy: v.optional(v.string()), requestKey: v.optional(v.string()) })
    .index("by_creator_request", ["createdBy", "requestKey"]),
  tasks: defineTable({ tenantId: v.id("tenants"), title: v.string(), completed: v.boolean(), createdAt: v.number(), createdBy: v.string(), requestKey: v.string() })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_request", ["tenantId", "requestKey"]),
  memberships: defineTable({
    tenantId: v.id("tenants"),
    identity: v.string(),
    role: v.union(v.literal("owner"), v.literal("viewer")),
  })
    .index("by_tenant_identity", ["tenantId", "identity"])
    .index("by_identity", ["identity"]),
  bookings: defineTable({
    tenantId: v.id("tenants"),
    practitionerId: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    clientLabel: v.string(),
    requestKey: v.string(),
    createdBy: v.string(),
  })
    .index("by_tenant_practitioner_start", [
      "tenantId",
      "practitionerId",
      "startsAt",
    ])
    .index("by_tenant_request", ["tenantId", "requestKey"]),
});
