import { expect, test } from "@playwright/test";
import { readableError } from "../src/components/practice/api";

test("private practice is unavailable without configuration while the public mock stays usable", async ({
  page,
}) => {
  test.skip(
    Boolean(
      process.env.WORKOS_CLIENT_ID &&
      process.env.NEXT_PUBLIC_CONVEX_URL &&
      process.env.WORKOS_API_KEY &&
      process.env.WORKOS_COOKIE_PASSWORD &&
      process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI,
    ),
    "Configured provider needs a real test account; do not exercise hosted accounts in the secretless suite.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/practice");
  await expect(
    page.getByRole("heading", { name: "Your practice is not available yet." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sign in|Create my practice/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to your practice" }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Explore the sample practice" }).click();
  await expect(
    page.getByRole("heading", { name: "Good morning, Amelia." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("provider errors are safe and readable", () => {
  expect(readableError(new Error("FORBIDDEN"))).toContain("access");
  expect(readableError(new Error("sensitive provider detail"))).not.toContain(
    "sensitive provider detail",
  );
});

test("unconfigured auth entry points return to practice without a provider redirect", async ({
  request,
}) => {
  test.skip(
    Boolean(process.env.WORKOS_API_KEY),
    "Secretless configuration check",
  );
  for (const path of ["/sign-in", "/callback?code=invalid&state=invalid"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 307]).toContain(response.status());
    expect(
      new URL(response.headers().location, "http://localhost").pathname,
    ).toBe("/practice");
  }
});
