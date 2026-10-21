import { describe, expect, it } from 'vitest';
import { pointOf, withPoint, type History } from '../src/reporting/history';
import { parseLinks, percentile, stepSummary } from '../src/reporting/report';
import { render, safeJson } from '../src/reporting/templates';
import {
  a11ySummary,
  esc,
  perfRows,
  visualExtra,
  type Metrics,
  type TestMetrics,
} from '../src/reporting/ui-extras';
import type { RunSummary } from '../src/shared/run';

const run = (runId: string, totals: Record<string, number>): RunSummary => ({
  repo: 'ui-automation-framework',
  runId,
  gitSha: 'abc',
  startedAt: '2026-10-21T08:00:00.000Z',
  finishedAt: '2026-10-21T08:01:00.000Z',
  durationMs: 60_000,
  totals,
  tests: [],
});

const metric = (over: Partial<TestMetrics>): TestMetrics => ({
  testId: 'id',
  title: 'title',
  project: 'chromium',
  status: 'passed',
  a11y: [],
  perf: [],
  visualDiffs: [],
  ...over,
});

describe('history', () => {
  it('counts flaky tests as passed and ignores skipped ones in the pass rate', () => {
    const point = pointOf(run('r1', { total: 10, passed: 6, failed: 2, flaky: 2, skipped: 0 }));
    expect(point.passRate).toBe(0.8);
    expect(point.date).toBe('2026-10-21');
  });

  it('replaces a rerun and keeps the newest 30 points', () => {
    let history: History = { schemaVersion: 1, runs: [] };
    for (let i = 0; i < 35; i++) {
      history = withPoint(history, pointOf(run(`r${String(i)}`, { total: 1, passed: 1 })));
    }
    history = withPoint(history, pointOf(run('r34', { total: 1, failed: 1 })));
    expect(history.runs).toHaveLength(30);
    expect(history.runs[0]?.runId).toBe('r5');
    expect(history.runs.at(-1)).toMatchObject({ runId: 'r34', failed: 1 });
  });
});

describe('templates', () => {
  it('cannot close the script element from inside the data', () => {
    expect(safeJson({ title: '</script><script>alert(1)</script>' })).not.toContain('</');
  });

  it('injects the data at the placeholder of the shared template', () => {
    const html = render('gallery.html', { repo: 'x', tests: [] });
    expect(html).toContain('const DATA = {"repo":"x","tests":[]};');
  });
});

describe('UI report sections', () => {
  const metrics: Metrics = {
    tests: [
      metric({
        a11y: [
          { url: 'http://localhost:4173/inbox', violations: [] },
          {
            url: 'http://localhost:4173/a11y-defects.html',
            violations: [
              { id: 'image-alt', impact: 'critical', help: '', nodes: 1 },
              { id: 'label', impact: 'critical', help: '', nodes: 2 },
            ],
          },
        ],
      }),
      metric({
        perf: [
          {
            path: '/inbox',
            timing: { ttfb: 20, domContentLoaded: 90, load: 120 },
            budget: { path: '/inbox', ttfb: 300, domContentLoaded: 1500, load: 2500 },
          },
          {
            path: '/items',
            timing: { ttfb: 20, domContentLoaded: 90, load: 2600 },
            budget: { path: '/items', ttfb: 300, domContentLoaded: 1500, load: 2500 },
          },
        ],
      }),
    ],
  };

  it('keeps the documented defects page out of the app violation count', () => {
    expect(a11ySummary(metrics)).toMatchObject({
      appScans: 1,
      appViolations: 0,
      documentedRules: 2,
    });
  });

  it('marks a page over budget when any timing reaches its budget', () => {
    expect(perfRows(metrics).map((r) => r.within)).toEqual([true, false]);
  });

  it('publishes expected, actual and diff images for each difference', () => {
    const published: string[] = [];
    const extra = visualExtra(
      {
        tests: [
          metric({
            project: 'visual',
            visualDiffs: [
              {
                name: 'items-1440-light',
                expected: 'visual-diffs/a/items-1440-light-expected.png',
                actual: 'visual-diffs/a/items-1440-light-actual.png',
                diff: 'visual-diffs/a/items-1440-light-diff.png',
              },
            ],
          }),
        ],
      },
      (p) => {
        published.push(p);
        return `runs/r1/${p}`;
      },
    );
    expect(published).toHaveLength(3);
    expect(extra.images?.[0]?.items.map((i) => i.label)).toEqual([
      'Expected (baseline)',
      'Actual',
      'Difference',
    ]);
    expect(extra.tiles?.[1]).toEqual({ label: 'Screenshots that differ', value: '1' });
  });

  it('escapes values that the template inserts as HTML', () => {
    expect(esc('<img onerror=x>')).toBe('&lt;img onerror=x&gt;');
  });
});

describe('summary and helpers', () => {
  it('uses the nearest-rank percentile', () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 50)).toBe(0);
  });

  it('parses label=href link pairs and skips malformed ones', () => {
    expect(parseLinks('Allure=allure/, Gallery = g.html,broken')).toEqual([
      { label: 'Allure', href: 'allure/' },
      { label: 'Gallery', href: 'g.html' },
    ]);
  });

  it('writes the totals, the categories and the UI lines into the step summary', () => {
    const md = stepSummary(
      run('r1', { total: 3, passed: 2, failed: 1, flaky: 0, skipped: 0, quarantined: 0 }),
      { byCategory: { PRODUCT_BUG: 1, TIMING: 0 }, aiStep: 'SKIPPED' },
      { tests: [metric({ project: 'visual' })] },
      'https://example.test/report/',
    );
    expect(md).toContain('| 3 | 2 | 1 | 0 | 0 | 0 | 60.0 s |');
    expect(md).toContain('**Failures by category:** PRODUCT_BUG 1');
    expect(md).toContain('**Visual:** 0 screenshot(s) differ in 1 visual test(s)');
    expect(md).toContain('[Allure](https://example.test/report/allure/)');
  });
});
