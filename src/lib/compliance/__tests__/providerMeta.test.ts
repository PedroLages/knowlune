import { describe, it, expect } from 'vitest'
import { PROVIDER_META, getProviderMeta } from '../providerMeta'

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
