import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import type { Args } from '../shared/args';
import { arg } from '../shared/args';
import { readJson, writeJson, writeText } from '../shared/json';
import { listTests } from '../shared/playwright-list';
import { readRun, resolveRunDir, type RunSummary } from '../shared/run';
import { readLog } from '../healing/ledger';
import { countsSince, type FlakyHistory } from '../quarantine/flaky-history';
import { readQuarantine, today } from '../quarantine/quarantine';
import { matrix, type FeatureCatalog } from '../traceability/traceability';
import { CATEGORIES, CATEGORY_NAMES } from '../triage/categories';
import { pointOf, readHistory, withPoint, type History } from './history';
import { render } from './templates';
import {
  a11yExtra,
  a11ySummary,
  perfExtra,
  perfRows,
  visualExtra,
  type Extra,
  type Metrics,
} from './ui-extras';

interface TriageSummary {
  byCategory: Record<string, number>;
  aiStep: string;
}

const toPosix = (path: string): string => path.split(sep).join('/');

/** Nearest-rank percentile; the same definition as the Java repository. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? 0;
}

export function parseLinks(spec: string): { label: string; href: string }[] {
  return spec
    .split(',')
    .map((pair) => pair.split('='))
    .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0]?.trim()))
    .map(([label, href]) => ({ label: label.trim(), href: href.trim() }));
}

function readMetrics(runDir: string): Metrics {
  const file = join(runDir, 'metrics.json');
  return existsSync(file) ? (readJson(file) as Metrics) : { tests: [] };
}

function readTriage(runDir: string): TriageSummary | undefined {
  const file = join(runDir, 'triage-summary.json');
  return existsSync(file) ? (readJson(file) as TriageSummary) : undefined;
}

function healing(file: string): {
  entries: unknown[];
  summary: Record<string, number | null>;
} {
  const entries = readLog(file).entries;
  const proposed = entries.filter((e) => e.outcome === 'proposed').length;
  const merged = entries.filter((e) => e.outcome === 'merged').length;
  const minutes = entries.map((e) => e.timeToFixMinutes);
  return {
    entries,
    summary: {
      proposed,
      merged,
      refused: entries.length - proposed - merged,
      medianMinutes: minutes.length ? percentile(minutes, 50) : null,
    },
  };
}

function dashboardData(
  args: Args,
  run: RunSummary,
  history: History,
  runDir: string,
  extras: Extra[],
): Record<string, unknown> {
  const flakyFile = arg(args, 'flaky-history', 'flaky-history.json');
  const flaky: FlakyHistory = existsSync(flakyFile)
    ? (readJson(flakyFile) as FlakyHistory)
    : { schemaVersion: 1, occurrences: [] };
  const triage = readTriage(runDir);
  const date = today();
  const catalogFile = arg(args, 'features', 'features.json');
  return {
    repo: run.repo,
    generatedAt: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    run: { runId: run.runId, gitSha: run.gitSha, durationMs: run.durationMs, totals: run.totals },
    history: history.runs,
    slowest: [...run.tests]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10)
      .map((t) => ({
        title: t.title,
        suite: `${t.suite} · ${t.project}`,
        durationMs: t.durationMs,
      })),
    flakiest: [...countsSince(flaky, date, 30).entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([testId, count]) => ({ testId, title: testId.split(' › ').pop() ?? testId, count })),
    triage: {
      byCategory:
        triage?.byCategory ?? Object.fromEntries(CATEGORY_NAMES.map((c) => [c, 0] as const)),
      ...(triage ? { aiStep: triage.aiStep } : {}),
      healable: CATEGORY_NAMES.filter((c) => CATEGORIES[c].healable),
    },
    healing: healing(arg(args, 'healing-log', 'healing-log.json')),
    quarantine: readQuarantine(arg(args, 'quarantine', 'quarantine.json')).entries.map((e) => ({
      testId: e.testId,
      owner: e.owner,
      expires: e.expires,
      reason: e.reason,
      expired: e.expires < date,
    })),
    // Counted from the test list, so a feature covered by a project that did not run here still
    // shows as covered.
    coverage: existsSync(catalogFile)
      ? matrix(readJson(catalogFile) as FeatureCatalog, listTests()).map((r) => ({
          id: r.id,
          requirement: r.requirement,
          tests: r.tests,
        }))
      : [],
    links: parseLinks(arg(args, 'links', '')),
    extras,
  };
}

/** The gallery lists every test; attempts come from the evidence folders the run kept. */
export function galleryData(run: RunSummary, runDir: string, recordMode: string): unknown {
  return {
    repo: run.repo,
    runId: run.runId,
    recordMode,
    base: '',
    tests: run.tests.map((t) => {
      const testDir = t.evidence ? dirname(join(runDir, t.evidence.dir)) : undefined;
      const attempts =
        testDir && existsSync(testDir)
          ? readdirSync(testDir, { withFileTypes: true })
              .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
              .sort((a, b) => Number(a.name) - Number(b.name))
              .map((d) => {
                const dir = join(testDir, d.name);
                const meta = readJson(join(dir, 'meta.json')) as { test: { status: string } };
                return {
                  attempt: Number(d.name),
                  status: meta.test.status,
                  dir: toPosix(relative(runDir, dir)),
                  files: readdirSync(dir).sort(),
                };
              })
          : [];
      return {
        title: t.title,
        suite: t.suite,
        project: t.project,
        status: t.status,
        durationMs: t.durationMs,
        featureIds: t.featureIds,
        attempts,
      };
    }),
  };
}

