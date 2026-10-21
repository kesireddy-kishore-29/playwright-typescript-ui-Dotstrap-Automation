import { diffLines } from 'diff';
import { CATEGORIES } from '../triage/categories';
import type { FileChange, GuardrailViolation, Patch } from './patch';

/** No healed timeout may exceed this; a bigger timeout hides slowness instead of fixing it. */
export const TIMEOUT_CEILING_MS = 15_000;

/** The only places a heal may change (docs/self-healing.md). */
const ALLOWED = [
  /^src\/pages\//,
  /^src\/components\//,
  /^src\/fixtures\//,
  /^src\/data\//,
  /^src\/clients\//,
];

/** Assertions, expectations, configuration, CI, the product, the tooling and decisions. */
const FORBIDDEN_PATHS = [
  /^tests\//,
  /^playwright\.config\.ts$/,
  /^package(-lock)?\.json$/,
  /^tsconfig\.json$/,
  /^eslint\.config\.mjs$/,
  /^\.github\//,
  /^sut-ui\//,
  /^tools\//,
  /^docs\/adr\//,
  /^src\/evidence\//,
  /^src\/config\//,
];

const FORBIDDEN_ADDITIONS: { rule: string; pattern: RegExp }[] = [
  { rule: 'hard-wait', pattern: /waitForTimeout\s*\(|setTimeout\s*\(/ },
  { rule: 'disabled-test', pattern: /\.(skip|fixme|fail)\s*\(|test\.(skip|fixme|fail)\b/ },
  { rule: 'forced-action', pattern: /force\s*:\s*true/ },
  { rule: 'suppressed-check', pattern: /eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck/ },
  {
    rule: 'swallowed-exception',
    pattern:
      /catch\s*(\([^)]*\))?\s*\{\s*\}|\.catch\(\s*\(\s*\)\s*=>\s*(\{\s*\}|undefined|null)\s*\)/,
  },
  {
    rule: 'loosened-locator',
    pattern: /\.(first|last|nth)\(|exact\s*:\s*false|\/\.\*\/|name:\s*\/\.\*/,
  },
  { rule: 'loosened-console-guard', pattern: /allowedConsoleErrors/ },
];

const TIMEOUT = /timeout\s*:\s*([0-9_]+)/g;
const CHECK = /\bexpect\s*\(|\.toHave|\.toBe|\.toEqual|\.toContain/;

export function linesOf(change: FileChange): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  for (const part of diffLines(change.before, change.after)) {
    const lines = part.value.split('\n').filter((l) => l.length > 0);
    if (part.added) added.push(...lines);
    else if (part.removed) removed.push(...lines);
  }
  return { added, removed };
}

/** Every reason the patch is refused; empty means it may be applied and verified. */
export function checkPatch(patch: Patch): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  if (!CATEGORIES[patch.category].healable) {
    return [
      {
        rule: 'not-healable',
        path: '-',
        detail: `${patch.category} is never healed automatically`,
      },
    ];
  }
  if (patch.changes.length === 0)
    violations.push({ rule: 'empty-patch', path: '-', detail: 'the patch changes nothing' });
  for (const change of patch.changes) {
    const forbidden = FORBIDDEN_PATHS.find((p) => p.test(change.path));
    if (forbidden) {
      violations.push({
        rule: 'forbidden-path',
        path: change.path,
        detail: `heals may never change ${forbidden.source}`,
      });
      continue;
    }
    if (!ALLOWED.some((p) => p.test(change.path))) {
      violations.push({
        rule: 'path-not-allowed',
        path: change.path,
        detail: 'outside pages/, components/, fixtures/, data/, clients/',
      });
      continue;
    }
    const { added, removed } = linesOf(change);
    for (const line of added) {
      for (const f of FORBIDDEN_ADDITIONS) {
        if (f.pattern.test(line))
          violations.push({ rule: f.rule, path: change.path, detail: line.trim() });
      }
      for (const match of line.matchAll(TIMEOUT)) {
        if (Number((match[1] ?? '0').replace(/_/g, '')) > TIMEOUT_CEILING_MS) {
          violations.push({
            rule: 'timeout-above-ceiling',
            path: change.path,
            detail: line.trim(),
          });
        }
      }
    }
    for (const line of removed) {
      if (CHECK.test(line))
        violations.push({ rule: 'removed-check', path: change.path, detail: line.trim() });
    }
  }
  return violations;
}
