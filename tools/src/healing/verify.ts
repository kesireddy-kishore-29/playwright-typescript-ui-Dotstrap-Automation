import { nodeTool } from './run';

export interface Step {
  name: string;
  passed: boolean;
  detail: string;
}

/** testId from the reporter: "<project> › <file> › <describe…> › <title>". */
export function parseTestId(testId: string): { project: string; file: string; title: string } {
  const parts = testId.split(' › ');
  return {
    project: parts[0] ?? 'chromium',
    file: parts[1] ?? '',
    title: parts[parts.length - 1] ?? '',
  };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One run of another failing test that the same fix claims to explain. */
export function rerunTest(repoRoot: string, testId: string): Step {
  const { project, file, title } = parseTestId(testId);
  const once = nodeTool(
    '@playwright/test/cli',
    [
      'test',
      `tests/${file}`,
      `--project=${project}`,
      '-g',
      escapeRegex(title),
      '--retries=0',
      '--workers=1',
      '--reporter=dot',
    ],
    repoRoot,
    600_000,
  );
  return {
    name: `also explained: ${project} › ${file} › ${title}`,
    passed: once.ok,
    detail: once.ok ? 'passed' : once.tail,
  };
}

/** Lint, type-check, the failing test 3 times in a row, then its file (the surrounding suite). */
export function verifyHeal(repoRoot: string, testId: string): Step[] {
  const steps: Step[] = [];
  const { project, file, title } = parseTestId(testId);
  const lint = nodeTool('eslint/bin/eslint.js', ['src'], repoRoot, 300_000);
  steps.push({ name: 'lint', passed: lint.ok, detail: lint.ok ? 'ok' : lint.tail });
  const types = nodeTool('typescript/bin/tsc', ['--noEmit'], repoRoot, 300_000);
  steps.push({ name: 'type-check', passed: types.ok, detail: types.ok ? 'ok' : types.tail });
  if (!lint.ok || !types.ok) return steps;
  const testPath = `tests/${file}`;
  const repeated = nodeTool(
    '@playwright/test/cli',
    [
      'test',
      testPath,
      `--project=${project}`,
      '-g',
      escapeRegex(title),
      '--repeat-each=3',
      '--retries=0',
      '--workers=1',
      '--reporter=dot',
    ],
    repoRoot,
    600_000,
  );
  steps.push({
    name: 'failing test, 3 consecutive runs',
    passed: repeated.ok,
    detail: repeated.ok ? 'passed 3/3' : repeated.tail,
  });
  if (!repeated.ok) return steps;
  const suite = nodeTool(
    '@playwright/test/cli',
    ['test', testPath, `--project=${project}`, '--retries=0', '--reporter=dot'],
    repoRoot,
    600_000,
  );
  steps.push({
    name: `surrounding suite (${testPath})`,
    passed: suite.ok,
    detail: suite.ok ? 'passed' : suite.tail,
  });
  return steps;
}
