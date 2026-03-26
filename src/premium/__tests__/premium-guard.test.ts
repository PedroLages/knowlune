// SPDX-License-Identifier: LicenseRef-LevelUp-Premium
//
// Copyright (c) 2026 Pedro Lages. All rights reserved.
// This file is part of the Knowlune Premium distribution.
// Unauthorized copying, modification, or distribution is strictly prohibited.
// This code is NOT covered by the AGPL-3.0 license of the open-source core.

import { describe, it, expect } from 'vitest'
import { premiumImportGuard } from '../../../vite-plugin-premium-guard'

describe('premiumImportGuard', () => {
  describe('plugin metadata', () => {
    it('has the correct plugin name', () => {
      const plugin = premiumImportGuard()
      expect(plugin.name).toBe('premium-import-guard')
    })

    it('enforces pre ordering', () => {
      const plugin = premiumImportGuard()
      expect(plugin.enforce).toBe('pre')
    })
  })

  describe('resolveId (enabled)', () => {
    it('throws on @/premium/ imports when enabled', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const resolveId = plugin.resolveId as (source: string, importer?: string) => null
      expect(() => resolveId('@/premium/index', '/src/app/routes.tsx')).toThrow(
        'premium-import-guard'
      )
    })

    it('throws on @/premium import (without trailing slash)', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const resolveId = plugin.resolveId as (source: string, importer?: string) => null
      expect(() => resolveId('@/premium', '/src/app/routes.tsx')).toThrow('premium-import-guard')
    })

    it('allows non-premium imports', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const resolveId = plugin.resolveId as (source: string, importer?: string) => null
      expect(resolveId('@/app/components/Layout', '/src/main.tsx')).toBeNull()
    })

    it('allows imports from @/lib/entitlement', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const resolveId = plugin.resolveId as (source: string, importer?: string) => null
      expect(
        resolveId('@/lib/entitlement/isPremium', '/src/app/components/PremiumGate.tsx')
      ).toBeNull()
    })

    it('includes the offending import path in the error message', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const resolveId = plugin.resolveId as (source: string, importer?: string) => null
      expect(() =>
        resolveId('@/premium/components/PremiumAnalyticsDashboard', '/src/app/routes.tsx')
      ).toThrow('Import: "@/premium/components/PremiumAnalyticsDashboard"')
    })
  })

  describe('resolveId (disabled)', () => {
    it('allows @/premium/ imports when disabled', () => {
      const plugin = premiumImportGuard({ enabled: false })
      const resolveId = plugin.resolveId as (source: string, importer?: string) => null
      expect(resolveId('@/premium/index', '/src/app/routes.tsx')).toBeNull()
    })
  })

  describe('transform (enabled)', () => {
    it('throws when source code contains @/premium/ import', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const transform = plugin.transform as (code: string, id: string) => null
      const code = `import { PremiumDashboard } from '@/premium/components/PremiumDashboard'`
      expect(() => transform(code, '/src/app/routes.tsx')).toThrow('premium-import-guard')
    })

    it('throws when source code contains relative premium import', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const transform = plugin.transform as (code: string, id: string) => null
      const code = `import { foo } from '../premium/bar'`
      expect(() => transform(code, '/src/app/components/SomeComponent.tsx')).toThrow(
        'premium-import-guard'
      )
    })

    it('allows source code without premium imports', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const transform = plugin.transform as (code: string, id: string) => null
      const code = `import { Button } from '@/app/components/ui/button'\nexport function Foo() { return null }`
      expect(transform(code, '/src/app/components/Foo.tsx')).toBeNull()
    })

    it('skips node_modules files', () => {
      const plugin = premiumImportGuard({ enabled: true })
      const transform = plugin.transform as (code: string, id: string) => null
      // Even if node_modules had a premium reference (unlikely), it should be skipped
      const code = `import { something } from '@/premium/foo'`
      expect(transform(code, '/node_modules/some-package/index.js')).toBeNull()
    })
  })

  describe('transform (disabled)', () => {
    it('allows premium imports in source when disabled', () => {
      const plugin = premiumImportGuard({ enabled: false })
      const transform = plugin.transform as (code: string, id: string) => null
      const code = `import { PremiumDashboard } from '@/premium/components/PremiumDashboard'`
      expect(transform(code, '/src/app/routes.tsx')).toBeNull()
    })
  })

  describe('defaults', () => {
    it('is enabled by default', () => {
      const plugin = premiumImportGuard()
      const resolveId = plugin.resolveId as (source: string, importer?: string) => null
      expect(() => resolveId('@/premium/index', '/src/app/routes.tsx')).toThrow(
        'premium-import-guard'
      )
    })
  })
})
