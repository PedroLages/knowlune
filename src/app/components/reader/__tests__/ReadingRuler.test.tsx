/**
 * ReadingRuler component tests (E114-S01)
 *
 * Tests conditional rendering, pointer tracking, z-index/pointer-events
 * behavior, and visual ruler display after first pointer move.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ReadingRuler } from '../ReadingRuler'
import { useReaderStore } from '@/stores/useReaderStore'

// Helper to fire a pointermove on document.
// jsdom does not implement PointerEvent, so we extend MouseEvent which shares
// the clientX/clientY interface that ReadingRuler reads.
function fireDocumentPointerMove(clientX: number, clientY: number) {
  // Polyfill PointerEvent if missing (jsdom limitation)
  const EventCtor =
    typeof PointerEvent !== 'undefined'
      ? PointerEvent
      : (MouseEvent as unknown as typeof PointerEvent)
  const event = new EventCtor('pointermove', {
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  } as PointerEventInit)
  document.dispatchEvent(event)
}

describe('ReadingRuler', () => {
  beforeEach(() => {
    localStorage.clear()
    act(() => {
      useReaderStore.getState().resetSettings()
    })
  })

  afterEach(() => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(false)
    })
  })

  it('does not render when readingRulerEnabled is false', () => {
    render(<ReadingRuler />)
    expect(screen.queryByTestId('reading-ruler')).toBeNull()
  })

  it('renders the container when readingRulerEnabled is true', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })
    render(<ReadingRuler />)
    expect(screen.getByTestId('reading-ruler')).toBeTruthy()
  })

  it('container has pointer-events-none so it does not block tap zones', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })
    render(<ReadingRuler />)
    const ruler = screen.getByTestId('reading-ruler')
    expect(ruler.className).toContain('pointer-events-none')
  })

  it('container does NOT have pointer-events-auto (blocking class)', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })
    render(<ReadingRuler />)
    const ruler = screen.getByTestId('reading-ruler')
    expect(ruler.className).not.toContain('pointer-events-auto')
  })

  it('does not show the reading band before any pointer move', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })
    render(<ReadingRuler />)
    expect(screen.queryByTestId('reading-ruler-band')).toBeNull()
  })

  it('shows the reading band after a pointermove within container bounds', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })

    render(<ReadingRuler />)
    const ruler = screen.getByTestId('reading-ruler')

    // Mock getBoundingClientRect to define container bounds
    ruler.getBoundingClientRect = () => ({
      top: 0,
      bottom: 600,
      left: 0,
      right: 800,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    act(() => {
      fireDocumentPointerMove(400, 200)
    })

    expect(screen.getByTestId('reading-ruler-band')).toBeTruthy()
  })

  it('does not show the reading band when pointer is outside container bounds', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })

    render(<ReadingRuler />)
    const ruler = screen.getByTestId('reading-ruler')

    ruler.getBoundingClientRect = () => ({
      top: 100,
      bottom: 700,
      left: 0,
      right: 800,
      width: 800,
      height: 600,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    })

    // Pointer above the container
    act(() => {
      fireDocumentPointerMove(400, 50)
    })

    expect(screen.queryByTestId('reading-ruler-band')).toBeNull()
  })

  it('has aria-hidden so screen readers skip the overlay', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })
    render(<ReadingRuler />)
    const ruler = screen.getByTestId('reading-ruler')
    expect(ruler.getAttribute('aria-hidden')).toBe('true')
  })

  it('container is at z-20 (above content but pointer-events-none)', () => {
    act(() => {
      useReaderStore.getState().setReadingRulerEnabled(true)
    })
    render(<ReadingRuler />)
    const ruler = screen.getByTestId('reading-ruler')
    expect(ruler.className).toContain('z-20')
  })
})
