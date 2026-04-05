/**
 * Unit tests for M4bParserService.
 *
 * Covers story subtasks:
 * - 6.1: M4B chapter extraction produces correct chapters array
 * - 6.2: Single-file playback: chapter seek navigates within file (isSingleFileAudiobook + formatAudioTime)
 * - 6.3: Chapter progress detection (which chapter is current based on time)
 * - 6.5: Fallback: M4B without chapters creates single-chapter book
 *
 * @since E88-S04
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isSingleFileAudiobook, formatAudioTime } from '@/app/hooks/useAudioPlayer'
import type { Book } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeM4bFile(name = 'test.m4b', sizeBytes = 1024): File {
  const buf = new ArrayBuffer(sizeBytes)
  return new File([buf], name, { type: 'audio/mp4' })
}

function makeAudiobookBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'Test Audiobook',
    author: 'Test Author',
    format: 'audiobook',
    status: 'reading',
    tags: [],
    chapters: [
      {
        id: 'ch-1',
        bookId: 'book-1',
        title: 'Intro',
        order: 0,
        position: { type: 'time', seconds: 0 },
      },
      {
        id: 'ch-2',
        bookId: 'book-1',
        title: 'Chapter 1',
        order: 1,
        position: { type: 'time', seconds: 300 },
      },
      {
        id: 'ch-3',
        bookId: 'book-1',
        title: 'Chapter 2',
        order: 2,
        position: { type: 'time', seconds: 900 },
      },
    ],
    source: { type: 'local', opfsPath: 'books/book-1/book.m4b' },
    progress: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Mock music-metadata lazy import
// ---------------------------------------------------------------------------

/**
 * Build a mock music-metadata parseBlob response for given chapter data.
 * `chaptersField` maps to the top-level `chapters` property on the result object.
 */
function mockMusicMetadata({
  title = 'Mock Title',
  artist = 'Mock Artist',
  duration = 3600,
  sampleRate = 44100,
  chaptersField = undefined as
    | Array<{ title?: string; startTime?: number; sampleOffset?: number }>
    | undefined,
  itunesTags = undefined as Array<{ id: string; value: unknown }> | undefined,
  picture = undefined as { format: string; data: number[] } | undefined,
} = {}) {
  const result: Record<string, unknown> = {
    common: {
      title,
      artist,
      picture: picture ? [picture] : undefined,
    },
    format: {
      duration,
      sampleRate,
    },
    native: itunesTags ? { iTunes: itunesTags } : undefined,
  }
  if (chaptersField !== undefined) {
    result.chapters = chaptersField
  }
  return result
}

// ---------------------------------------------------------------------------
// 6.1 — Chapter extraction produces correct chapters array
// ---------------------------------------------------------------------------

