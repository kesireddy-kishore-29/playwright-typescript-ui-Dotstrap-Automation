/**
 * Evidence reporter. Playwright finalises video, trace and screenshots only after a test's
 * fixtures are torn down, so the copy into the shared evidence layout happens here, in a
 * reporter, where the final files exist:
 *
 *   run-evidence/<repo>/<run-id>/<suite>/<test-slug>/<attempt>/
 *     video.webm · screenshot.png · fullpage.png · trace.zip · console.log · network.har ·
 *     page-source.html · meta.json
 *
 * At the end of the run it writes run-summary.json and flaky-report.json (the same documents
 * every repository of the family produces), one failure bundle (folder + zip) per red test, and
 * metrics.json: the axe scans, navigation timings and visual differences the UI report shows.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import type { FullConfig, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { zipSync } from 'fflate';
import { env } from '../config/env';
import { stripAnsi } from '../support/ansi';
import { redactHar, redactText, redactTrace } from '../support/redact';
import { slugify } from '../support/slug';

export const REPO = 'playwright-typescript-ui-Dotstrap-Automation';

interface EvidenceMeta {
  outputDir?: string;
  featureIds?: string[];
  failingLocator?: string;
  consoleErrors?: string[];
  failedRequests?: string[];
  viewport?: { width: number; height: number } | null;
  notes?: string[];
}

interface A11yScan {
  url: string;
  violations: { id: string; impact: string; help: string; nodes: number }[];
}

interface PerfSample {
  path: string;
  timing: Record<string, number>;
  budget: Record<string, number | string>;
}

interface VisualDiff {
  name: string;
  expected?: string;
  actual?: string;
  diff?: string;
}

/** What one test measured, from its final attempt. */
interface TestMetrics {
  testId: string;
  title: string;
  project: string;
  status: string;
  a11y: A11yScan[];
  perf: PerfSample[];
  visualDiffs: VisualDiff[];
}

/** Playwright's screenshot-comparison attachments: <name>-expected|actual|diff.png. */
const COMPARISON = /^(.*)-(expected|actual|diff)\.png$/;

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

function gitSha(): string {
  if (process.env['GITHUB_SHA']) return process.env['GITHUB_SHA'];
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { timeout: 5_000 })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

function attemptStatus(result: TestResult): 'passed' | 'failed' | 'skipped' {
  if (result.status === 'passed') return 'passed';
  if (result.status === 'skipped') return 'skipped';
  return 'failed';
}

function toPosix(path: string): string {
  return path.split(sep).join('/');
}

export default class EvidenceReporter implements Reporter {
  private readonly runDir = join(env.EVIDENCE_ROOT, REPO, process.env['RUN_ID'] ?? env.RUN_ID);
  private readonly startedAt = new Date();
  private readonly attempts = new Map<string, TestRecord[]>();
  private readonly attemptDirs = new Map<string, string[]>();
  private readonly metrics = new Map<string, TestMetrics>();
  private testDir = 'tests';

