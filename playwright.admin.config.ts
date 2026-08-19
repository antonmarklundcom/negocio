import { defineConfig, devices } from '@playwright/test';

/**
 * The MySQL-backed admin suite (ROADMAP W1-6). Separate from
 * `playwright.config.ts` on purpose: that one is the DB-free smoke suite that
 * runs on every PR, and mixing the two would mean either the smoke suite
 * demands a database or this one silently no-ops without one.
 *
 * Required env:
 *   DATABASE_URL        migrated + seeded (`db:migrate`, `db:import-seed`)
 *   SESSION_SECRET      ≥32 chars
 *   E2E_ADMIN_EMAIL     the account `scripts/bootstrap-admin.ts` created
 *   E2E_ADMIN_PASSWORD  the password it printed once
 *   NEXT_PUBLIC_REVIEWS_ENABLED=true   read at BUILD time, so it must be set
 *                       before `npm run build`, not just before the test run
 *
 * Optional: PLAYWRIGHT_BASE_URL to test an already-running server, and
 * PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled browser.
 *
 * Not parallel and not retried. The tests share one account and one listing in
 * one database, so workers would race each other; and a retry would replay
 * writes against state the failed attempt already changed, turning a real
 * failure into a confusing second one.
 */
/**
 * An empty `PLAYWRIGHT_BASE_URL` means "not set". `??` alone treats `''` as a
 * value and hands Playwright an unusable base URL, while the `webServer` guard
 * below uses truthiness — so the two would disagree and the run would fail
 * with "Cannot navigate to invalid URL" instead of anything diagnosable.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || '';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'admin.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : undefined,
      },
    },
  ],
  webServer: BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
