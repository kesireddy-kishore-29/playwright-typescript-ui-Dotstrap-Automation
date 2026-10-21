import { describe, expect, it } from 'vitest';
import { AnthropicProvider, buildRequest, MODEL, readMessage } from '../src/ai/anthropic';
import { aiStatus, refine, TRIAGE_SCHEMA } from '../src/triage/ai-triage';
import type { AiProvider } from '../src/ai/provider';
import type { Classification } from '../src/triage/classifier';

const UNKNOWN: Classification = {
  category: 'UNKNOWN',
  confidence: 0.3,
  classifiedBy: 'rules',
  rule: 'no-rule-matched',
  reason: '?',
};

const answering = (category: string): AiProvider => ({
  name: 'fake',
  completeJson: () => Promise.resolve({ json: { category, reason: 'because' }, status: 'ok' }),
});

describe('Anthropic provider (no network)', () => {
  it('is absent without a key, so the tools run on rules only', () => {
    expect(AnthropicProvider.fromEnvironment({})).toBeUndefined();
    expect(aiStatus(undefined)).toMatch(/^skipped/);
  });

  it('asks for schema-constrained JSON, explicit effort and the server-side fallback', () => {
    const request = buildRequest('system', 'user', TRIAGE_SCHEMA);
    expect(request.model).toBe(MODEL);
    expect(request.output_config?.effort).toBe('medium');
    expect(request.output_config?.format).toEqual({ type: 'json_schema', schema: TRIAGE_SCHEMA });
    expect(request.fallbacks).toBe('default');
    expect(request.betas).toContain('server-side-fallback-2026-07-01');
    expect(request).not.toHaveProperty('thinking');
  });

  it('reads the text block and never treats a refusal or truncation as an answer', () => {
    expect(
      readMessage({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '{"category":"TIMING"}', citations: null }],
      }).json,
    ).toEqual({ category: 'TIMING' });
    expect(readMessage({ stop_reason: 'refusal', content: [] }).json).toBeUndefined();
    expect(
      readMessage({
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: '{', citations: null }],
      }).json,
    ).toBeUndefined();
  });
});

describe('AI triage', () => {
  const input = { project: 'chromium', message: 'odd' };

  it('only refines UNKNOWN and labels the answer as llm', async () => {
    const decided: Classification = {
      ...UNKNOWN,
      category: 'PRODUCT_BUG',
      rule: 'behaviour-assertion',
    };
    expect(await refine(decided, input, answering('TIMING'))).toBe(decided);
    const refined = await refine(UNKNOWN, input, answering('TIMING'));
    expect(refined.category).toBe('TIMING');
    expect(refined.classifiedBy).toBe('llm');
  });

  it('ignores an answer outside the seven categories', async () => {
    expect(await refine(UNKNOWN, input, answering('FIX_EVERYTHING'))).toBe(UNKNOWN);
  });
});
