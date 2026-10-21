import type { GuardrailViolation, Patch } from './patch';
import type { Step } from './verify';

/** The standard self-healed PR description (same sections in every repository of the family). */
export function renderPrBody(
  patch: Patch,
  rootCause: string,
  evidence: string,
  violations: GuardrailViolation[],
  steps: Step[],
  needsDecision: boolean,
  alsoExplains: string[] = [],
): string {
  return [
    `## Self-healed: ${patch.category}`,
    '',
    `> Proposed by \`${patch.provider}\`. **Never auto-merged**: a person reviews, then merges or closes.${needsDecision ? ' **Contract change: decide whether the provider is wrong before merging.**' : ''}`,
    '',
    '| | |',
    '|---|---|',
    `| Failure category | \`${patch.category}\` |`,
    `| Test | \`${patch.testId}\` |`,
    `| Evidence | ${evidence} |`,
    ...(alsoExplains.length
      ? [
          `| Also explains | ${String(alsoExplains.length)} other failing test(s) with the same cause (below) |`,
        ]
      : []),
    '',
    '### Root cause',
    '',
    rootCause,
    '',
    ...(alsoExplains.length
      ? [
          '### Other failures with the same cause',
          '',
          ...alsoExplains.map((t) => `- \`${t}\``),
          '',
          'The verification below reruns each of them on this branch.',
          '',
        ]
      : []),
    '### Why this diff',
    '',
    patch.rationale,
    '',
    '### Files changed (allowed paths only)',
    '',
    ...patch.changes.map((c) => `- \`${c.path}\``),
    '',
    '### Guardrails',
    '',
    violations.length === 0
      ? 'All passed: allowed paths, no forbidden constructs, no loosened checks.'
      : `FAILED: ${violations.map((v) => `${v.rule} (${v.path})`).join(', ')}`,
    '',
    '### Verification (before → after)',
    '',
    'Before: the test failed in the triaged run.',
    '',
    '| Step | Result |',
    '|---|---|',
    ...steps.map((s) => `| ${s.name} | ${s.passed ? 'passed' : '**failed**'} |`),
    '',
    '---',
    `Labels: \`self-healed\`${needsDecision ? ', `needs-contract-decision`' : ''}`,
    '',
  ].join('\n');
}
