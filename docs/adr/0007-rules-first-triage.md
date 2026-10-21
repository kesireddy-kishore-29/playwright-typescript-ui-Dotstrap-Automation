# 7. Triage by rules that read the DOM; a model only for UNKNOWN

- Status: accepted
- Date: 2026-10-21

## Context

"Element not found" can mean a renamed test id (fix the locator), an element that exists but is not
ready (fix the wait), or a page that never loaded (environment). The error message alone does not
tell them apart; the DOM at the moment of failure does.

## Decision

Seven categories shared with the family. Rules, in order:

1. Network errors and 5xx documents → `ENVIRONMENT`.
2. A live-site failure without a content assertion → `ENVIRONMENT`.
3. Seeding or cleanup of test data failed → `TEST_DATA`.
4. A strict-mode violation (the locator matches several elements) → `LOCATOR_DRIFT`.
5. An element that is not visible, stable, enabled or attached → `TIMING`.
6. An element not found: if its test id is in the captured page source, it exists but was not
   ready → `TIMING`; otherwise → `LOCATOR_DRIFT`.
7. A screenshot difference, an unexpected console error, or a failed assertion on content →
   `PRODUCT_BUG`.
8. The test ran out of time → `TIMING`.
9. Anything else → `UNKNOWN`.

Only `UNKNOWN` may go to `claude-opus-5-5` (structured output, effort `medium`, server-side
fallback), and only with a key. A refusal or truncation is never read as an answer.

## Consequences

- Each triage record names the rule, the failing locator and the next action.
- The deliberate-failure demo lands in four different categories, one per path; the visual chaos
  run's 8 differences land in `PRODUCT_BUG`.
- The AI step has not run in this project (no key on the development machine).
