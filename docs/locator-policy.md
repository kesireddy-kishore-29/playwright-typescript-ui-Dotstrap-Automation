# Locator policy

A locator is an assertion about how a person finds something on the page. The best one fails only
when a person would also be lost, and survives every change that a person would not notice.

## Order of preference

| Rank | Locator                                       | Use it for                                                                                                                                                      | Example in this repository                            |
| ---- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1    | `getByRole(role, { name })`                   | Anything with a role: buttons, links, headings, dialogs, lists, regions, form controls                                                                          | `page.getByRole('dialog', { name: 'Notifications' })` |
| 2    | `getByLabel`, `getByPlaceholder`, `getByText` | Form fields with a label; text that is the thing itself                                                                                                         | `page.getByLabel('Email')`                            |
| 3    | `getByTestId` (`data-test`)                   | Things with no role or name that a person relies on: a count, a price, a status dot; and third-party markup we cannot change                                    | `page.getByTestId('unread-count')`                    |
| —    | CSS or XPath                                  | Never for an element a test interacts with. Allowed only to read document metadata (`<meta>`, `<link rel="canonical">`, the `data-theme` attribute on `<html>`) | `page.locator('link[rel="canonical"]')`               |

In `src/pages` and `src/components` today: 46 role locators, 9 label, placeholder or text locators,
24 test ids (20 of them on Sauce Demo, which exposes test ids widely), and 3 CSS locators for
metadata.

## Rules

- **Locators live in page objects and components.** A test reads `inbox.markRead('Q1 roadmap')`,
  not a selector. No test file calls a locator method (checked with a search over `tests/`).
- **Components take a root locator**, so the same class works wherever the piece appears (the data
  table on the items page, the bell in the header).
- **Scope instead of a fixed index.** Find a row by its content and act inside it
  (`table.row('Q1 roadmap').getByRole('button', { name: 'Delete Q1 roadmap' })`). A position is
  used only where the position is the meaning: the cell under the column whose header names it
  (`DataTable`, index computed from the header), the newest toast (`.last()`), the first message
  in a test about newest-first ordering, and, on the live site, the first level-1 heading and the
  first navigation link with a given name, because a site may repeat a link in several navigation
  landmarks (`PublicPage`).
- **Exact names.** No wildcard regular expressions for names; a regex is anchored (`/^Notifications/`).
- **Web-first assertions** (`await expect(locator).toHaveText(...)`) that wait for the state; no
  fixed waits, no `force: true`.
- **Accessible names must contain the visible label** (WCAG 2.5.3). The a11y suite found two buttons
  in the self-hosted app that broke this; both were fixed in the app, not worked around in the test.

## When a third party gets in the way

Sauce Demo's menu entries are `<a>` elements without `href`, so they have no link role. The page
object uses their test ids, and a comment says why. That is a finding against the site, recorded in
the [known issues](known-issues.md), not a licence to use test ids for convenience.

## How this meets self-healing

- Only **test-id drift** is healed automatically. When a test id disappears, the rule-based healer
  looks at the DOM captured at the moment of failure for the closest id that shares a word with the
  old one (similarity 0.35 or more) and that no other locator already uses, and renames it wherever
  a page object or component uses it.
- A changed **role or accessible name** is a product change that a user would notice. It is not
  healed; triage files it as a product question.
- The guardrails refuse any heal that adds `.first()`, `.last()`, `.nth()`, `exact: false`, a
  wildcard name, `force: true` or a fixed wait, or that allows a new console error.
