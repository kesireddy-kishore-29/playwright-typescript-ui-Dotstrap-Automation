import type { Locator, Page } from '@playwright/test';

/** The polite status region that announces short confirmations ("Marked as read"). */
export class Toast {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = page
      .getByRole('status')
      .filter({ hasNotText: /Loading/ })
      .last();
  }
}
