/**
 * Exactly one category per failure. The same seven categories, with the same meaning, in every
 * repository of the family. Only the first four may ever reach the healing agent.
 */
export const CATEGORIES = {
  LOCATOR_DRIFT: {
    healable: true,
    needsHumanDecision: false,
    nextAction: 'Propose a locator fix (page object only) and verify it 3 times.',
  },
  TIMING: {
    healable: true,
    needsHumanDecision: false,
    nextAction: 'Propose a wait-on-condition fix; never a hard wait or a longer timeout.',
  },
  TEST_DATA: {
    healable: true,
    needsHumanDecision: false,
    nextAction: 'Fix the data fixture: unique data, verified cleanup, no shared state.',
  },
  CONTRACT_DRIFT: {
    healable: true,
    needsHumanDecision: true,
    nextAction:
      'Decide: provider bug (file an issue) or agreed change (update schema + client model).',
  },
  ENVIRONMENT: {
    healable: false,
    needsHumanDecision: false,
    nextAction: 'Not a code problem. Retry later or check the service/network; notify.',
  },
  PRODUCT_BUG: {
    healable: false,
    needsHumanDecision: false,
    nextAction: 'Never auto-fix. File an issue with the evidence bundle attached.',
  },
  UNKNOWN: {
    healable: false,
    needsHumanDecision: false,
    nextAction: 'Human triage: read the failure bundle and classify by hand.',
  },
} as const;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_NAMES = Object.keys(CATEGORIES) as Category[];

export function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && value in CATEGORIES;
}
