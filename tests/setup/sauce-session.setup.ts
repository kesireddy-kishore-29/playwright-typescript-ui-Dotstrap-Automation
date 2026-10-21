import { env } from '../../src/config/env';
import { expect, SAUCE_SESSION, signedOut, test } from '../../src/fixtures/sauce';

test.use(signedOut);

// Sauce Demo keeps its session in one cookie. Seeding it directly is the "authenticate once via
// a token" pattern: no test clicks through the login form except the one that tests the form.
test(
  'save a signed-in Sauce Demo session for every other test',
  { annotation: { type: 'feature', description: 'FEAT-SESSION-01' } },
  async ({ page, inventoryPage }) => {
    await page.context().addCookies([
      {
        name: 'session-username',
        value: env.SAUCE_USERNAME,
        domain: new URL(env.SAUCE_BASE_URL).hostname,
        path: '/',
      },
    ]);
    await inventoryPage.open();
    await expect(inventoryPage.title).toHaveText('Products');
    await page.context().storageState({ path: SAUCE_SESSION });
  },
);
