import { env } from '../config/env';
import { PublicPage } from '../pages/live/PublicPage';
import { test as base } from './base';

/**
 * dotstrap.com, public pages only: no sign-in, no forms, no writes, no calls to any private API.
 * The project runs with one worker and a clear user agent (playwright.config.ts).
 */
export const test = base.extend<{ publicPage: PublicPage }>({
  baseURL: env.LIVE_BASE_URL,
  publicPage: async ({ page }, use) => use(new PublicPage(page)),
});

export { expect } from './base';
