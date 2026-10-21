import type { Page } from '@playwright/test';

/** The deliberately inaccessible page used to prove the accessibility scan catches defects. */
export class A11yDefectsPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/a11y-defects.html');
  }
}
