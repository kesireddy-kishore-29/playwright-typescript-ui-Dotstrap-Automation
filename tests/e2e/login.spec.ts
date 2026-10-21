import { env } from '../../src/config/env';
import { expect, signedOut, test } from '../../src/fixtures/sauce';

test.use(signedOut);

test.describe('Sauce Demo sign-in', () => {
  // The one test that signs in through the form. Every other test reuses a saved session.
  test(
    'valid credentials reach the inventory',
    { tag: ['@smoke', '@mobile'], annotation: { type: 'feature', description: 'FEAT-LOGIN-01' } },
    async ({ loginPage, inventoryPage, page }) => {
      await loginPage.open();
      await loginPage.signIn(env.SAUCE_USERNAME, env.SAUCE_PASSWORD);

      await expect(page).toHaveURL(/inventory\.html$/);
      await expect(inventoryPage.title).toHaveText('Products');
    },
  );

  const invalid = [
    {
      name: 'wrong password',
      user: 'standard_user',
      password: 'not-the-password',
      error: /do not match any user/,
    },
    {
      name: 'unknown user',
      user: 'nobody_here',
      password: 'secret_sauce',
      error: /do not match any user/,
    },
    { name: 'empty username', user: '', password: 'secret_sauce', error: /Username is required/ },
    { name: 'empty password', user: 'standard_user', password: '', error: /Password is required/ },
  ];
  for (const attempt of invalid) {
    test(
      `refuses ${attempt.name} with a specific message`,
      { annotation: { type: 'feature', description: 'FEAT-LOGIN-02' } },
      async ({ loginPage, page }) => {
        await loginPage.open();
        await loginPage.signIn(attempt.user, attempt.password);

        await expect(loginPage.error).toHaveText(attempt.error);
        await expect(page).not.toHaveURL(/inventory/);
      },
    );
  }

  test(
    'a locked-out user is refused with the lock-out message',
    { annotation: { type: 'feature', description: 'FEAT-LOGIN-03' } },
    async ({ loginPage }) => {
      await loginPage.open();
      await loginPage.signIn('locked_out_user', env.SAUCE_PASSWORD);

      await expect(loginPage.error).toHaveText(/this user has been locked out/);
    },
  );
});
