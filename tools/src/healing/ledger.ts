import { existsSync } from 'node:fs';
import { readJson, writeJson } from '../shared/json';

/** outcome: proposed | rejected-by-guardrails | failed-verification | merged | rejected */
export interface HealEntry {
  date: string;
  runId: string;
  testId: string;
  category: string;
  rootCause: string;
  branch: string;
  pr: string;
  provider: string;
  outcome: string;
  timeToFixMinutes: number;
  guardrails: { paths: string; patterns: string; loosening: string };
  verification: { runs: number; passed: number; suite: boolean };
}
export interface HealingLog {
  schemaVersion: 1;
  entries: HealEntry[];
}

export function readLog(file: string): HealingLog {
  return existsSync(file) ? (readJson(file) as HealingLog) : { schemaVersion: 1, entries: [] };
}

export function appendLog(file: string, entry: HealEntry): void {
  const log = readLog(file);
  writeJson(file, { schemaVersion: 1, entries: [...log.entries, entry] });
}

export function attemptsToday(log: HealingLog, testId: string, date: string): number {
  return log.entries.filter((e) => e.testId === testId && e.date === date).length;
}
