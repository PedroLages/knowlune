import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuizHeader } from '../QuizHeader'
import {
  makeQuiz,
  makeProgress,
} from '../../../../../tests/support/fixtures/factories/quiz-factory'
import type { Quiz, QuizProgress } from '@/types/quiz'

function renderQuizHeader(
  overrides: { quiz?: Partial<Quiz>; progress?: Partial<QuizProgress> } = {}
) {
  const quiz = makeQuiz(overrides.quiz)
  const progress = makeProgress(quiz.id, {
    questionOrder: quiz.questions.map(q => q.id),
    ...overrides.progress,
  })

  return render(
    <QuizHeader quiz={quiz} progress={progress} timeRemaining={null} totalTimeSeconds={null} />
  )
}

describe('QuizHeader', () => {
  it('renders quiz title', () => {
    renderQuizHeader({ quiz: { title: 'Biology 101 Quiz' } })

    expect(screen.getByText('Biology 101 Quiz')).toBeInTheDocument()
  })

  it('displays current question number and total', () => {
    renderQuizHeader()

    expect(screen.getByText('Question 1 of 1')).toBeInTheDocument()
  })

  it('has a sr-only progressbar with question-count values', () => {
    renderQuizHeader()

    const progressbar = screen.getByRole('progressbar', { name: 'Question progress' })
    expect(progressbar).toHaveAttribute('aria-valuenow', '1')
    expect(progressbar).toHaveAttribute('aria-valuemin', '1')
    expect(progressbar).toHaveAttribute('aria-valuemax', '1')
  })

  describe('ARIA live announcements (AC8)', () => {
    it('has an aria-live="polite" region for navigation announcements', () => {
      renderQuizHeader()

      const liveRegion = screen.getByTestId('nav-announcement')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })

    it('uses a <span> element for the live region (consistency)', () => {
      renderQuizHeader()

      const liveRegion = screen.getByTestId('nav-announcement')
      expect(liveRegion.tagName).toBe('SPAN')
    })

    it('announces "Question N of M" when question index changes', () => {
      const quiz = makeQuiz({
        questions: [
          {
            id: 'q1',
            order: 1,
            type: 'multiple-choice',
            text: 'Q1',
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: '',
            points: 1,
          },
          {
            id: 'q2',
            order: 2,
            type: 'multiple-choice',
            text: 'Q2',
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: '',
            points: 1,
          },
          {
            id: 'q3',
            order: 3,
            type: 'multiple-choice',
            text: 'Q3',
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: '',
            points: 1,
          },
        ],
      })
      const progress = makeProgress(quiz.id, {
        questionOrder: ['q1', 'q2', 'q3'],
        currentQuestionIndex: 0,
      })

      const { rerender } = render(
        <QuizHeader quiz={quiz} progress={progress} timeRemaining={null} totalTimeSeconds={null} />
      )

      // Initially empty (no navigation has occurred)
      const liveRegion = screen.getByTestId('nav-announcement')
      expect(liveRegion).toHaveTextContent('')

      // Navigate to question 2
      const updatedProgress = { ...progress, currentQuestionIndex: 1 }
      rerender(
        <QuizHeader
          quiz={quiz}
          progress={updatedProgress}
          timeRemaining={null}
          totalTimeSeconds={null}
        />
      )

      expect(liveRegion).toHaveTextContent('Question 2 of 3')
    })

    it('announces correctly when navigating back to a previous question', () => {
      const quiz = makeQuiz({
        questions: [
          {
            id: 'q1',
            order: 1,
            type: 'multiple-choice',
            text: 'Q1',
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: '',
            points: 1,
          },
          {
            id: 'q2',
            order: 2,
            type: 'multiple-choice',
            text: 'Q2',
            options: ['A', 'B'],
            correctAnswer: 'A',
            explanation: '',
            points: 1,
          },
        ],
      })
      const progress = makeProgress(quiz.id, {
        questionOrder: ['q1', 'q2'],
        currentQuestionIndex: 1,
      })

      const { rerender } = render(
        <QuizHeader quiz={quiz} progress={progress} timeRemaining={null} totalTimeSeconds={null} />
      )

      // Navigate back to question 1
      const updatedProgress = { ...progress, currentQuestionIndex: 0 }
      rerender(
        <QuizHeader
          quiz={quiz}
          progress={updatedProgress}
          timeRemaining={null}
          totalTimeSeconds={null}
        />
      )

      const liveRegion = screen.getByTestId('nav-announcement')
      expect(liveRegion).toHaveTextContent('Question 1 of 2')
    })
  })
})
