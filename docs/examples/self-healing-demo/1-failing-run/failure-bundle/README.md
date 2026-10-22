# Failure bundle: inbox, seeded through the API › the bell counts unread messages and reading one updates it everywhere

| | |
|---|---|
| Test | `chromium › hybrid/inbox.spec.ts › inbox, seeded through the API › the bell counts unread messages and reading one updates it everywhere` |
| Features | FEAT-INBOX-02 |
| Run | `ui-chaos-6` |
| Attempts | 1 |
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
Error: expect(locator).toHaveText(expected) failed

Locator: getByTestId('unread-count')
Expected: "2"
Timeout: 7000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" getByTestId('unread-count') with timeout 7000ms
  - waiting for getByTestId('unread-count')

```
