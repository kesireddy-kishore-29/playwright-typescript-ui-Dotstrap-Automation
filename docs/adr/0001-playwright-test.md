# 1. Playwright Test as the runner

- Status: accepted
- Date: 2026-10-20

## Context

The suite needs several browsers and device profiles, network interception for states a backend
rarely produces, API calls in the same test as the UI, screenshots compared with baselines,
accessibility scans, and evidence (video, trace) on failure, with parallel workers.

## Decision

Playwright Test (TypeScript, strict): projects for `setup`, `chromium`, `mobile`, `visual`, `a11y`,
`live` and `demo`; fixtures instead of setup code; `page.route` for mocks; `request` for API calls;
`toHaveScreenshot` for visual checks; `@axe-core/playwright` for accessibility.

## Alternatives considered

- **Cypress**: strong developer experience, but one browser tab per test, an in-browser runner that
  complicates multi-origin and API-plus-UI tests, and parallelism tied to its cloud service.
- **WebdriverIO**: capable, but more assembly for the same result; the Selenium lite repo already
  shows the WebDriver protocol.

## Consequences

- One tool covers e2e, hybrid, mocked, visual, accessibility and performance tests.
- Playwright finalises video and traces after fixtures tear down, so evidence is collected in a
  reporter, not a fixture ([ADR 6](0006-evidence-reporter-and-redaction.md)).
