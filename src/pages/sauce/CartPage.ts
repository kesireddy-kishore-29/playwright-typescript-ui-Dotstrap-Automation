import type { Locator, Page } from '@playwright/test';

/** Sauce Demo cart (`/cart.html`). */
export class CartPage {
  readonly items: Locator;
  readonly checkout: Locator;
  readonly continueShopping: Locator;

  constructor(private readonly page: Page) {
    this.items = page.getByTestId('inventory-item');
    this.checkout = page.getByRole('button', { name: 'Checkout' });
    this.continueShopping = page.getByRole('button', { name: 'Continue Shopping' });
  }

  async open(): Promise<void> {
    await this.page.goto('/cart.html');
  }

  async names(): Promise<string[]> {
    return this.page.getByTestId('inventory-item-name').allInnerTexts();
  }
}
