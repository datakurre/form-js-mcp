// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import vitest from 'eslint-plugin-vitest';

export default tseslint.config(
  // ── Global ignores ────────────────────────────────────────────────────────
  { ignores: ['dist/', 'node_modules/', '*.config.*'] },

  // ── Base JS recommended rules ─────────────────────────────────────────────
  eslint.configs.recommended,

  // ── TypeScript recommended (type-aware off — no parserOptions.project) ────
  ...tseslint.configs.recommended,

  // ── Project-wide overrides ────────────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: {
      sonarjs,
      unicorn,
    },
    rules: {
      // ── Code-quality ────────────────────────────────────────────────────
      '@typescript-eslint/no-explicit-any': 'off',

      // Catch unused vars (ignore those starting with _)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Prefer type-only imports where possible (tree-shaking, clarity)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      // ── Maintainability ─────────────────────────────────────────────────
      // Disallow duplicate imports from the same module
      'no-duplicate-imports': 'error',

      // Require === and !==
      eqeqeq: ['error', 'always', { null: 'ignore' }],

      // No console.log (allow console.error for MCP stdio server)
      'no-console': ['error', { allow: ['error'] }],

      // Limit function complexity to keep handlers comprehensible
      complexity: ['error', 20],

      // Limit file length — signals when a module should be split.
      // Handler files include a ~40-line TOOL_DEFINITION schema (static data),
      // so the limit is slightly higher than typical application code.
      'max-lines': ['error', { max: 350, skipBlankLines: true, skipComments: true }],

      // Limit function length — keep handlers focused
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],

      // Prefer const over let when variable is never reassigned
      'prefer-const': 'error',

      // No var — use let/const
      'no-var': 'error',

      // No parameter reassignment (helps reason about data flow)
      'no-param-reassign': ['error', { props: false }],

      // ── SonarJS — duplicate code detection ──────────────────────────────
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      'sonarjs/cognitive-complexity': ['error', 20],

      // ── Unicorn — modernization ─────────────────────────────────────────
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      'unicorn/prefer-string-slice': 'error',
      'unicorn/prefer-node-protocol': 'error',

      // ── Style consistency ───────────────────────────────────────────────
      curly: ['error', 'multi-line'],

      'no-trailing-spaces': 'off',
    },
  },

  // ── Test-specific relaxations ─────────────────────────────────────────────
  {
    files: ['test/**/*.ts'],
    plugins: {
      vitest,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'no-param-reassign': 'off',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'no-magic-numbers': 'off',

      // ── Vitest consistency ──────────────────────────────────────────────
      'vitest/consistent-test-it': ['error', { fn: 'test' }],
      'vitest/no-disabled-tests': 'error',
      'vitest/prefer-hooks-in-order': 'error',
    },
  }
);
