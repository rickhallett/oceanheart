import { expect, it } from "vitest";
import type { api } from "../../backend/convex/_generated/api";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReturnType,
} from "convex/server";
import { practiceApi } from "../../src/components/practice/api";

// Both directions reject argument/return drift while keeping backend runtime out
// of the client bundle. TypeScript checks this alongside application markup.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type TenantArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tenants.create>,
    FunctionArgs<typeof practiceApi.createTenant>
  >
>;
type TenantResult = Assert<
  Equal<
    FunctionReturnType<typeof api.tenants.list>,
    FunctionReturnType<typeof practiceApi.tenants>
  >
>;
type TaskArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tasks.create>,
    FunctionArgs<typeof practiceApi.createTask>
  >
>;
type TaskResult = Assert<
  Equal<
    FunctionReturnType<typeof api.tasks.list>,
    FunctionReturnType<typeof practiceApi.tasks>
  >
>;
type TodayTaskArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tasks.today>,
    FunctionArgs<typeof practiceApi.todayTasks>
  >
>;
type TodayTaskResult = Assert<
  Equal<
    FunctionReturnType<typeof api.tasks.today>,
    FunctionReturnType<typeof practiceApi.todayTasks>
  >
>;
type TodayBookingArgs = Assert<
  Equal<
    FunctionArgs<typeof api.bookings.today>,
    FunctionArgs<typeof practiceApi.todayBookings>
  >
>;
type TodayBookingResult = Assert<
  Equal<
    FunctionReturnType<typeof api.bookings.today>,
    FunctionReturnType<typeof practiceApi.todayBookings>
  >
>;
type CompleteArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tasks.setCompleted>,
    FunctionArgs<typeof practiceApi.setCompleted>
  >
>;
type TaskUpdateArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tasks.update>,
    FunctionArgs<typeof practiceApi.updateTask>
  >
>;
type TaskRemoveArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tasks.remove>,
    FunctionArgs<typeof practiceApi.removeTask>
  >
>;
it("uses deployed command names", () => {
  expect(getFunctionName(practiceApi.tenants)).toBe("tenants:list");
  expect(getFunctionName(practiceApi.createTenant)).toBe("tenants:create");
  expect(getFunctionName(practiceApi.tasks)).toBe("tasks:list");
  expect(getFunctionName(practiceApi.todayTasks)).toBe("tasks:today");
  expect(getFunctionName(practiceApi.todayBookings)).toBe("bookings:today");
  expect(getFunctionName(practiceApi.createTask)).toBe("tasks:create");
  expect(getFunctionName(practiceApi.setCompleted)).toBe("tasks:setCompleted");
  expect(getFunctionName(practiceApi.updateTask)).toBe("tasks:update");
  expect(getFunctionName(practiceApi.removeTask)).toBe("tasks:remove");
});
type ServiceCreateArgs = Assert<
  Equal<
    FunctionArgs<typeof api.services.create>,
    FunctionArgs<typeof practiceApi.createService>
  >
>;
type ServiceListArgs = Assert<
  Equal<
    FunctionArgs<typeof api.services.list>,
    FunctionArgs<typeof practiceApi.services>
  >
>;
type ServiceListResult = Assert<
  Equal<
    FunctionReturnType<typeof api.services.list>,
    FunctionReturnType<typeof practiceApi.services>
  >
>;
type ClientCreateArgs = Assert<
  Equal<
    FunctionArgs<typeof api.clients.create>,
    FunctionArgs<typeof practiceApi.createClient>
  >
>;
type ClientListArgs = Assert<
  Equal<
    FunctionArgs<typeof api.clients.list>,
    FunctionArgs<typeof practiceApi.clients>
  >
>;
type ClientListResult = Assert<
  Equal<
    FunctionReturnType<typeof api.clients.list>,
    FunctionReturnType<typeof practiceApi.clients>
  >
>;
it("uses deployed service and client command names", () => {
  expect(getFunctionName(practiceApi.services)).toBe("services:list");
  expect(getFunctionName(practiceApi.createService)).toBe("services:create");
  expect(getFunctionName(practiceApi.clients)).toBe("clients:list");
  expect(getFunctionName(practiceApi.createClient)).toBe("clients:create");
});
type ServiceUpdateArgs = Assert<
  Equal<
    FunctionArgs<typeof api.services.update>,
    FunctionArgs<typeof practiceApi.updateService>
  >
