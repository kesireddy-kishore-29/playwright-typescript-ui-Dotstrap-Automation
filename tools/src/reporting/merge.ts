import { cpSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Args } from '../shared/args';
import { arg } from '../shared/args';
import { readJson, writeJson } from '../shared/json';
import type { TestRecord } from '../shared/run';
import type { TestMetrics } from './ui-extras';

interface SummaryDoc {
  repo: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totals: Record<string, number>;
  tests: TestRecord[];
  [key: string]: unknown;
}

/** Run documents that are combined rather than copied. */
const COMBINED = new Set(['run-summary.json', 'flaky-report.json', 'metrics.json']);

/** When a test ran in several shards (the setup project runs in each), its worst result counts. */
const SEVERITY: Record<TestRecord['status'], number> = {
  failed: 0,
  flaky: 1,
  passed: 2,
  skipped: 3,
};

/**
 * One summary for all shards: each test listed once (a test that ran in several shards keeps its
 * worst result), totals counted from that list, and the wall-clock span from the first shard's
 * start to the last shard's finish.
 */
export function mergeSummaries(summaries: SummaryDoc[]): SummaryDoc {
  const first = summaries[0];
  if (!first) throw new Error('No summaries to merge');
  const byId = new Map<string, TestRecord>();
  for (const test of summaries.flatMap((s) => s.tests)) {
    const seen = byId.get(test.id);
    if (!seen || SEVERITY[test.status] < SEVERITY[seen.status]) byId.set(test.id, test);
  }
  const tests = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const count = (status: TestRecord['status']): number =>
    tests.filter((t) => t.status === status).length;
  const totals = {
    total: tests.length,
    passed: count('passed'),
    failed: count('failed'),
    skipped: count('skipped'),
    flaky: count('flaky'),
    quarantined: tests.filter((t) => t.quarantined).length,
  };
  const startedAt = summaries.map((s) => s.startedAt).sort()[0] ?? first.startedAt;
  const finishedAt =
    summaries
      .map((s) => s.finishedAt)
      .sort()
      .at(-1) ?? first.finishedAt;
  return {
    ...first,
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    totals,
    tests,
    shards: summaries.length,
  };
}

export function findRuns(from: string, depth = 6): string[] {
  if (!existsSync(from) || depth < 0) return [];
  if (existsSync(join(from, 'run-summary.json'))) return [from];
  return readdirSync(from, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => findRuns(join(from, d.name), depth - 1))
    .sort();
}

/**
 * `qa merge --from <dir> --into <dir>`: combines the run folders of Playwright shards into one run,
 * so triage, reports and history see a single run. Evidence folders are copied as they are.
 */
export function mergeCommand(args: Args, log: (line: string) => void): number {
  const from = arg(args, 'from', 'shards');
  const into = args.get('into');
  if (!into) throw new Error('--into <run dir> is required');
  const runs = findRuns(from);
  if (runs.length === 0) {
    log(`No run-summary.json under ${from}; nothing to merge.`);
    return 1;
  }
  for (const run of runs) {
    cpSync(run, into, {
      recursive: true,
      filter: (source) => !COMBINED.has(source.slice(run.length + 1)),
    });
  }
  const summary = mergeSummaries(
    runs.map((r) => readJson(join(r, 'run-summary.json')) as SummaryDoc),
  );
  writeJson(join(into, 'run-summary.json'), summary);
  const optional = <T>(run: string, file: string, pick: (doc: Record<string, T[]>) => T[]): T[] =>
    existsSync(join(run, file)) ? pick(readJson(join(run, file)) as Record<string, T[]>) : [];
  writeJson(join(into, 'flaky-report.json'), {
    schemaVersion: 1,
    repo: summary.repo,
    runId: summary.runId,
    generatedAt: new Date().toISOString(),
    flaky: runs.flatMap((r) => optional<unknown>(r, 'flaky-report.json', (d) => d['flaky'] ?? [])),
  });
  writeJson(join(into, 'metrics.json'), {
    schemaVersion: 1,
    repo: summary.repo,
    runId: summary.runId,
    tests: runs.flatMap((r) => optional<TestMetrics>(r, 'metrics.json', (d) => d['tests'] ?? [])),
  });
  log(
    `Merged ${String(runs.length)} shard run(s), ${String(summary.tests.length)} tests, into ${into}`,
  );
  return 0;
}
