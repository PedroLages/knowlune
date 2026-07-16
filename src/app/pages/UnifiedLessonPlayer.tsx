/**
 * UnifiedLessonPlayer — Single lesson player for both local and YouTube courses.
 *
 * Layout: Classic horizontal split — video + below-video tabs on the left,
 * optional resizable notes panel, and a sticky sidebar with lesson list on
 * the right. Merges the classic LessonPlayer's layout and features with the
 * modern adapter-driven architecture.
 *
 * Sub-components:
 * - LessonContentRenderer: PDF, YouTube, or local video content
 * - LessonWorkspaceHeader: course context, title, progress, and lesson actions
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

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import { recordVisit } from '@/lib/searchFrecency'
import { ClipboardCheck } from 'lucide-react'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { useSessionTracking } from '@/app/hooks/useSessionTracking'
import { useLessonNavigation } from '@/app/hooks/useLessonNavigation'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { useLessonPlayerState } from '@/app/hooks/useLessonPlayerState'
import { useCompletionFlow } from '@/app/hooks/useCompletionFlow'
import { useMiniPlayerState } from '@/app/hooks/useMiniPlayerState'
import { useDeepLinkEffects } from '@/app/hooks/useDeepLinkEffects'
import { useFrameCapture } from '@/app/hooks/useFrameCapture'
import { useLessonSessionState } from '@/app/hooks/useLessonSessionState'

import { AutoAdvanceCountdown } from '@/app/components/figma/AutoAdvanceCountdown'
import { CompletionModal } from '@/app/components/celebrations/CompletionModal'
import { LessonContentRenderer } from '@/app/components/course/LessonContentRenderer'
import { BelowVideoTabs } from '@/app/components/course/BelowVideoTabs'
import { NotesPanel } from '@/app/components/course/NotesPanel'
import { FloatingNotesPanel } from '@/app/components/course/FloatingNotesPanel'
import { LessonNavigation } from '@/app/components/course/LessonNavigation'
import { LessonWorkspaceHeader } from '@/app/components/course/LessonWorkspaceHeader'
import { CourseSyllabusPanel } from '@/app/components/course/CourseSyllabusPanel'
import type { VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/app/components/ui/resizable'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/app/components/ui/drawer'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { usePanelRef } from 'react-resizable-panels'
import { useHasQuiz } from '@/hooks/useHasQuiz'
import { useQuizGeneration } from '@/hooks/useQuizGeneration'
import { GenerateQuizButton } from '@/app/components/figma/GenerateQuizButton'
import { QuizBadge } from '@/app/components/figma/QuizBadge'
import { useTheaterMode } from '@/app/hooks/useTheaterMode'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import { useNoteStore } from '@/stores/useNoteStore'
import { useReadingMode } from '@/hooks/useReadingMode'
import { ReadingModeStatusBar } from '@/app/components/figma/ReadingModeStatusBar'
import { ReadingToolbar } from '@/app/components/figma/ReadingToolbar'
import { ReadingProgressBar } from '@/app/components/figma/ReadingProgressBar'
import { ReadingModeDiscoveryTooltip } from '@/app/components/figma/ReadingModeDiscoveryTooltip'
import { ReadingModeTOC } from '@/app/components/figma/ReadingModeTOC'
import { MiniPlayer } from '@/app/components/course/MiniPlayer'
import { NextCourseSuggestion } from '@/app/components/NextCourseSuggestion'
import { NextInPath } from '@/app/components/NextInPath'
import { suggestNextCourse } from '@/lib/courseSuggestion'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useNextBestCourse } from '@/app/hooks/useNextBestCourse'

/** Type-safe accessor for boolean flags in React Router location.state. */
function parseLocationFlag(state: unknown, flag: string): boolean {
  if (typeof state !== 'object' || state === null) return false
  return (state as Record<string, unknown>)[flag] === true
}

