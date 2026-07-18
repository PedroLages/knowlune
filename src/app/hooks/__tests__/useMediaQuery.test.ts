import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsDesktop, useIsMobile, useIsTablet } from '../useMediaQuery'

function matchesWidth(query: string, width: number): boolean {
  const min = query.match(/min-width:\s*(\d+)px/)
  const max = query.match(/max-width:\s*(\d+)px/)
  return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]))
}

function setViewportWidth(width: number) {
  const matchMedia = vi.fn((query: string) => ({
    matches: matchesWidth(query, width),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia })
}

beforeEach(() => setViewportWidth(1024))

describe('app-shell media queries', () => {
  it('uses the sidebar sheet at 1024px', () => {
    const { result } = renderHook(() => ({ tablet: useIsTablet(), desktop: useIsDesktop() }))
    expect(result.current).toEqual({ tablet: true, desktop: false })
  })

  it('starts persistent desktop navigation at exactly 1280px', () => {
    setViewportWidth(1280)
    const { result } = renderHook(() => ({ tablet: useIsTablet(), desktop: useIsDesktop() }))
    expect(result.current).toEqual({ tablet: false, desktop: true })
  })

  it('keeps the mobile breakpoint below 640px', () => {
    setViewportWidth(639)
    const { result } = renderHook(() => ({ mobile: useIsMobile(), tablet: useIsTablet() }))
    expect(result.current).toEqual({ mobile: true, tablet: false })
  })
})
