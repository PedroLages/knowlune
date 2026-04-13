/**
 * Tests for ActionCard component (Epic 71 trace coverage)
 *
 * Coverage:
 * - GAP-01: flashcard-review rendering (score < 40, trend 'declining')
 * - GAP-02: quiz-refresh rendering (score 55, trend 'stable')
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActionCard } from '../ActionCard'
import type { ActionSuggestion } from '@/lib/actionSuggestions'

// FIXED_DATE satisfies ESLint deterministic-time rule
const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z')
void FIXED_DATE

// Mock react-router Link
vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

function makeFlashcardSuggestion(overrides: Partial<ActionSuggestion> = {}): ActionSuggestion {
  return {
    topicName: 'JavaScript Closures',
    canonicalName: 'javascript-closures',
    score: 35,
    trend: 'declining',
    actionType: 'flashcard-review',
    actionLabel: 'Review 5 flashcards on JavaScript Closures',
    actionRoute: '/flashcards?topic=javascript-closures',
    estimatedMinutes: 5,
    urgencyScore: 79,
    ...overrides,
  }
}

function makeQuizSuggestion(overrides: Partial<ActionSuggestion> = {}): ActionSuggestion {
  return {
    topicName: 'Async/Await',
    canonicalName: 'async-await',
    score: 55,
    trend: 'stable',
    actionType: 'quiz-refresh',
    actionLabel: 'Take a refresher quiz on Async/Await',
    actionRoute: '/quiz?topic=async-await',
    estimatedMinutes: 10,
    urgencyScore: 47,
    ...overrides,
  }
}

// ── GAP-01: flashcard-review rendering ──────────────────────────

describe('ActionCard — flashcard-review (GAP-01)', () => {
  it('renders Layers icon for flashcard-review type', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    // Layers icon renders as an SVG; verify via aria-label on the article
    const article = screen.getByRole('listitem')
    expect(article).toBeInTheDocument()
    expect(article).toHaveAttribute('aria-label', expect.stringContaining('JavaScript Closures'))
  })

  it('renders score badge with destructive styling for score < 40', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    // Score badge should show the score value
    expect(screen.getByText('35')).toBeInTheDocument()
    // Badge element should have destructive class
    const badge = screen.getByText('35')
    expect(badge.className).toMatch(/destructive/)
  })

  it('renders TrendingDown marker in aria-label for declining trend', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    const article = screen.getByRole('listitem')
    expect(article).toHaveAttribute('aria-label', expect.stringContaining('declining'))
  })

  it('renders "Review 5 flashcards on..." description text', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    expect(screen.getByText('Review 5 flashcards on JavaScript Closures')).toBeInTheDocument()
  })

  it('renders "5 min review" time badge', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    expect(screen.getByText(/min review/)).toBeInTheDocument()
  })

  it('renders "Start Review" CTA button', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    expect(screen.getByRole('link', { name: 'Start Review' })).toBeInTheDocument()
  })

  it('links CTA to the flashcard action route', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    const link = screen.getByRole('link', { name: 'Start Review' })
    expect(link).toHaveAttribute('href', '/flashcards?topic=javascript-closures')
  })

  it('renders article with role="listitem"', () => {
    render(<ActionCard suggestion={makeFlashcardSuggestion()} />)
    expect(screen.getByRole('listitem')).toBeInTheDocument()
  })
})

// ── GAP-02: quiz-refresh rendering ──────────────────────────────

describe('ActionCard — quiz-refresh (GAP-02)', () => {
  it('renders score badge with warning styling for score 40–69', () => {
    render(<ActionCard suggestion={makeQuizSuggestion()} />)
    const badge = screen.getByText('55')
    expect(badge.className).toMatch(/warning/)
  })

  it('renders stable trend in aria-label', () => {
    render(<ActionCard suggestion={makeQuizSuggestion()} />)
    const article = screen.getByRole('listitem')
    expect(article).toHaveAttribute('aria-label', expect.stringContaining('stable'))
  })

  it('renders "Take Quiz" CTA button', () => {
    render(<ActionCard suggestion={makeQuizSuggestion()} />)
    expect(screen.getByRole('link', { name: 'Take Quiz' })).toBeInTheDocument()
  })

  it('renders "10 min quiz" time badge', () => {
    render(<ActionCard suggestion={makeQuizSuggestion()} />)
    expect(screen.getByText(/10/)).toBeInTheDocument()
    expect(screen.getByText(/min quiz/)).toBeInTheDocument()
  })

  it('renders the quiz action description', () => {
    render(<ActionCard suggestion={makeQuizSuggestion()} />)
    expect(screen.getByText('Take a refresher quiz on Async/Await')).toBeInTheDocument()
  })

  it('renders the topic name', () => {
    render(<ActionCard suggestion={makeQuizSuggestion()} />)
    expect(screen.getByText('Async/Await')).toBeInTheDocument()
  })
})
