# Known issues and limits

Everything below is stated as it is. Where something was not run, it says so.

## Not verified yet

| What                           | State                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Actions**             | `ci.yml`, `nightly.yml`, `heal.yml` and `visual-baselines.yml` pass actionlint 1.7.12 with shellcheck 0.11.0, but have **never run on GitHub**: the repository had no remote while it was built. Not yet exercised: artifact hand-off between jobs, the sticky PR comment, GitHub Pages publishing, the quarantine-proposal pull request, label creation, `heal --open-prs`, the Linux baseline pull request. |
| **Linux visual baselines**     | Only Windows baselines exist (`__screenshots__/win32/`), generated and inspected locally. CI skips the `visual` project until `visual-baselines.yml` has run once and its pull request is merged.                                                                                                                                                                                                             |
| **Nightly sharding**           | Simulated locally only: two Playwright shards with separate evidence roots, merged with `npm run qa -- merge` (41 tests, the setup project counted once).                                                                                                                                                                                                                                                     |
| **AI step**                    | Never executed against the API: `ANTHROPIC_API_KEY` was not set on the development machine, so triage and healing report the AI step as skipped. The request shape and the handling of refusals and truncated answers are unit-tested.                                                                                                                                                                        |
| **Opening heal pull requests** | `heal` ran end to end locally and created a verified branch ([demo](examples/self-healing-demo/)). `--open-prs` was not run: there was no remote.                                                                                                                                                                                                                                                             |
| **Browsers**                   | Chromium and a Pixel 7 profile (Chromium) only. Firefox and WebKit are not part of any project.                                                                                                                                                                                                                                                                                                               |

## Behaviour to know about

- **Badges and links assume the GitHub account `kesireddy-kishore-29`.** Until the first workflow runs
  there, the CI and nightly badges show no status and the report link is empty; nothing in this
  repository claims a CI result.
- **The live site changes on its own schedule.** A content change on dotstrap.com can fail the live
  smoke with no change in this repository. The page list and the expected headings are in one file,
  [`src/config/live-pages.ts`](../src/config/live-pages.ts), so following the site is a one-file
  change. The live smoke never gates a merge, and its badge shows the last nightly result.
- **Pull requests opened by the workflow token do not start other workflows** (a GitHub rule). A heal
  or baseline pull request shows no CI until someone pushes to it or closes and reopens it.
- **`--reporter=…` on the command line replaces the configured reporters**, which switches off the
  evidence reporter and Allure. Run without it; the list reporter is already configured.
- **allure-playwright appends to `allure-results/`.** Delete the folder before a local run if you
  want a report of that run only. CI always starts clean.
- **Playwright's HTML report and Allure keep their own copies of traces.** They are redacted by
  `npm run qa -- redact-traces` (the Allure script and CI run it); a copy made by any other tool
  would not be.
- **Local evidence contains the checkout path** in error stacks (for example `D:\…\tests\hybrid\…`).
  On CI it is the runner's work folder. No user name or secret is in it.
- **Performance budgets are measured against a local server** and are tight on purpose; read the
  numbers as a trend, not as production performance. The live smoke has its own, generous budget.

## Findings against Sauce Demo

- Loading a deep link directly (for example `/inventory.html`) answers **HTTP 404** while the page
  still renders (a single-page-app fallback), and Chrome logs the 404 as a console error. The
  console guard allows exactly that message on Sauce Demo pages.
- The menu entries are `<a>` elements **without `href`**, so they have no link role and no
  accessible way to be found as links; the page object uses their test ids.
- Its error-reporting SDK posts to `events.backtrace.io` with a placeholder project
  (`universe=UNIVERSE`), and that service sometimes answers **401**, which Chrome logs as a
  console error. Found on 2026-10-21 in one of three runs (`mobile` sign-in test). It is
  third-party telemetry, not the page under test, so the console guard allows exactly those
  two submit endpoints on Sauce Demo pages.

## Defects these suites found in the self-hosted app (all fixed in the app)

- Concurrent 401 responses overwrote the `next=` return address with `/login`.
- Two buttons (the bell and "Mark read") had accessible names that did not contain their visible
  label (WCAG 2.5.3).
- The items table widened the page to 400 px at a 390 px viewport.

## Environment

Docker Desktop could not start its Linux engine on the development machine (WSL is not installed;
installing it needs administrator rights and a reboot). Nothing in this repository needs Docker,
but it is why the Linux baselines could not be produced locally.
