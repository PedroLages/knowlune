// SPDX-License-Identifier: LicenseRef-LevelUp-Premium
//
// Copyright (c) 2026 Pedro Lages. All rights reserved.
// This file is part of the Knowlune Premium distribution.
// Unauthorized copying, modification, or distribution is strictly prohibited.
// This code is NOT covered by the AGPL-3.0 license of the open-source core.

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const PREMIUM_DIR = path.resolve(__dirname, '..')
const PREMIUM_LICENSE_HEADER = 'SPDX-License-Identifier: LicenseRef-LevelUp-Premium'

/** Recursively collects all .ts and .tsx files under a directory, excluding __tests__ */
function collectFiles(dir: string, ext: string[] = ['.ts', '.tsx'], excludeDirs: string[] = ['__tests__']): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue
      results.push(...collectFiles(fullPath, ext, excludeDirs))
    } else if (ext.some(e => entry.name.endsWith(e))) {
      results.push(fullPath)
    }
  }
  return results
}

describe('premium code boundary', () => {
  const premiumFiles = collectFiles(PREMIUM_DIR)

  describe('license headers (AC3)', () => {
    it('should find at least one premium file', () => {
      expect(premiumFiles.length).toBeGreaterThan(0)
    })

    it.each(premiumFiles.map(f => [path.relative(PREMIUM_DIR, f), f]))(
      '%s contains the proprietary license header',
      (_name, filePath) => {
        const content = fs.readFileSync(filePath as string, 'utf-8')
        expect(content).toContain(PREMIUM_LICENSE_HEADER)
      }
    )

    it.each(premiumFiles.map(f => [path.relative(PREMIUM_DIR, f), f]))(
      '%s does NOT use AGPL as its SPDX license identifier',
      (_name, filePath) => {
        const content = fs.readFileSync(filePath as string, 'utf-8')
        // The SPDX line should NOT declare AGPL — it should be LicenseRef-LevelUp-Premium
        expect(content).not.toMatch(/SPDX-License-Identifier:\s*AGPL/)
      }
    )
  })

  describe('no circular imports (AC3)', () => {
    it.each(premiumFiles.map(f => [path.relative(PREMIUM_DIR, f), f]))(
      '%s does not import from core src/ (no circular dependency)',
      (_name, filePath) => {
        const content = fs.readFileSync(filePath as string, 'utf-8')
        // Premium files should not import from @/app/, @/lib/, @/stores/, etc.
        // They may import from @/premium/ (internal) or external packages
        const coreImports = content.match(/from\s+['"]@\/(app|lib|stores|db|data|styles)\//g)
        expect(coreImports).toBeNull()
      }
    )
  })
})
