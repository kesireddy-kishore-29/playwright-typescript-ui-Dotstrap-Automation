import type { Locator, Page } from '@playwright/test';
import { NotificationBell } from './NotificationBell';

/** The app's top bar and main navigation. */
export class AppHeader {
  readonly bell: NotificationBell;
  readonly themeToggle: Locator;
  readonly signOut: Locator;
  readonly nav: Locator;

  constructor(private readonly page: Page) {
    this.bell = new NotificationBell(page);
    this.themeToggle = page.getByRole('button', { name: /Dark theme/ });
    this.signOut = page.getByRole('button', { name: 'Sign out' });
    this.nav = page.getByRole('navigation', { name: 'Main' });
  }

  link(name: 'Inbox' | 'Items' | 'Settings'): Locator {
    return this.nav.getByRole('link', { name, exact: true });
  }

  async goTo(name: 'Inbox' | 'Items' | 'Settings'): Promise<void> {
    await this.link(name).click();
    await this.page.getByRole('heading', { level: 1, name }).waitFor();
  }
}
