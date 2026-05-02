import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from 'react'

let useLessonChromeStore: (typeof import('@/stores/useLessonChromeStore'))['useLessonChromeStore']

beforeEach(async () => {
  // Reset localStorage before each test
  localStorage.clear()

  // Reset module registry so store re-initializes with fresh state
  vi.resetModules()

  const mod = await import('@/stores/useLessonChromeStore')
  useLessonChromeStore = mod.useLessonChromeStore

  // Ensure store is in default state (also clears DOM attribute)
  useLessonChromeStore.getState().reset()

  // Clean up DOM
  document.documentElement.removeAttribute('data-theater-mode')
})

describe('useLessonChromeStore initial state', () => {
  it('should have default initial state', () => {
    const state = useLessonChromeStore.getState()
    expect(state.isTheater).toBe(false)
    expect(state.isReadingMode).toBe(false)
    expect(state.notesOpen).toBe(false)
    expect(state.hasNotes).toBe(false)
  })
})

describe('toggleTheater', () => {
  it('should set isTheater to true and set data-theater-mode on <html>', () => {
    act(() => {
      useLessonChromeStore.getState().toggleTheater()
    })

    const state = useLessonChromeStore.getState()
    expect(state.isTheater).toBe(true)
    expect(document.documentElement.getAttribute('data-theater-mode')).toBe('true')
  })

  it('should persist to localStorage', () => {
    act(() => {
      useLessonChromeStore.getState().toggleTheater()
    })

    expect(localStorage.getItem('lesson-theater-mode')).toBe('true')
  })

  it('should toggle back to false and remove data-theater-mode from <html>', () => {
    act(() => {
      useLessonChromeStore.getState().toggleTheater()
    })
    act(() => {
      useLessonChromeStore.getState().toggleTheater()
    })

    const state = useLessonChromeStore.getState()
    expect(state.isTheater).toBe(false)
    expect(document.documentElement.hasAttribute('data-theater-mode')).toBe(false)
    expect(localStorage.getItem('lesson-theater-mode')).toBe('false')
  })

  it('should handle rapid double-toggle consistently', () => {
    act(() => {
      useLessonChromeStore.getState().toggleTheater()
      useLessonChromeStore.getState().toggleTheater()
    })

    const state = useLessonChromeStore.getState()
    // Two toggles = back to original state
    expect(state.isTheater).toBe(false)
    expect(document.documentElement.hasAttribute('data-theater-mode')).toBe(false)
  })

  it('should read initial state from localStorage on store initialization', async () => {
    // Pre-set localStorage
    localStorage.setItem('lesson-theater-mode', 'true')

    // Reset module registry to force store re-creation
    vi.resetModules()
    const freshMod = await import('@/stores/useLessonChromeStore')
    const freshStore = freshMod.useLessonChromeStore

    const state = freshStore.getState()
    expect(state.isTheater).toBe(true)

    // Clean up
    freshStore.getState().reset()
  })
})

describe('corrupted localStorage', () => {
  it('should fall back to false when localStorage has invalid value', async () => {
    localStorage.setItem('lesson-theater-mode', 'invalid-not-boolean')

    // Reset module registry to force store re-creation with corrupted value
    vi.resetModules()
    const freshMod = await import('@/stores/useLessonChromeStore')
    const freshStore = freshMod.useLessonChromeStore

    // The store reads from localStorage at create(); non-'true' values fall back to false
    const state = freshStore.getState()
    expect(state.isTheater).toBe(false)

    // toggleTheater should still work without crashing
    expect(() => {
      act(() => {
        freshStore.getState().toggleTheater()
      })
    }).not.toThrow()

    // Clean up
    freshStore.getState().reset()
  })

  it('should handle localStorage.setItem throwing (simulated)', () => {
    // Simulate localStorage failure by overriding setItem
    const originalSetItem = localStorage.setItem.bind(localStorage)
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError')
    }

    expect(() => {
      act(() => {
        useLessonChromeStore.getState().toggleTheater()
      })
    }).not.toThrow()

    // State should still be updated even if persist fails
    expect(useLessonChromeStore.getState().isTheater).toBe(true)

    // Restore
    localStorage.setItem = originalSetItem
  })
})

describe('toggleNotes', () => {
  it('should toggle notesOpen from false to true', () => {
    act(() => {
      useLessonChromeStore.getState().toggleNotes()
    })

    expect(useLessonChromeStore.getState().notesOpen).toBe(true)
  })

  it('should toggle notesOpen from true back to false', () => {
    act(() => {
      useLessonChromeStore.getState().toggleNotes()
    })
    act(() => {
      useLessonChromeStore.getState().toggleNotes()
    })

    expect(useLessonChromeStore.getState().notesOpen).toBe(false)
  })
})

