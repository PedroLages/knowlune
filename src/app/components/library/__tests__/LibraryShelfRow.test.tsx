/**
 * Unit tests for LibraryShelfRow primitive — E116-S01
 *
 * Locks in the behavioral contract for the foundational shelf primitive:
 * - AC-1: Heading element structure (h3 + icon + label + count + optional subtitle)
 * - AC-2: Empty children returns null
 * - AC-3: Optional action slot renders on the right
 * - AC-4: Horizontal snap scroller (snap-x, snap-mandatory, overflow-x-auto)
 * - AC-5: Visual parity with SmartGroupedView's SectionHeading (structural)
 * - AC-6: data-testid scoping for section and sub-elements
 *
 * Covers Units 1–3 from
 * docs/plans/2026-04-18-001-feat-library-shelf-row-primitive-tests-plan.md
 */
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LibraryShelfRow, type LibraryShelfRowProps } from '../LibraryShelfRow'

/**
 * Minimal stub icon so tests don't depend on lucide-react internals.
 * Mirrors the `{ className?: string }` signature the component expects.
 */
const StubIcon = ({ className }: { className?: string }) => (
  <svg data-testid="stub-icon" className={className} aria-hidden="true" />
)

/**
 * Convenience factory — keeps test rendering terse without leaking defaults
 * that hide real behavior (like a stub child that masks the empty-case).
 */
function renderShelf(overrides: Partial<LibraryShelfRowProps> = {}) {
  const props: LibraryShelfRowProps = {
    icon: StubIcon,
    label: 'Continue Listening',
    children: <div data-testid="stub-child-default">A</div>,
    ...overrides,
  }
  return render(<LibraryShelfRow {...props} />)
}

