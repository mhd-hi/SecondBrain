import antfu from '@antfu/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import testingLibrary from 'eslint-plugin-testing-library';

const nextCoreWebVitals = {
  name: 'next/core-web-vitals',
  plugins: {
    '@next/next': nextPlugin,
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
  },
};

export default antfu(
  {
    react: true,
    typescript: true,

    lessOpinionated: true,
    isInEditor: false,

    stylistic: false,

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
      '**/*.json',
      '**/*.md',
    ],
  },
  jsxA11y.flatConfigs.recommended,
  nextCoreWebVitals,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'perfectionist/sort-imports': 'off',
    },
  },
  {
    files: ['**/*.test.ts?(x)'],
    ...testingLibrary.configs['flat/react'],
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      'testing-library/no-container': 'off',
    },
  },
  {
    files: ['src/components/AIChat/AIChatAssistant.tsx'],
    rules: {
      'jsx-a11y/no-noninteractive-tabindex': 'off',
    },
  },
  {
    rules: {
      'antfu/no-top-level-await': 'off', // Allow top-level await
      'ts/consistent-type-definitions': ['error', 'type'], // Use `type` instead of `interface`
      'react/prefer-destructuring-assignment': 'off', // Vscode doesn't support automatically destructuring, it's a pain to add a new variable
      'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
      'node/prefer-global/process': 'off', // Allow using `process.env`
      'test/padding-around-all': 'error', // Add padding in test files
      'test/prefer-lowercase-title': 'off', // Allow using uppercase titles in test titles
      'react/no-context-provider': 'off', // Disable to prevent false positives with Radix UI components
      'no-console': 'off', // Allow console statements since they're handled by Sentry integration
    },
  },
);
