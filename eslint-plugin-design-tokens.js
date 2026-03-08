/**
 * ESLint Plugin: Design Token Enforcement
 *
 * Prevents hardcoded Tailwind colors in favor of theme tokens
 * Epic 7 Retrospective Action Item #2
 */

const HARDCODED_COLOR_PATTERNS = [
  // Hardcoded blue colors (should use bg-brand, text-brand, etc.)
  /\bbg-blue-\d+\b/,
  /\btext-blue-\d+\b/,
  /\bborder-blue-\d+\b/,
  /\bring-blue-\d+\b/,

  // Hardcoded gray colors (should use theme tokens)
  /\bbg-gray-\d+\b/,
  /\btext-gray-\d+\b/,
  /\bborder-gray-\d+\b/,

  // Hardcoded orange/amber colors (should use theme tokens)
  /\bbg-orange-\d+\b/,
  /\btext-orange-\d+\b/,
  /\bbg-amber-\d+\b/,
  /\btext-amber-\d+\b/,

  // Hardcoded green colors
  /\bbg-green-\d+\b/,
  /\btext-green-\d+\b/,

  // Hardcoded red colors
  /\bbg-red-\d+\b/,
  /\btext-red-\d+\b/,
]

const THEME_TOKEN_SUGGESTIONS = {
  'bg-blue': 'bg-brand or bg-brand-soft',
  'text-blue': 'text-brand',
  'border-blue': 'border-brand',
  'ring-blue': 'ring-brand',
  'bg-gray': 'bg-muted or bg-subtle',
  'text-gray': 'text-muted or text-subtle',
  'border-gray': 'border-muted',
  'bg-orange': 'bg-warning or theme token',
  'text-orange': 'text-warning or theme token',
  'bg-green': 'bg-success or theme token',
  'text-green': 'text-success or theme token',
  'bg-red': 'bg-error or theme token',
  'text-red': 'text-error or theme token',
}

function getSuggestion(hardcodedClass) {
  const prefix = hardcodedClass.split('-').slice(0, 2).join('-')
  return THEME_TOKEN_SUGGESTIONS[prefix] || 'a theme token'
}

export default {
  meta: {
    name: 'eslint-plugin-design-tokens',
    version: '1.0.0',
  },
  rules: {
    'no-hardcoded-colors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow hardcoded Tailwind color classes in favor of theme tokens',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          hardcodedColor: 'Hardcoded color "{{className}}" detected. Use {{suggestion}} instead for theme consistency and dark mode support.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            // Check className prop
            if (node.name.name !== 'className') return

            const value = node.value
            if (!value) return

            // Handle string literals
            if (value.type === 'Literal' && typeof value.value === 'string') {
              checkForHardcodedColors(value.value, node, context)
            }

            // Handle template literals
            if (value.type === 'JSXExpressionContainer' && value.expression.type === 'TemplateLiteral') {
              value.expression.quasis.forEach(quasi => {
                checkForHardcodedColors(quasi.value.raw, node, context)
              })
            }

            // Handle template string expressions (e.g., `bg-blue-${variant}`)
            if (value.type === 'JSXExpressionContainer' && value.expression.type === 'TemplateLiteral') {
              const fullString = value.expression.quasis.map(q => q.value.raw).join('EXPR')
              checkForHardcodedColors(fullString, node, context)
            }
          },
        }
      },
    },
  },
}

function checkForHardcodedColors(classString, node, context) {
  const classes = classString.split(/\s+/)

  classes.forEach(className => {
    for (const pattern of HARDCODED_COLOR_PATTERNS) {
      if (pattern.test(className)) {
        context.report({
          node,
          messageId: 'hardcodedColor',
          data: {
            className,
            suggestion: getSuggestion(className),
          },
        })
      }
    }
  })
}
