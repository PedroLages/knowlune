/**
 * UnifiedLessonPlayer — Single lesson player for both local and YouTube courses.
 *
 * Replaces ImportedLessonPlayer (264 lines) and YouTubeLessonPlayer (407 lines)
 * with a single adapter-driven component. Uses ResizablePanelGroup on desktop
 * and Sheet (bottom drawer) on mobile for the side panel placeholder.
 *
 * Sub-components:
 * - PlayerHeader: back link, lesson title, course name, completion toggle
 * - CourseBreadcrumb: breadcrumb trail (Courses > Course > Lesson)
 * - LessonNavigation: prev/next buttons with lesson title preview
 * - AutoAdvanceCountdown: auto-advance to next lesson after video ends
 * - LocalVideoContent: local video playback with permission handling
 * - YouTubeVideoContent: YouTube iframe player with transcript
 * - PdfContent: PDF viewing with permission handling (E89-S06)
 * - PlayerSidePanel: tabbed panel with Notes, Transcript, AI Summary, Bookmarks (E89-S07)
 *
 * @see E89-S05, E89-S06, E89-S07, E89-S08
 */

import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { useSessionTracking } from '@/app/hooks/useSessionTracking'
import { useLessonNavigation } from '@/app/hooks/useLessonNavigation'
import { useIsDesktop } from '@/app/hooks/useMediaQuery'
import { PlayerHeader } from '@/app/components/course/PlayerHeader'
import { CourseBreadcrumb } from '@/app/components/course/CourseBreadcrumb'
import { LessonNavigation } from '@/app/components/course/LessonNavigation'
import { AutoAdvanceCountdown } from '@/app/components/figma/AutoAdvanceCountdown'
import { CompletionModal } from '@/app/components/celebrations/CompletionModal'
import type { CelebrationType } from '@/app/components/celebrations/CompletionModal'
import { LocalVideoContent } from '@/app/components/course/LocalVideoContent'
import { YouTubeVideoContent } from '@/app/components/course/YouTubeVideoContent'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/app/components/ui/resizable'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { PanelRight, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useHasQuiz } from '@/hooks/useHasQuiz'
import { PlayerSidePanel } from '@/app/components/course/PlayerSidePanel'
import type { LessonItem } from '@/lib/courseAdapter'
import type { CompletionStatus } from '@/data/types'

// Lazy-load PdfContent to avoid pdfjs-dist bundle impact for video-only users
const PdfContent = lazy(() =>
  import('@/app/components/course/PdfContent').then(m => ({ default: m.PdfContent }))
)

