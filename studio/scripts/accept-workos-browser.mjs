// Explicit staging acceptance only; never part of the secretless CI suite.
// No mocked tokens, route interception, persisted browser state or password screenshots.
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.STUDIO_ACCEPTANCE_BASE_URL;
const fixturePath =
  process.env.STUDIO_ACCEPTANCE_FIXTURE ??
  (process.argv[2]
    ? path.join(process.argv[2], "credentials.json")
    : undefined);
const allowed = new Set([
  "http://127.0.0.1:4331",
  "http://127.0.0.1:4341",
  "https://oceanheart-studio-env-staging-rick-halletts-projects.vercel.app",
]);
if (!allowed.has(baseURL) || !fixturePath)
  throw new Error(
    "Set an allowed staging/local base URL and private fixture path.",
  );
if ((await stat(fixturePath)).mode & 0o077)
  throw new Error("Acceptance fixture must be private (mode 0600).");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const accounts = ["owner", "outsider"].map((role) =>
  fixture.accounts?.find((account) => account.role === role),
);
if (
  !Array.isArray(accounts) ||
  accounts.length < 2 ||
  accounts.some((a) => !a?.email || !a?.password)
)
  throw new Error("Fixture requires two accounts with email and password.");
const run = new Date().toISOString().replace(/[:.]/g, "-");
const output = path.resolve(
  process.env.STUDIO_ACCEPTANCE_OUTPUT ?? `evidence/rad-browser-${run}`,
);
await mkdir(output, { recursive: true });
const report = {
  baseURL,
  startedAt: new Date().toISOString(),
  checks: [],
  screenshots: [],
  practices: [],
  tasks: [],
  status: "running",
};
const browser = await chromium.launch();
let phase = "starting";
let activePage;
const practiceName = `Browser acceptance ${run}`;
const taskTitle = `Confirm persisted task ${run}`;
async function check(name, work) {
  phase = name;
  await work();
  report.checks.push(name);
}
async function login(account) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  activePage = page;
  phase = "open configured practice";
  await page.goto(`${baseURL}/practice`);
  phase = "open WorkOS hosted sign-in";
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  phase = "enter WorkOS email";
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(account.email);
  await page
    .getByRole("button", { name: "Continue with email", exact: true })
    .click();
  phase = "enter WorkOS password";
  await page.locator("input[type=password]").fill(account.password);
  phase = "submit WorkOS password";
  await page
    .getByRole("button", {
      name: /^(Sign in|Continue|Continue with password)$/i,
    })
    .click();
  phase = "return from WorkOS callback to configured origin";
  await page.waitForURL(`${baseURL}/practice`, { timeout: 45_000 });
  phase = "verify application session and Convex access";
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#practice-name, #practice-selector")).toBeVisible({
    timeout: 30_000,
  });
  return { context, page };
}
function taskRow(page) {
  return page.locator(".lp-task-list li").filter({ hasText: taskTitle });
}
async function screenshot(page, width, label) {
  await page.setViewportSize({ width, height: 900 });
  await expect(
    page.getByRole("heading", { name: practiceName, exact: true }),
  ).toBeVisible();
  const metrics = await page.evaluate(() => {
    const input = document.querySelector("#task-title");
    const button = document.querySelector(".lp-inline button");
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      inputHeight: input?.getBoundingClientRect().height,
      buttonHeight: button?.getBoundingClientRect().height,
      background: getComputedStyle(document.querySelector(".lp-root"))
        .backgroundColor,
    };
  });
  expect(metrics.overflow).toBe(false);
  expect(metrics.inputHeight).toBe(34);
  expect(metrics.buttonHeight).toBe(34);
  expect(metrics.background).toBe("rgb(255, 255, 255)");
  const filename = `${label}-${width}.png`;
  await page.screenshot({ path: path.join(output, filename), fullPage: true });
  report.screenshots.push({ filename, width, ...metrics });
}
try {
  phase = "WorkOS account A sign-in";
  const first = await login(accounts[0]);
  await check("WorkOS account A sign-in", async () => {});
  await check("explicit practice creation and empty task state", async () => {
    const add = first.page.getByRole("button", {
      name: "Add a practice",
      exact: true,
    });
    if (await add.isVisible()) await add.click();
    await first.page
      .getByLabel("Practice name", { exact: true })
      .fill(practiceName);
    await first.page
      .getByRole("button", { name: "Create practice", exact: true })
      .click();
    await expect(
      first.page.getByRole("heading", { name: practiceName, exact: true }),
    ).toBeVisible();
    await expect(
      first.page.getByText("No tasks yet", { exact: true }),
    ).toBeVisible();
    const tenantId = await first.page
      .getByLabel("Current practice", { exact: true })
      .inputValue();
    expect(tenantId).toBeTruthy();
    report.practices.push({ tenantId, name: practiceName });
    await writeFile(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    await screenshot(first.page, 1440, "empty");
  });
  await check("task add, complete and reload persistence", async () => {
    await first.page.getByLabel("New task", { exact: true }).fill(taskTitle);
    await first.page
      .getByRole("button", { name: "Add task", exact: true })
      .click();
    await expect(taskRow(first.page)).toHaveCount(1);
    const taskId = await taskRow(first.page).getAttribute("data-task-id");
    expect(taskId).toBeTruthy();
    report.tasks.push({
      taskId,
      tenantId: report.practices[0].tenantId,
      title: taskTitle,
    });
    await writeFile(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    phase = "save completed state through Convex";
    await taskRow(first.page).getByRole("checkbox").click();
    await expect(taskRow(first.page).getByRole("checkbox")).toBeChecked();
    phase = "reload persisted task";
    await first.page.reload();
    await first.page
      .getByLabel("Current practice", { exact: true })
      .selectOption({ label: practiceName });
    await expect(taskRow(first.page).getByRole("checkbox")).toBeChecked();
    await screenshot(first.page, 1440, "completed");
    await screenshot(first.page, 400, "completed");
    await screenshot(first.page, 320, "completed");
  });
  await check("sign-out ends the application session", async () => {
    await first.page
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(
      first.page.getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible({ timeout: 30_000 });
    await first.page.reload();
    await expect(
      first.page.getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible();
    await first.context.close();
  });
  await check("fresh browser session reads the saved task", async () => {
    const fresh = await login(accounts[0]);
    await fresh.page
      .getByLabel("Current practice", { exact: true })
      .selectOption({ label: practiceName });
    await expect(taskRow(fresh.page).getByRole("checkbox")).toBeChecked();
    await fresh.context.close();
  });
  await check(
    "second authenticated account cannot see the first practice or task",
    async () => {
      const other = await login(accounts[1]);
      await expect(
        other.page.getByText("Loading practices…", { exact: true }),
      ).toHaveCount(0);
      await expect(
        other.page.getByRole("option", { name: practiceName, exact: true }),
      ).toHaveCount(0);
      await expect(
        other.page.getByText(taskTitle, { exact: true }),
      ).toHaveCount(0);
      await other.context.close();
    },
  );
  report.status = "passed";
} catch {
  report.status = "failed";
  report.failedPhase = phase;
  if (activePage && !activePage.isClosed()) {
    const url = new URL(activePage.url());
    const sensitive = fixture.accounts
      .flatMap((account) => [
        account.email,
        account.password,
        account.accessToken,
        account.refreshToken,
      ])
      .filter(Boolean);
    const safeText = (text) => {
      for (const value of sensitive)
        text = text.split(value).join("[redacted]");
      return text
        .replace(/https?:\/\/[^\s]+/g, (value) => {
          try {
            const parsed = new URL(value);
            return parsed.origin + parsed.pathname;
          } catch {
            return "[url]";
          }
        })
        .slice(0, 500);
    };
    report.diagnostic = {
      url: url.origin + url.pathname,
      visibleMessages: (
        await activePage.locator("h1, h2, [role=alert]").allTextContents()
      )
        .map(safeText)
        .filter(Boolean),
    };
  }
  // Do not serialize arbitrary browser/provider exception details or credentials.
  console.error(`Acceptance failed during: ${phase}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(`Acceptance ${report.status}; sanitized report: ${output}`);
}
