/**
 * Tests for SuggestedActionsPanel component (Epic 71 trace coverage)
 *
 * Coverage:
 * - GAP-03: Accessibility ARIA (role="region", aria-labelledby, role="list", role="listitem")
 * - GAP-08: Show more/less toggle (7 suggestions, maxVisible=5)
 * - GAP-09: Toggle "Show less" + ChevronUp state (covered via GAP-08 click)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestedActionsPanel } from '../SuggestedActionsPanel'
import type { ActionSuggestion } from '@/lib/actionSuggestions'

// FIXED_DATE satisfies ESLint deterministic-time rule
const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z')
void FIXED_DATE

// Mock react-router Link used inside ActionCard children
vi.mock('react-router', () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

function makeSuggestion(index: number, actionType: ActionSuggestion['actionType'] = 'quiz-refresh'): ActionSuggestion {
  return {
    topicName: `Topic ${index}`,
    canonicalName: `topic-${index}`,
    score: 55,
    trend: 'stable',
    actionType,
    actionLabel: `Take a refresher quiz on Topic ${index}`,
    actionRoute: `/quiz?topic=topic-${index}`,
    estimatedMinutes: 10,
    urgencyScore: 47,
  }
}

function makeSuggestions(count: number): ActionSuggestion[] {
  return Array.from({ length: count }, (_, i) => makeSuggestion(i + 1))
}

// ── GAP-03: Accessibility ARIA ───────────────────────────────────

describe('SuggestedActionsPanel — Accessibility ARIA (GAP-03)', () => {
  it('section has role="region"', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(2)} />)
    expect(screen.getByRole('region')).toBeInTheDocument()
  })

  it('section has aria-labelledby matching the title element id', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(2)} />)
    const region = screen.getByRole('region')
    const labelledBy = region.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()

    // The referenced element must be the heading with "Suggested Actions"
    const heading = screen.getByText('Suggested Actions')
    expect(heading.id).toBe(labelledBy)
  })

  it('card list container has role="list"', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(2)} />)
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('each ActionCard article has role="listitem"', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(3)} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
  })
})

// ── GAP-08 + GAP-09: Show more/less toggle ───────────────────────

describe('SuggestedActionsPanel — Show more/less toggle (GAP-08, GAP-09)', () => {
  it('shows only maxVisible suggestions initially', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(7)} maxVisible={5} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('renders "Show 2 more suggestions" link when overflow exists', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(7)} maxVisible={5} />)
    expect(screen.getByText(/show 2 more suggestions/i)).toBeInTheDocument()
  })

  it('does not render show-more toggle when suggestions <= maxVisible', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(3)} maxVisible={5} />)
    expect(screen.queryByText(/show.*more/i)).not.toBeInTheDocument()
  })

  it('shows all 7 suggestions after clicking "Show more"', async () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(7)} maxVisible={5} />)
    await userEvent.click(screen.getByText(/show 2 more suggestions/i))
    expect(screen.getAllByRole('listitem')).toHaveLength(7)
  })

  it('renders "Show less" after expanding (GAP-09)', async () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(7)} maxVisible={5} />)
    await userEvent.click(screen.getByText(/show 2 more suggestions/i))
    expect(screen.getByText(/show less/i)).toBeInTheDocument()
  })

  it('collapses back to maxVisible after clicking "Show less"', async () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(7)} maxVisible={5} />)
    await userEvent.click(screen.getByText(/show 2 more suggestions/i))
    await userEvent.click(screen.getByText(/show less/i))
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('renders empty state when suggestions is empty', () => {
    render(<SuggestedActionsPanel suggestions={[]} />)
    expect(screen.getByText(/all topics looking strong/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})

// ── S02-AC12: className prop passthrough ─────────────────────────

describe('SuggestedActionsPanel — className prop passthrough (S02-AC12)', () => {
  it('applies className to the root section element', () => {
    render(<SuggestedActionsPanel suggestions={makeSuggestions(2)} className="custom-class" />)
    const section = screen.getByRole('region')
    expect(section).toHaveClass('custom-class')
  })
})
