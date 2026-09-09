import { expect, test, type Page } from "@playwright/test";
import { initialState, type State } from "../src/components/workspace/model";
const storageKey = "oceanheart-studio-workspace-v1";
async function seed(page: Page, change: (s: State) => void, path: string) {
  const data = structuredClone(initialState);
  change(data);
  await page.addInitScript(
    ({ data, key }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(data));
    },
    { data, key: storageKey },
  );
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
}
async function stored(page: Page): Promise<State> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  );
}

test("hidden services prevent new bookings without crashing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(
    page,
    (s) => s.services.forEach((v) => (v.active = false)),
    "/app/calendar",
  );
  await page.getByRole("button", { name: "New booking", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "Add or show a service before booking a session.",
  );
  await expect(
    page.getByRole("button", { name: "Confirm booking" }),
  ).toBeDisabled();
  expect((await stored(page)).bookings).toHaveLength(
    initialState.bookings.length,
  );
  expect(errors).toEqual([]);
});

test("editing hidden services preserves visibility and fractional prices", async ({
  page,
}) => {
  await seed(page, (s) => (s.services[0].active = false), "/app/services");
  await page
    .getByRole("button", { name: "Edit details", exact: true })
    .first()
    .click();
  await page.getByLabel("Price (£)", { exact: true }).fill("62.50");
  await page.getByRole("button", { name: "Save service", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".ws-price").filter({ hasText: "£62.50" }),
  ).toBeVisible();
  const data = await stored(page);
  expect(data.services[0].active).toBe(false);
  expect(data.services[0].price).toBe(62.5);
});

test("portal rescheduling preserves client service and payment state", async ({
  page,
}) => {
  await seed(
    page,
    (s) => {
      s.bookings = [s.bookings[3]];
      s.services[0].active = false;
    },
    "/app/portal",
  );
  await page.getByRole("button", { name: "Change time", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Client", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Service", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Service", exact: true }),
  ).toHaveValue("s1");
  await page.getByLabel("Date", { exact: true }).fill("2026-09-11");
  await page.getByLabel("Time", { exact: true }).fill("12:00");
  await page.getByRole("button", { name: "Save new time" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const data = await stored(page);
  expect(data.bookings[0]).toEqual({
    ...initialState.bookings[3],
    day: "2026-09-11",
    time: "12:00",
  });
  expect(data.payments).toEqual(initialState.payments);
  expect(data.clients).toEqual(initialState.clients);
});

test("completed sessions cannot be rescheduled and leave upcoming portal sessions", async ({
  page,
}) => {
  await seed(
    page,
    (s) => {
      s.bookings = [s.bookings[0]];
      s.bookings[0].status = "Completed";
    },
    "/app/calendar",
  );
  await page.locator(".ws-agenda-row").click();
  await expect(
    page.getByRole("button", { name: "Reschedule", exact: true }),
  ).toBeDisabled();
  await page.goto("/app/portal");
  await expect(
    page.getByRole("heading", { name: "Your next sessions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Change time", exact: true }),
  ).toHaveCount(0);
});

test("reset clears unsaved settings fields before a subsequent save", async ({
  page,
}) => {
  await seed(page, () => {}, "/app/settings");
  await page
    .getByLabel("Practice name", { exact: true })
    .fill("Unsaved practice");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Restore sample data", exact: true })
    .click();
  await expect(page.getByLabel("Practice name", { exact: true })).toHaveValue(
    initialState.practice.name,
  );
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  expect((await stored(page)).practice).toEqual(initialState.practice);
});

test("reply and refund requests cannot be queued twice", async ({ page }) => {
  await seed(page, (s) => (s.approvals = []), "/app/inbox");
  if (page.viewportSize()!.width < 768)
    await page.locator(".ws-inbox-list").getByRole("button", { name: /A first appointment/ }).click();
  await page
    .getByLabel("Your reply", { exact: true })
    .fill("Thank you. We can arrange a first conversation.");
  const send = page.getByRole("button", { name: "Send to approval queue" });
  await send.click();
  await expect(send).toBeDisabled();
  await page.reload();
  if (page.viewportSize()!.width < 768)
    await page.locator(".ws-inbox-list").getByRole("button", { name: /A first appointment/ }).click();
  await expect(send).toBeDisabled();
  expect(
    (await stored(page)).approvals.filter((a) => a.type === "reply"),
  ).toHaveLength(1);
  await page.goto("/app/payments");
  const refund = page
    .getByRole("button", { name: "Request refund", exact: true })
    .first();
  await refund.click();
  await expect(refund).toBeDisabled();
  await page.reload();
  await expect(refund).toBeDisabled();
  expect(
    (await stored(page)).approvals.filter((a) => a.type === "refund"),
  ).toHaveLength(1);
});
