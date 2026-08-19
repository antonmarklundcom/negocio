import { defineConfig, devices } from '@playwright/test';

/**
 * Basic e2e smoke tests (ROADMAP Phase C). Run against a production build
 * (`npm run build && npm run start`) on the built-in seed data — no
 * `DATABASE_URL` needed, matching how this app runs in local dev. CI starts
 * the server itself (see `.github/workflows/ci.yml`); `webServer` here is for
 * running `npx playwright test` locally with the same one-command ergonomics.
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
  // The admin round-trip needs MySQL, a session secret and a bootstrapped
  // account, none of which this config provides. It has its own
  // (`playwright.admin.config.ts`) and must never be picked up here — a run
  // that silently skipped it would look identical to a run that passed it.
  testIgnore: ['admin.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
        // Escape hatch for sandboxes and CI images that already ship a
        // browser: `PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e`
        // skips `playwright install` entirely. Unset — the normal case — and
        // Playwright resolves its own download as before.
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
        timeout: 180_000,
      },
});
