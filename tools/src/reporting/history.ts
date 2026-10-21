import { existsSync } from 'node:fs';
import { readJson } from '../shared/json';
import type { RunSummary } from '../shared/run';

/** history.json: one point per run, newest last, at most 30 (the dashboard's trend window). */
export const KEEP = 30;

export interface HistoryPoint {
  runId: string;
  date: string;
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
  passRate: number;
}

export interface History {
  schemaVersion: 1;
  runs: HistoryPoint[];
}

export function readHistory(file: string): History {
  return existsSync(file) ? (readJson(file) as History) : { schemaVersion: 1, runs: [] };
}

/** Pass rate counts flaky tests as passed; skipped tests are not executed. */
export function pointOf(run: RunSummary): HistoryPoint {
  const t = (key: string): number => run.totals[key] ?? 0;
  const executed = t('passed') + t('failed') + t('flaky');
  return {
    runId: run.runId,
    date: run.startedAt.slice(0, 10),
    total: t('total'),
    passed: t('passed'),
    failed: t('failed'),
    flaky: t('flaky'),
    skipped: t('skipped'),
    durationMs: run.durationMs,
    passRate: executed === 0 ? 0 : (t('passed') + t('flaky')) / executed,
  };
}

/** Adds (or replaces) this run and keeps the newest {@link KEEP}. */
export function withPoint(history: History, point: HistoryPoint): History {
  const runs = [...history.runs.filter((p) => p.runId !== point.runId), point];
  return { schemaVersion: 1, runs: runs.slice(-KEEP) };
}
