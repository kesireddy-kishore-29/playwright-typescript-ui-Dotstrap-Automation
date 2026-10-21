import { existsSync } from 'node:fs';
import type { Args } from '../shared/args';
import { arg } from '../shared/args';
import { readJson } from '../shared/json';
import { listTests, quarantineId } from '../shared/playwright-list';

export interface QuarantineEntry {
  testId: string;
  title: string;
  owner: string;
  reason: string;
  expires: string;
  issue: string;
}
export interface QuarantineFile {
  schemaVersion: 1;
  entries: QuarantineEntry[];
}

export function readQuarantine(file: string): QuarantineFile {
  return existsSync(file) ? (readJson(file) as QuarantineFile) : { schemaVersion: 1, entries: [] };
}

/** Problems with the quarantine: expired, ownerless, unmatched, or tagged without an entry. */
export function checkQuarantine(
  entries: QuarantineEntry[],
  tagged: string[],
  today: string,
): string[] {
  const problems: string[] = [];
  for (const entry of entries) {
    if (!entry.owner.trim()) problems.push(`${entry.testId}: no owner`);
    if (!entry.reason.trim()) problems.push(`${entry.testId}: no reason`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) {
      problems.push(`${entry.testId}: expires must be YYYY-MM-DD, was '${entry.expires}'`);
    } else if (entry.expires < today) {
      problems.push(
        `${entry.testId}: expired on ${entry.expires} (fix the test or renew with a reason)`,
      );
    }
    if (!tagged.includes(entry.testId)) {
      problems.push(
        `${entry.testId}: listed in quarantine.json but the test is not tagged @quarantine`,
      );
    }
  }
  for (const id of tagged) {
    if (!entries.some((e) => e.testId === id)) {
      problems.push(`${id}: tagged @quarantine but has no quarantine.json entry`);
    }
  }
  return problems;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `qa quarantine-check`: exit 1 on any problem. */
export function quarantineCheckCommand(args: Args, log: (line: string) => void): number {
  const file = readQuarantine(arg(args, 'file', 'quarantine.json'));
  const tagged = listTests()
    .filter((t) => t.tags.includes('@quarantine'))
    .map(quarantineId);
  const problems = checkQuarantine(file.entries, tagged, arg(args, 'today', today()));
  log(
    `Quarantine: ${String(file.entries.length)} entr(y/ies), ${String(tagged.length)} tagged test(s)`,
  );
  problems.forEach((p) => {
    log(`  - ${p}`);
  });
  log(problems.length === 0 ? 'OK' : 'FAILED');
  return problems.length === 0 ? 0 : 1;
}
