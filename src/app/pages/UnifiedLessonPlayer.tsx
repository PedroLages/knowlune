/**
 * UnifiedLessonPlayer — Single lesson player for both local and YouTube courses.
 *
 * Layout: Classic horizontal split — video + below-video tabs on the left,
 * optional resizable notes panel, and a sticky sidebar with lesson list on
 * the right. Merges the classic LessonPlayer's layout and features with the
 * modern adapter-driven architecture.
 *
 * Sub-components:
 * - PlayerHeader: action toolbar (Pomodoro, Q&A, theater, notes, completion)
 * - LessonContentRenderer: PDF, YouTube, or local video content
 * - LessonHeaderCard: title, description, badges, tags, actions slot
 * - BelowVideoTabs: Notes, Bookmarks, Transcript, AI Summary, Materials
 * - NotesPanel: resizable desktop side panel for note-taking
 * - LessonsTab: sidebar lesson list with search
 * - AutoAdvanceCountdown: auto-advance to next lesson after video ends
 *
 * Hooks:
 * - useLessonPlayerState: all local state, metadata resolution, reset-on-change
 * - useCompletionFlow: celebration modals, auto-advance, manual status change
 * - useMiniPlayerState: mini-player visibility/playback callbacks
 * - useDeepLinkEffects: ?t= seek and ?panel=notes deep-linking
 * - useLessonFocusEffects: scroll-to-top and title focus on lesson change
 * - useFrameCapture: video frame capture for NoteEditor
 *
 * @see E89-S05, E89-S06, E89-S07, E89-S08
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  PanelRight,
  PencilLine,
  Video,
  ClipboardCheck,
} from 'lucide-react'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { useSessionTracking } from '@/app/hooks/useSessionTracking'
import { useLessonNavigation } from '@/app/hooks/useLessonNavigation'
import { useIsDesktop, useIsTablet } from '@/app/hooks/useMediaQuery'
import { useLessonPlayerState } from '@/app/hooks/useLessonPlayerState'
import { useCompletionFlow } from '@/app/hooks/useCompletionFlow'
import { useMiniPlayerState } from '@/app/hooks/useMiniPlayerState'
import { useDeepLinkEffects } from '@/app/hooks/useDeepLinkEffects'
import { useLessonFocusEffects } from '@/app/hooks/useLessonFocusEffects'
import { useFrameCapture } from '@/app/hooks/useFrameCapture'
import { PlayerHeader } from '@/app/components/course/PlayerHeader'
import { AutoAdvanceCountdown } from '@/app/components/figma/AutoAdvanceCountdown'
import { CompletionModal } from '@/app/components/celebrations/CompletionModal'
import { LessonContentRenderer } from '@/app/components/course/LessonContentRenderer'
import { BelowVideoTabs } from '@/app/components/course/BelowVideoTabs'
import { NotesPanel } from '@/app/components/course/NotesPanel'
import { LessonsTab } from '@/app/components/course/tabs/LessonsTab'
import { NotesTab } from '@/app/components/course/tabs/NotesTab'
import type { VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/app/components/ui/resizable'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { usePanelRef } from 'react-resizable-panels'
import { useHasQuiz } from '@/hooks/useHasQuiz'
import { useQuizGeneration } from '@/hooks/useQuizGeneration'
import { GenerateQuizButton } from '@/app/components/figma/GenerateQuizButton'
import { QuizBadge } from '@/app/components/figma/QuizBadge'
import { useTheaterMode } from '@/app/hooks/useTheaterMode'
import { useReadingMode } from '@/hooks/useReadingMode'
import { ReadingModeStatusBar } from '@/app/components/figma/ReadingModeStatusBar'
import { ReadingToolbar } from '@/app/components/figma/ReadingToolbar'
import { ReadingProgressBar } from '@/app/components/figma/ReadingProgressBar'
import { ReadingModeDiscoveryTooltip } from '@/app/components/figma/ReadingModeDiscoveryTooltip'
import { ReadingModeTOC } from '@/app/components/figma/ReadingModeTOC'
import { MiniPlayer } from '@/app/components/course/MiniPlayer'
import { NextCourseSuggestion } from '@/app/components/NextCourseSuggestion'
import { suggestNextCourse } from '@/lib/courseSuggestion'

export function UnifiedLessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const { adapter, loading, error } = useCourseAdapter(courseId)

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)
  const adapterCourse = adapter?.getCourse?.()
  const courseName = adapterCourse?.name ?? course?.name ?? 'Course'

  const isDesktop = useIsDesktop()
  const isTablet = useIsTablet()
  const { isTheater, toggleTheater } = useTheaterMode()
  const isLesson = Boolean(courseId && lessonId)
  const {
    isReadingMode,
    toggleReadingMode,
    exitReadingMode,
    announcement: readingModeAnnouncement,
  } = useReadingMode(isLesson)
  const notesPanelRef = usePanelRef()
  const videoPlayerRef = useRef<VideoPlayerHandle>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  // Sticky toolbar detection: sentinel element goes above toolbar,
  // when it scrolls out of view the toolbar is "stuck" at the top
  const toolbarSentinelRef = useRef<HTMLDivElement>(null)
  const [isToolbarStuck, setIsToolbarStuck] = useState(false)

  useEffect(() => {
    const sentinel = toolbarSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsToolbarStuck(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Lesson navigation: prev/next lesson via adapter
  const { prevLesson, nextLesson, totalLessons, lessons } = useLessonNavigation(adapter, lessonId)

  // Quiz availability: check if a quiz exists for this lesson
  const { hasQuiz } = useHasQuiz(lessonId)

  // Quiz generation: hook for generating quizzes from transcripts
  const quizGen = useQuizGeneration(lessonId, courseId)

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

  // All local state: auto-advance, celebration, video time, mini-player, metadata, notes, etc.
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

  // Frame capture for NoteEditor
  const { handleCaptureFrame } = useFrameCapture({
    courseId,
    lessonId,
    videoPlayerRef,
    isPdf: state.isPdf,
  })

  // Deep-linking: ?t=<seconds> and ?panel=notes
  useDeepLinkEffects({
    setSeekToTime: state.setSeekToTime,
    setNotesOpen: state.setNotesOpen,
    setFocusTab: state.setFocusTab,
  })

  // Scroll-to-top + title focus on lesson change
  useLessonFocusEffects(lessonId, titleRef)

  // Session tracking: start on mount, pause/resume on idle, end on leave.
  useSessionTracking(
    courseId,
    lessonId,
    state.lessonTypeResolved ? (state.isPdf ? 'pdf' : 'video') : null
  )

  // Notes panel: imperatively collapse/expand via usePanelRef API
  useEffect(() => {
    if (!isDesktop) return
    if (state.notesOpen) {
      notesPanelRef.current?.resize('40%')
    } else {
      notesPanelRef.current?.collapse()
    }
  }, [state.notesOpen, isDesktop, notesPanelRef])

  // Theater mode: sync to <html> data attribute so Layout can hide the left sidebar
  useEffect(() => {
    if (isTheater) {
      document.documentElement.setAttribute('data-theater-mode', 'true')
    } else {
      document.documentElement.removeAttribute('data-theater-mode')
    }
    return () => document.documentElement.removeAttribute('data-theater-mode')
  }, [isTheater])

  // Theater mode: scroll to top so full video is visible
  useEffect(() => {
    if (isTheater) {
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [isTheater])

  // Theater mode: close notes panel when entering theater
  useEffect(() => {
    if (isTheater) {
      state.setNotesOpen(false)
    }
  }, [isTheater, state.setNotesOpen])

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
      // Note: ESC in theater mode is handled exclusively by VideoPlayer's internal
      // handler (cascading priority: loop markers → theater mode). No duplicate here.
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

  // Main scrollable content: video, tabs, prev/next
  const mainContent = (
    <>
      {/* Video/PDF Content */}
      <div
        ref={videoContainerRef}
        className={cn(
          'relative mb-3 w-full overflow-hidden',
          !state.isPdf && !isTheater && 'aspect-video max-h-[65svh] xl:max-h-[72svh] 2xl:max-h-[78svh]',
          !state.isPdf && isTheater && 'h-[calc(100svh-1rem)]'
        )}
      >
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
          theaterMode={isTheater}
          onTheaterModeToggle={toggleTheater}
          onBookmarkSeek={state.handleTranscriptSeek}
        />
      </div>

      {/* Lesson title — below video, matching YouTube/Udemy/Coursera pattern */}
      <h1 className="text-lg font-semibold mt-3 mb-1 truncate text-center" data-testid="lesson-title">
        {state.lessonTitle.replace(/\.\w{2,4}$/, '')}
      </h1>

      {/* Auto-advance countdown */}
      {state.showAutoAdvance && nextLesson && (
        <div className="mb-5">
          <AutoAdvanceCountdown
            seconds={5}
            nextLessonTitle={nextLesson.title}
            onAdvance={completion.handleAutoAdvance}
            onCancel={completion.handleCancelAutoAdvance}
          />
        </div>
      )}

      {/* Lesson description/tags — only shown when there's actual content */}
      {state.lessonTypeResolved &&
        (state.lessonDescription || (state.lessonTags && state.lessonTags.length > 0)) && (
          <div className="bg-card rounded-2xl shadow-sm p-5 mt-4">
            {state.lessonDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {state.lessonDescription}
              </p>
            )}
            {state.lessonTags && state.lessonTags.length > 0 && (
              <div className={cn('flex flex-wrap gap-1', state.lessonDescription && 'mt-3')}>
                {state.lessonTags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs text-brand"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

      {quizButton}

      {/* Quiz generation controls: Generate/Regenerate button with Bloom's picker */}
      <div className="mt-4">
        <GenerateQuizButton
          isGenerating={quizGen.isGenerating}
          ollamaAvailable={quizGen.ollamaAvailable}
          checkingAvailability={quizGen.checkingAvailability}
          cachedQuiz={quizGen.cachedQuiz}
          onGenerate={quizGen.generate}
          onRegenerate={quizGen.regenerate}
        />
        {quizGen.quiz && (
          <div className="mt-2">
            <QuizBadge />
          </div>
        )}
      </div>

      {/* Below-video tabs: Notes, Bookmarks, Transcript, AI Summary, Materials */}
      <BelowVideoTabs
        courseId={courseId!}
        lessonId={lessonId!}
        adapter={adapter}
        currentTime={state.currentTime}
        onSeek={state.handleTranscriptSeek}
        focusTab={state.focusTab}
        focusTabKey={state.focusTabCounter.current}
        isPdf={state.isPdf}
        hideNotesTab={isDesktop && state.notesOpen}
        onCaptureFrame={handleCaptureFrame}
      />

      {/* Inline prev/next navigation (classic style, inside scroll) */}
      {capabilities.supportsPrevNext && (
        <div className="flex items-center justify-between mt-6">
          {prevLesson ? (
            <Button
              variant="outline"
              onClick={() => navigate(`/courses/${courseId}/lessons/${prevLesson.id}`)}
            >
              <ChevronLeft className="mr-1 size-4" aria-hidden="true" />
              Previous
            </Button>
          ) : (
            <div />
          )}
          {nextLesson ? (
            <Button
              variant="brand"
              onClick={() => navigate(`/courses/${courseId}/lessons/${nextLesson.id}`)}
            >
              Next
              <ChevronRight className="ml-1 size-4" aria-hidden="true" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      )}
    </>
  )

  return (
    <div
      data-testid="lesson-player-content"
      data-theater-mode={isTheater ? 'true' : 'false'}
      className="flex flex-col"
    >
      {/* First-time reading mode discovery tooltip */}
      <ReadingModeDiscoveryTooltip />

      {/* Reading mode status bar, toolbar, and progress bar */}
      {isReadingMode && (
        <>
          <ReadingModeStatusBar
            lessonTitle={state.lessonTitle}
            onBack={() => navigate(`/courses/${courseId}`)}
            onClose={exitReadingMode}
          />
          <ReadingProgressBar />
          <ReadingToolbar />
          <ReadingModeTOC isReadingMode={isReadingMode} />
        </>
      )}

      {/* Aria-live region for reading mode announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {readingModeAnnouncement}
      </div>
      {/* Sentinel: when this scrolls out of view, toolbar is "stuck" */}
      <div ref={toolbarSentinelRef} className="h-0 shrink-0" aria-hidden="true" />
      {/* Slim toolbar: back arrow + course name (left), action buttons (right) */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-2 shrink-0 sticky top-0 z-10 transition-all duration-200',
          isToolbarStuck
            ? 'bg-card/95 backdrop-blur-sm shadow-lg shadow-black/20 border-b border-border/50 rounded-none -mx-6 px-6'
            : 'border border-border/30 bg-card/50 rounded-xl -mt-3 mb-3'
        )}
        data-theater-hide
      >
        <Link
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          aria-label="Back to course"
        >
          <ArrowLeft className="size-5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="truncate max-w-[200px] sm:max-w-[300px]">{courseName}</span>
        </Link>
        <div className="flex-1" />
        <PlayerHeader
          courseId={courseId!}
          lessonId={lessonId!}
          showCompletionToggle={
            state.isPdf || capabilities.requiresNetwork || capabilities.hasVideo
          }
          onStatusChange={completion.handleManualStatusChange}
          isTheater={isTheater}
          onToggleTheater={toggleTheater}
          notesOpen={state.notesOpen}
          onToggleNotes={state.handleNotesToggle}
          onToggleReadingMode={toggleReadingMode}
          isReadingMode={isReadingMode}
        />
      </div>

      {/* Content area: classic horizontal layout — scrolls via #main-content (no nested scroll) */}
      {isDesktop ? (
        <div className={cn('flex gap-[var(--content-gap)]')}>
          {/* Main content + Notes panel (resizable) */}
          <ResizablePanelGroup
            orientation="horizontal"
            className="flex-1 min-w-0"
            // eslint-disable-next-line react-best-practices/no-inline-styles -- overflow:visible needed for sticky sidebar
            style={{ overflow: 'visible' }}
          >
            <ResizablePanel defaultSize={state.notesOpen ? '60%' : '100%'} minSize="40%">
              <div data-testid="lesson-content-scroll">{mainContent}</div>
            </ResizablePanel>

            <ResizableHandle
              withHandle={state.notesOpen}
              disabled={!state.notesOpen}
              className={cn(state.notesOpen ? 'mx-2' : 'invisible w-0')}
              onDoubleClick={() => notesPanelRef.current?.resize('40%')}
            />

            <ResizablePanel
              panelRef={notesPanelRef}
              collapsible
              collapsedSize="0%"
              defaultSize={state.notesOpen ? '40%' : '0%'}
              minSize="25%"
            >
              {state.notesOpen && (
                <NotesPanel
                  courseId={courseId!}
                  lessonId={lessonId!}
                  currentTime={state.currentTime}
                  onSeek={state.handleTranscriptSeek}
                  onClose={state.handleNotesToggle}
                  onCaptureFrame={handleCaptureFrame}
                  pendingFocus={state.pendingNoteFocus}
                  onFocusComplete={() => state.setPendingNoteFocus(false)}
                  isTheater={isTheater}
                />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* Sticky sidebar: lesson list (hidden in theater or when notes panel open) */}
          <div
            data-testid="desktop-sidebar"
            className={cn(
              'sticky top-0 self-start flex-shrink-0 w-96 bg-card rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100svh-3rem)]',
              isTheater || state.notesOpen ? 'hidden' : 'hidden lg:flex'
            )}
          >
            <div className="px-4 py-3 border-b border-border flex-shrink-0">
              <h3 className="text-sm font-semibold truncate">{course?.name ?? 'Course Content'}</h3>
              <p className="text-xs text-muted-foreground">Course Content</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <LessonsTab courseId={courseId!} lessonId={lessonId!} adapter={adapter} onFocusMaterials={state.handleFocusMaterials} />
            </div>
          </div>
        </div>
      ) : (
        /* Mobile + Tablet: stacked layout */
        <div className={cn(!isTheater && 'mt-3')}>
          {/* Tablet Video/Notes toggle */}
          {isTablet && (
            <div
              data-testid="tablet-view-toggle"
              className="flex gap-1 mb-4 bg-muted rounded-lg p-1"
            >
              <Button
                variant={!state.tabletNotesOpen ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => state.setTabletNotesOpen(false)}
              >
                <Video className="size-4" aria-hidden="true" />
                Video
              </Button>
              <Button
                variant={state.tabletNotesOpen ? 'default' : 'ghost'}
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() => state.setTabletNotesOpen(true)}
              >
                <PencilLine className="size-4" aria-hidden="true" />
                Notes
              </Button>
            </div>
          )}

          {/* On tablet with notes open: show NotesTab instead of video+tabs */}
          {isTablet && state.tabletNotesOpen ? (
            <NotesTab
              courseId={courseId!}
              lessonId={lessonId!}
              onSeek={state.handleTranscriptSeek}
              currentTime={state.currentTime}
              onCaptureFrame={handleCaptureFrame}
            />
          ) : (
            mainContent
          )}

          {/* Mobile sheet trigger for lesson list */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="fixed bottom-16 right-4 z-50 rounded-full shadow-lg md:bottom-4"
                aria-label="Open course lesson list"
              >
                <PanelRight className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh]">
              <SheetTitle className="text-sm px-4 pt-2 flex-shrink-0">
                {course?.name ?? 'Course Content'}
              </SheetTitle>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <LessonsTab courseId={courseId!} lessonId={lessonId!} adapter={adapter} onFocusMaterials={state.handleFocusMaterials} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Mini-player for local video lessons (E91-S04) */}
      {!capabilities.requiresNetwork && !state.isPdf && state.localVideoBlobUrl && (
        <MiniPlayer
          videoSrc={state.localVideoBlobUrl}
          currentTime={state.currentTime}
          isMainPlaying={state.isVideoPlaying}
          isVisible={!state.isVideoVisible && state.isVideoPlaying && !state.isMiniPlayerDismissed}
          onClose={miniPlayer.handleMiniPlayerClose}
          onPlayPause={miniPlayer.handleMiniPlayerPlayPause}
          onScrollToVideo={() => {
            document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })
          }}
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
