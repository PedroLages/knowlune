import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const { mockQuizzesWhere } = vi.hoisted(() => ({
  mockQuizzesWhere: vi.fn(),
}))

vi.mock('@/db', () => ({
  db: {
    quizzes: {
      where: (...args: unknown[]) => mockQuizzesWhere(...args),
    },
  },
}))

import { useHasQuiz } from '../useHasQuiz'

describe('useHasQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns hasQuiz=false and loading=false when lessonId is undefined', () => {
    const { result } = renderHook(() => useHasQuiz(undefined))
    expect(result.current.hasQuiz).toBe(false)
    expect(result.current.loading).toBe(false)
  })

  it('returns hasQuiz=true when quiz exists', async () => {
    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        count: vi.fn(() => Promise.resolve(1)),
      })),
    })

    const { result } = renderHook(() => useHasQuiz('lesson-1'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.hasQuiz).toBe(true)
  })

  it('returns hasQuiz=false when no quiz exists', async () => {
    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        count: vi.fn(() => Promise.resolve(0)),
      })),
    })

    const { result } = renderHook(() => useHasQuiz('lesson-2'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.hasQuiz).toBe(false)
  })

  it('handles db errors gracefully', async () => {
    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        count: vi.fn(() => Promise.reject(new Error('DB error'))),
      })),
    })

    const { result } = renderHook(() => useHasQuiz('lesson-3'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.hasQuiz).toBe(false)
  })
})
