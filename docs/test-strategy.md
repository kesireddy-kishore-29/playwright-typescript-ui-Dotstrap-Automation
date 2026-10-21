# Test strategy

## What is under test

| Target                                          | Why it is here                                                                                                                                                                                                       | Gates merges?                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **sut-ui "Relay"** (self-hosted)                | An app we control: per-user data through an API, an unread badge and notification panel, loading, empty, error and rate-limited states, light and dark themes, a deliberately inaccessible page, and chaos switches. | Yes                                                               |
| **Sauce Demo** (public demo shop)               | A stable, widely known e-commerce flow: login, inventory, cart, checkout.                                                                                                                                            | Yes (it is static and stable; an outage is triaged `ENVIRONMENT`) |
| **dotstrap.com** (the author's production site) | A real site in production, read from the outside.                                                                                                                                                                    | No: nightly only, public pages only                               |

## Risks and how each is covered

| Risk                                                            | Covered by                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A journey breaks (login, cart, checkout, logout)                | `e2e` on desktop and a phone profile                                                                                                                                                                         |
| Data created through the API does not show, or does not go away | `hybrid`: seed through the API, check the UI, delete, check it is gone                                                                                                                                       |
| A rare backend state is unreadable or crashes the page          | `mocked-states`: 401 redirects to sign-in, 500 with a working retry, empty, slow with a loading state, one widget failing while the rest render, `rate_limited` and `quota_exceeded` show different messages |
| Layout breaks at some width or theme                            | `visual`: 4 widths × 2 themes per page, plus a no-overflow check at each                                                                                                                                     |
| The app becomes harder to use with a keyboard or screen reader  | `a11y`: axe with WCAG 2.1 A and AA on every app page and an open dialog; zero violations                                                                                                                     |
| A known-broken page changes in an unreviewed way                | `a11y`: the defects page must report exactly its reviewed rules (6), no more and no fewer                                                                                                                    |
| Pages get slow                                                  | `performance`: time to first byte, DOMContentLoaded and load against a budget per page                                                                                                                       |
| The console fills with errors nobody sees                       | A guard in `base.ts` fails any test that logs an unexpected console error or page error; failed requests are recorded in the evidence                                                                        |
| The live site answers 200 but shows a broken page               | `live`: the rendered heading, title and meta, console, headers, overflow, both themes                                                                                                                        |
| Secrets leak into evidence                                      | Redaction of console logs, HAR files, page sources and Playwright traces, with unit tests                                                                                                                    |

## Layers (the pyramid)

| Layer                                                                               | Where                         | Runs                                                                            |
| ----------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------- |
| Tool and helper unit tests (triage, guardrails, healers, reports, merge, redaction) | `tools/test` (vitest)         | Every build                                                                     |
| Smoke, e2e, hybrid, mocked states, performance                                      | `chromium`, `mobile` projects | Every pull request                                                              |
| Accessibility                                                                       | `a11y` project                | Every pull request                                                              |
| Visual                                                                              | `visual` project              | Every pull request once Linux baselines exist ([known issues](known-issues.md)) |
| Live smoke                                                                          | `live` project                | Nightly, never gating                                                           |

Unit and component tests of the app itself would sit in the app's own repository; this repository
tests from the outside.

## Environments

| Setting                     | Default                     | Notes                                                                     |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------- |
| `APP_BASE_URL` / `APP_PORT` | `http://localhost:4173`     | sut-ui, started by Playwright's `webServer` (reused locally, fresh on CI) |
| `SAUCE_BASE_URL`            | `https://www.saucedemo.com` | Public demo credentials only                                              |
| `LIVE_BASE_URL`             | `https://dotstrap.com`      | Pages listed in `src/config/live-pages.ts`                                |
| `CI`                        | `false`                     | Retries 2 and 2 workers on CI; 0 retries and 4 workers locally            |

All settings are read once and validated with zod at start-up (`src/config/env.ts`); a bad value
stops the run with a message naming it.

## Test data and sessions

- The `setup` project signs in to Sauce Demo once and saves the session; tests start signed in.
- Each worker creates its own Relay account through the API, saves its session, and deletes the
  account at the end; the deletion is checked. Tests that create messages or items delete them and
  check that they are gone.
- Every name a test creates starts with `qa-` and is unique, so parallel tests never collide and
  leftovers can be found.

## Locators

Role and accessible name first, then label, placeholder or text, then test id; no CSS or XPath
chains. Details and the reasons: [locator-policy.md](locator-policy.md).

## What gates a merge

The pull-request gate (`ci.yml`): lint, format, type-check, tool unit tests, traceability (every test
has a feature ID), the quarantine policy, then the `chromium`, `mobile` and `a11y` projects (and
`visual` when Linux baselines are present), without quarantined tests. Quarantined tests run in a
separate, non-gating step.

The nightly (`nightly.yml`) runs the same projects in three shards with up to two retries, runs the
live smoke and the quarantined tests, and publishes the dashboard and Allure report with history.
It never blocks a merge.

## The live smoke

The live smoke reads the public pages of the author's production site the way a visitor would:

- Public pages only, listed in `src/config/live-pages.ts`. No crawling beyond that list.
- No sign-in, no tokens, no form submissions, no data created, no calls to the site's private
  backend or API.
- One worker, and a user agent that names this project.
- No trace and no HAR are recorded (the site's headers name infrastructure that is not ours to
  store); policy headers are stored as `[policy not stored]`.
- Never gates a merge; its evidence is a 7-day workflow artifact, never published or committed.

## Flaky tests and quarantine

- A test that fails and then passes on a retry is reported as **flaky**, never as passed.
- The nightly records flaky tests in a 30-day history. A test flaky 3 or more times in 14 days is
  proposed for quarantine by pull request (`@quarantine` tag plus an entry in `quarantine.json`);
  a person decides.
- An entry needs an owner, a reason and an expiry date. `quarantine-check` fails on an expired,
  ownerless or unmatched entry, or on a tagged test without an entry.

## Failures: triage and healing

Every failure is put in one of seven categories by rules that read the error, the failing locator
and the DOM at the moment of failure. An optional model step may reclassify only `UNKNOWN`. Healable
categories get a fix proposed on a branch, behind guardrails and verification, never merged
automatically. Details: [self-healing.md](self-healing.md).

## Evidence

`RECORD_MODE=failures` (default) keeps, for each failed attempt: video, a redacted trace, a
screenshot and a full-page screenshot, the console log, a redacted HAR, the page source and
metadata. `all` keeps it for every test; `off` keeps only the run summary. Details:
[reporting.md](reporting.md).

## Not covered here

Cross-browser runs beyond Chromium and the phone profile, load testing, and anything behind the
author's private systems.
