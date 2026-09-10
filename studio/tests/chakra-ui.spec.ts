import { expect, test } from "@playwright/test";
import { modules } from "../src/components/workspace/model";

test("all site surfaces remain readable inside responsive viewports", async ({ page }, info) => {
  const widths = info.project.name.startsWith("mobile") ? [390] : [1440, 1024];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/", "/practice", ...modules.map(([view]) => `/app/${view}`)]) {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
      expect(dimensions.width, `${route} layout viewport at ${width}px`).toBeLessThanOrEqual(width + 1);
      expect(dimensions.document, `${route} document at ${width}px`).toBeLessThanOrEqual(width + 1);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      if (route === "/") {
        const heading = await page.locator("#hero-title").evaluate(element => ({ size: parseFloat(getComputedStyle(element).fontSize), font: getComputedStyle(element).fontFamily }));
        expect(heading.size).toBeGreaterThanOrEqual(width < 768 ? 40 : 44);
        expect(heading.font).toMatch(/Cormorant/i);
      }
      if (width !== 1024) await page.screenshot({ path: info.outputPath(`${route.replaceAll("/", "-") || "home"}-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]);
});

test("feature search supports arrow-key selection and returns focus on dismissal", async ({ page }) => {
  await page.goto("/app");
  const trigger = page.getByRole("button", { name: "Find anything", exact: true });
  await trigger.click();
  const search = page.getByRole("combobox", { name: "Find a workspace feature" });
  await expect(search).toBeFocused();
  await search.fill("Clients");
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/app\/clients$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await trigger.click();
  // The dialog moves focus after mounting; exercise Escape once its control is ready.
  await expect(search).toBeFocused();
  await search.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(search).toBeFocused();
  await search.fill("Payments");
  await page.getByRole("option", { name: /Payments/ }).click();
  await expect(page).toHaveURL(/\/app\/payments$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("record tables expose headers and assistant tabs support keyboard navigation", async ({ page }) => {
  await page.goto("/app/clients");
  if (page.viewportSize()!.width >= 768) {
    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "Client", exact: true })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Status", exact: true })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Client", exact: true })).toHaveCSS("border-top-width", "0px");
  } else {
    const client = page.getByRole("article").filter({ hasText: "Cressida Moonbeam" });
    await expect(client).toContainText("2 sessions");
    await expect(client.getByText("Returning", { exact: true })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  }
  await page.goto("/app/assistant");
  const conversation = page.getByRole("tab", { name: "Conversation", exact: true });
  await expect(conversation).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(conversation).toHaveCSS("border-top-width", "0px");
  await conversation.focus();
  await conversation.press("ArrowRight");
  const approval = page.getByRole("tab", { name: /Needs your approval/ });
  await expect(approval).toBeFocused();
  await expect(approval).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toBeVisible();
});

test("primary actions keep contrast and readable styling inside dialogs", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: "Let’s talk", exact: true }).first();
  await expect(cta).toHaveCSS("color", "rgb(23, 19, 15)");
  await page.goto("/app/clients");
  const add = page.getByRole("button", { name: "Add client", exact: true });
  await expect(add).toHaveCSS("font-size", "13px");
  await add.click();
  const dialog = page.getByRole("dialog");
  const submit = dialog.getByRole("button", { name: "Add client", exact: true });
  await expect(submit).toHaveCSS("border-radius", "6px");
  await expect(submit).toHaveCSS("font-size", "13px");
  await dialog.evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(34);
  await expect(dialog.getByRole("textbox", { name: "Full name" })).toHaveCSS("border-top-width", "1px");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("mobile records and support titles fit their containers", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/app/support");
  const row = page.locator(".ws-support-row").first();
  await expect(row).toBeVisible();
  const bounds = await row.evaluate(element => {
    const row = element.getBoundingClientRect();
    const title = element.querySelector("h3")!.getBoundingClientRect();
    const panel = element.closest(".ws-panel")!.getBoundingClientRect();
    return { rowBottom: row.bottom, titleBottom: title.bottom, panelBottom: panel.bottom };
  });
  expect(bounds.titleBottom).toBeLessThanOrEqual(bounds.rowBottom);
  expect(bounds.rowBottom).toBeLessThanOrEqual(bounds.panelBottom);
  await page.goto("/app/payments");
  const record = page.getByRole("article").filter({ hasText: "Cressida Moonbeam" }).filter({ hasText: "Paid" }).first();
  await expect(record.getByText("Paid", { exact: true })).toBeVisible();
  await expect(record.getByRole("button", { name: "Request refund", exact: true })).toBeVisible();
  expect((await record.boundingBox())!.width).toBeLessThanOrEqual(390);
  await page.goto("/app/inbox");
  await expect(page.locator(".ws-inbox-list")).toBeVisible();
  await page.locator(".ws-inbox-list").getByRole("button", { name: /Can I book a discovery call/ }).click();
  await expect(page.getByRole("textbox", { name: "Your reply" })).toBeVisible();
  await page.getByRole("button", { name: "Back to enquiries", exact: true }).click();
  await expect(page.locator(".ws-inbox-list")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  for (const route of ["/", "/app/today", "/app/support", "/app/payments", "/app/inbox"]) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${route} at 320px`).toBeLessThanOrEqual(320);
  }
});


test("notifications remain inside the viewport", async ({ page }) => {
  await page.goto("/app/payments");
  await page.getByRole("button", { name: "Simulate payment", exact: true }).first().click();
  const notice = page.getByRole("status").filter({ hasText: "Sample payment received" });
  await expect(notice).toBeVisible();
  await expect.poll(async () => {
    const bounds = await notice.boundingBox();
    const viewport = page.viewportSize()!;
    return !!bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height;
  }).toBe(true);
});
