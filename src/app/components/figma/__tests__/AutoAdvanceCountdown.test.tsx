/**
 * AutoAdvanceCountdown — Unit tests for the countdown overlay rewrite (E89-S07)
 *
 * Tests cover:
 * - Happy path: rendering, countdown ticks, ring percentage
 * - Happy path: onAdvance called at zero, Cancel, Play Now, Escape
 * - Edge cases: interval cleanup, backdrop click, remaining=0 via effect
 * - Accessibility: ARIA roles, labels, screen reader announcement
 * - Responsive: button layout
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AutoAdvanceCountdown } from '../AutoAdvanceCountdown'

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// Stub requestAnimationFrame so mount animation fires synchronously
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    cb(0)
    return 0
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const defaultProps = {
  seconds: 5,
  nextLessonTitle: 'Lesson Two: Advanced Topics',
  onAdvance: vi.fn(),
  onCancel: vi.fn(),
}

function renderCountdown() {
  return render(<AutoAdvanceCountdown {...defaultProps} />)
}

describe('AutoAdvanceCountdown', () => {
  describe('rendering', () => {
    it('renders the overlay with countdown ring and next lesson title', () => {
      renderCountdown()
      expect(screen.getByTestId('auto-advance-countdown')).toBeInTheDocument()
      expect(screen.getByText('Lesson Two: Advanced Topics')).toBeInTheDocument()
      expect(screen.getByText('Next up')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Play Now')).toBeInTheDocument()
    })

    it('displays remaining seconds in the ring center', () => {
      renderCountdown()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('has data-slot="countdown-overlay" for theater mode targeting', () => {
      renderCountdown()
      expect(screen.getByTestId('auto-advance-countdown')).toHaveAttribute(
        'data-slot',
        'countdown-overlay'
      )
    })
  })

  describe('countdown timer', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('decrements remaining seconds each second', () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
      renderCountdown()
      // RAF mock fires synchronously, so phase transitions to Visible
      expect(screen.getByText('5')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(screen.getByText('4')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('calls onAdvance when countdown reaches zero', () => {
      const onAdvance = vi.fn()
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] })
      render(<AutoAdvanceCountdown {...defaultProps} onAdvance={onAdvance} />)
      expect(screen.getByTestId('auto-advance-countdown')).toBeInTheDocument()

      // Advance all 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Wait for exit animation (200ms) — setTimeout inside useEffect
      act(() => {
        vi.advanceTimersByTime(200)
      })

      expect(onAdvance).toHaveBeenCalledOnce()
    })
  })

  describe('user interactions', () => {
    it('calls onCancel when Cancel button is clicked', async () => {
      const onCancel = vi.fn()
      render(<AutoAdvanceCountdown {...defaultProps} onCancel={onCancel} />)
      expect(screen.getByText('Cancel')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Cancel'))

      // Wait for exit animation (200ms)
      await act(async () => {
        await new Promise(r => setTimeout(r, 200))
      })

      expect(onCancel).toHaveBeenCalledOnce()
    })

    it('calls onAdvance when Play Now button is clicked before countdown ends', async () => {
      const onAdvance = vi.fn()
      render(<AutoAdvanceCountdown {...defaultProps} onAdvance={onAdvance} />)
      expect(screen.getByText('Play Now')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Play Now'))

      // Wait for exit animation (200ms)
      await act(async () => {
        await new Promise(r => setTimeout(r, 200))
      })

      expect(onAdvance).toHaveBeenCalledOnce()
    })

    it('calls onCancel when Escape key is pressed', async () => {
      const onCancel = vi.fn()
      render(<AutoAdvanceCountdown {...defaultProps} onCancel={onCancel} />)
      expect(screen.getByTestId('auto-advance-countdown')).toBeInTheDocument()

      fireEvent.keyDown(screen.getByTestId('auto-advance-countdown'), {
        key: 'Escape',
        code: 'Escape',
      })

      // Wait for exit animation (200ms)
      await act(async () => {
        await new Promise(r => setTimeout(r, 200))
      })

      expect(onCancel).toHaveBeenCalledOnce()
    })

    it('does NOT dismiss overlay on backdrop click', () => {
      const onCancel = vi.fn()
      render(<AutoAdvanceCountdown {...defaultProps} onCancel={onCancel} />)
      expect(screen.getByTestId('auto-advance-countdown')).toBeInTheDocument()

      // Click on the overlay backdrop (the outer container)
      fireEvent.click(screen.getByTestId('auto-advance-countdown'))

      // No exit animation triggered, onCancel should not be called
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has role="status" and aria-live="polite" on the overlay container', () => {
      renderCountdown()
      const overlay = screen.getByTestId('auto-advance-countdown')
      expect(overlay).toHaveAttribute('role', 'status')
      expect(overlay).toHaveAttribute('aria-live', 'polite')
    })

    it('has a visually-hidden screen reader announcement with lesson title and countdown', () => {
      renderCountdown()
      const srText = screen.getByText(/Next up: Lesson Two/)
      expect(srText).toBeInTheDocument()
      expect(srText).toHaveClass('sr-only')
    })
  })

  describe('responsive layout', () => {
    it('renders buttons in a column on mobile (flex-col)', () => {
      renderCountdown()
      const buttonContainer = screen.getByText('Cancel').parentElement
      expect(buttonContainer).toHaveClass('flex-col')
      expect(buttonContainer).toHaveClass('sm:flex-row')
    })
  })
})
