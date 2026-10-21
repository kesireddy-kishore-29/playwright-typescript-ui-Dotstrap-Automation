import { defineConfig } from 'vitest/config';

// Unit tests for the CI tooling (triage, guardrails, reports) and the framework's pure helpers
// (redaction). Browser tests use Playwright.
export default defineConfig({
  test: {
    include: ['tools/test/**/*.test.ts'],
    environment: 'node',
  },
});
