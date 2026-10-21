import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeCommand, mergeSummaries } from '../src/reporting/merge';
import { readJson } from '../src/shared/json';

function shard(
  dir: string,
  id: string,
  status: 'passed' | 'failed',
  startedAt: string,
  finishedAt: string,
): void {
  const evidence = join(dir, 'e2e', id, '1');
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, 'meta.json'), '{}');
  writeFileSync(
    join(dir, 'run-summary.json'),
    JSON.stringify({
      repo: 'playwright-typescript-ui-Dotstrap-Automation',
      runId: 'nightly-1',
      startedAt,
      finishedAt,
      durationMs: 1,
      totals: {
        total: 1,
        passed: status === 'passed' ? 1 : 0,
        failed: status === 'failed' ? 1 : 0,
      },
      tests: [{ id, status }],
    }),
  );
  writeFileSync(join(dir, 'flaky-report.json'), JSON.stringify({ flaky: [{ testId: id }] }));
  writeFileSync(
    join(dir, 'metrics.json'),
    JSON.stringify({ tests: [{ testId: id, a11y: [], perf: [], visualDiffs: [] }] }),
  );
}

describe('merge', () => {
  it('combines Playwright shards into one run', () => {
    const root = mkdtempSync(join(tmpdir(), 'merge-'));
    shard(
      join(
        root,
        'shards',
        'evidence-shard-2',
        'playwright-typescript-ui-Dotstrap-Automation',
        'nightly-1',
      ),
      'b',
      'failed',
      '2026-10-21T02:00:00.000Z',
      '2026-10-21T02:00:30.000Z',
    );
    shard(
      join(
        root,
        'shards',
        'evidence-shard-1',
        'playwright-typescript-ui-Dotstrap-Automation',
        'nightly-1',
      ),
      'a',
      'passed',
      '2026-10-21T02:00:05.000Z',
      '2026-10-21T02:01:00.000Z',
    );
    const into = join(root, 'merged');

    expect(
      mergeCommand(
        new Map([
          ['from', join(root, 'shards')],
          ['into', into],
        ]),
        () => undefined,
      ),
    ).toBe(0);

    const summary = readJson(join(into, 'run-summary.json')) as {
      totals: Record<string, number>;
      tests: { id: string }[];
      durationMs: number;
      shards: number;
    };
    expect(summary.totals).toEqual({
      total: 2,
      passed: 1,
      failed: 1,
      skipped: 0,
      flaky: 0,
      quarantined: 0,
    });
    expect(summary.tests.map((t) => t.id)).toEqual(['a', 'b']);
    expect(summary.durationMs).toBe(60_000);
    expect(summary.shards).toBe(2);
    expect((readJson(join(into, 'flaky-report.json')) as { flaky: unknown[] }).flaky).toHaveLength(
      2,
    );
    expect((readJson(join(into, 'metrics.json')) as { tests: unknown[] }).tests).toHaveLength(2);
    expect(existsSync(join(into, 'e2e', 'a', '1', 'meta.json'))).toBe(true);
    expect(existsSync(join(into, 'e2e', 'b', '1', 'meta.json'))).toBe(true);
  });

  it('counts a test that ran in every shard once, with its worst result', () => {
    const doc = (status: 'passed' | 'failed'): Parameters<typeof mergeSummaries>[0][number] => ({
      repo: 'playwright-typescript-ui-Dotstrap-Automation',
      runId: 'nightly-1',
      startedAt: '2026-10-21T02:00:00.000Z',
      finishedAt: '2026-10-21T02:00:10.000Z',
      durationMs: 10_000,
      totals: {},
      tests: [
        {
          id: 'setup › setup/sauce-session.setup.ts › save a session',
          title: 'save a session',
          suite: 'setup',
          project: 'setup',
          featureIds: [],
          tags: [],
          status,
          durationMs: 1,
          attempt: 1,
          quarantined: false,
          startedAt: '2026-10-21T02:00:00.000Z',
        },
      ],
    });

    const merged = mergeSummaries([doc('passed'), doc('failed'), doc('passed')]);

    expect(merged.tests).toHaveLength(1);
    expect(merged.tests[0]?.status).toBe('failed');
    expect(merged.totals).toMatchObject({ total: 1, passed: 0, failed: 1 });
  });

  it('reports nothing to merge as an error', () => {
    const empty = mkdtempSync(join(tmpdir(), 'merge-empty-'));
    expect(
      mergeCommand(
        new Map([
          ['from', empty],
          ['into', join(empty, 'x')],
        ]),
        () => undefined,
      ),
    ).toBe(1);
  });
});
