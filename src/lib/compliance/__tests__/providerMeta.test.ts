import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PROVIDER_META, getProviderMeta } from '../providerMeta'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Parse provider IDs from the AI Provider Registry table in consent-inventory.md */
function parseInventoryProviderIds(markdown: string): Set<string> {
  // Find the AI Provider Registry section
  const sectionMatch = markdown.match(/## AI Provider Registry([\s\S]*?)(?=\n## |\n---|\s*$)/)
  const section = sectionMatch ? sectionMatch[1] : ''
  const ids = new Set<string>()
  const pattern = /^\|\s*`([a-z][a-z0-9_-]*)`/gm
  let match: RegExpExecArray | null
  while ((match = pattern.exec(section)) !== null) {
    ids.add(match[1])
  }
  return ids
}

// ---------------------------------------------------------------------------
// Provider registry parity test (mirrors consentParity.test.ts pattern)
// ---------------------------------------------------------------------------

describe('E119-S09: consent-inventory.md AI Provider Registry ↔ PROVIDER_META parity', () => {
  const inventoryPath = resolve(__dirname, '../../../../docs/compliance/consent-inventory.md')
  let inventoryProviderIds: Set<string>

  beforeAll(() => {
    expect(existsSync(inventoryPath)).toBe(true)
    const markdown = readFileSync(inventoryPath, 'utf-8')
    inventoryProviderIds = parseInventoryProviderIds(markdown)
    expect(inventoryProviderIds.size).toBeGreaterThan(0)
  })

  it('every provider in consent-inventory.md AI Provider Registry has an entry in PROVIDER_META', () => {
    const missing: string[] = []
    for (const id of inventoryProviderIds) {
      // 'unknown' is our synthetic fallback — not expected in the inventory
      if (!PROVIDER_META[id] && id !== 'unknown') {
        missing.push(id)
      }
    }
    expect(missing).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Structural tests
// ---------------------------------------------------------------------------

describe('PROVIDER_META', () => {
  it('has a non-empty displayName for openai', () => {
    expect(PROVIDER_META['openai'].displayName).toBeTruthy()
    expect(typeof PROVIDER_META['openai'].displayName).toBe('string')
  })

  it('contains all four registered provider IDs from consent-inventory.md', () => {
    const requiredIds = ['openai', 'anthropic', 'ollama', 'speaches']
    for (const id of requiredIds) {
      expect(PROVIDER_META).toHaveProperty(id)
    }
  })

  it('has an unknown fallback entry with a safe display name', () => {
    expect(PROVIDER_META['unknown']).toBeDefined()
    expect(PROVIDER_META['unknown'].displayName).toBeTruthy()
  })

  it('every entry has required fields', () => {
    for (const [id, meta] of Object.entries(PROVIDER_META)) {
      expect(meta.displayName, `${id}.displayName`).toBeTruthy()
      expect(meta.legalEntity, `${id}.legalEntity`).toBeTruthy()
      expect(meta.dataCategories, `${id}.dataCategories`).toBeTruthy()
    }
  })
})

describe('getProviderMeta', () => {
  it('returns correct entry for a known provider', () => {
    const meta = getProviderMeta('openai')
    expect(meta.displayName).toBe('OpenAI')
    expect(meta.legalEntity).toContain('OpenAI')
  })

  it('falls back to unknown entry for an unrecognised provider', () => {
    const meta = getProviderMeta('some-future-provider')
    expect(meta).toBe(PROVIDER_META['unknown'])
    expect(meta.displayName).toBeTruthy()
  })

  it('never throws for any string input', () => {
    expect(() => getProviderMeta('')).not.toThrow()
    expect(() => getProviderMeta('anthropic')).not.toThrow()
    expect(() => getProviderMeta('nonexistent')).not.toThrow()
  })
})
