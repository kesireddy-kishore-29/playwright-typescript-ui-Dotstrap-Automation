import type { Locator, Page } from '@playwright/test';
import { AppHeader } from '../../components/AppHeader';
import { Toast } from '../../components/Toast';

/** Relay inbox (`/inbox`): usage widget and the message list with its four states. */
export class InboxPage {
  readonly header: AppHeader;
  readonly toast: Toast;
  readonly heading: Locator;
  readonly messageList: Locator;
  readonly messages: Locator;
  readonly loading: Locator;
  readonly empty: Locator;
  readonly error: Locator;
  readonly retry: Locator;
  readonly usage: Locator;

  constructor(private readonly page: Page) {
    this.header = new AppHeader(page);
    this.toast = new Toast(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Inbox' });
    this.messageList = page.getByRole('list', { name: 'Messages' });
    this.messages = this.messageList.getByRole('listitem');
    this.loading = page.getByRole('status').filter({ hasText: 'Loading messages' });
    this.empty = page.getByText('No messages yet');
    this.error = page.getByRole('alert');
    this.retry = page.getByRole('button', { name: 'Try again' });
    this.usage = page.getByRole('region', { name: 'Usage' });
  }

  async open(): Promise<void> {
    await this.page.goto('/inbox');
  }

  message(subject: string): Locator {
    return this.messages.filter({ hasText: subject });
  }

  /** The unread marker is a painted dot with no text, hence a test id. */
  unreadDot(subject: string): Locator {
    return this.message(subject).getByTestId('unread-dot');
  }

  /** Every "Mark read" button of a message: none once it has been read. */
  markReadButtons(subject: string): Locator {
    return this.message(subject).getByRole('button', { name: /^Mark read/ });
  }

  async markRead(subject: string): Promise<void> {
    await this.message(subject)
      .getByRole('button', { name: `Mark read (${subject})` })
      .click();
  }
}
