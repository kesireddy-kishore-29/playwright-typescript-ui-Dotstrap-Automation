/**
 * The UI-specific report sections: accessibility by impact, navigation-timing budgets and the
 * visual differences, built from the metrics.json the evidence reporter writes. Each section is a
 * dashboard "extra" (the same shape the API repository uses for contract coverage and latency).
 */

export interface A11yScan {
  url: string;
  violations: { id: string; impact: string; help: string; nodes: number }[];
}
export interface PerfSample {
  path: string;
  timing: Record<string, number>;
  budget: Record<string, number | string>;
}
export interface VisualDiff {
  name: string;
  expected?: string;
  actual?: string;
  diff?: string;
}
export interface TestMetrics {
  testId: string;
  title: string;
  project: string;
  status: string;
  a11y: A11yScan[];
  perf: PerfSample[];
  visualDiffs: VisualDiff[];
}
export interface Metrics {
  tests: TestMetrics[];
}

type Cell = string | number;
export interface Extra {
  title: string;
  subtitle?: string;
  wide?: boolean;
  tiles?: { label: string; value: string; note?: string }[];
  bars?: { label: string; value: number; extra?: string }[];
  table?: { headers: { label: string; num?: boolean }[]; rows: Cell[][] };
  images?: { title: string; items: { label: string; src: string }[] }[];
  emptyText?: string;
}

export const IMPACTS = ['critical', 'serious', 'moderate', 'minor'] as const;
/** The deliberately inaccessible page: its violations are a reviewed baseline, not app defects. */
const DOCUMENTED_DEFECTS = '/a11y-defects.html';
const TIMINGS = ['ttfb', 'domContentLoaded', 'load'] as const;
const MAX_DIFF_SETS = 4;

/** Table cells are inserted as HTML by the template, so every value is escaped here. */
export function esc(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function a11ySummary(metrics: Metrics): {
  appScans: number;
  appViolations: number;
  documentedRules: number;
  byImpact: Record<string, number>;
} {
  const scans = metrics.tests.flatMap((t) => t.a11y);
  const app = scans.filter((s) => !s.url.includes(DOCUMENTED_DEFECTS));
  const documented = scans.filter((s) => s.url.includes(DOCUMENTED_DEFECTS));
  const byImpact: Record<string, number> = Object.fromEntries(IMPACTS.map((i) => [i, 0]));
  for (const v of app.flatMap((s) => s.violations)) {
    byImpact[v.impact] = (byImpact[v.impact] ?? 0) + 1;
  }
  return {
    appScans: app.length,
    appViolations: app.reduce((n, s) => n + s.violations.length, 0),
    documentedRules: new Set(documented.flatMap((s) => s.violations.map((v) => v.id))).size,
    byImpact,
  };
}

export function a11yExtra(metrics: Metrics): Extra {
  const summary = a11ySummary(metrics);
  const rows = metrics.tests.flatMap((t) =>
    t.a11y.map((s): Cell[] => [
      `<code>${esc(pathOf(s.url))}</code>${s.url.includes(DOCUMENTED_DEFECTS) ? ' (documented defects page)' : ''}`,
      esc(t.title),
      s.violations.length,
      s.violations.length ? esc([...new Set(s.violations.map((v) => v.id))].join(', ')) : '–',
    ]),
  );
  return {
    title: 'Accessibility',
    subtitle: 'axe-core, WCAG 2.1 A and AA, violations on the app pages by impact',
    tiles: [
      { label: 'App pages scanned', value: String(summary.appScans) },
      { label: 'Violations on app pages', value: String(summary.appViolations) },
      {
        label: 'Documented defects page',
        value: `${String(summary.documentedRules)} rules`,
        note: 'a reviewed baseline; the test fails if it changes',
      },
    ],
    bars: IMPACTS.map((i) => ({ label: i, value: summary.byImpact[i] ?? 0, extra: 'app pages' })),
    table: {
      headers: [
        { label: 'Page' },
        { label: 'Test' },
        { label: 'Violations', num: true },
        { label: 'Rules' },
      ],
      rows,
    },
  };
}

export function perfRows(metrics: Metrics): {
  path: string;
  timing: Record<string, number>;
  budget: Record<string, number | string>;
  within: boolean;
}[] {
  return metrics.tests
    .flatMap((t) => t.perf)
    .map((p) => ({
      ...p,
      within: TIMINGS.every((k) => (p.timing[k] ?? Infinity) < Number(p.budget[k] ?? Infinity)),
    }));
}

export function perfExtra(metrics: Metrics): Extra {
  const rows = perfRows(metrics);
  const cell = (r: (typeof rows)[number], k: (typeof TIMINGS)[number]): string =>
    `${String(Math.round(r.timing[k] ?? 0))} / ${String(r.budget[k] ?? '–')}`;
  return {
    title: 'Performance budgets',
    subtitle: 'Navigation Timing per page against its budget (ms, measured / budget)',
    tiles: [
      {
        label: 'Pages within budget',
        value: `${String(rows.filter((r) => r.within).length)} / ${String(rows.length)}`,
      },
    ],
    bars: rows.map((r) => ({
      label: r.path,
      value: Math.round(r.timing['load'] ?? 0),
      extra: `load budget ${String(r.budget['load'] ?? '–')} ms`,
    })),
    table: {
      headers: [
        { label: 'Page' },
        { label: 'TTFB', num: true },
        { label: 'DOMContentLoaded', num: true },
        { label: 'Load', num: true },
        { label: 'State' },
      ],
      rows: rows.map((r) => [
        `<code>${esc(r.path)}</code>`,
        cell(r, 'ttfb'),
        cell(r, 'domContentLoaded'),
        cell(r, 'load'),
        r.within ? 'within budget' : '<strong>over budget</strong>',
      ]),
    },
  };
}

/** `publish` copies one image (path relative to the run) into the site and returns its URL. */
export function visualExtra(metrics: Metrics, publish: (runPath: string) => string): Extra {
  const visualTests = metrics.tests.filter((t) => t.project === 'visual');
  const diffs = metrics.tests.flatMap((t) => t.visualDiffs.map((d) => ({ ...d, test: t.title })));
  const shown = diffs.slice(0, MAX_DIFF_SETS);
  const kinds = [
    ['expected', 'Expected (baseline)'],
    ['actual', 'Actual'],
    ['diff', 'Difference'],
  ] as const;
  return {
    title: 'Visual regression',
    wide: true,
    subtitle:
      diffs.length > shown.length
        ? `Screenshots that differ from their baselines (showing ${String(shown.length)} of ${String(diffs.length)}; all are in the run evidence)`
        : 'Screenshots compared with the committed baselines',
    tiles: [
      { label: 'Visual tests', value: String(visualTests.length) },
      { label: 'Screenshots that differ', value: String(diffs.length) },
    ],
    images: shown.map((d) => ({
      title: `${d.test} · ${d.name}`,
      items: kinds.flatMap(([kind, label]) => {
        const path = d[kind];
        return path ? [{ label, src: publish(path) }] : [];
      }),
    })),
    emptyText: 'Every screenshot matched its baseline.',
  };
}
