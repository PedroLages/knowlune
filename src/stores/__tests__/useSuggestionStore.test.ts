import { describe, it, expect, beforeEach } from 'vitest'
import { act } from 'react'
import { useSuggestionStore } from '../useSuggestionStore'

beforeEach(() => {
  act(() => {
    useSuggestionStore.getState().reset()
  })
})

describe('useSuggestionStore', () => {
  it('has empty dismissed map on init', () => {
    const { dismissed } = useSuggestionStore.getState()
    expect(dismissed).toEqual({})
  })

  it('isDismissed returns false for unknown courseId', () => {
    const { isDismissed } = useSuggestionStore.getState()
    expect(isDismissed('unknown-course')).toBe(false)
  })

  it('dismiss marks a course as dismissed', () => {
    act(() => {
      useSuggestionStore.getState().dismiss('course-1')
    })
    expect(useSuggestionStore.getState().isDismissed('course-1')).toBe(true)
  })

  it('dismiss is idempotent — calling twice has no extra effect', () => {
    act(() => {
      useSuggestionStore.getState().dismiss('course-1')
      useSuggestionStore.getState().dismiss('course-1')
    })
    const { dismissed } = useSuggestionStore.getState()
    expect(Object.keys(dismissed).filter(k => k === 'course-1')).toHaveLength(1)
    expect(dismissed['course-1']).toBe(true)
  })

  it('isDismissed returns false for a different courseId', () => {
    act(() => {
      useSuggestionStore.getState().dismiss('course-1')
    })
    expect(useSuggestionStore.getState().isDismissed('course-2')).toBe(false)
  })

  it('can dismiss multiple courses independently', () => {
    act(() => {
      useSuggestionStore.getState().dismiss('course-a')
      useSuggestionStore.getState().dismiss('course-b')
    })
    const state = useSuggestionStore.getState()
    expect(state.isDismissed('course-a')).toBe(true)
    expect(state.isDismissed('course-b')).toBe(true)
    expect(state.isDismissed('course-c')).toBe(false)
  })

  it('reset clears all dismissed entries', () => {
    act(() => {
      useSuggestionStore.getState().dismiss('course-x')
    })
    expect(useSuggestionStore.getState().isDismissed('course-x')).toBe(true)

    act(() => {
      useSuggestionStore.getState().reset()
    })
    expect(useSuggestionStore.getState().isDismissed('course-x')).toBe(false)
    expect(useSuggestionStore.getState().dismissed).toEqual({})
  })
})
