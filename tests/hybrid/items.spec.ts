import { uniqueName } from '../../src/data/unique';
import { expect, test } from '../../src/fixtures/app';

test.describe('items, seeded through the API', () => {
  test(
    'an item created through the API is listed with its status and owner',
    { annotation: { type: 'feature', description: 'FEAT-ITEMS-01' } },
    async ({ seed, itemsPage }) => {
      const item = await seed.item(uniqueName('report'), 'paused');

      await itemsPage.open();

      await expect(itemsPage.table.row(item.name)).toBeVisible();
      await expect(await itemsPage.table.cell(item.name, 'Status')).toHaveText('paused');
      await expect(await itemsPage.table.cell(item.name, 'Owner')).toHaveText('QA');
    },
  );

  test(
    'an item deleted through the UI is gone from the API too',
    { annotation: { type: 'feature', description: 'FEAT-ITEMS-01' } },
    async ({ seed, itemsPage, api }) => {
      const keep = await seed.item(uniqueName('keep'));
      const remove = await seed.item(uniqueName('remove'));
      await itemsPage.open();

      await itemsPage.delete(remove.name);

      await expect(itemsPage.table.row(remove.name)).toHaveCount(0);
      await expect(itemsPage.table.row(keep.name)).toBeVisible();
      expect((await api.items()).map((i) => i.id)).not.toContain(remove.id);
    },
  );
});