describe('LibraryShelfRow', () => {
  describe('empty-children behavior (AC-2)', () => {
    it('renders nothing when children is undefined', () => {
      const { container } = renderShelf({ children: undefined })
      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when children is null', () => {
      const { container } = renderShelf({ children: null })
      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when children is false', () => {
      const { container } = renderShelf({ children: false })
      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when children is an empty array', () => {
      const { container } = renderShelf({ children: [] })
      expect(container.firstChild).toBeNull()
    })

    it('renders nothing when children is an array of only falsy nodes', () => {
      const { container } = renderShelf({ children: [null, false, undefined] })
      expect(container.firstChild).toBeNull()
    })

    it('renders the section when at least one truthy child is present alongside falsy nodes', () => {
      renderShelf({
        children: [
          null,
          <div key="a" data-testid="truthy-child">
            Truthy
          </div>,
          false,
        ],
      })
      expect(screen.getByTestId('library-shelf-row')).toBeInTheDocument()
      // Only the truthy node gets wrapped in a snap-start wrapper
      const scroller = screen.getByTestId('library-shelf-row-scroller')
      const wrappers = scroller.querySelectorAll(':scope > div')
      expect(wrappers).toHaveLength(1)
      expect(wrappers[0]?.className).toContain('snap-start')
    })
  })

  describe('heading rendering (AC-1, AC-5)', () => {
    it('renders a <section> containing an <h3> with the label text', () => {
      renderShelf({ label: 'Continue Listening' })
      const section = screen.getByTestId('library-shelf-row')
      expect(section.tagName).toBe('SECTION')
      const heading = screen.getByTestId('library-shelf-row-heading')
      expect(heading.tagName).toBe('H3')
      expect(heading).toHaveTextContent('Continue Listening')
    })

    it('renders the icon inside the <h3> with size-5 class', () => {
      renderShelf()
      const heading = screen.getByTestId('library-shelf-row-heading')
      const icon = screen.getByTestId('stub-icon')
      expect(heading.contains(icon)).toBe(true)
      expect(icon.getAttribute('class')).toContain('size-5')
    })

    it('renders count in parentheses with muted-foreground styling when count is a positive number', () => {
      renderShelf({ count: 5 })
      const heading = screen.getByTestId('library-shelf-row-heading')
      expect(heading).toHaveTextContent('(5)')
      const countSpan = heading.querySelector('span.text-muted-foreground')
      expect(countSpan).not.toBeNull()
      expect(countSpan?.textContent).toBe('(5)')
    })

    it('omits the count span when count is undefined', () => {
      renderShelf({ count: undefined })
      const heading = screen.getByTestId('library-shelf-row-heading')
      // Parenthesis character is the signal — only appears when count is rendered
      expect(heading.textContent).not.toContain('(')
    })

    it('renders (0) when count is zero (guards against truthy-check bug)', () => {
      renderShelf({ count: 0 })
      const heading = screen.getByTestId('library-shelf-row-heading')
      expect(heading).toHaveTextContent('(0)')
    })

    it('renders the subtitle <p> with muted-foreground styling when subtitle is provided', () => {
      renderShelf({ subtitle: 'Most recently opened' })
      const subtitle = screen.getByTestId('library-shelf-row-subtitle')
      expect(subtitle.tagName).toBe('P')
      expect(subtitle).toHaveTextContent('Most recently opened')
      expect(subtitle.className).toContain('text-muted-foreground')
    })

    it('omits the subtitle <p> when subtitle is undefined', () => {
      renderShelf({ subtitle: undefined })
      expect(screen.queryByTestId('library-shelf-row-subtitle')).toBeNull()
    })

    it('uses the SectionHeading-parity class string on the <h3>', () => {
      renderShelf()
      const heading = screen.getByTestId('library-shelf-row-heading')
      // Structural parity with SmartGroupedView's SectionHeading
      expect(heading.className).toContain('flex')
      expect(heading.className).toContain('items-center')
      expect(heading.className).toContain('gap-2')
      expect(heading.className).toContain('text-lg')
      expect(heading.className).toContain('font-semibold')
      expect(heading.className).toContain('text-foreground')
    })
  })

  describe('action slot (AC-3)', () => {
    it('renders the action slot content when provided', () => {
      renderShelf({
        actionSlot: <button type="button">Shuffle</button>,
      })
      expect(screen.getByRole('button', { name: 'Shuffle' })).toBeVisible()
    })

    it('wraps the action slot in a shrink-0 container', () => {
      renderShelf({
        actionSlot: <button type="button">Shuffle</button>,
      })
      const actions = screen.getByTestId('library-shelf-row-actions')
      expect(actions.className).toContain('shrink-0')
    })

    it('renders no actions wrapper when actionSlot is omitted', () => {
      renderShelf({ actionSlot: undefined })
      expect(screen.queryByTestId('library-shelf-row-actions')).toBeNull()
    })
  })

  describe('scroller and snap behavior (AC-4)', () => {
    it('applies snap-x, snap-mandatory, overflow-x-auto, flex, and gap-4 to the scroller', () => {
      renderShelf()
      const scroller = screen.getByTestId('library-shelf-row-scroller')
      expect(scroller.className).toContain('flex')
      expect(scroller.className).toContain('gap-4')
      expect(scroller.className).toContain('overflow-x-auto')
      expect(scroller.className).toContain('snap-x')
      expect(scroller.className).toContain('snap-mandatory')
    })

    it('preserves the -mx-2/px-2 scrollbar-bleed pattern on the scroller', () => {
      renderShelf()
      const scroller = screen.getByTestId('library-shelf-row-scroller')
      // Regression guard — see plan's open question 3 resolution
      expect(scroller.className).toContain('-mx-2')
      expect(scroller.className).toContain('px-2')
    })

    it('wraps each truthy child in a snap-start shrink-0 container', () => {
      renderShelf({
        children: [
          <div key="a" data-testid="child-a">
            A
          </div>,
          <div key="b" data-testid="child-b">
            B
          </div>,
          <div key="c" data-testid="child-c">
            C
          </div>,
        ],
      })
      const scroller = screen.getByTestId('library-shelf-row-scroller')
      const wrappers = scroller.querySelectorAll(':scope > div')
      expect(wrappers).toHaveLength(3)
      wrappers.forEach(wrapper => {
        expect(wrapper.className).toContain('snap-start')
        expect(wrapper.className).toContain('shrink-0')
      })
    })

    it('skips falsy children so the wrapper count matches truthy-child count', () => {
      renderShelf({
        children: [
          <div key="a" data-testid="child-a">
            A
          </div>,
          null,
          <div key="b" data-testid="child-b">
            B
          </div>,
        ],
      })
      const scroller = screen.getByTestId('library-shelf-row-scroller')
      const wrappers = scroller.querySelectorAll(':scope > div')
      expect(wrappers).toHaveLength(2)
    })
  })

  describe('data-testid scoping (AC-6)', () => {
    it('uses default library-shelf-row-* test ids when data-testid is not provided', () => {
      renderShelf({
        subtitle: 'Most recently opened',
        actionSlot: <button type="button">Shuffle</button>,
      })
      expect(screen.getByTestId('library-shelf-row')).toBeInTheDocument()
      expect(screen.getByTestId('library-shelf-row-heading')).toBeInTheDocument()
      expect(screen.getByTestId('library-shelf-row-subtitle')).toBeInTheDocument()
      expect(screen.getByTestId('library-shelf-row-actions')).toBeInTheDocument()
      expect(screen.getByTestId('library-shelf-row-scroller')).toBeInTheDocument()
    })

    it('derives all sub-element test ids from a custom data-testid prefix', () => {
      renderShelf({
        'data-testid': 'continue-listening',
        subtitle: 'Most recently opened',
        actionSlot: <button type="button">Shuffle</button>,
      })
      expect(screen.getByTestId('continue-listening')).toBeInTheDocument()
      expect(screen.getByTestId('continue-listening-heading')).toBeInTheDocument()
      expect(screen.getByTestId('continue-listening-subtitle')).toBeInTheDocument()
      expect(screen.getByTestId('continue-listening-actions')).toBeInTheDocument()
      expect(screen.getByTestId('continue-listening-scroller')).toBeInTheDocument()
      // Default ids must not leak when a custom prefix is used
      expect(screen.queryByTestId('library-shelf-row')).toBeNull()
      expect(screen.queryByTestId('library-shelf-row-heading')).toBeNull()
    })
  })

  describe('desktop scroll affordances', () => {
    it('renders left/right scroll controls and edge fades', () => {
      renderShelf({ 'data-testid': 'continue-listening' })
      expect(screen.getByTestId('continue-listening-scroll-left')).toBeInTheDocument()
      expect(screen.getByTestId('continue-listening-scroll-right')).toBeInTheDocument()
    })

    it('disables left chevron at start and enables right when overflow exists', () => {
      renderShelf({
        'data-testid': 'continue-listening',
        children: [
          <div key="a">A</div>,
          <div key="b">B</div>,
          <div key="c">C</div>,
        ],
      })

      const scroller = screen.getByTestId('continue-listening-scroller')
      Object.defineProperty(scroller, 'scrollWidth', { value: 900, configurable: true })
      Object.defineProperty(scroller, 'clientWidth', { value: 300, configurable: true })
      Object.defineProperty(scroller, 'scrollLeft', { value: 0, configurable: true, writable: true })
      fireEvent.scroll(scroller)

      expect(screen.getByTestId('continue-listening-scroll-left')).toBeDisabled()
      expect(screen.getByTestId('continue-listening-scroll-right')).not.toBeDisabled()
    })

    it('handles keyboard arrows on the scroller', () => {
      renderShelf({ 'data-testid': 'continue-listening' })
      const scroller = screen.getByTestId('continue-listening-scroller')
      const scrollByMock = vi.fn()
      Object.defineProperty(scroller, 'scrollBy', {
        configurable: true,
        writable: true,
        value: scrollByMock,
      })

      fireEvent.keyDown(scroller, { key: 'ArrowRight' })
      fireEvent.keyDown(scroller, { key: 'ArrowLeft' })

      expect(scrollByMock).toHaveBeenCalledTimes(2)
    })
  })
})