export function UnifiedLessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { adapter, loading, error } = useCourseAdapter(courseId)

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  const isDesktop = useIsDesktop()

  // Lesson navigation: prev/next lesson via adapter
  const { prevLesson, nextLesson, currentIndex, totalLessons, lessons } = useLessonNavigation(
    adapter,
    lessonId
  )

  // Quiz availability: check if a quiz exists for this lesson
  const { hasQuiz } = useHasQuiz(lessonId)

  // Progress store for marking lessons complete on video end
  const setItemStatus = useContentProgressStore(s => s.setItemStatus)
  const getItemStatus = useContentProgressStore(s => s.getItemStatus)

  // Auto-advance state: shown when video ends and a next lesson exists
  const [showAutoAdvance, setShowAutoAdvance] = useState(false)

  // Celebration modal state
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const [celebrationType, setCelebrationType] = useState<CelebrationType>('lesson')
  const [celebrationTitle, setCelebrationTitle] = useState('')

  // Lifted video state: currentTime for transcript highlighting, seekTo for click-to-seek
  const [currentTime, setCurrentTime] = useState(0)
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined)

  // Focus tab state: set to "notes" when user presses N in VideoPlayer
  const [focusTab, setFocusTab] = useState<string | null>(null)
  const focusTabCounter = useRef(0)

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time)
  }, [])

  const handleTranscriptSeek = useCallback((time: number) => {
    setSeekToTime(time)
  }, [])

  const handleSeekComplete = useCallback(() => {
    setSeekToTime(undefined)
  }, [])

  const handleFocusNotes = useCallback(() => {
    // Increment counter to re-trigger the effect even if already on "notes" tab
    focusTabCounter.current += 1
    setFocusTab(`notes`)
  }, [])

  // Reset lifted video state when lesson changes
  useEffect(() => {
    setShowAutoAdvance(false)
    setCelebrationOpen(false)
    setCurrentTime(0)
    setSeekToTime(undefined)
    setFocusTab(null)
  }, [lessonId])

  // Resolve lesson metadata (title + type) from adapter's lesson list
  const [lessonTitle, setLessonTitle] = useState('Lesson')
  const [lessonType, setLessonType] = useState<LessonItem['type'] | null>(null)
  useEffect(() => {
    if (!adapter || !lessonId) return
    let ignore = false
    adapter
      .getLessons()
      .then(lessons => {
        if (ignore) return
        const match = lessons.find(l => l.id === lessonId)
        setLessonTitle(match?.title ?? 'Lesson')
        setLessonType(match?.type ?? null)
      })
      .catch(err => {
        console.error('Failed to load lesson metadata:', err)
        // Leave defaults (title='Lesson', type=null) — UI degrades gracefully
      })
    return () => {
      ignore = true
    }
  }, [adapter, lessonId])

  const isPdf = lessonType === 'pdf'
  const lessonTypeResolved = lessonType !== null

  // Session tracking: start on mount, pause/resume on idle, end on leave.
  // Pass resolved type (or null) — hook defers session start until type is known.
  useSessionTracking(courseId, lessonId, lessonTypeResolved ? (isPdf ? 'pdf' : 'video') : null)

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
      setCelebrationTitle(isCourseComplete ? (course?.name ?? 'Course') : title)
      setCelebrationOpen(true)
    },
    [lessons, checkCourseCompletion, course?.name]
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
  }, [courseId, lessonId, setItemStatus, showCelebration, lessonTitle, nextLesson])

  const handleAutoAdvance = useCallback(() => {
    if (nextLesson && courseId) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)
    }
  }, [nextLesson, courseId, navigate])

  const handleCancelAutoAdvance = useCallback(() => {
    setShowAutoAdvance(false)
  }, [])

  // Handle manual completion toggle from PlayerHeader (AC7)
  const handleManualStatusChange = useCallback(
    (status: CompletionStatus) => {
      if (status === 'completed') {
        showCelebration(lessonTitle)
      }
    },
    [showCelebration, lessonTitle]
  )

  // Handle "Continue Learning" from celebration modal
  const handleCelebrationContinue = useCallback(() => {
    setCelebrationOpen(false)
    if (nextLesson && courseId) {
      navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)
    }
  }, [nextLesson, courseId, navigate])

  // Loading state
  if (loading) {
    return (
      <DelayedFallback>
        <div
          data-testid="lesson-player-content"
          className="flex flex-col h-full"
          role="status"
          aria-busy="true"
          aria-label="Loading lesson"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
            <Skeleton className="size-4" />
            <div className="flex flex-col gap-1 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="flex-1 m-4 rounded-xl" />
        </div>
      </DelayedFallback>
    )
  }

  // Error / not found state
  if (error || !adapter) {
    return (
      <div
        data-testid="lesson-player-content"
        className="flex flex-col items-center justify-center gap-4 py-16"
      >
        <h2 className="text-xl font-semibold text-foreground">Lesson not found</h2>
        <p className="text-muted-foreground">
          The lesson you&apos;re looking for doesn&apos;t exist or the course has been removed.
        </p>
      </div>
    )
  }

  const source = adapter.getSource()
  const capabilities = adapter.getCapabilities()
  const isYouTube = source === 'youtube'

  // While lessonType is still resolving, show a skeleton instead of
  // defaulting to video content (prevents PDF lessons from flashing video UI).
  const mainContent = !lessonTypeResolved ? (
    <DelayedFallback>
      <div aria-busy="true" aria-label="Resolving lesson type">
        <Skeleton className="w-full aspect-video rounded-xl" />
      </div>
    </DelayedFallback>
  ) : isPdf ? (
    <Suspense
      fallback={
        <DelayedFallback>
          <div aria-busy="true" aria-label="Loading PDF viewer">
            <Skeleton className="w-full aspect-[3/4] rounded-xl" />
          </div>
        </DelayedFallback>
      }
    >
      <PdfContent courseId={courseId!} lessonId={lessonId!} />
    </Suspense>
  ) : isYouTube ? (
    <YouTubeVideoContent
      courseId={courseId!}
      lessonId={lessonId!}
      onEnded={handleVideoEnded}
      onTimeUpdate={handleTimeUpdate}
      seekToTime={seekToTime}
      onSeekComplete={handleSeekComplete}
    />
  ) : (
    <LocalVideoContent
      courseId={courseId!}
      lessonId={lessonId!}
      onEnded={handleVideoEnded}
      onTimeUpdate={handleTimeUpdate}
      seekToTime={seekToTime}
      onSeekComplete={handleSeekComplete}
      onFocusNotes={handleFocusNotes}
    />
  )

  // "Take Quiz" button — visible when quiz exists and adapter supports it
  const showQuizButton = capabilities.supportsQuiz && hasQuiz
  const quizButton = showQuizButton ? (
    <div className="mt-4">
      <Button
        variant="brand-outline"
        className="rounded-xl min-h-[44px]"
        onClick={() => navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)}
        aria-label={`Take quiz for ${lessonTitle}`}
        data-testid="take-quiz-button"
      >
        <ClipboardCheck className="size-4 mr-2" aria-hidden="true" />
        Take Quiz
      </Button>
    </div>
  ) : null

  // Side panel with tabbed content: Notes, Transcript, AI Summary, Bookmarks
  const sidePanelContent = (
    <PlayerSidePanel
      courseId={courseId!}
      lessonId={lessonId!}
      adapter={adapter}
      currentTime={currentTime}
      onSeek={handleTranscriptSeek}
      focusTab={focusTab}
    />
  )

  return (
    <div data-testid="lesson-player-content" className="flex flex-col h-full">
      {/* Breadcrumb: Courses > Course Name > Lesson Title */}
      <div className="px-4 pt-3">
        <CourseBreadcrumb
          courseId={courseId!}
          courseName={course?.name ?? 'Course'}
          lessonTitle={lessonTitle}
        />
      </div>

      <PlayerHeader
        courseId={courseId!}
        lessonId={lessonId!}
        lessonTitle={lessonTitle}
        courseName={course?.name}
        showCompletionToggle={isPdf || isYouTube || capabilities.hasVideo}
        onStatusChange={handleManualStatusChange}
      />

      {/* Content area: resizable panels on desktop, sheet on mobile */}
      <div className="flex-1 overflow-auto">
        {isDesktop ? (
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize={75} minSize={50}>
              <div className="h-full overflow-auto p-4">
                {mainContent}
                {quizButton}
                {/* Auto-advance countdown after video ends */}
                {showAutoAdvance && nextLesson && (
                  <div className="mt-4">
                    <AutoAdvanceCountdown
                      seconds={5}
                      nextLessonTitle={nextLesson.title}
                      onAdvance={handleAutoAdvance}
                      onCancel={handleCancelAutoAdvance}
                    />
                  </div>
                )}
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
              <div className="h-full overflow-auto border-l border-border/50 bg-card">
                {sidePanelContent}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full">
            <div className="h-full overflow-auto p-4">
              {mainContent}
              {quizButton}
              {/* Auto-advance countdown after video ends */}
              {showAutoAdvance && nextLesson && (
                <div className="mt-4">
                  <AutoAdvanceCountdown
                    seconds={5}
                    nextLessonTitle={nextLesson.title}
                    onAdvance={handleAutoAdvance}
                    onCancel={handleCancelAutoAdvance}
                  />
                </div>
              )}
            </div>

            {/* Mobile sheet trigger */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg"
                  aria-label="Open side panel"
                >
                  <PanelRight className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[60vh]">
                <SheetTitle className="sr-only">Lesson panel</SheetTitle>
                {sidePanelContent}
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>

      {/* Prev/Next lesson navigation bar */}
      {capabilities.supportsPrevNext && (
        <LessonNavigation
          courseId={courseId!}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
          currentIndex={currentIndex}
          totalLessons={totalLessons}
        />
      )}

      {/* Completion celebration modal (lesson or course level) */}
      <CompletionModal
        open={celebrationOpen}
        onOpenChange={setCelebrationOpen}
        type={celebrationType}
        title={celebrationTitle}
        stats={
          celebrationType === 'course'
            ? {
                lessonsCompleted: totalLessons,
                totalLessons,
                completionPercent: 100,
              }
            : undefined
        }
        onContinue={nextLesson ? handleCelebrationContinue : undefined}
      />
    </div>
  )
}
