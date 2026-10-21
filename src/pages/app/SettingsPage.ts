import type { Locator, Page } from '@playwright/test';
import { AppHeader } from '../../components/AppHeader';

/** Relay settings (`/settings`): theme choice. */
export class SettingsPage {
  readonly header: AppHeader;
  readonly light: Locator;
  readonly dark: Locator;

  constructor(private readonly page: Page) {
    this.header = new AppHeader(page);
    this.light = page.getByRole('radio', { name: 'Light' });
    this.dark = page.getByRole('radio', { name: 'Dark' });
  }

  async open(): Promise<void> {
    await this.page.goto('/settings');
  }

  /** The theme the document is actually rendering, read from the root element. */
  async renderedTheme(): Promise<string | null> {
    return this.page.locator('html').getAttribute('data-theme');
  }
}
