import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerformanceInsights } from '../PerformanceInsights'
import {
  makeQuestion,
  makeCorrectAnswer,
  makeWrongAnswer,
} from '../../../../../tests/support/fixtures/factories/quiz-factory'

// ---------------------------------------------------------------------------
// Shorthand aliases
// ---------------------------------------------------------------------------

const q = (id: string, order: number, topic?: string) =>
  makeQuestion({ id, order, text: `Question ${order}`, ...(topic ? { topic } : {}) })
const correct = (questionId: string) => makeCorrectAnswer(questionId)
const wrong = (questionId: string) => makeWrongAnswer(questionId)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PerformanceInsights', () => {
  it('renders correctness summary bar with all three counts', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [correct('q1'), wrong('q2')]

    render(<PerformanceInsights questions={questions} answers={answers} />)

    expect(screen.getByText('1 correct')).toBeInTheDocument()
    expect(screen.getByText('1 incorrect')).toBeInTheDocument()
    expect(screen.getByText('0 skipped')).toBeInTheDocument()
  })

  it('shows skipped count when questions are skipped', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [correct('q1')] // q2 has no answer → skipped

    render(<PerformanceInsights questions={questions} answers={answers} />)

    expect(screen.getByText('1 skipped')).toBeInTheDocument()
  })

  it('shows strengths section when topics have ≥70%', () => {
    const questions = [q('q1', 1, 'Arrays'), q('q2', 2, 'Functions')]
    const answers = [correct('q1'), wrong('q2')]

    render(<PerformanceInsights questions={questions} answers={answers} />)

    expect(screen.getByText('Your Strengths')).toBeInTheDocument()
    expect(screen.getByText('Arrays')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('shows growth section with question references for <70%', () => {
    const questions = [q('q1', 1, 'Arrays'), q('q2', 2, 'Functions'), q('q3', 3, 'Functions')]
    const answers = [correct('q1'), wrong('q2'), wrong('q3')]

    render(<PerformanceInsights questions={questions} answers={answers} />)

    expect(screen.getByText('Growth Opportunities')).toBeInTheDocument()
    expect(screen.getByText('Functions')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('Review questions 2, 3')).toBeInTheDocument()
  })

  it('hides strengths/growth sections when all questions are General (no topics)', () => {
    const questions = [q('q1', 1), q('q2', 2), q('q3', 3)]
    const answers = [correct('q1'), correct('q2'), wrong('q3')]

    render(<PerformanceInsights questions={questions} answers={answers} />)

    // Correctness bar should still render
    expect(screen.getByText('2 correct')).toBeInTheDocument()

    // Topic sections should NOT render
    expect(screen.queryByText('Your Strengths')).not.toBeInTheDocument()
    expect(screen.queryByText('Growth Opportunities')).not.toBeInTheDocument()
  })

  it('uses h2 headings for section titles', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [correct('q1'), wrong('q2')]

    render(<PerformanceInsights questions={questions} answers={answers} />)

    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings).toHaveLength(2)
    expect(headings[0]).toHaveTextContent('Your Strengths')
    expect(headings[1]).toHaveTextContent('Growth Opportunities')
  })

  it('links sections to headings via aria-labelledby', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [correct('q1'), wrong('q2')]

    const { container } = render(<PerformanceInsights questions={questions} answers={answers} />)

    const sections = container.querySelectorAll('section[aria-labelledby]')
    expect(sections).toHaveLength(2)

    for (const section of sections) {
      const labelId = section.getAttribute('aria-labelledby')!
      const heading = section.querySelector(`#${CSS.escape(labelId)}`)
      expect(heading).not.toBeNull()
      expect(heading!.tagName).toBe('H2')
    }
  })

  it('uses semantic list elements for topics', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [correct('q1'), wrong('q2')]

    render(<PerformanceInsights questions={questions} answers={answers} />)

    const lists = screen.getAllByRole('list')
    expect(lists.length).toBeGreaterThanOrEqual(2) // strengths + growth
  })

  it('marks icons as aria-hidden', () => {
    const questions = [q('q1', 1, 'A'), q('q2', 2, 'B')]
    const answers = [correct('q1'), wrong('q2')]

    const { container } = render(<PerformanceInsights questions={questions} answers={answers} />)

    const svgs = container.querySelectorAll('svg[aria-hidden="true"]')
    expect(svgs.length).toBeGreaterThanOrEqual(2) // CheckCircle2 + TrendingUp
  })

  it('has data-testid for E2E targeting', () => {
    const questions = [q('q1', 1, 'A')]
    const answers = [correct('q1')]

    const { container } = render(<PerformanceInsights questions={questions} answers={answers} />)

    expect(container.querySelector('[data-testid="performance-insights"]')).toBeInTheDocument()
  })
})
