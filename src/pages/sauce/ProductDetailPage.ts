import type { Locator, Page } from '@playwright/test';

/** Sauce Demo product detail (`/inventory-item.html?id=N`). */
export class ProductDetailPage {
  readonly name: Locator;
  readonly price: Locator;
  readonly description: Locator;
  readonly back: Locator;

  constructor(page: Page) {
    this.name = page.getByTestId('inventory-item-name');
    this.price = page.getByTestId('inventory-item-price');
    this.description = page.getByTestId('inventory-item-desc');
    this.back = page.getByRole('button', { name: 'Back to products' });
  }
}