export function stepSummary(
  run: RunSummary,
  triage: TriageSummary | undefined,
  metrics: Metrics,
  reportUrl: string,
): string {
  const t = (key: string): number => run.totals[key] ?? 0;
  const lines = [
    `## ${run.repo} · \`${run.runId}\``,
    '',
    '| Total | Passed | Failed | Flaky | Skipped | Quarantined | Duration |',
    '|---|---|---|---|---|---|---|',
    `| ${[t('total'), t('passed'), t('failed'), t('flaky'), t('skipped'), t('quarantined')].join(' | ')} | ${(run.durationMs / 1000).toFixed(1)} s |`,
    '',
  ];
  if (triage) {
    const cats = CATEGORY_NAMES.filter((c) => (triage.byCategory[c] ?? 0) > 0)
      .map((c) => `${c} ${String(triage.byCategory[c])}`)
      .join(' · ');
    lines.push(`**Failures by category:** ${cats || 'none'}`, '');
  }
  const failed = run.tests.filter((x) => x.status === 'failed');
  if (failed.length) {
    lines.push(`<details><summary>${String(failed.length)} failed test(s)</summary>`, '');
    for (const f of failed) {
      const first = (f.error?.message ?? '').trim().split('\n')[0] ?? '';
      lines.push(`- \`${f.id}\`: ${first.length > 160 ? `${first.slice(0, 160)}…` : first}`);
    }
    lines.push('', '</details>', '');
  }
  const a11y = a11ySummary(metrics);
  const perf = perfRows(metrics);
  const visualTests = metrics.tests.filter((m) => m.project === 'visual').length;
  const diffs = metrics.tests.reduce((n, m) => n + m.visualDiffs.length, 0);
  const parts = [
    a11y.appScans
      ? `**Accessibility:** ${String(a11y.appViolations)} violation(s) on ${String(a11y.appScans)} app page scan(s)`
      : '',
    perf.length
      ? `**Performance:** ${String(perf.filter((p) => p.within).length)}/${String(perf.length)} pages within budget`
      : '',
    visualTests
      ? `**Visual:** ${String(diffs)} screenshot(s) differ in ${String(visualTests)} visual test(s)`
      : '',
  ].filter(Boolean);
  if (parts.length) lines.push(parts.join(' · '), '');
  if (reportUrl) lines.push(`[Dashboard](${reportUrl}) · [Allure](${reportUrl}allure/)`, '');
  return `${lines.join('\n')}\n`;
}

/**
 * `qa report --run <dir> --out <dir>`: the layered reports of one run. Writes the health
 * dashboard (index.html), the updated history.json, the run gallery, the step summary (also the
 * PR comment) and the UI sections: accessibility, performance budgets and visual differences.
 */
export function reportCommand(args: Args, log: (line: string) => void): number {
  const runDir = resolveRunDir(args);
  const outDir = arg(args, 'out', 'reports/site');
  const run = readRun(runDir);
  const historyFile = arg(args, 'history', join(outDir, 'data', 'history.json'));
  const history = withPoint(readHistory(historyFile), pointOf(run));
  writeJson(historyFile, history);

  const metrics = readMetrics(runDir);
  const publish = (runPath: string): string => {
    const target = join(outDir, 'runs', run.runId, runPath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(runDir, runPath), target);
    return toPosix(relative(outDir, target));
  };
  // A section appears only when its suite ran: zeros from a suite that did not run would read
  // as a result.
  const extras = [
    ...(metrics.tests.some((t) => t.a11y.length) ? [a11yExtra(metrics)] : []),
    ...(metrics.tests.some((t) => t.perf.length) ? [perfExtra(metrics)] : []),
    ...(metrics.tests.some((t) => t.project === 'visual') ? [visualExtra(metrics, publish)] : []),
  ];
  writeText(
    join(outDir, 'index.html'),
    render('dashboard.html', dashboardData(args, run, history, runDir, extras)),
  );
  const recordMode = (readJson(join(runDir, 'run-summary.json')) as { recordMode?: string })
    .recordMode;
  writeText(
    join(runDir, 'gallery.html'),
    render('gallery.html', galleryData(run, runDir, recordMode ?? 'failures')),
  );
  const summary = stepSummary(run, readTriage(runDir), metrics, arg(args, 'report-url', ''));
  writeText(join(outDir, 'summary.md'), summary);
  const githubSummary = process.env['GITHUB_STEP_SUMMARY'];
  if (githubSummary) appendFileSync(githubSummary, summary);
  log(`Dashboard: ${join(outDir, 'index.html')}`);
  log(`Gallery:   ${join(runDir, 'gallery.html')}`);
  log(`Summary:   ${join(outDir, 'summary.md')}`);
  return 0;
}
