import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useProgressiveDisclosure,
  unlockSidebarItem,
  type DisclosureKey,
} from '../useProgressiveDisclosure'

describe('useProgressiveDisclosure', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('starts with no items unlocked', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    expect(result.current.unlocked.size).toBe(0)
    expect(result.current.showAll).toBe(false)
  })

  it('loads persisted unlocked keys from localStorage', () => {
    localStorage.setItem(
      'knowlune-sidebar-disclosure-v1',
      JSON.stringify(['course-imported', 'note-created'])
    )
    const { result } = renderHook(() => useProgressiveDisclosure())
    expect(result.current.unlocked.has('course-imported')).toBe(true)
    expect(result.current.unlocked.has('note-created')).toBe(true)
  })

  it('loads persisted showAll from localStorage', () => {
    localStorage.setItem('knowlune-sidebar-show-all-v1', 'true')
    const { result } = renderHook(() => useProgressiveDisclosure())
    expect(result.current.showAll).toBe(true)
  })

  it('unlock() adds a key to unlocked set', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    act(() => {
      result.current.unlock('course-imported')
    })
    expect(result.current.unlocked.has('course-imported')).toBe(true)
  })

  it('unlock() is idempotent', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    act(() => {
      result.current.unlock('course-imported')
      result.current.unlock('course-imported')
    })
    expect(result.current.unlocked.size).toBe(1)
  })

  it('toggleShowAll updates showAll state', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    act(() => {
      result.current.toggleShowAll(true)
    })
    expect(result.current.showAll).toBe(true)
    expect(localStorage.getItem('knowlune-sidebar-show-all-v1')).toBe('true')
  })

  it('isVisible returns true for items without disclosure key', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    expect(result.current.isVisible(undefined)).toBe(true)
  })

  it('isVisible returns false for locked items', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    expect(result.current.isVisible('course-imported')).toBe(false)
  })

  it('isVisible returns true for unlocked items', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    act(() => {
      result.current.unlock('course-imported')
    })
    expect(result.current.isVisible('course-imported')).toBe(true)
  })

  it('isVisible returns true for all items when showAll is true', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    act(() => {
      result.current.toggleShowAll(true)
    })
    expect(result.current.isVisible('ai-used')).toBe(true)
  })

  it('filterGroups removes invisible items', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    const groups = [
      {
        label: 'Main',
        items: [
          { label: 'Home', path: '/', disclosureKey: undefined },
          { label: 'Authors', path: '/authors', disclosureKey: 'course-imported' as DisclosureKey },
        ],
      },
    ]

    const filtered = result.current.filterGroups(groups as never[])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].items).toHaveLength(1)
    expect(filtered[0].items[0].label).toBe('Home')
  })

  it('filterGroups removes empty groups', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    const groups = [
      {
        label: 'AI',
        items: [
          { label: 'AI Path', path: '/ai', disclosureKey: 'ai-used' as DisclosureKey },
        ],
      },
    ]

    const filtered = result.current.filterGroups(groups as never[])
    expect(filtered).toHaveLength(0)
  })

  it('responds to sidebar-unlock custom event', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())
    act(() => {
      window.dispatchEvent(
        new CustomEvent('sidebar-unlock', { detail: 'lesson-completed' })
      )
    })
    expect(result.current.unlocked.has('lesson-completed')).toBe(true)
  })

  it('responds to disclosureUpdated event', () => {
    const { result } = renderHook(() => useProgressiveDisclosure())

    // Directly change localStorage and fire event
    localStorage.setItem('knowlune-sidebar-show-all-v1', 'true')
    act(() => {
      window.dispatchEvent(new Event('disclosureUpdated'))
    })
    expect(result.current.showAll).toBe(true)
  })
})

describe('unlockSidebarItem', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists key to localStorage', () => {
    unlockSidebarItem('course-imported')
    const stored = JSON.parse(localStorage.getItem('knowlune-sidebar-disclosure-v1')!)
    expect(stored).toContain('course-imported')
  })

  it('dispatches sidebar-unlock event', () => {
    const listener = vi.fn()
    window.addEventListener('sidebar-unlock', listener)
    unlockSidebarItem('note-created')
    expect(listener).toHaveBeenCalled()
    window.removeEventListener('sidebar-unlock', listener)
  })

  it('is idempotent', () => {
    unlockSidebarItem('course-imported')
    unlockSidebarItem('course-imported')
    const stored = JSON.parse(localStorage.getItem('knowlune-sidebar-disclosure-v1')!)
    expect(stored.filter((k: string) => k === 'course-imported')).toHaveLength(1)
  })
})
