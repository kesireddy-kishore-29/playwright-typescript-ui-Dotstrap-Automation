import type { Locator } from '@playwright/test';

/** A data table addressed by column header names, never by column index or CSS. */
export class DataTable {
  constructor(readonly root: Locator) {}

  rows(): Locator {
    return this.root.getByRole('row').filter({ has: this.root.page().getByRole('cell') });
  }

  row(text: string): Locator {
    return this.rows().filter({ hasText: text });
  }

  async columnIndex(header: string): Promise<number> {
    const headers = await this.root.getByRole('columnheader').allInnerTexts();
    const index = headers.findIndex((h) => h.trim() === header);
    if (index < 0) {
      throw new Error(`No column "${header}" in [${headers.join(', ')}]`);
    }
    return index;
  }

  async cell(rowText: string, header: string): Promise<Locator> {
    return this.row(rowText)
      .getByRole('cell')
      .nth(await this.columnIndex(header));
  }
}
