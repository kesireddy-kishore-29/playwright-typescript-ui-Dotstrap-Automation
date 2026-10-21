# 6. Evidence is collected by a reporter, and everything is redacted

- Status: accepted
- Date: 2026-10-20 (redaction of traces added 2026-10-21)

## Context

Playwright writes video and traces after a test's fixtures have torn down, so a fixture cannot copy
them. The same evidence layout is used by all four repositories of the family, and the tools
(triage, reports, healing) read it. And evidence leaves the machine: CI artifacts, Pages, committed
samples.

## Decision

- A custom reporter (`src/evidence/reporter.ts`) copies each kept attempt into
  `run-evidence/<repo>/<run-id>/<suite>/<test>/<attempt>/`, writes `run-summary.json`,
  `flaky-report.json` and `metrics.json` (axe scans, navigation timings, visual differences), and
  builds a failure bundle per failed test.
- `RECORD_MODE` (`failures`, `all`, `off`) controls video, trace and screenshots.
- Redaction everywhere: console logs, page sources, HAR files (headers, cookies, bodies), and
  Playwright traces (every JSON line walked; header lines inside text; text resources). The copies
  of traces that Allure and the HTML report keep are redacted too (`qa redact-traces`). A trace
  that cannot be redacted is not kept.

## Consequences

- Tools read one layout in every repository of the family.
- Trace redaction was added after a review found the test account's session cookie in a trace;
  a redacted real trace still opens in trace.playwright.dev.
- Passing `--reporter=…` on the command line replaces the configured reporters, which silently
  disables the evidence reporter; runs use the configured reporters.
