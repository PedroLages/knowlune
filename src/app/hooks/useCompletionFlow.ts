/**
 * useCompletionFlow — Completion celebration and auto-advance logic for UnifiedLessonPlayer.
 *
 * Extracts: checkCourseCompletion, showCelebration, handleVideoEnded,
 * handleYouTubeAutoComplete, handleManualStatusChange, handleCelebrationContinue.
 *
 * @see E89-S05
 */

import { useCallback } from 'react'
import type { NavigateFunction } from 'react-router'
import { toast } from 'sonner'
import type { LessonItem } from '@/lib/courseAdapter'
import type { CelebrationType } from '@/app/components/celebrations/CompletionModal'
import type { CompletionStatus, Module } from '@/data/types'

export interface CompletionFlowParams {
  courseId: string | undefined
  lessonId: string | undefined
  courseName: string | undefined
  lessonTitle: string
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
  showCelebration: (title: string) => void
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
    lessonTitle,
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
   * Show the appropriate celebration modal.
   * Checks if all course lessons are now complete for course-level celebration.
   */
  const showCelebration = useCallback(
    (title: string) => {
      const isCourseComplete = lessons.length > 0 && checkCourseCompletion(lessons)
      setCelebrationType(isCourseComplete ? 'course' : 'lesson')
      setCelebrationTitle(isCourseComplete ? (courseName ?? 'Course') : title)
      setCelebrationOpen(true)
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

  // Handle video ended — mark complete, show celebration, trigger auto-advance
  const handleVideoEnded = useCallback(async () => {
    if (!courseId || !lessonId) return

    // Mark the lesson as completed
    try {
      await setItemStatus(courseId, lessonId, 'completed', [])
    } catch {
      toast.error('Failed to mark lesson as complete')
      return // Don't show celebration or auto-advance if persistence failed
    }

    // Show celebration modal
    showCelebration(lessonTitle)

    // Trigger auto-advance countdown if next lesson exists
    if (nextLesson) {
      setShowAutoAdvance(true)
    }
  }, [
    courseId,
    lessonId,
    setItemStatus,
    showCelebration,
    lessonTitle,
    nextLesson,
    setShowAutoAdvance,
  ])

  // Handle YouTube auto-complete (>90% watched) — status already persisted by YouTubeVideoContent,
  // so we only need to show celebration and trigger auto-advance countdown.
  const handleYouTubeAutoComplete = useCallback(() => {
    showCelebration(lessonTitle)
    if (nextLesson) {
      setShowAutoAdvance(true)
    }
  }, [showCelebration, lessonTitle, nextLesson, setShowAutoAdvance])

  const handleAutoAdvance = useCallback(() => {
    if (nextLesson && courseId) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)
    }
  }, [nextLesson, courseId, navigate])

  const handleCancelAutoAdvance = useCallback(() => {
    setShowAutoAdvance(false)
  }, [setShowAutoAdvance])

  // Handle manual completion toggle from PlayerHeader (AC7)
  const handleManualStatusChange = useCallback(
    (status: CompletionStatus) => {
      if (status === 'completed') {
        showCelebration(lessonTitle)
        // Trigger auto-advance countdown if next lesson exists (same as video end)
        if (nextLesson) {
          setShowAutoAdvance(true)
        }
      }
    },
    [showCelebration, lessonTitle, nextLesson, setShowAutoAdvance]
  )

  // Handle "Continue Learning" from celebration modal
  const handleCelebrationContinue = useCallback(() => {
    setCelebrationOpen(false)
    if (nextLesson && courseId) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)
    }
  }, [nextLesson, courseId, navigate, setCelebrationOpen])

  // Handle celebration modal open/close — triggers course suggestion on course completion dismiss
  const handleCelebrationOpenChange = useCallback(
    (open: boolean) => {
      setCelebrationOpen(open)
      // When course-level celebration closes, show next course suggestion (AC1)
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
