# 3. The live smoke is a polite, read-only visitor

- Status: accepted
- Date: 2026-10-20

## Context

A status code of 200 says nothing about whether a client-rendered page works. Reading the real
production site catches what staging cannot: a broken deploy, a missing header, a page that
overflows on a phone. It is also someone's production, and its responses can name infrastructure.

## Decision

- Public pages only, listed in `src/config/live-pages.ts`; no crawling beyond the list.
- No sign-in, tokens, form submissions, data creation, or calls to the site's private backend.
- One worker; a user agent that names this project.
- Assertions on the rendered page: heading, title and meta, console and failed requests, security
  headers, overflow at four widths, both themes, navigation, a generous navigation-timing budget.
- No trace and no HAR are recorded for this project; policy headers are stored as
  `[policy not stored]`.
- Nightly only, `continue-on-error`; never gates a merge. Its evidence is a 7-day workflow artifact,
  never published to Pages and never committed.

## Consequences

- The site's owner (the author) learns about a broken production page by the next morning.
- A red live smoke is reported, not blocking: it is information about production, not about the
  pull request.
