import type { AiProvider } from '../ai/provider';
import { CATEGORY_NAMES, isCategory } from './categories';
import type { Classification, FailureInput } from './classifier';

const SYSTEM =
  'You classify automated UI test failures for a CI pipeline. Choose exactly one category. ' +
  'LOCATOR_DRIFT: the element exists but the locator no longer matches. TIMING: race or wait. ' +
  'TEST_DATA: data collided or leaked. ENVIRONMENT: network or site availability. ' +
  'PRODUCT_BUG: the application behaved wrongly. CONTRACT_DRIFT: API response shape changed. ' +
  'If the evidence is insufficient, answer UNKNOWN. Keep the reason to one sentence.';

export const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: { category: { type: 'string', enum: CATEGORY_NAMES }, reason: { type: 'string' } },
  required: ['category', 'reason'],
};

/** "skipped (...)" when no provider is configured. */
export function aiStatus(provider: AiProvider | undefined): string {
  return provider ? provider.name : 'skipped (ANTHROPIC_API_KEY not set)';
}

/** Second opinion for UNKNOWN only; labelled classifiedBy: 'llm'. */
export async function refine(
  byRules: Classification,
  input: FailureInput,
  provider: AiProvider | undefined,
): Promise<Classification> {
  if (byRules.category !== 'UNKNOWN' || !provider) return byRules;
  const evidence = `Project: ${input.project}\nFailing locator: ${input.failingLocator ?? '(none)'}\nMessage:\n${input.message.slice(0, 4000)}`;
  const result = await provider.completeJson(SYSTEM, evidence, TRIAGE_SCHEMA);
  const answer = result.json as { category?: unknown; reason?: unknown } | undefined;
  if (!answer || !isCategory(answer.category)) return byRules;
  return {
    category: answer.category,
    confidence: 0.6,
    classifiedBy: 'llm',
    rule: 'llm',
    reason: typeof answer.reason === 'string' ? answer.reason : '(no reason given)',
  };
}
