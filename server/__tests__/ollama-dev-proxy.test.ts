import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ollamaDevProxy } from '../../vite.config'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

type Middleware = (
  req: Record<string, unknown>,
  res: Record<string, unknown>,
  next: () => void
) => Promise<void> | void

/** Call ollamaDevProxy().configureServer() and capture registered middleware by path */
function getMiddleware(): Map<string, Middleware> {
  const plugin = ollamaDevProxy()
  const handlers = new Map<string, Middleware>()
  const mockServer = {
    middlewares: {
      use: (path: string, handler: Middleware) => handlers.set(path, handler),
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(plugin as any).configureServer(mockServer)
  return handlers
}

/** Create a mock IncomingMessage */
function mockReq(
  method: string,
  url: string,
  body?: Record<string, unknown>
): Record<string, unknown> {
  const callbacks: Record<string, Array<(arg?: unknown) => void>> = {}
  return {
    method,
    url,
    headers: { host: 'localhost:5173' },
    on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
      if (!callbacks[event]) callbacks[event] = []
      callbacks[event].push(cb)
      // Emit body data + end synchronously so readBody resolves
      if (event === 'end') {
        if (body) {
          for (const dataCb of callbacks['data'] || []) {
            dataCb(Buffer.from(JSON.stringify(body)))
          }
        }
        for (const endCb of callbacks['end'] || []) {
          endCb()
        }
      }
    }),
  }
}

/** Create a mock ServerResponse */
function mockRes(): Record<string, unknown> & { _body: string } {
  const res = {
    statusCode: 200,
    headersSent: false,
    _body: '',
    setHeader: vi.fn(),
    writeHead: vi.fn(),
    write: vi.fn((chunk: Buffer | string) => {
      res._body += typeof chunk === 'string' ? chunk : chunk.toString()
    }),
    end: vi.fn((data?: string) => {
      if (data) res._body += data
    }),
  }
  return res
}

/** Create a ReadableStream from string chunks (for SSE streaming tests) */
function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
  })
}

