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
import { getQuizGenerationAvailability } from '@/lib/aiConfiguration'
import { db } from '@/db'
import type { Quiz } from '@/types/quiz'
import type { BloomsLevel } from '@/ai/quizPrompts'
import { resolveLessonTranscript, type ResolvedLessonTranscript } from '@/lib/lessonTranscript'
import { selectNewestQuiz, sortQuizzesNewestFirst } from '@/lib/quizVersions'

export type QuizTranscriptState = ResolvedLessonTranscript | { status: 'loading'; reason: string }

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
  /** Whether AI is available for quiz generation */
  aiAvailable: boolean
  /** Whether availability check is still in progress */
  checkingAvailability: boolean
  /** Whether the lesson transcript is ready to generate from */
  transcript: QuizTranscriptState
}

/** AI availability re-check interval (30 seconds) */
const HEALTH_CHECK_INTERVAL_MS = 30_000

export function useQuizGeneration(
  lessonId: string | undefined,
  courseId: string | undefined,
  transcriptVersion = 0
): UseQuizGenerationReturn {
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cachedQuiz, setCachedQuiz] = useState<Quiz | null>(null)
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([])
  const [aiAvailable, setAiAvailable] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(true)
  const [transcript, setTranscript] = useState<QuizTranscriptState>({
    status: 'loading',
    reason: 'Checking transcript availability…',
  })
  const abortRef = useRef<AbortController | null>(null)
  const isFirstCheckRef = useRef(true)

  // Reset lesson-specific state immediately after navigation and load all versions.
  useEffect(() => {
    abortRef.current?.abort()
    setQuiz(null)
    setCachedQuiz(null)
    setAllQuizzes([])
    setError(null)
    setIsGenerating(false)

    if (!lessonId || !courseId) {
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
        const quizzes = sortQuizzesNewestFirst(existing as Quiz[])
        const newest = selectNewestQuiz(quizzes)
        setAllQuizzes(quizzes)
        setCachedQuiz(newest)
        setQuiz(newest)
      })
      .catch(err => {
        // silent-catch-ok: cache miss is non-critical, falls through to generate
        console.warn('[useQuizGeneration] Cache lookup failed:', (err as Error).message)
      })

    return () => {
      ignore = true
      abortRef.current?.abort()
    }
  }, [courseId, lessonId])

  // Quiz generation and transcript UI share the same canonical resolver.
  useEffect(() => {
    let ignore = false
    setTranscript({ status: 'loading', reason: 'Checking transcript availability…' })

    if (!courseId || !lessonId) {
      setTranscript({ status: 'missing', reason: 'Lesson context is unavailable.' })
      return
    }

    void resolveLessonTranscript(courseId, lessonId).then(result => {
      if (!ignore) setTranscript(result)
    })

    return () => {
      ignore = true
    }
  }, [courseId, lessonId, transcriptVersion])

  // Check AI availability on mount and on interval
  useEffect(() => {
    let ignore = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function checkAvailability() {
      try {
        const result = await getQuizGenerationAvailability()
        if (!ignore) {
          if (isFirstCheckRef.current) {
            // First check: always clear checking state regardless of result
            setCheckingAvailability(false)
            isFirstCheckRef.current = false
          }
          setAiAvailable(result.available)
        }
      } catch {
        // silent-catch-ok: availability check failure shows disabled state
        if (!ignore) {
          setAiAvailable(false)
          if (isFirstCheckRef.current) {
            setCheckingAvailability(false)
            isFirstCheckRef.current = false
          }
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

      if (transcript.status !== 'ready') {
        const reason = transcript.reason || 'Generate a transcript before creating a quiz.'
        setError(reason)
        toast.error(reason)
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
              setAllQuizzes(sortQuizzesNewestFirst(all as Quiz[]))
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
    [lessonId, courseId, transcript]
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
    quiz: quiz?.lessonId === lessonId ? quiz : null,
    isGenerating,
    error,
    generate,
    regenerate: regenerateQuiz,
    cachedQuiz: cachedQuiz?.lessonId === lessonId ? cachedQuiz : null,
    allQuizzes: allQuizzes.filter(candidate => candidate.lessonId === lessonId),
    aiAvailable,
    checkingAvailability,
    transcript,
  }
}
