import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * Masks secrets before evidence leaves the machine: credential headers, cookies, token/password
 * fields, token query parameters, and (for the live site) policy headers that name
 * infrastructure. Used by the evidence reporter on console logs, HAR files, Playwright traces and
 * metadata. Unit tests: tools/test/redact.test.ts.
 */
export const MASK = '****';

const SECRET_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
]);
const POLICY_HEADERS = new Set([
  'content-security-policy',
  'content-security-policy-report-only',
  'report-to',
  'nel',
]);
const SECRET_FIELD =
  /^(password|token|accesstoken|refreshtoken|idtoken|secret|apikey|authorization)$/i;
const SECRET_QUERY = /([?&](?:token|access_token|api_key|apikey|key|password)=)[^&#\s]*/gi;
const GOOGLE_API_KEY = /AIza[0-9A-Za-z_-]{35}/g;
const SECRET_JSON_TEXT =
  /("(?:password|token|accessToken|refreshToken|secret|apiKey)"\s*:\s*")[^"]*(")/gi;
/** A header written as a line of text, as Playwright's request logs do: "  cookie: a=b". */
const SECRET_HEADER_LINE =
  /^(\s*(?:authorization|proxy-authorization|cookie|set-cookie|x-api-key)\s*:\s*)(?:(bearer|basic)\s+)?\S.*$/gim;

export function redactHeaderValue(name: string, value: string): string {
  const lower = name.toLowerCase();
  if (POLICY_HEADERS.has(lower)) {
    return '[policy not stored]';
  }
  if (!SECRET_HEADERS.has(lower)) {
    return value;
  }
  const space = value.indexOf(' ');
  return lower === 'authorization' && space > 0 ? `${value.slice(0, space)} ${MASK}` : MASK;
}

export function redactText(text: string): string {
  return text
    .replace(SECRET_QUERY, `$1${MASK}`)
    .replace(GOOGLE_API_KEY, MASK)
    .replace(SECRET_JSON_TEXT, `$1${MASK}$2`)
    .replace(SECRET_HEADER_LINE, (_line, name: string, scheme?: string) =>
      scheme ? `${name}${scheme} ${MASK}` : `${name}${MASK}`,
    );
}

export function redactJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactJson);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = SECRET_FIELD.test(key) && typeof child !== 'object' ? MASK : redactJson(child);
    }
    return out;
  }
  return typeof value === 'string' ? redactText(value) : value;
}

interface HarHeader {
  name: string;
  value: string;
}
interface HarMessage {
  headers?: HarHeader[];
  cookies?: unknown[];
  url?: string;
  postData?: { text?: string };
  content?: { text?: string };
}
interface HarEntry {
  request?: HarMessage;
  response?: HarMessage;
}
interface Har {
  log?: { entries?: HarEntry[] };
}

/** A HAR file with headers, cookies, URLs and bodies masked. */
export function redactHar(har: Har): Har {
  const clean = (message: HarMessage | undefined): void => {
    if (!message) return;
    message.headers = (message.headers ?? []).map((h) => ({
      name: h.name,
      value: redactHeaderValue(h.name, h.value),
    }));
    message.cookies = [];
    if (message.url) message.url = redactText(message.url);
    if (message.postData?.text) message.postData.text = redactText(message.postData.text);
    if (message.content?.text) message.content.text = redactText(message.content.text);
  };
  for (const entry of har.log?.entries ?? []) {
    clean(entry.request);
    clean(entry.response);
  }
  return har;
}

/**
 * Walks any JSON value: header pairs ({name, value}) get their values masked by header name,
 * cookies (in a `cookies` list, or with a `domain`) always, secret fields are masked, and every
 * string is redacted as text.
 */
function redactDeep(value: unknown, isCookie = false): unknown {
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, isCookie));
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(record)) {
      out[key] =
        SECRET_FIELD.test(key) && typeof child !== 'object'
          ? MASK
          : redactDeep(child, key.toLowerCase() === 'cookies');
    }
    if (typeof record['name'] === 'string' && typeof record['value'] === 'string') {
      out['value'] =
        isCookie || 'domain' in record ? MASK : redactHeaderValue(record['name'], record['value']);
    }
    return out;
  }
  return typeof value === 'string' ? redactText(value) : value;
}

/** Binary entries (images, video) are left alone; a zero byte early on marks them. */
function isBinary(data: Uint8Array): boolean {
  return data.subarray(0, 4096).includes(0);
}

/**
 * A Playwright trace with the same masking as a HAR: the event and network logs (JSON lines) are
 * walked value by value, and every text resource is redacted as text. Playwright writes traces
 * itself, with raw headers and cookies, so they are redacted before they are copied anywhere.
 */
export function redactTrace(zip: Uint8Array): Uint8Array {
  const files = unzipSync(zip);
  const out: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (/\.(trace|network|stacks)$/.test(name)) {
      out[name] = strToU8(
        strFromU8(data)
          .split('\n')
          .map((line) => {
            if (!line.trim()) return line;
            try {
              return JSON.stringify(redactDeep(JSON.parse(line)));
            } catch {
              return redactText(line);
            }
          })
          .join('\n'),
      );
    } else if (!isBinary(data)) {
      out[name] = strToU8(redactText(strFromU8(data)));
    } else {
      out[name] = data;
    }
  }
  return zipSync(out, { level: 6 });
}
