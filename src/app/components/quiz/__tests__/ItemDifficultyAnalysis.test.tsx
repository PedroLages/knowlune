/**
 * Component tests for ItemDifficultyAnalysis
 * Covers: empty state, sorted list, badge labels, suggestion text
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ItemDifficultyAnalysis } from '../ItemDifficultyAnalysis'
import {
  makeQuiz,
  makeQuestion,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
} from '../../../../../tests/support/fixtures/factories/quiz-factory'

describe('ItemDifficultyAnalysis', () => {
  it('renders empty state when no attempts provided', () => {
    const quiz = makeQuiz({ questions: [makeQuestion({ id: 'q1', order: 1, text: 'Q1' })] })
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={[]} />)
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument()
  })

  it('renders section heading when items exist', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Easy question' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText('Question Difficulty Analysis')).toBeInTheDocument()
  })

  it('renders question text in the list', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'What is gravity?' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText('What is gravity?')).toBeInTheDocument()
  })

  it('shows "Easy" badge for high P-value (P=1.0)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  it('shows "Difficult" badge for low P-value (P=0.0)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeWrongAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    // Badge text is "Difficult (0%)" — use exact badge text to avoid matching heading
    expect(screen.getByText(/Difficult \(0%\)/)).toBeInTheDocument()
  })

  it('shows "Medium" badge for mid P-value (P=0.5)', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })

  it('shows suggestion text for Difficult questions', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Hard question', topic: 'Algebra' })
    const quiz = makeQuiz({ questions: [q1] })
    // 0/1 = P=0.0 → Difficult
    const attempts = [makeAttempt({ answers: [makeWrongAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    // Should show suggestion referencing the question order
    expect(screen.getByText(/review question/i)).toBeInTheDocument()
  })

  it('does not show suggestion text when no Difficult questions', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Easy Q' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [makeAttempt({ answers: [makeCorrectAnswer('q1')] })]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.queryByText(/review question/i)).not.toBeInTheDocument()
  })

  it('displays P-value as percentage in badge', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // 3/4 = 75%
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    render(<ItemDifficultyAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })
})