/** Parse JSON from res.end() or res._body */
function parseResBody(res: ReturnType<typeof mockRes>): unknown {
  const endCall = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]
  const raw = endCall?.[0] || res._body
  return JSON.parse(raw as string)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ollamaDevProxy', () => {
  let handlers: Map<string, Middleware>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = getMiddleware()
  })

  it('registers all four endpoint handlers', () => {
    expect(handlers.has('/api/ai/ollama/tags')).toBe(true)
    expect(handlers.has('/api/ai/ollama/health')).toBe(true)
    expect(handlers.has('/api/ai/ollama/chat')).toBe(true)
    expect(handlers.has('/api/ai/ollama')).toBe(true)
  })

  // -------------------------------------------------------------------------
  // GET /api/ai/ollama/tags
  // -------------------------------------------------------------------------
  describe('GET /api/ai/ollama/tags', () => {
    const getHandler = () => handlers.get('/api/ai/ollama/tags')!

    it('forwards model list from Ollama', async () => {
      const ollamaResponse = { models: [{ name: 'llama3.2', size: 2_000_000_000 }] }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(ollamaResponse)),
      })

      const req = mockReq('GET', '?serverUrl=http://192.168.1.100:11434')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:11434/api/tags',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
      expect(JSON.parse((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0])).toEqual(
        ollamaResponse
      )
    })

    it('returns 400 when serverUrl is missing', async () => {
      const req = mockReq('GET', '?foo=bar')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(400)
      expect(parseResBody(res)).toEqual({ error: 'serverUrl query parameter is required' })
    })

    it('calls next() for non-GET methods', async () => {
      const req = mockReq('POST', '?serverUrl=http://192.168.1.100:11434')
      const res = mockRes()
      const next = vi.fn()
      await getHandler()(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('forwards error when Ollama returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('model not found'),
      })

      const req = mockReq('GET', '?serverUrl=http://192.168.1.100:11434')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(404)
      const body = parseResBody(res) as { error: string }
      expect(body.error).toContain('Ollama returned 404')
    })

    it('returns 502 when Ollama is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed: ECONNREFUSED'))

      const req = mockReq('GET', '?serverUrl=http://192.168.1.100:11434')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(502)
      const body = parseResBody(res) as { error: string }
      expect(body.error).toContain('Cannot reach Ollama')
    })

    it('returns 504 on timeout', async () => {
      const timeoutError = Object.assign(new Error('The operation timed out'), {
        name: 'TimeoutError',
      })
      mockFetch.mockRejectedValueOnce(timeoutError)

      const req = mockReq('GET', '?serverUrl=http://192.168.1.100:11434')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(504)
      const body = parseResBody(res) as { error: string }
      expect(body.error).toContain('timed out')
    })

    it('strips trailing slashes from serverUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"models":[]}'),
      })

      const req = mockReq('GET', '?serverUrl=http://192.168.1.100:11434///')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:11434/api/tags',
        expect.anything()
      )
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/ai/ollama/health
  // -------------------------------------------------------------------------
  describe('GET /api/ai/ollama/health', () => {
    const getHandler = () => handlers.get('/api/ai/ollama/health')!

    it('forwards health check response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('Ollama is running'),
      })

      const req = mockReq('GET', '?serverUrl=http://192.168.1.100:11434')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:11434',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect((res.end as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('Ollama is running')
    })

    it('returns 400 when serverUrl is missing', async () => {
      const req = mockReq('GET', '')
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(400)
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/ai/ollama/chat (non-streaming)
  // -------------------------------------------------------------------------
  describe('POST /api/ai/ollama/chat', () => {
    const getHandler = () => handlers.get('/api/ai/ollama/chat')!

    it('forwards chat response from Ollama', async () => {
      const ollamaResponse = { message: { role: 'assistant', content: 'Hello!' } }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(ollamaResponse)),
      })

      const req = mockReq('POST', '/', {
        ollamaServerUrl: 'http://192.168.1.100:11434',
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'hi' }],
      })
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json')
    })

    it('returns 400 when ollamaServerUrl is missing', async () => {
      const req = mockReq('POST', '/', { messages: [] })
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(400)
      const body = parseResBody(res) as { error: string }
      expect(body.error).toContain('ollamaServerUrl is required')
    })

    it('calls next() for non-POST methods', async () => {
      const req = mockReq('GET', '/')
      const res = mockRes()
      const next = vi.fn()
      await getHandler()(req, res, next)

      expect(next).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/ai/ollama (SSE streaming)
  // -------------------------------------------------------------------------
  describe('POST /api/ai/ollama (streaming)', () => {
    const getHandler = () => handlers.get('/api/ai/ollama')!

    it('pipes SSE stream with correct headers', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(sseChunks),
      })

      const req = mockReq('POST', '/', {
        ollamaServerUrl: 'http://192.168.1.100:11434',
        model: 'llama3.2',
        messages: [{ role: 'user', content: 'hi' }],
      })
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      // Verify SSE headers
      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      // Verify fetch was called with stream: true
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(fetchBody.stream).toBe(true)
      expect(fetchBody.model).toBe('llama3.2')

      // Verify SSE data was piped through
      expect(res._body).toContain('Hello')
      expect(res._body).toContain(' world')
      expect(res._body).toContain('[DONE]')

      // Verify stream was closed
      expect(res.end).toHaveBeenCalled()
    })

    it('forwards to /v1/chat/completions endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: createMockStream(['data: [DONE]\n\n']),
      })

      const req = mockReq('POST', '/', {
        ollamaServerUrl: 'http://192.168.1.100:11434/',
        model: 'llama3.2',
        messages: [],
      })
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.100:11434/v1/chat/completions',
        expect.anything()
      )
    })

    it('returns 400 when ollamaServerUrl is missing', async () => {
      const req = mockReq('POST', '/', { messages: [] })
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(400)
      const body = parseResBody(res) as { error: string }
      expect(body.error).toContain('ollamaServerUrl is required')
    })

    it('returns error JSON when Ollama returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: null,
        text: () => Promise.resolve('model not loaded'),
      })

      const req = mockReq('POST', '/', {
        ollamaServerUrl: 'http://192.168.1.100:11434',
        messages: [],
      })
      const res = mockRes()
      await getHandler()(req, res, vi.fn())

      expect(res.statusCode).toBe(500)
      const body = parseResBody(res) as { error: string }
      expect(body.error).toContain('Ollama returned 500')
    })

    it('calls next() for non-POST methods', async () => {
      const req = mockReq('GET', '/')
      const res = mockRes()
      const next = vi.fn()
      await getHandler()(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('calls next() for subpath URLs', async () => {
      const req = mockReq('POST', '/unknown-subpath')
      const res = mockRes()
      const next = vi.fn()
      await getHandler()(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
