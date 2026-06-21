import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useShelfScrollAffordances } from '@/app/hooks/useShelfScrollAffordances'
import type { RefObject } from 'react'

function mockScroller(
  el: HTMLDivElement,
  dims: { scrollWidth: number; clientWidth: number; scrollLeft: number }
) {
  Object.defineProperty(el, 'scrollWidth', { value: dims.scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: dims.clientWidth, configurable: true })
  Object.defineProperty(el, 'scrollLeft', {
    value: dims.scrollLeft,
    configurable: true,
    writable: true,
  })
}

describe('useShelfScrollAffordances', () => {
  let moCallback: (() => void) | null = null

  beforeEach(() => {
    moCallback = null
    global.ResizeObserver = class {
      observe = vi.fn()
      disconnect = vi.fn()
    } as unknown as typeof ResizeObserver

    global.MutationObserver = class {
      observe = vi.fn()
      disconnect = vi.fn()
      constructor(cb: () => void) {
        moCallback = cb
      }
    } as unknown as typeof MutationObserver
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports hasOverflow and canScrollRight when content is wider than viewport', () => {
    const el = document.createElement('div')
    mockScroller(el, { scrollWidth: 900, clientWidth: 300, scrollLeft: 0 })
    const ref: RefObject<HTMLDivElement | null> = { current: el }

    const { result } = renderHook(() => useShelfScrollAffordances(ref, 1))

    expect(result.current.hasOverflow).toBe(true)
    expect(result.current.canScrollLeft).toBe(false)
    expect(result.current.canScrollRight).toBe(true)
  })

  it('updates after update() when scrollLeft moves to end', () => {
    const el = document.createElement('div')
    mockScroller(el, { scrollWidth: 900, clientWidth: 300, scrollLeft: 0 })
    const ref: RefObject<HTMLDivElement | null> = { current: el }

    const { result } = renderHook(() => useShelfScrollAffordances(ref, 1))

    act(() => {
      mockScroller(el, { scrollWidth: 900, clientWidth: 300, scrollLeft: 600 })
      result.current.update()
    })

    expect(result.current.canScrollRight).toBe(false)
    expect(result.current.canScrollLeft).toBe(true)
  })

  it('hasOverflow false when row fits', () => {
    const el = document.createElement('div')
    mockScroller(el, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    const ref: RefObject<HTMLDivElement | null> = { current: el }

    const { result } = renderHook(() => useShelfScrollAffordances(ref, 1))

    expect(result.current.hasOverflow).toBe(false)
  })

  it('remeasures when an img inside the scroller fires load', () => {
    const el = document.createElement('div')
    mockScroller(el, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 })
    const ref: RefObject<HTMLDivElement | null> = { current: el }

    const { result } = renderHook(() => useShelfScrollAffordances(ref, 1))

    expect(result.current.hasOverflow).toBe(false)

    const img = document.createElement('img')
    el.appendChild(img)

    act(() => {
      moCallback?.()
    })

    act(() => {
      mockScroller(el, { scrollWidth: 900, clientWidth: 300, scrollLeft: 0 })
      img.dispatchEvent(new Event('load'))
    })

    expect(result.current.hasOverflow).toBe(true)
  })
})
