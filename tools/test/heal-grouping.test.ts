import { describe, expect, it } from 'vitest';
import { fingerprint } from '../src/healing/heal';
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
