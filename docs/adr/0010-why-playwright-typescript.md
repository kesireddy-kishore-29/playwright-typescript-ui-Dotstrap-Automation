# 10. Why Playwright with TypeScript, in a repository of its own

- Status: accepted
- Date: 2026-10-20

## Context

These repositories are meant to show range to people hiring for QA and SDET roles. The author
analysed about 980 recent QA/SDET job descriptions (Naukri and Foundit): Selenium with Java is the
most common UI stack (46 to 61% of jobs), and Playwright is the fastest-growing UI tool, usually
listed as a must-have where it appears, typically with TypeScript. The author's day job is C#
with Selenium, so Playwright and TypeScript add range rather than repeat it.

## Decision

1. The UI flagship uses Playwright Test with TypeScript in strict mode, zod for configuration,
   ESLint with the Playwright plugin, Prettier, Husky, lint-staged and commitlint.
2. Each stack lives in its own repository (UI in TypeScript, API in Java, plus a Selenium and a
   Python lite repository), sharing feature IDs, triage categories, evidence layout and report
   formats. A reader sees one idiomatic project per stack.
3. Selenium is shown in its own lite repository, in Java, where it is most often used.

## Consequences

- The shared conventions are kept identical by hand across four repositories; the dashboard and
  gallery templates are copied byte for byte from the API flagship.
- The Selenium and Python lite repositories reuse this repository's self-hosted app in CI by
  checking out a pinned ref, rather than copying its code.
