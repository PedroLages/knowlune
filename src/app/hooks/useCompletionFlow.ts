/**
 * useCompletionFlow — Completion celebration and auto-advance logic for UnifiedLessonPlayer.
 *
 * Extracts: checkCourseCompletion, showCelebration, handleVideoEnded,
 * handleYouTubeAutoComplete, handleManualStatusChange, handleCelebrationContinue.
 *
 * @see E89-S05
 */

import { useCallback, useMemo } from 'react'
import { useLocation } from 'react-router'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import type { NavigateFunction } from 'react-router'
import { toast } from 'sonner'
import { exitFullscreenIfActive } from '@/lib/fullscreen'
import type { LessonItem } from '@/lib/courseAdapter'
import type { CelebrationType } from '@/app/components/celebrations/CompletionModal'
import type { CompletionStatus, Module } from '@/data/types'

/** Read the current autoPlay preference from the lesson chrome store. */
function readAutoPlay(): boolean {
  return useLessonChromeStore.getState().autoPlay
}

export interface CompletionFlowParams {
  courseId: string | undefined
  lessonId: string | undefined
  courseName: string | undefined
  lessons: LessonItem[]
  nextLesson: LessonItem | null
  navigate: NavigateFunction
  getItemStatus: (courseId: string, lessonId: string) => CompletionStatus
  setItemStatus: (
    courseId: string,
    lessonId: string,
    status: CompletionStatus,
    modules: Module[]
  ) => Promise<void>
  celebrationType: CelebrationType
  setCelebrationOpen: React.Dispatch<React.SetStateAction<boolean>>
  setCelebrationType: React.Dispatch<React.SetStateAction<CelebrationType>>
  setCelebrationTitle: React.Dispatch<React.SetStateAction<string>>
  setShowAutoAdvance: React.Dispatch<React.SetStateAction<boolean>>
  setShowCourseSuggestion: React.Dispatch<React.SetStateAction<boolean>>
}

export interface CompletionFlowResult {
  checkCourseCompletion: (lessonsArr: LessonItem[]) => boolean
  showCelebration: () => boolean
  handleVideoEnded: () => Promise<void>
  handleYouTubeAutoComplete: () => void
  handleAutoAdvance: () => void
  handleCancelAutoAdvance: () => void
  handleManualStatusChange: (status: CompletionStatus) => void
  handleCelebrationContinue: () => void
  handleCelebrationOpenChange: (open: boolean) => void
}

