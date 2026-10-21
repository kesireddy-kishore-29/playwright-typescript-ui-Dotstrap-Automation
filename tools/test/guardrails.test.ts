import { describe, expect, it } from 'vitest';
import { checkPatch } from '../src/healing/guardrails';
import type { FileChange, Patch } from '../src/healing/patch';
import type { Category } from '../src/triage/categories';

const PAGE = 'src/components/NotificationBell.ts';
const patch = (category: Category, ...changes: FileChange[]): Patch => ({
  category,
  testId: 't',
  provider: 'test',
  rationale: 'why',
  changes,
});
const edit = (path: string, before: string, after: string): FileChange => ({ path, before, after });
const rules = (p: Patch): string[] => checkPatch(p).map((v) => v.rule);
const addLine = (line: string): Patch =>
  patch('LOCATOR_DRIFT', edit(PAGE, 'class A {\n}\n', `class A {\n${line}\n}\n`));

describe('healing guardrails (UI)', () => {
  it('lets a minimal test-id swap in a page object through', () => {
    const p = patch(
      'LOCATOR_DRIFT',
      edit(
        PAGE,
        "this.badge = page.getByTestId('unread-count');\n",
        "this.badge = page.getByTestId('unread-badge');\n",
      ),
    );
    expect(checkPatch(p)).toEqual([]);
  });

  it.each([
    'tests/hybrid/inbox.spec.ts',
    'playwright.config.ts',
    'package.json',
    '.github/workflows/ci.yml',
    'sut-ui/public/app.js',
    'tools/src/healing/guardrails.ts',
    'docs/adr/0001-why-playwright.md',
    'src/evidence/reporter.ts',
    'src/config/env.ts',
  ])('refuses a forbidden path: %s', (path) => {
    expect(rules(patch('LOCATOR_DRIFT', edit(path, 'a\n', 'b\n')))).toEqual(['forbidden-path']);
  });

  it('refuses paths outside the allow list', () => {
    expect(rules(patch('TIMING', edit('src/support/layout.ts', 'a\n', 'b\n')))).toEqual([
      'path-not-allowed',
    ]);
  });

  it.each([
    ['    await this.page.waitForTimeout(2000);', 'hard-wait'],
    ['    await new Promise((r) => setTimeout(r, 500));', 'hard-wait'],
    ["test.skip('flaky');", 'disabled-test'],
    ["test.fixme('later');", 'disabled-test'],
    ['    await this.button.click({ force: true });', 'forced-action'],
    ['    // eslint-disable-next-line', 'suppressed-check'],
    ['    // @ts-ignore', 'suppressed-check'],
    ['    try { await x(); } catch {}', 'swallowed-exception'],
    ['    await x().catch(() => {});', 'swallowed-exception'],
    ["    this.button = page.getByRole('button').first();", 'loosened-locator'],
    [
      "    this.button = page.getByRole('button', { name: 'Save', exact: false });",
      'loosened-locator',
    ],
    ['    this.title = page.getByText(/.*/);', 'loosened-locator'],
    ['  allowedConsoleErrors: [/.*/],', 'loosened-console-guard'],
    ['    await this.button.click({ timeout: 60_000 });', 'timeout-above-ceiling'],
  ])('refuses %s (%s)', (line, rule) => {
    expect(rules(addLine(line))).toContain(rule);
  });

  it('refuses a patch that removes a check from a fixture', () => {
    const before = "    expect(leftMessages, 'seeded messages deleted').toEqual([]);\n";
    expect(rules(patch('TEST_DATA', edit('src/fixtures/app.ts', before, '')))).toContain(
      'removed-check',
    );
  });

  it.each(['PRODUCT_BUG', 'ENVIRONMENT', 'UNKNOWN'] as const)('never heals %s', (category) => {
    expect(rules(patch(category, edit(PAGE, 'a\n', 'b\n')))).toEqual(['not-healable']);
  });
});
