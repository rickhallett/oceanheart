import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  demoClients,
  demoServices,
  demoEnquiries,
  demoTasks,
} from "./lib/demoData";
import { searchText } from "./lib/catalog";
import { practiceDayAt } from "./lib/practiceDay";

// Operator-only, additive and atomic. No public action, scheduler or automatic import.
// A fixed request key makes retries return the original practice without resetting edits.
export const seedRick = internalMutation({
  args: { sourceTenantId: v.id("tenants"), ownerIdentity: v.string() },
  handler: async (ctx, { sourceTenantId, ownerIdentity }) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_tenant_identity", (q) =>
        q.eq("tenantId", sourceTenantId).eq("identity", ownerIdentity),
      )
      .unique();
    if (membership?.role !== "owner" || !(await ctx.db.get(sourceTenantId)))
      throw new ConvexError("OWNER_REQUIRED");
    const requestKey = "rick-hallett-fictional-demo-v1";
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_creator_request", (q) =>
        q.eq("createdBy", ownerIdentity).eq("requestKey", requestKey),
      )
      .unique();
    if (existing) return { tenantId: existing._id, created: false };
    const now = Date.now();
    const tenantId = await ctx.db.insert("tenants", {
      name: "Rick Hallett — Demo Practice",
      createdBy: ownerIdentity,
      requestKey,
      timeZone: "Europe/London",
      revision: 0,
      tagline:
        "Fictional clients. Real buttons. A modest resistance to productivity theatre.",
      contactEmail: "rick@example.com",
      address: "The Fictional Rooms, Bristol & online",
      availability: {
        monday: { open: "09:00", close: "17:00" },
        tuesday: { open: "09:00", close: "17:00" },
        wednesday: { open: "09:00", close: "17:00" },
        thursday: { open: "09:00", close: "17:00" },
        friday: { open: "09:00", close: "17:00" },
        saturday: null,
        sunday: null,
      },
    });
    await ctx.db.insert("memberships", {
      tenantId,
      identity: ownerIdentity,
      role: "owner",
    });
    const clients = [];
    for (const [i, [name, background, note]] of demoClients.entries()) {
      const email = `${name.toLowerCase().replaceAll(" ", ".")}@example.com`;
      const phone = `07700 900${100 + i}`;
      clients.push(
        await ctx.db.insert("clients", {
          tenantId,
          name,
          email,
          phone,
          archived: i === 23,
          searchText: searchText(name, email),
          revision: 0,
          createdAt: now - i * 86400000,
          createdBy: ownerIdentity,
          requestKey: `${requestKey}:client:${i}`,
          creationPayload: JSON.stringify({ name, email, phone }),
          privateNotes: `Fictional demonstration client.\n\n${background}\n\n${note}`,
          notesRevision: 0,
        }),
      );
    }
    const services = [];
    for (const [
      i,
      [name, durationMinutes, price, description],
    ] of demoServices.entries()) {
      const data = {
        name,
        durationMinutes,
        priceMinor: price * 100,
        currency: "GBP" as const,
        description,
      };
      services.push(
        await ctx.db.insert("services", {
          tenantId,
          ...data,
          active: i < 9,
          revision: 0,
          creationPayload: JSON.stringify(data),
          createdAt: now,
          createdBy: ownerIdentity,
          requestKey: `${requestKey}:service:${i}`,
        }),
      );
    }
    const day = practiceDayAt("Europe/London", now)!;
    const dateAt = (offset: number) => {
      const date = new Date(`${day.day}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const bookings = [];
    for (let i = 0; i < 48; i++) {
      const localDay = practiceDayAt(
        "Europe/London",
        Date.parse(`${dateAt(Math.floor(i / 4) - 4)}T12:00:00Z`),
      )!;
      const startsAt = localDay.to - 86400000 + (9 + (i % 4) * 2) * 3600000;
      const [name, durationMinutes, price] = demoServices[i % 9];
      const endsAt = startsAt + durationMinutes * 60000;
      const status =
        i % 11 === 0 ? ("cancelled" as const) : ("scheduled" as const);
      const bookingId = await ctx.db.insert("bookings", {
        tenantId,
        clientId: clients[i % 24],
        serviceId: services[i % 9],
        serviceSnapshot: {
          name,
          durationMinutes,
          priceMinor: price * 100,
          currency: "GBP",
        },
        timeZone: "Europe/London",
        status,
        revision: status === "cancelled" ? 1 : 0,
        practitionerId: ownerIdentity,
        startsAt,
        endsAt,
        clientLabel: demoClients[i % 24][0],
        requestKey: `${requestKey}:booking:${i}`,
        createdBy: ownerIdentity,
      });
      bookings.push(bookingId);
      await ctx.db.insert("bookingEvents", {
        tenantId,
        bookingId,
        action: "created",
        at: now - 7 * 86400000,
        actor: ownerIdentity,
        revision: 0,
        startsAt,
        endsAt,
      });
      if (status === "cancelled")
        await ctx.db.insert("bookingEvents", {
          tenantId,
          bookingId,
          action: "cancelled",
          at: now,
          actor: ownerIdentity,
          revision: 1,
          startsAt,
          endsAt,
        });
    }
    for (const [i, title] of demoTasks.entries()) {
      const dueDate = i % 7 === 0 ? undefined : dateAt((i % 9) - 2);
      const clientId = i < 23 ? clients[i] : undefined;
      await ctx.db.insert("tasks", {
        tenantId,
        title,
        completed: i % 5 === 0,
        createdAt: now - i * 60000,
        createdBy: ownerIdentity,
        requestKey: `${requestKey}:task:${i}`,
        revision: 0,
        creationTitle: title,
        ...(dueDate ? { dueDate, creationDueDate: dueDate } : {}),
        ...(clientId ? { clientId, creationClientId: clientId } : {}),
      });
    }
    for (const [i, [subject, message, draft]] of demoEnquiries.entries()) {
      const clientIndex = i === 19 ? 23 : i;
      const name = demoClients[clientIndex][0],
        email = `${name.toLowerCase().replaceAll(" ", ".")}@example.com`;
      const data = { name, email, subject, message };
      const enquiryId = await ctx.db.insert("enquiries", {
        tenantId,
        ...data,
        draft,
        resolved: i > 16,
        revision: 0,
        createdAt: now - i * 3600000,
        createdBy: ownerIdentity,
        requestKey: `${requestKey}:enquiry:${i}`,
        creationPayload: JSON.stringify(data),
        ...(i % 3 === 0
          ? { clientId: clients[clientIndex], bookingId: bookings[clientIndex] }
          : {}),
      });
      await ctx.db.insert("enquiryEvents", {
        tenantId,
        enquiryId,
        action: "captured",
        at: now - i * 3600000,
        actor: ownerIdentity,
        revision: 0,
      });
    }
    return {
      tenantId,
      created: true,
      clients: 24,
      services: 10,
      bookings: 48,
      tasks: 36,
      enquiries: 20,
    };
  },
});
