// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.__mf__temp/**',
      '**/storybook-static/**',
      'apps/api/src/generated/**',
    ],
  },

  // Rules for every TypeScript/JavaScript file.
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: 'apps/*/tsconfig.json',
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-cycle': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // React apps: hooks rules and accessibility checks.
  {
    files: [
      'apps/{shell,dashboard,job-form,profile}/src/**/*.{ts,tsx}',
      'apps/storybook/{stories,.storybook}/**/*.{ts,tsx}',
    ],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: [
      'apps/{shell,dashboard,job-form,profile}/src/**/*.tsx',
      'apps/storybook/stories/**/*.tsx',
    ],
    ...jsxA11y.flatConfigs.strict,
  },

  // NestJS API: Node globals, and allow the decorated empty classes Nest uses for modules.
  {
    files: ['apps/api/**/*.{ts,mjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },

  // Remote modules like 'dashboard/App' only exist at runtime via Module Federation.
  {
    files: ['apps/shell/src/**/*.tsx'],
    rules: {
      'import-x/no-unresolved': ['error', { ignore: ['^dashboard/', '^jobForm/', '^profile/'] }],
    },
  },

  // Tests trade some strictness for readability (expect.any(), known-present results).
  {
    files: [
      '**/*.{spec,e2e-spec,test}.{ts,tsx}',
      'apps/api/test/**/*.ts',
      'apps/*/src/test/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
    },
  },

  // Config files and scripts are not part of any app's tsconfig, so skip type-aware rules there.
  {
    files: ['**/*.config.{js,ts,mts}', 'apps/api/scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.config.{js,ts,mts}'],
    rules: {
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
    },
  },

  // Keep this last: turns off style rules that would fight with Prettier.
  prettier,
);