function LessonWorkspaceSkeleton({ showSyllabus }: { showSyllabus: boolean }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1920px]" aria-hidden="true">
      <div className="mb-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="mb-4 h-4 w-56 max-w-[60%]" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-7 w-[min(34rem,80%)]" />
          </div>
          <Skeleton className="size-11 shrink-0" />
        </div>
      </div>

      <div className="flex min-w-0 gap-[min(var(--content-gap),1.5rem)]">
        <div className="min-w-0 flex-1">
          <Skeleton className="aspect-video max-h-[72svh] w-full rounded-2xl" />
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="hidden h-4 w-12 self-center sm:block" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="mt-4 h-14 w-full rounded-2xl" />
          <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
        </div>

        {showSyllabus ? (
          <aside className="hidden w-[clamp(352px,24vw,400px)] shrink-0 overflow-hidden rounded-2xl border border-border bg-card min-[1440px]:block">
            <div className="space-y-3 border-b border-border p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-1.5 w-full" />
            </div>
            <div className="space-y-3 p-4">
              <Skeleton className="h-11 w-full" />
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

export function UnifiedLessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Read auto-play intent from navigation state (set by auto-advance),
  // OR-combined with the user's persistent store preference so manual
  // navigation and initial page load also respect the auto-play toggle.
  const storeAutoPlay = useLessonChromeStore(s => s.autoPlay)
  const shouldAutoPlay = parseLocationFlag(location.state, 'autoPlay') || storeAutoPlay

  // Clear autoPlay state after consuming it (prevents re-trigger on refresh).
  // Scoped to parseLocationFlag only — using shouldAutoPlay (the OR-combined
  // value) would loop forever when storeAutoPlay is true since {} is truthy.
  // Spread existing state so fromTrack and other session flags are preserved;
  // only the autoPlay key is removed.
  useEffect(() => {
    if (parseLocationFlag(location.state, 'autoPlay') && location.state) {
      navigate(location.pathname, {
        replace: true,
        state: { ...location.state, autoPlay: undefined },
      })
    }
  }, [location.pathname, location.state, navigate])

  // R19: record visit on direct navigation. Skipped for palette-initiated
  // navigations to avoid openCount double-counting.
  useEffect(() => {
    if (!lessonId || lessonId === 'undefined') return
    if (parseLocationFlag(location.state, '__viaPalette')) return
    void recordVisit('lesson', lessonId)
  }, [lessonId, location.state])
  const { adapter, loading, error } = useCourseAdapter(courseId)

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)
  const adapterCourse = adapter?.getCourse?.()
  const courseName = adapterCourse?.name ?? course?.name ?? 'Course'

  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTabletNotesLayout = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isWideNotesLayout = useMediaQuery('(min-width: 1200px)')
  const isWideWorkspace = useMediaQuery('(min-width: 1440px)')
  const { isTheater, toggleTheater } = useTheaterMode()
  const isLesson = Boolean(courseId && lessonId)
  const {
    isReadingMode,
    exitReadingMode,
    announcement: readingModeAnnouncement,
  } = useReadingMode(isLesson)

  // B2: Use store-based notesOpen so LessonHeaderTools / BottomNav toggles control the panel.
  const notesOpen = useLessonChromeStore(s => s.notesOpen)
  const openNotesWithFocus = useLessonChromeStore(s => s.openNotesWithFocus)
  const focusNotesEditor = useLessonChromeStore(s => s.focusNotesEditor)
  const closeNotesPanel = useLessonChromeStore(s => s.resetNotesPanelOnLessonChange)
  const setNotesOpen = useLessonChromeStore(s => s.setNotesOpen)
  const syllabusOpen = useLessonChromeStore(s => s.syllabusOpen)
  const setSyllabusOpen = useLessonChromeStore(s => s.setSyllabusOpen)
  const toggleSyllabus = useLessonChromeStore(s => s.toggleSyllabus)
  const [syllabusOverlayOpen, setSyllabusOverlayOpen] = useState(false)

  // B3: Sync hasNotes to the store so indicator dots in LessonHeaderTools / BottomNav work.
  // useNoteStore.notes is replaced by NotesTab's loadNotesByLesson() on lesson change.
  const noteStoreNotes = useNoteStore(s => s.notes)
  useEffect(() => {
    if (!courseId || !lessonId) return
    const hasContent = noteStoreNotes.some(n => n.courseId === courseId && n.videoId === lessonId)
    useLessonChromeStore.getState().setHasNotes(hasContent)
  }, [noteStoreNotes, courseId, lessonId])
  const notesPanelRef = usePanelRef()
  const videoPlayerRef = useRef<VideoPlayerHandle>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const [floatingPanelPortalTarget, setFloatingPanelPortalTarget] = useState<HTMLDivElement | null>(
    null
  )
  const floatingPanelPortalRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setFloatingPanelPortalTarget(node)
  }, [])

  // Lesson navigation: prev/next lesson via adapter
  const {
    prevLesson,
    nextLesson,
    parentLesson,
    currentIndex,
    currentSection,
    totalLessons,
    lessons,
  } = useLessonNavigation(adapter, lessonId)

  // Quiz availability: check if a quiz exists for this lesson
  const { hasQuiz } = useHasQuiz(lessonId)

  // Quiz generation: hook for generating quizzes from transcripts
  const quizGen = useQuizGeneration(lessonId, courseId)

  // Progress store for marking lessons complete on video end
  const setItemStatus = useContentProgressStore(s => s.setItemStatus)
  const getItemStatus = useCallback(
    (c: string, l: string) => useContentProgressStore.getState().getItemStatus(c, l),
    []
  )
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)
  const statusMap = useContentProgressStore(s => s.statusMap)

  // Compute course progress percentage for the sidebar header
  const courseProgressPercent = useMemo(() => {
    if (!courseId || lessons.length === 0) return null
    const completed = lessons.filter(
      l => (statusMap[`${courseId}:${l.id}`] ?? 'not-started') === 'completed'
    ).length
    return Math.round((completed / lessons.length) * 100)
  }, [courseId, lessons, statusMap])

  // Compute "Lesson X of Y" display (1-indexed)
  const currentLessonPosition = useMemo(() => {
    return currentIndex >= 0 ? currentIndex + 1 : null
  }, [currentIndex])

  // Ensure course progress is loaded so getItemStatus has data for checkCourseCompletion.
  useEffect(() => {
    if (courseId) {
      loadCourseProgress(courseId)
    }
  }, [courseId, loadCourseProgress])

  // All local state: auto-advance, celebration, video time, mini-player, metadata, notes, etc.
  const state = useLessonPlayerState(adapter, lessonId)

  const { activeTool, setActiveTool } = useLessonSessionState({
    courseId: courseId ?? '',
    lessonId: lessonId ?? '',
    isPdf: state.isPdf,
    titleRef,
  })

  const handleFocusNotes = useCallback(() => {
    if (isWideNotesLayout) {
      if (notesOpen) {
        focusNotesEditor()
      } else {
        openNotesWithFocus()
      }
    } else {
      openNotesWithFocus()
      if (isMobile) {
        useLessonChromeStore.getState().setMobileNotesPanel('expanded')
      }
    }
  }, [isMobile, isWideNotesLayout, notesOpen, focusNotesEditor, openNotesWithFocus])

  // Close notes panel when navigating to a different lesson (R5b)
  useEffect(() => {
    closeNotesPanel()
  }, [lessonId, closeNotesPanel])

  // Track celebration modal open state in a ref for the ESC key handler.
  // Using a ref avoids re-registering the document-level keydown listener
  // every time the modal opens/closes, which would change its ordering
  // relative to Radix Dialog's own ESC listener.
  const celebrationOpenRef = useRef(state.celebrationOpen)
  celebrationOpenRef.current = state.celebrationOpen

  // Completion flow: celebrations, auto-advance, manual status toggle
  const completion = useCompletionFlow({
    courseId,
    lessonId,
    courseName: course?.name,
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

  // Cancel in-progress auto-advance countdown when user toggles autoPlay off
  useEffect(() => {
    if (!storeAutoPlay && state.showAutoAdvance) {
      completion.handleCancelAutoAdvance()
    }
  }, [storeAutoPlay, state.showAutoAdvance, completion.handleCancelAutoAdvance])

  // Mini-player callbacks
  const miniPlayer = useMiniPlayerState({
    videoPlayerRef,
    setIsVideoVisible: state.setIsVideoVisible,
    setIsVideoPlaying: state.setIsVideoPlaying,
    setIsMiniPlayerDismissed: state.setIsMiniPlayerDismissed,
    setLocalVideoBlobUrl: state.setLocalVideoBlobUrl,
  })

  const handlePlayStateChange = useCallback(
    (playing: boolean) => {
      miniPlayer.handlePlayStateChange(playing)
      if (!playing || !courseId || !lessonId || !adapter) return
      if (state.isPdf) return
      const sourceType = adapter.getSource()
      if (sourceType === 'youtube') return
      if (!state.lessonTypeResolved) return
      const st = useContentProgressStore.getState().getItemStatus(courseId, lessonId)
      if (st !== 'not-started') return
      void useContentProgressStore.getState().setItemStatus(courseId, lessonId, 'in-progress', [])
    },
    [
      miniPlayer.handlePlayStateChange,
      courseId,
      lessonId,
      adapter,
      state.isPdf,
      state.lessonTypeResolved,
    ]
  )

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
    setFocusTab: state.setFocusTab,
    isDesktop: !isMobile,
    openNotesWithFocus,
  })

  // Session tracking: start on mount, pause/resume on idle, end on leave.
  useSessionTracking(
    courseId,
    lessonId,
    state.lessonTypeResolved ? (state.isPdf ? 'pdf' : 'video') : null
  )

  // Notes panel: imperatively collapse/expand via usePanelRef API
  useEffect(() => {
    if (!isWideNotesLayout) return
    if (notesOpen) {
      notesPanelRef.current?.resize('40%')
    } else {
      notesPanelRef.current?.collapse()
    }
  }, [notesOpen, isWideNotesLayout, notesPanelRef])

  // Theater mode: DOM attribute managed by useLessonChromeStore (single source of truth).
  // Initialization from localStorage handled after store creation.

  // Theater mode: scroll to top so full video is visible
  useEffect(() => {
    if (isTheater) {
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [isTheater])

  // Theater mode: close notes panel when entering theater
  useEffect(() => {
    if (isTheater) {
      useLessonChromeStore.getState().resetNotesPanelOnLessonChange()
      setSyllabusOverlayOpen(false)
    }
  }, [isTheater])

  const handleSyllabusOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setNotesOpen(false)
        useLessonChromeStore.getState().setMobileNotesPanel('closed')
      }
      setSyllabusOverlayOpen(open)
    },
    [setNotesOpen]
  )

  const handleToggleSyllabus = useCallback(() => {
    if (isWideWorkspace) {
      toggleSyllabus()
      return
    }
    handleSyllabusOpenChange(!syllabusOverlayOpen)
  }, [handleSyllabusOpenChange, isWideWorkspace, syllabusOverlayOpen, toggleSyllabus])

  // Notes and syllabus overlays are mutually exclusive below the wide workspace breakpoint.
  useEffect(() => {
    if (notesOpen) setSyllabusOverlayOpen(false)
  }, [notesOpen])

  useEffect(() => {
    setSyllabusOverlayOpen(false)
  }, [lessonId])

  // Keyboard shortcut: T toggles theater mode (only when not in input/textarea)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) {
        return
      }
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (target?.isContentEditable || target?.closest('[role="dialog"]')) return
      if (e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleToggleSyllabus()
        return
      }
      if (!e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        toggleTheater()
      }
      // ESC exits theater mode (but not when celebration modal is open; the
      // Radix Dialog's own ESC handler closes the dialog first)
      if (e.key === 'Escape' && isTheater && !celebrationOpenRef.current) {
        e.preventDefault()
        toggleTheater()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleToggleSyllabus, toggleTheater, isTheater])

  // Next course suggestion (E91-S08) — computed via useMemo
  const courseSuggestion = useMemo(() => {
    if (!state.showCourseSuggestion || !courseId) return null
    const suggestion = suggestNextCourse(courseId, importedCourses)
    if (!suggestion) return null
    const thumbnailUrl = suggestion.course.youtubeThumbnailUrl ?? null
    return { ...suggestion, thumbnailUrl }
  }, [state.showCourseSuggestion, courseId, importedCourses])

  // Path-based next course suggestion (R9, R10)
  const allPathEntries = useLearningPathStore(s => s.entries)
  const paths = useLearningPathStore(s => s.paths)

  const pathContext = useMemo(() => {
    if (!courseId) return null
    const matchingEntry = allPathEntries.find(e => e.courseId === courseId)
    if (!matchingEntry) return null
    const path = paths.find(p => p.id === matchingEntry.pathId)
    if (!path || path.isTemplate) return null
    return { pathId: matchingEntry.pathId, pathName: path.name }
  }, [allPathEntries, courseId, paths])

  const coursePathId = pathContext?.pathId ?? ''
  const nextBest = useNextBestCourse(coursePathId)

  const pathSuggestion = useMemo(() => {
    if (!state.showCourseSuggestion || !courseId || !pathContext) return null
    const isLastInPath = nextBest.action === 'complete' || nextBest.action === null
    return {
      pathName: pathContext.pathName,
      courseName,
      isLastInPath,
      nextCourseId: !isLastInPath ? (nextBest.entry?.courseId ?? null) : null,
      nextTargetLessonId: !isLastInPath ? nextBest.targetLessonId : null,
      pathId: pathContext.pathId,
    }
  }, [state.showCourseSuggestion, courseId, pathContext, nextBest, courseName])

  // Loading state
  if (loading) {
    return (
      <DelayedFallback>
        <div
          data-testid="lesson-player-content"
          className="flex h-full flex-col"
          role="status"
          aria-busy="true"
          aria-label="Loading lesson"
        >
          <LessonWorkspaceSkeleton showSyllabus={isWideWorkspace && syllabusOpen} />
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
  const displayLessonTitle = state.lessonTitle.replace(/\.\w{2,4}$/, '')
  const currentLessonStatus = lessonId
    ? (statusMap[`${courseId}:${lessonId}`] ?? 'not-started')
    : 'not-started'

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
      <div className="relative">
        <div
          ref={videoContainerRef}
          className={cn(
            'relative mb-3 w-full overflow-hidden',
            !state.isPdf &&
              !isTheater &&
              'aspect-video max-h-[65svh] xl:max-h-[72svh] 2xl:max-h-[78svh]',
            !state.isPdf && isTheater && 'h-[calc(100svh-1rem)]'
          )}
          data-testid="video-container"
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
            onFocusNotes={handleFocusNotes}
            onVisibilityChange={miniPlayer.handleVideoVisibilityChange}
            onPlayStateChange={handlePlayStateChange}
            onBlobUrlReady={state.setLocalVideoBlobUrl}
            theaterMode={isTheater}
            onTheaterModeToggle={toggleTheater}
            onBookmarkSeek={state.handleTranscriptSeek}
            autoplay={shouldAutoPlay}
          />
        </div>

        {/* Portal target for FloatingNotesPanel — sibling to video container,
            positioned absolutely over it. Rendered outside overflow-hidden
            so the floating panel (which uses fixed positioning) has the right
            stacking context and is not clipped. */}
        <div ref={floatingPanelPortalRef} className="absolute inset-0 pointer-events-none" />

        {/* Floating notes panel (mobile only, portal-rendered into the sibling div above) */}
        {isMobile && (
          <FloatingNotesPanel
            courseId={courseId!}
            lessonId={lessonId!}
            currentTime={state.currentTime}
            onSeek={state.handleTranscriptSeek}
            onCaptureFrame={handleCaptureFrame}
            portalTarget={floatingPanelPortalTarget}
          />
        )}
      </div>

      {capabilities.supportsPrevNext ? (
        <LessonNavigation
          courseId={courseId!}
          prevLesson={prevLesson}
          nextLesson={nextLesson}
          parentLesson={parentLesson}
          currentIndex={currentIndex}
          totalLessons={totalLessons}
          isCurrentCompleted={currentLessonStatus === 'completed'}
          onNavigate={() => setSyllabusOverlayOpen(false)}
        />
      ) : null}

      {/* Auto-advance countdown — fixed overlay, no spacing wrapper needed */}
      {state.showAutoAdvance && nextLesson && (
        <AutoAdvanceCountdown
          seconds={5}
          nextLessonTitle={nextLesson.title}
          onAdvance={completion.handleAutoAdvance}
          onCancel={completion.handleCancelAutoAdvance}
        />
      )}

      {/* Lesson description/tags — only shown when there's actual content */}
      {state.lessonTypeResolved &&
        ((state.lessonDescription && source !== 'youtube') ||
          (state.lessonTags && state.lessonTags.length > 0)) && (
          <div className="bg-card rounded-2xl shadow-sm p-5 mt-4">
            {state.lessonDescription && source !== 'youtube' && (
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
          aiAvailable={quizGen.aiAvailable}
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
        hideNotesTab={isWideNotesLayout && notesOpen}
        onCaptureFrame={handleCaptureFrame}
        courseName={courseName}
        lessonTitle={state.lessonTitle}
        lessonPosition={
          currentLessonPosition && totalLessons
            ? `${currentLessonPosition} of ${totalLessons}`
            : undefined
        }
        activeTool={activeTool}
        onActiveToolChange={setActiveTool}
      />
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
      <div className="mx-auto w-full min-w-0 max-w-[1920px]" data-testid="lesson-workspace-frame">
        {!isTheater ? (
          <div data-theater-hide>
            <LessonWorkspaceHeader
              courseId={courseId!}
              courseName={courseName}
              sectionTitle={currentSection}
              lessonTitle={displayLessonTitle}
              currentPosition={currentLessonPosition}
              totalLessons={totalLessons}
              titleRef={titleRef}
              syllabusVisible={isWideWorkspace ? syllabusOpen && !notesOpen : syllabusOverlayOpen}
              onToggleSyllabus={handleToggleSyllabus}
            />
          </div>
        ) : null}

        <div className="flex min-w-0 gap-[min(var(--content-gap),1.5rem)]">
          <div className="min-w-0 flex-1">
            {isWideNotesLayout ? (
              <ResizablePanelGroup
                orientation="horizontal"
                className="min-w-0"
                // eslint-disable-next-line react-best-practices/no-inline-styles -- overflow:visible preserves the page-level scroll model
                style={{ overflow: 'visible' }}
              >
                <ResizablePanel defaultSize={notesOpen ? '65%' : '100%'} minSize="55%">
                  <div data-testid="lesson-content-scroll">{mainContent}</div>
                </ResizablePanel>

                <ResizableHandle
                  withHandle={notesOpen}
                  disabled={!notesOpen}
                  className={cn(notesOpen ? 'mx-2' : 'invisible w-0')}
                  onDoubleClick={() => notesPanelRef.current?.resize('35%')}
                />

                <ResizablePanel
                  panelRef={notesPanelRef}
                  collapsible
                  collapsedSize="0%"
                  defaultSize={notesOpen ? '35%' : '0%'}
                  minSize="30%"
                  maxSize="40%"
                >
                  {notesOpen ? (
                    <div className="flex h-full min-h-0 flex-col">
                      <NotesPanel
                        courseId={courseId!}
                        lessonId={lessonId!}
                        currentTime={state.currentTime}
                        onSeek={state.handleTranscriptSeek}
                        onClose={closeNotesPanel}
                        onCaptureFrame={handleCaptureFrame}
                        isTheater={isTheater}
                      />
                    </div>
                  ) : null}
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              <div data-testid="lesson-content-scroll">{mainContent}</div>
            )}
          </div>

          <CourseSyllabusPanel
            courseId={courseId!}
            lessonId={lessonId!}
            courseName={courseName}
            adapter={adapter}
            currentPosition={currentLessonPosition}
            totalLessons={totalLessons}
            progressPercent={courseProgressPercent}
            inlineOpen={syllabusOpen && !notesOpen && !isTheater}
            overlayOpen={syllabusOverlayOpen && !isTheater}
            onInlineClose={() => setSyllabusOpen(false)}
            onOverlayOpenChange={handleSyllabusOpenChange}
            onFocusMaterials={state.handleFocusMaterials}
          />
        </div>
      </div>

      {isTabletNotesLayout ? (
        <Drawer open={notesOpen} onOpenChange={setNotesOpen}>
          <DrawerContent className="max-h-[85svh] overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Lesson Notes</DrawerTitle>
              <DrawerDescription>Write and review notes for this lesson.</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-hidden pt-3">
              <NotesPanel
                courseId={courseId!}
                lessonId={lessonId!}
                currentTime={state.currentTime}
                onSeek={state.handleTranscriptSeek}
                onClose={closeNotesPanel}
                onCaptureFrame={handleCaptureFrame}
                isTheater={isTheater}
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : !isWideNotesLayout && !isMobile ? (
        <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
          <SheetContent
            side="right"
            showCloseButton={false}
            className="w-[420px] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[420px]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Lesson Notes</SheetTitle>
              <SheetDescription>Write and review notes for this lesson.</SheetDescription>
            </SheetHeader>
            <NotesPanel
              courseId={courseId!}
              lessonId={lessonId!}
              currentTime={state.currentTime}
              onSeek={state.handleTranscriptSeek}
              onClose={closeNotesPanel}
              onCaptureFrame={handleCaptureFrame}
              isTheater={isTheater}
            />
          </SheetContent>
        </Sheet>
      ) : null}

      {/* Mini-player for local video lessons (E91-S04) */}
      {!capabilities.requiresNetwork && !state.isPdf && state.localVideoBlobUrl && (
        <MiniPlayer
          videoSrc={state.localVideoBlobUrl}
          currentTime={state.currentTime}
          isMainPlaying={state.isVideoPlaying}
          isVisible={!state.isVideoVisible && !state.isMiniPlayerDismissed}
          onClose={miniPlayer.handleMiniPlayerClose}
          onPlayPause={miniPlayer.handleMiniPlayerPlayPause}
          onScrollToVideo={() => {
            document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      {/* Next course suggestion — path-based or tag-based (R9, R10, E91-S08) */}
      {pathSuggestion ? (
        <div className="mt-4">
          <NextInPath
            pathName={pathSuggestion.pathName}
            courseName={pathSuggestion.courseName}
            isLastInPath={pathSuggestion.isLastInPath}
            nextCourseId={pathSuggestion.nextCourseId}
            nextTargetLessonId={pathSuggestion.nextTargetLessonId}
            pathId={pathSuggestion.pathId}
            onDismiss={() => state.setShowCourseSuggestion(false)}
          />
        </div>
      ) : courseSuggestion ? (
        <div className="mt-4">
          <NextCourseSuggestion
            suggestedCourse={courseSuggestion.course}
            sharedTags={courseSuggestion.sharedTags}
            thumbnailUrl={courseSuggestion.thumbnailUrl}
            onDismiss={() => state.setShowCourseSuggestion(false)}
          />
        </div>
      ) : null}

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
