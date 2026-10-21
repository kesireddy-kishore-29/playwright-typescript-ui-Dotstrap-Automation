# 4. Locators: role and name first, test ids as the healable layer

- Status: accepted
- Date: 2026-10-20

## Context

Locators decide how often tests break for reasons a user would never notice. Role and accessible
name locators break only when what a user perceives changes; they also keep the app accessible.
Test ids survive redesigns but say nothing about what a user sees, and they get renamed.

## Decision

Role and name first, then label, placeholder or text, then test id; CSS only for document
metadata. Locators live in page objects and components. Details: [locator-policy.md](../locator-policy.md).

Only test-id drift is healed automatically. A changed role or accessible name is a change a user
would notice, so it goes to a person.

## Consequences

- The a11y suite and the locators push in the same direction: an unnamed button is both a test
  problem and an accessibility problem (two such bugs were fixed in the app).
- Sauce Demo's menu links have no `href` and so no link role; its test ids are used and the finding
  is documented.
