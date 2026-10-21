import type { SortOption } from '../../src/pages/sauce/InventoryPage';
import { PRODUCT_COUNT, PRODUCTS } from '../../src/data/products';
import { expect, test } from '../../src/fixtures/sauce';

function sortedCopy(values: (string | number)[], order: 'asc' | 'desc'): (string | number)[] {
  const ascending = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return order === 'asc' ? ascending : ascending.reverse();
}

test.describe('Sauce Demo inventory', () => {
  test(
    'lists every product with a name and a price',
    { tag: ['@smoke'], annotation: { type: 'feature', description: 'FEAT-INV-01' } },
    async ({ inventoryPage }) => {
      await inventoryPage.open();

      await expect(inventoryPage.items).toHaveCount(PRODUCT_COUNT);
      expect(await inventoryPage.names()).toEqual(
        expect.arrayContaining(Object.values(PRODUCTS).map((p) => p.name)),
      );
      expect(await inventoryPage.prices()).toEqual(
        expect.arrayContaining(Object.values(PRODUCTS).map((p) => p.price)),
      );
    },
  );

  const sorts: { option: SortOption; key: 'names' | 'prices'; order: 'asc' | 'desc' }[] = [
    { option: 'Name (A to Z)', key: 'names', order: 'asc' },
    { option: 'Name (Z to A)', key: 'names', order: 'desc' },
    { option: 'Price (low to high)', key: 'prices', order: 'asc' },
    { option: 'Price (high to low)', key: 'prices', order: 'desc' },
  ];
  for (const sort of sorts) {
    test(
      `sorts by ${sort.option}`,
      { annotation: { type: 'feature', description: 'FEAT-INV-02' } },
      async ({ inventoryPage }) => {
        await inventoryPage.open();
        await inventoryPage.sortBy(sort.option);

        const values = await inventoryPage.valuesFor(sort.key);
        expect(values).toEqual(sortedCopy(values, sort.order));
      },
    );
  }

  test(
    'opens a product detail page and comes back',
    { annotation: { type: 'feature', description: 'FEAT-INV-03' } },
    async ({ inventoryPage, productPage, page }) => {
      await inventoryPage.open();
      await inventoryPage.openDetails(PRODUCTS.fleeceJacket.name);

      await expect(productPage.name).toHaveText(PRODUCTS.fleeceJacket.name);
      await expect(productPage.price).toHaveText(`$${String(PRODUCTS.fleeceJacket.price)}`);
      await expect(productPage.description).not.toBeEmpty();
      await productPage.back.click();
      await expect(page).toHaveURL(/inventory\.html$/);
    },
  );
});
