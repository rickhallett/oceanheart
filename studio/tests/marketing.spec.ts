import { expect, test } from "@playwright/test";

test("Studio root opens the application and links to the canonical product page", async ({ page, request }) => {
  const response = await request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/app");
  await page.goto("/");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("link", { name: "About Studio", exact: true }).first()).toHaveAttribute("href", "https://www.oceanheart.ai/studio");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
