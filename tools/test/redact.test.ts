import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  MASK,
  redactHar,
  redactHeaderValue,
  redactJson,
  redactLocalPaths,
  redactText,
  redactTrace,
} from '../../src/support/redact';

const sha1 = (text: string): string => createHash('sha1').update(text).digest('hex');

describe('local paths', () => {
  const windows = [
    { path: String.raw`D:\work\repo`, as: '' },
    { path: String.raw`C:\Users\someone\AppData\Local\Temp`, as: '<tmp>' },
    { path: String.raw`C:\Users\someone`, as: '~' },
  ];

  it('makes paths under the repository relative, in text and JSON text, any drive case', () => {
    const text = [
      String.raw`at DemoPage.open (D:\work\repo\src\pages\DemoPage.ts:20:28)`,
      String.raw`{"file":"D:\\work\\repo\\tests\\a.spec.ts"}`,
      'file:///D:/work/repo/src/a.ts',
      String.raw`cwd d:\work\repo`,
    ].join('\n');
    expect(redactLocalPaths(text, windows, true).split('\n')).toEqual([
      String.raw`at DemoPage.open (src\pages\DemoPage.ts:20:28)`,
      String.raw`{"file":"tests\\a.spec.ts"}`,
      'file:///src/a.ts',
      'cwd .',
    ]);
  });

  it('replaces the temp and home folders, so no user name is left', () => {
    const text = String.raw`{"dir":"C:\\Users\\someone\\AppData\\Local\\Temp\\pw-1"} C:\Users\someone\.cache`;
    const clean = redactLocalPaths(text, windows, true);
    expect(clean).toBe(String.raw`{"dir":"<tmp>\\pw-1"} ~\.cache`);
    expect(clean).not.toContain('someone');
  });

  it('leaves a sibling folder that only starts with the same name', () => {
    const text = String.raw`D:\work\repo-other\x.ts`;
    expect(redactLocalPaths(text, windows, true)).toBe(text);
  });

  it('handles POSIX paths, as on the CI runner', () => {
    const posix = [
      { path: '/home/runner/work/r/r', as: '' },
      { path: '/home/runner', as: '~' },
    ];
    expect(
      redactLocalPaths('/home/runner/work/r/r/tests/a.spec.ts /home/runner/.cache/x', posix, false),
    ).toBe('tests/a.spec.ts ~/.cache/x');
  });

  it('applies to this machine by default (redactText)', () => {
    expect(redactText(join(process.cwd(), 'src', 'x.ts'))).toBe(join('src', 'x.ts'));
    expect(redactText(join(homedir(), 'notes.txt'))).toBe(join('~', 'notes.txt'));
  });
});

