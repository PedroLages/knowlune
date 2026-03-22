import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { QuizReview } from '../QuizReview'
import { makeQuestion, makeAttempt, makeCorrectAnswer, makeWrongAnswer } from '../../../../tests/support/fixtures/factories/quiz-factory'

// Mock sonner
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}))

// Hoist mock objects so they are available before vi.mock is hoisted
const { mockQuizAttempts, mockQuizzes } = vi.hoisted(() => ({
  mockQuizAttempts: { get: vi.fn() },
  mockQuizzes: { get: vi.fn() },
}))

vi.mock('@/db', () => ({
  db: {
    quizAttempts: mockQuizAttempts,
    quizzes: mockQuizzes,
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const q1 = makeQuestion({ id: 'q1', order: 1, text: 'First question?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' })
const q2 = makeQuestion({ id: 'q2', order: 2, text: 'Second question?', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' })

const testQuiz: Quiz = {
  id: 'quiz-review-1',
  lessonId: 'lesson-1',
  title: 'Review Test Quiz',
  description: '',
  questions: [q1, q2],
  passingScore: 70,
  allowRetakes: true,
  shuffleQuestions: false,
  shuffleAnswers: false,
  timeLimit: null,
  createdAt: '2026-03-22T00:00:00Z',
  updatedAt: '2026-03-22T00:00:00Z',
}

const testAttempt: QuizAttempt = makeAttempt({
  id: 'attempt-review-1',
  quizId: 'quiz-review-1',
  answers: [
    makeCorrectAnswer('q1', { userAnswer: 'A', pointsPossible: 1 }),
    makeWrongAnswer('q2', { userAnswer: 'A', pointsPossible: 1 }),
  ],
  score: 1,
  percentage: 50,
  passed: false,
})

// ---------------------------------------------------------------------------
// Helper: render QuizReview at a given attempt ID
// ---------------------------------------------------------------------------

function renderReview(attemptId = 'attempt-review-1') {
  return render(
    <MemoryRouter
      initialEntries={[`/courses/course-1/lessons/lesson-1/quiz/review/${attemptId}`]}
    >
      <Routes>
        <Route
          path="/courses/:courseId/lessons/:lessonId/quiz/review/:attemptId"
          element={<QuizReview />}
        />
        {/* Fallback so navigate() tests don't crash */}
        <Route
          path="/courses/:courseId/lessons/:lessonId/quiz/results"
          element={<div>Results Page</div>}
        />
      </Routes>
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QuizReview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuizAttempts.get.mockResolvedValue(testAttempt)
    mockQuizzes.get.mockResolvedValue(testQuiz)
  })

  it('shows loading skeleton initially', () => {
    // Never resolves so we can catch the loading state
    mockQuizAttempts.get.mockReturnValue(new Promise(() => {}))
    renderReview()
    expect(screen.getByRole('status', { name: /loading quiz review/i })).toBeInTheDocument()
  })

  it('loads attempt and renders first question', async () => {
    renderReview()
    await waitFor(() =>
      expect(screen.getByText('First question?')).toBeInTheDocument()
    )
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
  })

  it('shows error state when attempt ID not found', async () => {
    mockQuizAttempts.get.mockResolvedValue(undefined)
    renderReview('invalid-id')
    await waitFor(() =>
      expect(screen.getByText(/Quiz attempt not found/i)).toBeInTheDocument()
    )
  })

  it('shows error state when db throws', async () => {
    mockQuizAttempts.get.mockRejectedValue(new Error('IDB error'))
    renderReview()
    await waitFor(() =>
      expect(screen.getByText(/Quiz attempt not found/i)).toBeInTheDocument()
    )
  })

  it('Next button advances to question 2', async () => {
    renderReview()
    await waitFor(() => expect(screen.getByText('First question?')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByText('Second question?')).toBeInTheDocument()
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
  })

  it('Previous button is disabled on first question', async () => {
    renderReview()
    await waitFor(() => expect(screen.getByText('First question?')).toBeInTheDocument())

    const prevBtn = screen.getByRole('button', { name: /previous/i })
    expect(prevBtn).toBeDisabled()
  })

  it('Previous button goes back after advancing', async () => {
    renderReview()
    await waitFor(() => expect(screen.getByText('First question?')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Second question?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /previous/i }))
    expect(screen.getByText('First question?')).toBeInTheDocument()
  })

  it('last question shows "Back to Results" button instead of Next', async () => {
    renderReview()
    await waitFor(() => expect(screen.getByText('First question?')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /next/i }))

    expect(screen.getByRole('button', { name: /back to results/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
  })

  it('ReviewQuestionGrid jump navigation works', async () => {
    renderReview()
    await waitFor(() => expect(screen.getByText('First question?')).toBeInTheDocument())

    // Click question 2 in the grid (the nav grid buttons)
    const q2Btn = screen.getAllByRole('button', { name: /Question 2/i })[0]
    await userEvent.click(q2Btn)

    expect(screen.getByText('Second question?')).toBeInTheDocument()
  })
})
