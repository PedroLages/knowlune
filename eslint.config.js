import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import designTokens from './eslint-plugin-design-tokens.js'

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ['dist/', 'node_modules/', 'playwright-report/', 'storybook-static/', 'coverage/', 'test-results/', '.claude/'],
}, {
  plugins: {
    'design-tokens': designTokens,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'design-tokens/no-hardcoded-colors': 'error',
  },
});
