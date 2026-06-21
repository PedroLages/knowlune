import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { BookOpen } from 'lucide-react'
import { LibraryRail } from '@/app/components/library/rails/LibraryRail'

function mockRailScrollerOverflow(scroller: HTMLElement) {
  Object.defineProperty(scroller, 'scrollWidth', { value: 4000, configurable: true })
  Object.defineProperty(scroller, 'clientWidth', { value: 400, configurable: true })
  Object.defineProperty(scroller, 'scrollLeft', { value: 0, configurable: true, writable: true })
  window.dispatchEvent(new Event('resize'))
}

function StubTile({ bookId, label }: { bookId: string; label: string }) {
  return (
    <div data-testid={`tile-${bookId}`} data-rail-tile>
      {label}
    </div>
  )
}

describe('LibraryRail', () => {
  it('renders the heading with title', () => {
    render(
      <MemoryRouter>
        <LibraryRail icon={BookOpen} title="Continue Listening">
          <StubTile bookId="1" label="Item 1" />
        </LibraryRail>
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /continue listening/i })).toBeInTheDocument()
  })

  it('renders null when children are empty', () => {
    const { container } = render(
      <MemoryRouter>
        <LibraryRail icon={BookOpen} title="Empty Shelf">
          {null}
        </LibraryRail>
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('shows chevron buttons for scrollable content', async () => {
    render(
      <MemoryRouter>
        <LibraryRail icon={BookOpen} title="My Shelf" data-testid="my-shelf">
          {Array.from({ length: 10 }, (_, i) => (
            <StubTile key={i} bookId={String(i)} label={`Item ${i}`} />
          ))}
        </LibraryRail>
      </MemoryRouter>
    )

    mockRailScrollerOverflow(screen.getByTestId('my-shelf-scroller'))
    await waitFor(() => {
      expect(screen.getByLabelText('Scroll left')).toBeInTheDocument()
      expect(screen.getByLabelText('Scroll right')).toBeInTheDocument()
    })
  })

  it('applies scrollbar-none to the viewport', () => {
    render(
      <MemoryRouter>
        <LibraryRail icon={BookOpen} title="My Shelf" data-testid="my-shelf">
          <StubTile bookId="1" label="Item 1" />
        </LibraryRail>
      </MemoryRouter>
    )

    const scroller = screen.getByTestId('my-shelf-scroller')
    expect(scroller.className).toContain('scrollbar-none')
  })

  it('disables left chevron when at scroll start', async () => {
    render(
      <MemoryRouter>
        <LibraryRail icon={BookOpen} title="My Shelf">
          <StubTile bookId="1" label="Item 1" />
        </LibraryRail>
      </MemoryRouter>
    )

    mockRailScrollerOverflow(screen.getByTestId('rail-viewport'))

    await waitFor(() => {
      const leftBtn = screen.getByLabelText('Scroll left')
      expect(leftBtn).toBeDisabled()
    })
  })

  it('renders children inside snap-start wrappers', () => {
    render(
      <MemoryRouter>
        <LibraryRail icon={BookOpen} title="My Shelf" data-testid="my-shelf">
          <StubTile bookId="1" label="Item 1" />
        </LibraryRail>
      </MemoryRouter>
    )

    // The scroller should contain the child tile (wrapped in a snap-start div)
    const scroller = screen.getByTestId('my-shelf-scroller')
    const snapItems = scroller.querySelectorAll('.snap-start')
    expect(snapItems.length).toBe(1)
    expect(screen.getByTestId('tile-1')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(
      <MemoryRouter>
        <LibraryRail icon={BookOpen} title="My Shelf" subtitle="Some description">
          <StubTile bookId="1" label="Item 1" />
        </LibraryRail>
      </MemoryRouter>
    )

    expect(screen.getByText('Some description')).toBeInTheDocument()
  })
})
