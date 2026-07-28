import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig(
  // `scripts/smoke` is compiled against the *published* package inside a throwaway project, so it
  // resolves nothing here and cannot be type-aware linted.
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.changeset/**', 'scripts/smoke/**'] },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The published surface must be explicit: no inferred `any` leaking into .d.ts.
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      // This SDK is server-only: the API key must never reach a browser bundle.
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'This SDK is Node-only. Browser globals are forbidden.' },
        { name: 'document', message: 'This SDK is Node-only. Browser globals are forbidden.' },
        { name: 'localStorage', message: 'This SDK is Node-only. Browser globals are forbidden.' },
        {
          name: 'sessionStorage',
          message: 'This SDK is Node-only. Browser globals are forbidden.',
        },
        {
          name: 'XMLHttpRequest',
          message: 'This SDK is Node-only. Browser globals are forbidden.',
        },
      ],
      'no-console': 'error',
    },
  },

  {
    files: ['tests/**/*.ts'],
    rules: {
      // Tests legitimately build malformed payloads and partial doubles.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  prettier,
);
