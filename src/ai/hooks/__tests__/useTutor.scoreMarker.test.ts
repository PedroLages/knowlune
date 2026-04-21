/**
 * Unit tests for SCORE and ASSESSMENT marker parsing in useTutor (E73)
 *
 * Coverage:
 * - SCORE: correct marker calls recordQuizAnswer(true)
 * - SCORE: incorrect marker calls recordQuizAnswer(false)
 * - ASSESSMENT: green marker calls recordDebugAssessment('green')
 * - ASSESSMENT: red/yellow markers call recordDebugAssessment with correct value
 * - Non-matching text does not trigger recordQuizAnswer or recordDebugAssessment
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTutor } from '@/ai/hooks/useTutor'
import { useTutorStore } from '@/stores/useTutorStore'

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@/db', () => ({
  db: {
    importedVideos: {
      get: vi.fn().mockResolvedValue(null),
    },
    importedCourses: {
      get: vi.fn().mockResolvedValue(null),
    },
    youtubeTranscripts: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
    },
    chatConversations: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
      add: vi.fn().mockResolvedValue('id'),
      update: vi.fn().mockResolvedValue(1),
    },
  },
}))

vi.mock('@/ai/tutor/transcriptContext', () => ({
  getTranscriptContext: vi.fn().mockResolvedValue({
    excerpt: '',
    strategy: 'none',
    status: { available: false, strategy: 'none', label: 'General mode' },
  }),
}))

vi.mock('@/ai/tutor/tutorPromptBuilder', () => ({
  buildTutorSystemPrompt: vi.fn().mockReturnValue('System prompt'),
}))

vi.mock('@/ai/tutor/learnerProfileBuilder', () => ({
  buildAndFormatLearnerProfile: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/ai/tutor/sessionAnalyzer', () => ({
  updateFromSession: vi.fn().mockResolvedValue(null),
  serializeLearnerModelForPrompt: vi.fn().mockReturnValue(''),
}))

vi.mock('@/ai/tutor/transcriptEmbedder', () => ({
  hasTranscriptEmbeddings: vi.fn().mockResolvedValue(false),
  lazyEmbedTranscript: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/ai/tutor/tutorRAG', () => ({
  retrieveTutorContext: vi.fn().mockResolvedValue({ chunks: [] }),
  formatRAGContext: vi.fn().mockReturnValue(''),
}))

vi.mock('@/ai/tutor/hintLadder', () => ({
  processUserMessage: vi.fn().mockReturnValue({ action: 'respond', hintLevel: 0 }),
}))

vi.mock('@/ai/tutor/learnerModelService', () => ({
  getOrCreateLearnerModel: vi.fn().mockResolvedValue(null),
  updateLearnerModel: vi.fn().mockResolvedValue(null),
  replaceLearnerModelFields: vi.fn().mockResolvedValue(null),
  clearLearnerModel: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/ai/lib/llmErrorMapper', () => ({
  mapLLMError: vi.fn(e => e),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

vi.mock('@/ai/llm/factory', () => ({
  getLLMClient: vi.fn().mockResolvedValue({
    streamCompletion: vi.fn(),
  }),
}))

// ── Helpers ────────────────────────────────────────────────────────

async function* makeStream(chunks: string[]) {
  for (const content of chunks) {
    yield { content }
  }
  yield { content: '', finishReason: 'stop' as const }
}

const DEFAULT_OPTIONS = {
  courseId: 'course-1',
  lessonId: 'lesson-1',
  courseName: 'Test Course',
  lessonTitle: 'Test Lesson',
}

let mockStreamCompletion: ReturnType<typeof vi.fn>

beforeEach(async () => {
  useTutorStore.setState({
    messages: [],
    mode: 'socratic',
    hintLevel: 0,
    isGenerating: false,
    error: null,
    transcriptStatus: null,
    quizState: {
      totalQuestions: 0,
      correctAnswers: 0,
      currentStreak: 0,
      bloomLevel: 0,
      lastAnswerCorrect: null,
    },
    debugAssessments: [],
    lastQuizResult: null,
    modeHistory: [],
    modeTransitionContext: null,
    learnerModel: null,
    conversationId: null,
    _courseId: null,
    _videoId: null,
  })

  const { getLLMClient } = await import('@/ai/llm/factory')
  const client = await (
    getLLMClient as unknown as () => Promise<{ streamCompletion: ReturnType<typeof vi.fn> }>
  )()
  mockStreamCompletion = client.streamCompletion as ReturnType<typeof vi.fn>
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────

describe('useTutor — SCORE marker parsing', () => {
  it('SCORE: correct marker calls recordQuizAnswer(true)', async () => {
    useTutorStore.setState({ mode: 'quiz' })
    mockStreamCompletion.mockReturnValue(
      makeStream(['Great answer!\nSCORE: correct\nYou understood the concept.'])
    )

    const { result } = renderHook(() => useTutor(DEFAULT_OPTIONS))
    await act(async () => {
      await result.current.sendMessage('What is photosynthesis?')
    })

    const { quizState } = useTutorStore.getState()
    expect(quizState.totalQuestions).toBe(1)
    expect(quizState.correctAnswers).toBe(1)
    expect(quizState.lastAnswerCorrect).toBe(true)
  })

  it('SCORE: incorrect marker calls recordQuizAnswer(false)', async () => {
    useTutorStore.setState({ mode: 'quiz' })
    mockStreamCompletion.mockReturnValue(
      makeStream(['Not quite.\nSCORE: incorrect\nLet me explain.'])
    )

    const { result } = renderHook(() => useTutor(DEFAULT_OPTIONS))
    await act(async () => {
      await result.current.sendMessage('What is photosynthesis?')
    })

    const { quizState } = useTutorStore.getState()
    expect(quizState.totalQuestions).toBe(1)
    expect(quizState.correctAnswers).toBe(0)
    expect(quizState.lastAnswerCorrect).toBe(false)
  })

  it('does not call recordQuizAnswer in non-quiz mode', async () => {
    useTutorStore.setState({ mode: 'explain' })
    mockStreamCompletion.mockReturnValue(makeStream(['Here is an explanation.\nSCORE: correct']))

    const { result } = renderHook(() => useTutor(DEFAULT_OPTIONS))
    await act(async () => {
      await result.current.sendMessage('Tell me about it')
    })

    const { quizState } = useTutorStore.getState()
    expect(quizState.totalQuestions).toBe(0)
  })
})

describe('useTutor — ASSESSMENT marker parsing', () => {
  it('ASSESSMENT: green marker calls recordDebugAssessment("green")', async () => {
    useTutorStore.setState({ mode: 'debug' })
    mockStreamCompletion.mockReturnValue(
      makeStream(['Your understanding looks solid.\nASSESSMENT: green'])
    )

    const { result } = renderHook(() => useTutor(DEFAULT_OPTIONS))
    await act(async () => {
      await result.current.sendMessage('How am I doing?')
    })

    const { debugAssessments } = useTutorStore.getState()
    expect(debugAssessments).toHaveLength(1)
    expect(debugAssessments[0].assessment).toBe('green')
  })

  it('ASSESSMENT: red marker records red assessment', async () => {
    useTutorStore.setState({ mode: 'debug' })
    mockStreamCompletion.mockReturnValue(
      makeStream(['There is a misconception here.\nASSESSMENT: red'])
    )

    const { result } = renderHook(() => useTutor(DEFAULT_OPTIONS))
    await act(async () => {
      await result.current.sendMessage('What do you think?')
    })

    const { debugAssessments } = useTutorStore.getState()
    expect(debugAssessments).toHaveLength(1)
    expect(debugAssessments[0].assessment).toBe('red')
  })

  it('does not record assessment in non-debug mode', async () => {
    useTutorStore.setState({ mode: 'explain' })
    mockStreamCompletion.mockReturnValue(makeStream(['Some explanation.\nASSESSMENT: green']))

    const { result } = renderHook(() => useTutor(DEFAULT_OPTIONS))
    await act(async () => {
      await result.current.sendMessage('Tell me something')
    })

    const { debugAssessments } = useTutorStore.getState()
    expect(debugAssessments).toHaveLength(0)
  })

  it('non-matching text does not trigger any marker parsing', async () => {
    useTutorStore.setState({ mode: 'quiz' })
    mockStreamCompletion.mockReturnValue(
      makeStream(['Here is a regular response with no markers.'])
    )

    const { result } = renderHook(() => useTutor(DEFAULT_OPTIONS))
    await act(async () => {
      await result.current.sendMessage('A question')
    })

    const { quizState, debugAssessments } = useTutorStore.getState()
    expect(quizState.totalQuestions).toBe(0)
    expect(debugAssessments).toHaveLength(0)
  })
})
