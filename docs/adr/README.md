# Architecture decision records

One file per decision: context, decision, consequences (and alternatives where there were real
ones). A decision that changes gets a new record that supersedes the old one.

| #                                            | Decision                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| [1](0001-playwright-test.md)                 | Playwright Test as the runner                                            |
| [2](0002-three-targets.md)                   | Three targets, each for what only it can give                            |
| [3](0003-live-smoke-policy.md)               | The live smoke is a polite, read-only visitor                            |
| [4](0004-locators-role-first.md)             | Locators: role and name first, test ids as the healable layer            |
| [5](0005-visual-baselines-per-os.md)         | Visual baselines per operating system, generated where they are compared |
| [6](0006-evidence-reporter-and-redaction.md) | Evidence is collected by a reporter, and everything is redacted          |
| [7](0007-rules-first-triage.md)              | Triage by rules that read the DOM; a model only for UNKNOWN              |
| [8](0008-governed-self-healing.md)           | Self-healing proposes; people merge                                      |
| [9](0009-static-dashboard-and-allure.md)     | A static dashboard for the trend, Allure for the detail                  |
