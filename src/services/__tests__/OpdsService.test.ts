import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateCatalog } from '@/services/OpdsService'

// ── Helpers ──────────────────────────────────────────────────────

const VALID_OPDS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <title>My Library</title>
  <icon>/favicon.ico</icon>
  <entry>
    <title>Book One</title>
    <author><name>Author A</name></author>
  </entry>
  <entry>
    <title>Book Two</title>
    <author><name>Author B</name></author>
  </entry>
</feed>`

const EMPTY_OPDS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Empty Catalog</title>
</feed>`

const HTML_RESPONSE = `<!DOCTYPE html><html><head><title>Not OPDS</title></head><body>Hello</body></html>`

const INVALID_XML = `This is not XML at all {{}}`

function mockFetchResponse(body: string, status = 200, contentType = 'application/atom+xml') {
  return vi.fn().mockResolvedValue(
    new Response(body, {
      status,
      headers: { 'Content-Type': contentType },
    })
  )
}

// ── Tests ────────────────────────────────────────────────────────

describe('OpdsService.validateCatalog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('validates a correct OPDS Atom feed', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(VALID_OPDS_FEED))

    const result = await validateCatalog('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.title).toBe('My Library')
      expect(result.meta.entryCount).toBe(2)
      expect(result.meta.iconUrl).toBe('/favicon.ico')
    }
  })

  it('accepts an empty OPDS feed (0 entries)', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(EMPTY_OPDS_FEED))

    const result = await validateCatalog('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.title).toBe('Empty Catalog')
      expect(result.meta.entryCount).toBe(0)
    }
  })

  it('rejects HTML responses as invalid', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(HTML_RESPONSE, 200, 'text/html'))

    const result = await validateCatalog('https://example.com')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('not an OPDS catalog')
    }
  })

  it('rejects completely invalid XML', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(INVALID_XML))

    const result = await validateCatalog('https://example.com')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('not valid XML')
    }
  })

  it('returns auth error for 401 responses', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('Unauthorized', 401))

    const result = await validateCatalog('https://calibre.local/opds')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Authentication required')
    }
  })

  it('returns auth error for 403 responses', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('Forbidden', 403))

    const result = await validateCatalog('https://calibre.local/opds')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Authentication required')
    }
  })

  it('returns server error for non-OK status', async () => {
    vi.stubGlobal('fetch', mockFetchResponse('Internal Server Error', 500))

    const result = await validateCatalog('https://calibre.local/opds')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('500')
    }
  })

  it('includes auth header when credentials provided', async () => {
    const fetchMock = mockFetchResponse(VALID_OPDS_FEED)
    vi.stubGlobal('fetch', fetchMock)

    await validateCatalog('https://calibre.local/opds', {
      username: 'user',
      password: 'pass',
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBe(`Basic ${btoa('user:pass')}`)
  })

  it('does not include auth header when no credentials provided', async () => {
    const fetchMock = mockFetchResponse(VALID_OPDS_FEED)
    vi.stubGlobal('fetch', fetchMock)

    await validateCatalog('https://calibre.local/opds')

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('returns CORS error for TypeError from fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    )

    const result = await validateCatalog('https://calibre.local/opds')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('CORS')
    }
  })

  it('returns timeout error for AbortError', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))

    const result = await validateCatalog('https://calibre.local/opds')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('timed out')
    }
  })
})
