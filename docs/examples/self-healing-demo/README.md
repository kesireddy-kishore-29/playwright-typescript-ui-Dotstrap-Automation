# Self-healing demo: a renamed test id (locator drift)

Everything in this folder comes from one real local run on 2026-10-22 (run IDs `ui-chaos-6` and
`ui-chaos-healed-6`). Nothing was edited except one thing: the commit view in
`2-heal/heal-commit.patch` leaves out the author's email.

## The scenario

The self-hosted app starts with `SUT_UI_CHAOS=rename-testid`. A developer has renamed the
notification badge's test id from `unread-count` to `unread-badge`. The badge looks and behaves
the same; only the hook the tests use is gone.

## What happened

| Step | Command | Result |
|---|---|---|
| 1. PR gate on `main` | `RUN_ID=ui-chaos-6 npx playwright test --project=chromium --project=mobile --project=a11y --grep-invert @quarantine` | 46 passed, **1 failed** ([run-summary](1-failing-run/run-summary.json)) |
| 2. Triage | `npm run qa -- triage --run run-evidence/playwright-typescript-ui-Dotstrap-Automation/ui-chaos-6` | `LOCATOR_DRIFT`, rule `locator-not-found`: `getByTestId('unread-count')` matches nothing ([triage](1-failing-run/triage/)) |
| 3. Heal | `npm run qa -- heal --run run-evidence/playwright-typescript-ui-Dotstrap-Automation/ui-chaos-6` | Branch `heal/locator-drift/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin-20261022` |
| 4. PR gate on the heal branch | same as step 1 with `RUN_ID=ui-chaos-healed-6` | **47 passed**, 0 failed ([run-summary](3-healed-run/run-summary.json)) |

The heal took 59 s, wall clock, including its verification runs. Inside it:

1. The rule-based healer read the DOM at the moment of failure (`page-source.html` in the failure
   bundle) and found `data-test="unread-badge"`: the closest id that shares a word with the old one
   and that no other locator already uses. It changed the locator wherever a page object or
   component used it: the `NotificationBell` component and the demo page object
   ([patch.diff](2-heal/patch.diff)). No test or assertion changed.
2. The guardrails passed: page objects and components only, no hard waits, no longer timeouts, no
   loosened locators.
3. The verifier ran ESLint and the type-check, the failing test 3 times in a row, then its whole
   file. All passed ([PR.md](2-heal/PR.md), [verification.json](2-heal/verification.json)).
4. The heal was committed on its branch with an entry in `healing-log.json`
   ([heal-commit.patch](2-heal/heal-commit.patch), [healing-log.json](2-heal/healing-log.json)).

## Files

| Path | What it is |
|---|---|
| `1-failing-run/run-summary.json` | The failing run: every test, status, error, evidence folder |
| `1-failing-run/triage-summary.json` | Failures by category for that run |
| `1-failing-run/triage/*.json` | The triage record: category, rule, failing locator, next action |
| `1-failing-run/failure-bundle/*.zip` | The whole failure bundle: video, trace, screenshots, console, HAR, page source, metadata |
| `1-failing-run/failure-bundle/screenshot.png` | The page when the test failed: the badge is there, its old id is not |
| `1-failing-run/failure-bundle/failure-report.md` | The one-page report triage adds to the bundle |
| `2-heal/PR.md` | The pull-request body the healer wrote |
| `2-heal/patch.diff` | The proposed change |
| `2-heal/verification.json` | Each verification step and its result |
| `2-heal/healing-summary.json`, `2-heal/healing-log.json` | The outcome and the ledger entry |
| `2-heal/heal-commit.patch` | The commit on the heal branch |
| `3-healed-run/run-summary.json` | The same gate on the heal branch: 47/47 |

The trace and HAR in the bundle are redacted: cookies, credential headers and secret fields are
masked. The trace still opens at https://trace.playwright.dev.

## What this demo did not do

- **No pull request was opened.** The run was local, with no remote involved. In CI, `heal.yml`
  runs the same command with `--open-prs`, which pushes the branch and opens the pull request
  with the label `self-healed`.
- **The AI step was skipped.** `ANTHROPIC_API_KEY` was not set. The rule-based healer handled this
  case on its own.
- **Nobody merged anything.** A person decides whether the rename was intended.

## Found and fixed while preparing this demo

- The verifier could not start ESLint (its package does not export `bin/eslint.js`), and the crash
  left the repository on the heal branch. Scripts now resolve next to the package, and any error
  inside a heal resets the heal branch and returns to the start branch.
- The heal commit message broke the commit rules (header over 100 characters), so the commit hook
  refused it. The header is now cut at 100 and the body wrapped.
- Playwright's own trace, and the copies Allure and the HTML report keep, held the test account's
  session cookie. Traces are now redacted wherever they are copied.
