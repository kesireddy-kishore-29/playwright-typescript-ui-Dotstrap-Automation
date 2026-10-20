// Lint rules carry the framework's policies, so a violation fails CI rather than code review:
// no hard waits, no `any`, no non-null assertions, no raw locators in tests, no CSS/XPath chains.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import playwright from 'eslint-plugin-playwright';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const noHardWaits = {
  selector: "CallExpression[callee.property.name='waitForTimeout']",
  message: 'Hard wait. Wait for a condition instead (see docs/test-strategy.md).',
};
const noCssOrXpathChains = {
  selector:
    "CallExpression[callee.property.name='locator'] > Literal[value=/(^\\/\\/)|(^xpath=)|([>~+]|\\s)/]",
  message: 'CSS/XPath chain. Use role, label, text or test id (docs/locator-policy.md).',
};

export default defineConfig(
  {
    ignores: [
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'allure-results/',
      'allure-report/',
      'reports/',
      'run-evidence/',
      'docs/examples/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': ['error', noHardWaits, noCssOrXpathChains],
    },
  },
  {
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/no-force-option': 'error',
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/no-page-pause': 'error',
      'playwright/no-networkidle': 'error',
      'playwright/no-element-handle': 'error',
      'playwright/no-eval': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      // Tests talk to page objects and components, never to raw locators.
      'playwright/no-raw-locators': 'error',
      'playwright/expect-expect': [
        'error',
        { assertFunctionPatterns: ['^expect', '^assert', '^verify'] },
      ],
    },
  },
  {
    files: ['**/*.mjs', 'sut-ui/public/**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
);
