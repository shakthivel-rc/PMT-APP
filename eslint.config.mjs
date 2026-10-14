import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';

/**
 * Flat config only — ESLint 10 removed eslintrc entirely, and a repo that had no linter
 * never has to migrate.
 *
 * The react-hooks rules are the reason this exists. Two `eslint-disable` comments already
 * sat in this tree with no ESLint behind them, and a memoised component does nothing when
 * its callbacks are inline arrows — `exhaustive-deps` catches unstable callbacks and stale
 * dependencies automatically rather than via a performance investigation.
 *
 * Existing violations live in `eslint-suppressions.json` (`--suppress-all`), so day one is
 * green with no disable comments and no source rewrite. NEW violations of the same rules
 * still fail. Shrink the file as you touch code: `npx eslint . --prune-suppressions`.
 */
export default defineConfig([
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'reports',
      'src/components/ui/**', // vendored shadcn/ui — owned copy-in, restored verbatim by `npx shadcn add`
    ],
  },

  js.configs.recommended,

  // `recommended`, deliberately not `recommendedTypeChecked`. The type-checked preset needs
  // projectService wiring and produces a very large first run; it is a separate decision.
  tseslint.configs.recommended,

  {
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  {
    files: ['**/*.{ts,tsx,mts,mjs,js}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // `tsc` already reports unused symbols under noUnusedLocals/noUnusedParameters, and
      // it understands type-only usage better. Leaving both on double-reports every hit.
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      // `_`-prefixed args and deliberate empty catch blocks are conventions this codebase
      // already uses; flagging them is noise rather than signal.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**', 'e2e-live/**'],
    rules: {
      // Test doubles and MSW handlers legitimately shed type information at the seam.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
