import { PRODUCTS } from '../../src/data/products';
import { expect, test } from '../../src/fixtures/sauce';

test.describe('Sauce Demo cart', () => {
  test(
    'adding and removing items keeps the badge count right',
    { tag: ['@mobile'], annotation: { type: 'feature', description: 'FEAT-CART-01' } },
    async ({ inventoryPage }) => {
      await inventoryPage.open();
      await inventoryPage.addToCart(PRODUCTS.backpack.name);
      await inventoryPage.addToCart(PRODUCTS.bikeLight.name);
      await expect(inventoryPage.header.cartBadge).toHaveText('2');

      await inventoryPage.removeFromCart(PRODUCTS.backpack.name);
      await expect(inventoryPage.header.cartBadge).toHaveText('1');

      await inventoryPage.removeFromCart(PRODUCTS.bikeLight.name);
      await expect(inventoryPage.header.cartBadge).toBeHidden();
    },
  );

  test(
    'the cart keeps its contents across navigation',
    { annotation: { type: 'feature', description: 'FEAT-CART-02' } },
    async ({ inventoryPage, productPage, cartPage }) => {
      await inventoryPage.open();
      await inventoryPage.addToCart(PRODUCTS.onesie.name);
      await inventoryPage.openDetails(PRODUCTS.boltTShirt.name);
      await productPage.back.click();
      await inventoryPage.header.openCart();

      expect(await cartPage.names()).toEqual([PRODUCTS.onesie.name]);
      await cartPage.continueShopping.click();
      await expect(inventoryPage.header.cartBadge).toHaveText('1');
    },
  );
});