describe('hasNotes / setHasNotes', () => {
  it('should default to false', () => {
    expect(useLessonChromeStore.getState().hasNotes).toBe(false)
  })

  it('should update hasNotes via setHasNotes', () => {
    act(() => {
      useLessonChromeStore.getState().setHasNotes(true)
    })

    expect(useLessonChromeStore.getState().hasNotes).toBe(true)
  })

  it('should set hasNotes back to false', () => {
    act(() => {
      useLessonChromeStore.getState().setHasNotes(true)
    })
    act(() => {
      useLessonChromeStore.getState().setHasNotes(false)
    })

    expect(useLessonChromeStore.getState().hasNotes).toBe(false)
  })
})

describe('syncReadingMode', () => {
  it('should update isReadingMode without side effects', () => {
    act(() => {
      useLessonChromeStore.getState().syncReadingMode(true)
    })

    expect(useLessonChromeStore.getState().isReadingMode).toBe(true)
    // No DOM changes from syncReadingMode
    expect(document.documentElement.classList.contains('reading-mode')).toBe(false)
  })

  it('should update isReadingMode back to false', () => {
    act(() => {
      useLessonChromeStore.getState().syncReadingMode(true)
    })
    act(() => {
      useLessonChromeStore.getState().syncReadingMode(false)
    })

    expect(useLessonChromeStore.getState().isReadingMode).toBe(false)
  })
})

describe('toggleReadingMode', () => {
  it('should be a no-op when no callback is registered (no crash)', () => {
    expect(() => {
      act(() => {
        useLessonChromeStore.getState().toggleReadingMode()
      })
    }).not.toThrow()

    // isReadingMode should not change when no callback is registered
    expect(useLessonChromeStore.getState().isReadingMode).toBe(false)
  })

  it('should delegate to the registered callback', () => {
    let called = false
    const mockToggle = () => {
      called = true
    }

    act(() => {
      useLessonChromeStore.getState().registerReadingModeToggle(mockToggle)
    })

    act(() => {
      useLessonChromeStore.getState().toggleReadingMode()
    })

    expect(called).toBe(true)
  })

  it('should allow re-registering a different callback', () => {
    let firstCalled = false
    let secondCalled = false

    act(() => {
      useLessonChromeStore.getState().registerReadingModeToggle(() => {
        firstCalled = true
      })
    })

    act(() => {
      useLessonChromeStore.getState().registerReadingModeToggle(() => {
        secondCalled = true
      })
    })

    act(() => {
      useLessonChromeStore.getState().toggleReadingMode()
    })

    expect(firstCalled).toBe(false)
    expect(secondCalled).toBe(true)
  })
})

describe('reset', () => {
  it('should clear all state to defaults', () => {
    // Set all state to non-default values
    act(() => {
      const s = useLessonChromeStore.getState()
      s.toggleTheater()
      s.syncReadingMode(true)
      s.toggleNotes()
      s.setHasNotes(true)
    })

    act(() => {
      useLessonChromeStore.getState().reset()
    })

    const state = useLessonChromeStore.getState()
    expect(state.isTheater).toBe(false)
    expect(state.isReadingMode).toBe(false)
    expect(state.notesOpen).toBe(false)
    expect(state.hasNotes).toBe(false)
  })

  it('should remove data-theater-mode from <html>', () => {
    act(() => {
      useLessonChromeStore.getState().toggleTheater()
    })

    expect(document.documentElement.getAttribute('data-theater-mode')).toBe('true')

    act(() => {
      useLessonChromeStore.getState().reset()
    })

    expect(document.documentElement.hasAttribute('data-theater-mode')).toBe(false)
  })

  it('should clear the registered reading mode toggle callback', () => {
    let called = false
    act(() => {
      useLessonChromeStore.getState().registerReadingModeToggle(() => {
        called = true
      })
    })

    act(() => {
      useLessonChromeStore.getState().reset()
    })

    act(() => {
      useLessonChromeStore.getState().toggleReadingMode()
    })

    expect(called).toBe(false)
  })
})

describe('integration: useTheaterMode hook', () => {
  it('should return the same isTheater value as store selector', async () => {
    const { renderHook } = await import('@testing-library/react')
    const { useTheaterMode } = await import('@/app/hooks/useTheaterMode')

    // Set theater mode via the store
    act(() => {
      useLessonChromeStore.getState().toggleTheater()
    })

    // The hook reads from the same store
    const { result } = renderHook(() => useTheaterMode())
    expect(result.current.isTheater).toBe(true)

    // toggleTheater from the hook calls the store's toggleTheater
    act(() => {
      result.current.toggleTheater()
    })

    expect(useLessonChromeStore.getState().isTheater).toBe(false)
  })
})
