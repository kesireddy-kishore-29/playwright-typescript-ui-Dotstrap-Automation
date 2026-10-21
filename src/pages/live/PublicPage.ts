import type { Locator, Page, Response } from '@playwright/test';

/** Any public page of the live site, read the way a visitor's browser reads it. */
export class PublicPage {
  readonly heading: Locator;
  private readonly failures: string[] = [];

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 }).first();
    page.on('response', (response) => {
      if (response.status() >= 400) {
        this.failures.push(
          `${String(response.status())} ${response.request().method()} ${response.url()}`,
        );
      }
    });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? 'failed';
      // ERR_ABORTED is the browser cancelling its own request (navigation, prefetch), not a
      // failure the site served; every other network error counts.
      if (!reason.includes('ERR_ABORTED')) {
        this.failures.push(`${reason} ${request.method()} ${request.url()}`);
      }
    });
  }

  async open(path: string): Promise<Response | null> {
    return this.page.goto(path, { waitUntil: 'load' });
  }

  /** Responses of 400+ and network errors seen since this page object was created. */
  failedRequests(): string[] {
    return [...this.failures];
  }

  /** Metadata has no role, so it is the one place a CSS attribute selector is used. */
  async metaContent(name: string): Promise<string | null> {
    return this.page.locator(`meta[name="${name}"]`).getAttribute('content');
  }

  async canonical(): Promise<string | null> {
    return this.page.locator('link[rel="canonical"]').getAttribute('href');
  }

  navLink(name: string | RegExp): Locator {
    return this.page.getByRole('navigation').getByRole('link', { name }).first();
  }

  async bodyBackground(): Promise<string> {
    return this.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  }
}
