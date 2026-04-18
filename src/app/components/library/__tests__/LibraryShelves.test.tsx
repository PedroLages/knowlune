/**
 * Unit tests for LibraryShelves (E116-S03)
 *
 * Locks in the shelf-integration contract:
 * - AC-1: Two shelves rendered from existing primitives (no ad-hoc markup).
 * - AC-2: Top-level shelf headings are `h2`.
 * - AC-3: Each shelf heading includes a `ShelfSeeAllLink` in `actionSlot`.
 * - AC-4: Each shelf row contains ≥1 card derived from mock data.
 * - AC-7: Each shelf is wrapped in `<section aria-labelledby>` linked to
 *   the heading's `id`.
 * - AC-8: Mounting emits no React key warnings.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LibraryShelves } from '@/app/components/library/LibraryShelves'

describe('LibraryShelves (E116-S03)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders both demonstration shelves with h2 headings', () => {
    render(<LibraryShelves />)

    const h2s = screen.getAllByRole('heading', { level: 2 })
    const labels = h2s.map(h => h.textContent?.trim())
    expect(labels).toEqual(expect.arrayContaining(['Recently Added', 'Continue Reading']))
  })

  it('wraps each shelf in a <section aria-labelledby> linked to its heading id', () => {
    const { container } = render(<LibraryShelves />)

    const labelledSections = container.querySelectorAll('section[aria-labelledby]')
    expect(labelledSections.length).toBeGreaterThanOrEqual(2)

    labelledSections.forEach(section => {
      const id = section.getAttribute('aria-labelledby')!
      const heading = container.querySelector(`#${id}`)
      expect(heading).not.toBeNull()
      expect(heading?.tagName.toLowerCase()).toBe('h2')
    })
  })

  it('renders a ShelfSeeAllLink within each shelf action slot', () => {
    render(<LibraryShelves />)

    // ShelfSeeAllLink renders as <button> when no href is provided (in-page action variant).
    // It renders as <a> (role="link") only when an href prop is supplied.
    const seeAllButtons = screen.getAllByRole('button', { name: /See all/i })
    expect(seeAllButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('renders at least one card per shelf row', () => {
    render(<LibraryShelves />)

    const recentScroller = screen.getByTestId('shelf-recently-added-scroller')
    const continueScroller = screen.getByTestId('shelf-continue-reading-scroller')

    expect(within(recentScroller).getAllByTestId(/^shelf-mock-tile-/).length).toBeGreaterThanOrEqual(1)
    expect(within(continueScroller).getAllByTestId(/^shelf-mock-tile-/).length).toBeGreaterThanOrEqual(1)
  })

  it('does not emit React key warnings on mount', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<LibraryShelves />)

    const keyWarnings = errorSpy.mock.calls.filter(call =>
      call.some(arg => typeof arg === 'string' && /unique "key" prop|each child in a list/i.test(arg))
    )
    expect(keyWarnings).toEqual([])
  })
})
