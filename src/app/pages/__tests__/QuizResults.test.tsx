import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useQuizStore } from '@/stores/useQuizStore'
import type { Quiz, QuizAttempt } from '@/types/quiz'

// Mock sonner toast
const mockToastError = vi.fn()
const mockToastInfo = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}))

// Minimal quiz fixture for store
const testQuiz: Quiz = {
  id: 'quiz-1',
  lessonId: 'lesson-1',
  title: 'Test Quiz',
  description: 'A test quiz',
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      text: 'Question 1?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 'A',
      explanation: 'A is the correct answer.',
      points: 10,
      order: 1,
    },
  ],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
  timeLimit: null,
  createdAt: '2026-03-20T00:00:00Z',
  updatedAt: '2026-03-20T00:00:00Z',
}

const testAttempt: QuizAttempt = {
  id: 'attempt-1',
  quizId: 'quiz-1',
  startedAt: '2026-03-20T10:00:00Z',
  completedAt: '2026-03-20T10:05:00Z',
  answers: [
    {
      questionId: 'q1',
      userAnswer: 'A',
      isCorrect: true,
      pointsEarned: 10,
      pointsPossible: 10,
    },
  ],
  score: 10,
  percentage: 100,
  passed: true,
  timeSpent: 300000,
  timerAccommodation: 'standard',
}

describe('QuizResults — error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Seed the store with quiz and attempt data
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [testAttempt],
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    useQuizStore.setState({
      currentQuiz: null,
      currentProgress: null,
      attempts: [],
      isLoading: false,
      error: null,
    })
  })

  it('shows error toast when loadAttempts fails', async () => {
    // Set up store with a quiz but no pre-loaded attempts
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [],
      isLoading: false,
    })

    // Make loadAttempts reject
    const originalLoadAttempts = useQuizStore.getState().loadAttempts
    const mockLoadAttempts = vi.fn().mockRejectedValue(new Error('DB read failed'))
    useQuizStore.setState({ loadAttempts: mockLoadAttempts } as unknown as Partial<
      ReturnType<typeof useQuizStore.getState>
    >)

    // Dynamic import to avoid module-level side effects
    const { QuizResults } = await import('../QuizResults')

    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    // Wait for the error toast to be called
    await vi.waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Could not load quiz results. Please try again.')
    })

    // Restore
    useQuizStore.setState({ loadAttempts: originalLoadAttempts } as unknown as Partial<
      ReturnType<typeof useQuizStore.getState>
    >)
  })
})

function makeAttemptWith(percentage: number, id: string): QuizAttempt {
  return {
    ...testAttempt,
    id,
    quizId: testQuiz.id,
    percentage,
    score: Math.round((percentage / 100) * testQuiz.questions.length),
    passed: percentage >= testQuiz.passingScore,
  }
}

describe('QuizResults — improvement summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    useQuizStore.setState({
      currentQuiz: null,
      currentProgress: null,
      attempts: [],
      isLoading: false,
      error: null,
    })
  })

  it('does not show improvement when only 1 attempt exists', async () => {
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [makeAttemptWith(80, 'a1')],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('improvement-summary')).not.toBeInTheDocument()
  })

  it('shows positive improvement delta when current > previous best', async () => {
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [makeAttemptWith(60, 'a1'), makeAttemptWith(85, 'a2')],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    const summary = screen.getByTestId('improvement-summary')
    expect(summary).toHaveTextContent('Previous best: 60%')
    expect(summary).toHaveTextContent('(+25%)')
  })

  it('shows "Same as best" when current equals previous best', async () => {
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [makeAttemptWith(80, 'a1'), makeAttemptWith(80, 'a2')],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    const summary = screen.getByTestId('improvement-summary')
    expect(summary).toHaveTextContent('Previous best: 80%')
    expect(summary).toHaveTextContent('Same as best')
  })

  it('shows previous best only (no negative delta) when current < previous best', async () => {
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [makeAttemptWith(90, 'a1'), makeAttemptWith(70, 'a2')],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    const summary = screen.getByTestId('improvement-summary')
    expect(summary).toHaveTextContent('Previous best: 90%')
    // Should NOT contain any negative delta number
    expect(summary.textContent).not.toMatch(/\(-/)
    expect(summary).not.toHaveTextContent('Same as best')
    // Should show encouraging message instead
    expect(summary).toHaveTextContent('Keep practicing!')
  })

  it('uses max of all previous attempts (not just the last one)', async () => {
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [
        makeAttemptWith(50, 'a1'),
        makeAttemptWith(90, 'a2'), // previous best
        makeAttemptWith(70, 'a3'), // most recent previous
        makeAttemptWith(95, 'a4'), // current (latest)
      ],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    const summary = screen.getByTestId('improvement-summary')
    // Should compare against best of previous (90%), not last previous (70%)
    expect(summary).toHaveTextContent('Previous best: 90%')
    expect(summary).toHaveTextContent('(+5%)')
  })
})