describe('redaction', () => {
  it('masks credential headers and keeps the auth scheme', () => {
    expect(redactHeaderValue('Authorization', 'Bearer abc.def')).toBe(`Bearer ${MASK}`);
    expect(redactHeaderValue('Cookie', 'sutui_session=abc')).toBe(MASK);
    expect(redactHeaderValue('Accept', 'application/json')).toBe('application/json');
  });

  it('does not store policy headers that name infrastructure', () => {
    expect(redactHeaderValue('Content-Security-Policy', "connect-src 'self' x.example")).toBe(
      '[policy not stored]',
    );
  });

  it('masks token query parameters, API keys and secret JSON fields in text', () => {
    const text = `GET /x?token=abc&page=2 {"password":"hunter2","name":"Ava"} AIza${'a'.repeat(35)}`;
    const clean = redactText(text);
    expect(clean).toContain(`token=${MASK}&page=2`);
    expect(clean).toContain(`"password":"${MASK}"`);
    expect(clean).toContain('"name":"Ava"');
    expect(clean).not.toContain('AIza');
  });

  it('masks headers written as lines of text, as Playwright request logs do', () => {
    const log =
      '→ GET http://localhost:4173/api/me\n  cookie: sutui_session=abc123\n  authorization: Bearer xyz\n  accept: */*';
    const clean = redactText(log);
    expect(clean).toContain(`  cookie: ${MASK}`);
    expect(clean).toContain(`  authorization: Bearer ${MASK}`);
    expect(clean).toContain('  accept: */*');
    expect(clean).not.toMatch(/abc123|xyz/);
  });

  it('masks secret fields at any depth of a JSON value', () => {
    expect(redactJson({ user: { accessToken: 't', email: 'a@example.test' } })).toEqual({
      user: { accessToken: MASK, email: 'a@example.test' },
    });
  });

  it('masks HAR headers, drops cookies and redacts bodies', () => {
    const har = redactHar({
      log: {
        entries: [
          {
            request: {
              headers: [{ name: 'Cookie', value: 'sutui_session=abc' }],
              cookies: [{ name: 'sutui_session', value: 'abc' }],
              postData: { text: '{"password":"demo-password-1"}' },
            },
          },
        ],
      },
    });
    const request = har.log?.entries?.[0]?.request;
    expect(request?.headers).toEqual([{ name: 'Cookie', value: MASK }]);
    expect(request?.cookies).toEqual([]);
    expect(request?.postData?.text).toBe(`{"password":"${MASK}"}`);
  });

  it('masks headers, cookies and bodies inside a Playwright trace and keeps binaries intact', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    const trace = zipSync({
      '0-trace.network': strToU8(
        `${JSON.stringify({
          type: 'resource-snapshot',
          snapshot: {
            request: {
              headers: [{ name: 'cookie', value: 'sutui_session=secret-session' }],
              cookies: [{ name: 'sutui_session', value: 'secret-session' }],
            },
            response: { headers: [{ name: 'set-cookie', value: 'sutui_session=secret-session' }] },
          },
        })}\n`,
      ),
      '0-trace.trace': strToU8(
        `${JSON.stringify({
          type: 'context-options',
          options: {
            storageState: {
              cookies: [{ name: 'sutui_session', value: 'secret-session', domain: 'localhost' }],
            },
          },
        })}\n`,
      ),
      '1-trace.trace': strToU8(
        `${JSON.stringify({ type: 'log', message: '  cookie: sutui_session=secret-session' })}\n`,
      ),
      'resources/abc': strToU8('{"email":"a@example.test","password":"demo-password-1"}'),
      'resources/img.png': png,
    });

    const files = unzipSync(redactTrace(trace));
    const all = Object.entries(files)
      .filter(([name]) => !name.endsWith('.png'))
      .map(([, data]) => strFromU8(data))
      .join('\n');

    expect(all).not.toContain('secret-session');
    expect(all).not.toContain('demo-password-1');
    expect(all).toContain('a@example.test');
    expect(files['resources/img.png']).toEqual(png);
  });

  it('makes source paths in a trace relative and renames their sources to match', () => {
    const file = join(process.cwd(), 'tests', 'a.spec.ts');
    const relative = join('tests', 'a.spec.ts');
    const trace = zipSync({
      'test.trace': strToU8(`${JSON.stringify({ type: 'before', stack: [{ file, line: 3 }] })}\n`),
      '0-trace.stacks': strToU8(JSON.stringify({ files: [file], stacks: [] })),
      [`src/${sha1(file)}.ts`]: strToU8("test('a', () => {});"),
    });

    const files = unzipSync(redactTrace(trace));

    expect(Object.keys(files)).toContain(`src/${sha1(relative)}.ts`);
    expect(Object.keys(files)).not.toContain(`src/${sha1(file)}.ts`);
    const text = (name: string): string => strFromU8(files[name] ?? new Uint8Array());
    const logs = text('test.trace') + text('0-trace.stacks');
    expect(logs).not.toContain(JSON.stringify(process.cwd()).slice(1, -1));
    expect(JSON.parse(text('0-trace.stacks'))).toEqual({
      files: [relative],
      stacks: [],
    });
  });
});

describe('finding traces to redact', () => {
  it('recognises a Playwright trace and nothing else', async () => {
    const { isTrace } = await import('../src/reporting/redact-traces');
    expect(isTrace(zipSync({ '0-trace.trace': strToU8('{}') }))).toBe(true);
    expect(isTrace(zipSync({ 'readme.txt': strToU8('x') }))).toBe(false);
    expect(isTrace(strToU8('not a zip'))).toBe(false);
  });
});