  onBegin(config: FullConfig): void {
    this.testDir = config.projects[0]?.testDir ?? 'tests';
    mkdirSync(this.runDir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    try {
      this.record(test, result);
    } catch (error) {
      console.error(`[evidence] could not record ${test.title}: ${String(error)}`);
    }
  }

  private record(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name ?? 'default';
    const file = toPosix(relative(this.testDir, test.location.file));
    const suite = file.split('/')[0] ?? 'tests';
    const titles = test.titlePath().slice(3);
    const id = `${project} › ${file} › ${titles.join(' › ')}`;
    const slug = slugify(`${project} ${titles.join(' ')}`);
    const attempt = result.retry + 1;
    const status = attemptStatus(result);
    const metaAttachment = result.attachments.find((a) => a.name === 'evidence-meta');
    const meta: EvidenceMeta = metaAttachment?.body
      ? (JSON.parse(metaAttachment.body.toString()) as EvidenceMeta)
      : {};
    const record: TestRecord = {
      id,
      title: titles.join(' › '),
      suite,
      project,
      featureIds: test.annotations
        .filter((a) => a.type === 'feature')
        .map((a) => a.description ?? ''),
      tags: test.tags,
      status,
      durationMs: result.duration,
      attempt,
      quarantined: test.tags.includes('@quarantine'),
      startedAt: result.startTime.toISOString(),
      ...(result.error
        ? {
            error: {
              message: redactText(stripAnsi(result.error.message ?? String(result.error.value))),
              ...(result.error.stack ? { stack: redactText(stripAnsi(result.error.stack)) } : {}),
              ...(meta.failingLocator ? { failingLocator: meta.failingLocator } : {}),
            },
          }
        : {}),
    };

    const keep =
      env.RECORD_MODE === 'all' || (env.RECORD_MODE === 'failures' && status === 'failed');
    if (keep) {
      const dir = join(this.runDir, suite, slug, String(attempt));
      const files = this.copyArtifacts(result, meta, dir);
      writeFileSync(
        join(dir, 'meta.json'),
        JSON.stringify(
          {
            schemaVersion: 1,
            repo: REPO,
            runId: basename(this.runDir),
            gitSha: gitSha(),
            recordMode: env.RECORD_MODE,
            test: record,
            environment: {
              project,
              browser: test.parent.project()?.use.browserName ?? 'chromium',
              viewport: meta.viewport ?? null,
              baseURL: test.parent.project()?.use.baseURL ?? null,
              os: `${process.platform} ${process.arch}`,
              node: process.version,
            },
            consoleErrors: meta.consoleErrors ?? [],
            failedRequests: meta.failedRequests ?? [],
            notes: meta.notes ?? [],
          },
          null,
          2,
        ),
      );
      record.evidence = {
        dir: toPosix(relative(this.runDir, dir)),
        files: [...files, 'meta.json'],
      };
      this.attemptDirs.set(id, [...(this.attemptDirs.get(id) ?? []), dir]);
    }
    this.attempts.set(id, [...(this.attempts.get(id) ?? []), record]);
    this.collectMetrics(record, result, slug);
  }

  /** Keeps the final attempt's measurements: a later attempt replaces an earlier one. */
  private collectMetrics(record: TestRecord, result: TestResult, slug: string): void {
    const parse = <T>(name: string): T[] =>
      result.attachments
        .filter((a) => a.name === name && a.body)
        .map((a) => JSON.parse(a.body?.toString() ?? '{}') as T);
    const diffs = new Map<string, VisualDiff>();
    if (env.RECORD_MODE !== 'off') {
      for (const attachment of result.attachments) {
        const match = COMPARISON.exec(attachment.name);
        if (!match || !attachment.path || !existsSync(attachment.path)) continue;
        const [, name = 'screenshot', kind = 'actual'] = match;
        const dir = join(this.runDir, 'visual-diffs', slug);
        mkdirSync(dir, { recursive: true });
        copyFileSync(attachment.path, join(dir, attachment.name));
        const entry = diffs.get(name) ?? { name };
        entry[kind as 'expected' | 'actual' | 'diff'] = toPosix(
          relative(this.runDir, join(dir, attachment.name)),
        );
        diffs.set(name, entry);
      }
    }
    const a11y = parse<A11yScan>('axe-results.json');
    const perf = parse<PerfSample>('navigation-timing.json');
    if (a11y.length || perf.length || diffs.size || record.project === 'visual') {
      this.metrics.set(record.id, {
        testId: record.id,
        title: record.title,
        project: record.project,
        status: record.status,
        a11y,
        perf,
        visualDiffs: [...diffs.values()],
      });
    }
  }

  private copyArtifacts(result: TestResult, meta: EvidenceMeta, dir: string): string[] {
    mkdirSync(dir, { recursive: true });
    const written: string[] = [];
    const names: Record<string, string> = {
      video: 'video.webm',
      trace: 'trace.zip',
      screenshot: 'screenshot.png',
      'fullpage.png': 'fullpage.png',
      'console.log': 'console.log',
      'page-source.html': 'page-source.html',
    };
    for (const attachment of result.attachments) {
      const target = names[attachment.name];
      if (!target || written.includes(target)) continue;
      if (target === 'trace.zip' && attachment.path && existsSync(attachment.path)) {
        // Playwright writes traces with raw headers and cookies; never copy one unredacted.
        try {
          writeFileSync(join(dir, target), redactTrace(readFileSync(attachment.path)));
          written.push(target);
        } catch (error) {
          console.error(`[evidence] trace not kept (could not redact it): ${String(error)}`);
        }
      } else if (attachment.path && existsSync(attachment.path)) {
        copyFileSync(attachment.path, join(dir, target));
        written.push(target);
      } else if (attachment.body) {
        writeFileSync(join(dir, target), attachment.body);
        written.push(target);
      }
    }
    const har = meta.outputDir ? join(meta.outputDir, 'network.har') : undefined;
    if (har && existsSync(har)) {
      const parsed = JSON.parse(readFileSync(har, 'utf8')) as Parameters<typeof redactHar>[0];
      writeFileSync(join(dir, 'network.har'), JSON.stringify(redactHar(parsed), null, 2));
      written.push('network.har');
    }
    return written;
  }

  onEnd(): void {
    const finals: TestRecord[] = [];
    for (const records of this.attempts.values()) {
      const last = records[records.length - 1];
      if (!last) continue;
      const flaky = last.status === 'passed' && records.some((r) => r.status === 'failed');
      finals.push(flaky ? { ...last, status: 'flaky' } : last);
    }
    finals.sort((a, b) => a.id.localeCompare(b.id));
    const count = (status: TestRecord['status']): number =>
      finals.filter((t) => t.status === status).length;
    const finishedAt = new Date();
    const summary = {
      schemaVersion: 1,
      repo: REPO,
      runId: basename(this.runDir),
      gitSha: gitSha(),
      recordMode: env.RECORD_MODE,
      startedAt: this.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - this.startedAt.getTime(),
      environment: { os: `${process.platform} ${process.arch}`, node: process.version },
      totals: {
        total: finals.length,
        passed: count('passed'),
        failed: count('failed'),
        skipped: count('skipped'),
        flaky: count('flaky'),
        quarantined: finals.filter((t) => t.quarantined).length,
      },
      tests: finals,
    };
    writeFileSync(join(this.runDir, 'run-summary.json'), JSON.stringify(summary, null, 2));
    writeFileSync(
      join(this.runDir, 'flaky-report.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          repo: REPO,
          runId: basename(this.runDir),
          generatedAt: finishedAt.toISOString(),
          flaky: finals
            .filter((t) => t.status === 'flaky')
            .map((t) => ({
              testId: t.id,
              title: t.title,
              featureIds: t.featureIds,
              attempts: t.attempt,
              firstError:
                this.attempts
                  .get(t.id)
                  ?.find((r) => r.error)
                  ?.error?.message.split('\n')[0] ?? '',
            })),
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(this.runDir, 'metrics.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          repo: REPO,
          runId: basename(this.runDir),
          tests: [...this.metrics.values()].sort((a, b) => a.testId.localeCompare(b.testId)),
        },
        null,
        2,
      ),
    );
    if (env.RECORD_MODE !== 'off') {
      for (const test of finals.filter((t) => t.status === 'failed')) {
        this.bundle(test);
      }
    }
  }

  private bundle(test: TestRecord): void {
    const slug = test.evidence?.dir.split('/')[1] ?? slugify(test.title);
    const bundleDir = join(this.runDir, 'failure-bundles', slug);
    mkdirSync(bundleDir, { recursive: true });
    for (const attemptDir of this.attemptDirs.get(test.id) ?? []) {
      const target = join(bundleDir, `attempt-${basename(attemptDir)}`);
      mkdirSync(target, { recursive: true });
      for (const file of readdirSync(attemptDir)) {
        copyFileSync(join(attemptDir, file), join(target, file));
      }
    }
    writeFileSync(join(bundleDir, 'README.md'), bundleReadme(test, basename(this.runDir)));
    writeZip(bundleDir, join(dirname(bundleDir), `${slug}.zip`));
  }
}

export function writeZip(sourceDir: string, zipFile: string): void {
  const entries: Record<string, Uint8Array> = {};
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else entries[toPosix(relative(sourceDir, full))] = readFileSync(full);
    }
  };
  walk(sourceDir);
  writeFileSync(zipFile, zipSync(entries, { level: 6 }));
}

