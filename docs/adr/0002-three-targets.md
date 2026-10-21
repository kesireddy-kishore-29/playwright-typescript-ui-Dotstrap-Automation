# 2. Three targets, each for what only it can give

- Status: accepted
- Date: 2026-10-20

## Context

Public demo sites have stable journeys but no per-user data, no notification state, no error
states on demand and nothing to break on purpose. A self-hosted app has all of that but is not
"real". A production site is real but must not be disturbed.

## Decision

- **sut-ui "Relay"** (in this repository): per-user API data for hybrid tests, unread state, error,
  empty, slow and rate-limited states, light and dark themes, a deliberately inaccessible page,
  chaos switches. Started by Playwright's `webServer`.
- **Sauce Demo**: the well-known shop journey (login, inventory, cart, checkout).
- **dotstrap.com public pages**: a nightly, read-only live smoke under a strict policy
  ([ADR 3](0003-live-smoke-policy.md)).

## Consequences

- The pull-request gate covers sut-ui and Sauce Demo; the live smoke never gates.
- Chaos switches make the self-healing and visual-regression demos reproducible.
- Two findings against Sauce Demo are documented rather than hidden (see known issues).
