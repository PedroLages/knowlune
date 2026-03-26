import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateQuizMetrics } from '@/lib/quizMetrics'
import { makeAttempt } from '../../../tests/support/fixtures/factories/quiz-factory'
import { db } from '@/db'

vi.mock('@/db', () => ({
  db: {
    quizAttempts: {
      toArray: vi.fn(),
    },
  },
}))

const mockToArray = vi.mocked(db.quizAttempts.toArray)

describe('calculateQuizMetrics', () => {
  beforeEach(() => {
    mockToArray.mockClear()
  })

  it('returns zeros when no attempts exist', async () => {
    mockToArray.mockResolvedValue([])

    const result = await calculateQuizMetrics()

    expect(result).toEqual({ totalQuizzes: 0, averageScore: 0, completionRate: 0 })
  })

  it('counts all stored attempts as total quizzes', async () => {
    mockToArray.mockResolvedValue([
      makeAttempt({ percentage: 80 }),
      makeAttempt({ percentage: 60 }),
      makeAttempt({ percentage: 100 }),
    ])

    const result = await calculateQuizMetrics()

    expect(result.totalQuizzes).toBe(3)
  })

  it('calculates average score across all attempts', async () => {
    mockToArray.mockResolvedValue([
      makeAttempt({ percentage: 60 }),
      makeAttempt({ percentage: 80 }),
      makeAttempt({ percentage: 100 }),
    ])

    const result = await calculateQuizMetrics()

    // (60 + 80 + 100) / 3 = 80
    expect(result.averageScore).toBeCloseTo(80, 5)
  })

  it('returns 100% completion rate when attempts exist (all stored attempts are submitted)', async () => {
    mockToArray.mockResolvedValue([makeAttempt(), makeAttempt()])

    const result = await calculateQuizMetrics()

    expect(result.completionRate).toBe(100)
  })

  it('handles single attempt correctly', async () => {
    mockToArray.mockResolvedValue([makeAttempt({ percentage: 75 })])

    const result = await calculateQuizMetrics()

    expect(result.totalQuizzes).toBe(1)
    expect(result.averageScore).toBe(75)
    expect(result.completionRate).toBe(100)
  })

  it('handles mixed pass/fail attempts in average score', async () => {
    mockToArray.mockResolvedValue([
      makeAttempt({ percentage: 0, passed: false }),
      makeAttempt({ percentage: 50, passed: false }),
      makeAttempt({ percentage: 100, passed: true }),
    ])

    const result = await calculateQuizMetrics()

    // (0 + 50 + 100) / 3 ≈ 50
    expect(result.averageScore).toBeCloseTo(50, 5)
  })

  it('returns zero-state fallback when IndexedDB fails', async () => {
    mockToArray.mockRejectedValue(new Error('IndexedDB unavailable'))

    const result = await calculateQuizMetrics()

    expect(result).toEqual({ totalQuizzes: 0, averageScore: 0, completionRate: 0 })
  })

  it('treats NaN/undefined percentage as 0 in average calculation', async () => {
    mockToArray.mockResolvedValue([
      makeAttempt({ percentage: 80 }),
      makeAttempt({ percentage: NaN }),
      makeAttempt({ percentage: 100 }),
    ])

    const result = await calculateQuizMetrics()

    // (80 + 0 + 100) / 3 = 60
    expect(result.averageScore).toBeCloseTo(60, 5)
  })

  it('clamps percentage values outside [0, 100]', async () => {
    mockToArray.mockResolvedValue([
      makeAttempt({ percentage: -20 }),
      makeAttempt({ percentage: 150 }),
    ])

    const result = await calculateQuizMetrics()

    // (0 + 100) / 2 = 50
    expect(result.averageScore).toBeCloseTo(50, 5)
  })
})
