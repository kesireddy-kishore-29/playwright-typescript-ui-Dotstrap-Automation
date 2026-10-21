import { describe, expect, it } from 'vitest';
import { classify, testIdOf } from '../src/triage/classifier';

const notFound = (locator: string) =>
  `Error: expect(locator).toHaveText(expected) failed\n\nLocator: ${locator}\nExpected: "2"\nReceived: <element(s) not found>`;

describe('UI failure classifier', () => {
  it.each([
    [
      'chromium',
      'Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/inbox',
      'ENVIRONMENT',
      'network',
    ],
    [
      'live',
      'Error: expect(received).toBeLessThan(expected)\nExpected: < 10000\nReceived: 12000',
      'ENVIRONMENT',
      'live-non-content',
    ],
    [
      'chromium',
      'Error: create test user\n\nExpected: 201\nReceived: 409',
      'TEST_DATA',
      'test-data',
    ],
    [
      'chromium',
      "Error: strict mode violation: getByRole('button', { name: 'Delete' }) resolved to 3 elements",
      'LOCATOR_DRIFT',
      'ambiguous-locator',
    ],
    ['chromium', 'Error: locator.click: element is not visible', 'TIMING', 'not-actionable'],
    [
      'visual',
      'Error: expect(page).toHaveScreenshot(expected) failed\n  1234 pixels (ratio 0.01 of all image pixels) are different.',
      'PRODUCT_BUG',
      'visual-diff',
    ],
    [
      'chromium',
      'Error: console errors during the test\n\nExpected: []\nReceived: ["boom"]',
      'PRODUCT_BUG',
      'console-error',
    ],
    [
      'chromium',
      'Error: expect(locator).toHaveText(expected) failed\nExpected: "2"\nReceived: "3"',
      'PRODUCT_BUG',
      'behaviour-assertion',
    ],
    ['chromium', 'Test timeout of 45000ms exceeded.', 'TIMING', 'test-timeout'],
    ['chromium', 'TypeError: Cannot read properties of undefined', 'UNKNOWN', 'no-rule-matched'],
  ] as const)('%s: %s -> %s', (project, message, category, rule) => {
    const result = classify({ project, message });
    expect(result.category).toBe(category);
    expect(result.rule).toBe(rule);
    expect(result.classifiedBy).toBe('rules');
  });

  it('a test id that no longer exists in the DOM is locator drift', () => {
    const result = classify({
      project: 'chromium',
      message: notFound("getByTestId('unread-count')"),
      failingLocator: "getByTestId('unread-count')",
      pageSource: '<span class="badge" data-test="unread-badge">2</span>',
    });
    expect(result.category).toBe('LOCATOR_DRIFT');
  });

  it('a value mismatch on a resolved element is a product bug (real, coloured Playwright message)', () => {
    const message =
      'Error: \u001b[2mexpect(\u001b[22mlocator).toHaveText(expected) failed\n\n' +
      'Locator:  getByRole(\'heading\')\nExpected: "Outbox"\nReceived: "Inbox"\n\nCall log:\n' +
      "  - waiting for getByRole('heading')\n    19 × locator resolved to <h1>Inbox</h1>";
    expect(classify({ project: 'chromium', message }).category).toBe('PRODUCT_BUG');
  });

  it('a click on a hidden element is timing (real Playwright message)', () => {
    const message =
      "TimeoutError: locator.click: Timeout 2000ms exceeded.\nCall log:\n  - waiting for getByTestId('unread-count')\n" +
      '    - locator resolved to <span hidden="" data-test="unread-count">0</span>\n      - element is not visible';
    expect(classify({ project: 'chromium', message }).category).toBe('TIMING');
  });

  it('an action whose locator never resolved is drift', () => {
    const message =
      "TimeoutError: locator.click: Timeout 2000ms exceeded.\nCall log:\n  - waiting for getByTestId('gone')";
    expect(
      classify({ project: 'chromium', message, failingLocator: "getByTestId('gone')" }).category,
    ).toBe('LOCATOR_DRIFT');
  });

  it('a test id that is present but not ready is timing, not drift', () => {
    const result = classify({
      project: 'chromium',
      message: notFound("getByTestId('unread-count')"),
      failingLocator: "getByTestId('unread-count')",
      pageSource: '<span class="badge" data-test="unread-count" hidden>0</span>',
    });
    expect(result.category).toBe('TIMING');
  });

  it('a live content assertion is a real finding, not environment', () => {
    const message =
      'Error: expect(locator).toHaveText(expected) failed\nLocator: heading\nExpected: /Anyone/\nReceived: "Gone"';
    expect(classify({ project: 'live', message }).category).toBe('PRODUCT_BUG');
  });

  it('reads the test id out of a locator', () => {
    expect(testIdOf("getByTestId('unread-count')")).toBe('unread-count');
    expect(testIdOf("getByRole('button')")).toBeUndefined();
  });
});
