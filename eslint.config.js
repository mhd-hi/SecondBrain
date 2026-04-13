import antfu from '@antfu/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';
import jestDom from 'eslint-plugin-jest-dom';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import testingLibrary from 'eslint-plugin-testing-library';

export default antfu(
  {
    react: true,
    typescript: true,

    lessOpinionated: true,
    isInEditor: false,

    stylistic: {
      semi: true,
    },

    formatters: {
      css: true,
    },

    ignores: [
      'migrations/**/*',
      'next-env.d.ts',
      'node_modules/**/*',
      'public/**/*',
      'bun.lock',
      'yarn.lock',
      'package-lock.json',
      '.next',
      'node_modules',
      'dist',
      '*.json',
      '**/*.md',
    ],
  },
  jsxA11y.flatConfigs.recommended,
  nextPlugin.flatConfig.coreWebVitals,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@stylistic/indent': ['warn', 2],
    },
  },
  {
    files: ['**/*.test.ts?(x)'],
    ...testingLibrary.configs['flat/react'],
    ...jestDom.configs['flat/recommended'],
  },
  {
    rules: {
      'antfu/no-top-level-await': 'off', // Allow top-level await
      'style/brace-style': ['warn', '1tbs'], // Use the default brace style
      'ts/consistent-type-definitions': ['error', 'type'], // Use `type` instead of `interface`
      'react/prefer-destructuring-assignment': 'off', // Vscode doesn't support automatically destructuring, it's a pain to add a new variable
      'node/prefer-global/process': 'off', // Allow using `process.env`
      'test/padding-around-all': 'error', // Add padding in test files
      'test/prefer-lowercase-title': 'off', // Allow using uppercase titles in test titles
      'react/no-context-provider': 'off', // Disable to prevent false positives with Radix UI components
      'no-console': 'off', // Allow console statements since they're handled by Sentry integration
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      // Turn off the crashing rule; let Prettier handle indentation
      'style/indent': 'off',
      'style/eol-last': 'off',
      'style/operator-linebreak': 'off', // Let Prettier handle this (it always puts operators at end of line)
    },
  },
);
