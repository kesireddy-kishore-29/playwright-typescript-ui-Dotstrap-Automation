/**
 * Masks secrets before evidence leaves the machine: credential headers, token/password fields,
 * token query parameters, and (for the live site) policy headers that name infrastructure. Used
 * by the evidence reporter on console logs, HAR files and metadata. Has its own unit tests.
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
    .replace(SECRET_JSON_TEXT, `$1${MASK}$2`);
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