>;
type ClientUpdateArgs = Assert<
  Equal<
    FunctionArgs<typeof api.clients.update>,
    FunctionArgs<typeof practiceApi.updateClient>
  >
>;
type ServiceArchiveArgs = Assert<
  Equal<
    FunctionArgs<typeof api.services.setArchived>,
    FunctionArgs<typeof practiceApi.archiveService>
  >
>;
type ClientArchiveArgs = Assert<
  Equal<
    FunctionArgs<typeof api.clients.setArchived>,
    FunctionArgs<typeof practiceApi.archiveClient>
  >
>;
it("uses deployed edit and archive command names", () => {
  expect(getFunctionName(practiceApi.updateService)).toBe("services:update");
  expect(getFunctionName(practiceApi.updateClient)).toBe("clients:update");
  expect(getFunctionName(practiceApi.archiveService)).toBe(
    "services:setArchived",
  );
  expect(getFunctionName(practiceApi.archiveClient)).toBe(
    "clients:setArchived",
  );
});

type setTimeZoneArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tenants.setTimeZone>,
    FunctionArgs<typeof practiceApi.setTimeZone>
  >
>;
type setTimeZoneResult = Assert<
  Equal<
    FunctionReturnType<typeof api.tenants.setTimeZone>,
    FunctionReturnType<typeof practiceApi.setTimeZone>
  >
>;
type settingsGetArgs = Assert<
  Equal<
    FunctionArgs<typeof api.settings.get>,
    FunctionArgs<typeof practiceApi.settings>
  >
>;
type settingsGetResult = Assert<
  Equal<
    FunctionReturnType<typeof api.settings.get>,
    FunctionReturnType<typeof practiceApi.settings>
  >
>;
type settingsUpdateArgs = Assert<
  Equal<
    FunctionArgs<typeof api.settings.update>,
    FunctionArgs<typeof practiceApi.updateSettings>
  >
>;
type settingsUpdateResult = Assert<
  Equal<
    FunctionReturnType<typeof api.settings.update>,
    FunctionReturnType<typeof practiceApi.updateSettings>
  >
>;
type bookingsArgs = Assert<
  Equal<
    FunctionArgs<typeof api.bookings.list>,
    FunctionArgs<typeof practiceApi.bookings>
  >
>;
type bookingsResult = Assert<
  Equal<
    FunctionReturnType<typeof api.bookings.list>,
    FunctionReturnType<typeof practiceApi.bookings>
  >
>;
type startBookingCheckoutArgs = Assert<
  Equal<
    FunctionArgs<typeof api.payments.startCheckout>,
    FunctionArgs<typeof practiceApi.startBookingCheckout>
  >
>;
type startBookingCheckoutResult = Assert<
  Equal<
    FunctionReturnType<typeof api.payments.startCheckout>,
    FunctionReturnType<typeof practiceApi.startBookingCheckout>
  >
>;
type paymentAvailabilityArgs = Assert<
  Equal<
    FunctionArgs<typeof api.payments.availability>,
    FunctionArgs<typeof practiceApi.paymentAvailability>
  >
>;
type paymentAvailabilityResult = Assert<
  Equal<
    FunctionReturnType<typeof api.payments.availability>,
    FunctionReturnType<typeof practiceApi.paymentAvailability>
  >
>;
type createBookingArgs = Assert<
  Equal<
    FunctionArgs<typeof api.bookings.createLinked>,
    FunctionArgs<typeof practiceApi.createBooking>
  >
>;
type createBookingResult = Assert<
  Equal<
    FunctionReturnType<typeof api.bookings.createLinked>,
    FunctionReturnType<typeof practiceApi.createBooking>
  >
>;
type rescheduleBookingArgs = Assert<
  Equal<
    FunctionArgs<typeof api.bookings.reschedule>,
    FunctionArgs<typeof practiceApi.rescheduleBooking>
  >
>;
type rescheduleBookingResult = Assert<
  Equal<
    FunctionReturnType<typeof api.bookings.reschedule>,
    FunctionReturnType<typeof practiceApi.rescheduleBooking>
  >
