import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against a deployed copy of the site (a Vercel preview or
 * production). Nothing here starts a server: BASE_URL says where to point.
 *
 *   BASE_URL=https://<deployment> npm run smoke
 *
 * See e2e/smoke-*.spec.ts for what runs, and .github/workflows/ci.yml for how
 * CI supplies BASE_URL, the protection-bypass secret and the sign-in account.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.BASE_URL,
    // Traces record request headers (the bypass secret, the session cookie)
    // and CI uploads the report, so they are local-only.
    trace: process.env.CI ? "off" : "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
