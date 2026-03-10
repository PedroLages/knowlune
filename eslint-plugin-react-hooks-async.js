/**
 * ESLint Plugin: React Hooks Async Cleanup Enforcement
 *
 * Detects useEffect hooks with async operations but no cleanup function
 * Epic 8 Retrospective Action Item #4
 */

export default {
  meta: {
    name: 'eslint-plugin-react-hooks-async',
    version: '1.0.0',
  },
  rules: {
    'async-cleanup': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require cleanup functions in useEffect hooks that perform async operations',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          missingCleanup:
            'useEffect with async operation ({{asyncType}}) must return cleanup function to prevent state updates after unmount. Use "let ignore = false" pattern.',
        },
        schema: [],
      },
      create(context) {
        return {
          CallExpression(node) {
            // Only check useEffect calls
            if (node.callee.type !== 'Identifier' || node.callee.name !== 'useEffect') {
              return
            }

            // Get the effect callback (first argument)
            const effectCallback = node.arguments[0]
            if (!effectCallback) return

            // Track what type of callback we have
            let callbackBody

            if (effectCallback.type === 'ArrowFunctionExpression') {
              callbackBody = effectCallback.body
            } else if (effectCallback.type === 'FunctionExpression') {
              callbackBody = effectCallback.body
            } else {
              return // Can't analyze other types
            }

            // If body is not a block statement, it's a single expression (likely safe)
            if (callbackBody.type !== 'BlockStatement') {
              return
            }

            // Check if there's a return statement with cleanup
            const hasCleanupReturn = callbackBody.body.some(
              stmt =>
                stmt.type === 'ReturnStatement' &&
                stmt.argument &&
                (stmt.argument.type === 'ArrowFunctionExpression' ||
                  stmt.argument.type === 'FunctionExpression')
            )

            // Detect async patterns in the effect body
            const asyncPattern = detectAsyncPattern(callbackBody)

            // If async pattern found but no cleanup, report error
            if (asyncPattern && !hasCleanupReturn) {
              context.report({
                node: effectCallback,
                messageId: 'missingCleanup',
                data: {
                  asyncType: asyncPattern,
                },
              })
            }
          },
        }
      },
    },
  },
}

/**
 * Detect async patterns in useEffect body
 * Returns the type of async operation if found, null otherwise
 */
function detectAsyncPattern(blockStatement) {
  for (const stmt of blockStatement.body) {
    // Pattern 1: async function declaration
    // async function fetchData() { ... }
    if (stmt.type === 'FunctionDeclaration' && stmt.async) {
      return 'async function declaration'
    }

    // Pattern 2: variable declaration with async function
    // const fetchData = async () => { ... }
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (
          decl.init &&
          (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression') &&
          decl.init.async
        ) {
          return 'async arrow/function'
        }
      }
    }

    // Pattern 3: Expression statement with .then() (Promise)
    // db.importedVideos.where().then(...)
    // fetch().then(...)
    if (stmt.type === 'ExpressionStatement') {
      if (hasThenCall(stmt.expression)) {
        return 'Promise .then()'
      }
    }

    // Pattern 4: Variable declaration with .then()
    // const result = fetch().then(...)
    if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        if (decl.init && hasThenCall(decl.init)) {
          return 'Promise .then()'
        }
      }
    }

    // Pattern 5: Expression statement calling async function
    // fetchData()
    if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression') {
      // Check if it's calling a function defined as async earlier
      const callee = stmt.expression.callee
      if (callee.type === 'Identifier') {
        // Look for async function with same name in earlier statements
        for (const prevStmt of blockStatement.body) {
          if (prevStmt === stmt) break // Don't look beyond current statement
          if (
            prevStmt.type === 'FunctionDeclaration' &&
            prevStmt.async &&
            prevStmt.id &&
            prevStmt.id.name === callee.name
          ) {
            return 'async function call'
          }
          if (prevStmt.type === 'VariableDeclaration') {
            for (const decl of prevStmt.declarations) {
              if (
                decl.id.type === 'Identifier' &&
                decl.id.name === callee.name &&
                decl.init &&
                (decl.init.type === 'ArrowFunctionExpression' ||
                  decl.init.type === 'FunctionExpression') &&
                decl.init.async
              ) {
                return 'async function call'
              }
            }
          }
        }
      }
    }
  }

  return null
}

/**
 * Check if expression contains a .then() call
 */
function hasThenCall(node) {
  if (!node) return false

  // Direct .then() call
  if (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === 'then'
  ) {
    return true
  }

  // Check chained calls (e.g., .where().then())
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
    return hasThenCall(node.callee.object)
  }

  return false
}
