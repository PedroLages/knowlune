import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLessonItemCompletionStatus } from '@/app/hooks/useLessonItemCompletionStatus'
import { useContentProgressStore } from '@/stores/useContentProgressStore'

describe('useLessonItemCompletionStatus', () => {
  beforeEach(() => {
    useContentProgressStore.setState({
      statusMap: {},
      isLoading: false,
      error: null,
    })
  })

  it('returns not-started when course or lesson id is missing', () => {
    const { result } = renderHook(() => useLessonItemCompletionStatus(undefined, 'l1'))
    expect(result.current).toBe('not-started')
  })

  it('returns not-started when map has no entry', () => {
    const { result } = renderHook(() => useLessonItemCompletionStatus('c1', 'l1'))
    expect(result.current).toBe('not-started')
  })

  it('updates when statusMap gains an entry for the lesson key', () => {
    const { result } = renderHook(() => useLessonItemCompletionStatus('c1', 'l1'))

    act(() => {
      useContentProgressStore.setState({
        statusMap: { 'c1:l1': 'in-progress' },
      })
    })

    expect(result.current).toBe('in-progress')
  })
})