describe('parseM4bFile — 6.1: chapter extraction', () => {
  const BOOK_ID = 'test-book-id'

  beforeEach(() => {
    vi.resetModules()
  })

  it('extracts chapters from music-metadata chapters field', async () => {
    const rawChapters = [
      { title: 'Foreword', startTime: 0 },
      { title: 'Chapter 1', startTime: 120 },
      { title: 'Chapter 2', startTime: 480 },
    ]

    vi.doMock('music-metadata', () => ({
      parseBlob: vi
        .fn()
        .mockResolvedValue(mockMusicMetadata({ chaptersField: rawChapters, duration: 600 })),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const file = makeM4bFile()
    const result = await parse(file, BOOK_ID)

    expect(result.chapters).toHaveLength(3)
    expect(result.chapters[0].title).toBe('Foreword')
    expect(result.chapters[0].position).toEqual({ type: 'time', seconds: 0 })
    expect(result.chapters[0].bookId).toBe(BOOK_ID)

    expect(result.chapters[1].title).toBe('Chapter 1')
    expect(result.chapters[1].position).toEqual({ type: 'time', seconds: 120 })

    expect(result.chapters[2].title).toBe('Chapter 2')
    expect(result.chapters[2].position).toEqual({ type: 'time', seconds: 480 })
  })

  it('assigns sequential order values to chapters', async () => {
    const rawChapters = [
      { title: 'Ch A', startTime: 0 },
      { title: 'Ch B', startTime: 60 },
      { title: 'Ch C', startTime: 180 },
    ]

    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(mockMusicMetadata({ chaptersField: rawChapters })),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.chapters[0].order).toBe(0)
    expect(result.chapters[1].order).toBe(1)
    expect(result.chapters[2].order).toBe(2)
  })

  it('derives startTime from sampleOffset when startTime is absent', async () => {
    const sampleRate = 44100
    const rawChapters = [
      { title: 'Ch 1', sampleOffset: 0 },
      { title: 'Ch 2', sampleOffset: sampleRate * 60 }, // 60 seconds
    ]

    vi.doMock('music-metadata', () => ({
      parseBlob: vi
        .fn()
        .mockResolvedValue(mockMusicMetadata({ chaptersField: rawChapters, sampleRate })),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.chapters[1].position).toEqual({ type: 'time', seconds: 60 })
  })

  it('extracts title, author, and duration from metadata', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(
        mockMusicMetadata({
          title: 'My Audiobook',
          artist: 'Great Author',
          duration: 7200,
          chaptersField: [{ title: 'Ch 1', startTime: 0 }],
        })
      ),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.title).toBe('My Audiobook')
    expect(result.author).toBe('Great Author')
    expect(result.totalDuration).toBe(7200)
  })

  it('falls back to filename as title when metadata title is absent', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(
        mockMusicMetadata({
          title: '',
          chaptersField: [{ title: 'Ch 1', startTime: 0 }],
        })
      ),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile('my-audiobook.m4b'), BOOK_ID)

    // Falls back to filename without extension
    expect(result.title).toBe('my-audiobook')
  })

  it('generates unique IDs for each chapter', async () => {
    const rawChapters = [
      { title: 'A', startTime: 0 },
      { title: 'B', startTime: 100 },
      { title: 'C', startTime: 200 },
    ]

    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(mockMusicMetadata({ chaptersField: rawChapters })),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    const ids = result.chapters.map(ch => ch.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('uses placeholder title "Chapter N" when chapter title is absent', async () => {
    const rawChapters = [
      { startTime: 0 }, // no title
      { title: '', startTime: 100 }, // empty title
    ]

    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(mockMusicMetadata({ chaptersField: rawChapters })),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.chapters[0].title).toBe('Chapter 1')
    expect(result.chapters[1].title).toBe('Chapter 2')
  })
})

// ---------------------------------------------------------------------------
// 6.2 — Single-file playback: chapter seek navigates within file
// ---------------------------------------------------------------------------

describe('isSingleFileAudiobook — 6.2: single-file detection', () => {
  it('returns true for a book with an .m4b opfsPath', () => {
    const book = makeAudiobookBook()
    expect(isSingleFileAudiobook(book)).toBe(true)
  })

  it('returns true when opfsPath ends with any .m4b extension', () => {
    const book = makeAudiobookBook({
      source: { type: 'local', opfsPath: 'books/my-audiobook.m4b' },
    })
    expect(isSingleFileAudiobook(book)).toBe(true)
  })

  it('returns false for a non-audiobook format', () => {
    const book = makeAudiobookBook({ format: 'epub' })
    expect(isSingleFileAudiobook(book)).toBe(false)
  })

  it('returns false for a remote source book', () => {
    const book = makeAudiobookBook({
      source: { type: 'remote', url: 'https://example.com/book.m4b' },
    })
    expect(isSingleFileAudiobook(book)).toBe(false)
  })

  it('returns false for a local MP3-based audiobook (multi-file)', () => {
    const book = makeAudiobookBook({
      source: { type: 'local', opfsPath: 'books/book-1/chapter-00.mp3' },
    })
    expect(isSingleFileAudiobook(book)).toBe(false)
  })
})

describe('formatAudioTime — 6.2: time formatting for seek display', () => {
  it('formats seconds under an hour as mm:ss', () => {
    expect(formatAudioTime(0)).toBe('0:00')
    expect(formatAudioTime(59)).toBe('0:59')
    expect(formatAudioTime(90)).toBe('1:30')
    expect(formatAudioTime(3599)).toBe('59:59')
  })

  it('formats seconds >= 1 hour as h:mm:ss', () => {
    expect(formatAudioTime(3600)).toBe('1:00:00')
    expect(formatAudioTime(3661)).toBe('1:01:01')
    expect(formatAudioTime(7200)).toBe('2:00:00')
    expect(formatAudioTime(36000)).toBe('10:00:00')
  })

  it('pads minutes and seconds with leading zeros', () => {
    expect(formatAudioTime(61)).toBe('1:01')
    expect(formatAudioTime(3601)).toBe('1:00:01')
  })
})

// ---------------------------------------------------------------------------
// 6.3 — Chapter progress detection (which chapter is current based on time)
// ---------------------------------------------------------------------------

describe('chapter progress detection — 6.3: current chapter from currentTime', () => {
  /**
   * Replicates the logic used in useAudioPlayer's setInterval to find the
   * current chapter index based on audio.currentTime.
   */
  function detectCurrentChapter(chapters: Book['chapters'], currentTime: number): number {
    for (let i = chapters.length - 1; i >= 0; i--) {
      const pos = chapters[i].position
      const startTime = pos.type === 'time' ? pos.seconds : 0
      if (currentTime >= startTime) return i
    }
    return 0
  }

  const chapters: Book['chapters'] = [
    { id: 'ch-1', bookId: 'b', title: 'Intro', order: 0, position: { type: 'time', seconds: 0 } },
    { id: 'ch-2', bookId: 'b', title: 'Ch 1', order: 1, position: { type: 'time', seconds: 300 } },
    { id: 'ch-3', bookId: 'b', title: 'Ch 2', order: 2, position: { type: 'time', seconds: 900 } },
    { id: 'ch-4', bookId: 'b', title: 'Ch 3', order: 3, position: { type: 'time', seconds: 1800 } },
  ]

  it('returns chapter 0 when currentTime is at 0', () => {
    expect(detectCurrentChapter(chapters, 0)).toBe(0)
  })

  it('returns chapter 0 when currentTime is within first chapter', () => {
    expect(detectCurrentChapter(chapters, 100)).toBe(0)
    expect(detectCurrentChapter(chapters, 299)).toBe(0)
  })

  it('returns chapter 1 when currentTime is exactly at its start', () => {
    expect(detectCurrentChapter(chapters, 300)).toBe(1)
  })

  it('returns chapter 1 when currentTime is within second chapter', () => {
    expect(detectCurrentChapter(chapters, 500)).toBe(1)
    expect(detectCurrentChapter(chapters, 899)).toBe(1)
  })

  it('returns chapter 2 when currentTime crosses the third chapter boundary', () => {
    expect(detectCurrentChapter(chapters, 900)).toBe(2)
    expect(detectCurrentChapter(chapters, 1200)).toBe(2)
  })

  it('returns last chapter when currentTime is beyond all chapter starts', () => {
    expect(detectCurrentChapter(chapters, 1800)).toBe(3)
    expect(detectCurrentChapter(chapters, 9999)).toBe(3)
  })

  it('returns chapter 0 when only a single chapter exists', () => {
    const single: Book['chapters'] = [
      {
        id: 'ch-1',
        bookId: 'b',
        title: 'Full Book',
        order: 0,
        position: { type: 'time', seconds: 0 },
      },
    ]
    expect(detectCurrentChapter(single, 0)).toBe(0)
    expect(detectCurrentChapter(single, 5000)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 6.5 — Fallback: M4B without chapters creates single-chapter book
// ---------------------------------------------------------------------------

describe('parseM4bFile — 6.5: single-chapter fallback', () => {
  const BOOK_ID = 'fallback-book-id'

  beforeEach(() => {
    vi.resetModules()
  })

  it('creates a single chapter starting at 0 when no chapters found', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(
        mockMusicMetadata({
          title: 'No Chapter Book',
          duration: 1800,
          // no chaptersField and no itunesTags
        })
      ),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].position).toEqual({ type: 'time', seconds: 0 })
    expect(result.chapters[0].bookId).toBe(BOOK_ID)
  })

  it('uses the book title as the single chapter title in fallback', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi
        .fn()
        .mockResolvedValue(mockMusicMetadata({ title: 'War and Peace', duration: 86400 })),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.chapters[0].title).toBe('War and Peace')
  })

  it('falls back to single chapter when chapters field is an empty array', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi
        .fn()
        .mockResolvedValue(mockMusicMetadata({ chaptersField: [], duration: 3600 })),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].order).toBe(0)
  })

  it('falls back to single chapter when iTunes native tags are absent', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(
        mockMusicMetadata({
          title: 'Lonely Book',
          itunesTags: [], // empty iTunes tags — no chapter markers
        })
      ),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.chapters).toHaveLength(1)
  })

  it('assigns the provided bookId to the fallback chapter', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(mockMusicMetadata({})),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const customBookId = 'my-custom-book-id'
    const result = await parse(makeM4bFile(), customBookId)

    expect(result.chapters[0].bookId).toBe(customBookId)
  })

  it('returns null coverBlob when no cover art is embedded', async () => {
    vi.doMock('music-metadata', () => ({
      parseBlob: vi.fn().mockResolvedValue(mockMusicMetadata({})),
    }))

    const { parseM4bFile: parse } = await import('@/services/M4bParserService')
    const result = await parse(makeM4bFile(), BOOK_ID)

    expect(result.coverBlob).toBeNull()
  })
})
