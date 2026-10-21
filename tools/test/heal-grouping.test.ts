import { describe, expect, it } from 'vitest';
import { commitMessage, fingerprint, wrap } from '../src/healing/heal';
import type { Patch } from '../src/healing/patch';
import { renderPrBody } from '../src/healing/pr-body';

const patch = (testId: string, after: string): Patch => ({
  category: 'LOCATOR_DRIFT',
  testId,
  provider: 'rule-based',
  rationale: 'rename',
  changes: [
    { path: 'src/components/NotificationBell.ts', before: 'a', after },
    { path: 'src/pages/app/InboxPage.ts', before: 'b', after: 'c' },
  ],
});

describe('grouping heals by fix', () => {
  it('gives failures with the same fix the same key', () => {
    expect(fingerprint(patch('t1', 'x'))).toBe(fingerprint(patch('t2', 'x')));
  });

  it('gives a different fix a different key', () => {
    expect(fingerprint(patch('t1', 'x'))).not.toBe(fingerprint(patch('t1', 'y')));
  });

  it('lists the other failures a fix explains in the PR body', () => {
    const body = renderPrBody(patch('lead', 'x'), 'cause', 'bundle', [], [], false, ['t2', 't3']);
    expect(body).toContain(
      '| Also explains | 2 other failing test(s) with the same cause (below) |',
    );
    expect(body).toContain('- `t2`');
    expect(body).toContain('- `t3`');
  });

  it('says nothing about other failures when there are none', () => {
    expect(renderPrBody(patch('lead', 'x'), 'cause', 'bundle', [], [], false)).not.toContain(
      'Also explains',
    );
  });
});

describe('heal commit message', () => {
  it('keeps the header and every line within the commit rules', () => {
    const message = commitMessage(
      'LOCATOR_DRIFT',
      'chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-reading-one-updates-it',
      `No element matches getByTestId('unread-count') any more; ${'x'.repeat(150)}`,
      7,
      'rule-based',
    );
    const lines = message.split('\n');
    expect(lines[0]?.length).toBeLessThanOrEqual(100);
    expect(lines[0]).toMatch(/^fix\(heal\): locator drift in chromium-inbox/);
    expect(lines.every((l) => l.length <= 100)).toBe(true);
    expect(message).toContain('The same fix explains 7 other failing test(s).');
    expect(lines.at(-1)).toBe('Healed-By: rule-based');
  });

  it('wraps words and cuts a word longer than the width', () => {
    expect(wrap('aa bb cc', 5)).toEqual(['aa bb', 'cc']);
    expect(wrap('abcdefgh', 3)).toEqual(['abc', 'def', 'gh']);
  });
});
