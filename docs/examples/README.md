# Examples from real runs

Everything here was produced by local runs on 2026-10-21 and copied as it was written (the only
edit: the author's email is left out of the heal commit view).

| Folder | From | What it shows |
|---|---|---|
| [self-healing-demo/](self-healing-demo/) | `ui-chaos-4`, `ui-chaos-healed-4` | Locator drift: a renamed test id, one verified heal branch, 47/47 after |
| [failure-evidence/](failure-evidence/) | `ui-demo-9` | One failure bundle (an element that exists but is not ready, triaged `TIMING`): video, screenshot, report, and the zip with the redacted trace and HAR |
| [visual-regression/](visual-regression/) | `ui-visual-chaos-2` | `SUT_UI_CHAOS=restyle-table`: the dashboard's visual section and one expected/actual/diff set; all 8 differences triaged `PRODUCT_BUG` |
| [dashboard/](dashboard/) | `ui-allure-7`, `ui-allure-8`, `ui-allure-9`; gallery from `ui-demo-9` | The health dashboard (light, dark, 390 px) with a three-run trend, the run gallery and the Allure overview |
