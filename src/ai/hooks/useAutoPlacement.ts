/**
 * Auto-Placement Hook
 *
 * Manages the async placement lifecycle when a course is added to a path.
 * The course appears at the end immediately, then the AI suggestion loads
 * asynchronously. If the response arrives within 2 seconds, the caller
 * should animate to the suggested position. If slower, a badge appears.
 *
 * @module
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { PathPlacementSuggestion } from '@/ai/learningPath/suggestPlacement'
import { isPathPlacementAvailable } from '@/ai/learningPath/suggestPlacement'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import type { UserPreferences } from '@/hooks/useUserPreferences'

/** State returned by the hook */
export interface AutoPlacementState {
  /** Whether the placement suggestion is currently loading */
  isLoading: boolean
  /** The AI suggestion (null if not yet ready or error) */
  suggestion: PathPlacementSuggestion | null
  /** Milliseconds elapsed since trigger (for 2-second threshold) */
  elapsedMs: number
  /** Whether the suggestion arrived within the 2-second window */
  isWithinAnimationWindow: boolean
  /** Whether loading is complete (success or error) */
  hasFetched: boolean
  /** Error message if suggestion failed */
  error: string | null
  /** Manually trigger a fetch */
  trigger: () => void
  /** Accept the suggested position */
  accept: () => void
  /** Dismiss the suggestion (user dragged or explicitly dismissed) */
  dismiss: () => void
}

/**
 * Hook that fetches AI placement suggestion for a course just added to a path.
 *
 * @param pathId - The target path ID
 * @param courseId - The course that was just added
 * @param courseName - Course name for AI context
 * @param courseTags - Course tags for AI context
 * @param preferences - User preferences for personalization (null if not ready)
 * @param enabled - Whether to fetch (true after course is added)
 */
export function useAutoPlacement(
  pathId: string,
  courseId: string,
  courseName: string,
  courseTags: string[],
  preferences: UserPreferences | null,
  enabled: boolean
): AutoPlacementState {
  const [isLoading, setIsLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<PathPlacementSuggestion | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [retryCount, setRetryCount] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const startTimeRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const acceptedRef = useRef(false)
  const dismissedRef = useRef(false)

  const { paths, getEntriesForPath } = useLearningPathStore()

  const trigger = useCallback(() => {
    setSuggestion(null)
    setHasFetched(false)
    setError(null)
    setElapsedMs(0)
    acceptedRef.current = false
    dismissedRef.current = false
    setRetryCount(c => c + 1)
  }, [])

  const accept = useCallback(() => {
    if (!suggestion) return
    acceptedRef.current = true
    const store = useLearningPathStore.getState()
    store.applyPlacementSuggestion(pathId, courseId, suggestion.position, suggestion.justification)
    setSuggestion(null)
    setElapsedMs(0)
  }, [suggestion, pathId, courseId])

  const dismiss = useCallback(() => {
    dismissedRef.current = true
    setSuggestion(null)
    setElapsedMs(0)
  }, [])

  useEffect(() => {
    if (!enabled || !isPathPlacementAvailable() || !courseName.trim()) {
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let cancelled = false
    setIsLoading(true)
    setError(null)
    startTimeRef.current = Date.now()

    // Start elapsed timer
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current > 0) {
        setElapsedMs(Date.now() - startTimeRef.current)
      }
    }, 100)

    async function fetchSuggestion() {
      try {
        const courseNames = new Map<string, string>()
        const store = useLearningPathStore.getState()
        // Build course name map from store entries
        for (const entry of store.entries) {
          if (!courseNames.has(entry.courseId)) {
            courseNames.set(entry.courseId, '') // Will be resolved below
          }
        }

        // Build path contexts — constrained to the target path
        const allPathContexts = paths.map(path => ({
          path,
          entries: getEntriesForPath(path.id),
        }))

        const constrained = allPathContexts.filter(ctx => ctx.path.id === pathId)
        const pathContexts = constrained.length > 0 ? constrained : allPathContexts

        // Use personalized suggestPlacement if preferences are ready
        const { personalizedSuggestPlacement } =
          await import('@/ai/learningPath/personalizedSuggestPlacement')

        const result = await personalizedSuggestPlacement(
          { name: courseName, tags: courseTags },
          pathContexts,
          courseNames,
          preferences,
          !!preferences,
          controller.signal
        )

        if (!cancelled && !dismissedRef.current) {
          setSuggestion(result)
          setHasFetched(true)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled && !dismissedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to get suggestion')
          setHasFetched(true)
          setIsLoading(false)
        }
      }
    }

    fetchSuggestion()

    return () => {
      cancelled = true
      controller.abort()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, pathId, courseName, courseTags, retryCount, paths, getEntriesForPath, preferences])

  return {
    isLoading,
    suggestion,
    elapsedMs,
    isWithinAnimationWindow: elapsedMs <= 2000 && suggestion !== null,
    hasFetched,
    error,
    trigger,
    accept,
    dismiss,
  }
}
