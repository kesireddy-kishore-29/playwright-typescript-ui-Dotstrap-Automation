import type { Locator, Page } from '@playwright/test';

/**
 * DELIBERATELY BROKEN page object for the failure-evidence demo (tests/demo). Each member fails
 * in a different, realistic way. Nothing outside tests/demo may use it.
 */
export class DemoPage {
  /** A test id the app never renders: what a renamed test id looks like to a test. */
  readonly vanished: Locator;
  /** The unread badge: present in the DOM but hidden while there is nothing unread. */
  readonly hiddenBadge: Locator;

  constructor(private readonly page: Page) {
    this.vanished = page.getByTestId('inbox-summary');
    this.hiddenBadge = page.getByTestId('unread-badge');
  }

  /** Opens the unread badge; fails because it is hidden while nothing is unread. */
  async verifyBadgeOpens(): Promise<void> {
    await this.hiddenBadge.click({ timeout: 2_000 });
  }

  /** Loads a port nothing listens on; fails at the network level. */
  async verifyUnreachableHostLoads(): Promise<void> {
    await this.page.goto('http://127.0.0.1:9/');
  }
}
