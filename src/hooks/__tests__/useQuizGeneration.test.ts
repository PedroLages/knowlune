import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const {
  mockToastError,
  mockGenerateQuizForLesson,
  mockIsAIAvailable,
  mockGetAIConfiguration,
  mockGetOllamaSelectedModel,
  mockTestOllamaConnection,
  mockQuizzesWhere,
} = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockGenerateQuizForLesson: vi.fn(),
  mockIsAIAvailable: vi.fn(() => false),
  mockGetAIConfiguration: vi.fn(() => ({
    provider: 'ollama',
    ollamaSettings: { serverUrl: 'http://localhost:11434', directConnection: false },
  })),
  mockGetOllamaSelectedModel: vi.fn(() => 'llama3'),
  mockTestOllamaConnection: vi.fn(),
  mockQuizzesWhere: vi.fn(() => ({
    equals: vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
    })),
  })),
}))

vi.mock('sonner', () => ({ toast: { error: mockToastError } }))

vi.mock('@/ai/quizGenerationService', () => ({
  generateQuizForLesson: (...args: unknown[]) => mockGenerateQuizForLesson(...args),
}))

vi.mock('@/lib/aiConfiguration', () => ({
  isAIAvailable: () => mockIsAIAvailable(),
  getAIConfiguration: () => mockGetAIConfiguration(),
  getOllamaSelectedModel: () => mockGetOllamaSelectedModel(),
}))

vi.mock('@/lib/ollamaHealthCheck', () => ({
  testOllamaConnection: (...args: unknown[]) => mockTestOllamaConnection(...args),
}))

vi.mock('@/db', () => ({
  db: {
    quizzes: {
      where: (...args: unknown[]) => mockQuizzesWhere(...(args as [])),
    },
  },
}))

import { useQuizGeneration } from '../useQuizGeneration'

describe('useQuizGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAIAvailable.mockReturnValue(false)
    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts with default state', () => {
    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))
    expect(result.current.quiz).toBeNull()
    expect(result.current.isGenerating).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.cachedQuiz).toBeNull()
    expect(result.current.allQuizzes).toEqual([])
  })

  it('sets ollamaAvailable=false when AI is not available', async () => {
    mockIsAIAvailable.mockReturnValue(false)
    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.checkingAvailability).toBe(false)
    })
    expect(result.current.ollamaAvailable).toBe(false)
  })

  it('sets ollamaAvailable=false when provider is not ollama', async () => {
    mockIsAIAvailable.mockReturnValue(true)
    mockGetAIConfiguration.mockReturnValue({
      provider: 'openai' as const,
      ollamaSettings: undefined as unknown as { serverUrl: string; directConnection: boolean },
    })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.checkingAvailability).toBe(false)
    })
    expect(result.current.ollamaAvailable).toBe(false)
  })

  it('checks ollama connection when configured', async () => {
    mockIsAIAvailable.mockReturnValue(true)
    mockGetAIConfiguration.mockReturnValue({
      provider: 'ollama',
      ollamaSettings: { serverUrl: 'http://localhost:11434', directConnection: false },
    })
    mockTestOllamaConnection.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.checkingAvailability).toBe(false)
    })
    expect(result.current.ollamaAvailable).toBe(true)
  })

  it('handles ollama connection failure gracefully', async () => {
    mockIsAIAvailable.mockReturnValue(true)
    mockGetAIConfiguration.mockReturnValue({
      provider: 'ollama',
      ollamaSettings: { serverUrl: 'http://localhost:11434', directConnection: false },
    })
    mockTestOllamaConnection.mockRejectedValue(new Error('Connection refused'))

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.checkingAvailability).toBe(false)
    })
    expect(result.current.ollamaAvailable).toBe(false)
  })

  it('loads cached quizzes on mount', async () => {
    const mockQuiz = {
      id: 'quiz-1',
      lessonId: 'lesson-1',
      createdAt: '2026-01-01T00:00:00Z',
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([mockQuiz])),
      })),
    } as any)

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.cachedQuiz).toEqual(mockQuiz)
    })
    expect(result.current.quiz).toEqual(mockQuiz)
    expect(result.current.allQuizzes).toEqual([mockQuiz])
  })

  it('clears cache when lessonId is undefined', () => {
    const { result } = renderHook(() => useQuizGeneration(undefined, 'course-1'))
    expect(result.current.cachedQuiz).toBeNull()
    expect(result.current.allQuizzes).toEqual([])
  })

  it('generate() shows error toast when lessonId is missing', async () => {
    const { result } = renderHook(() => useQuizGeneration(undefined, 'course-1'))

    await act(async () => {
      await result.current.generate()
    })

    expect(mockToastError).toHaveBeenCalledWith(
      'Cannot generate quiz: missing lesson or course context.'
    )
  })

  it('generate() shows error toast when courseId is missing', async () => {
    const { result } = renderHook(() => useQuizGeneration('lesson-1', undefined))

    await act(async () => {
      await result.current.generate()
    })

    expect(mockToastError).toHaveBeenCalledWith(
      'Cannot generate quiz: missing lesson or course context.'
    )
  })

  it('generate() sets quiz on success', async () => {
    const mockQuiz = { id: 'q1', lessonId: 'lesson-1', createdAt: '2026-01-01' }
    mockGenerateQuizForLesson.mockResolvedValue({
      quiz: mockQuiz,
      cached: false,
      error: null,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([mockQuiz])),
      })),
    } as any)

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.quiz).toEqual(mockQuiz)
    expect(result.current.error).toBeNull()
  })

  it('generate() handles error from service', async () => {
    mockGenerateQuizForLesson.mockResolvedValue({
      quiz: null,
      error: 'Model not found',
    })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.error).toBe('Model not found')
    expect(mockToastError).toHaveBeenCalledWith('Model not found')
  })

  it('generate() handles unexpected exceptions', async () => {
    mockGenerateQuizForLesson.mockRejectedValue(new Error('Unexpected'))

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.error).toBe(
      'An unexpected error occurred during quiz generation.'
    )
    expect(mockToastError).toHaveBeenCalled()
  })

  it('regenerate() calls generateInternal with regenerate=true', async () => {
    mockGenerateQuizForLesson.mockResolvedValue({
      quiz: { id: 'q2' },
      cached: false,
      error: null,
    })

    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await act(async () => {
      await result.current.regenerate()
    })

    expect(mockGenerateQuizForLesson).toHaveBeenCalledWith(
      'lesson-1',
      'course-1',
      expect.objectContaining({ regenerate: true })
    )
  })

  it('shows toast when quiz generated with warnings', async () => {
    mockGenerateQuizForLesson.mockResolvedValue({
      quiz: { id: 'q1' },
      cached: false,
      error: 'Storage failed',
    })

    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([])),
      })),
    })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await act(async () => {
      await result.current.generate()
    })

    expect(mockToastError).toHaveBeenCalledWith('Storage failed')
  })
})
