# Failure bundle: deliberate failures (demo) › DEMO: an element that exists but is not ready

| | |
|---|---|
| Test | `demo › demo/deliberate-failures.spec.ts › deliberate failures (demo) › DEMO: an element that exists but is not ready` |
| Features | FEAT-DEMO-01 |
| Run | `ui-demo-10` |
| Attempts | 2 |
| Failing locator | `getByTestId('unread-count')` |

## What is in here

| File | What it is | How to open |
|---|---|---|
| `attempt-N/video.webm` | The browser session, start to end | Any browser or video player |
| `attempt-N/trace.zip` | DOM snapshots, network, console and source per step | `npx playwright show-trace attempt-N/trace.zip` or https://trace.playwright.dev |
| `attempt-N/screenshot.png` | The viewport at the moment of failure | An image viewer |
| `attempt-N/fullpage.png` | The whole page at the moment of failure | An image viewer |
| `attempt-N/page-source.html` | The DOM at failure (redacted) | A browser or editor |
| `attempt-N/console.log` | Browser console and failed requests (redacted) | A text editor |
| `attempt-N/network.har` | Requests and responses, headers only, secrets masked | Chrome DevTools → Network → Import HAR |
| `attempt-N/meta.json` | Test identity, features, viewport, environment, git SHA | A JSON viewer |
| `triage.json` | Failure category and suggested next action (added by triage) | A JSON viewer |
| `failure-report.md` | One-page summary for a person (added by triage) | A Markdown viewer |

## Error

```text
TimeoutError: locator.click: Timeout 2000ms exceeded.
Call log:
  - waiting for getByTestId('unread-count')
    - locator resolved to <span hidden="" class="badge" data-test="unread-count">0</span>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    4 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 500ms

```
