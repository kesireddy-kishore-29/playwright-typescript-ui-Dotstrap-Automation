import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Args } from './args';
import { readJson } from './json';

export const REPO = 'playwright-typescript-ui-Dotstrap-Automation';

/** One test in run-summary.json (the format shared by every repository of the family). */
export interface TestRecord {
  id: string;
  title: string;
  suite: string;
  project: string;
  featureIds: string[];
  tags: string[];
  status: 'passed' | 'failed' | 'skipped' | 'flaky';
  durationMs: number;
  attempt: number;
  quarantined: boolean;
  startedAt: string;
  error?: { message: string; stack?: string; failingLocator?: string };
  evidence?: { dir: string; files: string[] };
}

export interface RunSummary {
  repo: string;
  runId: string;
  gitSha: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totals: Record<string, number>;
  tests: TestRecord[];
}

export function readRun(runDir: string): RunSummary {
  return readJson(join(runDir, 'run-summary.json')) as RunSummary;
}

/** The run named by --run, else the most recently written run under the evidence root. */
export function resolveRunDir(args: Args): string {
  const explicit = args.get('run');
  if (explicit) return explicit;
  const repoDir = join(args.get('evidence-root') ?? 'run-evidence', REPO);
  const runs = readdirSync(repoDir)
    .map((name) => join(repoDir, name))
    .filter((dir) => existsSync(join(dir, 'run-summary.json')))
    .sort(
      (a, b) =>
        statSync(join(b, 'run-summary.json')).mtimeMs -
        statSync(join(a, 'run-summary.json')).mtimeMs,
    );
  const latest = runs[0];
  if (!latest) throw new Error(`No run with a run-summary.json in ${repoDir}`);
  return latest;
}

/** The folder name a failure bundle uses for this test: <suite>/<slug>/<attempt>. */
export function slugOf(test: TestRecord): string {
  return test.evidence?.dir.split('/')[1] ?? test.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
