import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateCatalog, fetchCatalogEntries, getFormatLabel } from '@/services/OpdsService'

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
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

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

// ── E88-S02: Entry Parsing + Pagination Tests ──────────────────────

const OPDS_ACQUISITION_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sci-Fi Books</title>
  <entry>
    <id>urn:uuid:book-1</id>
    <title>The Art of War</title>
    <author><name>Sun Tzu</name></author>
    <summary>Ancient Chinese military treatise covering strategy and tactics.</summary>
    <link rel="http://opds-spec.org/acquisition" href="/get/epub/42" type="application/epub+zip"/>
    <link rel="http://opds-spec.org/image" href="/cover/42.jpg" type="image/jpeg"/>
    <link rel="http://opds-spec.org/image/thumbnail" href="/thumb/42.jpg" type="image/jpeg"/>
  </entry>
  <entry>
    <id>urn:uuid:book-2</id>
    <title>Dune</title>
    <author><name>Frank Herbert</name></author>
    <summary>A science fiction masterpiece about desert planet Arrakis.</summary>
    <link rel="http://opds-spec.org/acquisition" href="/get/epub/99" type="application/epub+zip"/>
    <link rel="http://opds-spec.org/acquisition" href="/get/pdf/99" type="application/pdf"/>
    <link rel="http://opds-spec.org/image" href="/cover/99.jpg" type="image/jpeg"/>
  </entry>
  <link rel="next" href="/opds?page=2" type="application/atom+xml"/>
</feed>`

const OPDS_NAVIGATION_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>My Catalog</title>
  <entry>
    <title>Fiction</title>
    <link rel="subsection" href="/opds/fiction" type="application/atom+xml;profile=opds-catalog"/>
  </entry>
  <entry>
    <title>Non-Fiction</title>
    <link rel="subsection" href="/opds/nonfiction" type="application/atom+xml;profile=opds-catalog"/>
  </entry>
  <entry>
    <id>urn:uuid:book-3</id>
    <title>Solo Book</title>
    <author><name>Jane Doe</name></author>
    <link rel="http://opds-spec.org/acquisition" href="/get/epub/3" type="application/epub+zip"/>
  </entry>
</feed>`

const OPDS_EMPTY_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Empty Feed</title>
</feed>`

describe('OpdsService.fetchCatalogEntries', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('parses book entries with title, author, summary, acquisition links, and cover', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(OPDS_ACQUISITION_FEED))

    const result = await fetchCatalogEntries('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.entries).toHaveLength(2)
    expect(result.feedTitle).toBe('Sci-Fi Books')

    const book1 = result.entries[0]
    expect(book1.id).toBe('urn:uuid:book-1')
    expect(book1.title).toBe('The Art of War')
    expect(book1.author).toBe('Sun Tzu')
    expect(book1.summary).toContain('military treatise')
    expect(book1.acquisitionLinks).toHaveLength(1)
    expect(book1.acquisitionLinks[0].type).toBe('application/epub+zip')
    expect(book1.coverUrl).toContain('/cover/42.jpg')
    expect(book1.thumbnailUrl).toContain('/thumb/42.jpg')

    const book2 = result.entries[1]
    expect(book2.title).toBe('Dune')
    expect(book2.acquisitionLinks).toHaveLength(2) // EPUB + PDF
  })

  it('detects pagination next link', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(OPDS_ACQUISITION_FEED))

    const result = await fetchCatalogEntries('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.nextPageUrl).toContain('/opds?page=2')
  })

  it('returns no nextPageUrl when absent', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(OPDS_EMPTY_FEED))

    const result = await fetchCatalogEntries('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.nextPageUrl).toBeUndefined()
  })

  it('separates navigation links from book entries', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(OPDS_NAVIGATION_FEED))

    const result = await fetchCatalogEntries('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.navigationLinks).toHaveLength(2)
    expect(result.navigationLinks[0].title).toBe('Fiction')
    expect(result.navigationLinks[1].title).toBe('Non-Fiction')

    // The solo book entry should be in entries, not navigation
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].title).toBe('Solo Book')
  })

  it('returns empty arrays for empty feed', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(OPDS_EMPTY_FEED))

    const result = await fetchCatalogEntries('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.entries).toHaveLength(0)
    expect(result.navigationLinks).toHaveLength(0)
  })

  it('returns error for non-OPDS response', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(HTML_RESPONSE))

    const result = await fetchCatalogEntries('https://example.com')

    expect(result.ok).toBe(false)
  })

  it('resolves relative URLs against base URL', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(OPDS_ACQUISITION_FEED))

    const result = await fetchCatalogEntries('https://calibre.local/opds')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Relative /get/epub/42 should resolve to absolute URL
    expect(result.entries[0].acquisitionLinks[0].href).toBe(
      'https://calibre.local/get/epub/42'
    )
    expect(result.entries[0].coverUrl).toBe('https://calibre.local/cover/42.jpg')
  })

  it('includes auth header when credentials provided', async () => {
    const fetchMock = mockFetchResponse(OPDS_ACQUISITION_FEED)
    vi.stubGlobal('fetch', fetchMock)

    await fetchCatalogEntries('https://calibre.local/opds', {
      username: 'user',
      password: 'pass',
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers.Authorization).toBe(`Basic ${btoa('user:pass')}`)
  })
})

describe('OpdsService.getFormatLabel', () => {
  it('returns EPUB for epub links', () => {
    expect(
      getFormatLabel([{ href: '/book.epub', type: 'application/epub+zip' }])
    ).toBe('EPUB')
  })

  it('returns PDF for pdf links', () => {
    expect(
      getFormatLabel([{ href: '/book.pdf', type: 'application/pdf' }])
    ).toBe('PDF')
  })

  it('returns combined label for multiple formats', () => {
    expect(
      getFormatLabel([
        { href: '/book.epub', type: 'application/epub+zip' },
        { href: '/book.pdf', type: 'application/pdf' },
      ])
    ).toBe('EPUB, PDF')
  })

  it('returns MOBI for mobipocket links', () => {
    expect(
      getFormatLabel([{ href: '/book.mobi', type: 'application/x-mobipocket-ebook' }])
    ).toBe('MOBI')
  })

  it('returns Unknown for empty links', () => {
    expect(getFormatLabel([])).toBe('Unknown')
  })
})
