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

/**
 * Creates a QuizAttempt with a distinct completedAt timestamp derived from the id.
 * IDs like 'a1', 'a2', 'a3' produce chronologically ordered timestamps so
 * calculateImprovement's date-based sorting works correctly.
 */
function makeAttemptWith(percentage: number, id: string): QuizAttempt {
  // Extract numeric suffix from id (e.g., 'a1' → 1, 'a2' → 2)
  const num = parseInt(id.replace(/\D/g, ''), 10) || 1
  const minutes = String(num).padStart(2, '0')
  return {
    ...testAttempt,
    id,
    quizId: testQuiz.id,
    percentage,
    score: Math.round((percentage / 100) * testQuiz.questions.length),
    passed: percentage >= testQuiz.passingScore,
    completedAt: `2026-03-20T10:${minutes}:00Z`,
  }
}

// Timed quiz fixture for time-display wiring tests
const timedTestQuiz: Quiz = {
  ...testQuiz,
  id: 'quiz-timed',
  timeLimit: 10,
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

  it('renders the AttemptHistory trigger when attempts exist', async () => {
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [makeAttemptWith(80, 'a1'), makeAttemptWith(90, 'a2')],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /view attempt history/i })).toBeInTheDocument()
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

    const summary = screen.getByTestId('improvement-summary')
    expect(summary).toHaveTextContent('First attempt complete! Retake to track improvement.')
  })

  it('shows positive improvement delta when current > previous best', async () => {
    // Most-recent-first: a2 (85%) is current, a1 (60%) is previous
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [makeAttemptWith(85, 'a2'), makeAttemptWith(60, 'a1')],
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
    expect(summary).toHaveTextContent('First attempt:')
    expect(summary).toHaveTextContent('60%')
    expect(summary).toHaveTextContent('Current attempt:')
    expect(summary).toHaveTextContent('85%')
    expect(summary).toHaveTextContent('+25%')
    expect(summary).toHaveTextContent('New personal best!')
  })

  it('shows regression panel (no trophy) when current score equals previous best', async () => {
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
    expect(summary).toHaveTextContent('First attempt:')
    expect(summary).toHaveTextContent('80%')
    expect(summary).toHaveTextContent('+0%')
    expect(summary).not.toHaveTextContent('New personal best!')
    expect(summary).toHaveTextContent('Keep practicing to beat your best!')
  })

  it('shows previous best only (no negative delta) when current < previous best', async () => {
    // Most-recent-first: a2 (70%) is current, a1 (90%) is previous best
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [makeAttemptWith(70, 'a2'), makeAttemptWith(90, 'a1')],
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
    expect(summary).toHaveTextContent('First attempt:')
    expect(summary).toHaveTextContent('90%')
    expect(summary).toHaveTextContent('Current attempt:')
    expect(summary).toHaveTextContent('70%')
    // Should NOT show trophy or new-best message
    expect(summary).not.toHaveTextContent('New personal best!')
    // Should show neutral encouragement
    expect(summary).toHaveTextContent('Keep practicing to beat your best!')
  })

  it('uses max of all previous attempts (not just the last one)', async () => {
    // Most-recent-first: a4 (95%) is current; a3, a2, a1 are previous
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [
        makeAttemptWith(95, 'a4'), // current (most recent)
        makeAttemptWith(70, 'a3'), // previous
        makeAttemptWith(90, 'a2'), // previous best
        makeAttemptWith(50, 'a1'), // oldest
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
    // Current (95%) beats max previous (90%), so isNewBest = true
    expect(summary).toHaveTextContent('New personal best!')
    // Shows first attempt (50%) vs current (95%), improvement = +45%
    expect(summary).toHaveTextContent('First attempt:')
    expect(summary).toHaveTextContent('50%')
    expect(summary).toHaveTextContent('Current attempt:')
    expect(summary).toHaveTextContent('95%')
    expect(summary).toHaveTextContent('+45%')
  })
})

describe('QuizResults — time display wiring (E15-S06)', () => {
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

  it('hides time display when quiz has no timeLimit (AC4 wiring through QuizResults)', async () => {
    // testQuiz has timeLimit: null → showTimeSpent should be false in QuizResults
    useQuizStore.setState({
      currentQuiz: testQuiz,
      attempts: [testAttempt],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    expect(screen.queryByText(/Completed in/)).not.toBeInTheDocument()
  })

  it('shows time display when quiz has a timeLimit and attempt has standard accommodation', async () => {
    // timedTestQuiz has timeLimit: 10 → showTimeSpent should be true
    useQuizStore.setState({
      currentQuiz: timedTestQuiz,
      attempts: [{ ...testAttempt, timeSpent: 300000, timerAccommodation: 'standard' }],
      isLoading: false,
      error: null,
    })

    const { QuizResults } = await import('../QuizResults')
    render(
      <MemoryRouter initialEntries={['/courses/c1/lessons/l1/quiz/results']}>
        <QuizResults />
      </MemoryRouter>
    )

    expect(screen.getByText(/Completed in 5m/)).toBeInTheDocument()
  })

  it('hides previous attempt time when prior timeSpent is NaN (guard: Number.isFinite)', async () => {
    useQuizStore.setState({
      currentQuiz: timedTestQuiz,
      // Most-recent-first: a2 is current (index 0), a1 is previous (index 1)
      attempts: [
        {
          ...testAttempt,
          id: 'a2',
          completedAt: '2026-03-20T10:02:00Z',
          timeSpent: 300000,
          timerAccommodation: 'standard',
        },
        {
          ...testAttempt,
          id: 'a1',
          completedAt: '2026-03-20T10:01:00Z',
          timeSpent: NaN,
          timerAccommodation: 'standard',
        },
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

    expect(screen.queryByText(/Previous:/)).not.toBeInTheDocument()
  })

  it('shows previous attempt time when prior timeSpent is valid (AC5 wiring through QuizResults)', async () => {
    useQuizStore.setState({
      currentQuiz: timedTestQuiz,
      // Most-recent-first: a2 (5m) is current (index 0), a1 (10m15s) is previous (index 1)
      attempts: [
        {
          ...testAttempt,
          id: 'a2',
          completedAt: '2026-03-20T10:02:00Z',
          timeSpent: 300000,
          timerAccommodation: 'standard',
        }, // 5m — current
        {
          ...testAttempt,
          id: 'a1',
          completedAt: '2026-03-20T10:01:00Z',
          timeSpent: 615000,
          timerAccommodation: 'standard',
        }, // 10m 15s — previous
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

    expect(screen.getByText(/Completed in 5m/)).toBeInTheDocument()
    expect(screen.getByText(/Previous: 10m 15s/)).toBeInTheDocument()
  })
})
