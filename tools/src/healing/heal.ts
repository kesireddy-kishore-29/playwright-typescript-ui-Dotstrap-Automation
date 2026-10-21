import { createTwoFilesPatch } from 'diff';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AnthropicProvider } from '../ai/anthropic';
import { aiStatus } from '../triage/ai-triage';
import type { Args } from '../shared/args';
import { arg } from '../shared/args';
import { readJson, writeJson, writeText } from '../shared/json';
import { resolveRunDir } from '../shared/run';
import { CATEGORIES, type Category } from '../triage/categories';
import type { TriageRecord } from '../triage/triage';
import { proposeWithAi } from './ai-healer';
import { checkPatch } from './guardrails';
import { appendLog, attemptsToday, readLog, type HealEntry } from './ledger';
import type { GuardrailViolation, Patch } from './patch';
import { renderPrBody } from './pr-body';
import { proposeTestIdHeal } from './rule-healer';
import { git, run } from './run';
import { verifyHeal, type Step } from './verify';

export const MAX_ATTEMPTS_PER_FAILURE = 2;
const ALLOWED_DIRS = ['src/pages', 'src/components', 'src/fixtures', 'src/data', 'src/clients'];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function allowedFiles(repoRoot: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory()
        ? walk(full)
        : full.endsWith('.ts')
          ? [relative(repoRoot, full).split('\\').join('/')]
          : [];
    });
  return ALLOWED_DIRS.flatMap((d) => walk(join(repoRoot, d)));
}

function guardrailSummary(violations: GuardrailViolation[]): HealEntry['guardrails'] {
  const has = (test: (rule: string) => boolean): string =>
    violations.some((v) => test(v.rule)) ? 'fail' : 'pass';
  return {
    paths: has((r) => r.includes('path')),
    patterns: has((r) => !r.includes('path') && !r.includes('removed') && !r.includes('loosened')),
    loosening: has((r) => r.includes('removed') || r.includes('loosened')),
  };
}

export function unifiedDiff(patch: Patch): string {
  return patch.changes
    .map((c) => createTwoFilesPatch(`a/${c.path}`, `b/${c.path}`, c.before, c.after))
    .join('\n');
}

/**
 * `qa heal [--run <dir>] [--max-prs 3] [--open-prs]`: propose guarded, verified fixes on
 * heal/<category>/<test>-<date> branches. Never merges; never pushes without --open-prs.
 */
