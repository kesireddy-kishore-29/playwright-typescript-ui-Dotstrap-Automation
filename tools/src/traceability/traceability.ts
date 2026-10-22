import type { Args } from '../shared/args';
import { arg } from '../shared/args';
import { readJson, writeJson, writeText } from '../shared/json';
import { listTests, type ListedTest } from '../shared/playwright-list';

export interface FeatureCatalog {
  features: { id: string; requirement: string }[];
}

export interface MatrixRow {
  id: string;
  requirement: string;
  tests: number;
  projects: string[];
}

const FEATURE_ID = /^FEAT-[A-Z0-9]+-\d{2}$/;

export function untraced(tests: ListedTest[]): string[] {
  return tests
    .filter((t) => t.features.length === 0 || t.features.some((f) => !FEATURE_ID.test(f)))
    .map((t) => `${t.file} › ${t.titlePath.join(' › ')}`);
}

export function matrix(catalog: FeatureCatalog, tests: ListedTest[]): MatrixRow[] {
  return catalog.features.map((f) => {
    const covering = tests.filter((t) => t.features.includes(f.id));
    return {
      id: f.id,
      requirement: f.requirement,
      tests: covering.length,
      projects: [...new Set(covering.flatMap((t) => t.projects))].sort(),
    };
  });
}

export function matrixMarkdown(rows: MatrixRow[]): string {
  const lines = ['| Feature | Requirement | Tests | Projects |', '|---|---|---|---|'];
  for (const r of rows) {
    lines.push(
      `| ${r.id} | ${r.requirement} | ${r.tests > 0 ? String(r.tests) : '**0**'} | ${r.projects.join(', ')} |`,
    );
  }
  return lines.join('\n');
}

/** `qa traceability`: fail when a test has no feature ID; write the coverage matrix. */
export function traceabilityCommand(args: Args, log: (line: string) => void): number {
  const tests = listTests();
  const missing = untraced(tests);
  const catalog = readJson(arg(args, 'catalog', 'features.json')) as FeatureCatalog;
  const rows = matrix(catalog, tests);
  const out = arg(args, 'out', 'reports/traceability');
  // A test that runs in several projects (chromium and mobile) is one test and several runs.
  const runs = tests.reduce((sum, t) => sum + t.projects.length, 0);
  writeJson(`${out}/matrix.json`, { tests: tests.length, runs, untraced: missing, rows });
  writeText(`${out}/matrix.md`, `${matrixMarkdown(rows)}\n`);
  log(
    `${String(tests.length)} tests (${String(runs)} runs across projects), ${String(rows.filter((r) => r.tests > 0).length)}/${String(rows.length)} features covered`,
  );
  missing.forEach((m) => {
    log(`  - no feature ID: ${m}`);
  });
  return missing.length === 0 ? 0 : 1;
}
