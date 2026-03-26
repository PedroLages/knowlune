import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OllamaLLMClient } from '../ollama-client'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OllamaLLMClient.fetchModels', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches models via proxy by default (AC1)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3.2:latest', size: 2147483648, modified_at: '2026-03-20T10:00:00Z' },
          { name: 'phi3:mini', size: 1073741824, modified_at: '2026-03-19T10:00:00Z' },
        ],
      }),
    })

    const models = await OllamaLLMClient.fetchModels('http://192.168.2.200:11434', false)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/ollama/tags?serverUrl=http%3A%2F%2F192.168.2.200%3A11434',
      expect.objectContaining({ method: 'GET' })
    )
    expect(models).toHaveLength(2)
    expect(models[0].name).toBe('llama3.2:latest')
    expect(models[0].size).toBe('2.0 GB')
    expect(models[0].sizeBytes).toBe(2147483648)
    expect(models[1].name).toBe('phi3:mini')
    expect(models[1].size).toBe('1.0 GB')
  })

  it('fetches models directly when directConnection is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [{ name: 'gemma2:2b', size: 536870912, modified_at: '2026-03-18T10:00:00Z' }],
      }),
    })

    const models = await OllamaLLMClient.fetchModels('http://192.168.2.200:11434', true)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://192.168.2.200:11434/api/tags',
      expect.objectContaining({ method: 'GET' })
    )
    expect(models).toHaveLength(1)
    expect(models[0].name).toBe('gemma2:2b')
    expect(models[0].size).toBe('512.0 MB')
  })

  it('returns empty array when no models present', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    })

    const models = await OllamaLLMClient.fetchModels('http://192.168.2.200:11434')
    expect(models).toHaveLength(0)
  })

  it('returns empty array when models field is missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const models = await OllamaLLMClient.fetchModels('http://192.168.2.200:11434')
    expect(models).toHaveLength(0)
  })

  it('throws LLMError on HTTP error (AC4)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Internal Server Error',
    })

    await expect(OllamaLLMClient.fetchModels('http://192.168.2.200:11434')).rejects.toThrow(
      'Failed to list models (500)'
    )
  })

  it('throws helpful error on network failure (AC4)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(OllamaLLMClient.fetchModels('http://192.168.2.200:11434')).rejects.toThrow(
      'Cannot reach Ollama'
    )
  })

  it('throws timeout error when request exceeds limit (AC4)', async () => {
    const timeoutError = new DOMException('The operation was aborted', 'TimeoutError')
    mockFetch.mockRejectedValueOnce(timeoutError)

    await expect(OllamaLLMClient.fetchModels('http://192.168.2.200:11434')).rejects.toThrow(
      'timed out'
    )
  })

  it('normalizes trailing slashes in URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [] }),
    })

    await OllamaLLMClient.fetchModels('http://192.168.2.200:11434/', false)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/ollama/tags?serverUrl=http%3A%2F%2F192.168.2.200%3A11434',
      expect.anything()
    )
  })

  it('instance listModels() delegates to static fetchModels()', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3.2:latest', size: 2147483648, modified_at: '2026-03-20T10:00:00Z' },
        ],
      }),
    })

    const client = new OllamaLLMClient('http://192.168.2.200:11434', false)
    const models = await client.listModels()

    expect(models).toHaveLength(1)
    expect(models[0].name).toBe('llama3.2:latest')
  })
})
