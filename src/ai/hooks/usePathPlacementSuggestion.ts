/**
 * Hook for AI-powered path placement suggestions during course import.
 *
 * Automatically fetches a placement suggestion when a scanned course
 * is available and learning paths exist.
 *
 * @module
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  isPathPlacementAvailable,
  suggestPathPlacement,
  type PathPlacementSuggestion,
} from '@/ai/learningPath/suggestPlacement'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
// db import removed (E89-S01) — catalog courses table dropped
// Course type import removed (E89-S01) — catalog courses table dropped

/** State returned by the hook */
export interface PathPlacementState {
  /** Whether AI placement is available */
  isAvailable: boolean
  /** Whether AI is currently generating a suggestion */
  isLoading: boolean
  /** The AI suggestion (null if not ready) */
  suggestion: PathPlacementSuggestion | null
  /** Whether a suggestion has been fetched */
  hasFetched: boolean
  /** Error message if suggestion failed */
  error: string | null
  /** Whether there are paths to suggest placement in */
  hasExistingPaths: boolean
  /** Retry the suggestion */
  retry: () => void
}

/**
 * Hook that fetches AI path placement suggestion for a course being imported.
 *
 * @param courseName - Name of the course being imported
 * @param courseTags - Tags for the course
 * @param courseDescription - Optional description
 * @param enabled - Whether to fetch (typically true when on the path step)
 * @param targetPathId - Optional pre-selected path ID — constrains AI suggestion to this path
 */
export function usePathPlacementSuggestion(
  courseName: string,
  courseTags: string[],
  courseDescription: string,
  enabled: boolean,
  targetPathId?: string
): PathPlacementState {
  const [isLoading, setIsLoading] = useState(false)
  const [suggestion, setSuggestion] = useState<PathPlacementSuggestion | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const { paths, getEntriesForPath } = useLearningPathStore()
  const { importedCourses } = useCourseImportStore()

  const isAvailable = isPathPlacementAvailable()
  const userPaths = useMemo(() => paths.filter(path => !path.isTemplate), [paths])
  const hasExistingPaths = userPaths.length > 0

  const retry = useCallback(() => {
    setSuggestion(null)
    setHasFetched(false)
    setError(null)
    setRetryCount(c => c + 1)
  }, [])

  useEffect(() => {
    if (!enabled || !isAvailable || !hasExistingPaths || !courseName.trim()) {
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let cancelled = false
    setIsLoading(true)
    setError(null)

    async function fetchSuggestion() {
      try {
        // Build course name map for existing path entries
        const courseNames = new Map<string, string>()
        for (const ic of importedCourses) {
          courseNames.set(ic.id, ic.name)
        }

        // Catalog courses table dropped (E89-S01) — no catalog course names to load

        // Build path contexts — filter to target path if provided (R3 constrained context)
        let allPathContexts = userPaths.map(path => ({
          path,
          entries: getEntriesForPath(path.id),
        }))

        if (targetPathId) {
          const constrained = allPathContexts.filter(ctx => ctx.path.id === targetPathId)
          if (constrained.length > 0) {
            allPathContexts = constrained
          }
          // Graceful degradation: if targetPathId doesn't match any path, use all paths
        }

        const result = await suggestPathPlacement(
          { name: courseName, tags: courseTags, description: courseDescription },
          allPathContexts,
          courseNames,
          controller.signal
        )

        if (!cancelled) {
          setSuggestion(result)
          setHasFetched(true)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
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
    }
  }, [
    enabled,
    isAvailable,
    hasExistingPaths,
    courseName,
    retryCount,
    userPaths,
    getEntriesForPath,
    importedCourses,
    courseTags,
    courseDescription,
    targetPathId,
  ])

  return {
    isAvailable,
    isLoading,
    suggestion,
    hasFetched,
    error,
    hasExistingPaths,
    retry,
  }
}
