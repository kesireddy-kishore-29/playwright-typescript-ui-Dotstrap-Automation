import type { Locator, Page } from '@playwright/test';
import { SauceHeader } from '../../components/SauceHeader';

export type SortOption =
  'Name (A to Z)' | 'Name (Z to A)' | 'Price (low to high)' | 'Price (high to low)';

/** Sauce Demo product list (`/inventory.html`). */
export class InventoryPage {
  readonly header: SauceHeader;
  readonly title: Locator;
  readonly items: Locator;
  readonly sort: Locator;

  constructor(private readonly page: Page) {
    this.header = new SauceHeader(page);
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-item');
    this.sort = page.getByTestId('product-sort-container');
  }

  async open(): Promise<void> {
    await this.page.goto('/inventory.html');
  }

  item(name: string): Locator {
    return this.items.filter({ hasText: name });
  }

  async names(): Promise<string[]> {
    return this.page.getByTestId('inventory-item-name').allInnerTexts();
  }

  async prices(): Promise<number[]> {
    const texts = await this.page.getByTestId('inventory-item-price').allInnerTexts();
    return texts.map((t) => Number(t.replace('$', '')));
  }

  /** The visible names or prices, in display order. */
  async valuesFor(key: 'names' | 'prices'): Promise<(string | number)[]> {
    return key === 'names' ? this.names() : this.prices();
  }

  async sortBy(option: SortOption): Promise<void> {
    await this.sort.selectOption({ label: option });
  }

  async addToCart(name: string): Promise<void> {
    await this.item(name).getByRole('button', { name: 'Add to cart' }).click();
  }

  async removeFromCart(name: string): Promise<void> {
    await this.item(name).getByRole('button', { name: 'Remove' }).click();
  }

  async openDetails(name: string): Promise<void> {
    await this.page.getByTestId('inventory-item-name').filter({ hasText: name }).click();
  }
}
