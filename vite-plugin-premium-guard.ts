/**
 * Vite plugin that blocks imports from `@/premium/*` (or `src/premium/`)
 * during the open-source core build.
 *
 * This ensures the AGPL distribution never accidentally includes
 * proprietary premium code.
 *
 * Usage:
 *   - Core build (vite.config.ts): plugin is ENABLED (blocks premium imports)
 *   - Premium build (vite.config.premium.ts): plugin is DISABLED (allows premium imports)
 */

import type { Plugin } from 'vite'

export interface PremiumGuardOptions {
  /**
   * When true, the plugin is active and will error on any import
   * that resolves to src/premium/.
   * @default true
   */
  enabled?: boolean
}

/**
 * Patterns that indicate a premium import:
 * - `@/premium/` (alias path)
 * - `src/premium/` (relative path)
 * - `./premium/` or `../premium/` (relative from within src/)
 */
const PREMIUM_IMPORT_PATTERNS = [
  /['"]@\/premium\//,
  /from\s+['"]\.\.?\/.*premium\//,
]

export function premiumImportGuard(options: PremiumGuardOptions = {}): Plugin {
  const { enabled = true } = options

  return {
    name: 'premium-import-guard',
    enforce: 'pre',

    resolveId(source, importer) {
      if (!enabled) return null

      // Check if this import targets the premium directory
      if (source.startsWith('@/premium/') || source.startsWith('@/premium')) {
        const importerDisplay = importer
          ? importer.replace(process.cwd() + '/', '')
          : 'unknown'
        throw new Error(
          `[premium-import-guard] Importing from premium directory is not allowed in the core build.\n` +
          `  Import: "${source}"\n` +
          `  Importer: ${importerDisplay}\n` +
          `\n` +
          `Premium code must only be referenced through isPremium() guards with lazy loading.\n` +
          `Use \`npm run build:premium\` for premium builds.`
        )
      }

      return null
    },

    transform(code, id) {
      if (!enabled) return null

      // Skip node_modules, the plugin itself, test files, and files inside src/premium/
      if (
        id.includes('node_modules') ||
        id.includes('vite-plugin-premium-guard') ||
        id.includes('__tests__') ||
        id.includes('.test.') ||
        id.includes('.spec.') ||
        id.includes('src/premium/')
      ) {
        return null
      }

      // Check source code for premium import patterns
      for (const pattern of PREMIUM_IMPORT_PATTERNS) {
        if (pattern.test(code)) {
          const idDisplay = id.replace(process.cwd() + '/', '')
          throw new Error(
            `[premium-import-guard] File contains import from premium directory (core build).\n` +
            `  File: ${idDisplay}\n` +
            `  Pattern matched: ${pattern.source}\n` +
            `\n` +
            `Remove the premium import or use \`npm run build:premium\`.`
          )
        }
      }

      return null
    },
  }
}
