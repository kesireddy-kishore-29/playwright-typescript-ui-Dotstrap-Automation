# evidence/

The evidence reporter: copies each kept attempt into the shared `run-evidence/` layout (with
redacted traces and HAR files), writes `run-summary.json`, `flaky-report.json` and `metrics.json`,
and builds a failure bundle per failed test. See [reporting](../../docs/reporting.md).
