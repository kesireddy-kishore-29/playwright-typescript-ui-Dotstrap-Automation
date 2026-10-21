import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

export interface SeededMessage {
  id: string;
  subject: string;
  from: string;
  read: boolean;
}
export interface SeededItem {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
}

/**
 * The app's API, for seeding and cleaning up around a UI assertion (hybrid tests). Every call
 * checks its status, so a seeding failure is reported as such, not as a confusing UI failure.
 */
export class AppApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly token: string,
  ) {}

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }

  static async createUser(
    request: APIRequestContext,
    email: string,
    password: string,
  ): Promise<void> {
    const response = await request.post('/api/users', { data: { email, password, name: 'QA' } });
    expect(response.status(), 'create test user').toBe(201);
  }

  static async signIn(
    request: APIRequestContext,
    email: string,
    password: string,
  ): Promise<string> {
    const response = await request.post('/api/auth/token', { data: { email, password } });
    expect(response.status(), 'sign in through the API').toBe(200);
    const body = (await response.json()) as { token: string };
    return body.token;
  }

  async seedMessage(from: string, subject: string): Promise<SeededMessage> {
    const response = await this.request.post('/api/messages', {
      headers: this.headers(),
      data: { from, subject, body: 'Seeded by a test' },
    });
    expect(response.status(), 'seed message').toBe(201);
    return (await response.json()) as SeededMessage;
  }

  async deleteMessage(id: string): Promise<void> {
    const response = await this.request.delete(`/api/messages/${id}`, { headers: this.headers() });
    expect([204, 404], 'delete message').toContain(response.status());
  }

  async messages(): Promise<SeededMessage[]> {
    const response = await this.request.get('/api/messages', { headers: this.headers() });
    expect(response.status()).toBe(200);
    return ((await response.json()) as { items: SeededMessage[] }).items;
  }

  async unreadCount(): Promise<number> {
    const response = await this.request.get('/api/notifications/unread-count', {
      headers: this.headers(),
    });
    expect(response.status()).toBe(200);
    return ((await response.json()) as { count: number }).count;
  }

  async createItem(name: string, status: SeededItem['status'] = 'active'): Promise<SeededItem> {
    const response = await this.request.post('/api/items', {
      headers: this.headers(),
      data: { name, status },
    });
    expect(response.status(), 'create item').toBe(201);
    return (await response.json()) as SeededItem;
  }

  async deleteItem(id: string): Promise<void> {
    const response = await this.request.delete(`/api/items/${id}`, { headers: this.headers() });
    expect([204, 404], 'delete item').toContain(response.status());
  }

  async items(): Promise<SeededItem[]> {
    const response = await this.request.get('/api/items', { headers: this.headers() });
    expect(response.status()).toBe(200);
    return ((await response.json()) as { items: SeededItem[] }).items;
  }

  async deleteMe(): Promise<void> {
    const response = await this.request.delete('/api/users/me', { headers: this.headers() });
    expect(response.status(), 'delete test user').toBe(204);
  }
}