export function useCompletionFlow(params: CompletionFlowParams): CompletionFlowResult {
  const {
    courseId,
    lessonId,
    courseName,
    lessons,
    nextLesson,
    navigate,
    getItemStatus,
    setItemStatus,
    celebrationType,
    setCelebrationOpen,
    setCelebrationType,
    setCelebrationTitle,
    setShowAutoAdvance,
    setShowCourseSuggestion,
  } = params

  const location = useLocation()
  // Stable reference to fromTrack — avoids re-creating callbacks on every location object change.
  const fromTrack = useMemo(() => {
    const state = location.state
    if (typeof state !== 'object' || state === null) return undefined
    const s = state as Record<string, unknown>
    if (
      typeof s.fromTrack === 'object' &&
      s.fromTrack !== null &&
      typeof (s.fromTrack as Record<string, unknown>).trackId === 'string' &&
      typeof (s.fromTrack as Record<string, unknown>).trackName === 'string'
    ) {
      return s.fromTrack as { trackId: string; trackName: string }
    }
    return undefined
  }, [location.state])

  /**
   * Compute whether all lessons in the course are completed (including the current one).
   * Used to determine if we show a course-level vs lesson-level celebration.
   */
  const checkCourseCompletion = useCallback(
    (lessonsArr: LessonItem[]): boolean => {
      if (!courseId || lessonsArr.length === 0) return false
      // After marking the current lesson complete, check if all others are also complete
      return lessonsArr.every(l => {
        if (l.id === lessonId) return true // just marked complete
        return getItemStatus(courseId, l.id) === 'completed'
      })
    },
    [courseId, lessonId, getItemStatus]
  )

  /**
   * Show the celebration modal ONLY when the entire course is completed.
   * Individual lesson completions no longer trigger the modal.
   */
  const showCelebration = useCallback(
    (): boolean => {
      const isCourseComplete = lessons.length > 0 && checkCourseCompletion(lessons)
      if (!isCourseComplete) return false
      setCelebrationType('course')
      setCelebrationTitle(courseName ?? 'Course')
      setCelebrationOpen(true)
      return true
    },
    [
      lessons,
      checkCourseCompletion,
      courseName,
      setCelebrationType,
      setCelebrationTitle,
      setCelebrationOpen,
    ]
  )

  // Handle video ended — exit fullscreen, mark complete, show celebration, trigger auto-advance
  const handleVideoEnded = useCallback(async () => {
    if (!courseId || !lessonId) return

    // Exit fullscreen so the countdown overlay and celebration modal are visible
    exitFullscreenIfActive()

    // Mark the lesson as completed
    try {
      await setItemStatus(courseId, lessonId, 'completed', [])
    } catch {
      toast.error('Failed to mark lesson as complete')
      return // Don't show celebration or auto-advance if persistence failed
    }

    // Show celebration modal (only on full course completion) — guard auto-advance countdown
    // so they never render simultaneously (celebration modal already has "Continue" button)
    const celebrationShown = showCelebration()

    // Trigger auto-advance countdown only when auto-play is enabled AND celebration did not fire
    const autoPlay = readAutoPlay()
    if (nextLesson && autoPlay && !celebrationShown) {
      setShowAutoAdvance(true)
    }
  }, [
    courseId,
    lessonId,
    setItemStatus,
    showCelebration,
    nextLesson,
    setShowAutoAdvance,
  ])

  // Handle YouTube auto-complete (>90% watched) — exit fullscreen, then show celebration
  // and trigger auto-advance countdown
  // (guarded so celebration and countdown never render simultaneously).
  const handleYouTubeAutoComplete = useCallback(() => {
    // Exit fullscreen so the countdown overlay is visible
    exitFullscreenIfActive()

    const celebrationShown = showCelebration()
    const autoPlay = readAutoPlay()
    if (nextLesson && autoPlay && !celebrationShown) {
      setShowAutoAdvance(true)
    }
  }, [showCelebration, nextLesson, setShowAutoAdvance])

  const handleAutoAdvance = useCallback(() => {
    if (nextLesson && courseId) {
      const autoPlay = readAutoPlay()
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`, {
        state: {
          ...(autoPlay ? { autoPlay: true } : {}),
          ...(fromTrack ? { fromTrack } : {}),
        },
      })
    }
  }, [nextLesson, courseId, navigate, fromTrack])

  const handleCancelAutoAdvance = useCallback(() => {
    setShowAutoAdvance(false)
  }, [setShowAutoAdvance])

  // Handle manual completion toggle from PlayerHeader (AC7)
  const handleManualStatusChange = useCallback(
    (status: CompletionStatus) => {
      if (status === 'completed') {
        // Exit fullscreen so the countdown overlay is visible
        exitFullscreenIfActive()

        const celebrationShown = showCelebration()
        const autoPlay = readAutoPlay()
        if (nextLesson && autoPlay && !celebrationShown) {
          setShowAutoAdvance(true)
        }
      }
    },
    [showCelebration, nextLesson, setShowAutoAdvance]
  )

  // Handle "Continue Learning" from celebration modal
  const handleCelebrationContinue = useCallback(() => {
    setCelebrationOpen(false)
    if (nextLesson && courseId) {
      const autoPlay = readAutoPlay()
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`, {
        state: {
          ...(autoPlay ? { autoPlay: true } : {}),
          ...(fromTrack ? { fromTrack } : {}),
        },
      })
    }
  }, [nextLesson, courseId, navigate, setCelebrationOpen, fromTrack])

  // Handle celebration modal open/close — triggers course suggestion on course completion dismiss
  const handleCelebrationOpenChange = useCallback(
    (open: boolean) => {
      setCelebrationOpen(open)
      // When course-level celebration closes, show next course suggestion (AC1)
      // celebrationType is always 'course' here since showCelebration only opens course-level modals
      if (!open && celebrationType === 'course') {
        setShowCourseSuggestion(true)
      }
    },
    [setCelebrationOpen, setShowCourseSuggestion, celebrationType]
  )

  return {
    checkCourseCompletion,
    showCelebration,
    handleVideoEnded,
    handleYouTubeAutoComplete,
    handleAutoAdvance,
    handleCancelAutoAdvance,
    handleManualStatusChange,
    handleCelebrationContinue,
    handleCelebrationOpenChange,
  }
}
