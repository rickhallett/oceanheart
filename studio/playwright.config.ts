import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Match the Next server environment when selecting secretless/provider checks.
loadEnvConfig(process.cwd());

// Each worktree can select its own port. Never reuse an unknown server or point
// this state-changing suite at production.
const port = Number(process.env.STUDIO_TEST_PORT ?? 4310);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("STUDIO_TEST_PORT must be an integer between 1024 and 65535");
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
