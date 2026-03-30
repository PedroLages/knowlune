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

import { lazy, Suspense, useState, useEffect, useCallback, useRef, type RefObject } from 'react'
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
import { LessonHeaderCard } from '@/app/components/course/LessonHeaderCard'
import { AutoAdvanceCountdown } from '@/app/components/figma/AutoAdvanceCountdown'
import { CompletionModal } from '@/app/components/celebrations/CompletionModal'
import type { CelebrationType } from '@/app/components/celebrations/CompletionModal'
import { LocalVideoContent } from '@/app/components/course/LocalVideoContent'
import type { VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'
import { YouTubeVideoContent } from '@/app/components/course/YouTubeVideoContent'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/app/components/ui/resizable'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import type { ImperativePanelHandle } from 'react-resizable-panels'
import { PanelRight, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useHasQuiz } from '@/hooks/useHasQuiz'
import { PlayerSidePanel } from '@/app/components/course/PlayerSidePanel'
import type { LessonItem } from '@/lib/courseAdapter'
import { useTheaterMode } from '@/app/hooks/useTheaterMode'
import { MiniPlayer } from '@/app/components/course/MiniPlayer'
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
  const { isTheater, toggleTheater } = useTheaterMode()
  const sidePanelRef = useRef<ImperativePanelHandle>(null)
  const videoPlayerRef = useRef<VideoPlayerHandle>(null)

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
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)

  // Ensure course progress is loaded so getItemStatus has data for checkCourseCompletion.
  // PlayerHeader also loads it, but we don't rely on render order for correctness.
  useEffect(() => {
    if (courseId) {
      loadCourseProgress(courseId)
    }
  }, [courseId, loadCourseProgress])

  // Auto-advance state: shown when video ends and a next lesson exists
  const [showAutoAdvance, setShowAutoAdvance] = useState(false)

  // Celebration modal state
  const [celebrationOpen, setCelebrationOpen] = useState(false)
  const [celebrationType, setCelebrationType] = useState<CelebrationType>('lesson')
  const [celebrationTitle, setCelebrationTitle] = useState('')

  // Lifted video state: currentTime for transcript highlighting, seekTo for click-to-seek
  const [currentTime, setCurrentTime] = useState(0)
  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined)

  // Mini-player state (E91-S04): tracks video visibility, play state, and dismiss
  const [isVideoVisible, setIsVideoVisible] = useState(true)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isMiniPlayerDismissed, setIsMiniPlayerDismissed] = useState(false)
  const [localVideoBlobUrl, setLocalVideoBlobUrl] = useState<string | null>(null)

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

  // Mini-player callbacks
  const handleVideoVisibilityChange = useCallback((visible: boolean) => {
    setIsVideoVisible(visible)
  }, [])

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsVideoPlaying(playing)
  }, [])

  const handleMiniPlayerClose = useCallback(() => {
    setIsMiniPlayerDismissed(true)
  }, [])

  const handleMiniPlayerPlayPause = useCallback(() => {
    const videoEl = videoPlayerRef.current?.getVideoElement()
    if (!videoEl) return
    if (videoEl.paused) {
      videoEl.play().catch(() => {
        // silent-catch-ok: autoplay may be blocked
      })
    } else {
      videoEl.pause()
    }
  }, [])

  const handleFocusNotes = useCallback(() => {
    // Increment counter to re-trigger the effect even if already on "notes" tab
    focusTabCounter.current += 1
    setFocusTab(`notes`)
  }, [])

  // Theater mode: imperatively collapse/expand the side panel
  useEffect(() => {
    if (!isDesktop) return
    const panel = sidePanelRef.current
    if (!panel) return
    if (isTheater) {
      panel.collapse()
    } else {
      panel.expand()
    }
  }, [isTheater, isDesktop])

  // Keyboard shortcut: T toggles theater mode (only when not in input/textarea)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        toggleTheater()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleTheater])

  // Reset lifted video state when lesson changes
  useEffect(() => {
    setShowAutoAdvance(false)
    setCelebrationOpen(false)
    setCurrentTime(0)
    setSeekToTime(undefined)
    setFocusTab(null)
    // Reset mini-player state on lesson change (E91-S04)
    setIsMiniPlayerDismissed(false)
    setIsVideoVisible(true)
    setIsVideoPlaying(false)
    setLocalVideoBlobUrl(null)
  }, [lessonId])

  // Resolve lesson metadata (title + type) from adapter's lesson list
  const [lessonTitle, setLessonTitle] = useState('Lesson')
  const [lessonType, setLessonType] = useState<LessonItem['type'] | null>(null)
  const [lessonDescription, setLessonDescription] = useState<string | undefined>(undefined)
  const [lessonTags, setLessonTags] = useState<string[] | undefined>(undefined)
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
        // Extract description from sourceMetadata (YouTube videos have it)
        const meta = match?.sourceMetadata
        setLessonDescription(typeof meta?.description === 'string' ? meta.description : undefined)
        // Extract tags if present in sourceMetadata
        setLessonTags(
          Array.isArray(meta?.tags) ? (meta.tags as string[]) : undefined
        )
      })
      .catch(err => {
        // silent-catch-ok — leave defaults (title='Lesson', type=null); UI degrades gracefully
        console.error('Failed to load lesson metadata:', err)
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

  // Handle YouTube auto-complete (>90% watched) — status already persisted by YouTubeVideoContent,
  // so we only need to show celebration and trigger auto-advance countdown.
  const handleYouTubeAutoComplete = useCallback(() => {
    showCelebration(lessonTitle)
    if (nextLesson) {
      setShowAutoAdvance(true)
    }
  }, [showCelebration, lessonTitle, nextLesson])

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
        // Trigger auto-advance countdown if next lesson exists (same as video end)
        if (nextLesson) {
          setShowAutoAdvance(true)
        }
      }
    },
    [showCelebration, lessonTitle, nextLesson]
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

  // Derive resource type label for LessonHeaderCard (E91-S05)
  const resourceTypes: string[] = []
  if (lessonTypeResolved) {
    if (isPdf) {
      resourceTypes.push('PDF')
    } else if (isYouTube) {
      resourceTypes.push('YouTube')
    } else {
      resourceTypes.push('Video')
    }
  }

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
      onAutoComplete={handleYouTubeAutoComplete}
      onTimeUpdate={handleTimeUpdate}
      seekToTime={seekToTime}
      onSeekComplete={handleSeekComplete}
    />
  ) : (
    <LocalVideoContent
      ref={videoPlayerRef}
      courseId={courseId!}
      lessonId={lessonId!}
      onEnded={handleVideoEnded}
      onTimeUpdate={handleTimeUpdate}
      seekToTime={seekToTime}
      onSeekComplete={handleSeekComplete}
      onFocusNotes={handleFocusNotes}
      onVisibilityChange={handleVideoVisibilityChange}
      onPlayStateChange={handlePlayStateChange}
      onBlobUrlReady={setLocalVideoBlobUrl}
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
    <div
      data-testid="lesson-player-content"
      data-theater-mode={isTheater ? 'true' : 'false'}
      className="flex flex-col h-full"
    >
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
        isTheater={isTheater}
        onToggleTheater={toggleTheater}
      />

      {/* Content area: resizable panels on desktop, sheet on mobile */}
      <div className="flex-1 overflow-auto">
        {isDesktop ? (
          <ResizablePanelGroup
            orientation="horizontal"
            className="h-full transition-all duration-300"
          >
            <ResizablePanel defaultSize={isTheater ? 100 : 75} minSize={50}>
              <div className="h-full overflow-auto p-4">
                {mainContent}
                {lessonTypeResolved && (
                  <LessonHeaderCard
                    title={lessonTitle}
                    description={lessonDescription}
                    resourceTypes={resourceTypes}
                    tags={lessonTags}
                  />
                )}
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
            {!isTheater && <ResizableHandle withHandle />}
            <ResizablePanel
              ref={sidePanelRef as RefObject<ImperativePanelHandle>}
              defaultSize={isTheater ? 0 : 25}
              minSize={0}
              maxSize={40}
              collapsible
              collapsedSize={0}
            >
              <div className="h-full overflow-auto border-l border-border/50 bg-card">
                {sidePanelContent}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full">
            <div className="h-full overflow-auto p-4">
              {mainContent}
              {lessonTypeResolved && (
                <LessonHeaderCard
                  title={lessonTitle}
                  description={lessonDescription}
                  resourceTypes={resourceTypes}
                  tags={lessonTags}
                />
              )}
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

      {/* Mini-player for local video lessons (E91-S04) */}
      {!isYouTube && !isPdf && localVideoBlobUrl && (
        <MiniPlayer
          videoSrc={localVideoBlobUrl}
          currentTime={currentTime}
          isMainPlaying={isVideoPlaying}
          isVisible={!isVideoVisible && !isMiniPlayerDismissed}
          onClose={handleMiniPlayerClose}
          onPlayPause={handleMiniPlayerPlayPause}
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
