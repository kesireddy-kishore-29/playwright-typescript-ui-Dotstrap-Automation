import type { Customer } from '../data/customers';
import type { CartPage } from '../pages/sauce/CartPage';
import type { CheckoutInformationPage } from '../pages/sauce/CheckoutPages';
import type { InventoryPage } from '../pages/sauce/InventoryPage';

export interface CheckoutPages {
  inventoryPage: InventoryPage;
  cartPage: CartPage;
  checkoutInformation: CheckoutInformationPage;
}

/** Add products, open the cart, start checkout and enter the customer. Ends on the overview. */
export async function checkoutWith(
  pages: CheckoutPages,
  products: string[],
  customer: Customer,
): Promise<void> {
  await pages.inventoryPage.open();
  for (const product of products) {
    await pages.inventoryPage.addToCart(product);
  }
  await pages.inventoryPage.header.openCart();
  await pages.cartPage.checkout.click();
  await pages.checkoutInformation.fill(customer);
  await pages.checkoutInformation.continue.click();
}
