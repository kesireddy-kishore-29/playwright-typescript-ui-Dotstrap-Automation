import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Args } from '../shared/args';
import { arg } from '../shared/args';
import { readJson, writeJson } from '../shared/json';
import { resolveRunDir } from '../shared/run';
import { readQuarantine, today, type QuarantineEntry } from './quarantine';

export interface Occurrence {
  date: string;
  runId: string;
  testId: string;
  title: string;
}
export interface FlakyHistory {
  schemaVersion: 1;
  occurrences: Occurrence[];
}

export const KEEP_DAYS = 30;
export const THRESHOLD = 3;
export const WINDOW_DAYS = 14;

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function record(history: FlakyHistory, added: Occurrence[], on: string): FlakyHistory {
  const kept = history.occurrences.filter((o) => o.date >= daysBefore(on, KEEP_DAYS));
  for (const o of added) {
    if (!kept.some((k) => k.runId === o.runId && k.testId === o.testId)) kept.push(o);
  }
  return { schemaVersion: 1, occurrences: kept };
}

export function countsSince(history: FlakyHistory, on: string, days: number): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of history.occurrences) {
    if (o.date >= daysBefore(on, days)) counts.set(o.testId, (counts.get(o.testId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Adds '@quarantine' to the tags of the test whose title (string or template literal start)
 * matches. Proposal only: the result goes into a pull request a person reviews.
 */
export function addQuarantineTag(source: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const call = new RegExp(`test\\(\\s*['\`]${escaped}`);
  const match = call.exec(source);
  if (!match) throw new Error(`No test titled "${title}"`);
  const optionsStart = source.indexOf('{', match.index);
  const tagIndex = source.indexOf('tag: [', match.index);
  const bodyStart = source.indexOf('async', match.index);
  if (tagIndex > 0 && tagIndex < bodyStart) {
    if (source.slice(tagIndex, source.indexOf(']', tagIndex)).includes("'@quarantine'"))
      return source;
    return `${source.slice(0, tagIndex + 6)}'@quarantine', ${source.slice(tagIndex + 6)}`;
  }
  return `${source.slice(0, optionsStart + 1)} tag: ['@quarantine'],${source.slice(optionsStart + 1)}`;
}

/**
 * The owner of a proposed quarantine: `--owner`, else the repository owner GitHub Actions provides
 * (`GITHUB_REPOSITORY_OWNER`), else none. No person is ever assumed.
 */
export function proposalOwner(
  explicit: string | undefined,
  repositoryOwner: string | undefined,
): string | undefined {
  if (explicit?.trim()) return explicit;
  const owner = repositoryOwner?.trim();
  if (!owner) return undefined;
  return owner.startsWith('@') ? owner : `@${owner}`;
}

/**
 * `qa flaky-history [--run <dir>] [--propose | --propose-only] [--owner <@handle>]`.
 * `--propose-only` reads the history without recording a run (the nightly records first, then
 * proposes in a later job). The owner of a proposal is `--owner` or, in GitHub Actions, the
 * repository owner.
 */
export function flakyHistoryCommand(args: Args, log: (line: string) => void): number {
  const on = arg(args, 'today', today());
  const historyFile = arg(args, 'history', 'flaky-history.json');
  let history: FlakyHistory;
  try {
    history = readJson(historyFile) as FlakyHistory;
  } catch {
    history = { schemaVersion: 1, occurrences: [] };
  }
  const proposeOnly = args.get('propose-only') === 'true';
  if (!proposeOnly) {
    const runDir = resolveRunDir(args);
    const report = readJson(join(runDir, 'flaky-report.json')) as {
      runId: string;
      flaky: { testId: string; title: string }[];
    };
    history = record(
      history,
      report.flaky.map((f) => ({
        date: on,
        runId: report.runId,
        testId: f.testId,
        title: f.title,
      })),
      on,
    );
    writeJson(historyFile, history);
    log(`Recorded ${String(report.flaky.length)} flaky test(s) from ${report.runId}`);
  }
  if (args.get('propose') !== 'true' && !proposeOnly) return 0;

  const quarantineFile = arg(args, 'quarantine', 'quarantine.json');
  const quarantine = readQuarantine(quarantineFile);
  const proposals: QuarantineEntry[] = [];
  for (const [testId, count] of countsSince(history, on, WINDOW_DAYS)) {
    if (count < THRESHOLD || quarantine.entries.some((e) => e.testId === testId)) continue;
    // testId from the reporter: "<project> › <file> › <titles>"; quarantine IDs drop the project.
    const [, file, ...titles] = testId.split(' › ');
    const title = titles[titles.length - 1] ?? '';
    if (!file) continue;
    const owner = proposalOwner(args.get('owner'), process.env['GITHUB_REPOSITORY_OWNER']);
    if (!owner) {
      log(
        'flaky-history: --owner is required to propose a quarantine' +
          ' (in GitHub Actions it defaults to the repository owner)',
      );
      return 2;
    }
    const path = join('tests', file);
    writeFileSync(path, addQuarantineTag(readFileSync(path, 'utf8'), title));
    proposals.push({
      testId: `${file} › ${titles.join(' › ')}`,
      title,
      owner,
      reason: `Flaky ${String(count)} times in ${String(WINDOW_DAYS)} days (auto-proposed)`,
      expires: daysBefore(on, -WINDOW_DAYS),
      issue: '',
    });
  }
  if (proposals.length > 0)
    writeJson(quarantineFile, { schemaVersion: 1, entries: [...quarantine.entries, ...proposals] });
  log(`Quarantine proposals: ${String(proposals.length)}`);
  return 0;
}
