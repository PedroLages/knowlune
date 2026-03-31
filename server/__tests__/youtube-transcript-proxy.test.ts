/**
 * Unit Tests: youtube-transcript-proxy Vite plugin
 *
 * Tests the POST /api/youtube/transcript middleware:
 * - Valid transcript fetching
 * - HTML entity decoding in cues
 * - Missing/invalid videoId validation
 * - Error type mapping (no captions, disabled, rate limited, etc.)
 * - Language parameter passthrough
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock youtube-transcript before importing the plugin
const mockFetchTranscript = vi.fn()
vi.mock('youtube-transcript', () => ({
  YoutubeTranscript: {
    fetchTranscript: mockFetchTranscript,
  },
  YoutubeTranscriptNotAvailableError: class extends Error {
    constructor(videoId: string) {
      super(`Transcript is not available for video: ${videoId}`)
      this.name = 'YoutubeTranscriptNotAvailableError'
    }
  },
  YoutubeTranscriptDisabledError: class extends Error {
    constructor(videoId: string) {
      super(`Transcript is disabled for video: ${videoId}`)
      this.name = 'YoutubeTranscriptDisabledError'
    }
  },
  YoutubeTranscriptTooManyRequestError: class extends Error {
    constructor() {
      super('Too many requests')
      this.name = 'YoutubeTranscriptTooManyRequestError'
    }
  },
}))

import { youtubeTranscriptProxy } from '../../vite-plugin-youtube-transcript'

// ---------------------------------------------------------------------------
// Helpers (same pattern as ollama-dev-proxy tests)
// ---------------------------------------------------------------------------

type Middleware = (
  req: Record<string, unknown>,
  res: Record<string, unknown>,
  next: () => void
) => Promise<void> | void

function getMiddleware(targetPath = '/api/youtube/transcript'): Middleware {
  const plugin = youtubeTranscriptProxy()
  let handler: Middleware | undefined
  const mockServer = {
    middlewares: {
      use: (path: string, h: Middleware) => {
        if (path === targetPath) handler = h
      },
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(plugin as any).configureServer(mockServer)
  return handler!
}

function mockReq(
  method: string,
  body?: Record<string, unknown>
): Record<string, unknown> {
  const callbacks: Record<string, Array<(arg?: unknown) => void>> = {}
  return {
    method,
    url: '/',
    headers: { host: 'localhost:5173' },
    on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
      if (!callbacks[event]) callbacks[event] = []
      callbacks[event].push(cb)
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

function mockRes(): Record<string, unknown> & { _body: string } {
  const res = {
    statusCode: 200,
    _body: '',
    setHeader: vi.fn(),
    end: vi.fn((data?: string) => {
      if (data) res._body += data
    }),
  }
  return res
}

function parseResBody(res: ReturnType<typeof mockRes>): unknown {
  const endCall = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]
  const raw = endCall?.[0] || res._body
  return JSON.parse(raw as string)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('youtube-transcript-proxy', () => {
  let handler: Middleware

  beforeEach(() => {
    vi.clearAllMocks()
    handler = getMiddleware()
  })

  it('calls next() for non-POST requests', async () => {
    const req = mockReq('GET')
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.end).not.toHaveBeenCalled()
  })

  it('returns 400 if videoId is missing', async () => {
    const req = mockReq('POST', {})
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.statusCode).toBe(400)
    const body = parseResBody(res) as { code: string }
    expect(body.code).toBe('invalid-video-id')
  })

  it('returns 400 for invalid videoId format', async () => {
    const req = mockReq('POST', { videoId: 'too-short' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.statusCode).toBe(400)
    const body = parseResBody(res) as { code: string }
    expect(body.code).toBe('invalid-video-id')
  })

  it('fetches transcript successfully and decodes HTML entities', async () => {
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Hello &amp; welcome', offset: 0, duration: 5000, lang: 'en' },
      { text: 'Let&#39;s begin', offset: 5000, duration: 3000, lang: 'en' },
    ])

    const req = mockReq('POST', { videoId: 'dQw4w9WgXcQ' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.statusCode).toBe(200)
    const body = parseResBody(res) as { cues: Array<{ text: string; startTime: number; endTime: number }>; language: string }
    expect(body.cues).toHaveLength(2)
    expect(body.cues[0].text).toBe('Hello & welcome')
    expect(body.cues[0].startTime).toBe(0)
    expect(body.cues[0].endTime).toBe(5)
    expect(body.cues[1].text).toBe("Let's begin")
    expect(body.cues[1].startTime).toBe(5)
    expect(body.cues[1].endTime).toBe(8)
    expect(body.language).toBe('en')
  })

  it('passes language parameter to youtube-transcript', async () => {
    mockFetchTranscript.mockResolvedValueOnce([])

    const req = mockReq('POST', { videoId: 'dQw4w9WgXcQ', lang: 'es' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(mockFetchTranscript).toHaveBeenCalledWith('dQw4w9WgXcQ', { lang: 'es' })
  })

  it('maps no-captions-available error to 404', async () => {
    const error = new Error('Transcript is not available for video: dQw4w9WgXcQ')
    Object.defineProperty(error, 'constructor', {
      value: { name: 'YoutubeTranscriptNotAvailableError' },
    })
    // Simulate the error message containing 'not available'
    mockFetchTranscript.mockRejectedValueOnce(error)

    const req = mockReq('POST', { videoId: 'dQw4w9WgXcQ' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.statusCode).toBe(404)
    const body = parseResBody(res) as { code: string }
    expect(body.code).toBe('no-captions-available')
  })

  it('maps rate limit error to 429', async () => {
    const error = new Error('Too many requests')
    mockFetchTranscript.mockRejectedValueOnce(error)

    const req = mockReq('POST', { videoId: 'dQw4w9WgXcQ' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.statusCode).toBe(429)
    const body = parseResBody(res) as { code: string }
    expect(body.code).toBe('rate-limited')
  })

  it('maps network errors to 502', async () => {
    const error = new Error('fetch failed')
    mockFetchTranscript.mockRejectedValueOnce(error)

    const req = mockReq('POST', { videoId: 'dQw4w9WgXcQ' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.statusCode).toBe(502)
    const body = parseResBody(res) as { code: string }
    expect(body.code).toBe('network-error')
  })

  it('maps disabled captions to 403', async () => {
    const error = new Error('Transcript is disabled for this video')
    mockFetchTranscript.mockRejectedValueOnce(error)

    const req = mockReq('POST', { videoId: 'dQw4w9WgXcQ' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(res.statusCode).toBe(403)
    const body = parseResBody(res) as { code: string }
    expect(body.code).toBe('captions-disabled')
  })

  it('defaults language to en when not detected', async () => {
    mockFetchTranscript.mockResolvedValueOnce([
      { text: 'Hello', offset: 0, duration: 1000 },
    ])

    const req = mockReq('POST', { videoId: 'dQw4w9WgXcQ' })
    const res = mockRes()
    const next = vi.fn()

    await handler(req, res, next)

    const body = parseResBody(res) as { language: string }
    expect(body.language).toBe('en')
  })
})
