import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  const link = page.getByRole("navigation", { name: "Practice navigation" })
    .getByRole("link", { name, exact: true });
  const destination = await link.getAttribute("href");
  await link.click();
  // A click resolves before the route and its menu-closing effect necessarily
  // commit. Wait for the destination before attempting another navigation.
  await expect(page).toHaveURL(new URL(destination!, page.url()).href);
  await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toHaveCount(0);
}

test("workspace navigation hydrates and fits the viewport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app");
  await expect(page.getByRole("main")).toBeVisible();
  // Exercise browser navigation, not only server responses for static routes.
  for (const [name, path] of [
    ["Bookings", "calendar"], ["Clients", "clients"],
    ["Knowledge", "knowledge"], ["Assistant", "assistant"],
    ["Shape the roadmap", "roadmap"],
  ]) {
    await navigate(page, name);
    await expect(page).toHaveURL(new RegExp(`/app/${path}$`));
    await expect(page.getByRole("heading", { name, exact: true, level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("task changes survive navigation and reload and stay isolated to one browser", async ({ page, browser }) => {
  const task = "Prepare the Thursday welcome pack";
  await page.goto("/app/tasks");
  await page.getByRole("textbox", { name: "New task" }).fill(task);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("checkbox", { name: task, exact: true }).check();
  await navigate(page, "Clients");
  await navigate(page, "Tasks");
  await expect(page.getByRole("checkbox", { name: task, exact: true })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: task, exact: true })).toBeChecked();
  // Fresh context models a different browser; this is prototype isolation,
  // not evidence of server-side tenant authorisation.
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(new URL("/app/tasks", page.url()).href);
    await expect(otherPage.getByRole("textbox", { name: "New task" })).toBeVisible();
    await expect(otherPage.getByRole("checkbox", { name: task, exact: true })).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test("explicit fictional demo remains isolated across navigation and reload", async ({ page }) => {
  const dataRequests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).hostname.endsWith("convex.cloud")) dataRequests.push(request.url());
  });
  await page.goto("/app?demo=1");
  await expect(page.getByRole("heading", { name: "Good morning, Rick Hallett." })).toBeVisible();
  if (page.viewportSize()!.width < 768) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/clients\?demo=1$/);
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Clients", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/app\?demo=1$/);
  expect(dataRequests).toEqual([]);
});
