import { expect, test } from '../../src/fixtures/app';

test(
  'a saved session opens the app signed in, with no login form',
  { tag: ['@smoke', '@mobile'], annotation: { type: 'feature', description: 'FEAT-SESSION-01' } },
  async ({ inbox, page }) => {
    await inbox.open();

    await expect(inbox.heading).toBeVisible();
    await expect(inbox.header.signOut).toBeVisible();
    await expect(page).toHaveURL(/\/inbox$/);
  },
);
