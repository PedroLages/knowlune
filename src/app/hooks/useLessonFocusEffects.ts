/**
 * useLessonFocusEffects — Scroll-to-top and title focus on lesson change.
 *
 * When the user navigates to a new lesson:
 * 1. Scrolls the main content area to the top (instant, no animation)
 * 2. Focuses the lesson title element for screen reader announcement
 *
 * Ported from the classic LessonPlayer's inline useEffect calls.
 */

import { useEffect, type RefObject } from 'react'

export function useLessonFocusEffects(
  lessonId: string | undefined,
  titleRef: RefObject<HTMLElement | null>
): void {
  // Scroll main content to top when lesson changes
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [lessonId])

  // Focus lesson title for accessibility (preventScroll avoids undoing scroll-to-top)
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [lessonId, titleRef])
}
