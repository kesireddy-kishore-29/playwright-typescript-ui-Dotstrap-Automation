import { test as base, expect, type TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { env } from '../config/env';
import { stripAnsi } from '../support/ansi';
import { redactText } from '../support/redact';

const FEATURE_ID = /^FEAT-[A-Z0-9]+-\d{2}$/;

export interface BaseOptions {
  /** Console errors this test expects (e.g. a mocked 500 logs "Failed to load resource"). */
  allowedConsoleErrors: RegExp[];
}

interface BaseFixtures {
  traceability: string[];
  evidence: { consoleErrors: string[] };
}

export function featureIds(testInfo: TestInfo): string[] {
  return testInfo.annotations.filter((a) => a.type === 'feature').map((a) => a.description ?? '');
}

/**
 * Allure severity from what a test is for: smoke tests block a release, accessibility is
 * critical, the live smoke is information about production, the demo fails on purpose.
 */
export function severityOf(project: string, tags: readonly string[]): string {
  if (project === 'demo' || tags.includes('@demo-failure')) return 'trivial';
  if (tags.includes('@smoke') && project !== 'live') return 'blocker';
  if (project === 'a11y') return 'critical';
  if (project === 'live') return 'minor';
  return 'normal';
}

/** The locator Playwright reported in the failure message, if any (used by triage). */
export function failingLocator(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const match = /(?:waiting for |Locator:\s+)((?:locator|getBy\w+)\([^\n]*?\))(?:\s|$)/.exec(
    stripAnsi(message),
  );
  return match?.[1];
}

export const test = base.extend<BaseOptions & BaseFixtures>({
  allowedConsoleErrors: [[], { option: true }],

  // Every test records a HAR next to its other artifacts (headers only, bodies omitted), except
  // on the live site, whose response headers name infrastructure we do not store.
  contextOptions: async ({ contextOptions }, use, testInfo) => {
    if (env.RECORD_MODE === 'off' || testInfo.project.name === 'live') {
      await use(contextOptions);
      return;
    }
    await use({
      ...contextOptions,
      recordHar: { path: testInfo.outputPath('network.har'), content: 'omit', mode: 'minimal' },
    });
  },

  // Traceability is a rule, not a convention: a test without a valid feature ID fails.
  traceability: [
    // Playwright requires the destructuring pattern even when no fixture is used.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      const ids = featureIds(testInfo);
      const bad = ids.filter((id) => !FEATURE_ID.test(id));
      if (ids.length === 0 || bad.length > 0) {
        throw new Error(
          `Every test needs { annotation: { type: 'feature', description: 'FEAT-<AREA>-<NN>' } }; ` +
            `found [${ids.join(', ')}]`,
        );
      }
      for (const id of ids) await allure.feature(id);
      for (const tag of testInfo.tags) await allure.tag(tag.replace(/^@/, ''));
      await allure.severity(severityOf(testInfo.project.name, testInfo.tags));
      await use(ids);
    },
    { auto: true },
  ],

  evidence: [
    async ({ page, allowedConsoleErrors }, use, testInfo) => {
      const lines: string[] = [];
      const consoleErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on('console', (message) => {
        const where = message.location().url;
        const text = where ? `${message.text()} (${where})` : message.text();
        lines.push(`[${message.type()}] ${text}`);
        if (message.type() === 'error') consoleErrors.push(text);
      });
      page.on('pageerror', (error) => {
        lines.push(`[pageerror] ${error.message}`);
        consoleErrors.push(error.message);
      });
      page.on('requestfailed', (request) => {
        const line = `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? 'failed'}`;
        failedRequests.push(line);
        lines.push(`[requestfailed] ${line}`);
      });

      await use({ consoleErrors });

      const failed = testInfo.status !== testInfo.expectedStatus;
      const notes: string[] = [];
      if (env.RECORD_MODE !== 'off') {
        await testInfo.attach('console.log', {
          body: redactText(lines.join('\n') || '(no console output)'),
          contentType: 'text/plain',
        });
        if (failed && !page.isClosed()) {
          try {
            await testInfo.attach('page-source.html', {
              body: redactText(await page.content()),
              contentType: 'text/html',
            });
            await testInfo.attach('fullpage.png', {
              body: await page.screenshot({ fullPage: true, timeout: 5_000 }),
              contentType: 'image/png',
            });
          } catch (error) {
            notes.push(`page source or full-page screenshot unavailable: ${String(error)}`);
          }
        }
      }
      await testInfo.attach('evidence-meta', {
        contentType: 'application/json',
        body: JSON.stringify({
          outputDir: testInfo.outputDir,
          featureIds: featureIds(testInfo),
          failingLocator: failingLocator(testInfo.error?.message),
          consoleErrors: consoleErrors.map(redactText),
          failedRequests: failedRequests.map(redactText),
          viewport: page.viewportSize(),
          notes,
        }),
      });

      const unexpected = consoleErrors.filter(
        (e) => !allowedConsoleErrors.some((allowed) => allowed.test(e)),
      );
      if (!failed) {
        expect(
          unexpected,
          'console errors during the test (allow expected ones with allowedConsoleErrors)',
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
