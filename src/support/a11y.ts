import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

/** WCAG 2.1 A and AA: the level the app commits to. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export interface A11yViolation {
  id: string;
  impact: string;
  help: string;
  nodes: number;
}

/**
 * Runs axe on the current page and attaches the result as `axe-results.json`, which the report
 * tool aggregates into the accessibility summary (violations by impact).
 */
export async function scanAccessibility(page: Page, testInfo: TestInfo): Promise<A11yViolation[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? 'unknown',
    help: v.help,
    nodes: v.nodes.length,
  }));
  await testInfo.attach('axe-results.json', {
    contentType: 'application/json',
    body: JSON.stringify({ url: page.url(), violations }, null, 2),
  });
  return violations;
}

/** The rule IDs, sorted, so a baseline comparison reads as a set. */
export function ruleIds(violations: A11yViolation[]): string[] {
  return [...new Set(violations.map((v) => v.id))].sort();
}
