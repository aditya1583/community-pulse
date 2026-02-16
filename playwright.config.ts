import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || "https://voxlo-theta.vercel.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Simulate iPhone viewport
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  },

  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        // Override to use Chromium (WebKit not installed)
      },
    },
  ],
});
