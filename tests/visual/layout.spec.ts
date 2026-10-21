import { WIDTHS } from '../../src/config/live-pages';
import { expect, test } from '../../src/fixtures/app';
import { horizontalOverflow } from '../../src/support/layout';

/**
 * Visual baselines at the four approved widths in both themes, on deterministic mocked data.
 * Baselines are per OS (font rendering differs); see docs/known-issues.md for the Linux set.
 */
const THEMES = ['light', 'dark'] as const;

test.describe('visual baselines', () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(
        `inbox at ${String(width)} px, ${theme} theme`,
        {
          annotation: [
            { type: 'feature', description: 'FEAT-VIS-01' },
            { type: 'feature', description: 'FEAT-VIS-02' },
          ],
        },
        async ({ page, mocks, inbox }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.addInitScript((t) => {
            localStorage.setItem('relay-theme', t);
          }, theme);
          await mocks.messages();

          await inbox.open();
          await expect(inbox.messages).toHaveCount(3);
          await expect(inbox.usage).toContainText('12 of 100 used');

          const overflow = await horizontalOverflow(page);
          expect(overflow.documentWidth, overflow.offenders.join(', ')).toBeLessThanOrEqual(
            overflow.viewportWidth,
          );
          await expect(page).toHaveScreenshot(`inbox-${String(width)}-${theme}.png`, {
            fullPage: true,
          });
        },
      );

      test(
        `items table at ${String(width)} px, ${theme} theme`,
        {
          annotation: [
            { type: 'feature', description: 'FEAT-VIS-01' },
            { type: 'feature', description: 'FEAT-VIS-02' },
          ],
        },
        async ({ page, mocks, itemsPage }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.addInitScript((t) => {
            localStorage.setItem('relay-theme', t);
          }, theme);
          await mocks.items();

          await itemsPage.open();
          await expect(itemsPage.table.rows()).toHaveCount(3);

          const overflow = await horizontalOverflow(page);
          expect(overflow.documentWidth, overflow.offenders.join(', ')).toBeLessThanOrEqual(
            overflow.viewportWidth,
          );
          await expect(page).toHaveScreenshot(`items-${String(width)}-${theme}.png`, {
            fullPage: true,
          });
        },
      );
    }
  }
});
