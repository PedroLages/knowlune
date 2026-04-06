import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock dependencies
let mockActive = false
const mockHandlers = {
  onMouseEnter: vi.fn(),
  onMouseLeave: vi.fn(),
}
vi.mock('../useHoverPreview', () => ({
  useHoverPreview: () => ({
    active: mockActive,
    handlers: mockHandlers,
  }),
}))

let mockShouldReduceMotion = false
vi.mock('../useReducedMotion', () => ({
  useReducedMotion: () => ({
    shouldReduceMotion: mockShouldReduceMotion,
  }),
}))

import { useCourseCardPreview } from '../useCourseCardPreview'

describe('useCourseCardPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockActive = false
    mockShouldReduceMotion = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns showPreview=false when not hovering', () => {
    const { result } = renderHook(() => useCourseCardPreview())
    expect(result.current.showPreview).toBe(false)
  })

  it('returns showPreview=true when hovering and motion not reduced', () => {
    mockActive = true
    const { result } = renderHook(() => useCourseCardPreview())
    expect(result.current.showPreview).toBe(true)
  })

  it('returns showPreview=false when hovering but motion is reduced', () => {
    mockActive = true
    mockShouldReduceMotion = true
    const { result } = renderHook(() => useCourseCardPreview())
    expect(result.current.showPreview).toBe(false)
  })

  it('passes through previewHandlers from useHoverPreview', () => {
    const { result } = renderHook(() => useCourseCardPreview())
    expect(result.current.previewHandlers).toBe(mockHandlers)
  })

  it('manages previewOpen state', () => {
    const { result } = renderHook(() => useCourseCardPreview())
    expect(result.current.previewOpen).toBe(false)
    act(() => {
      result.current.setPreviewOpen(true)
    })
    expect(result.current.previewOpen).toBe(true)
  })

  it('manages videoReady state', () => {
    const { result } = renderHook(() => useCourseCardPreview())
    expect(result.current.videoReady).toBe(false)
    act(() => {
      result.current.setVideoReady(true)
    })
    expect(result.current.videoReady).toBe(true)
  })

  it('manages infoOpen state via setInfoOpen', () => {
    const { result } = renderHook(() => useCourseCardPreview())
    expect(result.current.infoOpen).toBe(false)
    act(() => {
      result.current.setInfoOpen(true)
    })
    expect(result.current.infoOpen).toBe(true)
  })

  it('setInfoOpen(false) temporarily blocks navigation (dismissing guard)', () => {
    const { result } = renderHook(() => useCourseCardPreview())

    act(() => {
      result.current.setInfoOpen(true)
    })

    act(() => {
      result.current.setInfoOpen(false)
    })

    // During dismissal window, guardNavigation prevents navigation
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent

    act(() => {
      result.current.guardNavigation(mockEvent)
    })
    expect(mockEvent.preventDefault).toHaveBeenCalled()
    expect(mockEvent.stopPropagation).toHaveBeenCalled()

    // After 200ms, navigation is no longer blocked
    act(() => {
      vi.advanceTimersByTime(200)
    })

    const mockEvent2 = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent

    act(() => {
      result.current.guardNavigation(mockEvent2)
    })
    expect(mockEvent2.preventDefault).not.toHaveBeenCalled()
  })

  it('guardNavigation allows navigation when not dismissing', () => {
    const { result } = renderHook(() => useCourseCardPreview())
    const mockEvent = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.MouseEvent

    act(() => {
      result.current.guardNavigation(mockEvent)
    })
    expect(mockEvent.preventDefault).not.toHaveBeenCalled()
  })
})
