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

// Mock the reader store
const mockToggleHeader = vi.fn()
vi.mock('@/stores/useReaderStore', () => ({
  useReaderStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      theme: 'light',
      fontSize: 100,
      fontFamily: 'default',
      lineHeight: 1.6,
      toggleHeader: mockToggleHeader,
    }),
}))

// Mock Rendition
function createMockRendition() {
  return {
    resize: vi.fn(),
    prev: vi.fn().mockResolvedValue(undefined),
    next: vi.fn().mockResolvedValue(undefined),
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
  })

  afterEach(() => {
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
          lastCallback([
            { contentRect: { width: 800, height: 600 } } as ResizeObserverEntry,
          ])
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
          lastCallback([
            { contentRect: { width: 0, height: 0 } } as ResizeObserverEntry,
          ])
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
    it('applies light theme background to container', () => {
      render(<EpubRenderer {...defaultProps} />)
      const container = screen.getByTestId('epub-renderer')
      expect(container.className).toContain('bg-[#FAF5EE]')
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

    it('gives each interaction zone pointer-events-auto', () => {
      render(<EpubRenderer {...defaultProps} />)

      const prevZone = screen.getByLabelText('Previous page')
      const toggleZone = screen.getByLabelText('Toggle reader controls')
      const nextZone = screen.getByLabelText('Next page')

      expect(prevZone.className).toContain('pointer-events-auto')
      expect(toggleZone.className).toContain('pointer-events-auto')
      expect(nextZone.className).toContain('pointer-events-auto')
    })

    it('clicking toggle zone calls toggleHeader', () => {
      render(<EpubRenderer {...defaultProps} />)

      const toggleZone = screen.getByLabelText('Toggle reader controls')
      fireEvent.click(toggleZone)
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
          background: '#FAF5EE',
          color: '#1a1a1a',
          'font-size': '100%',
          'line-height': '1.6',
        }),
      })
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
      expect(screen.getByLabelText('Toggle reader controls')).toBeInTheDocument()
      expect(screen.getByLabelText('Next page')).toBeInTheDocument()
    })
  })
})
