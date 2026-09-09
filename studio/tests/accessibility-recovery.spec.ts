import { expect, test } from "@playwright/test";
import { initialState } from "../src/components/workspace/model";
import { restoreState } from "../src/components/workspace/persisted-state";

const storageKey = "oceanheart-studio-workspace-v1";

test("saved state rejects malformed entities and broken references", () => {
  expect(restoreState(initialState)).toEqual(initialState);
  expect(restoreState({ practice: {} })).toBeNull();
  expect(restoreState({ clients: [null] })).toBeNull();
  expect(
    restoreState({ services: [{ ...initialState.services[0], price: "65" }] }),
  ).toBeNull();
  expect(restoreState({ clients: [] })).toBeNull();
  expect(
    restoreState({ tasks: [{ id: "x", text: "hello", done: "yes" }] }),
  ).toBeNull();
  expect(restoreState({ priorities: { today: "Invalid" } })).toBeNull();
  expect(restoreState({ activity: [null] })).toBeNull();
  expect(
    restoreState({
      chatHistory: [
        {
          q: "Question",
          answer: "Answer",
          trace: [],
          citation: { content: null },
        },
      ],
    }),
  ).toBeNull();
  expect(
    restoreState({ setupDescription: "Valid older snapshot" })
      ?.setupDescription,
  ).toBe("Valid older snapshot");
});

test("corrupt saved practice recovers without hydration errors and preserves rejected data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ key }) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          practice: {},
          clients: [],
          bookings: [],
          priorities: {},
        }),
      ),
    { key: storageKey },
  );
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Good morning, Amelia." }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Saved practice data could not be restored",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(`${key}-recovery`)!).practice,
      storageKey,
    ),
  ).toEqual({});
  expect(errors).toEqual([]);
});

test("closed mobile navigation is inaccessible and open drawer manages keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  const toggle = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("navigation", { name: "Practice navigation" }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog", { name: "Practice navigation" });
  const close = drawer.getByRole("button", {
    name: "Close navigation",
    exact: true,
  });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.locator(".ws-user")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("navigation", { name: "Practice navigation" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Find anything", exact: true }),
  ).toBeVisible();
});

test("modal retains control focus through context updates and restores opener", async ({
  page,
}) => {
  await page.goto("/app/support");
  const opener = page.getByRole("button", {
    name: /Help me tidy up my booking page/,
  });
  await opener.click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("textbox");
  await input.fill("Keyboard focus should stay in this conversation.");
  await input.press("Tab");
  await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const submit = dialog.getByRole("button", { name: "Add sample message" });
  await expect(submit).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(submit).toBeFocused();
  await expect(dialog).toContainText(
    "Keyboard focus should stay in this conversation.",
  );
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});
