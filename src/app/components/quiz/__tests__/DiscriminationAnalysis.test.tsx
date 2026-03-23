/**
 * Component tests for DiscriminationAnalysis
 * Covers: empty state (<5 attempts), populated card, rpb formatting, interpretation text
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DiscriminationAnalysis } from '../DiscriminationAnalysis'
import {
  makeQuiz,
  makeQuestion,
  makeAttempt,
  makeCorrectAnswer,
  makeWrongAnswer,
} from '../../../../../tests/support/fixtures/factories/quiz-factory'

describe('DiscriminationAnalysis', () => {
  it('renders empty state when fewer than 5 attempts', () => {
    const quiz = makeQuiz({ questions: [makeQuestion({ id: 'q1', order: 1, text: 'Q1' })] })
    const attempts = [
      makeAttempt({ answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ answers: [makeWrongAnswer('q1')] }),
    ]
    render(<DiscriminationAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByTestId('discrimination-empty')).toBeInTheDocument()
    expect(screen.getByText(/Need at least 5 attempts/i)).toBeInTheDocument()
    expect(screen.queryByTestId('discrimination-analysis')).not.toBeInTheDocument()
  })

  it('renders analysis card when 5+ attempts provided', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Test question' })
    const quiz = makeQuiz({ questions: [q1] })
    // rpb ≈ 0.894 → High discriminator
    const attempts = [
      makeAttempt({ id: 'a1', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    render(<DiscriminationAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByTestId('discrimination-analysis')).toBeInTheDocument()
    expect(screen.getByText('Question Discrimination Analysis')).toBeInTheDocument()
    expect(screen.queryByTestId('discrimination-empty')).not.toBeInTheDocument()
  })

  it('renders question text in the list', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'What is photosynthesis?' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ id: 'a1', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    render(<DiscriminationAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText('What is photosynthesis?')).toBeInTheDocument()
  })

  it('displays rpb value formatted to 2 decimal places', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // rpb ≈ 0.894 → should render "0.89"
    const attempts = [
      makeAttempt({ id: 'a1', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    render(<DiscriminationAnalysis quiz={quiz} attempts={attempts} />)
    const valueEl = screen.getByTestId('discrimination-value-q1')
    expect(valueEl.textContent).toMatch(/^0\.\d{2}$/)
  })

  it('shows "High discriminator" interpretation for rpb > 0.3', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    const attempts = [
      makeAttempt({ id: 'a1', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', score: 0, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', score: 1, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', score: 1, answers: [makeCorrectAnswer('q1')] }),
    ]
    render(<DiscriminationAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/High discriminator/)).toBeInTheDocument()
  })

  it('shows "Low discriminator" interpretation for rpb < 0.2', () => {
    const q1 = makeQuestion({ id: 'q1', order: 1, text: 'Q1' })
    const quiz = makeQuiz({ questions: [q1] })
    // rpb ≈ 0.193 → Low discriminator
    const attempts = [
      makeAttempt({ id: 'a1', score: 2, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a2', score: 2, answers: [makeWrongAnswer('q1')] }),
      makeAttempt({ id: 'a3', score: 3, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a4', score: 3, answers: [makeCorrectAnswer('q1')] }),
      makeAttempt({ id: 'a5', score: 4, answers: [makeWrongAnswer('q1')] }),
    ]
    render(<DiscriminationAnalysis quiz={quiz} attempts={attempts} />)
    expect(screen.getByText(/Low discriminator/)).toBeInTheDocument()
  })
})
