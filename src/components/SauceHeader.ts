import type { Locator, Page } from '@playwright/test';

/** Sauce Demo's header: cart link with its badge, and the burger menu. */
export class SauceHeader {
  readonly cartLink: Locator;
  readonly cartBadge: Locator;
  readonly menuButton: Locator;

  constructor(private readonly page: Page) {
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
    this.menuButton = page.getByRole('button', { name: 'Open Menu' });
  }

  async openCart(): Promise<void> {
    await this.cartLink.click();
  }

  /**
   * The menu entries are <a> elements without an href, so they have no link role (an
   * accessibility finding recorded in docs/known-issues.md); the site's test id is the fallback.
   */
  async logout(): Promise<void> {
    await this.menuButton.click();
    await this.page.getByTestId('logout-sidebar-link').click();
  }
}
