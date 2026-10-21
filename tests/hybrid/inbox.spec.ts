import { uniqueName } from '../../src/data/unique';
import { expect, test } from '../../src/fixtures/app';

// Hybrid: seed through the API, assert in the browser, clean up through the API (verified).
test.describe('inbox, seeded through the API', () => {
  test(
    'messages created through the API appear in the inbox, newest first',
    { tag: ['@mobile'], annotation: { type: 'feature', description: 'FEAT-INBOX-01' } },
    async ({ seed, inbox }) => {
      const older = await seed.message('Ben Okafor', uniqueName('older'));
      const newer = await seed.message('Priya Raman', uniqueName('newer'));

      await inbox.open();

      await expect(inbox.message(newer.subject)).toContainText('From Priya Raman');
      await expect(inbox.messages.first()).toContainText(newer.subject);
      await expect(inbox.message(older.subject)).toBeVisible();
    },
  );

  test(
    'the bell counts unread messages and reading one updates it everywhere',
    { annotation: { type: 'feature', description: 'FEAT-INBOX-02' } },
    async ({ seed, inbox, api }) => {
      const first = await seed.message('Ben Okafor', uniqueName('first'));
      await seed.message('Ben Okafor', uniqueName('second'));
      await inbox.open();
      await expect(inbox.header.bell.button).toHaveAccessibleName('Notifications 2 unread');
      await expect(inbox.header.bell.badge).toHaveText('2');
      await expect(inbox.unreadDot(first.subject)).toBeVisible();

      await inbox.markRead(first.subject);

      await expect(inbox.toast.root).toHaveText('Marked as read');
      await expect(inbox.header.bell.badge).toHaveText('1');
      await expect(inbox.markReadButtons(first.subject)).toHaveCount(0);
      expect(await api.unreadCount()).toBe(1);

      await inbox.header.bell.markAllAsRead();
      await expect(inbox.header.bell.badge).toBeHidden();
      expect(await api.unreadCount()).toBe(0);
    },
  );
});
