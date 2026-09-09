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
  expect(getFunctionName(practiceApi.tasks)).toBe("tasks:list");
  expect(getFunctionName(practiceApi.createTask)).toBe("tasks:create");
  expect(getFunctionName(practiceApi.setCompleted)).toBe("tasks:setCompleted");
});
