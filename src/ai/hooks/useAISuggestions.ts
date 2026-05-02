/**
 * Hook for AI-powered metadata suggestions during course import.
 *
 * Calls the course tagger and description generator when Ollama is configured,
 * providing loading states and abort handling for the Import Wizard.
 *
 * @module
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  generateCourseTags,
  generateCourseDescription,
  isOllamaTaggingAvailable,
} from '@/ai/courseTagger'
import type { ScannedCourse } from '@/lib/courseImport'
import { registerAIRequest, unregisterAIRequest } from '@/ai/lib/inFlightRegistry'

/** State returned by the useAISuggestions hook */
export interface AISuggestionsState {
  /** Whether Ollama is configured and available */
  isAvailable: boolean
  /** Whether AI is currently generating suggestions */
  isLoading: boolean
  /** AI-suggested tags (empty if not available or failed) */
  suggestedTags: string[]
  /** AI-suggested course description (empty if not available or failed) */
  suggestedDescription: string
  /** Whether suggestions have been fetched (even if empty) */
  hasFetched: boolean
}

/**
 * Hook that fetches AI suggestions for a scanned course.
 *
 * Automatically triggers when a scanned course is provided and Ollama is configured.
 * Cancels in-flight requests when the course changes or the component unmounts.
 *
 * @param scannedCourse - The course to generate suggestions for (null to reset)
 * @returns AI suggestions state with loading indicators
 */
export function useAISuggestions(scannedCourse: ScannedCourse | null): AISuggestionsState {
  const [isLoading, setIsLoading] = useState(false)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [suggestedDescription, setSuggestedDescription] = useState('')
  const [hasFetched, setHasFetched] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isAvailable = useMemo(() => isOllamaTaggingAvailable(), [])

  // Reset when course changes
  const reset = useCallback(() => {
    setSuggestedTags([])
    setSuggestedDescription('')
    setHasFetched(false)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // No course or Ollama not configured — reset and bail
    if (!scannedCourse || !isAvailable) {
      reset()
      return
    }

    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      unregisterAIRequest(abortControllerRef.current)
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    registerAIRequest(controller)

    let cancelled = false
    setIsLoading(true)
    setHasFetched(false)

    const fileNames = [
      ...scannedCourse.videos.map(v => v.filename),
      ...scannedCourse.pdfs.map(p => p.filename),
    ]

    const metadata = {
      title: scannedCourse.name,
      fileNames,
    }

    // Fire both requests in parallel
    Promise.all([
      generateCourseTags(metadata, controller.signal),
      generateCourseDescription(metadata, controller.signal),
    ])
      .then(([tagResult, descResult]) => {
        if (cancelled) return
        setSuggestedTags(tagResult.tags)
        setSuggestedDescription(descResult.description)
        setHasFetched(true)
        setIsLoading(false)
      })
      .catch(() => {
        // silent-catch-ok: generateCourseTags/Description never throw; this catches AbortError
        if (!cancelled) {
          setIsLoading(false)
          setHasFetched(true)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
      unregisterAIRequest(controller)
    }
  }, [scannedCourse, isAvailable, reset])

  return {
    isAvailable,
    isLoading,
    suggestedTags,
    suggestedDescription,
    hasFetched,
  }
}
