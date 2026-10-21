import { expect, test } from '../../src/fixtures/app';

/**
 * States a real backend rarely produces on demand, made deterministic with page.route(). The
 * browser logs the mocked HTTP errors as console errors; each test allows exactly its own.
 */
test.describe('inbox network states (mocked)', () => {
  test.describe('401', () => {
    test.use({ allowedConsoleErrors: [/status of 401/] });

    test(
      'an expired session sends the person to sign-in and remembers where they were',
      { annotation: { type: 'feature', description: 'FEAT-STATE-01' } },
      async ({ mocks, inbox, appLogin, page }) => {
        await mocks.unauthorized();

        await inbox.open();

        await expect(page).toHaveURL(/\/login\?next=%2Finbox$/);
        await expect(appLogin.submit).toBeVisible();
      },
    );
  });

  test.describe('500', () => {
    test.use({ allowedConsoleErrors: [/status of 500/] });

    test(
      'a server error shows an alert, and Try again really retries',
      { annotation: { type: 'feature', description: 'FEAT-STATE-02' } },
      async ({ mocks, inbox }) => {
        await mocks.serverErrorThenRecovery();

        await inbox.open();
        await expect(inbox.error).toHaveText(/We couldn't load your messages/);
        await inbox.retry.click();

        await expect(inbox.error).toBeHidden();
        await expect(inbox.messages).toHaveCount(3);
      },
    );
  });

  test(
    'an empty inbox explains itself instead of showing nothing',
    { annotation: { type: 'feature', description: 'FEAT-STATE-03' } },
    async ({ mocks, inbox }) => {
      await mocks.empty();

      await inbox.open();

      await expect(inbox.empty).toBeVisible();
      await expect(inbox.messageList).toBeHidden();
      await expect(inbox.header.bell.badge).toBeHidden();
    },
  );

  test(
    'a slow response shows a loading state, then the messages',
    { annotation: { type: 'feature', description: 'FEAT-STATE-04' } },
    async ({ mocks, inbox }) => {
      await mocks.slow(1_500);

      await inbox.open();

      await expect(inbox.loading).toBeVisible();
      await expect(inbox.messages).toHaveCount(3, { timeout: 5_000 });
      await expect(inbox.loading).toBeHidden();
    },
  );

  test.describe('partial failure', () => {
    test.use({ allowedConsoleErrors: [/status of 503/] });

    test(
      'when the usage widget fails, the inbox still works',
      { annotation: { type: 'feature', description: 'FEAT-STATE-05' } },
      async ({ mocks, inbox }) => {
        await mocks.partialFailure();

        await inbox.open();

        await expect(inbox.usage).toContainText('Usage is unavailable right now');
        await expect(inbox.messages).toHaveCount(3);
        await expect(inbox.error).toBeHidden();
      },
    );
  });

  test.describe('429', () => {
    test.use({ allowedConsoleErrors: [/status of 429/] });

    test(
      'being rate limited and running out of allowance read differently',
      { annotation: { type: 'feature', description: 'FEAT-STATE-06' } },
      async ({ mocks, inbox, page }) => {
        await mocks.rateLimited();
        await inbox.open();
        await expect(inbox.error).toHaveText(/requests too quickly/);

        await page.unroute('**/api/messages');
        await mocks.quotaExceeded();
        await inbox.retry.click();

        await expect(inbox.error).toHaveText(/this month's allowance/);
        await expect(inbox.error).not.toContainText('requests too quickly');
      },
    );
  });
});
