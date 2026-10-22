# Failure: inbox, seeded through the API › the bell counts unread messages and reading one updates it everywhere

| | |
|---|---|
| Category | **LOCATOR_DRIFT** (rules, rule `locator-not-found`, confidence 0.85) |
| Next action | Propose a locator fix (page object only) and verify it 3 times. |
| Healable | yes |
| Test | `chromium › hybrid/inbox.spec.ts › inbox, seeded through the API › the bell counts unread messages and reading one updates it everywhere` |
| Features | FEAT-INBOX-02 |
| Run | `ui-chaos-5` |
| Failing locator | `getByTestId('unread-count')` |

## Why

No element matches getByTestId('unread-count') any more.

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

## Evidence

- video: `hybrid/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/1/video.webm`
- trace: `hybrid/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/1/trace.zip`
- screenshot: `hybrid/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/1/screenshot.png`
- fullpage: `hybrid/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/1/fullpage.png`
- page-source: `hybrid/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/1/page-source.html`
- console: `hybrid/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/1/console.log`
- network: `hybrid/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/1/network.har`
- bundle: `failure-bundles/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin/`
- bundleZip: `failure-bundles/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin.zip`

AI step: skipped (ANTHROPIC_API_KEY not set)
