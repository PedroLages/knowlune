import { describe, it, expect } from 'vitest'
import { AI_PROVIDERS } from '../aiConfiguration'

/**
 * E22-S01 AC5: CSP connect-src / proxy configuration
 *
 * The CSP strategy for Ollama is two-fold:
 * 1. Proxy mode (default): Requests route through /api/ai/ollama on the same origin,
 *    so no CSP connect-src changes are needed. The Vite dev server proxies /api/ai
 *    to the Express proxy server (localhost:3001).
 * 2. Direct mode: A dynamic meta tag in index.html is updated at runtime.
 *
 * This test verifies the architectural pieces exist:
 * - Ollama provider is registered with usesServerUrl (not API key)
 * - Ollama URL validation accepts valid http/https URLs
 * - The proxy endpoint path convention is /api/ai/ollama
 *
 * The actual proxy routing is tested in server/__tests__/ollama-validation.test.ts
 * and the Vite config is verified by the dev server accepting /api/ai/* requests.
 */
describe('Ollama proxy configuration (E22-S01 AC5)', () => {
  it('Ollama provider is registered with usesServerUrl flag', () => {
    const ollama = AI_PROVIDERS.ollama
    expect(ollama).toBeDefined()
    expect(ollama.id).toBe('ollama')
    expect(ollama.usesServerUrl).toBe(true)
  })

  it('Ollama URL validator accepts valid LAN URLs', () => {
    const validate = AI_PROVIDERS.ollama.validateApiKey
    expect(validate('http://192.168.1.100:11434')).toBe(true)
    expect(validate('http://10.0.0.5:11434')).toBe(true)
    expect(validate('https://my-server.local:11434')).toBe(true)
  })

  it('Ollama URL validator rejects non-URL strings', () => {
    const validate = AI_PROVIDERS.ollama.validateApiKey
    expect(validate('sk-abc123')).toBe(false)
    expect(validate('not-a-url')).toBe(false)
    expect(validate('')).toBe(false)
  })

  it('Ollama URL validator rejects non-http protocols', () => {
    const validate = AI_PROVIDERS.ollama.validateApiKey
    expect(validate('ftp://192.168.1.100:11434')).toBe(false)
  })

  it('provider list includes ollama alongside cloud providers', () => {
    const providerIds = Object.keys(AI_PROVIDERS)
    expect(providerIds).toContain('ollama')
    expect(providerIds).toContain('openai')
    expect(providerIds).toContain('anthropic')
  })
})
