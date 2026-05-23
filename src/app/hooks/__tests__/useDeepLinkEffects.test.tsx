import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { useDeepLinkEffects } from '../useDeepLinkEffects'

function renderDeepLink(path: string, props: Parameters<typeof useDeepLinkEffects>[0]) {
  return renderHook(() => useDeepLinkEffects(props), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
  })
}

describe('useDeepLinkEffects', () => {
  const setSeekToTime = vi.fn()
  const setFocusTab = vi.fn()
  const openNotesWithFocus = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls openNotesWithFocus on desktop when ?panel=notes', () => {
    renderDeepLink('/courses/c1/l1?panel=notes', {
      setSeekToTime,
      setFocusTab,
      isDesktop: true,
      openNotesWithFocus,
    })

    expect(openNotesWithFocus).toHaveBeenCalledTimes(1)
    expect(setFocusTab).not.toHaveBeenCalled()
  })

  it('calls setFocusTab only on mobile when ?panel=notes', () => {
    renderDeepLink('/courses/c1/l1?panel=notes', {
      setSeekToTime,
      setFocusTab,
      isDesktop: false,
      openNotesWithFocus,
    })

    expect(setFocusTab).toHaveBeenCalledWith('notes')
    expect(openNotesWithFocus).not.toHaveBeenCalled()
  })

  it('seeks video when ?t= is present', () => {
    renderDeepLink('/courses/c1/l1?t=42', {
      setSeekToTime,
      setFocusTab,
      isDesktop: true,
      openNotesWithFocus,
    })

    expect(setSeekToTime).toHaveBeenCalledWith(42)
  })
})
