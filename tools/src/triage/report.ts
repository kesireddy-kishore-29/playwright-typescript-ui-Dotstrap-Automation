import { CATEGORIES } from './categories';
import type { TriageRecord } from './triage';

/** failure-report.md: one page a person can act on without opening anything else first. */
export function renderFailureReport(t: TriageRecord): string {
  const lines = [
    `# Failure: ${t.title}`,
    '',
    '| | |',
    '|---|---|',
    `| Category | **${t.category}** (${t.classifiedBy}, rule \`${t.rule}\`, confidence ${t.confidence.toFixed(2)}) |`,
    `| Next action | ${CATEGORIES[t.category].nextAction} |`,
    `| Healable | ${t.healable ? 'yes' : 'no'}${t.needsHumanDecision ? ' (needs a human decision)' : ''} |`,
    `| Test | \`${t.testId}\` |`,
    `| Features | ${t.featureIds.join(', ')} |`,
    `| Run | \`${t.runId}\` |`,
    `| Failing locator | ${t.failingLocator ? `\`${t.failingLocator}\`` : '(none reported)'} |`,
    '',
    '## Why',
    '',
    t.reason,
    '',
    '## Error',
    '',
    '```text',
    t.error.message,
    '```',
    '',
    '## Evidence',
    '',
    ...Object.entries(t.evidence).map(([k, v]) => `- ${k}: \`${v}\``),
    '',
    `AI step: ${t.aiStep}`,
    '',
  ];
  return lines.join('\n');
}
