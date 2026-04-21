/**
 * Tests for useDeepLinkFocus hook — E97-S05 Unit 4.
 *
 * @since E97-S05
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import React from 'react'

// We need to use MemoryRouter with a custom setup to test searchParams
// Create a wrapper that renders with a URL that has the focus param.

function makeWrapper(initialUrl: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route path="*" element={<>{children}</>} />
        </Routes>
      </MemoryRouter>
    )
  }
}

import { useDeepLinkFocus } from '@/app/hooks/useDeepLinkFocus'

describe('useDeepLinkFocus', () => {
  it('happy path: ?focus=opds:abc123 with kind=opds → onFocus called with abc123', () => {
    const onFocus = vi.fn()

    renderHook(
      () => useDeepLinkFocus('opds', onFocus),
      { wrapper: makeWrapper('/library?focus=opds:abc123') }
    )

    expect(onFocus).toHaveBeenCalledWith('abc123')
    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('wrong kind: ?focus=abs:xyz with kind=opds → onFocus NOT called', () => {
    const onFocus = vi.fn()

    renderHook(
      () => useDeepLinkFocus('opds', onFocus),
      { wrapper: makeWrapper('/library?focus=abs:xyz') }
    )

    expect(onFocus).not.toHaveBeenCalled()
  })

  it('no focus param → onFocus NOT called', () => {
    const onFocus = vi.fn()

    renderHook(
      () => useDeepLinkFocus('opds', onFocus),
      { wrapper: makeWrapper('/library') }
    )

    expect(onFocus).not.toHaveBeenCalled()
  })

  it('re-render without URL change → onFocus not re-called (ref guard)', () => {
    const onFocus = vi.fn()

    const { rerender } = renderHook(
      ({ kind }) => useDeepLinkFocus(kind, onFocus),
      {
        wrapper: makeWrapper('/library?focus=opds:abc123'),
        initialProps: { kind: 'opds' as const },
      }
    )

    expect(onFocus).toHaveBeenCalledTimes(1)

    rerender({ kind: 'opds' })

    expect(onFocus).toHaveBeenCalledTimes(1)
  })

  it('coexistence: useDeepLinkFocus(opds) does not interfere with ?t= param from lesson player', () => {
    const onFocus = vi.fn()

    // Lesson player-style params alongside the focus param for a different kind
    renderHook(
      () => useDeepLinkFocus('opds', onFocus),
      { wrapper: makeWrapper('/lesson?t=30&panel=notes') }
    )

    // No focus param → no call
    expect(onFocus).not.toHaveBeenCalled()
  })

  it('abs kind: ?focus=abs:server-id → onFocus called for abs', () => {
    const onFocus = vi.fn()

    renderHook(
      () => useDeepLinkFocus('abs', onFocus),
      { wrapper: makeWrapper('/library?focus=abs:server-id') }
    )

    expect(onFocus).toHaveBeenCalledWith('server-id')
  })
})
