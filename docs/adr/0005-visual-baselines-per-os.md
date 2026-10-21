# 5. Visual baselines per operating system, generated where they are compared

- Status: accepted
- Date: 2026-10-21

## Context

Font rendering differs between Windows, macOS and Linux, so a screenshot taken on one never
matches another pixel for pixel. Raising the tolerance until they match would hide real changes.

## Decision

- Baselines are stored per platform: `tests/visual/__screenshots__/{platform}/…`.
- Tolerance stays strict (`maxDiffPixelRatio: 0.002`, animations off, caret hidden).
- Linux baselines are generated on the same runner image CI uses, by the one-off
  `visual-baselines.yml` workflow, which opens a pull request; a person reviews every image.
- CI includes the `visual` project only once Linux baselines exist.

## Consequences

- The repository currently has Windows baselines only, generated and inspected locally; the visual
  project does not yet run in CI (see known issues).
- An intended visual change means re-running the baseline workflow and reviewing its pull request.
- The `SUT_UI_CHAOS=restyle-table` switch proves the check works: an unintended style change failed
  exactly the 8 table baselines and left the 9 others green.
