/**
 * EpubRenderer unit tests — E107-S02 Fix EPUB Reader Rendering
 *
 * Tests the four rendering bug fixes:
 * - Bug 1 (AC-1, AC-2): ResizeObserver triggers rendition.resize()
 * - Bug 2 (AC-3): Container background matches reader theme
 * - Bug 3 (AC-4): epubOptions include spread: 'none' for single-page layout
 * - Bug 4 (AC-5): Interaction zones properly stacked with pointer-events
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { EpubRenderer } from '../EpubRenderer'

// --- Mocks ---

// Mock react-reader's EpubView to capture props
const mockEpubViewProps = vi.fn()
vi.mock('react-reader', () => ({
  EpubView: (props: Record<string, unknown>) => {
    mockEpubViewProps(props)
    // Simulate calling getRendition after mount
    return <div data-testid="mock-epub-view" />
  },
}))

// Mutable store state — allows individual tests to override theme/settings
const mockStoreState: Record<string, unknown> = {
  theme: 'white',
  fontSize: 100,
  fontFamily: 'default',
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0,
  scrollMode: false,
  dualPage: false,
  toggleHeader: vi.fn(),
}
const mockToggleHeader = mockStoreState.toggleHeader as ReturnType<typeof vi.fn>

vi.mock('@/stores/useReaderStore', () => ({
  useReaderStore: (selector: (s: Record<string, unknown>) => unknown) => selector(mockStoreState),
}))

// Mock Rendition
function createMockRendition() {
  return {
    resize: vi.fn(),
    prev: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
    flow: vi.fn(),
    spread: vi.fn(),
    themes: {
      default: vi.fn(),
    },
  }
}

// ResizeObserver tracking
type ResizeCallback = (entries: ResizeObserverEntry[]) => void
let resizeObserverCallbacks: ResizeCallback[] = []
let resizeObserverInstances: { disconnect: ReturnType<typeof vi.fn> }[] = []

class MockResizeObserver {
  callback: ResizeCallback
  disconnectFn = vi.fn()

  constructor(callback: ResizeCallback) {
    this.callback = callback
    resizeObserverCallbacks.push(callback)
    resizeObserverInstances.push({ disconnect: this.disconnectFn })
  }

  observe() {
    // Intentional: no-op for test — we trigger callbacks manually
  }

  unobserve() {
    // Intentional: no-op for test
  }

  disconnect() {
    this.disconnectFn()
  }
}

describe('EpubRenderer', () => {
  const defaultProps = {
    url: 'blob:http://localhost/test-epub',
    initialLocation: null,
    onLocationChanged: vi.fn(),
  }

  beforeEach(() => {
    resizeObserverCallbacks = []
    resizeObserverInstances = []
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
    mockEpubViewProps.mockClear()
    mockToggleHeader.mockClear()
    // Reset store to defaults
    mockStoreState.theme = 'white'
    mockStoreState.fontSize = 100
    mockStoreState.fontFamily = 'default'
    mockStoreState.lineHeight = 1.6
    mockStoreState.letterSpacing = 0
    mockStoreState.wordSpacing = 0
    mockStoreState.scrollMode = false
    mockStoreState.dualPage = false
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Bug 1 — ResizeObserver viewport resize (AC-1, AC-2)', () => {
    it('sets up ResizeObserver after rendition is ready', () => {
      render(<EpubRenderer {...defaultProps} />)

      // Before rendition is ready, no ResizeObserver should be active
      expect(resizeObserverCallbacks).toHaveLength(0)

      // Simulate rendition becoming ready via getRendition callback
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      const mockRendition = createMockRendition()
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      // After re-render triggered by setRenditionReady(true), ResizeObserver should attach
      expect(resizeObserverCallbacks.length).toBeGreaterThanOrEqual(1)
    })

    it('calls rendition.resize() when container dimensions change', () => {
      render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      // Simulate resize event
      const lastCallback = resizeObserverCallbacks[resizeObserverCallbacks.length - 1]
      if (lastCallback) {
        act(() => {
          lastCallback([{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry])
        })
        expect(mockRendition.resize).toHaveBeenCalledWith(800, 600)
      }
    })

    it('ignores zero-dimension resize events', () => {
      render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      const lastCallback = resizeObserverCallbacks[resizeObserverCallbacks.length - 1]
      if (lastCallback) {
        act(() => {
          lastCallback([{ contentRect: { width: 0, height: 0 } } as ResizeObserverEntry])
        })
        expect(mockRendition.resize).not.toHaveBeenCalled()
      }
    })

    it('disconnects ResizeObserver on unmount', () => {
      const { unmount } = render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      const instance = resizeObserverInstances[resizeObserverInstances.length - 1]
      unmount()

      if (instance) {
        expect(instance.disconnect).toHaveBeenCalled()
      }
    })
  })

  describe('Bug 2 — Container background matches theme (AC-3)', () => {
    it('applies white theme background to container', () => {
      render(<EpubRenderer {...defaultProps} />)
      const container = screen.getByTestId('epub-renderer')
      expect(container.className).toContain('bg-[#ffffff]')
    })

    it('applies sepia theme background to container', () => {
      mockStoreState.theme = 'sepia'
      render(<EpubRenderer {...defaultProps} />)
      const container = screen.getByTestId('epub-renderer')
      expect(container.className).toContain('bg-[#f4ecd8]')
    })

    it('applies dark theme background to container', () => {
      mockStoreState.theme = 'dark'
      render(<EpubRenderer {...defaultProps} />)
      const container = screen.getByTestId('epub-renderer')
      expect(container.className).toContain('bg-[#383a56]')
    })

    it('applies gray theme background to container', () => {
      mockStoreState.theme = 'gray'
      render(<EpubRenderer {...defaultProps} />)
      const container = screen.getByTestId('epub-renderer')
      expect(container.className).toContain('bg-[#e5e5e5]')
    })

    it('applies black theme background to container', () => {
      mockStoreState.theme = 'black'
      render(<EpubRenderer {...defaultProps} />)
      const container = screen.getByTestId('epub-renderer')
      expect(container.className).toContain('bg-[#000000]')
    })
  })

  describe('Bug 3 — Single-page spread (AC-4)', () => {
    it('passes spread: "none" in epubOptions', () => {
      render(<EpubRenderer {...defaultProps} />)

      expect(mockEpubViewProps).toHaveBeenCalled()
      const passedProps = mockEpubViewProps.mock.calls[0][0]
      expect(passedProps.epubOptions).toEqual(
        expect.objectContaining({
          spread: 'none',
          flow: 'paginated',
        })
      )
    })

    it('disables popups in epubOptions', () => {
      render(<EpubRenderer {...defaultProps} />)

      const passedProps = mockEpubViewProps.mock.calls[0][0]
      expect(passedProps.epubOptions.allowPopups).toBe(false)
    })

    it('uses a narrower centered viewport for single-page mode', () => {
      mockStoreState.dualPage = false
      render(<EpubRenderer {...defaultProps} />)

      const viewport = screen.getByTestId('epub-viewport')
      expect(viewport).toHaveClass('mx-auto', 'max-w-[44rem]')
    })

    it('uses a wider viewport and auto spread for two-page mode', () => {
      mockStoreState.dualPage = true
      render(<EpubRenderer {...defaultProps} />)

      const passedProps = mockEpubViewProps.mock.calls[0][0]
      expect(passedProps.epubOptions).toEqual(
        expect.objectContaining({
          spread: 'auto',
          flow: 'paginated',
        })
      )
      expect(screen.getByTestId('epub-viewport')).toHaveClass('max-w-6xl')
    })
  })

  describe('Bug 4 — Interaction zone stacking (AC-5)', () => {
    it('wraps interaction zones in a pointer-events-none container with z-10', () => {
      render(<EpubRenderer {...defaultProps} />)

      const prevZone = screen.getByLabelText('Previous page')
      const parentContainer = prevZone.parentElement!
      expect(parentContainer.className).toContain('pointer-events-none')
      expect(parentContainer.className).toContain('absolute')
      expect(parentContainer.className).toContain('inset-0')
      expect(parentContainer.className).toContain('z-10')
    })

    it('gives gutter interaction zones pointer-events-auto', () => {
      render(<EpubRenderer {...defaultProps} />)

      const prevZone = screen.getByLabelText('Previous page')
      const nextZone = screen.getByLabelText('Next page')

      expect(prevZone.className).toContain('pointer-events-auto')
      expect(nextZone.className).toContain('pointer-events-auto')
      expect(screen.queryByLabelText('Toggle reader controls')).toBeNull()
    })

    it('clicking reader margin calls toggleHeader without adding a center overlay', () => {
      render(<EpubRenderer {...defaultProps} />)

      const container = screen.getByTestId('epub-renderer')
      fireEvent.click(container)
      expect(mockToggleHeader).toHaveBeenCalledTimes(1)
    })
  })

  describe('Theme application via rendition.themes.default()', () => {
    it('applies theme styles when rendition becomes ready', () => {
      render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({
          background: '#ffffff',
          color: '#1c1d2b',
          'font-size': '100%',
          'line-height': '1.6',
        }),
      })
    })

    it('applies the Atkinson Hyperlegible reader font', () => {
      mockStoreState.fontFamily = 'atkinson'
      render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({
          'font-family': "'Atkinson Hyperlegible', system-ui, -apple-system, sans-serif",
        }),
      })
    })

    it('re-applies theme when settings change (sepia)', () => {
      const { rerender } = render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      // Clear call count from initial applyTheme
      mockRendition.themes.default.mockClear()

      // Simulate store theme changing to sepia
      mockStoreState.theme = 'sepia'
      rerender(<EpubRenderer {...defaultProps} />)

      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({
          background: '#f4ecd8',
          color: '#2d241e',
        }),
      })
    })

    it('re-applies theme when settings change (dark)', () => {
      const { rerender } = render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      mockRendition.themes.default.mockClear()

      mockStoreState.theme = 'dark'
      rerender(<EpubRenderer {...defaultProps} />)

      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({
          background: '#383a56',
          color: '#f7f7fb',
        }),
      })
    })

    it('applies gray theme colors to the EPUB iframe', () => {
      mockStoreState.theme = 'gray'
      render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({
          background: '#e5e5e5',
          color: '#1f2937',
        }),
      })
    })

    it('applies black theme colors to the EPUB iframe', () => {
      mockStoreState.theme = 'black'
      render(<EpubRenderer {...defaultProps} />)

      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({
          background: '#000000',
          color: '#f8fafc',
        }),
      })
    })
  })

  describe('Navigation — navigatePrev / navigateNext', () => {
    function setupRendition() {
      render(<EpubRenderer {...defaultProps} />)
      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })
      return mockRendition
    }

    it('clicking prev zone calls rendition.prev()', () => {
      const mockRendition = setupRendition()
      const prevZone = screen.getByLabelText('Previous page')
      fireEvent.click(prevZone)
      expect(mockRendition.prev).toHaveBeenCalledTimes(1)
    })

    it('clicking next zone calls rendition.next()', () => {
      const mockRendition = setupRendition()
      const nextZone = screen.getByLabelText('Next page')
      fireEvent.click(nextZone)
      expect(mockRendition.next).toHaveBeenCalledTimes(1)
    })

    it('does not call rendition.prev() if rendition is not ready', () => {
      const mockRendition = createMockRendition()
      render(<EpubRenderer {...defaultProps} />)
      // Do NOT call getRendition — renditionRef stays null
      const prevZone = screen.getByLabelText('Previous page')
      fireEvent.click(prevZone)
      expect(mockRendition.prev).not.toHaveBeenCalled()
    })
  })

  describe('Page turn animation class', () => {
    function setupRendition() {
      render(<EpubRenderer {...defaultProps} />)
      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })
      return mockRendition
    }

    it('adds right animation class when navigating prev', () => {
      setupRendition()
      const container = screen.getByTestId('epub-renderer')
      const prevZone = screen.getByLabelText('Previous page')

      act(() => {
        fireEvent.click(prevZone)
      })

      expect(container.className).toContain('slide-right')
    })

    it('adds left animation class when navigating next', () => {
      setupRendition()
      const container = screen.getByTestId('epub-renderer')
      const nextZone = screen.getByLabelText('Next page')

      act(() => {
        fireEvent.click(nextZone)
      })

      expect(container.className).toContain('slide-left')
    })

    it('clears animation class after 250ms timer', () => {
      setupRendition()
      const container = screen.getByTestId('epub-renderer')
      const nextZone = screen.getByLabelText('Next page')

      act(() => {
        fireEvent.click(nextZone)
      })

      expect(container.className).toContain('slide-left')

      act(() => {
        vi.advanceTimersByTime(250)
      })

      expect(container.className).not.toContain('slide-left')
    })
  })

  describe('Swipe gesture navigation', () => {
    function setupRendition() {
      render(<EpubRenderer {...defaultProps} />)
      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })
      return mockRendition
    }

    function swipe(container: HTMLElement, dx: number, dy = 0) {
      fireEvent.touchStart(container, {
        touches: [{ clientX: 100, clientY: 100 }],
      })
      fireEvent.touchEnd(container, {
        changedTouches: [{ clientX: 100 + dx, clientY: 100 + dy }],
      })
    }

    it('swipe left (dx < -50) navigates to next page', () => {
      const mockRendition = setupRendition()
      const container = screen.getByTestId('epub-renderer')
      swipe(container, -60)
      expect(mockRendition.next).toHaveBeenCalledTimes(1)
      expect(mockRendition.prev).not.toHaveBeenCalled()
    })

    it('swipe right (dx > 50) navigates to previous page', () => {
      const mockRendition = setupRendition()
      const container = screen.getByTestId('epub-renderer')
      swipe(container, 60)
      expect(mockRendition.prev).toHaveBeenCalledTimes(1)
      expect(mockRendition.next).not.toHaveBeenCalled()
    })

    it('swipe shorter than threshold (< 50px) does not navigate', () => {
      const mockRendition = setupRendition()
      const container = screen.getByTestId('epub-renderer')
      swipe(container, -30)
      expect(mockRendition.next).not.toHaveBeenCalled()
      expect(mockRendition.prev).not.toHaveBeenCalled()
    })

    it('vertical swipe does not navigate (|dy| >= |dx|)', () => {
      const mockRendition = setupRendition()
      const container = screen.getByTestId('epub-renderer')
      swipe(container, -60, -80) // More vertical than horizontal
      expect(mockRendition.next).not.toHaveBeenCalled()
      expect(mockRendition.prev).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('renders live region for page change announcements', () => {
      render(<EpubRenderer {...defaultProps} />)
      const liveRegion = document.getElementById('reader-page-announce')
      expect(liveRegion).toBeInTheDocument()
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('has aria-labels on all interaction zones', () => {
      render(<EpubRenderer {...defaultProps} />)

      expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
      expect(screen.getByLabelText('Next page')).toBeInTheDocument()
      expect(screen.queryByLabelText('Toggle reader controls')).toBeNull()
    })
  })

  // ─── E114-S01: Letter/Word Spacing via rendition.themes.default() (AC-7, AC-8) ───

  describe('E114-S01 — Letter/Word spacing applied to rendition (AC-7, AC-8)', () => {
    function setupRenditionWithSpacing(letterSpacing: number, wordSpacing: number) {
      mockStoreState.letterSpacing = letterSpacing
      mockStoreState.wordSpacing = wordSpacing
      render(<EpubRenderer {...defaultProps} />)
      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })
      return mockRendition
    }

    it('applies letter-spacing as em string when non-zero (AC-7)', () => {
      const mockRendition = setupRenditionWithSpacing(0.1, 0)
      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({ 'letter-spacing': '0.1em' }),
      })
    })

    it('applies word-spacing as em string when non-zero (AC-7)', () => {
      const mockRendition = setupRenditionWithSpacing(0, 0.25)
      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({ 'word-spacing': '0.25em' }),
      })
    })

    it('resets letter-spacing to "normal" when value is 0 (AC-8)', () => {
      const mockRendition = setupRenditionWithSpacing(0, 0)
      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({ 'letter-spacing': 'normal' }),
      })
    })

    it('resets word-spacing to "normal" when value is 0 (AC-8)', () => {
      const mockRendition = setupRenditionWithSpacing(0, 0)
      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({ 'word-spacing': 'normal' }),
      })
    })

    it('re-applies spacing when letterSpacing changes (AC-7)', () => {
      const { rerender } = render(<EpubRenderer {...defaultProps} />)
      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })
      mockRendition.themes.default.mockClear()

      mockStoreState.letterSpacing = 0.2
      rerender(<EpubRenderer {...defaultProps} />)

      expect(mockRendition.themes.default).toHaveBeenCalledWith({
        body: expect.objectContaining({ 'letter-spacing': '0.2em' }),
      })
    })
  })

  // ─── E114-S02: Continuous Scroll Mode (AC-2, AC-3, AC-4, AC-5, AC-7, AC-8) ───

  describe('E114-S02 — Continuous Scroll Mode (AC-2, AC-3, AC-4, AC-5)', () => {
    it('passes flow: "scrolled-doc" in epubOptions when scrollMode is true (AC-2)', () => {
      mockStoreState.scrollMode = true
      render(<EpubRenderer {...defaultProps} />)

      const passedProps = mockEpubViewProps.mock.calls[0][0]
      expect(passedProps.epubOptions).toEqual(expect.objectContaining({ flow: 'scrolled-doc' }))
    })

    it('passes flow: "paginated" in epubOptions when scrollMode is false (AC-3)', () => {
      mockStoreState.scrollMode = false
      render(<EpubRenderer {...defaultProps} />)

      const passedProps = mockEpubViewProps.mock.calls[0][0]
      expect(passedProps.epubOptions).toEqual(expect.objectContaining({ flow: 'paginated' }))
    })

    it('hides prev/next tap zones when scrollMode is true (AC-4)', () => {
      mockStoreState.scrollMode = true
      render(<EpubRenderer {...defaultProps} />)

      expect(screen.queryByLabelText('Previous page')).toBeNull()
      expect(screen.queryByLabelText('Next page')).toBeNull()
    })

    it('shows prev/next tap zones when scrollMode is false (AC-3)', () => {
      mockStoreState.scrollMode = false
      render(<EpubRenderer {...defaultProps} />)

      expect(screen.getByLabelText('Previous page')).toBeInTheDocument()
      expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    })

    it('does not render overlay interaction zones in scroll mode (AC-5)', () => {
      mockStoreState.scrollMode = true
      render(<EpubRenderer {...defaultProps} />)

      expect(screen.queryByLabelText('Toggle reader controls')).toBeNull()
      expect(screen.queryByLabelText('Previous page')).toBeNull()
      expect(screen.queryByLabelText('Next page')).toBeNull()
    })

    it('uses a readable continuous-scroll viewport width', () => {
      mockStoreState.scrollMode = true
      render(<EpubRenderer {...defaultProps} />)

      expect(screen.getByTestId('epub-viewport')).toHaveClass('max-w-[72ch]')
    })

    it('disables onTouchStart/onTouchEnd handlers in scroll mode (AC-4)', () => {
      // In scroll mode, touch handlers are set to undefined so native scroll passes through.
      // Verify a swipe does NOT navigate when scrollMode is true.
      mockStoreState.scrollMode = true
      render(<EpubRenderer {...defaultProps} />)
      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })

      const container = screen.getByTestId('epub-renderer')
      // Simulate a left swipe — should not trigger navigation in scroll mode
      fireEvent.touchStart(container, { touches: [{ clientX: 200, clientY: 100 }] })
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100, clientY: 100 }] })

      expect(mockRendition.next).not.toHaveBeenCalled()
    })

    it('re-applies theme after flow change when scrollMode toggles (AC-7)', () => {
      render(<EpubRenderer {...defaultProps} />)
      const mockRendition = createMockRendition()
      const epubViewCall = mockEpubViewProps.mock.calls[0][0]
      act(() => {
        epubViewCall.getRendition(mockRendition)
      })
      mockRendition.themes.default.mockClear()

      // Simulate scrollMode changing
      mockStoreState.scrollMode = true
      const { rerender } = render(<EpubRenderer {...defaultProps} />)
      const mockRendition2 = createMockRendition()
      const epubViewCall2 = mockEpubViewProps.mock.calls[mockEpubViewProps.mock.calls.length - 1][0]
      act(() => {
        epubViewCall2.getRendition(mockRendition2)
      })

      // Theme must be applied (re-applies on rendition ready via handleGetRendition)
      expect(mockRendition2.themes.default).toHaveBeenCalled()
      rerender(<EpubRenderer {...defaultProps} />)
    })
  })
})
