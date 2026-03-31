/**
 * ESLint plugin: component-size
 *
 * Warns when React component files (.tsx) exceed line thresholds.
 * Counts non-blank, non-comment lines only.
 *
 * - Warn at 300 lines
 * - Error at 500 lines
 * - Excludes components/ui/ (shadcn) and *.test.* files
 */

const plugin = {
  rules: {
    'max-lines': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce maximum non-blank, non-comment line count in .tsx component files',
        },
        schema: [
          {
            type: 'object',
            properties: {
              warnAt: { type: 'number', default: 300 },
              errorAt: { type: 'number', default: 500 },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          tooLong:
            'Component has {{count}} non-blank/non-comment lines ({{severity}} threshold: {{threshold}}). Consider splitting into smaller components.',
        },
      },
      create(context) {
        const options = context.options[0] || {}
        const warnAt = options.warnAt ?? 300
        const errorAt = options.errorAt ?? 500
        const filename = context.filename || context.getFilename()

        // Skip non-.tsx files
        if (!filename.endsWith('.tsx')) return {}

        // Skip shadcn/ui components and test files
        if (filename.includes('components/ui/') || filename.match(/\.test\./)) return {}

        return {
          'Program:exit'(node) {
            const sourceCode = context.sourceCode || context.getSourceCode()
            const lines = sourceCode.getText().split('\n')

            let inBlockComment = false
            let count = 0

            for (const line of lines) {
              const trimmed = line.trim()

              // Track block comments
              if (inBlockComment) {
                if (trimmed.includes('*/')) {
                  inBlockComment = false
                }
                continue
              }

              if (trimmed.startsWith('/*')) {
                if (!trimmed.includes('*/')) {
                  inBlockComment = true
                }
                continue
              }

              // Skip blank lines and single-line comments
              if (trimmed === '' || trimmed.startsWith('//')) continue

              count++
            }

            if (count >= errorAt) {
              context.report({
                node,
                messageId: 'tooLong',
                data: { count: String(count), severity: 'error', threshold: String(errorAt) },
              })
            } else if (count >= warnAt) {
              context.report({
                node,
                messageId: 'tooLong',
                data: { count: String(count), severity: 'warn', threshold: String(warnAt) },
              })
            }
          },
        }
      },
    },
  },
}

export default plugin
