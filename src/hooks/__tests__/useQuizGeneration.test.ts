import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const {
  mockToastError,
  mockGenerateQuizForLesson,
  mockGetQuizGenerationAvailability,
  mockQuizzesWhere,
  mockResolveLessonTranscript,
} = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockGenerateQuizForLesson: vi.fn(),
  mockGetQuizGenerationAvailability: vi.fn(),
  mockQuizzesWhere: vi.fn(() => ({
    equals: vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([])),
    })),
  })),
  mockResolveLessonTranscript: vi.fn(),
}))

vi.mock('sonner', () => ({ toast: { error: mockToastError } }))

vi.mock('@/ai/quizGenerationService', () => ({
  generateQuizForLesson: (...args: unknown[]) => mockGenerateQuizForLesson(...args),
}))

vi.mock('@/lib/aiConfiguration', () => ({
  getQuizGenerationAvailability: (...args: unknown[]) => mockGetQuizGenerationAvailability(...args),
}))

vi.mock('@/lib/lessonTranscript', () => ({
  resolveLessonTranscript: (...args: unknown[]) => mockResolveLessonTranscript(...args),
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
    mockGetQuizGenerationAvailability.mockResolvedValue({
      available: true,
      provider: 'anthropic',
      providerName: 'Anthropic',
      model: 'claude-haiku-4-5',
    })
    mockResolveLessonTranscript.mockResolvedValue({
      status: 'ready',
      text: 'Lesson transcript',
      cues: [],
      fingerprint: 'transcript-fingerprint',
      source: 'youtube',
      videoId: 'youtube-video-1',
    })
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

  it('sets aiAvailable=true when AI provider is available', async () => {
    mockGetQuizGenerationAvailability.mockResolvedValue({
      available: true,
      provider: 'anthropic',
      providerName: 'Anthropic',
      model: 'claude-haiku-4-5',
    })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.checkingAvailability).toBe(false)
    })
    expect(result.current.aiAvailable).toBe(true)
  })

  it('sets aiAvailable=false when AI provider is not available', async () => {
    mockGetQuizGenerationAvailability.mockResolvedValue({
      available: false,
      reason: 'missing-provider-key',
      provider: 'anthropic',
      providerName: 'Anthropic',
      model: 'claude-haiku-4-5',
    })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.checkingAvailability).toBe(false)
    })
    expect(result.current.aiAvailable).toBe(false)
  })

  it('handles availability check failure gracefully', async () => {
    mockGetQuizGenerationAvailability.mockRejectedValue(new Error('Check failed'))

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.checkingAvailability).toBe(false)
    })
    expect(result.current.aiAvailable).toBe(false)
  })

  it('loads cached quizzes on mount', async () => {
    const mockQuiz = {
      id: 'quiz-1',
      lessonId: 'lesson-1',
      createdAt: '2026-01-01T00:00:00Z',
    }

    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([mockQuiz])),
      })),
    } as never)

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => {
      expect(result.current.cachedQuiz).toEqual(mockQuiz)
    })
    expect(result.current.quiz).toEqual(mockQuiz)
    expect(result.current.allQuizzes).toEqual([mockQuiz])
  })

  it('loads the newest cached quiz first while retaining history', async () => {
    const older = {
      id: 'quiz-old',
      lessonId: 'lesson-1',
      createdAt: '2026-01-01T00:00:00Z',
    }
    const newer = {
      id: 'quiz-new',
      lessonId: 'lesson-1',
      createdAt: '2026-02-01T00:00:00Z',
    }

    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([older, newer])),
      })),
    } as never)

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => expect(result.current.cachedQuiz?.id).toBe('quiz-new'))
    expect(result.current.allQuizzes.map(quiz => quiz.id)).toEqual(['quiz-new', 'quiz-old'])
  })

  it('clears lesson-specific quiz state when navigating to another lesson', async () => {
    const oldQuiz = {
      id: 'quiz-old',
      lessonId: 'lesson-1',
      createdAt: '2026-01-01T00:00:00Z',
    }
    mockQuizzesWhere.mockImplementation(
      () =>
        ({
          equals: vi.fn((id: string) => ({
            toArray: vi.fn(() => Promise.resolve(id === 'lesson-1' ? [oldQuiz] : [])),
          })),
        }) as never
    )

    const { result, rerender } = renderHook(
      ({ lessonId }) => useQuizGeneration(lessonId, 'course-1'),
      { initialProps: { lessonId: 'lesson-1' } }
    )

    await waitFor(() => expect(result.current.quiz?.id).toBe('quiz-old'))
    rerender({ lessonId: 'lesson-2' })

    expect(result.current.quiz).toBeNull()
    await waitFor(() => expect(result.current.allQuizzes).toEqual([]))
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

    mockQuizzesWhere.mockReturnValue({
      equals: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve([mockQuiz])),
      })),
    } as any)

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => expect(result.current.transcript.status).toBe('ready'))
    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.quiz).toEqual(mockQuiz)
    expect(result.current.error).toBeNull()
  })

  it('blocks generation until the shared transcript resolver is ready', async () => {
    mockResolveLessonTranscript.mockResolvedValue({
      status: 'missing',
      reason: 'No transcript is available for this lesson.',
    })
    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => expect(result.current.transcript.status).toBe('missing'))
    await act(async () => {
      await result.current.generate()
    })

    expect(mockGenerateQuizForLesson).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith('No transcript is available for this lesson.')
  })

  it('rechecks transcript readiness after transcript generation', async () => {
    mockResolveLessonTranscript
      .mockResolvedValueOnce({ status: 'missing', reason: 'No transcript yet.' })
      .mockResolvedValueOnce({
        status: 'ready',
        text: 'New transcript',
        cues: [],
        fingerprint: 'new-fingerprint',
        source: 'whisper',
        videoId: 'lesson-1',
      })

    const { result, rerender } = renderHook(
      ({ version }) => useQuizGeneration('lesson-1', 'course-1', version),
      { initialProps: { version: 0 } }
    )
    await waitFor(() => expect(result.current.transcript.status).toBe('missing'))

    rerender({ version: 1 })
    await waitFor(() => expect(result.current.transcript.status).toBe('ready'))
  })

  it('generate() handles error from service', async () => {
    mockGenerateQuizForLesson.mockResolvedValue({
      quiz: null,
      error: 'Model not found',
    })

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => expect(result.current.transcript.status).toBe('ready'))
    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.error).toBe('Model not found')
    expect(mockToastError).toHaveBeenCalledWith('Model not found')
  })

  it('generate() handles unexpected exceptions', async () => {
    mockGenerateQuizForLesson.mockRejectedValue(new Error('Unexpected'))

    const { result } = renderHook(() => useQuizGeneration('lesson-1', 'course-1'))

    await waitFor(() => expect(result.current.transcript.status).toBe('ready'))
    await act(async () => {
      await result.current.generate()
    })

    expect(result.current.error).toBe('An unexpected error occurred during quiz generation.')
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

    await waitFor(() => expect(result.current.transcript.status).toBe('ready'))
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

    await waitFor(() => expect(result.current.transcript.status).toBe('ready'))
    await act(async () => {
      await result.current.generate()
    })

    expect(mockToastError).toHaveBeenCalledWith('Storage failed')
  })
})
