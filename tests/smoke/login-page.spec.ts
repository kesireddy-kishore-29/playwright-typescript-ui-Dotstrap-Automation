import { expect, test } from '../../src/fixtures/test';

test(
  'the Sauce Demo sign-in page offers a username, a password and a Login button',
  { tag: ['@smoke'], annotation: { type: 'feature', description: 'FEAT-LOGIN-01' } },
  async ({ loginPage }) => {
    await loginPage.open();

    await expect(loginPage.username).toBeVisible();
    await expect(loginPage.password).toBeVisible();
    await expect(loginPage.submit).toBeEnabled();
  },
);
