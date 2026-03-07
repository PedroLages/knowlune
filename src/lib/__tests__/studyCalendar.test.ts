import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildMonthData, getMonthStudyData } from '@/lib/studyCalendar'
import type { StudyAction } from '@/lib/studyLog'

function makeAction(overrides: Partial<StudyAction> = {}): StudyAction {
  return {
    type: 'lesson_complete',
    courseId: 'course-1',
    timestamp: '2026-03-10T12:00:00.000Z',
    ...overrides,
  }
}

describe('buildMonthData', () => {
  it('returns all days of month with empty sessions when log is empty', () => {
    const result = buildMonthData([], [], 2026, 3) // March 2026 = 31 days
    expect(result.size).toBe(31)

    for (const [, day] of result) {
      expect(day.sessions).toEqual([])
    }
  })

  it('correctly computes days in February (non-leap year)', () => {
    const result = buildMonthData([], [], 2026, 2) // Feb 2026 = 28 days
    expect(result.size).toBe(28)
  })

  it('correctly computes days in February (leap year)', () => {
    const result = buildMonthData([], [], 2024, 2) // Feb 2024 = 29 days
    expect(result.size).toBe(29)
  })

  it('aggregates multiple actions on the same day', () => {
    const log: StudyAction[] = [
      makeAction({ timestamp: '2026-03-10T09:00:00.000Z', courseId: 'course-1' }),
      makeAction({
        timestamp: '2026-03-10T14:00:00.000Z',
        courseId: 'course-2',
        type: 'note_saved',
      }),
      makeAction({ timestamp: '2026-03-10T18:00:00.000Z', courseId: 'course-1' }),
    ]
    const result = buildMonthData(log, [], 2026, 3)
    const day10 = result.get('2026-03-10')

    expect(day10).toBeDefined()
    expect(day10!.sessions).toHaveLength(3)
    expect(day10!.sessions[0].courseId).toBe('course-1')
    expect(day10!.sessions[1].courseId).toBe('course-2')
    expect(day10!.sessions[1].type).toBe('note_saved')
  })

  it('excludes actions from other months', () => {
    const log: StudyAction[] = [
      makeAction({ timestamp: '2026-02-28T12:00:00.000Z' }), // February
      makeAction({ timestamp: '2026-03-15T12:00:00.000Z' }), // March (included)
      makeAction({ timestamp: '2026-04-01T12:00:00.000Z' }), // April
    ]
    const result = buildMonthData(log, [], 2026, 3)

    // Only March 15 should have a session
    const mar15 = result.get('2026-03-15')
    expect(mar15!.sessions).toHaveLength(1)

    // Feb and Apr entries should not be in the map
    const feb28 = result.get('2026-02-28')
    const apr1 = result.get('2026-04-01')
    expect(feb28).toBeUndefined()
    expect(apr1).toBeUndefined()
  })

  it('handles year boundary (December → January)', () => {
    const log: StudyAction[] = [
      makeAction({ timestamp: '2025-12-31T12:00:00.000Z' }), // Dec (midday UTC — safe in all timezones)
      makeAction({ timestamp: '2026-01-01T12:00:00.000Z' }), // Jan
    ]
    // Query January 2026
    const janResult = buildMonthData(log, [], 2026, 1)
    expect(janResult.size).toBe(31)

    const jan1 = janResult.get('2026-01-01')
    expect(jan1!.sessions).toHaveLength(1)

    // Dec entry should not appear in January
    expect(janResult.get('2025-12-31')).toBeUndefined()

    // Query December 2025
    const decResult = buildMonthData(log, [], 2025, 12)
    expect(decResult.size).toBe(31)
    const dec31 = decResult.get('2025-12-31')
    expect(dec31!.sessions).toHaveLength(1)
  })

  it('marks freeze days by weekday index', () => {
    // Set Sunday (0) and Saturday (6) as freeze days
    const result = buildMonthData([], [0, 6], 2026, 3) // March 2026

    // March 1, 2026 is a Sunday
    const mar1 = result.get('2026-03-01')
    expect(mar1!.isFreezeDay).toBe(true)

    // March 7, 2026 is a Saturday
    const mar7 = result.get('2026-03-07')
    expect(mar7!.isFreezeDay).toBe(true)

    // March 2, 2026 is a Monday — not a freeze day
    const mar2 = result.get('2026-03-02')
    expect(mar2!.isFreezeDay).toBe(false)
  })

  it('marks freeze days that also have activity (data-level only)', () => {
    // A freeze day with study activity should still have isFreezeDay=true
    // (the component decides whether to render the indicator)
    const log: StudyAction[] = [
      makeAction({ timestamp: '2026-03-01T12:00:00.000Z' }), // Sunday
    ]
    const result = buildMonthData(log, [0], 2026, 3) // Sunday=freeze

    const mar1 = result.get('2026-03-01')
    expect(mar1!.isFreezeDay).toBe(true)
    expect(mar1!.sessions).toHaveLength(1)
  })

  it('preserves session fields (courseId, timestamp, type)', () => {
    const log: StudyAction[] = [
      makeAction({
        timestamp: '2026-03-05T14:30:00.000Z',
        courseId: 'ba-101',
        type: 'video_progress',
      }),
    ]
    const result = buildMonthData(log, [], 2026, 3)
    const day = result.get('2026-03-05')

    expect(day!.sessions[0]).toEqual({
      courseId: 'ba-101',
      timestamp: '2026-03-05T14:30:00.000Z',
      type: 'video_progress',
    })
  })

  it('handles empty freeze days array', () => {
    const result = buildMonthData([], [], 2026, 3)
    for (const [, day] of result) {
      expect(day.isFreezeDay).toBe(false)
    }
  })
})

describe('getMonthStudyData', () => {
  const originalLocalStorage = globalThis.localStorage

  beforeEach(() => {
    // Create a mock localStorage
    const store: Record<string, string> = {}
    const mockStorage = {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach(k => delete store[k])
      }),
      get length() {
        return Object.keys(store).length
      },
      key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    }
    Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, writable: true })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    })
  })

  it('reads study log and freeze days from localStorage', () => {
    const log: StudyAction[] = [
      makeAction({ timestamp: '2026-03-10T12:00:00.000Z', courseId: 'c1' }),
    ]
    localStorage.setItem('study-log', JSON.stringify(log))
    localStorage.setItem('study-streak-freeze-days', JSON.stringify({ freezeDays: [0, 6] }))

    const result = getMonthStudyData(2026, 3)
    expect(result.size).toBe(31)

    const day10 = result.get('2026-03-10')
    expect(day10!.sessions).toHaveLength(1)
    expect(day10!.sessions[0].courseId).toBe('c1')

    // Sunday (March 1) should be freeze day
    const mar1 = result.get('2026-03-01')
    expect(mar1!.isFreezeDay).toBe(true)
  })

  it('returns empty sessions when localStorage has no study-log', () => {
    const result = getMonthStudyData(2026, 3)
    expect(result.size).toBe(31)
    for (const [, day] of result) {
      expect(day.sessions).toEqual([])
    }
  })

  it('handles corrupted freeze-days gracefully', () => {
    localStorage.setItem('study-streak-freeze-days', '{invalid json!!!')
    const result = getMonthStudyData(2026, 3)
    // Should not throw — returns data with no freeze days
    expect(result.size).toBe(31)
    for (const [, day] of result) {
      expect(day.isFreezeDay).toBe(false)
    }
  })
})
