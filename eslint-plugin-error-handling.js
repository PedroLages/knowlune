/**
 * ESLint Plugin: Error Handling
 * Enforces visible error feedback in catch blocks within event handlers
 * Epic 13 Retrospective — addresses 3-epic recurring silent failure pattern
 *
 * Rule: no-silent-catch
 * Flags catch blocks that don't include toast.error(), toast.warning(),
 * toastError(), or toastWarning() calls — meaning the user never sees
 * that something went wrong.
 *
 * Exceptions (won't flag):
 * - catch blocks with explicit "// silent-catch-ok" comment
 * - beforeunload event handlers (no UI available)
 * - test files (tests may intentionally catch without toast)
 * - catch blocks that re-throw (error propagates to caller)
 */

export default {
  meta: {
    name: 'eslint-plugin-error-handling',
    version: '1.0.0',
  },
  rules: {
    'no-silent-catch': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Require visible user feedback (toast) in catch blocks within event handlers and async functions',
          category: 'Error Handling',
          recommended: true,
        },
        messages: {
          silentCatch:
            'Catch block has no visible user feedback. Add toast.error() or toastError() so the user knows something went wrong. ' +
            'If silence is intentional, add a "// silent-catch-ok" comment inside the catch block. ' +
            'See docs/engineering-patterns.md § "Catch Blocks Must Surface Errors".',
        },
        schema: [],
      },
      create(context) {
        /**
         * Check if a node tree contains a toast call:
         * - toast.error(...), toast.warning(...)
         * - toastError(...), toastWarning(...)
         */
        function containsToastCall(node) {
          if (!node) return false

          // Direct toast.error() / toast.warning() call
          if (node.type === 'CallExpression') {
            const callee = node.callee
            // toast.error() or toast.warning()
            if (
              callee.type === 'MemberExpression' &&
              callee.object.type === 'Identifier' &&
              callee.object.name === 'toast' &&
              callee.property.type === 'Identifier' &&
              ['error', 'warning'].includes(callee.property.name)
            ) {
              return true
            }
            // toastError() or toastWarning() helper
            if (
              callee.type === 'Identifier' &&
              ['toastError', 'toastWarning'].includes(callee.name)
            ) {
              return true
            }
            // toastError.generic() or similar
            if (
              callee.type === 'MemberExpression' &&
              callee.object.type === 'Identifier' &&
              ['toastError', 'toastWarning'].includes(callee.object.name)
            ) {
              return true
            }
          }

          // Recurse into child nodes
          for (const key of Object.keys(node)) {
            if (key === 'parent') continue
            const child = node[key]
            if (child && typeof child === 'object') {
              if (Array.isArray(child)) {
                for (const item of child) {
                  if (item && typeof item.type === 'string' && containsToastCall(item)) {
                    return true
                  }
                }
              } else if (typeof child.type === 'string') {
                if (containsToastCall(child)) return true
              }
            }
          }

          return false
        }

        /**
         * Check if a catch block re-throws the error
         */
        function containsRethrow(catchBody) {
          if (!catchBody || !catchBody.body) return false
          return catchBody.body.some(
            (stmt) => stmt.type === 'ThrowStatement'
          )
        }

        /**
         * Check if catch block has a "silent-catch-ok" comment
         */
        function hasSilentCatchComment(node) {
          const sourceCode = context.getSourceCode
            ? context.getSourceCode()
            : context.sourceCode
          if (!sourceCode) return false

          // Check comments inside the catch block
          const comments = sourceCode.getCommentsInside
            ? sourceCode.getCommentsInside(node)
            : []
          return comments.some((comment) =>
            comment.value.includes('silent-catch-ok')
          )
        }

        /**
         * Check if we're inside a beforeunload handler
         */
        function isInsideBeforeUnload(node) {
          let current = node.parent
          while (current) {
            // Look for addEventListener('beforeunload', ...)
            if (
              current.type === 'CallExpression' &&
              current.callee &&
              current.callee.type === 'MemberExpression' &&
              current.callee.property &&
              current.callee.property.name === 'addEventListener' &&
              current.arguments &&
              current.arguments[0] &&
              current.arguments[0].type === 'Literal' &&
              current.arguments[0].value === 'beforeunload'
            ) {
              return true
            }
            // Look for window.onbeforeunload = ...
            if (
              current.type === 'AssignmentExpression' &&
              current.left &&
              current.left.type === 'MemberExpression' &&
              current.left.property &&
              current.left.property.name === 'onbeforeunload'
            ) {
              return true
            }
            current = current.parent
          }
          return false
        }

        return {
          CatchClause(node) {
            const filename = context.getFilename()

            // Skip test files
            if (
              filename.includes('/tests/') ||
              filename.includes('.test.') ||
              filename.includes('.spec.')
            ) {
              return
            }

            // Skip stores — stores use set({ error }) pattern, not toast
            if (filename.includes('/stores/')) {
              return
            }

            // Skip AI pipeline, workers, and background services
            if (
              filename.includes('/ai/') ||
              filename.includes('.worker.') ||
              filename.includes('/workers/')
            ) {
              return
            }

            // Skip library/utility files — they throw or return errors, callers handle UI
            if (filename.includes('/lib/')) {
              return
            }

            // Skip database schema/migration files
            if (filename.includes('/db/')) {
              return
            }

            // Skip if has explicit opt-out comment
            if (hasSilentCatchComment(node)) {
              return
            }

            // Skip if inside beforeunload handler
            if (isInsideBeforeUnload(node)) {
              return
            }

            // Skip if catch re-throws
            if (containsRethrow(node.body)) {
              return
            }

            // Skip empty catch body (TypeScript sometimes requires empty catch)
            if (!node.body || !node.body.body || node.body.body.length === 0) {
              // Empty catch is still a problem — report it
              context.report({
                node,
                messageId: 'silentCatch',
              })
              return
            }

            // Check if catch body contains a toast call
            if (!containsToastCall(node.body)) {
              context.report({
                node,
                messageId: 'silentCatch',
              })
            }
          },
        }
      },
    },
  },
}
