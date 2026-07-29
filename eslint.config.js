// @ts-check
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import functional from 'eslint-plugin-functional';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tseslint,
      functional,
    },
    rules: {
      ...tseslint.configs.recommended.rules,

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          fixToUnknown: false,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true },
      ],

      'functional/no-let': 'warn',
      'functional/no-loop-statements': 'off',
      'functional/no-classes': 'off',
      'functional/no-this-expressions': 'off',

      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Use named exports instead of default exports — keeps refactors and imports explicit across the codebase.',
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Only src/**/*.ts is covered by tsconfig.json's "include", so type-aware
    // rules (which need a real program) are scoped here rather than to all
    // *.ts files — root-level tooling configs stay on the simpler, type-free path.
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      functional,
    },
    rules: {
      // Agent state and signal payloads should be constructed, not mutated in
      // place, so a signal always reflects a consistent snapshot at the
      // moment it was emitted.
      'functional/immutable-data': [
        'warn',
        { ignoreImmediateMutation: true },
      ],
    },
  },
  {
    // Tooling config files are required by their consumers (Vitest, ESLint) to
    // use a default export, so the project-wide named-exports rule doesn't apply.
    files: ['*.config.ts', '*.config.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
