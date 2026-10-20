import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';

// One run ID for the main process and every worker: workers inherit this environment variable.
process.env['RUN_ID'] ??= env.RUN_ID;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  workers: env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: env.EXPECT_TIMEOUT_MS },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    testIdAttribute: 'data-test',
    actionTimeout: env.ACTION_TIMEOUT_MS,
    navigationTimeout: env.NAVIGATION_TIMEOUT_MS,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testMatch: ['smoke/**/*.spec.ts'],
      use: { ...devices['Desktop Chrome'], baseURL: env.SAUCE_BASE_URL },
    },
  ],
});