>;
type cancelBookingArgs = Assert<
  Equal<
    FunctionArgs<typeof api.bookings.cancel>,
    FunctionArgs<typeof practiceApi.cancelBooking>
  >
>;
type cancelBookingResult = Assert<
  Equal<
    FunctionReturnType<typeof api.bookings.cancel>,
    FunctionReturnType<typeof practiceApi.cancelBooking>
  >
>;
it("uses deployed booking and timezone command names", () => {
  expect(getFunctionName(practiceApi.setTimeZone)).toBe("tenants:setTimeZone");
  expect(getFunctionName(practiceApi.bookings)).toBe("bookings:list");
  expect(getFunctionName(practiceApi.startBookingCheckout)).toBe(
    "payments:startCheckout",
  );
  expect(getFunctionName(practiceApi.paymentAvailability)).toBe(
    "payments:availability",
  );
  expect(getFunctionName(practiceApi.createBooking)).toBe(
    "bookings:createLinked",
  );
  expect(getFunctionName(practiceApi.rescheduleBooking)).toBe(
    "bookings:reschedule",
  );
  expect(getFunctionName(practiceApi.cancelBooking)).toBe("bookings:cancel");
  expect(getFunctionName(practiceApi.settings)).toBe("settings:get");
  expect(getFunctionName(practiceApi.updateSettings)).toBe("settings:update");
});

import { enquiryApi } from "../../src/components/practice/enquiry-api";
type EnquirylistArgs = Assert<
  Equal<
    FunctionArgs<typeof api.enquiries.list>,
    FunctionArgs<typeof enquiryApi.list>
  >
>;
type EnquirylistResult = Assert<
  Equal<
    FunctionReturnType<typeof api.enquiries.list>,
    FunctionReturnType<typeof enquiryApi.list>
  >
>;
type EnquirygetArgs = Assert<
  Equal<
    FunctionArgs<typeof api.enquiries.get>,
    FunctionArgs<typeof enquiryApi.get>
  >
>;
type EnquirygetResult = Assert<
  Equal<
    FunctionReturnType<typeof api.enquiries.get>,
    FunctionReturnType<typeof enquiryApi.get>
  >
>;
type EnquirycreateArgs = Assert<
  Equal<
    FunctionArgs<typeof api.enquiries.create>,
    FunctionArgs<typeof enquiryApi.create>
  >
>;
type EnquirycreateResult = Assert<
  Equal<
    FunctionReturnType<typeof api.enquiries.create>,
    FunctionReturnType<typeof enquiryApi.create>
  >
>;
type EnquirysaveDraftArgs = Assert<
  Equal<
    FunctionArgs<typeof api.enquiries.saveDraft>,
    FunctionArgs<typeof enquiryApi.saveDraft>
  >
>;
type EnquirysaveDraftResult = Assert<
  Equal<
    FunctionReturnType<typeof api.enquiries.saveDraft>,
    FunctionReturnType<typeof enquiryApi.saveDraft>
  >
>;
type EnquirysetResolvedArgs = Assert<
  Equal<
    FunctionArgs<typeof api.enquiries.setResolved>,
    FunctionArgs<typeof enquiryApi.setResolved>
  >
>;
type EnquirysetResolvedResult = Assert<
  Equal<
    FunctionReturnType<typeof api.enquiries.setResolved>,
    FunctionReturnType<typeof enquiryApi.setResolved>
  >
>;
type EnquiryconvertArgs = Assert<
  Equal<
    FunctionArgs<typeof api.enquiries.convert>,
    FunctionArgs<typeof enquiryApi.convert>
  >
>;
type EnquiryconvertResult = Assert<
  Equal<
    FunctionReturnType<typeof api.enquiries.convert>,
    FunctionReturnType<typeof enquiryApi.convert>
  >
>;
it("uses deployed enquiry command names", () => {
  expect(getFunctionName(enquiryApi.list)).toBe("enquiries:list");
  expect(getFunctionName(enquiryApi.get)).toBe("enquiries:get");
  expect(getFunctionName(enquiryApi.create)).toBe("enquiries:create");
  expect(getFunctionName(enquiryApi.saveDraft)).toBe("enquiries:saveDraft");
  expect(getFunctionName(enquiryApi.setResolved)).toBe("enquiries:setResolved");
  expect(getFunctionName(enquiryApi.convert)).toBe("enquiries:convert");
});
