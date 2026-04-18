/**
 * Unit tests for LibraryShelfHeading primitive — E116-S02
 *
 * Locks in the behavioural contract for the shared shelf-heading primitive
 * after the E116-S02 extensions:
 * - AC-1: `headingLevel` prop drives the rendered tag
 * - AC-2: `ShelfSeeAllLink` renders `<a>` (with href) or `<button>` (without)
 * - AC-3/AC-4: Design tokens only, dark-mode-correct (covered via class assertions)
 * - AC-5: Touch-target floor (h-11) on ShelfSeeAllLink
 * - AC-6: `className` pass-through on root wrapper
 * - AC-8: Test-id scoping preserved (including library-shelf-row-* fallbacks)
 *
 * Also imports via the barrel (`@/app/components/library`) to prove the
 * E116-S02 Unit 3 barrel resolves.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Intentional barrel import — proves src/app/components/library/index.ts
// re-exports LibraryShelfHeading correctly (E116-S02 Unit 3 Verification).
import { LibraryShelfHeading, ShelfSeeAllLink } from '@/app/components/library'

const StubIcon = ({ className }: { className?: string }) => (
  <svg data-testid="stub-icon" className={className} aria-hidden="true" />
)

describe('LibraryShelfHeading', () => {
  describe('headingLevel', () => {
    it('renders <h3> by default', () => {
      render(<LibraryShelfHeading icon={StubIcon} label="Continue Listening" />)
      expect(screen.getByRole('heading', { level: 3, name: /Continue Listening/ })).toBeInTheDocument()
    })

    it('renders <h2> when headingLevel="h2"', () => {
      render(
        <LibraryShelfHeading icon={StubIcon} label="Audiobooks" headingLevel="h2" />,
      )
      expect(screen.getByRole('heading', { level: 2, name: /Audiobooks/ })).toBeInTheDocument()
    })

    it('renders <h4> when headingLevel="h4"', () => {
      render(<LibraryShelfHeading icon={StubIcon} label="Queue" headingLevel="h4" />)
      expect(screen.getByRole('heading', { level: 4, name: /Queue/ })).toBeInTheDocument()
    })
  })

  describe('content rendering', () => {
    it('renders count badge when count is a number', () => {
      render(<LibraryShelfHeading icon={StubIcon} label="Books" count={5} />)
      expect(screen.getByRole('heading', { level: 3 }).textContent).toContain('(5)')
    })

    it('renders count badge for count=0 (typeof-number check, not truthy)', () => {
      render(<LibraryShelfHeading icon={StubIcon} label="Books" count={0} />)
      expect(screen.getByRole('heading', { level: 3 }).textContent).toContain('(0)')
    })

    it('renders subtitle with scoped test id when data-testid is provided', () => {
      render(
        <LibraryShelfHeading
          icon={StubIcon}
          label="Books"
          subtitle="Recently added"
          data-testid="my-shelf"
        />,
      )
      const subtitle = screen.getByTestId('my-shelf-subtitle')
      expect(subtitle).toHaveTextContent('Recently added')
    })

    it('renders actionSlot inside the actions wrapper when provided', () => {
      render(
        <LibraryShelfHeading
          icon={StubIcon}
          label="Books"
          data-testid="my-shelf"
          actionSlot={<span data-testid="slot-child">slot</span>}
        />,
      )
      const wrapper = screen.getByTestId('my-shelf-actions')
      expect(wrapper).toContainElement(screen.getByTestId('slot-child'))
    })

    it('omits the actions wrapper when actionSlot is not provided', () => {
      render(
        <LibraryShelfHeading icon={StubIcon} label="Books" data-testid="my-shelf" />,
      )
      expect(screen.queryByTestId('my-shelf-actions')).toBeNull()
    })
  })

  describe('data-testid fallbacks', () => {
    it('falls back to library-shelf-row-* when data-testid is omitted', () => {
      render(
        <LibraryShelfHeading
          icon={StubIcon}
          label="Books"
          subtitle="subtitle text"
          actionSlot={<span>x</span>}
        />,
      )
      expect(screen.getByTestId('library-shelf-row-heading')).toBeInTheDocument()
      expect(screen.getByTestId('library-shelf-row-subtitle')).toBeInTheDocument()
      expect(screen.getByTestId('library-shelf-row-actions')).toBeInTheDocument()
    })
  })

  describe('className pass-through', () => {
    it('merges className onto the root wrapper', () => {
      const { container } = render(
        <LibraryShelfHeading icon={StubIcon} label="Books" className="mb-2" />,
      )
      const root = container.firstChild as HTMLElement
      expect(root.className).toContain('mb-2')
    })

    it('default mb-4 is overridden when className provides a different margin', () => {
      // tailwind-merge inside cn() removes conflicting margin utilities —
      // only the caller's mb-2 should remain on the root.
      const { container } = render(
        <LibraryShelfHeading icon={StubIcon} label="Books" className="mb-2" />,
      )
      const root = container.firstChild as HTMLElement
      expect(root.className).toContain('mb-2')
      expect(root.className).not.toContain('mb-4')
    })

    it('preserves the default mb-4 when className is not provided', () => {
      const { container } = render(
        <LibraryShelfHeading icon={StubIcon} label="Books" />,
      )
      const root = container.firstChild as HTMLElement
      expect(root.className).toContain('mb-4')
    })
  })

  describe('truncation container', () => {
    it('keeps long labels inside a truncate/min-w-0 column', () => {
      const { container } = render(
        <LibraryShelfHeading
          icon={StubIcon}
          label="A very long shelf label that should truncate on narrow viewports"
        />,
      )
      // Inner column wrapper is the second child of the root (the flex column).
      const root = container.firstChild as HTMLElement
      const column = root.firstChild as HTMLElement
      expect(column.className).toContain('min-w-0')
      // The label <span> inside the heading has truncate.
      const labelSpan = screen.getByText(/A very long shelf label/)
      expect(labelSpan.className).toContain('truncate')
    })
  })
})

describe('ShelfSeeAllLink', () => {
  it('renders an <a> with href and default "See all" label when href is provided', () => {
    render(<ShelfSeeAllLink href="/library" />)
    const link = screen.getByRole('link', { name: 'See all' })
    expect(link).toHaveAttribute('href', '/library')
  })

  it('renders a <button type="button"> when only onClick is provided and invokes it on click', () => {
    const onClick = vi.fn()
    render(<ShelfSeeAllLink onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'See all' })
    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a custom label when provided', () => {
    render(<ShelfSeeAllLink href="/library" label="View all books" />)
    expect(screen.getByRole('link', { name: 'View all books' })).toBeInTheDocument()
  })

  it('prefers <a> when both href and onClick are provided; onClick is not attached to the anchor', () => {
    const onClick = vi.fn()
    render(<ShelfSeeAllLink href="/library" onClick={onClick} />)
    const link = screen.getByRole('link', { name: 'See all' })
    expect(link.tagName).toBe('A')
    fireEvent.click(link)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders an inert <button type="button"> when neither href nor onClick is provided', () => {
    render(<ShelfSeeAllLink />)
    const button = screen.getByRole('button', { name: 'See all' })
    expect(button).toHaveAttribute('type', 'button')
    // Should not throw when clicked.
    fireEvent.click(button)
  })

  it('uses the 44px touch-target floor (h-11) and brand tokens', () => {
    render(<ShelfSeeAllLink href="/library" />)
    const link = screen.getByRole('link', { name: 'See all' })
    expect(link.className).toContain('h-11')
    expect(link.className).toContain('text-brand')
    expect(link.className).toContain('hover:text-brand-hover')
  })
})
