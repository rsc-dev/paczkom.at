// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/** Globals that `src/core/**` must never touch: the core is pure and headless. */
const BANNED_CORE_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'location',
  'fetch',
  'performance',
  'requestAnimationFrame',
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'src/core must be deterministic: use core/rng.ts with an explicit RNG state.',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'src/core must be pure: time enters the reducer through tick(dtMs) actions only.',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...BANNED_CORE_GLOBALS.map((name) => ({
          name,
          message: 'src/core must stay free of DOM and browser APIs.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message: 'src/core must be deterministic: use core/rng.ts with an explicit RNG state.',
        },
      ],
    },
  },
  {
    files: ['*.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
