import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { evidenceOptions } from './src/config/record-mode';

// One run ID for the main process and every worker: workers inherit this environment variable.
process.env['RUN_ID'] ??= env.RUN_ID;

const evidence = evidenceOptions(env.RECORD_MODE);
const retries = Number(process.env['TEST_RETRIES'] ?? (env.CI ? 2 : 0));
const match = (...folders: string[]): string[] => folders.map((f) => `${f}/**/*.spec.ts`);

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: Math.min(2, Math.max(0, retries)),
  workers: env.CI ? 2 : 4,
  timeout: 45_000,
  expect: {
    timeout: env.EXPECT_TIMEOUT_MS,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 },
  },
  // Baselines per OS: font rendering differs between Windows and the Linux CI runner.
  snapshotPathTemplate: '{testDir}/visual/__screenshots__/{platform}/{testFileName}/{arg}{ext}',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'reports/playwright-results.json' }],
    [
      'allure-playwright',
      {
        resultsDir: 'allure-results',
        detail: true,
        // The Allure Environment panel: the same non-secret facts as run-summary.json.
        environmentInfo: {
          runId: process.env['RUN_ID'],
          recordMode: env.RECORD_MODE,
          appBaseUrl: env.APP_BASE_URL,
          sauceBaseUrl: env.SAUCE_BASE_URL,
          node: process.version,
          os: `${process.platform} ${process.arch}`,
        },
      },
    ],
    ['./src/evidence/reporter.ts'],
  ],
  use: {
    testIdAttribute: 'data-test',
    actionTimeout: env.ACTION_TIMEOUT_MS,
    navigationTimeout: env.NAVIGATION_TIMEOUT_MS,
    ...evidence,
  },
  webServer: {
    command: 'npm run sut',
    url: `${env.APP_BASE_URL}/api/health`,
    reuseExistingServer: !env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: { APP_PORT: String(env.APP_PORT), SUT_UI_CHAOS: process.env['SUT_UI_CHAOS'] ?? 'none' },
  },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: match('smoke', 'e2e', 'hybrid', 'mocked-states', 'performance'),
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      testMatch: match('smoke', 'e2e', 'hybrid'),
      grep: /@mobile/,
      dependencies: ['setup'],
      use: { ...devices['Pixel 7'] },
    },
    { name: 'visual', testMatch: match('visual'), use: { ...devices['Desktop Chrome'] } },
    { name: 'a11y', testMatch: match('a11y'), use: { ...devices['Desktop Chrome'] } },
    {
      // Live production smoke: public pages, one worker (npm run test:live), a clear user agent,
      // no traces or HAR (the site's headers name infrastructure we do not store).
      name: 'live',
      testMatch: match('live'),
      retries: 1,
      use: {
        ...devices['Desktop Chrome'],
        userAgent: `${devices['Desktop Chrome'].userAgent} playwright-typescript-ui-Dotstrap-Automation (portfolio smoke test)`,
        trace: 'off',
        video: env.RECORD_MODE === 'off' ? 'off' : 'retain-on-failure',
      },
    },
    {
      // Deliberate failures that prove the evidence pipeline. Never part of a gating run.
      name: 'demo',
      testMatch: match('demo'),
      retries: 1,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
