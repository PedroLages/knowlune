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
    expect(stats).toHaveProperty('avgReadingSpeedPagesPerHour')
    expect(stats).toHaveProperty('readingTrend')
    expect(stats.readingTrend).toHaveLength(14)
  })
})

// ---------------------------------------------------------------------------
// computeAverageReadingSpeed (E112-S01)
// ---------------------------------------------------------------------------

describe('computeAverageReadingSpeed', () => {
  it('returns null when no finished books exist', async () => {
    vi.mocked(db.books.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')
    const speed = await computeAverageReadingSpeed()

    expect(speed).toBeNull()
  })

  it('returns null when finished books have no totalPages', async () => {
    vi.mocked(db.books.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            id: 'book1',
            status: 'finished',
            totalPages: 0,
            progress: 100,
          },
        ]),
      }),
    } as never)
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    } as never)

    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')
    const speed = await computeAverageReadingSpeed()

    expect(speed).toBeNull()
  })

  it('computes speed as totalPages * 3600 / totalSeconds', async () => {
    vi.mocked(db.books.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            id: 'book1',
            status: 'finished',
            totalPages: 300,
            progress: 100,
          },
        ]),
      }),
    } as never)

    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { contentItemId: 'book1', startTime: '2026-04-06T08:00:00Z', duration: 36000 }, // 10 hours
        ]),
      }),
    } as never)

    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')
    const speed = await computeAverageReadingSpeed()

    // 300 pages / 10 hours = 30 pages/hour
    expect(speed).toBe(30)
  })

  it('ignores sessions older than 90 days', async () => {
    vi.mocked(db.books.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          {
            id: 'book1',
            status: 'finished',
            totalPages: 300,
            progress: 100,
          },
        ]),
      }),
    } as never)

    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { contentItemId: 'book1', startTime: '2025-11-08T08:00:00Z', duration: 36000 }, // 95 days ago
          { contentItemId: 'book1', startTime: '2026-03-28T08:00:00Z', duration: 7200 }, // 9 days ago
        ]),
      }),
    } as never)

    const { computeAverageReadingSpeed } = await import('@/services/ReadingStatsService')
    const speed = await computeAverageReadingSpeed()

    // Only recent session: 300 / 2 = 150 pages/hour
    expect(speed).toBe(150)
  })
})

// ---------------------------------------------------------------------------
// getTimeOfDayPattern (E112-S01)
// ---------------------------------------------------------------------------

describe('getTimeOfDayPattern', () => {
  it('returns null when fewer than 7 sessions exist', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { startTime: '2026-04-06T09:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T10:00:00Z', duration: 1800 },
        ]),
      }),
    } as never)

    const { getTimeOfDayPattern } = await import('@/services/ReadingStatsService')
    const pattern = await getTimeOfDayPattern()

    expect(pattern).toBeNull()
  })

  it('buckets sessions by time of day', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { startTime: '2026-04-06T06:00:00Z', duration: 1800 }, // Morning
          { startTime: '2026-04-06T14:00:00Z', duration: 1800 }, // Afternoon
          { startTime: '2026-04-06T19:00:00Z', duration: 1800 }, // Evening
          { startTime: '2026-04-06T23:00:00Z', duration: 1800 }, // Night
          { startTime: '2026-04-06T02:00:00Z', duration: 1800 }, // Night (wrapped)
          { startTime: '2026-04-06T10:00:00Z', duration: 1800 }, // Morning
          { startTime: '2026-04-06T10:30:00Z', duration: 1800 }, // Morning
        ]),
      }),
    } as never)

    const { getTimeOfDayPattern } = await import('@/services/ReadingStatsService')
    const pattern = await getTimeOfDayPattern()

    expect(pattern).not.toBeNull()
    if (pattern) {
      const morning = pattern.buckets.find(b => b.period === 'Morning')
      expect(morning?.count).toBe(3)

      const afternoon = pattern.buckets.find(b => b.period === 'Afternoon')
      expect(afternoon?.count).toBe(1)

      const evening = pattern.buckets.find(b => b.period === 'Evening')
      expect(evening?.count).toBe(1)

      const night = pattern.buckets.find(b => b.period === 'Night')
      expect(night?.count).toBe(2)

      expect(pattern.dominant).toBe('Morning')
    }
  })

  it('calculates percentages correctly', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { startTime: '2026-04-06T06:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T06:30:00Z', duration: 1800 },
          { startTime: '2026-04-06T06:45:00Z', duration: 1800 },
          { startTime: '2026-04-06T06:50:00Z', duration: 1800 },
          { startTime: '2026-04-06T14:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T14:30:00Z', duration: 1800 },
          { startTime: '2026-04-06T14:45:00Z', duration: 1800 },
          { startTime: '2026-04-06T19:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T19:30:00Z', duration: 1800 },
          { startTime: '2026-04-06T23:00:00Z', duration: 1800 },
        ]),
      }),
    } as never)

    const { getTimeOfDayPattern } = await import('@/services/ReadingStatsService')
    const pattern = await getTimeOfDayPattern()

    expect(pattern).not.toBeNull()
    if (pattern) {
      const morning = pattern.buckets.find(b => b.period === 'Morning')
      expect(morning?.percentage).toBe(40) // 4 out of 10

      const afternoon = pattern.buckets.find(b => b.period === 'Afternoon')
      expect(afternoon?.percentage).toBe(30) // 3 out of 10

      const evening = pattern.buckets.find(b => b.period === 'Evening')
      expect(evening?.percentage).toBe(20) // 2 out of 10

      const night = pattern.buckets.find(b => b.period === 'Night')
      expect(night?.percentage).toBe(10) // 1 out of 10
    }
  })

  it('identifies dominant bucket correctly', async () => {
    vi.mocked(db.studySessions.where).mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { startTime: '2026-04-06T06:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T14:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T19:00:00Z', duration: 1800 },
          { startTime: '2026-04-06T19:30:00Z', duration: 1800 },
          { startTime: '2026-04-06T19:45:00Z', duration: 1800 },
          { startTime: '2026-04-06T19:50:00Z', duration: 1800 },
          { startTime: '2026-04-06T19:55:00Z', duration: 1800 },
        ]),
      }),
    } as never)

    const { getTimeOfDayPattern } = await import('@/services/ReadingStatsService')
    const pattern = await getTimeOfDayPattern()

    expect(pattern?.dominant).toBe('Evening') // 5 out of 7 sessions
  })
})
