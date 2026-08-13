import { defineConfig, devices } from '@playwright/test';

/**
 * Basic e2e smoke tests (ROADMAP Phase C). Run against a production build
 * (`npm run build && npm run start`) on the built-in seed data — no
 * `DATABASE_URL` needed, matching how this app runs in local dev. CI starts
 * the server itself (see `.github/workflows/ci.yml`); `webServer` here is for
 * running `npx playwright test` locally with the same one-command ergonomics.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
