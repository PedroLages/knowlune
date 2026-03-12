/**
 * ESLint Plugin: React Best Practices
 * Enforces Tailwind utilities over inline styles
 * Epic 10 Code Quality Initiative
 */

export default {
  meta: {
    name: 'eslint-plugin-react-best-practices',
    version: '1.0.0',
  },
  rules: {
    'no-inline-styles': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Discourage inline styles in favor of Tailwind utilities',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          inlineStyleDetected:
            'Inline style detected. Prefer Tailwind utility classes or theme.css variables. ' +
            'Exceptions: dynamic transforms (Framer Motion), shadcn/ui components (src/app/components/ui/), prototypes.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (node.name.name !== 'style') return

            // Get the file path
            const filename = context.getFilename()

            // Skip exception directories
            if (
              filename.includes('/ui/') ||
              filename.includes('/prototypes/') ||
              filename.includes('/examples/') ||
              filename.includes('PdfViewer')
            ) {
              return
            }

            // Check if the style value contains dynamic identifiers (Framer Motion pattern)
            // e.g., style={{ rotateX, rotateY }} or style={{ transform: someVar }}
            const hasDynamicProps = node.value &&
              node.value.type === 'JSXExpressionContainer' &&
              node.value.expression.type === 'ObjectExpression' &&
              node.value.expression.properties.some(prop => {
                // If property value is an Identifier (not a literal), it's dynamic
                if (prop.value && prop.value.type === 'Identifier') {
                  return true
                }
                // If it's a template literal or expression, it's dynamic
                if (
                  prop.value &&
                  (prop.value.type === 'TemplateLiteral' ||
                    prop.value.type === 'CallExpression')
                ) {
                  return true
                }
                return false
              })

            if (hasDynamicProps) {
              // Allow dynamic styles (Framer Motion, etc.)
              return
            }

            // Report inline style
            context.report({
              node,
              messageId: 'inlineStyleDetected',
            })
          },
        }
      },
    },
  },
}
