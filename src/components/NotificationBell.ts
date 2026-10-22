import type { Locator, Page } from '@playwright/test';

/**
 * The header bell. Its accessible name carries the unread count ("Notifications, 2 unread");
 * the visible badge has no accessible name of its own, so it is located by test id, the third
 * choice in docs/locator-policy.md.
 */
export class NotificationBell {
  readonly button: Locator;
  readonly badge: Locator;
  readonly panel: Locator;

  constructor(page: Page) {
    this.button = page.getByRole('button', { name: /^Notifications/ });
    this.badge = page.getByTestId('unread-badge');
    this.panel = page.getByRole('dialog', { name: 'Notifications' });
  }

  async open(): Promise<void> {
    await this.button.click();
  }

  async markAllAsRead(): Promise<void> {
    await this.open();
    await this.panel.getByRole('button', { name: 'Mark all as read' }).click();
  }
}
