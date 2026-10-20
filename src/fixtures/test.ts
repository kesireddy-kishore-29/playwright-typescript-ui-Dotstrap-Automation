import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/sauce/LoginPage';

interface Pages {
  loginPage: LoginPage;
}

/** The project's `test`: Playwright's, plus page objects injected per test. */
export const test = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect };
