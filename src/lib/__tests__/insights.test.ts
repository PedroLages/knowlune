import { describe, it, expect } from 'vitest'
import { generateStudyInsight, type StudyInsightInputs } from '@/lib/insights'

function inputs(overrides: Partial<StudyInsightInputs> = {}): StudyInsightInputs {
  return {
    activeDaysThisMonth: 0,
    currentStreak: 0,
    previousBestStreak: 0,
    weeklyChange: 0,
    totalCompletedLessons: 0,
    ...overrides,
  }
}

describe('generateStudyInsight', () => {
  it('returns welcome message when no lessons completed', () => {
    const result = generateStudyInsight(inputs({ totalCompletedLessons: 0 }))
    expect(result).toBe('Start studying to build your learning fingerprint')
  })

  it('returns getting-started message for <10 lessons', () => {
    const result = generateStudyInsight(inputs({ totalCompletedLessons: 3 }))
    expect(result).toContain('3 lessons down')
    expect(result).toContain('fingerprint is forming')
  })

  it('returns getting-started with singular for 1 lesson', () => {
    const result = generateStudyInsight(inputs({ totalCompletedLessons: 1 }))
    expect(result).toContain('1 lesson down')
  })

  it('returns new personal record message when active >15, streak >0, and no previous best', () => {
    const result = generateStudyInsight(
      inputs({
        activeDaysThisMonth: 20,
        currentStreak: 7,
        previousBestStreak: 0,
        totalCompletedLessons: 30,
      })
    )
    expect(result).toContain('consistent')
    expect(result).toContain('20 active days')
    expect(result).toContain('new personal record')
  })

  it('returns consistent message when active >15 and streak beats record', () => {
    const result = generateStudyInsight(
      inputs({
        activeDaysThisMonth: 18,
        currentStreak: 8,
        previousBestStreak: 5,
        totalCompletedLessons: 50,
      })
    )
    expect(result).toContain('consistent')
    expect(result).toContain('18 active days')
    expect(result).toContain('best streak yet')
  })

  it('returns momentum message when weeklyChange >0 and >=10 lessons', () => {
    const result = generateStudyInsight(
      inputs({
        totalCompletedLessons: 20,
        weeklyChange: 5,
        activeDaysThisMonth: 10,
      })
    )
    expect(result).toContain('Up 5')
    expect(result).toContain('Momentum')
  })

  it('returns momentum with singular for weeklyChange of 1', () => {
    const result = generateStudyInsight(
      inputs({
        totalCompletedLessons: 10,
        weeklyChange: 1,
        activeDaysThisMonth: 10,
      })
    )
    expect(result).toContain('Up 1 lesson')
  })

  it('returns active-days message when >15 days but no streak record', () => {
    const result = generateStudyInsight(
      inputs({
        activeDaysThisMonth: 20,
        currentStreak: 3,
        previousBestStreak: 12,
        totalCompletedLessons: 30,
      })
    )
    expect(result).toContain('20 active days')
    expect(result).toContain('consistency is paying off')
  })

  it('returns steady progress as default for moderate activity', () => {
    const result = generateStudyInsight(
      inputs({
        activeDaysThisMonth: 5,
        currentStreak: 2,
        previousBestStreak: 2,
        totalCompletedLessons: 15,
      })
    )
    expect(result).toContain('Steady progress')
    expect(result).toContain('15 lessons')
  })

  it('handles negative weeklyChange gracefully (falls through to steady)', () => {
    const result = generateStudyInsight(
      inputs({
        activeDaysThisMonth: 2,
        totalCompletedLessons: 12,
        weeklyChange: -3,
      })
    )
    expect(result).toContain('Steady progress')
  })

  it('handles very large numbers', () => {
    const result = generateStudyInsight(
      inputs({
        activeDaysThisMonth: 28,
        currentStreak: 60,
        previousBestStreak: 30,
        totalCompletedLessons: 500,
        weeklyChange: 20,
      })
    )
    // consistent wins over momentum because it's checked first
    expect(result).toContain('consistent')
    expect(result).toContain('28 active days')
  })
})
