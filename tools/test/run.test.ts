import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeTool, resolveScript } from '../src/healing/run';

describe('running node tools for the verifier', () => {
  it('finds a script the package does not export (ESLint does not export bin/eslint.js)', () => {
    expect(existsSync(resolveScript('eslint/bin/eslint.js'))).toBe(true);
  });

  it('reports a tool that cannot be found as a failed step instead of throwing', () => {
    const result = nodeTool('no-such-package/bin/x.js', [], process.cwd(), 10_000);
    expect(result.ok).toBe(false);
    expect(result.tail).toContain('Cannot resolve no-such-package/bin/x.js');
  });
});
