import { expect } from '@playwright/test';
import { AppApi, type SeededItem, type SeededMessage } from '../clients/AppApi';
import { env } from '../config/env';
import { uniqueEmail } from '../data/unique';
import { AppMocks } from '../mocks/scenarios';
import { A11yDefectsPage } from '../pages/app/A11yDefectsPage';
import { AppLoginPage } from '../pages/app/AppLoginPage';
import { InboxPage } from '../pages/app/InboxPage';
import { ItemsPage } from '../pages/app/ItemsPage';
import { SettingsPage } from '../pages/app/SettingsPage';
import { test as base } from './base';

export interface Account {
  email: string;
  password: string;
  token: string;
}

/** Data a test seeds through the API; deleted after the test and verified gone. */
export interface Seed {
  message(from: string, subject: string): Promise<SeededMessage>;
  item(name: string, status?: SeededItem['status']): Promise<SeededItem>;
}

interface AppWorker {
  account: Account;
}
interface AppFixtures {
  api: AppApi;
  seed: Seed;
  mocks: AppMocks;
  appLogin: AppLoginPage;
  inbox: InboxPage;
  itemsPage: ItemsPage;
  settings: SettingsPage;
  a11yDefects: A11yDefectsPage;
}

const appHost = new URL(env.APP_BASE_URL).hostname;

export const test = base.extend<AppFixtures, AppWorker>({
  baseURL: env.APP_BASE_URL,

  // One account per worker, created and signed in through the API once, deleted at the end.
  account: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext({ baseURL: env.APP_BASE_URL });
      const email = uniqueEmail();
      const password = `pw-${email}`;
      await AppApi.createUser(request, email, password);
      const token = await AppApi.signIn(request, email, password);
      await use({ email, password, token });
      await new AppApi(request, token).deleteMe();
      const signInAfterDelete = await request.post('/api/auth/token', {
        data: { email, password },
      });
      expect(signInAfterDelete.status(), 'worker account is really deleted').toBe(401);
      await request.dispose();
    },
    { scope: 'worker' },
  ],

  // The saved session: the browser starts signed in, no UI login per test.
  storageState: async ({ account }, use) => {
    await use({
      cookies: [
        {
          name: 'sutui_session',
          value: account.token,
          domain: appHost,
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    });
  },

  api: async ({ request, account }, use) => {
    await use(new AppApi(request, account.token));
  },

  seed: async ({ api }, use) => {
    const messages: string[] = [];
    const items: string[] = [];
    await use({
      message: async (from, subject) => {
        const seeded = await api.seedMessage(from, subject);
        messages.push(seeded.id);
        return seeded;
      },
      item: async (name, status) => {
        const seeded = await api.createItem(name, status);
        items.push(seeded.id);
        return seeded;
      },
    });
    for (const id of messages) await api.deleteMessage(id);
    for (const id of items) await api.deleteItem(id);
    const leftMessages = (await api.messages()).filter((m) => messages.includes(m.id));
    const leftItems = (await api.items()).filter((i) => items.includes(i.id));
    expect(leftMessages, 'seeded messages deleted').toEqual([]);
    expect(leftItems, 'seeded items deleted').toEqual([]);
  },

  mocks: async ({ page }, use) => use(new AppMocks(page)),
  appLogin: async ({ page }, use) => use(new AppLoginPage(page)),
  inbox: async ({ page }, use) => use(new InboxPage(page)),
  itemsPage: async ({ page }, use) => use(new ItemsPage(page)),
  settings: async ({ page }, use) => use(new SettingsPage(page)),
  a11yDefects: async ({ page }, use) => use(new A11yDefectsPage(page)),
});

export { expect } from './base';
