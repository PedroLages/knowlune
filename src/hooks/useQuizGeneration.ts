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
import {
  generateQuizForLesson,
  type QuizGenerationResult,
} from '@/ai/quizGenerationService'
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
  /** Previously cached quiz (loaded on mount) */
  cachedQuiz: Quiz | null
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
  const [ollamaAvailable, setOllamaAvailable] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  // Check for cached quiz on mount
  useEffect(() => {
    if (!lessonId) {
      setCachedQuiz(null)
      return
    }

    let ignore = false

    db.quizzes
      .where('lessonId')
      .equals(lessonId)
      .first()
      .then(existing => {
        if (!ignore && existing) {
          setCachedQuiz(existing as Quiz)
          setQuiz(existing as Quiz)
        }
      })
      .catch(err => {
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

  const generate = useCallback(
    async (bloomsLevel: BloomsLevel = 'remember') => {
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
        const result: QuizGenerationResult = await generateQuizForLesson(
          lessonId,
          courseId,
          { bloomsLevel, signal: controller.signal }
        )

        if (controller.signal.aborted) return

        if (result.quiz) {
          setQuiz(result.quiz)
          if (!result.cached) {
            setCachedQuiz(result.quiz)
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

  return {
    quiz,
    isGenerating,
    error,
    generate,
    cachedQuiz,
    ollamaAvailable,
    checkingAvailability,
  }
}
