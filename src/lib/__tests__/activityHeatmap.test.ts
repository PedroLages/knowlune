import { describe, it, expect } from 'vitest'
import {
  getActivityLevel,
  aggregateSessionsByDay,
  buildHeatmapGrid,
  getMonthlyHeatmapSummary,
  formatStudyTime,
} from '@/lib/activityHeatmap'
import type { StudySession } from '@/data/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  overrides: Partial<Pick<StudySession, 'startTime' | 'duration' | 'endTime'>>
): Pick<StudySession, 'startTime' | 'duration' | 'endTime'> {
  return {
    startTime: '2026-03-10T12:00:00.000Z',
    duration: 600, // 10 min
    endTime: '2026-03-10T12:10:00.000Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// getActivityLevel
// ---------------------------------------------------------------------------

describe('getActivityLevel', () => {
  it('returns 0 for zero seconds', () => {
    expect(getActivityLevel(0)).toBe(0)
  })

  it('returns 0 for negative seconds', () => {
    expect(getActivityLevel(-1)).toBe(0)
  })

  it('returns 1 for 1s to 899s (< 15 min)', () => {
    expect(getActivityLevel(1)).toBe(1)
    expect(getActivityLevel(899)).toBe(1)
  })

  it('returns 2 for 900s to 2699s (15–44 min)', () => {
    expect(getActivityLevel(900)).toBe(2)
    expect(getActivityLevel(2699)).toBe(2)
  })

  it('returns 3 for 2700s to 5399s (45–89 min)', () => {
    expect(getActivityLevel(2700)).toBe(3)
    expect(getActivityLevel(5399)).toBe(3)
  })

  it('returns 4 for 5400s+ (90+ min)', () => {
    expect(getActivityLevel(5400)).toBe(4)
    expect(getActivityLevel(100000)).toBe(4)
  })

  it('boundary: exactly 15 min → level 2', () => {
    expect(getActivityLevel(15 * 60)).toBe(2)
  })

  it('boundary: exactly 45 min → level 3', () => {
    expect(getActivityLevel(45 * 60)).toBe(3)
  })

  it('boundary: exactly 90 min → level 4', () => {
    expect(getActivityLevel(90 * 60)).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// aggregateSessionsByDay
// ---------------------------------------------------------------------------

describe('aggregateSessionsByDay', () => {
  const TODAY = '2026-03-23'

  it('returns a map with exactly `days` entries pre-populated to 0', () => {
    const result = aggregateSessionsByDay([], TODAY, 7)
    expect(result.size).toBe(7)
    for (const [, seconds] of result) {
      expect(seconds).toBe(0)
    }
  })

  it('pre-populates 365 days by default', () => {
    const result = aggregateSessionsByDay([], TODAY)
    expect(result.size).toBe(365)
  })

  it('includes today in the range', () => {
    const result = aggregateSessionsByDay([], TODAY, 7)
    expect(result.has(TODAY)).toBe(true)
  })

  it('sums duration for sessions on the same day', () => {
    const sessions = [
      makeSession({ startTime: '2026-03-23T08:00:00.000Z', duration: 1800 }),
      makeSession({ startTime: '2026-03-23T14:00:00.000Z', duration: 2700 }),
    ]
    const result = aggregateSessionsByDay(sessions, TODAY, 7)
    expect(result.get('2026-03-23')).toBe(4500)
  })

  it('skips orphaned sessions (no endTime)', () => {
    const sessions = [
      makeSession({ startTime: '2026-03-23T08:00:00.000Z', duration: 3600, endTime: undefined }),
    ]
    const result = aggregateSessionsByDay(sessions, TODAY, 7)
    expect(result.get('2026-03-23')).toBe(0)
  })

  it('ignores sessions outside the date window', () => {
    // Session from 2 years ago — outside 365-day window
    const sessions = [makeSession({ startTime: '2024-01-01T12:00:00.000Z', duration: 3600 })]
    const result = aggregateSessionsByDay(sessions, TODAY)
    expect(result.has('2024-01-01')).toBe(false)
  })

  it('handles sessions on the boundary date (oldest day in window)', () => {
    // With 7 days ending on 2026-03-23, the oldest day is 2026-03-17
    const sessions = [makeSession({ startTime: '2026-03-17T12:00:00.000Z', duration: 1200 })]
    const result = aggregateSessionsByDay(sessions, TODAY, 7)
    expect(result.get('2026-03-17')).toBe(1200)
  })

  it('handles empty session list', () => {
    const result = aggregateSessionsByDay([], TODAY, 30)
    expect(result.size).toBe(30)
    for (const [, val] of result) {
      expect(val).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// buildHeatmapGrid
// ---------------------------------------------------------------------------

describe('buildHeatmapGrid', () => {
  const TODAY = '2026-03-23' // Monday

  it('returns empty grid for empty dayMap', () => {
    const { grid, totalWeeks } = buildHeatmapGrid(new Map(), TODAY)
    expect(grid).toEqual([])
    expect(totalWeeks).toBe(0)
  })

  it('grid has exactly 7 rows', () => {
    const dayMap = aggregateSessionsByDay([], TODAY, 14)
    const { grid } = buildHeatmapGrid(dayMap, TODAY)
    expect(grid).toHaveLength(7)
  })

  it('all week columns across all rows have the same length', () => {
    const dayMap = aggregateSessionsByDay([], TODAY, 30)
    const { grid, totalWeeks } = buildHeatmapGrid(dayMap, TODAY)
    for (const row of grid) {
      expect(row).toHaveLength(totalWeeks)
    }
  })

  it('marks today correctly', () => {
    const dayMap = aggregateSessionsByDay([], TODAY, 14)
    const { grid } = buildHeatmapGrid(dayMap, TODAY)
    const todayCells = grid.flat().filter(cell => cell?.isToday)
    expect(todayCells).toHaveLength(1)
    expect(todayCells[0]?.date).toBe(TODAY)
  })

  it('generates month labels for each new month in range', () => {
    // March 23 - 7 days = March 17. All in March → 1 month label
    const dayMap = aggregateSessionsByDay([], TODAY, 7)
    const { monthLabels } = buildHeatmapGrid(dayMap, TODAY)
    expect(monthLabels).toHaveLength(1)
    expect(monthLabels[0].label).toBe('Mar')
  })

  it('generates two month labels when range spans two months', () => {
    // 30 days back from March 23 = Feb 21. Spans Feb + Mar
    const dayMap = aggregateSessionsByDay([], TODAY, 30)
    const { monthLabels } = buildHeatmapGrid(dayMap, TODAY)
    const labels = monthLabels.map(m => m.label)
    expect(labels).toContain('Feb')
    expect(labels).toContain('Mar')
  })

  it('assigns correct level to cells based on totalSeconds', () => {
    const sessions = [
      // 2026-03-23 = 3600s = level 3 (60 min, 45–89 min range)
      makeSession({ startTime: '2026-03-23T12:00:00.000Z', duration: 3600 }),
    ]
    const dayMap = aggregateSessionsByDay(sessions, TODAY, 7)
    const { grid } = buildHeatmapGrid(dayMap, TODAY)
    const todayCell = grid.flat().find(cell => cell?.date === TODAY)
    expect(todayCell?.level).toBe(3)
    expect(todayCell?.totalSeconds).toBe(3600)
  })

  it('null entries represent padding (partial first week)', () => {
    // 2026-03-23 is a Monday (dayOfWeek=1). With 7 days starting on 2026-03-17 (Tue)...
    // Actually let's use a specific date that starts mid-week.
    // Use a 3-day window starting on 2026-03-21 (Saturday, dayOfWeek=6)
    const dayMap = new Map([
      ['2026-03-21', 0],
      ['2026-03-22', 0],
      ['2026-03-23', 0],
    ])
    const { grid } = buildHeatmapGrid(dayMap, TODAY)
    // 2026-03-21 is a Saturday (dayOfWeek=6), so there should be 6 null entries before it
    let nullCount = 0
    for (const row of grid) {
      if (row[0] === null) nullCount++
    }
    // Rows 0 (Sun) through 5 (Fri) should have null in week 0
    expect(nullCount).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// getMonthlyHeatmapSummary
// ---------------------------------------------------------------------------

describe('getMonthlyHeatmapSummary', () => {
  it('returns empty array for empty dayMap', () => {
    expect(getMonthlyHeatmapSummary(new Map())).toEqual([])
  })

  it('counts activeDays correctly (days with >0 seconds)', () => {
    const dayMap = new Map([
      ['2026-03-10', 1800], // active
      ['2026-03-11', 0], // inactive
      ['2026-03-12', 3600], // active
    ])
    const result = getMonthlyHeatmapSummary(dayMap)
    expect(result).toHaveLength(1)
    expect(result[0].activeDays).toBe(2)
    expect(result[0].totalSeconds).toBe(5400)
  })

  it('aggregates multiple months separately', () => {
    const dayMap = new Map([
      ['2026-02-28', 1800],
      ['2026-03-01', 3600],
      ['2026-03-02', 900],
    ])
    const result = getMonthlyHeatmapSummary(dayMap)
    expect(result).toHaveLength(2)
    const feb = result.find(m => m.label.startsWith('Feb'))
    const mar = result.find(m => m.label.startsWith('Mar'))
    expect(feb?.totalSeconds).toBe(1800)
    expect(mar?.totalSeconds).toBe(4500)
  })
})

// ---------------------------------------------------------------------------
// formatStudyTime
// ---------------------------------------------------------------------------

describe('formatStudyTime', () => {
  it('returns "No activity" for 0 seconds', () => {
    expect(formatStudyTime(0)).toBe('No activity')
  })

  it('returns "No activity" for negative seconds', () => {
    expect(formatStudyTime(-100)).toBe('No activity')
  })

  it('returns "< 1 min" for less than 60 seconds', () => {
    expect(formatStudyTime(59)).toBe('< 1 min')
  })

  it('returns minutes only when under 1 hour', () => {
    expect(formatStudyTime(900)).toBe('15 min')
    expect(formatStudyTime(3540)).toBe('59 min')
  })

  it('returns hours only when exactly on the hour', () => {
    expect(formatStudyTime(3600)).toBe('1h')
    expect(formatStudyTime(7200)).toBe('2h')
  })

  it('returns hours and minutes for non-zero minutes', () => {
    expect(formatStudyTime(5400)).toBe('1h 30m')
    expect(formatStudyTime(9000)).toBe('2h 30m')
  })
})
