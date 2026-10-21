import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AiProvider } from '../ai/provider';
import type { Category } from '../triage/categories';
import type { Patch } from './patch';

const SYSTEM =
  'You fix a failing Playwright test framework with the smallest possible change. You may edit only ' +
  'the files you are shown (page objects, components, fixtures, data builders, API clients). Never add ' +
  'waitForTimeout, never skip or fixme tests, never use force: true, never add .first()/.nth() to hide an ' +
  'ambiguous locator, never raise a timeout above 15 s, never swallow errors. Prefer role- and label-based ' +
  'locators. Return each changed file in full. If no safe fix exists, return an empty list and say why.';

export const HEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rationale: { type: 'string' },
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  required: ['rationale', 'files'],
};

/** The model proposes; guardrails and verification decide. It sees allowed files only. */
export async function proposeWithAi(
  provider: AiProvider | undefined,
  repoRoot: string,
  category: Category,
  testId: string,
  triage: unknown,
  candidateFiles: string[],
  pageSource: string | undefined,
): Promise<Patch | undefined> {
  if (!provider || candidateFiles.length === 0) return undefined;
  const originals = new Map(
    candidateFiles.map((path) => [path, readFileSync(join(repoRoot, path), 'utf8')]),
  );
  const user = [
    `Triage:\n${JSON.stringify(triage, null, 2)}`,
    pageSource
      ? `DOM at failure (truncated):\n${pageSource.slice(0, 20_000)}`
      : 'DOM at failure: (not captured)',
    ...[...originals].map(([path, content]) => `--- ${path} ---\n${content}`),
  ].join('\n\n');
  const result = await provider.completeJson(SYSTEM, user, HEAL_SCHEMA);
  const answer = result.json as
    { rationale?: string; files?: { path: string; content: string }[] } | undefined;
  const changes = (answer?.files ?? [])
    .filter((f) => originals.has(f.path))
    .map((f) => ({ path: f.path, before: originals.get(f.path) ?? '', after: f.content }));
  if (changes.length === 0) return undefined;
  return { category, testId, provider: provider.name, rationale: answer?.rationale ?? '', changes };
}
