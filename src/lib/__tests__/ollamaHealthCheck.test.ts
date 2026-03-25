import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { testOllamaConnection, runStartupHealthCheck } from '../ollamaHealthCheck'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('testOllamaConnection', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns success when server responds with "Ollama is running"', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true // direct mode
    )

    expect(result.success).toBe(true)
    expect(result.message).toBe('Connected to Ollama')
  })

  it('pings proxy health endpoint in proxy mode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    await testOllamaConnection('http://192.168.2.200:11434', false)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai/ollama/health?serverUrl='),
      expect.any(Object)
    )
  })

  it('pings server directly in direct mode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    await testOllamaConnection('http://192.168.2.200:11434', true)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://192.168.2.200:11434',
      expect.any(Object)
    )
  })

  it('returns unreachable error on timeout', async () => {
    const timeoutError = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' })
    mockFetch.mockRejectedValueOnce(timeoutError)

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true
    )

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('unreachable')
    expect(result.message).toContain('Cannot reach Ollama')
    expect(result.message).toContain('192.168.2.200:11434')
  })

  it('returns CORS error in direct mode on Failed to fetch', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true // direct mode
    )

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('cors')
    expect(result.message).toContain('CORS blocked')
    expect(result.message).toContain('OLLAMA_ORIGINS=*')
  })

  it('returns unreachable error in proxy mode on Failed to fetch', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      false // proxy mode
    )

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('unreachable')
    expect(result.message).toContain('Cannot reach Ollama')
  })

  it('returns model-not-found when selected model is unavailable', async () => {
    // Ping succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    // Tags returns models that do NOT include the selected one
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3.2:latest', size: 2000000000 },
          { name: 'phi3:latest', size: 1500000000 },
        ],
      }),
    })

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true,
      'mistral:latest' // not in the list
    )

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('model-not-found')
    expect(result.message).toContain('mistral:latest')
    expect(result.message).toContain('ollama pull')
  })

  it('succeeds when selected model IS available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3.2:latest', size: 2000000000 },
        ],
      }),
    })

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true,
      'llama3.2:latest'
    )

    expect(result.success).toBe(true)
  })

  it('still succeeds if model check fails but server ping passed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    // Tags endpoint fails
    mockFetch.mockRejectedValueOnce(new Error('network error'))

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true,
      'llama3.2:latest'
    )

    // Connection is still considered successful since server is reachable
    expect(result.success).toBe(true)
  })

  it('returns error when server returns non-OK HTTP status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    })

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('HTTP 500')
  })

  it('returns error when direct response is not from Ollama', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<html>Some other web page</html>',
    })

    const result = await testOllamaConnection(
      'http://192.168.2.200:11434',
      true
    )

    expect(result.success).toBe(false)
    expect(result.message).toContain('does not appear to be Ollama')
  })

  it('normalizes trailing slash in server URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    await testOllamaConnection('http://192.168.2.200:11434/', true)

    expect(mockFetch).toHaveBeenCalledWith(
      'http://192.168.2.200:11434',
      expect.any(Object)
    )
  })
})

describe('runStartupHealthCheck', () => {
  beforeEach(() => {
    localStorage.clear()
    mockFetch.mockReset()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('does nothing when provider is not ollama', async () => {
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({ provider: 'openai' })
    )

    await runStartupHealthCheck()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does nothing when ollama has no server URL', async () => {
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({
        provider: 'ollama',
        ollamaSettings: { serverUrl: '', directConnection: false },
      })
    )

    await runStartupHealthCheck()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('updates status to connected on successful health check', async () => {
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({
        provider: 'ollama',
        connectionStatus: 'error',
        ollamaSettings: {
          serverUrl: 'http://192.168.2.200:11434',
          directConnection: false,
        },
      })
    )

    // Proxy health check succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Ollama is running',
    })

    await runStartupHealthCheck()

    const config = JSON.parse(localStorage.getItem('ai-configuration') || '{}')
    expect(config.connectionStatus).toBe('connected')
  })

  it('updates status to error on failed health check', async () => {
    localStorage.setItem(
      'ai-configuration',
      JSON.stringify({
        provider: 'ollama',
        connectionStatus: 'connected',
        ollamaSettings: {
          serverUrl: 'http://192.168.2.200:11434',
          directConnection: false,
        },
      })
    )

    // Health check fails
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await runStartupHealthCheck()

    const config = JSON.parse(localStorage.getItem('ai-configuration') || '{}')
    expect(config.connectionStatus).toBe('error')
    expect(config.errorMessage).toContain('Cannot reach Ollama')
  })
})
