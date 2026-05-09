import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useManualModuleCompletion } from '@/app/hooks/useManualModuleCompletion'

const TRACK_ID = 'test-track-123'
const STORAGE_KEY = 'track-manual-completions-test-track-123'

describe('useManualModuleCompletion', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty set initially when nothing is stored', () => {
    const { result } = renderHook(() => useManualModuleCompletion(TRACK_ID))
    expect(result.current.completedIds.size).toBe(0)
    expect(result.current.isManuallyCompleted('entry-1')).toBe(false)
  })

  it('markComplete adds entry ID to set and persists to localStorage', () => {
    const { result } = renderHook(() => useManualModuleCompletion(TRACK_ID))

    act(() => {
      result.current.markComplete('entry-1')
    })

    expect(result.current.completedIds.has('entry-1')).toBe(true)
    expect(result.current.isManuallyCompleted('entry-1')).toBe(true)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored).toContain('entry-1')
  })

  it('undoComplete removes entry ID from set and updates localStorage', () => {
    const { result } = renderHook(() => useManualModuleCompletion(TRACK_ID))

    act(() => {
      result.current.markComplete('entry-1')
    })

    act(() => {
      result.current.undoComplete('entry-1')
    })

    expect(result.current.completedIds.has('entry-1')).toBe(false)
    expect(result.current.isManuallyCompleted('entry-1')).toBe(false)

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored).not.toContain('entry-1')
  })

  it('tracks multiple entries independently', () => {
    const { result } = renderHook(() => useManualModuleCompletion(TRACK_ID))

    act(() => {
      result.current.markComplete('entry-1')
      result.current.markComplete('entry-2')
    })

    expect(result.current.completedIds.size).toBe(2)
    expect(result.current.isManuallyCompleted('entry-1')).toBe(true)
    expect(result.current.isManuallyCompleted('entry-2')).toBe(true)

    act(() => {
      result.current.undoComplete('entry-1')
    })

    expect(result.current.isManuallyCompleted('entry-1')).toBe(false)
    expect(result.current.isManuallyCompleted('entry-2')).toBe(true)
  })

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{')

    const { result } = renderHook(() => useManualModuleCompletion(TRACK_ID))

    expect(result.current.completedIds.size).toBe(0)
  })

  it('handles non-array stored value gracefully', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: 'an-array' }))

    const { result } = renderHook(() => useManualModuleCompletion(TRACK_ID))

    expect(result.current.completedIds.size).toBe(0)
  })

  it('loads existing data from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['entry-1', 'entry-2']))

    const { result } = renderHook(() => useManualModuleCompletion(TRACK_ID))

    expect(result.current.completedIds.has('entry-1')).toBe(true)
    expect(result.current.completedIds.has('entry-2')).toBe(true)
    expect(result.current.completedIds.size).toBe(2)
  })

  it('is a no-op for empty trackId', () => {
    const { result } = renderHook(() => useManualModuleCompletion(''))

    expect(result.current.completedIds.size).toBe(0)

    act(() => {
      result.current.markComplete('entry-1')
    })

    expect(result.current.completedIds.size).toBe(1)
    expect(result.current.isManuallyCompleted('entry-1')).toBe(true)
  })
})
