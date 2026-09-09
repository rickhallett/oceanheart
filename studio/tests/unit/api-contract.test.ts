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
type CompleteArgs = Assert<
  Equal<
    FunctionArgs<typeof api.tasks.setCompleted>,
    FunctionArgs<typeof practiceApi.setCompleted>
  >
>;
it("uses deployed command names", () => {
  expect(getFunctionName(practiceApi.tenants)).toBe("tenants:list");
  expect(getFunctionName(practiceApi.createTenant)).toBe("tenants:create");
  expect(getFunctionName(practiceApi.tasks)).toBe("tasks:list");
  expect(getFunctionName(practiceApi.createTask)).toBe("tasks:create");
  expect(getFunctionName(practiceApi.setCompleted)).toBe("tasks:setCompleted");
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
