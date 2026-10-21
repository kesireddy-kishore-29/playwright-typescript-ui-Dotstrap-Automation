# tools/

CI tooling, in TypeScript, run with `npm run qa -- <command>` (`tsx tools/src/cli.ts`):
triage, healing with guardrails, quarantine policy and flaky history, traceability, reports,
merging shard runs, and redacting the traces other reporters copy. Unit
tests in `tools/test` run with vitest (`npm run tools:test`). The same commands, categories and
JSON formats exist in Java in the API flagship.
