import { useCallback } from 'react'
import type { CompletionStatus } from '@/data/types'
import { useContentProgressStore } from '@/stores/useContentProgressStore'

/** Stable key for `useContentProgressStore` `statusMap` entries — matches store internals. */
export function contentProgressItemKey(courseId: string, itemId: string): string {
  return `${courseId}:${itemId}`
}

/**
 * Subscribe to completion status for a single lesson row so the component re-renders
 * when `statusMap` updates (unlike `useContentProgressStore(s => s.getItemStatus)`, which
 * returns a stable function reference and does not trigger re-renders).
 */
export function useLessonItemCompletionStatus(
  courseId: string | undefined,
  lessonId: string | undefined
): CompletionStatus {
  const selector = useCallback(
    (state: { statusMap: Record<string, CompletionStatus> }) => {
      if (!courseId || !lessonId) return 'not-started'
      return state.statusMap[contentProgressItemKey(courseId, lessonId)] ?? 'not-started'
    },
    [courseId, lessonId]
  )
  return useContentProgressStore(selector)
}
