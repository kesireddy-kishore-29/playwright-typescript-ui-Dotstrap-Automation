/**
 * Self-hosted app under test for the scenarios a public demo site cannot provide: per-user API
 * data, notification/unread state, error and slow states, light/dark theme, a deliberately
 * inaccessible page, and two chaos switches: SUT_UI_CHAOS=rename-testid breaks a test id (the
 * self-healing demo) and SUT_UI_CHAOS=restyle-table ships an unintended style change (the visual
 * regression demo).
 *
 *   npm run sut            # http://localhost:4173
 *
 * In-memory only; restart to reset. Users whose email ends in @example.test can be created and
 * deleted through the API, so every Playwright worker gets its own account.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize } from 'node:path';

interface User {
  email: string;
  password: string;
  name: string;
}
interface Message {
  id: string;
  from: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
}
interface Item {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  owner: string;
  createdAt: string;
}

const PORT = Number(process.env['APP_PORT'] ?? process.env['PORT'] ?? 4173);
const CHAOS = process.env['SUT_UI_CHAOS'] ?? 'none';
const PUBLIC_DIR = join(__dirname, 'public');
const APP_ROUTES = new Set(['/', '/login', '/inbox', '/items', '/settings']);
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const users = new Map<string, User>([
  ['ava@example.test', { email: 'ava@example.test', password: 'demo-password-1', name: 'Ava' }],
]);
const tokens = new Map<string, string>();
const messages = new Map<string, Message[]>();
const items = new Map<string, Item[]>();

function send(
  res: ServerResponse,
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
): void {
  const base: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...headers,
  };
  if (body === undefined) {
    res.writeHead(status, base).end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json', ...base }).end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) {
    return {};
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function cookieToken(req: IncomingMessage): string | undefined {
  const cookie = req.headers.cookie ?? '';
  const match = /(?:^|;\s*)sutui_session=([^;]+)/.exec(cookie);
  return match?.[1];
}

function caller(req: IncomingMessage): User | undefined {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : cookieToken(req);
  const email = token ? tokens.get(token) : undefined;
  return email ? users.get(email) : undefined;
}

function issueToken(user: User): string {
  const token = randomBytes(24).toString('base64url');
  tokens.set(token, user.email);
  return token;
}

function sessionCookie(token: string): string {
  return `sutui_session=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

async function serveStatic(res: ServerResponse, pathname: string): Promise<void> {
  const file = APP_ROUTES.has(pathname) ? '/index.html' : pathname;
  const safe = normalize(file).replace(/^([/\\])+/, '');
  try {
    let content = await readFile(join(PUBLIC_DIR, safe), 'utf8');
    if (CHAOS === 'rename-testid') {
      // The chaos demo: a developer "renames" a test id the UI suite relies on.
      content = content.replaceAll('data-test="unread-count"', 'data-test="unread-badge"');
    }
    if (CHAOS === 'restyle-table' && safe === 'styles.css') {
      // The visual chaos demo: a stylesheet change nobody meant to ship makes table rows taller.
      content += '\ntd {\n  padding-block: 16px;\n}\n';
    }
    res
      .writeHead(200, {
        'Content-Type': MIME[extname(safe)] ?? 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      })
      .end(content);
  } catch {
    send(res, 404, { error: 'not_found' });
  }
}

async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const method = req.method ?? 'GET';
  const path = url.pathname;

  if (method === 'GET' && path === '/api/health') {
    send(res, 200, { status: 'UP', chaos: CHAOS });
    return;
  }
  if (method === 'POST' && path === '/api/users') {
    const body = await readJson(req);
    const email = str(body['email']);
    const password = str(body['password']);
    if (!email?.endsWith('@example.test') || !password || password.length < 8) {
      send(res, 422, { error: 'validation_failed' });
      return;
    }
    if (users.has(email)) {
      send(res, 409, { error: 'email_taken' });
      return;
    }
    users.set(email, { email, password, name: str(body['name']) ?? email.split('@')[0] ?? email });
    send(res, 201, { email });
    return;
  }
  if (method === 'POST' && path === '/api/auth/token') {
    const body = await readJson(req);
    const user = users.get(str(body['email']) ?? '');
    if (!user || user.password !== body['password']) {
      send(res, 401, { error: 'invalid_credentials' });
      return;
    }
    const token = issueToken(user);
    send(
      res,
      200,
      { token, user: { email: user.email, name: user.name } },
      { 'Set-Cookie': sessionCookie(token) },
    );
    return;
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    const token = cookieToken(req);
    if (token) {
      tokens.delete(token);
    }
    send(res, 204, undefined, { 'Set-Cookie': 'sutui_session=; Path=/; Max-Age=0' });
    return;
  }

  const user = caller(req);
  if (!user) {
    send(res, 401, { error: 'unauthenticated' });
    return;
  }
  const inbox = messages.get(user.email) ?? [];
  messages.set(user.email, inbox);
  const list = items.get(user.email) ?? [];
  items.set(user.email, list);

  if (method === 'GET' && path === '/api/me') {
    send(res, 200, { email: user.email, name: user.name });
  } else if (method === 'DELETE' && path === '/api/users/me') {
    users.delete(user.email);
    messages.delete(user.email);
    items.delete(user.email);
    for (const [token, email] of tokens) {
      if (email === user.email) {
        tokens.delete(token);
      }
    }
    send(res, 204);
  } else if (method === 'GET' && path === '/api/messages') {
    send(res, 200, { items: [...inbox].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  } else if (method === 'POST' && path === '/api/messages') {
    const body = await readJson(req);
    const subject = str(body['subject']);
    if (!subject) {
      send(res, 422, { error: 'validation_failed' });
      return;
    }
    const message: Message = {
      id: `msg_${randomUUID()}`,
      from: str(body['from']) ?? 'Someone',
      subject,
      body: str(body['body']) ?? '',
      read: false,
      createdAt: new Date().toISOString(),
    };
    inbox.push(message);
    send(res, 201, message);
  } else if (method === 'GET' && path === '/api/notifications/unread-count') {
    send(res, 200, { count: inbox.filter((m) => !m.read).length });
  } else if (method === 'POST' && path === '/api/messages/read-all') {
    inbox.forEach((m) => (m.read = true));
    send(res, 200, { count: 0 });
  } else if (method === 'POST' && /^\/api\/messages\/[^/]+\/read$/.test(path)) {
    const found = inbox.find((m) => m.id === path.split('/')[3]);
    if (!found) {
      send(res, 404, { error: 'not_found' });
      return;
    }
    found.read = true;
    send(res, 200, found);
  } else if (method === 'DELETE' && /^\/api\/messages\/[^/]+$/.test(path)) {
    const index = inbox.findIndex((m) => m.id === path.split('/')[3]);
    if (index < 0) {
      send(res, 404, { error: 'not_found' });
      return;
    }
    inbox.splice(index, 1);
    send(res, 204);
  } else if (method === 'GET' && path === '/api/items') {
    send(res, 200, { items: [...list].sort((a, b) => a.name.localeCompare(b.name)) });
  } else if (method === 'POST' && path === '/api/items') {
    const body = await readJson(req);
    const name = str(body['name']);
    const status = body['status'];
    if (!name || (status !== 'active' && status !== 'paused' && status !== 'archived')) {
      send(res, 422, { error: 'validation_failed' });
      return;
    }
    const item: Item = {
      id: `itm_${randomUUID()}`,
      name,
      status,
      owner: user.name,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    send(res, 201, item);
  } else if (method === 'DELETE' && /^\/api\/items\/[^/]+$/.test(path)) {
    const index = list.findIndex((i) => i.id === path.split('/')[3]);
    if (index < 0) {
      send(res, 404, { error: 'not_found' });
      return;
    }
    list.splice(index, 1);
    send(res, 204);
  } else if (method === 'GET' && path === '/api/usage') {
    send(res, 200, { plan: 'Free', used: list.length + inbox.length, limit: 100 });
  } else {
    send(res, 404, { error: 'not_found' });
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${String(PORT)}`);
  const handler = url.pathname.startsWith('/api/')
    ? api(req, res, url)
    : serveStatic(res, url.pathname);
  handler.catch((error: unknown) => {
    console.error(error);
    if (!res.headersSent) {
      send(res, 500, { error: 'internal' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`sut-ui listening on http://localhost:${String(PORT)} (chaos: ${CHAOS})`);
});
