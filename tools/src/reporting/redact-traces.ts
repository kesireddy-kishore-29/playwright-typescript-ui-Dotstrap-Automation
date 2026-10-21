import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { redactTrace } from '../../../src/support/redact';
import type { Args } from '../shared/args';
import { arg } from '../shared/args';

function zips(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? zips(full) : name.endsWith('.zip') ? [full] : [];
  });
}

/** A Playwright trace is a zip with at least one `.trace` event log. */
export function isTrace(zip: Uint8Array): boolean {
  try {
    return Object.keys(unzipSync(zip)).some((name) => name.endsWith('.trace'));
  } catch {
    return false;
  }
}

/**
 * `qa redact-traces [--dir allure-results,playwright-report]`: redacts, in place, every
 * Playwright trace that other reporters copied (Allure attachments, the HTML report's data). The
 * evidence reporter redacts its own copy; these copies are made by third-party reporters.
 */
export function redactTracesCommand(args: Args, log: (line: string) => void): number {
  const dirs = arg(args, 'dir', 'allure-results,playwright-report')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
  let count = 0;
  for (const file of dirs.flatMap(zips)) {
    const zip = readFileSync(file);
    if (!isTrace(zip)) continue;
    writeFileSync(file, redactTrace(zip));
    count += 1;
  }
  log(`Redacted ${String(count)} trace(s) in ${dirs.join(', ')}`);
  return 0;
}
