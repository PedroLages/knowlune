/**
 * usePagesReadToday.test.ts — unit tests for pages read estimation with user speed.
 *
 * @module usePagesReadToday
 * @since E112-S01
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Fixed date for deterministic tests
const FIXED_DATE = new Date('2026-04-12T12:00:00Z')

vi.mock('@/db/schema', () => ({
  db: {
    books: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    studySessions: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          filter: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    },
  },
}))

vi.mock('@/lib/studyLog', () => ({
  toLocalDateString: vi.fn((date: Date) => date.toISOString().split('T')[0]),
}))

vi.mock('@/services/ReadingStatsService', () => ({
  computeAverageReadingSpeed: vi.fn().mockResolvedValue(null),
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_DATE)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('getPagesReadToday', () => {
  it('uses computed reading speed when available', async () => {
    const { db } = await import('@/db/schema')
    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')

    // Set up: user has 60 pages/hour speed
    vi.mocked(computeAverageReadingSpeed).mockResolvedValue(60)

    // Book with 120 minutes of reading today
    // progress: 50% → currentPage = 150, above estimated 120, so cap won't trigger
    vi.mocked(db.books.toArray).mockResolvedValue([
      {
        id: 'book1',
        title: 'Test',
        status: 'reading',
        totalPages: 300,
        progress: 50,
        currentPosition: { type: 'cfi', cfi: '' },
        lastOpenedAt: FIXED_DATE.toISOString(),
      },
    ] as never)

    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              id: 's1',
              contentItemId: 'book1',
              startTime: FIXED_DATE.toISOString(),
              duration: 7200, // 2 hours
            },
          ]),
        }),
      }),
    } as never)

    const { getPagesReadToday } = await import('@/app/hooks/usePagesReadToday')
    const pages = await getPagesReadToday()

    // 60 pages/hour * 2 hours = 120 pages
    expect(pages).toBe(120)
  })

  it('falls back to 2 min/page when no speed data exists', async () => {
    const { db } = await import('@/db/schema')
    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')

    // No reading speed data (new user)
    vi.mocked(computeAverageReadingSpeed).mockResolvedValue(null)

    // Book with 120 minutes of reading today
    vi.mocked(db.books.toArray).mockResolvedValue([
      {
        id: 'book1',
        title: 'Test',
        status: 'reading',
        totalPages: 300,
        progress: 25,
        currentPosition: { type: 'cfi', cfi: '' },
        lastOpenedAt: FIXED_DATE.toISOString(),
      },
    ] as never)

    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              id: 's1',
              contentItemId: 'book1',
              startTime: FIXED_DATE.toISOString(),
              duration: 7200, // 2 hours = 120 minutes
            },
          ]),
        }),
      }),
    } as never)

    const { getPagesReadToday } = await import('@/app/hooks/usePagesReadToday')
    const pages = await getPagesReadToday()

    // Fallback: 120 minutes / 2 min/page = 60 pages
    expect(pages).toBe(60)
  })

  it('caps estimate at currentPage for EPUB books', async () => {
    const { db } = await import('@/db/schema')
    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')

    // High speed to push estimate over currentPage
    vi.mocked(computeAverageReadingSpeed).mockResolvedValue(300)

    // Book at 50 pages, but long session would estimate 200 pages
    vi.mocked(db.books.toArray).mockResolvedValue([
      {
        id: 'book1',
        title: 'Test EPUB',
        status: 'reading',
        totalPages: 300,
        progress: 16.67, // 50 pages out of 300
        currentPosition: { type: 'cfi', cfi: '' },
        lastOpenedAt: FIXED_DATE.toISOString(),
      },
    ] as never)

    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              id: 's1',
              contentItemId: 'book1',
              startTime: FIXED_DATE.toISOString(),
              duration: 2400, // 40 minutes at 300 pages/hr = 200 pages estimate
            },
          ]),
        }),
      }),
    } as never)

    const { getPagesReadToday } = await import('@/app/hooks/usePagesReadToday')
    const pages = await getPagesReadToday()

    // Capped at currentPage (50)
    expect(pages).toBe(50)
  })

  it('skips books without lastOpenedAt', async () => {
    const { db } = await import('@/db/schema')
    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')

    vi.mocked(computeAverageReadingSpeed).mockResolvedValue(60)

    vi.mocked(db.books.toArray).mockResolvedValue([
      {
        id: 'book1',
        title: 'Never opened',
        status: 'reading',
        totalPages: 300,
        progress: 0,
        currentPosition: { type: 'cfi', cfi: '' },
        lastOpenedAt: null, // Not opened today
      },
    ] as never)

    const { getPagesReadToday } = await import('@/app/hooks/usePagesReadToday')
    const pages = await getPagesReadToday()

    expect(pages).toBe(0)
  })

  it('skips sessions under 30 seconds', async () => {
    const { db } = await import('@/db/schema')
    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')

    vi.mocked(computeAverageReadingSpeed).mockResolvedValue(60)

    vi.mocked(db.books.toArray).mockResolvedValue([
      {
        id: 'book1',
        title: 'Test',
        status: 'reading',
        totalPages: 300,
        progress: 25,
        currentPosition: { type: 'cfi', cfi: '' },
        lastOpenedAt: FIXED_DATE.toISOString(),
      },
    ] as never)

    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              id: 's1',
              contentItemId: 'book1',
              startTime: FIXED_DATE.toISOString(),
              duration: 20, // 20 seconds — below 30s threshold
            },
          ]),
        }),
      }),
    } as never)

    const { getPagesReadToday } = await import('@/app/hooks/usePagesReadToday')
    const pages = await getPagesReadToday()

    expect(pages).toBe(0)
  })

  it('aggregates multiple books', async () => {
    const { db } = await import('@/db/schema')
    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')

    vi.mocked(computeAverageReadingSpeed).mockResolvedValue(60)

    vi.mocked(db.books.toArray).mockResolvedValue([
      {
        id: 'book1',
        title: 'Book 1',
        status: 'reading',
        totalPages: 300,
        progress: 25,
        currentPosition: { type: 'cfi', cfi: '' },
        lastOpenedAt: FIXED_DATE.toISOString(),
      },
      {
        id: 'book2',
        title: 'Book 2',
        status: 'reading',
        totalPages: 250,
        progress: 40,
        currentPosition: { type: 'page', pageNumber: 100 },
        lastOpenedAt: FIXED_DATE.toISOString(),
      },
    ] as never)

    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        filter: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([
            {
              id: 's1',
              contentItemId: 'book1',
              startTime: FIXED_DATE.toISOString(),
              duration: 3600, // 1 hour = 60 pages
            },
            {
              id: 's2',
              contentItemId: 'book2',
              startTime: FIXED_DATE.toISOString(),
              duration: 1800, // 30 minutes = 30 pages
            },
          ]),
        }),
      }),
    } as never)

    const { getPagesReadToday } = await import('@/app/hooks/usePagesReadToday')
    const pages = await getPagesReadToday()

    // 60 + 30 = 90 pages total
    expect(pages).toBe(90)
  })
})
