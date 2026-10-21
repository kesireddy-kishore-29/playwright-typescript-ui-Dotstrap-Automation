import { expect, test } from '../../src/fixtures/sauce';

test(
  'logging out returns to sign-in and the inventory is no longer reachable',
  { annotation: { type: 'feature', description: 'FEAT-LOGOUT-01' } },
  async ({ inventoryPage, loginPage, page }) => {
    await inventoryPage.open();
    await inventoryPage.header.logout();

    await expect(loginPage.submit).toBeVisible();
    await page.goto('/inventory.html');
    await expect(loginPage.error).toHaveText(
      /only access '\/inventory.html' when you are logged in/,
    );
  },
);
