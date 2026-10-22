# Failure: deliberate failures (demo) › DEMO: an element that exists but is not ready

| | |
|---|---|
| Category | **TIMING** (rules, rule `not-actionable`, confidence 0.75) |
| Next action | Propose a wait-on-condition fix; never a hard wait or a longer timeout. |
| Healable | yes |
| Test | `demo › demo/deliberate-failures.spec.ts › deliberate failures (demo) › DEMO: an element that exists but is not ready` |
| Features | FEAT-DEMO-01 |
| Run | `ui-demo-9` |
| Failing locator | `getByTestId('unread-count')` |

## Why

The element was found but not actionable in time.

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
    3 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 500ms

```

## Evidence

- video: `demo/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/2/video.webm`
- trace: `demo/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/2/trace.zip`
- screenshot: `demo/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/2/screenshot.png`
- fullpage: `demo/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/2/fullpage.png`
- page-source: `demo/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/2/page-source.html`
- console: `demo/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/2/console.log`
- network: `demo/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/2/network.har`
- bundle: `failure-bundles/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready/`
- bundleZip: `failure-bundles/demo-deliberate-failures-demo-demo-an-element-that-exists-but-is-not-ready.zip`

AI step: skipped (ANTHROPIC_API_KEY not set)
