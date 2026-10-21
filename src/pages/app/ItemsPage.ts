import type { Locator, Page } from '@playwright/test';
import { AppHeader } from '../../components/AppHeader';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';

/** Relay items (`/items`): a data table with a confirm-to-delete modal. */
export class ItemsPage {
  readonly header: AppHeader;
  readonly heading: Locator;
  readonly table: DataTable;
  readonly empty: Locator;
  readonly confirmDelete: Modal;

  constructor(private readonly page: Page) {
    this.header = new AppHeader(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'Items' });
    this.table = new DataTable(page.getByRole('table'));
    this.empty = page.getByText('No items yet.');
    this.confirmDelete = new Modal(page, 'Delete item?');
  }

  async open(): Promise<void> {
    await this.page.goto('/items');
  }

  /** Opens the confirm dialog for a row without confirming it. */
  async requestDelete(name: string): Promise<void> {
    await this.table
      .row(name)
      .getByRole('button', { name: `Delete ${name}` })
      .click();
  }

  async delete(name: string): Promise<void> {
    await this.requestDelete(name);
    await this.confirmDelete.confirm();
  }
}
