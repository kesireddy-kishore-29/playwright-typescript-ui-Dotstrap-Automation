import { describe, expect, it } from 'vitest';
import {
  addQuarantineTag,
  countsSince,
  proposalOwner,
  record,
  type FlakyHistory,
} from '../src/quarantine/flaky-history';
import { checkQuarantine, type QuarantineEntry } from '../src/quarantine/quarantine';

const entry = (testId: string, owner: string, expires: string): QuarantineEntry => ({
  testId,
  title: 't',
  owner,
  reason: 'flaky',
  expires,
  issue: '',
});

describe('quarantine policy', () => {
  it('passes a valid, owned, unexpired entry for a tagged test', () => {
    expect(
      checkQuarantine(
        [entry('a.spec.ts › t', '@o', '2026-11-01')],
        ['a.spec.ts › t'],
        '2026-10-21',
      ),
    ).toEqual([]);
  });

  it('fails expired, ownerless, untagged and unlisted tests', () => {
    const problems = checkQuarantine(
      [
        entry('a › expired', '@o', '2026-10-01'),
        entry('a › ownerless', '', '2026-12-01'),
        entry('a › untagged', '@o', '2026-12-01'),
      ],
      ['a › expired', 'a › ownerless', 'a › unlisted'],
      '2026-10-21',
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        'a › expired: expired on 2026-10-01 (fix the test or renew with a reason)',
        'a › ownerless: no owner',
        'a › untagged: listed in quarantine.json but the test is not tagged @quarantine',
        'a › unlisted: tagged @quarantine but has no quarantine.json entry',
      ]),
    );
  });
});

describe('flaky history', () => {
  it('keeps thirty days, ignores duplicates and counts a window', () => {
    let history: FlakyHistory = {
      schemaVersion: 1,
      occurrences: [{ date: '2026-09-01', runId: 'r0', testId: 'old', title: 'old' }],
    };
    history = record(
      history,
      [
        { date: '2026-10-10', runId: 'r1', testId: 'a', title: 'a' },
        { date: '2026-10-15', runId: 'r2', testId: 'a', title: 'a' },
        { date: '2026-10-20', runId: 'r3', testId: 'a', title: 'a' },
        { date: '2026-10-20', runId: 'r3', testId: 'a', title: 'a' },
      ],
      '2026-10-21',
    );
    expect(history.occurrences.map((o) => o.testId)).not.toContain('old');
    expect(countsSince(history, '2026-10-21', 14).get('a')).toBe(3);
  });

  it('proposes quarantine by adding the tag to the right test only', () => {
    const source = [
      "test('alpha', { tag: ['@smoke'], annotation: { type: 'feature', description: 'FEAT-A-01' } }, async () => {});",
      "test('beta', { annotation: { type: 'feature', description: 'FEAT-B-01' } }, async () => {});",
    ].join('\n');
    const alpha = addQuarantineTag(source, 'alpha');
    const beta = addQuarantineTag(source, 'beta');
    expect(alpha).toContain("tag: ['@quarantine', '@smoke']");
    expect(beta).toContain("test('beta', { tag: ['@quarantine'], annotation");
    expect(addQuarantineTag(alpha, 'alpha')).toBe(alpha);
  });

  it('owns a proposal by the named owner or the repository owner, never a guess', () => {
    expect(proposalOwner('@qa-team', 'acme')).toBe('@qa-team');
    expect(proposalOwner(undefined, 'acme')).toBe('@acme');
    expect(proposalOwner(' ', '@acme')).toBe('@acme');
    expect(proposalOwner(undefined, undefined)).toBeUndefined();
  });
});
