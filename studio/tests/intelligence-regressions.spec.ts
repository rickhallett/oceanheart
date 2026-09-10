import { test, expect, type Page } from "@playwright/test";
import { initialState, type State } from "../src/components/workspace/model";
const key = "oceanheart-studio-rick-demo-v1";
async function seed(page: Page, change: (state: State) => void = () => {}) {
  const state = structuredClone(initialState);
  change(state);
  await page.addInitScript(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
    { key, state },
  );
  await page.goto("/app/assistant");
  await expect(
    page.getByRole("textbox", { name: "Ask the assistant" }),
  ).toBeVisible();
}
async function ask(page: Page, q: string) {
  await page.getByRole("textbox", { name: "Ask the assistant" }).fill(q);
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
}
async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    key,
  ) as Promise<State>;
}
test("unknown clinical and mixed questions abstain even with overlapping document words", async ({
  page,
}) => {
  await seed(page);
  for (const q of [
    "Is reflexology safe during chemotherapy?",
    "Should I stop insulin before my session?",
    "What is the cancellation policy and will it heal cancer?",
  ]) {
    await ask(page, q);
    await expect(page.locator(".ws-chat-turn").last()).toContainText(
      "I can’t answer this",
    );
  }
  expect((await stored(page)).chatHistory.every((c) => !c.citation)).toBe(true);
  await ask(page, "What is the cancellation policy?");
  await expect(page.locator(".ws-chat-turn").last()).toContainText("24 hours");
});
test("saved citation renders snapshot, not current source", async ({
  page,
}) => {
  await seed(page, (state) => {
    const source = structuredClone(state.sources[0]);
    state.chatHistory.push({
      q: "What is the cancellation policy?",
      answer: source.content,
      sourceId: source.id,
      citation: source,
      trace: ["Saved example"],
    });
    state.sources[0].title = "Revised policy";
    state.sources[0].content = "72 hours notice";
    state.sources[0].version = 9;
  });
  const details = page.getByRole("button", { name: "Answer details", exact: true });
  await details.click();
  await expect(page.getByRole("dialog")).toContainText("Saved example");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(details).toBeFocused();
  await page
    .getByRole("button", { name: "Booking & cancellation policy · v2" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Version 2");
  await expect(dialog).toContainText("24 hours");
  await expect(dialog).not.toContainText("72 hours");
});
test("stale refund and reply approvals are rejected without applied outcome", async ({
  page,
}) => {
  await seed(page, (state) => {
    state.payments.find((p) => p.id === "p2")!.status = "Refunded";
    state.inbox[0].status = "Replied";
    state.inbox[0].messages = ["Already sent"];
    state.approvals.push({
      id: "stale-reply",
      title: "Duplicate reply",
      type: "reply",
      messageId: state.inbox[0].id,
      detail: "Do not send twice",
      status: "Pending",
    });
  });
  await page.getByRole("tab", { name: /Needs your approval/ }).click();
  await page.getByRole("button", { name: "Approve in demo" }).first().click();
  await page.getByRole("button", { name: "Approve in demo" }).click();
  await page.getByRole("tab", { name: "History", exact: true }).click();
  await expect(
    page.locator(".ws-approval").filter({ hasText: "Not applied" }),
  ).toHaveCount(2);
  const state = await stored(page);
  expect(state.approvals.every((a) => a.status === "Declined")).toBe(true);
  expect(state.inbox[0].messages).toEqual(["Already sent"]);
  expect(
    state.activity.some((a) => a.includes("simulated action applied")),
  ).toBe(false);
});
test("two pending actions for one paid record cannot both apply", async ({
  page,
}) => {
  await seed(page, (state) =>
    state.approvals.push({
      ...state.approvals[0],
      id: "duplicate",
      title: "Duplicate refund",
    }),
  );
  await page.getByRole("tab", { name: /Needs your approval/ }).click();
  await page.getByRole("button", { name: "Approve in demo" }).first().click();
  await page.getByRole("button", { name: "Approve in demo" }).click();
  const state = await stored(page);
  expect(state.approvals.map((a) => a.status)).toEqual([
    "Approved",
    "Declined",
  ]);
  expect(state.payments.find((p) => p.id === "p2")?.status).toBe("Refunded");
});

test("edited reply and changed refund amount require a fresh approval", async ({
  page,
}) => {
  await seed(page, (state) => {
    state.payments.find((p) => p.id === "p2")!.amount = 75;
    state.inbox[0].reply = "Updated draft";
    state.approvals.push({
      id: "edited",
      title: "Older draft",
      type: "reply",
      messageId: state.inbox[0].id,
      detail: "Original draft",
      status: "Pending",
    });
  });
  await page.getByRole("tab", { name: /Needs your approval/ }).click();
  await page.getByRole("button", { name: "Approve in demo" }).first().click();
  await page.getByRole("button", { name: "Approve in demo" }).click();
  const state = await stored(page);
  expect(state.payments.find((p) => p.id === "p2")?.status).toBe("Paid");
  expect(state.inbox[0].messages).toEqual([]);
  expect(state.approvals.every((a) => a.status === "Declined")).toBe(true);
});
test("matching reply approval applies once and rejects its duplicate", async ({
  page,
}) => {
  await seed(page, (state) => {
    state.approvals = [];
    state.inbox[0].reply = "Approved sample reply";
    for (const id of ["reply-one", "reply-two"])
      state.approvals.push({
        id,
        title: id,
        type: "reply",
        messageId: state.inbox[0].id,
        detail: state.inbox[0].reply,
        status: "Pending",
      });
  });
  await page.getByRole("tab", { name: /Needs your approval/ }).click();
  await page.getByRole("button", { name: "Approve in demo" }).first().click();
  await page.getByRole("button", { name: "Approve in demo" }).click();
  const state = await stored(page);
  expect(state.inbox[0].messages).toEqual(["Approved sample reply"]);
  expect(state.approvals.map((a) => a.status)).toEqual([
    "Approved",
    "Declined",
  ]);
});
