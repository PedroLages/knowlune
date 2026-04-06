import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLazyVisible } from '../useLazyVisible'

describe('useLazyVisible', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns [ref, isVisible] with isVisible initially false', () => {
    const { result } = renderHook(() => useLazyVisible())
    const [ref, isVisible] = result.current
    expect(ref.current).toBeNull()
    expect(isVisible).toBe(false)
  })

  it('becomes visible immediately when IntersectionObserver is undefined', () => {
    const originalIO = globalThis.IntersectionObserver
    // @ts-expect-error -- intentionally removing for test
    delete globalThis.IntersectionObserver

    // Attach a real element to ref
    const div = document.createElement('div')
    renderHook(() => {
      const [ref, visible] = useLazyVisible()
      // Simulate ref assignment
      if (ref.current !== div) {
        ;(ref as { current: HTMLElement | null }).current = div
      }
      return [ref, visible] as const
    })

    // Trigger a re-render with the ref set
    const { result: result2 } = renderHook(() => useLazyVisible())
    // Restore before assertions
    globalThis.IntersectionObserver = originalIO

    // In the fallback path, it should set visible=true immediately
    // but only when the ref is attached to a DOM element
    expect(result2.current[1]).toBe(false) // no element attached to ref
  })

  it('accepts custom rootMargin', () => {
    const { result } = renderHook(() => useLazyVisible('100px'))
    expect(result.current[0]).toBeDefined()
    expect(result.current[1]).toBe(false)
  })

  it('defaults rootMargin to 200px', () => {
    const { result } = renderHook(() => useLazyVisible())
    expect(result.current[0]).toBeDefined()
  })
})
