import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeZip } from '../../../src/evidence/reporter';
import { AnthropicProvider } from '../ai/anthropic';
import type { AiProvider } from '../ai/provider';
import type { Args } from '../shared/args';
import { writeJson, writeText } from '../shared/json';
import { readRun, resolveRunDir, slugOf, type RunSummary, type TestRecord } from '../shared/run';
import { aiStatus, refine } from './ai-triage';
import { CATEGORIES, CATEGORY_NAMES, type Category } from './categories';
import { classify } from './classifier';
import { renderFailureReport } from './report';

export interface TriageRecord {
  schemaVersion: 1;
  repo: string;
  runId: string;
  testId: string;
  title: string;
  suite: string;
  project: string;
  featureIds: string[];
  category: Category;
  confidence: number;
  classifiedBy: 'rules' | 'llm';
  rule: string;
  reason: string;
  healable: boolean;
  needsHumanDecision: boolean;
  nextAction: string;
  error: { message: string };
  failingLocator?: string;
  evidence: Record<string, string>;
  gitDiff: string;
  retryHistory: { attempt: number; status: string }[];
  aiStep: string;
}

function gitDiff(): string {
  try {
    return execFileSync('git', ['log', '-1', '--stat', '--format=%h %s'], { timeout: 10_000 })
      .toString()
      .trim();
  } catch {
    return '(git unavailable)';
  }
}

function retryHistory(runDir: string, test: TestRecord): { attempt: number; status: string }[] {
  if (!test.evidence) return [];
  const testDir = join(runDir, test.evidence.dir, '..');
  return readdirSync(testDir)
    .filter((name) => existsSync(join(testDir, name, 'meta.json')))
    .map((name) => {
      const meta = JSON.parse(readFileSync(join(testDir, name, 'meta.json'), 'utf8')) as {
        test: { status: string };
      };
      return { attempt: Number(name), status: meta.test.status };
    })
    .sort((a, b) => a.attempt - b.attempt);
}

export async function triageTest(
  runDir: string,
  run: RunSummary,
  test: TestRecord,
  provider: AiProvider | undefined,
  diff: string,
): Promise<TriageRecord> {
  const dir = test.evidence ? join(runDir, test.evidence.dir) : undefined;
  const pageSourceFile = dir ? join(dir, 'page-source.html') : undefined;
  const input = {
    project: test.project,
    message: test.error?.message ?? '',
    ...(test.error?.failingLocator ? { failingLocator: test.error.failingLocator } : {}),
    ...(pageSourceFile && existsSync(pageSourceFile)
      ? { pageSource: readFileSync(pageSourceFile, 'utf8') }
      : {}),
  };
  const classification = await refine(classify(input), input, provider);
  const files = test.evidence?.files ?? [];
  const evidence: Record<string, string> = {};
  for (const file of [
    'video.webm',
    'trace.zip',
    'screenshot.png',
    'fullpage.png',
    'page-source.html',
    'console.log',
    'network.har',
  ]) {
    if (test.evidence && files.includes(file))
      evidence[file.split('.')[0] ?? file] = `${test.evidence.dir}/${file}`;
  }
  evidence['bundle'] = `failure-bundles/${slugOf(test)}/`;
  evidence['bundleZip'] = `failure-bundles/${slugOf(test)}.zip`;
  return {
    schemaVersion: 1,
    repo: run.repo,
    runId: run.runId,
    testId: test.id,
    title: test.title,
    suite: test.suite,
    project: test.project,
    featureIds: test.featureIds,
    category: classification.category,
    confidence: classification.confidence,
    classifiedBy: classification.classifiedBy,
    rule: classification.rule,
    reason: classification.reason,
    healable: CATEGORIES[classification.category].healable,
    needsHumanDecision: CATEGORIES[classification.category].needsHumanDecision,
    nextAction: CATEGORIES[classification.category].nextAction,
    error: { message: test.error?.message ?? '' },
    ...(test.error?.failingLocator ? { failingLocator: test.error.failingLocator } : {}),
    evidence,
    gitDiff: diff,
    retryHistory: retryHistory(runDir, test),
    aiStep: aiStatus(provider),
  };
}

/** `qa triage [--run <dir>]`: classify every failed test, write triage files, enrich bundles. */
export async function triageCommand(args: Args, log: (line: string) => void): Promise<number> {
  const runDir = resolveRunDir(args);
  const run = readRun(runDir);
  const provider = AnthropicProvider.fromEnvironment(process.env);
  const diff = gitDiff();
  const counts = Object.fromEntries(CATEGORY_NAMES.map((c) => [c, 0])) as Record<Category, number>;
  const failed = run.tests.filter((t) => t.status === 'failed');
  for (const test of failed) {
    const record = await triageTest(runDir, run, test, provider, diff);
    counts[record.category] += 1;
    const slug = slugOf(test);
    writeJson(join(runDir, 'triage', `${slug}.json`), record);
    const bundle = join(runDir, 'failure-bundles', slug);
    if (existsSync(bundle)) {
      writeJson(join(bundle, 'triage.json'), record);
      writeText(join(bundle, 'failure-report.md'), renderFailureReport(record));
      writeZip(bundle, join(runDir, 'failure-bundles', `${slug}.zip`));
    }
    log(`${record.category.padEnd(15)} ${test.id}`);
  }
  writeJson(join(runDir, 'triage-summary.json'), {
    schemaVersion: 1,
    repo: run.repo,
    runId: run.runId,
    failed: failed.length,
    byCategory: counts,
    aiStep: aiStatus(provider),
  });
  log(`Triaged ${String(failed.length)} failure(s) in ${runDir}; AI step: ${aiStatus(provider)}`);
  return 0;
}
