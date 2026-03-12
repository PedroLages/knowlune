/**
 * ESLint Plugin: Import Path Enforcement
 * Prevents shadcn CLI from installing components with incorrect import paths
 * Epic 10 Code Quality Initiative
 */

export default {
  meta: {
    name: 'eslint-plugin-import-paths',
    version: '1.0.0',
  },
  rules: {
    'correct-utils-import': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce correct import path for cn utility',
          category: 'Best Practices',
          recommended: true,
        },
        messages: {
          incorrectUtilsPath:
            'Incorrect import path "{{path}}" detected. This project uses "./utils" (relative) for the cn utility, not "@/lib/utils". ' +
            'Fix: import { cn } from "./utils"',
        },
        fixable: 'code',
        schema: [],
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            // Check if importing from @/lib/utils
            if (node.source.value === '@/lib/utils') {
              // Check if importing cn specifically
              const importsCn = node.specifiers.some(
                spec =>
                  spec.type === 'ImportSpecifier' &&
                  spec.imported.name === 'cn'
              )

              if (importsCn) {
                context.report({
                  node: node.source,
                  messageId: 'incorrectUtilsPath',
                  data: { path: node.source.value },
                  fix(fixer) {
                    return fixer.replaceText(node.source, '"./utils"')
                  },
                })
              }
            }
          },
        }
      },
    },
  },
}
