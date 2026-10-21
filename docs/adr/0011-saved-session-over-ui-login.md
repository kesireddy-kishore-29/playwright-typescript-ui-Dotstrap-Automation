# 11. Sign in once and reuse the session; never log in through the UI per test

- Status: accepted
- Date: 2026-10-20

## Context

Logging in through the form at the start of every test is slow, makes every test depend on the
login page, and multiplies the load on the sign-in endpoint. When the login page breaks, every test
fails and the real failures are buried.

## Decision

- Sauce Demo: the `setup` project signs in once and saves the browser state (`storageState`); every
  other test starts signed in.
- The self-hosted app: each worker creates its own account through the API, signs in through the
  API, saves the session cookie, and deletes the account at the end (the deletion is checked).
- The login form is tested by the login tests only, including the data-driven invalid and
  locked-out cases.

## Consequences

- A broken login page fails the login tests, not the whole suite.
- Workers never share an account, so tests run in parallel without seeing each other's data.
- A session can expire mid-run on a long nightly; the setup project runs again in every shard.
