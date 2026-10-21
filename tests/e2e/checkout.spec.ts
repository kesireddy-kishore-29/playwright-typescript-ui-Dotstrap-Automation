import { aCustomer, type Customer } from '../../src/data/customers';
import { PRODUCTS } from '../../src/data/products';
import { expect, test } from '../../src/fixtures/sauce';
import { checkoutWith } from '../../src/flows/checkout';

test.describe('Sauce Demo checkout', () => {
  test(
    'a full checkout completes with a confirmation',
    {
      tag: ['@smoke', '@mobile'],
      annotation: { type: 'feature', description: 'FEAT-CHECKOUT-01' },
    },
    async ({
      inventoryPage,
      cartPage,
      checkoutInformation,
      checkoutOverview,
      checkoutComplete,
      page,
    }) => {
      await checkoutWith(
        { inventoryPage, cartPage, checkoutInformation },
        [PRODUCTS.backpack.name],
        aCustomer(),
      );
      await checkoutOverview.finish.click();

      await expect(checkoutComplete.heading).toBeVisible();
      await expect(page).toHaveURL(/checkout-complete\.html$/);
      await checkoutComplete.backHome.click();
      await expect(inventoryPage.header.cartBadge).toBeHidden();
    },
  );

  const missing: { field: string; customer: Partial<Customer>; error: RegExp }[] = [
    {
      field: 'first name',
      customer: { lastName: 'Lovelace', postalCode: '560001' },
      error: /First Name is required/,
    },
    {
      field: 'last name',
      customer: { firstName: 'Ada', postalCode: '560001' },
      error: /Last Name is required/,
    },
    {
      field: 'postal code',
      customer: { firstName: 'Ada', lastName: 'Lovelace' },
      error: /Postal Code is required/,
    },
  ];
  for (const { field, customer, error } of missing) {
    test(
      `checkout refuses a missing ${field}`,
      { annotation: { type: 'feature', description: 'FEAT-CHECKOUT-02' } },
      async ({ inventoryPage, cartPage, checkoutInformation, page }) => {
        await inventoryPage.open();
        await inventoryPage.addToCart(PRODUCTS.bikeLight.name);
        await inventoryPage.header.openCart();
        await cartPage.checkout.click();
        await checkoutInformation.fill(customer);
        await checkoutInformation.continue.click();

        await expect(checkoutInformation.error).toHaveText(error);
        await expect(page).toHaveURL(/checkout-step-one\.html$/);
      },
    );
  }

  test(
    'the order summary adds up: item total + tax = total',
    { annotation: { type: 'feature', description: 'FEAT-CHECKOUT-03' } },
    async ({ inventoryPage, cartPage, checkoutInformation, checkoutOverview }) => {
      const products = [PRODUCTS.backpack, PRODUCTS.fleeceJacket, PRODUCTS.onesie];
      await checkoutWith(
        { inventoryPage, cartPage, checkoutInformation },
        products.map((p) => p.name),
        aCustomer(),
      );

      const prices = await checkoutOverview.itemPrices();
      const { itemTotal, tax, total } = await checkoutOverview.amounts();
      const expectedItemTotal = products.reduce((sum, p) => sum + p.price, 0);
      expect(prices.sort()).toEqual(products.map((p) => p.price).sort());
      expect(itemTotal).toBeCloseTo(expectedItemTotal, 2);
      expect(tax).toBeGreaterThan(0);
      expect(total).toBeCloseTo(itemTotal + tax, 2);
    },
  );
});
