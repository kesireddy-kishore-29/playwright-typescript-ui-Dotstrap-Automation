# tests/

One folder per kind of test, matched to Playwright projects in `playwright.config.ts`: `smoke`,
`e2e`, `hybrid`, `mocked-states`, `performance` (chromium, and `@mobile` ones on a phone),
`visual`, `a11y`, `live` (nightly, dotstrap.com public pages), `demo` (fails on purpose) and
`setup`. Tests hold intent and assertions; locators and setup live in `src/`. Every test carries a
`feature` annotation from [`features.json`](../features.json).
