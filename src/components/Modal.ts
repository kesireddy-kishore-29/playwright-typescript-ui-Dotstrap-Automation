import type { Locator, Page } from '@playwright/test';

/** A modal dialog found by its accessible name. */
export class Modal {
  readonly root: Locator;

  constructor(page: Page, name: string | RegExp) {
    this.root = page.getByRole('dialog', { name });
  }

  async confirm(label = 'Delete'): Promise<void> {
    await this.root.getByRole('button', { name: label, exact: true }).click();
  }

  async cancel(): Promise<void> {
    await this.root.getByRole('button', { name: 'Cancel' }).click();
  }
}
