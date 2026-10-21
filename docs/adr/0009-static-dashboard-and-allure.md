# 9. A static dashboard for the trend, Allure for the detail

- Status: accepted
- Date: 2026-10-21

## Context

Playwright's HTML report is excellent for one run; Allure adds history and categories. Neither
shows triage, healing, quarantine, feature coverage, accessibility by impact, performance budgets
or visual differences in one place, or the same view as the API flagship.

## Decision

- One static `index.html` dashboard, its template byte-identical with the API flagship's, fed with
  this repository's data and three UI sections: accessibility by impact (the documented defects
  page kept apart), performance budgets, and visual differences (expected, actual, difference). A
  section appears only when its suite ran.
- Allure 2 with environment info, categories mirroring triage, and history carried from the last
  published report.
- A run gallery and the step summary (also the PR comment), as in the API flagship.

## Consequences

- The nightly publishes dashboard, gallery and Allure to GitHub Pages with their history.
- Allure results contain Playwright's own trace copies; they are redacted before the report is
  generated.
