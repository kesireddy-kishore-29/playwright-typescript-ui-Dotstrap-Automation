import { stripAnsi } from '../../../src/support/ansi';
import type { Category } from './categories';

export interface Classification {
  category: Category;
  confidence: number;
  classifiedBy: 'rules' | 'llm';
  rule: string;
  reason: string;
}

export interface FailureInput {
  project: string;
  message: string;
  failingLocator?: string;
  /** The DOM at failure (page-source.html), when it was captured. */
  pageSource?: string;
}

const NETWORK =
  /net::ERR_|ECONNREFUSED|ENOTFOUND|getaddrinfo|socket hang up|ETIMEDOUT|ECONNRESET|has been closed|webServer|status of 50[234]/;
const DOCUMENT_5XX = /document status[\s\S]*Received: 5\d\d/;
const TEST_DATA =
  /create test user|sign in through the API|seed message|create item|seeded (messages|items) deleted|worker account is really deleted|email_taken/;
const NOT_FOUND = /element\(s\) not found|resolved to 0 elements/;
/** An action that timed out; drift only when the locator never resolved to an element. */
const ACTION_TIMEOUT = /locator\.\w+: Timeout \d+ms exceeded/;
const NOT_ACTIONABLE =
  /element is not (visible|stable|enabled|attached)|intercepts pointer events|detached from the DOM/;
const VISUAL = /toHaveScreenshot|Screenshot comparison failed|pixels \(ratio/;
const ASSERTION = /\bExpected\b[\s\S]*\bReceived\b|expect\(.*\)\.(to\w+)/;
const TEST_TIMEOUT = /Test timeout of \d+ms exceeded/;
const CONTENT_ASSERTION = /toHaveText|toHaveTitle|toContainText|heading/;

function firstLine(text: string): string {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 200 ? `${line.slice(0, 200)}…` : line;
}

function rule(
  category: Category,
  confidence: number,
  name: string,
  reason: string,
): Classification {
  return { category, confidence, classifiedBy: 'rules', rule: name, reason };
}

/** The test id inside getByTestId('x'), if the failing locator is one. */
export function testIdOf(locator: string | undefined): string | undefined {
  return locator ? /getByTestId\('([^']+)'\)/.exec(locator)?.[1] : undefined;
}

/**
 * Deterministic triage over the Playwright error message, the failing locator and the DOM at
 * failure. Rules first: cheap, repeatable, explainable. An LLM may refine only UNKNOWN.
 */
export function classify(input: FailureInput): Classification {
  const { project } = input;
  const message = stripAnsi(input.message);
  if (NETWORK.test(message) || DOCUMENT_5XX.test(message)) {
    return rule(
      'ENVIRONMENT',
      0.9,
      'network',
      `The site or network did not answer: ${firstLine(message)}`,
    );
  }
  if (project === 'live' && !CONTENT_ASSERTION.test(message)) {
    return rule(
      'ENVIRONMENT',
      0.7,
      'live-non-content',
      'Live-site check failed without a content assertion failing.',
    );
  }
  if (TEST_DATA.test(message)) {
    return rule('TEST_DATA', 0.85, 'test-data', 'Seeding or cleanup of test data failed.');
  }
  if (message.includes('strict mode violation')) {
    return rule(
      'LOCATOR_DRIFT',
      0.85,
      'ambiguous-locator',
      'The locator now matches more than one element.',
    );
  }
  if (NOT_ACTIONABLE.test(message)) {
    return rule(
      'TIMING',
      0.75,
      'not-actionable',
      'The element was found but not actionable in time.',
    );
  }
  const neverResolved = ACTION_TIMEOUT.test(message) && !message.includes('locator resolved to');
  if (NOT_FOUND.test(message) || neverResolved) {
    const testId = testIdOf(input.failingLocator);
    if (testId && input.pageSource?.includes(`data-test="${testId}"`)) {
      return rule(
        'TIMING',
        0.7,
        'present-but-not-ready',
        `The element [data-test="${testId}"] exists but was not ready in time.`,
      );
    }
    return rule(
      'LOCATOR_DRIFT',
      0.85,
      'locator-not-found',
      `No element matches ${input.failingLocator ?? 'the locator'} any more.`,
    );
  }
  if (VISUAL.test(message)) {
    return rule(
      'PRODUCT_BUG',
      0.7,
      'visual-diff',
      'The page no longer matches its visual baseline; review the diff.',
    );
  }
  if (message.includes('console errors during the test')) {
    return rule(
      'PRODUCT_BUG',
      0.75,
      'console-error',
      'The page logged an unexpected console error.',
    );
  }
  if (ASSERTION.test(message)) {
    return rule(
      'PRODUCT_BUG',
      0.75,
      'behaviour-assertion',
      `A behaviour assertion failed: ${firstLine(message)}`,
    );
  }
  if (TEST_TIMEOUT.test(message)) {
    return rule('TIMING', 0.6, 'test-timeout', 'The test ran out of time.');
  }
  return rule('UNKNOWN', 0.3, 'no-rule-matched', 'No rule matched.');
}
