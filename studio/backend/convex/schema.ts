import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { availabilityObject } from "./lib/settings";
export default defineSchema({
  gmailConnections: defineTable({tenantId:v.id("tenants"),mailbox:v.optional(v.string()),status:v.union(v.literal("connected"),v.literal("disconnected"),v.literal("reauth_required")),generation:v.number(),refreshCipher:v.optional(v.string())}).index("by_tenant",["tenantId"]),
  gmailOAuthStates: defineTable({tenantId:v.id("tenants"),stateHash:v.string(),bindingHash:v.string(),sessionHash:v.string(),verifierCipher:v.string(),actor:v.string(),generation:v.number(),expiresAt:v.number(),used:v.boolean(),completed:v.boolean()}).index("by_state",["stateHash"]),
  gmailImports: defineTable({tenantId:v.id("tenants"),mailbox:v.string(),messageId:v.string(),threadId:v.string(),enquiryId:v.id("enquiries"),truncated:v.boolean()}).index("by_message",["tenantId","mailbox","messageId"]).index("by_enquiry",["enquiryId"]),
  enquiries: defineTable({tenantId:v.id("tenants"),name:v.string(),email:v.optional(v.string()),phone:v.optional(v.string()),subject:v.string(),message:v.string(),draft:v.string(),resolved:v.boolean(),revision:v.number(),createdAt:v.number(),createdBy:v.string(),requestKey:v.string(),creationPayload:v.string(),clientId:v.optional(v.id("clients")),bookingId:v.optional(v.id("bookings"))}).index("by_tenant_resolved",["tenantId","resolved"]).index("by_tenant_request",["tenantId","requestKey"]),
  enquiryEvents: defineTable({tenantId:v.id("tenants"),enquiryId:v.id("enquiries"),action:v.union(v.literal("captured"),v.literal("draft_saved"),v.literal("converted"),v.literal("resolved"),v.literal("reopened")),at:v.number(),actor:v.string(),revision:v.number(),draft:v.optional(v.string()),clientId:v.optional(v.id("clients")),bookingId:v.optional(v.id("bookings"))}).index("by_enquiry",["enquiryId"]),
  enquiryConversions: defineTable({tenantId:v.id("tenants"),enquiryId:v.id("enquiries"),requestKey:v.string(),payload:v.string(),actor:v.string(),clientId:v.id("clients"),bookingId:v.optional(v.id("bookings"))}).index("by_tenant_request",["tenantId","requestKey"]),
  tenants: defineTable({ name: v.string(), timeZone:v.optional(v.string()), createdBy: v.optional(v.string()), requestKey: v.optional(v.string()),
    tagline:v.optional(v.string()),contactEmail:v.optional(v.string()),contactPhone:v.optional(v.string()),address:v.optional(v.string()),availability:v.optional(availabilityObject),revision:v.optional(v.number()) })
    .index("by_creator_request", ["createdBy", "requestKey"]),
  services: defineTable({tenantId:v.id("tenants"),name:v.string(),durationMinutes:v.number(),priceMinor:v.number(),currency:v.literal("GBP"),description:v.optional(v.string()),revision:v.optional(v.number()),creationPayload:v.optional(v.string()),active:v.boolean(),createdAt:v.number(),createdBy:v.string(),requestKey:v.string()})
    .index("by_tenant",["tenantId"]).index("by_tenant_request",["tenantId","requestKey"]).index("by_tenant_active",["tenantId","active"]),
  clients: defineTable({tenantId:v.id("tenants"),name:v.string(),email:v.optional(v.string()),phone:v.optional(v.string()),revision:v.optional(v.number()),creationPayload:v.optional(v.string()),archived:v.optional(v.boolean()),searchText:v.optional(v.string()),createdAt:v.number(),createdBy:v.string(),requestKey:v.string()})
    .index("by_tenant",["tenantId"]).index("by_tenant_request",["tenantId","requestKey"]).index("by_tenant_archived",["tenantId","archived"]).searchIndex("search_clients",{searchField:"searchText",filterFields:["tenantId","archived"]}),
  tasks: defineTable({ tenantId: v.id("tenants"), title: v.string(), completed: v.boolean(), createdAt: v.number(), createdBy: v.string(), requestKey: v.string(), revision: v.optional(v.number()), removedAt: v.optional(v.number()), creationTitle: v.optional(v.string()) })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_removed", ["tenantId", "removedAt"])
    .index("by_tenant_removed_completed", ["tenantId", "removedAt", "completed"])
    .index("by_tenant_request", ["tenantId", "requestKey"]),
  memberships: defineTable({
    tenantId: v.id("tenants"),
    identity: v.string(),
    role: v.union(v.literal("owner"), v.literal("viewer")),
  })
    .index("by_tenant_identity", ["tenantId", "identity"])
    .index("by_identity", ["identity"]),
  bookingEvents: defineTable({tenantId:v.id("tenants"),bookingId:v.id("bookings"),action:v.union(v.literal("created"),v.literal("rescheduled"),v.literal("cancelled")),at:v.number(),actor:v.string(),revision:v.number(),startsAt:v.number(),endsAt:v.number(),previousStartsAt:v.optional(v.number()),previousEndsAt:v.optional(v.number())}).index("by_booking",["bookingId"]),
  bookings: defineTable({
    clientId:v.optional(v.id("clients")),serviceId:v.optional(v.id("services")),
    serviceSnapshot:v.optional(v.object({name:v.string(),durationMinutes:v.number(),priceMinor:v.number(),currency:v.literal("GBP")})),
    timeZone:v.optional(v.string()),status:v.optional(v.union(v.literal("scheduled"),v.literal("cancelled"))),revision:v.optional(v.number()),creationPayload:v.optional(v.string()),
    tenantId: v.id("tenants"),
    practitionerId: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
    clientLabel: v.string(),
    requestKey: v.string(),
    createdBy: v.string(),
  })
    .index("by_tenant_start",["tenantId","startsAt"])
    .index("by_tenant_practitioner_start", [
      "tenantId",
      "practitionerId",
      "startsAt",
    ])
    .index("by_tenant_request", ["tenantId", "requestKey"]),
});
