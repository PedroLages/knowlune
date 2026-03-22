/**
 * AI Provider Registry unit tests
 *
 * Tests getProviderModel routing, Ollama URL normalization, SSRF validation,
 * and default fallback behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getProviderModel, validateOllamaUrl } from '../providers'

// Mock AI SDK provider factories — return a simple object so we can assert args
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn((opts: Record<string, unknown>) => (model: string) => ({
    _provider: 'anthropic',
    _model: model,
    ...opts,
  })),
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn((opts: Record<string, unknown>) => (model: string) => ({
    _provider: 'openai',
    _model: model,
    ...opts,
  })),
}))
vi.mock('@ai-sdk/groq', () => ({
  createGroq: vi.fn((opts: Record<string, unknown>) => (model: string) => ({
    _provider: 'groq',
    _model: model,
    ...opts,
  })),
}))
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn((opts: Record<string, unknown>) => (model: string) => ({
    _provider: 'google',
    _model: model,
    ...opts,
  })),
}))

import { createOpenAI } from '@ai-sdk/openai'

describe('validateOllamaUrl', () => {
  it('accepts valid http URL', () => {
    expect(() => validateOllamaUrl('http://192.168.1.100:11434')).not.toThrow()
  })

  it('accepts valid https URL', () => {
    expect(() => validateOllamaUrl('https://my-ollama.example.com:11434')).not.toThrow()
  })

  it('returns the original URL on success', () => {
    expect(validateOllamaUrl('http://192.168.1.100:11434')).toBe('http://192.168.1.100:11434')
  })

  it('rejects invalid URL format', () => {
    expect(() => validateOllamaUrl('not-a-url')).toThrow('Invalid Ollama URL')
  })

  it('rejects non-HTTP scheme (file://)', () => {
    expect(() => validateOllamaUrl('file:///etc/passwd')).toThrow('http or https')
  })

  it('rejects non-HTTP scheme (ftp://)', () => {
    expect(() => validateOllamaUrl('ftp://192.168.1.1')).toThrow('http or https')
  })

  it('rejects cloud metadata IP 169.254.169.254', () => {
    expect(() => validateOllamaUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      'restricted address'
    )
  })

  it('rejects other 169.254.x.x link-local addresses', () => {
    expect(() => validateOllamaUrl('http://169.254.0.1:11434')).toThrow('restricted address')
  })
})

describe('getProviderModel — ollama', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('constructs baseURL from apiKey as Ollama server URL', () => {
    getProviderModel('ollama', 'http://192.168.1.100:11434', 'llama3.2')
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'http://192.168.1.100:11434/v1' })
    )
  })

  it('normalizes trailing slash in Ollama base URL', () => {
    getProviderModel('ollama', 'http://192.168.1.100:11434/', 'llama3.2')
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'http://192.168.1.100:11434/v1' })
    )
  })

  it('falls back to localhost:11434 when apiKey is empty', () => {
    getProviderModel('ollama', '', 'llama3.2')
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'http://localhost:11434/v1' })
    )
  })

  it('uses model argument when provided', () => {
    const result = getProviderModel('ollama', 'http://192.168.1.100:11434', 'mistral') as {
      _model: string
    }
    expect(result._model).toBe('mistral')
  })

  it('uses llama3.2 default when model is not specified', () => {
    const result = getProviderModel('ollama', 'http://192.168.1.100:11434') as { _model: string }
    expect(result._model).toBe('llama3.2')
  })

  it('throws for cloud metadata SSRF target', () => {
    expect(() =>
      getProviderModel('ollama', 'http://169.254.169.254/latest/meta-data', 'llama3.2')
    ).toThrow('restricted address')
  })
})

describe('getProviderModel — unsupported', () => {
  it('throws for unsupported provider', () => {
    expect(() => getProviderModel('unknown-provider', 'key')).toThrow('Unsupported provider')
  })
})
