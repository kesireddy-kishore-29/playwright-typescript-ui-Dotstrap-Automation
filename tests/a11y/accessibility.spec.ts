import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../../src/fixtures/app';
import { ruleIds, scanAccessibility } from '../../src/support/a11y';

/** The defect page's violations, reviewed and recorded. Changes in either direction fail. */
const DEFECT_BASELINE = JSON.parse(
  readFileSync(join(__dirname, 'baselines', 'a11y-defects.json'), 'utf8'),
) as { rules: string[] };

test.describe('accessibility (axe, WCAG 2.1 A/AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(
      `the inbox has no violations in the ${theme} theme`,
      { annotation: { type: 'feature', description: 'FEAT-A11Y-01' } },
      async ({ page, mocks, inbox }, testInfo) => {
        await page.addInitScript((t) => {
          localStorage.setItem('relay-theme', t);
        }, theme);
        await mocks.messages();
        await inbox.open();
        await expect(inbox.messages).toHaveCount(3);

        expect(await scanAccessibility(page, testInfo)).toEqual([]);
      },
    );
  }

  test(
    'the items table and its delete dialog have no violations',
    { annotation: { type: 'feature', description: 'FEAT-A11Y-01' } },
    async ({ page, mocks, itemsPage }, testInfo) => {
      await mocks.items();
      await itemsPage.open();
      await expect(itemsPage.table.rows()).toHaveCount(3);
      expect(await scanAccessibility(page, testInfo), 'table').toEqual([]);

      await itemsPage.requestDelete('Q1 roadmap');
      await expect(itemsPage.confirmDelete.root).toBeVisible();
      expect(await scanAccessibility(page, testInfo), 'dialog open').toEqual([]);
      await itemsPage.confirmDelete.cancel();
    },
  );

  test(
    'the sign-in and settings forms have no violations',
    { annotation: { type: 'feature', description: 'FEAT-A11Y-01' } },
    async ({ page, appLogin, settings }, testInfo) => {
      await appLogin.open();
      expect(await scanAccessibility(page, testInfo), 'sign-in').toEqual([]);
      await settings.open();
      expect(await scanAccessibility(page, testInfo), 'settings').toEqual([]);
    },
  );

  test(
    'the deliberately broken page reports exactly its documented violations',
    { annotation: { type: 'feature', description: 'FEAT-A11Y-02' } },
    async ({ page, a11yDefects }, testInfo) => {
      await a11yDefects.open();

      const violations = await scanAccessibility(page, testInfo);

      expect(ruleIds(violations)).toEqual(DEFECT_BASELINE.rules);
    },
  );
});
