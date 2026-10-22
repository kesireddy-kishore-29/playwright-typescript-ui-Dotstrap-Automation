## Self-healed: LOCATOR_DRIFT

> Proposed by `rule-based`. **Never auto-merged**: a person reviews, then merges or closes.

| | |
|---|---|
| Failure category | `LOCATOR_DRIFT` |
| Test | `chromium › hybrid/inbox.spec.ts › inbox, seeded through the API › the bell counts unread messages and reading one updates it everywhere` |
| Evidence | `failure-bundles/chromium-inbox-seeded-through-the-api-the-bell-counts-unread-messages-and-readin.zip` (run `ui-chaos-5`) |

### Root cause

No element matches getByTestId('unread-count') any more.

### Why this diff

No element carries data-test="unread-count" any more. The DOM at the moment of failure has data-test="unread-badge" (similarity 0.43): the closest id that shares a word with the old one and that no other locator already uses. The patch changes this locator wherever a page object or component uses it (2 file(s)); the tests and their assertions are untouched.

### Files changed (allowed paths only)

- `src/pages/demo/DemoPage.ts`
- `src/components/NotificationBell.ts`

### Guardrails

All passed: allowed paths, no forbidden constructs, no loosened checks.

### Verification (before → after)

Before: the test failed in the triaged run.

| Step | Result |
|---|---|
| lint | passed |
| type-check | passed |
| failing test, 3 consecutive runs | passed |
| surrounding suite (tests/hybrid/inbox.spec.ts) | passed |

---
Labels: `self-healed`
