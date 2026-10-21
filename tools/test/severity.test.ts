import { describe, expect, it } from 'vitest';
import { severityOf } from '../../src/fixtures/base';

describe('Allure severity', () => {
  it('follows what the test is for', () => {
    expect(severityOf('chromium', ['@smoke'])).toBe('blocker');
    expect(severityOf('a11y', [])).toBe('critical');
    expect(severityOf('live', ['@live', '@smoke'])).toBe('minor');
    expect(severityOf('demo', ['@demo-failure'])).toBe('trivial');
    expect(severityOf('chromium', [])).toBe('normal');
  });
});
