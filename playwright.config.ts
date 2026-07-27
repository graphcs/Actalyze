import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for Actalyze E2E tests.
 *
 * NOTE: There is intentionally NO `webServer` block. The Next.js dev server is
 * expected to already be running at http://localhost:3000 and is reused as-is.
 * Adding a `webServer` entry (even with `reuseExistingServer: true`) risks
 * Playwright spawning `next dev`/`next build` and clobbering the running
 * server's .next directory.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/.test-results",

  // AI-backed API routes can take 30-60s.
  timeout: 60_000,
  expect: { timeout: 15_000 },

  fullyParallel: true,
  retries: 2,
  workers: 3,
  reporter: [["list"], ["json", { outputFile: "tests/e2e/.test-results/results.json" }]],

  use: {
    baseURL: "http://localhost:3000",
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
