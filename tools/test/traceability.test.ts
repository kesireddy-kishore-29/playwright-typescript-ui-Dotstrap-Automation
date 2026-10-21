import { describe, expect, it } from 'vitest';
import { flatten } from '../src/shared/playwright-list';
import { matrix, matrixMarkdown, untraced } from '../src/traceability/traceability';

const report = {
  suites: [
    {
      title: 'e2e/login.spec.ts',
      file: 'e2e/login.spec.ts',
      suites: [
        {
          title: 'Sauce Demo sign-in',
          file: 'e2e/login.spec.ts',
          specs: [
            {
              title: 'valid credentials reach the inventory',
              tags: ['@smoke'],
              file: 'e2e/login.spec.ts',
              tests: [
                {
                  annotations: [{ type: 'feature', description: 'FEAT-LOGIN-01' }],
                  projectName: 'chromium',
                },
                {
                  annotations: [{ type: 'feature', description: 'FEAT-LOGIN-01' }],
                  projectName: 'mobile',
                },
              ],
            },
            {
              title: 'no id',
              tags: [],
              file: 'e2e/login.spec.ts',
              tests: [{ annotations: [], projectName: 'chromium' }],
            },
          ],
        },
      ],
    },
  ],
};

describe('traceability', () => {
  const tests = flatten(report);

  it('merges projects of the same test and keeps the title path', () => {
    expect(tests[0]?.projects).toEqual(['chromium', 'mobile']);
    expect(tests[0]?.titlePath).toEqual([
      'Sauce Demo sign-in',
      'valid credentials reach the inventory',
    ]);
  });

  it('reports tests without a feature ID', () => {
    expect(untraced(tests)).toEqual(['e2e/login.spec.ts › Sauce Demo sign-in › no id']);
  });

  it('builds a coverage matrix that shows uncovered features', () => {
    const rows = matrix(
      {
        features: [
          { id: 'FEAT-LOGIN-01', requirement: 'r' },
          { id: 'FEAT-CART-01', requirement: 'c' },
        ],
      },
      tests,
    );
    expect(rows).toEqual([
      { id: 'FEAT-LOGIN-01', requirement: 'r', tests: 1, projects: ['chromium', 'mobile'] },
      { id: 'FEAT-CART-01', requirement: 'c', tests: 0, projects: [] },
    ]);
    expect(matrixMarkdown(rows)).toContain('| FEAT-CART-01 | c | **0** |');
  });
});
