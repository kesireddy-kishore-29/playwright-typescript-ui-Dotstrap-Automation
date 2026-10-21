import { LIVE_BUDGET_MS, LIVE_PAGES, RESPONSIVE_PAGES, WIDTHS } from '../../src/config/live-pages';
import { expect, test } from '../../src/fixtures/live';
import { horizontalOverflow } from '../../src/support/layout';
import { navigationTiming } from '../../src/support/timing';

/**
 * Read-only smoke of the author's own production site, dotstrap.com: public pages only, no
 * sign-in, no forms, no writes. Runs nightly and on demand, never on pull requests, and never
 * gates a merge. A failure is triaged as ENVIRONMENT unless a page-content assertion failed.
 */
const feature = (...ids: string[]) => ids.map((description) => ({ type: 'feature', description }));

test.describe('dotstrap.com public pages', () => {
  for (const livePage of LIVE_PAGES) {
    test(
      `${livePage.path} loads with its heading, no console errors and no failed requests`,
      { tag: ['@live', '@smoke'], annotation: feature('FEAT-LIVE-01', 'FEAT-LIVE-02') },
      async ({ publicPage, page }) => {
        const response = await publicPage.open(livePage.path);

        expect(response?.status(), 'document status').toBe(200);
        await expect(page).toHaveTitle(livePage.title);
        await expect(publicPage.heading).toHaveText(livePage.heading);
        expect(publicPage.failedRequests(), 'failed requests').toEqual([]);
      },
    );
  }

  test(
    'the site sends the expected security headers',
    { tag: ['@live'], annotation: feature('FEAT-LIVE-03') },
    async ({ request }) => {
      const response = await request.get('/');
      const headers = response.headers();

      expect(response.status()).toBe(200);
      expect(headers['strict-transport-security'], 'HSTS').toMatch(/max-age=\d{6,}/);
      expect(headers['x-content-type-options'], 'nosniff').toBe('nosniff');
      expect(headers['referrer-policy'], 'referrer policy').toBeTruthy();
      expect(headers['permissions-policy'], 'permissions policy').toBeTruthy();
      // Presence only: the policy text is neither printed nor stored.
      expect('content-security-policy' in headers, 'Content-Security-Policy present').toBe(true);
      expect(headers['x-frame-options'], 'framing protection').toMatch(/SAMEORIGIN|DENY/);
    },
  );

  for (const path of ['/', '/pricing', '/faq']) {
    test(
      `${path} has a title, a description and a canonical URL`,
      { tag: ['@live'], annotation: feature('FEAT-LIVE-04') },
      async ({ publicPage, page }) => {
        await publicPage.open(path);

        await expect(page).toHaveTitle(/\S{3,}/);
        const description = (await publicPage.metaContent('description')) ?? '';
        expect(description.length, 'description length').toBeGreaterThan(50);
        expect(await publicPage.canonical(), 'canonical').toMatch(/^https:\/\/dotstrap\.com/);
      },
    );
  }

  for (const path of RESPONSIVE_PAGES) {
    for (const width of WIDTHS) {
      test(
        `${path} has no horizontal overflow at ${String(width)} px`,
        { tag: ['@live'], annotation: feature('FEAT-LIVE-05') },
        async ({ publicPage, page }) => {
          await page.setViewportSize({ width, height: 900 });
          await publicPage.open(path);

          const overflow = await horizontalOverflow(page);
          expect(
            overflow.documentWidth,
            `wider than the viewport: ${overflow.offenders.join(', ')}`,
          ).toBeLessThanOrEqual(overflow.viewportWidth);
        },
      );
    }
  }

  test(
    'the home page renders in both light and dark colour schemes',
    { tag: ['@live'], annotation: feature('FEAT-LIVE-06') },
    async ({ publicPage, page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await publicPage.open('/');
      const light = await publicPage.bodyBackground();
      await page.emulateMedia({ colorScheme: 'dark' });
      await publicPage.open('/');
      const dark = await publicPage.bodyBackground();

      await expect(publicPage.heading).toBeVisible();
      expect(dark, 'dark scheme changes the page background').not.toBe(light);
    },
  );

  test(
    'navigation moves between public pages',
    { tag: ['@live'], annotation: feature('FEAT-LIVE-07') },
    async ({ publicPage, page }) => {
      await publicPage.open('/');
      await publicPage.navLink('How it works').click();

      await expect(page).toHaveURL(/\/how-it-works$/);
      await expect(publicPage.heading).toHaveText(/stranger at your page/i);
    },
  );

  test(
    'the home page loads within a generous navigation-timing budget',
    { tag: ['@live'], annotation: feature('FEAT-LIVE-08') },
    async ({ publicPage, page }) => {
      await publicPage.open('/');
      const timing = await navigationTiming(page);

      test.info().annotations.push({ type: 'timing', description: JSON.stringify(timing) });
      expect(timing.domContentLoaded, 'DOMContentLoaded (ms)').toBeLessThan(
        LIVE_BUDGET_MS.domContentLoaded,
      );
      expect(timing.load, 'load (ms)').toBeLessThan(LIVE_BUDGET_MS.load);
    },
  );
});
