/**
 * ESLint Plugin: Test Anti-Pattern Detection
 *
 * Enforces deterministic testing patterns for Playwright E2E tests
 * Epic 10 Code Quality Initiative
 */

export default {
  meta: {
    name: 'eslint-plugin-test-patterns',
    version: '1.0.0',
  },
  rules: {
    'deterministic-time': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require deterministic time functions from test-time.ts',
          category: 'Test Quality',
          recommended: true,
        },
        messages: {
          nonDeterministicTime:
            'Non-deterministic time pattern "{{pattern}}" detected. ' +
            'Use FIXED_DATE, getRelativeDate(), or addMinutes() from tests/utils/test-time.ts. ' +
            'Exception: Date mocking in page.addInitScript() is allowed.',
        },
        schema: [],
      },
      create(context) {
        let insideAddInitScript = false

        return {
          CallExpression(node) {
            // Track addInitScript context
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'addInitScript'
            ) {
              insideAddInitScript = true
            }

            // Detect Date.now()
            if (
              !insideAddInitScript &&
              node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'Date' &&
              node.callee.property.name === 'now'
            ) {
              context.report({
                node,
                messageId: 'nonDeterministicTime',
                data: { pattern: 'Date.now()' },
              })
            }
          },

          'CallExpression:exit'(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'addInitScript'
            ) {
              insideAddInitScript = false
            }
          },

          NewExpression(node) {
            if (!insideAddInitScript && node.callee.name === 'Date') {
              if (node.arguments.length === 0) {
                context.report({
                  node,
                  messageId: 'nonDeterministicTime',
                  data: { pattern: 'new Date()' },
                })
              }
            }
          },
        }
      },
    },

    'no-hard-waits': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Discourage waitForTimeout in favor of auto-retry assertions',
          category: 'Test Quality',
          recommended: true,
        },
        messages: {
          hardWaitDetected:
            'Hard wait with waitForTimeout() detected. Use Playwright auto-retry: ' +
            'expect().toBeVisible(), waitForSelector(), or waitForFunction(). ' +
            'If truly necessary, add a comment justification above this line.',
        },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'waitForTimeout'
            ) {
              const sourceCode = context.sourceCode || context.getSourceCode()
              const comments = sourceCode.getCommentsBefore(node)

              const hasJustification = comments.some(
                comment =>
                  comment.value.toLowerCase().includes('necessary') ||
                  comment.value.toLowerCase().includes('required') ||
                  comment.value.toLowerCase().includes('justification') ||
                  comment.value.toLowerCase().includes('intentional')
              )

              if (!hasJustification) {
                context.report({
                  node,
                  messageId: 'hardWaitDetected',
                })
              }
            }
          },
        }
      },
    },

    'use-seeding-helpers': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Encourage use of shared IndexedDB seeding helpers',
          category: 'Test Quality',
          recommended: true,
        },
        messages: {
          manualIndexedDBSeeding:
            'Manual IndexedDB seeding detected. Use shared helpers from ' +
            'tests/support/helpers/indexeddb-seed.ts: seedStudySessions(), ' +
            'seedImportedVideos(), seedImportedCourses(), seedContentProgress(). ' +
            'These helpers include retry logic and frame-accurate waits.',
        },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'evaluate'
            ) {
              const functionArg = node.arguments[0]
              if (!functionArg) return

              const sourceCode = context.sourceCode || context.getSourceCode()
              const functionText = sourceCode.getText(functionArg)

              if (
                functionText.includes('indexedDB.open') &&
                functionText.includes('ElearningDB')
              ) {
                context.report({
                  node,
                  messageId: 'manualIndexedDBSeeding',
                })
              }
            }
          },
        }
      },
    },
  },
}
