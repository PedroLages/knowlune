import { describe, it, expect } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { BookOpen } from 'lucide-react'
import { LibraryMediaShelfRow } from '@/app/components/library/LibraryMediaShelfRow'

function mockMediaScrollerOverflow(scroller: HTMLElement) {
  Object.defineProperty(scroller, 'scrollWidth', { value: 900, configurable: true })
  Object.defineProperty(scroller, 'clientWidth', { value: 300, configurable: true })
  Object.defineProperty(scroller, 'scrollLeft', { value: 0, configurable: true, writable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('LibraryMediaShelfRow', () => {
  it('does not violate hooks rules when children transition empty -> non-empty', () => {
    const { rerender } = render(
      <LibraryMediaShelfRow icon={BookOpen} label="Test shelf">
        {null}
      </LibraryMediaShelfRow>
    )

    rerender(
      <LibraryMediaShelfRow icon={BookOpen} label="Test shelf">
        <div>Item</div>
      </LibraryMediaShelfRow>
    )

    expect(screen.getByTestId('library-media-shelf-row')).toBeInTheDocument()
  })

  it('renders scroll chevrons when scroller overflows', async () => {
    render(
      <LibraryMediaShelfRow icon={BookOpen} label="Shelf" data-testid="media-row">
        <div className="w-40 shrink-0">A</div>
        <div className="w-40 shrink-0">B</div>
      </LibraryMediaShelfRow>
    )

    const scroller = screen.getByTestId('media-row-scroller')
    await act(async () => {
      mockMediaScrollerOverflow(scroller)
    })

    await waitFor(() => {
      expect(screen.getByTestId('media-row-scroll-left')).toBeInTheDocument()
      expect(screen.getByTestId('media-row-scroll-right')).toBeInTheDocument()
    })
  })

  it('does not render chevrons when content fits', async () => {
    render(
      <LibraryMediaShelfRow icon={BookOpen} label="Shelf" data-testid="fit-row">
        <div>One</div>
      </LibraryMediaShelfRow>
    )

    const scroller = screen.getByTestId('fit-row-scroller')
    await act(async () => {
      Object.defineProperty(scroller, 'scrollWidth', { value: 300, configurable: true })
      Object.defineProperty(scroller, 'clientWidth', { value: 300, configurable: true })
      Object.defineProperty(scroller, 'scrollLeft', { value: 0, configurable: true, writable: true })
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.queryByTestId('fit-row-scroll-left')).toBeNull()
    expect(screen.queryByTestId('fit-row-scroll-right')).toBeNull()
  })
})
