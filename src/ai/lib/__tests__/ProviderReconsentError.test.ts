import { describe, it, expect } from 'vitest'
import { ProviderReconsentError } from '../ProviderReconsentError'

describe('ProviderReconsentError', () => {
  it('is instanceof ProviderReconsentError', () => {
    const err = new ProviderReconsentError('ai_tutor', 'openai')
    expect(err).toBeInstanceOf(ProviderReconsentError)
  })

  it('is instanceof Error (prototype chain intact)', () => {
    const err = new ProviderReconsentError('ai_tutor', 'openai')
    expect(err).toBeInstanceOf(Error)
  })

  it('has correct name', () => {
    const err = new ProviderReconsentError('ai_tutor', 'openai')
    expect(err.name).toBe('ProviderReconsentError')
  })

  it('exposes purpose field', () => {
    const err = new ProviderReconsentError('ai_tutor', 'openai')
    expect(err.purpose).toBe('ai_tutor')
  })

  it('exposes providerId field', () => {
    const err = new ProviderReconsentError('ai_tutor', 'openai')
    expect(err.providerId).toBe('openai')
  })

  it('message contains both provider and purpose', () => {
    const err = new ProviderReconsentError('ai_embeddings', 'anthropic')
    expect(err.message).toContain('anthropic')
    expect(err.message).toContain('ai_embeddings')
  })

  it('instanceof check works when thrown and caught', () => {
    expect(() => {
      throw new ProviderReconsentError('ai_tutor', 'openai')
    }).toThrow(ProviderReconsentError)
  })
})
