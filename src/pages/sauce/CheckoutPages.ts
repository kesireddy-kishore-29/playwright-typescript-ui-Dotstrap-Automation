import type { Locator, Page } from '@playwright/test';
import type { Customer } from '../../data/customers';

/** Checkout step one: who is buying (`/checkout-step-one.html`). */
export class CheckoutInformationPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly postalCode: Locator;
  readonly continue: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.firstName = page.getByPlaceholder('First Name');
    this.lastName = page.getByPlaceholder('Last Name');
    this.postalCode = page.getByPlaceholder('Zip/Postal Code');
    this.continue = page.getByRole('button', { name: 'Continue' });
    this.error = page.getByTestId('error');
  }

  async fill(customer: Partial<Customer>): Promise<void> {
    if (customer.firstName !== undefined) await this.firstName.fill(customer.firstName);
    if (customer.lastName !== undefined) await this.lastName.fill(customer.lastName);
    if (customer.postalCode !== undefined) await this.postalCode.fill(customer.postalCode);
  }
}

/** Checkout step two: review (`/checkout-step-two.html`). */
export class CheckoutOverviewPage {
  readonly itemTotal: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  readonly finish: Locator;

  constructor(private readonly page: Page) {
    this.itemTotal = page.getByTestId('subtotal-label');
    this.tax = page.getByTestId('tax-label');
    this.total = page.getByTestId('total-label');
    this.finish = page.getByRole('button', { name: 'Finish' });
  }

  async itemPrices(): Promise<number[]> {
    const texts = await this.page.getByTestId('inventory-item-price').allInnerTexts();
    return texts.map((t) => money(t));
  }

  async amounts(): Promise<{ itemTotal: number; tax: number; total: number }> {
    return {
      itemTotal: money(await this.itemTotal.innerText()),
      tax: money(await this.tax.innerText()),
      total: money(await this.total.innerText()),
    };
  }
}

/** Checkout complete (`/checkout-complete.html`). */
export class CheckoutCompletePage {
  readonly heading: Locator;
  readonly backHome: Locator;

  constructor(page: Page) {
    this.heading = page.getByRole('heading', { name: 'Thank you for your order!' });
    this.backHome = page.getByRole('button', { name: 'Back Home' });
  }
}

/** "$29.99" or "Total: $32.39" to a number. */
export function money(text: string): number {
  const match = /\$([0-9]+(?:\.[0-9]{2})?)/.exec(text);
  if (!match?.[1]) {
    throw new Error(`No amount in "${text}"`);
  }
  return Number(match[1]);
}
