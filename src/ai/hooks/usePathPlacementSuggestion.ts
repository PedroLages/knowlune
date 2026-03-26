/**
 * Hook for AI-powered path placement suggestions during course import.
 *
 * Automatically fetches a placement suggestion when a scanned course
 * is available and learning paths exist.
 *
 * @module
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  isPathPlacementAvailable,
  suggestPathPlacement,
  type PathPlacementSuggestion,
} from '@/ai/learningPath/suggestPlacement'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { db } from '@/db'
import type { Course } from '@/data/types'

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
 */
export function usePathPlacementSuggestion(
  courseName: string,
  courseTags: string[],
  courseDescription: string,
  enabled: boolean
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
  const hasExistingPaths = paths.length > 0

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

        // Also load catalog course names
        try {
          const catalogCourses: Course[] = await db.courses.toArray()
          for (const cc of catalogCourses) {
            courseNames.set(cc.id, cc.title)
          }
        } catch {
          // silent-catch-ok: catalog may not be available
        }

        // Build path contexts
        const pathContexts = paths.map(path => ({
          path,
          entries: getEntriesForPath(path.id),
        }))

        const result = await suggestPathPlacement(
          { name: courseName, tags: courseTags, description: courseDescription },
          pathContexts,
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
  }, [enabled, isAvailable, hasExistingPaths, courseName, retryCount, paths, getEntriesForPath, importedCourses, courseTags, courseDescription])

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
