import type { Page, Route } from '@playwright/test';

export interface MockMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}

/** Fixed data: deterministic for visual baselines (no clocks, no random IDs). */
export const MESSAGES: readonly MockMessage[] = [
  {
    id: 'msg_1',
    from: 'Ben Okafor',
    subject: 'Quarterly planning notes',
    body: '',
    read: false,
    createdAt: '2026-01-05T09:00:00Z',
  },
  {
    id: 'msg_2',
    from: 'Priya Raman',
    subject: 'Design review moved to Thursday',
    body: '',
    read: false,
    createdAt: '2026-01-04T09:00:00Z',
  },
  {
    id: 'msg_3',
    from: 'Lucas Martin',
    subject: 'Invoice #2041 paid',
    body: '',
    read: true,
    createdAt: '2026-01-03T09:00:00Z',
  },
];

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** Simulated server latency inside a mocked response (the mock's behaviour, not a test wait). */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Network scenarios for the app's API. Routes are scoped to the page they are applied to. */
export class AppMocks {
  constructor(private readonly page: Page) {}

  async messages(items: readonly MockMessage[] = MESSAGES): Promise<void> {
    const unread = items.filter((m) => !m.read).length;
    await this.page.route('**/api/messages', (route) => json(route, 200, { items }));
    await this.page.route('**/api/notifications/unread-count', (route) =>
      json(route, 200, { count: unread }),
    );
    await this.page.route('**/api/usage', (route) =>
      json(route, 200, { plan: 'Free', used: 12, limit: 100 }),
    );
  }

  async empty(): Promise<void> {
    await this.messages([]);
  }

  async serverError(): Promise<void> {
    await this.page.route('**/api/messages', (route) => json(route, 500, { error: 'internal' }));
  }

  /** The first call fails with 500, later calls succeed: proves "Try again" really retries. */
  async serverErrorThenRecovery(): Promise<void> {
    let calls = 0;
    await this.page.route('**/api/messages', (route) => {
      calls += 1;
      return calls === 1
        ? json(route, 500, { error: 'internal' })
        : json(route, 200, { items: MESSAGES });
    });
  }

  async unauthorized(): Promise<void> {
    await this.page.route('**/api/**', (route) => json(route, 401, { error: 'unauthenticated' }));
  }

  async slow(ms: number): Promise<void> {
    await this.page.route('**/api/messages', async (route) => {
      await delay(ms);
      await json(route, 200, { items: MESSAGES });
    });
  }

  /** Messages load; the usage widget fails. The page must still be useful. */
  async partialFailure(): Promise<void> {
    await this.messages();
    await this.page.unroute('**/api/usage');
    await this.page.route('**/api/usage', (route) => json(route, 503, { error: 'unavailable' }));
  }

  async rateLimited(): Promise<void> {
    await this.page.route('**/api/messages', (route) =>
      json(route, 429, { error: 'rate_limited' }),
    );
  }

  async quotaExceeded(): Promise<void> {
    await this.page.route('**/api/messages', (route) =>
      json(route, 429, { error: 'quota_exceeded' }),
    );
  }
}
