import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import designTokens from './eslint-plugin-design-tokens.js'
import reactHooksAsync from './eslint-plugin-react-hooks-async.js'
import importPaths from './eslint-plugin-import-paths.js'
import reactBestPractices from './eslint-plugin-react-best-practices.js'
import testPatterns from './eslint-plugin-test-patterns.js'

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  ignores: [
    'dist/',
    'node_modules/',
    'playwright-report/',
    'storybook-static/',
    'coverage/',
    'test-results/',
    '.claude/',
    '**/experiments/', // Experimental code - not production quality
    'docs/', // Documentation files
  ],
}, {
  plugins: {
    'design-tokens': designTokens,
    'react-hooks-async': reactHooksAsync,
    'import-paths': importPaths,
    'react-best-practices': reactBestPractices,
    'test-patterns': testPatterns,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'design-tokens/no-hardcoded-colors': 'error',
    'react-hooks-async/async-cleanup': 'error',
    'import-paths/correct-utils-import': 'error',
    'react-best-practices/no-inline-styles': 'warn',
  },
}, {
  // Test files - enable test anti-pattern rules
  files: ['tests/**/*.ts', 'tests/**/*.tsx'],
  rules: {
    'test-patterns/deterministic-time': 'error',
    'test-patterns/no-hard-waits': 'warn',
    'test-patterns/use-seeding-helpers': 'warn',
  },
}, {
  // Node.js script environment configuration
  files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
  languageOptions: {
    globals: {
      console: 'readonly',
      process: 'readonly',
      navigator: 'readonly',
      performance: 'readonly',
      document: 'readonly',
      Promise: 'readonly',
    },
  },
});
