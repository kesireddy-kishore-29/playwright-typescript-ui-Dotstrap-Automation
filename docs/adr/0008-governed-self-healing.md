# 8. Self-healing proposes; people merge

- Status: accepted
- Date: 2026-10-21

## Context

UI "self-healing" usually means a smarter selector picked at run time, or a longer wait. Both turn
red into green without anyone deciding, and both make the suite less precise over time.

## Decision

- Heals are code changes on a branch, never run-time substitutions.
- Only `LOCATOR_DRIFT`, `TIMING`, `TEST_DATA` and `CONTRACT_DRIFT` are healable.
- A heal may change only `src/pages`, `src/components`, `src/fixtures`, `src/data` and
  `src/clients`; tests, config, the evidence reporter, the app, CI, tools and decisions are
  forbidden. Guardrails in code refuse hard waits, skipped tests, `force: true`, suppressed checks,
  swallowed errors, positional or wildcard locators, a loosened console guard, removed checks and
  timeouts above 15 s.
- Verification on the branch: ESLint, type-check, the failing test 3 times in a row, its file, and
  every other failure the same fix claims to explain. Then a commit and, in CI, a pull request.
- Identical fixes share one branch; at most 3 pull requests per run and 2 attempts per failure per
  day; every outcome goes into `healing-log.json`.

## Consequences

- The real demo healed a renamed test id in 34 s, with the patch, PR body and verification kept.
- If anything fails in the middle of a heal, the branch is reset and deleted and the start branch
  restored (added after a crash once left the repository on a heal branch).
