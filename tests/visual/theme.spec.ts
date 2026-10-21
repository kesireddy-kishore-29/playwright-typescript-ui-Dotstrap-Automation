import { expect, test } from '../../src/fixtures/app';

test(
  'the theme choice applies at once and survives a reload',
  { annotation: { type: 'feature', description: 'FEAT-THEME-01' } },
  async ({ page, mocks, settings }) => {
    await mocks.messages();
    await page.emulateMedia({ colorScheme: 'light' });
    await settings.open();
    expect(await settings.renderedTheme()).toBe('light');

    await settings.dark.check();
    await expect(settings.dark).toBeChecked();
    expect(await settings.renderedTheme()).toBe('dark');

    await page.reload();
    await expect(settings.dark).toBeChecked();
    expect(await settings.renderedTheme()).toBe('dark');
  },
);
