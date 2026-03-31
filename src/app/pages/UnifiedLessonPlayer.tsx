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
 * - LessonContentRenderer: PDF, YouTube, or local video content (extracted)
 * - PlayerSidePanel: tabbed panel with Notes, Transcript, AI Summary, Bookmarks (E89-S07)
 *
 * Hooks:
 * - useLessonPlayerState: all local state, metadata resolution, reset-on-change
 * - useCompletionFlow: celebration modals, auto-advance, manual status change
 * - useMiniPlayerState: mini-player visibility/playback callbacks
 *
 * @see E89-S05, E89-S06, E89-S07, E89-S08
 */

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { useSessionTracking } from '@/app/hooks/useSessionTracking'
import { useLessonNavigation } from '@/app/hooks/useLessonNavigation'
import { useIsDesktop, useIsTablet } from '@/app/hooks/useMediaQuery'
import { useLessonPlayerState } from '@/app/hooks/useLessonPlayerState'
import { useCompletionFlow } from '@/app/hooks/useCompletionFlow'
import { useMiniPlayerState } from '@/app/hooks/useMiniPlayerState'
import { PlayerHeader } from '@/app/components/course/PlayerHeader'
import { CourseBreadcrumb } from '@/app/components/course/CourseBreadcrumb'
import { LessonNavigation } from '@/app/components/course/LessonNavigation'
import { LessonHeaderCard } from '@/app/components/course/LessonHeaderCard'
import { AutoAdvanceCountdown } from '@/app/components/figma/AutoAdvanceCountdown'
import { CompletionModal } from '@/app/components/celebrations/CompletionModal'
import { LessonContentRenderer } from '@/app/components/course/LessonContentRenderer'
import type { VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/app/components/ui/resizable'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { PanelRight, ClipboardCheck, Video, PencilLine } from 'lucide-react'
import { useHasQuiz } from '@/hooks/useHasQuiz'
import { PlayerSidePanel, NotesTab } from '@/app/components/course/PlayerSidePanel'
import { useTheaterMode } from '@/app/hooks/useTheaterMode'
import { MiniPlayer } from '@/app/components/course/MiniPlayer'
import { NextCourseSuggestion } from '@/app/components/NextCourseSuggestion'
import { suggestNextCourse } from '@/lib/courseSuggestion'

export function UnifiedLessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { adapter, loading, error } = useCourseAdapter(courseId)

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  const isDesktop = useIsDesktop()
  const isTablet = useIsTablet()
  const { isTheater, toggleTheater } = useTheaterMode()
  const sidePanelRef = useRef<PanelImperativeHandle>(null)
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
  useEffect(() => {
    if (courseId) {
      loadCourseProgress(courseId)
    }
  }, [courseId, loadCourseProgress])

  // All local state: auto-advance, celebration, video time, mini-player, metadata, etc.
  const state = useLessonPlayerState(adapter, lessonId)

  // Completion flow: celebrations, auto-advance, manual status toggle
  const completion = useCompletionFlow({
    courseId,
    lessonId,
    courseName: course?.name,
    lessonTitle: state.lessonTitle,
    lessons,
    nextLesson,
    navigate,
    getItemStatus,
    setItemStatus,
    celebrationType: state.celebrationType,
    setCelebrationOpen: state.setCelebrationOpen,
    setCelebrationType: state.setCelebrationType,
    setCelebrationTitle: state.setCelebrationTitle,
    setShowAutoAdvance: state.setShowAutoAdvance,
    setShowCourseSuggestion: state.setShowCourseSuggestion,
  })

  // Mini-player callbacks
  const miniPlayer = useMiniPlayerState({
    videoPlayerRef,
    setIsVideoVisible: state.setIsVideoVisible,
    setIsVideoPlaying: state.setIsVideoPlaying,
    setIsMiniPlayerDismissed: state.setIsMiniPlayerDismissed,
    setLocalVideoBlobUrl: state.setLocalVideoBlobUrl,
  })

  // Session tracking: start on mount, pause/resume on idle, end on leave.
  useSessionTracking(
    courseId,
    lessonId,
    state.lessonTypeResolved ? (state.isPdf ? 'pdf' : 'video') : null
  )

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

  // Next course suggestion (E91-S08) — computed via useMemo
  const courseSuggestion = useMemo(() => {
    if (!state.showCourseSuggestion || !courseId) return null
    const suggestion = suggestNextCourse(courseId, importedCourses)
    if (!suggestion) return null
    const thumbnailUrl = suggestion.course.youtubeThumbnailUrl ?? null
    return { ...suggestion, thumbnailUrl }
  }, [state.showCourseSuggestion, courseId, importedCourses])

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

  // Derive resource type label for LessonHeaderCard (E91-S05)
  const resourceTypes: string[] = !state.lessonTypeResolved
    ? []
    : state.isPdf
      ? ['PDF']
      : capabilities.requiresNetwork
        ? ['YouTube']
        : ['Video']

  // "Take Quiz" button — visible when quiz exists and adapter supports it
  const showQuizButton = capabilities.supportsQuiz && hasQuiz
  const quizButton = showQuizButton ? (
    <div className="mt-4">
      <Button
        variant="brand-outline"
        className="rounded-xl min-h-[44px]"
        onClick={() => navigate(`/courses/${courseId}/lessons/${lessonId}/quiz`)}
        aria-label={`Take quiz for ${state.lessonTitle}`}
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
      currentTime={state.currentTime}
      onSeek={state.handleTranscriptSeek}
      focusTab={state.focusTab}
      isPdf={state.isPdf}
    />
  )

  // Main content: PDF, YouTube, or local video via extracted component
  const mainContent = (
    <LessonContentRenderer
      ref={videoPlayerRef}
      courseId={courseId!}
      lessonId={lessonId!}
      lessonTypeResolved={state.lessonTypeResolved}
      isPdf={state.isPdf}
      sourceType={source}
      onEnded={completion.handleVideoEnded}
      onAutoComplete={completion.handleYouTubeAutoComplete}
      onTimeUpdate={state.handleTimeUpdate}
      seekToTime={state.seekToTime}
      onSeekComplete={state.handleSeekComplete}
      onFocusNotes={state.handleFocusNotes}
      onVisibilityChange={miniPlayer.handleVideoVisibilityChange}
      onPlayStateChange={miniPlayer.handlePlayStateChange}
      onBlobUrlReady={state.setLocalVideoBlobUrl}
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
          lessonTitle={state.lessonTitle}
        />
      </div>

      <PlayerHeader
        courseId={courseId!}
        lessonId={lessonId!}
        lessonTitle={state.lessonTitle}
        courseName={course?.name}
        showCompletionToggle={state.isPdf || capabilities.requiresNetwork || capabilities.hasVideo}
        onStatusChange={completion.handleManualStatusChange}
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
                {state.lessonTypeResolved && (
                  <LessonHeaderCard
                    title={state.lessonTitle}
                    description={state.lessonDescription}
                    resourceTypes={resourceTypes}
                    tags={state.lessonTags}
                  />
                )}
                {quizButton}
                {/* Auto-advance countdown after video ends */}
                {state.showAutoAdvance && nextLesson && (
                  <div className="mt-4">
                    <AutoAdvanceCountdown
                      seconds={5}
                      nextLessonTitle={nextLesson.title}
                      onAdvance={completion.handleAutoAdvance}
                      onCancel={completion.handleCancelAutoAdvance}
                    />
                  </div>
                )}
              </div>
            </ResizablePanel>
            {!isTheater && <ResizableHandle withHandle />}
            <ResizablePanel
              ref={sidePanelRef as RefObject<PanelImperativeHandle>}
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
              {/* Tablet toggle bar: Video | Notes (E91-S09) */}
              <div
                className="hidden md:flex lg:hidden gap-1 bg-muted rounded-lg p-1 mb-4"
                role="tablist"
                aria-label="Content view"
                data-testid="tablet-toggle-bar"
              >
                <Button
                  variant={!state.tabletNotesOpen ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-1.5"
                  role="tab"
                  aria-selected={!state.tabletNotesOpen}
                  aria-controls="tablet-content-panel"
                  onClick={() => state.setTabletNotesOpen(false)}
                  data-testid="tablet-toggle-video"
                >
                  <Video className="size-4" aria-hidden="true" />
                  Video
                </Button>
                <Button
                  variant={state.tabletNotesOpen ? 'default' : 'ghost'}
                  size="sm"
                  className="flex-1 gap-1.5"
                  role="tab"
                  aria-selected={state.tabletNotesOpen}
                  aria-controls="tablet-content-panel"
                  onClick={() => state.setTabletNotesOpen(true)}
                  data-testid="tablet-toggle-notes"
                >
                  <PencilLine className="size-4" aria-hidden="true" />
                  Notes
                </Button>
              </div>

              {/* Tablet: show either video or notes based on toggle */}
              <div id="tablet-content-panel" {...(isTablet ? { role: 'tabpanel' } : {})}>
                {isTablet && state.tabletNotesOpen ? (
                  <NotesTab courseId={courseId!} lessonId={lessonId!} />
                ) : (
                  <>
                    {mainContent}
                    {state.lessonTypeResolved && (
                      <LessonHeaderCard
                        title={state.lessonTitle}
                        description={state.lessonDescription}
                        resourceTypes={resourceTypes}
                        tags={state.lessonTags}
                      />
                    )}
                    {quizButton}
                    {/* Auto-advance countdown after video ends */}
                    {state.showAutoAdvance && nextLesson && (
                      <div className="mt-4">
                        <AutoAdvanceCountdown
                          seconds={5}
                          nextLessonTitle={nextLesson.title}
                          onAdvance={completion.handleAutoAdvance}
                          onCancel={completion.handleCancelAutoAdvance}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Mobile sheet trigger — hidden on tablet when using toggle (E91-S09) */}
            {!isTablet && (
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
            )}
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
      {!capabilities.requiresNetwork && !state.isPdf && state.localVideoBlobUrl && (
        <MiniPlayer
          videoSrc={state.localVideoBlobUrl}
          currentTime={state.currentTime}
          isMainPlaying={state.isVideoPlaying}
          isVisible={!state.isVideoVisible && !state.isMiniPlayerDismissed}
          onClose={miniPlayer.handleMiniPlayerClose}
          onPlayPause={miniPlayer.handleMiniPlayerPlayPause}
        />
      )}

      {/* Next course suggestion card (E91-S08) */}
      {courseSuggestion && (
        <div className="mt-4">
          <NextCourseSuggestion
            suggestedCourse={courseSuggestion.course}
            sharedTags={courseSuggestion.sharedTags}
            thumbnailUrl={courseSuggestion.thumbnailUrl}
            onDismiss={() => state.setShowCourseSuggestion(false)}
          />
        </div>
      )}

      {/* Completion celebration modal (lesson or course level) */}
      <CompletionModal
        open={state.celebrationOpen}
        onOpenChange={completion.handleCelebrationOpenChange}
        type={state.celebrationType}
        title={state.celebrationTitle}
        stats={
          state.celebrationType === 'course'
            ? {
                lessonsCompleted: totalLessons,
                totalLessons,
                completionPercent: 100,
              }
            : undefined
        }
        onContinue={nextLesson ? completion.handleCelebrationContinue : undefined}
      />
    </div>
  )
}
