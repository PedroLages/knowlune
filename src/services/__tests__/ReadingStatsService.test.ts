import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatReadingTime } from '@/services/ReadingStatsService'

// ---------------------------------------------------------------------------
// Mock Dexie db
// ---------------------------------------------------------------------------

vi.mock('@/db/schema', () => ({
  db: {
    studySessions: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
    books: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0),
        }),
      }),
    },
  },
}))

vi.mock('@/lib/studyLog', () => ({
  toLocalDateString: vi.fn((date: Date) => date.toISOString().split('T')[0]),
}))

import { db } from '@/db/schema'
import { toLocalDateString } from '@/lib/studyLog'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// formatReadingTime
// ---------------------------------------------------------------------------

describe('formatReadingTime', () => {
  it('returns "0m" for less than 1 minute', () => {
    expect(formatReadingTime(0)).toBe('0m')
    expect(formatReadingTime(0.5)).toBe('0m')
  })

  it('returns minutes only when under 1 hour', () => {
    expect(formatReadingTime(30)).toBe('30m')
    expect(formatReadingTime(59)).toBe('59m')
  })

  it('returns hours only when minutes are 0', () => {
    expect(formatReadingTime(60)).toBe('1h')
    expect(formatReadingTime(120)).toBe('2h')
  })

  it('returns hours and minutes combined', () => {
    expect(formatReadingTime(90)).toBe('1h 30m')
    expect(formatReadingTime(150)).toBe('2h 30m')
  })

  it('rounds minutes', () => {
    expect(formatReadingTime(61.7)).toBe('1h 2m')
  })
})

// ---------------------------------------------------------------------------
// getTimeReadToday
// ---------------------------------------------------------------------------

describe('getTimeReadToday', () => {
  it('returns 0 when no sessions exist', async () => {
    const { getTimeReadToday } = await import('@/services/ReadingStatsService')
    const minutes = await getTimeReadToday()
    expect(minutes).toBe(0)
  })

  it('sums duration of today sessions in minutes', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { startTime: '2026-04-06T08:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T14:00:00Z', duration: 900 },
          { startTime: '2026-04-05T10:00:00Z', duration: 3600 }, // yesterday — excluded
        ]),
      }),
    } as never)

    const { getTimeReadToday } = await import('@/services/ReadingStatsService')
    const minutes = await getTimeReadToday()
    expect(minutes).toBe(45) // (1800 + 900) / 60
  })

  it('skips sessions without startTime', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { startTime: null, duration: 1800 },
          { startTime: '2026-04-06T08:00:00Z', duration: 600 },
        ]),
      }),
    } as never)

    const { getTimeReadToday } = await import('@/services/ReadingStatsService')
    const minutes = await getTimeReadToday()
    expect(minutes).toBe(10) // 600 / 60
  })
})

// ---------------------------------------------------------------------------
// getReadingTimeTrend
// ---------------------------------------------------------------------------

describe('getReadingTimeTrend', () => {
  it('returns array of date/minutes for last N days', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const { getReadingTimeTrend } = await import('@/services/ReadingStatsService')
    const trend = await getReadingTimeTrend(7)

    expect(trend).toHaveLength(7)
    expect(trend[0]).toHaveProperty('date')
    expect(trend[0]).toHaveProperty('minutes')
  })

  it('trend is sorted chronologically', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const { getReadingTimeTrend } = await import('@/services/ReadingStatsService')
    const trend = await getReadingTimeTrend(7)

    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].date >= trend[i - 1].date).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// getBookStatusCounts
// ---------------------------------------------------------------------------

describe('getBookStatusCounts', () => {
  it('returns inProgress and finished counts', async () => {
    let callCount = 0
    vi.mocked(db.books.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        count: vi.fn().mockImplementation(() => {
          callCount++
          return Promise.resolve(callCount === 1 ? 3 : 5)
        }),
      }),
    } as never)

    const { getBookStatusCounts } = await import('@/services/ReadingStatsService')
    const counts = await getBookStatusCounts()

    expect(counts.inProgress).toBe(3)
    expect(counts.finished).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// getReadingStats
// ---------------------------------------------------------------------------

describe('getReadingStats', () => {
  it('returns combined stats object', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    } as never)
    vi.mocked(db.books.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0),
      }),
    } as never)

    const { getReadingStats } = await import('@/services/ReadingStatsService')
    const stats = await getReadingStats()

    expect(stats).toHaveProperty('timeReadTodayMinutes')
    expect(stats).toHaveProperty('booksInProgress')
    expect(stats).toHaveProperty('totalBooksFinished')
    expect(stats).toHaveProperty('readingTrend')
    expect(stats.readingTrend).toHaveLength(14)
  })
})
