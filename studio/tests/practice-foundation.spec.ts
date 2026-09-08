import { expect, test } from "@playwright/test";
import {
  dayWindow,
  localDate,
  readableError,
} from "../src/components/practice/api";

test("private practice is unavailable without configuration while the public mock stays usable", async ({
  page,
}) => {
  test.skip(
    Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
        process.env.NEXT_PUBLIC_CONVEX_URL &&
        process.env.CLERK_SECRET_KEY,
    ),
    "Configured provider needs a real test account; do not exercise hosted accounts in the secretless suite.",
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/practice");
  await expect(
    page.getByRole("heading", { name: "Your workspace is taking shape." }),
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

test("booking date windows and errors have stable user-facing semantics", () => {
  const selected = new Date(2030, 0, 15, 12);
  expect(localDate(selected)).toBe("2030-01-15");
  const range = dayWindow("2030-01-15");
  expect(new Date(range.from).getHours()).toBe(0);
  expect(localDate(new Date(range.to))).toBe("2030-01-16");
  expect(readableError(new Error("BOOKING_CONFLICT"))).toContain(
    "already booked",
  );
  expect(readableError(new Error("FORBIDDEN"))).toContain("access");
  expect(readableError(new Error("sensitive provider detail"))).not.toContain(
    "sensitive provider detail",
  );
});
