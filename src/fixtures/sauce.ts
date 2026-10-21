import { env } from '../config/env';
import { CartPage } from '../pages/sauce/CartPage';
import {
  CheckoutCompletePage,
  CheckoutInformationPage,
  CheckoutOverviewPage,
} from '../pages/sauce/CheckoutPages';
import { InventoryPage } from '../pages/sauce/InventoryPage';
import { LoginPage } from '../pages/sauce/LoginPage';
import { ProductDetailPage } from '../pages/sauce/ProductDetailPage';
import { test as base } from './base';

/** Written once by tests/setup/sauce-session.setup.ts and reused by every Sauce Demo test. */
export const SAUCE_SESSION = '.auth/sauce.json';

interface SaucePages {
  loginPage: LoginPage;
  inventoryPage: InventoryPage;
  productPage: ProductDetailPage;
  cartPage: CartPage;
  checkoutInformation: CheckoutInformationPage;
  checkoutOverview: CheckoutOverviewPage;
  checkoutComplete: CheckoutCompletePage;
}

/**
 * Finding against the public target (docs/known-issues.md): Sauce Demo is a static single-page
 * app, so loading a route directly (/inventory.html, /cart.html) answers HTTP 404 and the app
 * then renders from the fallback page. Chrome logs that 404. Only that exact case is allowed.
 */
const SAUCE_DEEP_LINK_404 =
  /status of 404 \(\) \(https:\/\/www\.saucedemo\.com\/[a-z-]+\.html(\?[^)]*)?\)$/;

/**
 * Finding against the public target (docs/known-issues.md): Sauce Demo's error-reporting SDK posts
 * to events.backtrace.io with a placeholder project (`universe=UNIVERSE`), and that service
 * sometimes answers 401. It is third-party telemetry, not the page under test. Only those two
 * submit endpoints are allowed.
 */
const SAUCE_TELEMETRY_401 =
  /status of 401 \(Unauthorized\) \(https:\/\/events\.backtrace\.io\/api\/(summed|unique)-events\/submit\?/;

export const test = base.extend<SaucePages>({
  baseURL: env.SAUCE_BASE_URL,
  storageState: SAUCE_SESSION,
  allowedConsoleErrors: [SAUCE_DEEP_LINK_404, SAUCE_TELEMETRY_401],
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  inventoryPage: async ({ page }, use) => use(new InventoryPage(page)),
  productPage: async ({ page }, use) => use(new ProductDetailPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutInformation: async ({ page }, use) => use(new CheckoutInformationPage(page)),
  checkoutOverview: async ({ page }, use) => use(new CheckoutOverviewPage(page)),
  checkoutComplete: async ({ page }, use) => use(new CheckoutCompletePage(page)),
});

/** For the tests about signing in: no saved session. */
export const signedOut = { storageState: { cookies: [], origins: [] } };

export { expect } from './base';
