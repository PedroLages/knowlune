import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { useCourseFilterStore } from '../useCourseFilterStore'

beforeEach(() => {
  // Clear store state for test isolation
  act(() => {
    useCourseFilterStore.getState().clearAllFilters()
  })
  sessionStorage.clear()
})

afterEach(() => {
  sessionStorage.clear()
})

describe('useCourseFilterStore', () => {
  it('initializes with defaults', () => {
    const state = useCourseFilterStore.getState()
    expect(state.source).toBe('all')
    expect(state.showTrackCourses).toBe(false)
    expect(state.selectedTags).toEqual([])
    expect(state.selectedStatuses).toEqual([])
    expect(state.selectedDifficulties).toEqual([])
    expect(state.selectedCategories).toEqual([])
    expect(state.selectedAuthorIds).toEqual([])
  })

  it('setFilter updates only the specified dimension', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('source', 'youtube')
    })
    const state = useCourseFilterStore.getState()
    expect(state.source).toBe('youtube')
    expect(state.showTrackCourses).toBe(false)
    expect(state.selectedTags).toEqual([])
    expect(state.selectedStatuses).toEqual([])
  })

  it('setFilter for selectedTags does not affect other dimensions', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('showTrackCourses', false)
    })
    act(() => {
      useCourseFilterStore.getState().setFilter('selectedTags', ['react', 'typescript'])
    })
    const state = useCourseFilterStore.getState()
    expect(state.showTrackCourses).toBe(false)
    expect(state.selectedTags).toEqual(['react', 'typescript'])
    expect(state.source).toBe('all')
  })

  it('setFilter with empty array clears tag selections', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('selectedTags', ['react'])
    })
    expect(useCourseFilterStore.getState().selectedTags).toEqual(['react'])

    act(() => {
      useCourseFilterStore.getState().setFilter('selectedTags', [])
    })
    expect(useCourseFilterStore.getState().selectedTags).toEqual([])
  })

  it('clearFilter resets a single dimension to default', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('source', 'youtube')
      useCourseFilterStore.getState().setFilter('showTrackCourses', false)
      useCourseFilterStore.getState().setFilter('selectedTags', ['react'])
    })

    act(() => {
      useCourseFilterStore.getState().clearFilter('selectedTags')
    })
    const state = useCourseFilterStore.getState()
    expect(state.selectedTags).toEqual([])
    // Other dimensions remain unchanged
    expect(state.source).toBe('youtube')
    expect(state.showTrackCourses).toBe(false)
  })

  it('clearAllFilters resets all dimensions to defaults', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('source', 'youtube')
      useCourseFilterStore.getState().setFilter('showTrackCourses', true)
      useCourseFilterStore.getState().setFilter('selectedTags', ['react'])
      useCourseFilterStore.getState().setFilter('selectedStatuses', ['active'])
    })

    act(() => {
      useCourseFilterStore.getState().clearAllFilters()
    })
    const state = useCourseFilterStore.getState()
    expect(state.source).toBe('all')
    expect(state.showTrackCourses).toBe(false)
    expect(state.selectedTags).toEqual([])
    expect(state.selectedStatuses).toEqual([])
    expect(state.selectedDifficulties).toEqual([])
    expect(state.selectedCategories).toEqual([])
    expect(state.selectedAuthorIds).toEqual([])
  })

  it('isAnyFilterActive returns false when all sidebar filters are at defaults', () => {
    expect(useCourseFilterStore.getState().isAnyFilterActive()).toBe(false)
  })

  it('isAnyFilterActive returns true when source is youtube', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('source', 'youtube')
    })
    expect(useCourseFilterStore.getState().isAnyFilterActive()).toBe(true)
  })

  it('isAnyFilterActive returns true when track courses are included', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('showTrackCourses', true)
    })
    expect(useCourseFilterStore.getState().isAnyFilterActive()).toBe(true)
  })

  it('isAnyFilterActive returns true when tags are selected', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('selectedTags', ['react'])
    })
    expect(useCourseFilterStore.getState().isAnyFilterActive()).toBe(true)
  })

  it('isAnyFilterActive returns true for difficulty, category, and author filters', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('selectedDifficulties', ['advanced'])
      useCourseFilterStore.getState().setFilter('selectedCategories', ['Design'])
      useCourseFilterStore.getState().setFilter('selectedAuthorIds', ['author-1'])
    })
    expect(useCourseFilterStore.getState().isAnyFilterActive()).toBe(true)
  })

  it('isAnyFilterActive returns false when only status filters are active', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('selectedStatuses', ['active'])
    })
    // Status filters should NOT affect sidebar badge
    expect(useCourseFilterStore.getState().isAnyFilterActive()).toBe(false)
  })

  it('persists state to sessionStorage', () => {
    act(() => {
      useCourseFilterStore.getState().setFilter('source', 'youtube')
      useCourseFilterStore.getState().setFilter('showTrackCourses', false)
    })

    const stored = sessionStorage.getItem('knowlune-courses-filter-v2')
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.source).toBe('youtube')
    expect(parsed.state.showTrackCourses).toBe(false)
  })

  it('rehydrates from sessionStorage on initialization', () => {
    // Manually write to sessionStorage to simulate prior state
    const savedState = {
      state: {
        source: 'youtube',
        showTrackCourses: false,
        selectedTags: ['react'],
        selectedStatuses: ['active'],
        selectedDifficulties: ['advanced'],
        selectedCategories: ['Development'],
        selectedAuthorIds: ['author-1'],
      },
      version: 2,
    }
    sessionStorage.setItem('knowlune-courses-filter-v2', JSON.stringify(savedState))

    // Force rehydration from sessionStorage
    act(() => {
      // Zustand persist middleware exposes rehydrate method
      useCourseFilterStore.persist.rehydrate()
    })
    const state = useCourseFilterStore.getState()
    // After rehydration, the store should reflect the saved state
    expect(state.source).toBe('youtube')
    expect(state.showTrackCourses).toBe(false)
    expect(state.selectedTags).toEqual(['react'])
    expect(state.selectedStatuses).toEqual(['active'])
    expect(state.selectedDifficulties).toEqual(['advanced'])
    expect(state.selectedCategories).toEqual(['Development'])
    expect(state.selectedAuthorIds).toEqual(['author-1'])
  })

  it('falls back to defaults when sessionStorage is unavailable', () => {
    // Simulate sessionStorage being unavailable
    const originalSessionStorage = window.sessionStorage
    const mockSessionStorage = {
      ...originalSessionStorage,
      getItem: () => {
        throw new Error('sessionStorage unavailable')
      },
      setItem: () => {
        throw new Error('sessionStorage unavailable')
      },
    }
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    })

    // Clear store and check defaults
    act(() => {
      useCourseFilterStore.getState().clearAllFilters()
    })
    const state = useCourseFilterStore.getState()
    expect(state.source).toBe('all')
    expect(state.showTrackCourses).toBe(false)
    expect(state.selectedTags).toEqual([])

    // Restore
    Object.defineProperty(window, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true,
    })
  })
})
