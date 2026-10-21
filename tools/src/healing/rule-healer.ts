import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Patch } from './patch';

export const RULE_HEALER = 'rule-based';
const ALLOWED_DIRS = ['src/pages', 'src/components', 'src/fixtures', 'src/data', 'src/clients'];

function tokens(id: string): string[] {
  return id
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j] ?? 0;
      row[j] = Math.min(
        (row[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length] ?? 0;
}

/** 0..1: shared word tokens weighted with edit distance. */
export function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const jaccard = shared / new Set([...ta, ...tb]).size;
  const edit = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  return 0.6 * jaccard + 0.4 * edit;
}

/** Test ids present in the DOM at failure. */
export function testIdsIn(html: string): string[] {
  return [
    ...new Set([...html.matchAll(/data-test="([^"]+)"/g)].map((m) => m[1] ?? '').filter(Boolean)),
  ];
}

/**
 * The surviving test id most likely to be the same element renamed. String similarity alone is
 * not enough ('unread-count' is closer to 'unread-dot' than to 'unread-badge'), so two pieces of
 * evidence narrow the field first: an id another locator already uses is a different, working
 * element; and a rename keeps at least one word of the old id.
 */
export function closestTestId(
  missing: string,
  html: string,
  referencedElsewhere: readonly string[] = [],
  threshold = 0.35,
): { id: string; score: number } | undefined {
  const missingTokens = new Set(tokens(missing));
  const scored = testIdsIn(html)
    .filter((id) => id !== missing && !referencedElsewhere.includes(id))
    .filter((id) => tokens(id).some((t) => missingTokens.has(t)))
    .map((id) => ({ id, score: similarity(missing, id) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && best.score >= threshold ? best : undefined;
}

/** Test ids used by any locator in these sources. */
export function referencedTestIds(sources: readonly string[]): string[] {
  return [
    ...new Set(
      sources.flatMap((s) => [...s.matchAll(/getByTestId\('([^']+)'\)/g)].map((m) => m[1] ?? '')),
    ),
  ];
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Deterministic healing for test-id drift: the failing locator is getByTestId('x'), no element
 * carries x any more, and the DOM at failure has a clearly similar id. The patch swaps the id in
 * the page object or component that defines it. Role or text drift needs judgement: not here.
 */
export function proposeTestIdHeal(
  repoRoot: string,
  testId: string,
  failingLocator: string | undefined,
  pageSource: string,
): Patch | undefined {
  const missing = failingLocator ? /getByTestId\('([^']+)'\)/.exec(failingLocator)?.[1] : undefined;
  if (!missing || pageSource.includes(`data-test="${missing}"`)) return undefined;
  const sources = ALLOWED_DIRS.flatMap((dir) => walk(join(repoRoot, dir))).map((file) => ({
    file,
    before: readFileSync(file, 'utf8'),
  }));
  const inUse = referencedTestIds(sources.map((s) => s.before)).filter((id) => id !== missing);
  const candidate = closestTestId(missing, pageSource, inUse);
  if (!candidate) return undefined;
  const changes = sources
    .filter(({ before }) => before.includes(`getByTestId('${missing}')`))
    .map(({ file, before }) => ({
      path: relative(repoRoot, file).split('\\').join('/'),
      before,
      after: before.replaceAll(`getByTestId('${missing}')`, `getByTestId('${candidate.id}')`),
    }));
  if (changes.length === 0) return undefined;
  return {
    category: 'LOCATOR_DRIFT',
    testId,
    provider: RULE_HEALER,
    rationale:
      `No element carries data-test="${missing}" any more. The DOM at the moment of failure has ` +
      `data-test="${candidate.id}" (similarity ${candidate.score.toFixed(2)}): the closest id that shares a ` +
      'word with the old one and that no other locator already uses. ' +
      `The patch changes this locator wherever a page object or component uses it (${String(changes.length)} file(s)); ` +
      'the tests and their assertions are untouched.',
    changes,
  };
}