function bundleReadme(test: TestRecord, runId: string): string {
  return `# Failure bundle: ${test.title}

| | |
|---|---|
| Test | \`${test.id}\` |
| Features | ${test.featureIds.join(', ')} |
| Run | \`${runId}\` |
| Attempts | ${String(test.attempt)} |
| Failing locator | ${test.error?.failingLocator ? `\`${test.error.failingLocator}\`` : '(none reported)'} |

## What is in here

| File | What it is | How to open |
|---|---|---|
| \`attempt-N/video.webm\` | The browser session, start to end | Any browser or video player |
| \`attempt-N/trace.zip\` | DOM snapshots, network, console and source per step | \`npx playwright show-trace attempt-N/trace.zip\` or https://trace.playwright.dev |
| \`attempt-N/screenshot.png\` | The viewport at the moment of failure | An image viewer |
| \`attempt-N/fullpage.png\` | The whole page at the moment of failure | An image viewer |
| \`attempt-N/page-source.html\` | The DOM at failure (redacted) | A browser or editor |
| \`attempt-N/console.log\` | Browser console and failed requests (redacted) | A text editor |
| \`attempt-N/network.har\` | Requests and responses, headers only, secrets masked | Chrome DevTools → Network → Import HAR |
| \`attempt-N/meta.json\` | Test identity, features, viewport, environment, git SHA | A JSON viewer |
| \`triage.json\` | Failure category and suggested next action (added by triage) | A JSON viewer |
| \`failure-report.md\` | One-page summary for a person (added by triage) | A Markdown viewer |

## Error

\`\`\`text
${test.error?.message ?? '(no error message)'}
\`\`\`
`;
}
