/**
 * useQuizGeneration — React hook wrapping the quiz generation service.
 *
 * Provides loading/error states, cached quiz lookup, and Ollama availability
 * for the GenerateQuizButton component.
 *
 * @see E52-S02 Quiz Generation UI
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { generateQuizForLesson, type QuizGenerationResult } from '@/ai/quizGenerationService'
import { isAIAvailable } from '@/lib/aiConfiguration'
import { testOllamaConnection } from '@/lib/ollamaHealthCheck'
import { getAIConfiguration, getOllamaSelectedModel } from '@/lib/aiConfiguration'
import { db } from '@/db'
import type { Quiz } from '@/types/quiz'
import type { BloomsLevel } from '@/ai/quizPrompts'

export interface UseQuizGenerationReturn {
  /** The generated or cached quiz */
  quiz: Quiz | null
  /** Whether generation is in progress */
  isGenerating: boolean
  /** Error message if generation failed */
  error: string | null
  /** Trigger quiz generation */
  generate: (bloomsLevel?: BloomsLevel) => Promise<void>
  /** Trigger regeneration (creates new quiz, preserves old) */
  regenerate: (bloomsLevel?: BloomsLevel) => Promise<void>
  /** Previously cached quiz (loaded on mount) */
  cachedQuiz: Quiz | null
  /** All quizzes for this lesson (for accessing previous versions) */
  allQuizzes: Quiz[]
  /** Whether Ollama is available for quiz generation */
  ollamaAvailable: boolean
  /** Whether availability check is still in progress */
  checkingAvailability: boolean
}

/** Ollama availability re-check interval (30 seconds) */
const HEALTH_CHECK_INTERVAL_MS = 30_000

export function useQuizGeneration(
  lessonId: string | undefined,
  courseId: string | undefined
): UseQuizGenerationReturn {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cachedQuiz, setCachedQuiz] = useState<Quiz | null>(null)
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([])
  const [ollamaAvailable, setOllamaAvailable] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  // Check for cached quizzes on mount (load all for this lesson)
  useEffect(() => {
    if (!lessonId) {
      setCachedQuiz(null)
      setAllQuizzes([])
      return
    }

    let ignore = false

    db.quizzes
      .where('lessonId')
      .equals(lessonId)
      .toArray()
      .then(existing => {
        if (ignore) return
        const quizzes = existing as Quiz[]
        setAllQuizzes(quizzes)
        if (quizzes.length > 0) {
          // Use most recent quiz as the active one
          const sorted = [...quizzes].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          setCachedQuiz(sorted[0])
          setQuiz(sorted[0])
        }
      })
      .catch(err => {
        // silent-catch-ok: cache miss is non-critical, falls through to generate
        console.warn('[useQuizGeneration] Cache lookup failed:', (err as Error).message)
      })

    return () => {
      ignore = true
    }
  }, [lessonId])

  // Check Ollama availability on mount and on interval
  useEffect(() => {
    let ignore = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function checkAvailability() {
      // Quick check: is AI configured at all?
      if (!isAIAvailable()) {
        if (!ignore) {
          setOllamaAvailable(false)
          setCheckingAvailability(false)
        }
        return
      }

      const config = getAIConfiguration()
      if (config.provider !== 'ollama' || !config.ollamaSettings?.serverUrl) {
        if (!ignore) {
          setOllamaAvailable(false)
          setCheckingAvailability(false)
        }
        return
      }

      try {
        const result = await testOllamaConnection(
          config.ollamaSettings.serverUrl,
          config.ollamaSettings.directConnection,
          getOllamaSelectedModel() ?? undefined
        )
        if (!ignore) {
          setOllamaAvailable(result.success)
          setCheckingAvailability(false)
        }
      } catch {
        // silent-catch-ok: Ollama offline is expected, button shows disabled state
        if (!ignore) {
          setOllamaAvailable(false)
          setCheckingAvailability(false)
        }
      }
    }

    checkAvailability()
    intervalId = setInterval(checkAvailability, HEALTH_CHECK_INTERVAL_MS)

    return () => {
      ignore = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const generateInternal = useCallback(
    async (bloomsLevel: BloomsLevel = 'remember', regenerate = false) => {
      if (!lessonId || !courseId) {
        toast.error('Cannot generate quiz: missing lesson or course context.')
        return
      }

      // Abort any in-progress generation
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsGenerating(true)
      setError(null)

      try {
        const result: QuizGenerationResult = await generateQuizForLesson(lessonId, courseId, {
          bloomsLevel,
          signal: controller.signal,
          regenerate,
        })

        if (controller.signal.aborted) return

        if (result.quiz) {
          setQuiz(result.quiz)
          if (!result.cached) {
            setCachedQuiz(result.quiz)
            // Refresh all quizzes list
            try {
              const all = await db.quizzes.where('lessonId').equals(lessonId).toArray()
              setAllQuizzes(all as Quiz[])
            } catch {
              // silent-catch-ok: non-critical list refresh
            }
          }
          if (result.error) {
            // Quiz generated but with warnings (e.g. storage failed)
            toast.error(result.error)
          }
        } else {
          const errorMsg = result.error ?? 'Quiz generation failed. Please try again.'
          setError(errorMsg)
          toast.error(errorMsg)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const errorMsg = 'An unexpected error occurred during quiz generation.'
        setError(errorMsg)
        toast.error(errorMsg)
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false)
        }
      }
    },
    [lessonId, courseId]
  )

  const generate = useCallback(
    (bloomsLevel?: BloomsLevel) => generateInternal(bloomsLevel ?? 'remember', false),
    [generateInternal]
  )

  const regenerateQuiz = useCallback(
    (bloomsLevel?: BloomsLevel) => generateInternal(bloomsLevel ?? 'remember', true),
    [generateInternal]
  )

  return {
    quiz,
    isGenerating,
    error,
    generate,
    regenerate: regenerateQuiz,
    cachedQuiz,
    allQuizzes,
    ollamaAvailable,
    checkingAvailability,
  }
}