export async function healCommand(args: Args, log: (line: string) => void): Promise<number> {
  const repoRoot = process.cwd();
  const runDir = resolveRunDir(args);
  const maxPrs = Number(arg(args, 'max-prs', '3'));
  const ledgerFile = join(repoRoot, 'healing-log.json');
  const provider = AnthropicProvider.fromEnvironment(process.env);
  const startBranch = git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot);
  if (git(['status', '--porcelain'], repoRoot) !== '') {
    log('Working tree is not clean; refusing to create heal branches.');
    return 2;
  }
  const triageDir = join(runDir, 'triage');
  const triageFiles = existsSync(triageDir)
    ? readdirSync(triageDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
    : [];
  const results: Record<string, string>[] = [];
  let opened = 0;
  for (const name of triageFiles) {
    const triage = readJson(join(triageDir, name)) as TriageRecord;
    const category: Category = triage.category;
    if (!CATEGORIES[category].healable) continue;
    if (opened >= maxPrs) {
      log(`PR budget (${String(maxPrs)}) reached; stopping.`);
      break;
    }
    if (attemptsToday(readLog(ledgerFile), triage.testId, today()) >= MAX_ATTEMPTS_PER_FAILURE) {
      log(`Attempt budget used for ${triage.testId}`);
      continue;
    }
    const started = Date.now();
    const slug = name.replace(/\.json$/, '');
    const pageSourceFile = triage.evidence['page-source']
      ? join(runDir, triage.evidence['page-source'])
      : undefined;
    const pageSource =
      pageSourceFile && existsSync(pageSourceFile)
        ? readFileSync(pageSourceFile, 'utf8')
        : undefined;
    let patch = pageSource
      ? proposeTestIdHeal(repoRoot, triage.testId, triage.failingLocator, pageSource)
      : undefined;
    patch ??= await proposeWithAi(
      provider,
      repoRoot,
      category,
      triage.testId,
      triage,
      allowedFiles(repoRoot),
      pageSource,
    );
    if (!patch) {
      log(`No proposal for ${triage.testId} (rules: none; AI: ${aiStatus(provider)})`);
      results.push({ testId: triage.testId, outcome: 'no-proposal', aiStep: aiStatus(provider) });
      continue;
    }
    const violations = checkPatch(patch);
    const entryBase = {
      date: today(),
      runId: triage.runId,
      testId: triage.testId,
      category,
      rootCause: triage.reason,
      provider: patch.provider,
      guardrails: guardrailSummary(violations),
    };
    const healDir = join(runDir, 'healing', slug);
    if (violations.length > 0) {
      log(
        `Guardrails refused the patch for ${triage.testId}: ${violations.map((v) => v.rule).join(', ')}`,
      );
      writeJson(join(healDir, 'rejected.json'), {
        ...entryBase,
        outcome: 'rejected-by-guardrails',
        violations,
      });
      results.push({ testId: triage.testId, outcome: 'rejected-by-guardrails' });
      continue;
    }
    const branch = `heal/${category.toLowerCase().replace(/_/g, '-')}/${slug}-${today().replace(/-/g, '')}`;
    git(['switch', '-c', branch], repoRoot);
    for (const change of patch.changes) writeFileSync(join(repoRoot, change.path), change.after);
    const steps: Step[] = verifyHeal(repoRoot, triage.testId);
    const verified = steps.every((s) => s.passed);
    const repeated = steps.find((s) => s.name.startsWith('failing test'));
    const verification = {
      runs: 3,
      passed: repeated?.passed ? 3 : 0,
      suite: steps.some((s) => s.name.startsWith('surrounding') && s.passed),
    };
    const body = renderPrBody(
      patch,
      triage.reason,
      `\`${triage.evidence['bundleZip'] ?? ''}\` (run \`${triage.runId}\`)`,
      violations,
      steps,
      CATEGORIES[category].needsHumanDecision,
    );
    writeText(join(healDir, 'PR.md'), body);
    writeJson(join(healDir, 'patch.json'), patch);
    writeText(join(healDir, 'patch.diff'), unifiedDiff(patch));
    writeJson(join(healDir, 'verification.json'), steps);
    if (!verified) {
      git(['checkout', '--', '.'], repoRoot);
      git(['switch', startBranch], repoRoot);
      git(['branch', '-D', branch], repoRoot);
      log(`Verification failed for ${triage.testId}; branch discarded`);
      writeJson(join(healDir, 'rejected.json'), {
        ...entryBase,
        outcome: 'failed-verification',
        steps,
      });
      results.push({ testId: triage.testId, outcome: 'failed-verification' });
      continue;
    }
    const entry: HealEntry = {
      ...entryBase,
      branch,
      pr: `(local branch; PR body at ${relative(repoRoot, join(healDir, 'PR.md')).split('\\').join('/')})`,
      outcome: 'proposed',
      timeToFixMinutes: Math.max(1, Math.round((Date.now() - started) / 60_000)),
      verification,
    };
    appendLog(ledgerFile, entry);
    git(['add', '-A'], repoRoot);
    git(
      [
        'commit',
        '-q',
        '-m',
        `fix(heal): ${category.toLowerCase().replace(/_/g, ' ')} in ${slug}\n\n${triage.reason}\n\nProposed by ${patch.provider}; guardrails passed; failing test passed 3/3 and its suite passed. Needs human review; never auto-merged.\n\nHealed-By: ${patch.provider}`,
      ],
      repoRoot,
    );
    if (args.get('open-prs') === 'true') {
      const push = run('git', ['push', '-u', 'origin', branch], repoRoot, 120_000);
      const pr = push.ok
        ? run(
            'gh',
            [
              'pr',
              'create',
              '--head',
              branch,
              '--title',
              `Self-healed: ${category} (${branch})`,
              '--body',
              body,
              '--label',
              'self-healed',
            ],
            repoRoot,
            120_000,
          )
        : push;
      log(pr.ok ? `PR: ${pr.tail}` : `PR not opened: ${pr.tail}`);
    }
    git(['switch', startBranch], repoRoot);
    appendLog(join(runDir, 'healing', 'healing-log.json'), entry);
    opened += 1;
    log(`Proposed ${branch}`);
    results.push({ testId: triage.testId, outcome: 'proposed', branch });
  }
  writeJson(join(runDir, 'healing', 'healing-summary.json'), {
    aiStep: aiStatus(provider),
    results,
  });
  return 0;
}
