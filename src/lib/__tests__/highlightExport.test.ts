import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Dexie db
// ---------------------------------------------------------------------------

const mockHighlights = [
  {
    bookId: 'book-1',
    textAnchor: 'To be or not to be',
    note: 'Famous quote',
    color: 'yellow',
    chapterHref: 'chapter-1.xhtml',
    cfiRange: null,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    bookId: 'book-1',
    textAnchor: 'All the world is a stage',
    note: null,
    color: 'blue',
    chapterHref: null,
    cfiRange: 'epubcfi(/6/4!/4/2)',
    createdAt: '2026-01-16T11:00:00Z',
  },
  {
    bookId: 'book-2',
    textAnchor: 'Call me Ishmael',
    note: 'Opening line',
    color: 'green',
    chapterHref: 'chapter-01/content.xhtml',
    cfiRange: null,
    createdAt: '2026-02-01T09:00:00Z',
  },
]

const mockBooks = [
  { id: 'book-1', title: 'Hamlet', author: 'William Shakespeare' },
  { id: 'book-2', title: 'Moby Dick', author: 'Herman Melville' },
]

vi.mock('@/db/schema', () => ({
  db: {
    bookHighlights: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    books: {
      where: vi.fn().mockReturnValue({
        anyOf: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
  },
}))

import { db } from '@/db/schema'

beforeEach(() => {
  vi.mocked(db.bookHighlights.toArray).mockResolvedValue(mockHighlights as never)
  vi.mocked(db.books.where).mockReturnValue({
    anyOf: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(mockBooks),
    }),
  } as never)
})

// ---------------------------------------------------------------------------
// exportHighlightsAsObsidian
// ---------------------------------------------------------------------------

describe('exportHighlightsAsObsidian', () => {
  it('returns empty result when no highlights exist', async () => {
    vi.mocked(db.bookHighlights.toArray).mockResolvedValue([])
    const { exportHighlightsAsObsidian } = await import('@/lib/highlightExport')

    const result = await exportHighlightsAsObsidian()
    expect(result.files).toHaveLength(0)
    expect(result.highlightCount).toBe(0)
    expect(result.bookCount).toBe(0)
  })

  it('creates one file per book', async () => {
    const { exportHighlightsAsObsidian } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsObsidian()

    expect(result.files).toHaveLength(2)
    expect(result.bookCount).toBe(2)
    expect(result.highlightCount).toBe(3)
  })

  it('files are in book-highlights/ directory', async () => {
    const { exportHighlightsAsObsidian } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsObsidian()

    for (const file of result.files) {
      expect(file.name).toMatch(/^book-highlights\//)
    }
  })

  it('markdown includes book title as heading', async () => {
    const { exportHighlightsAsObsidian } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsObsidian()

    const hamletFile = result.files.find(f => f.name.includes('Hamlet'))
    expect(hamletFile?.content).toContain('# Hamlet')
    expect(hamletFile?.content).toContain('Author: William Shakespeare')
  })

  it('highlight text is wrapped in blockquotes', async () => {
    const { exportHighlightsAsObsidian } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsObsidian()

    const hamletFile = result.files.find(f => f.name.includes('Hamlet'))
    expect(hamletFile?.content).toContain('> "To be or not to be"')
  })

  it('includes notes when present', async () => {
    const { exportHighlightsAsObsidian } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsObsidian()

    const hamletFile = result.files.find(f => f.name.includes('Hamlet'))
    expect(hamletFile?.content).toContain('Note: Famous quote')
  })

  it('calls progress callback', async () => {
    const { exportHighlightsAsObsidian } = await import('@/lib/highlightExport')
    const onProgress = vi.fn()

    await exportHighlightsAsObsidian(onProgress)

    expect(onProgress).toHaveBeenCalledWith(0, expect.any(String))
    expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
  })
})

// ---------------------------------------------------------------------------
// exportHighlightsAsReadwiseCsv
// ---------------------------------------------------------------------------

describe('exportHighlightsAsReadwiseCsv', () => {
  it('returns empty result when no highlights exist', async () => {
    vi.mocked(db.bookHighlights.toArray).mockResolvedValue([])
    const { exportHighlightsAsReadwiseCsv } = await import('@/lib/highlightExport')

    const result = await exportHighlightsAsReadwiseCsv()
    expect(result.files).toHaveLength(0)
    expect(result.highlightCount).toBe(0)
  })

  it('produces single CSV file', async () => {
    const { exportHighlightsAsReadwiseCsv } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsReadwiseCsv()

    expect(result.files).toHaveLength(1)
    expect(result.files[0].name).toBe('book-highlights/readwise-export.csv')
  })

  it('CSV has correct header row', async () => {
    const { exportHighlightsAsReadwiseCsv } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsReadwiseCsv()

    const firstLine = result.files[0].content.split('\n')[0]
    expect(firstLine).toBe('Title,Author,Highlight,Note,Location,Color,Date')
  })

  it('CSV contains all highlights', async () => {
    const { exportHighlightsAsReadwiseCsv } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsReadwiseCsv()

    // header + 3 data rows
    const lines = result.files[0].content.split('\n')
    expect(lines).toHaveLength(4)
  })

  it('counts unique books', async () => {
    const { exportHighlightsAsReadwiseCsv } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsReadwiseCsv()
    expect(result.bookCount).toBe(2)
  })

  it('escapes double quotes in CSV fields', async () => {
    vi.mocked(db.bookHighlights.toArray).mockResolvedValue([
      {
        bookId: 'book-1',
        textAnchor: 'He said "hello"',
        note: null,
        color: 'yellow',
        chapterHref: null,
        cfiRange: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ] as never)

    const { exportHighlightsAsReadwiseCsv } = await import('@/lib/highlightExport')
    const result = await exportHighlightsAsReadwiseCsv()

    expect(result.files[0].content).toContain('""hello""')
  })

  it('calls progress callback', async () => {
    const { exportHighlightsAsReadwiseCsv } = await import('@/lib/highlightExport')
    const onProgress = vi.fn()

    await exportHighlightsAsReadwiseCsv(onProgress)

    expect(onProgress).toHaveBeenCalledWith(0, expect.any(String))
    expect(onProgress).toHaveBeenCalledWith(100, 'Complete')
  })
})
