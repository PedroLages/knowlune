import { useParams, Link, useNavigate } from 'react-router'
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, Circle, Menu } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet'
import { VideoPlayer } from '../components/figma/VideoPlayer'
import { cn } from '../components/ui/utils'
import { useIntersectionObserver } from '@/app/hooks/useIntersectionObserver'
import { TranscriptPanel } from '../components/figma/TranscriptPanel'
import { PdfViewer } from '../components/figma/PdfViewer'
import { ModuleAccordion } from '../components/figma/ModuleAccordion'
import { AutoAdvanceCountdown } from '../components/figma/AutoAdvanceCountdown'
import { ResourceBadge } from '../components/figma/ResourceBadge'
import { NoteEditor } from '../components/notes/NoteEditor'
import { CompletionModal, type CelebrationType } from '../components/celebrations/CompletionModal'
import { BookmarksList } from '../components/BookmarksList'
import { allCourses } from '@/data/courses'
import { getResourceUrl } from '@/lib/media'
import {
  getProgress,
  markLessonComplete,
  markLessonIncomplete,
  saveVideoPosition,
  savePdfPage,
  getPdfPage,
  saveNote,
  getNote,
  isLessonComplete,
} from '@/lib/progress'
import { addBookmark, getLessonBookmarks, formatBookmarkTimestamp } from '@/lib/bookmarks'
import { toast } from 'sonner'

export function LessonPlayer() {
  const { courseId, lessonId } = useParams<{
    courseId: string
    lessonId: string
  }>()
  const navigate = useNavigate()

  const course = allCourses.find(c => c.id === courseId)

  const { lesson, allLessons, currentIndex } = (() => {
    if (!course) return { lesson: null, allLessons: [], currentIndex: -1 }
    const all = course.modules.flatMap(m => m.lessons)
    const idx = all.findIndex(l => l.id === lessonId)
    return { lesson: all[idx] ?? null, allLessons: all, currentIndex: idx }
  })()

  const progress = course ? getProgress(course.id) : null
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [completed, setCompleted] = useState(() =>
    courseId && lessonId ? isLessonComplete(courseId, lessonId) : false
  )
  const [noteText, setNoteText] = useState('')

  const [seekToTime, setSeekToTime] = useState<number | undefined>(undefined)
  const [bookmarks, setBookmarks] = useState<import('@/data/types').VideoBookmark[]>([])

  // Celebration modal state
  const [celebrationModal, setCelebrationModal] = useState(false)
  const [celebrationType, setCelebrationType] = useState<CelebrationType>('lesson')
  const [celebrationTitle, setCelebrationTitle] = useState('')

  // Auto-advance countdown state
  const [showAutoAdvance, setShowAutoAdvance] = useState(false)

  // Mini-player + theater mode state
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const videoWrapperRef = useRef<HTMLDivElement>(null)
  const intersectionOptions = { threshold: 0.3 }
  const isVideoIntersecting = useIntersectionObserver(videoWrapperRef, intersectionOptions)
  const isMiniPlayer = !isVideoIntersecting && isVideoPlaying

  const handleTheaterModeToggle = () => setIsTheaterMode((prev) => !prev)

  // Sync theater mode to <html> data attribute so Layout can hide the left sidebar via CSS
  useEffect(() => {
    if (isTheaterMode) {
      document.documentElement.setAttribute('data-theater-mode', 'true')
    } else {
      document.documentElement.removeAttribute('data-theater-mode')
    }
    return () => document.documentElement.removeAttribute('data-theater-mode')
  }, [isTheaterMode])

  // Scroll to top when entering theater mode so the full video is visible without scrolling
  useEffect(() => {
    if (isTheaterMode) {
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [isTheaterMode])

  const handleMiniPlayerClick = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    videoWrapperRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'instant' : 'smooth',
      block: 'start',
    })
  }

  // Reset auto-advance and completion state when lesson changes
  useEffect(() => {
    setShowAutoAdvance(false)
    if (courseId && lessonId) {
      setCompleted(isLessonComplete(courseId, lessonId))
      getNote(courseId, lessonId).then(setNoteText)
    }
  }, [courseId, lessonId])

  // Update bookmarks when lesson changes
  useEffect(() => {
    if (courseId && lessonId) {
      getLessonBookmarks(courseId, lessonId).then(setBookmarks)
    }
  }, [courseId, lessonId])

  // Scroll to top when navigating to a new lesson
  useEffect(() => {
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'instant' })
  }, [lessonId])

  // Focus management for accessibility
  // preventScroll: true so focus doesn't undo the scroll-to-top effect above
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true })
  }, [lessonId])

  // Resume toast — show "Resuming from MM:SS" when restoring a saved position
  const hasShownResumeToast = useRef(false)

  useEffect(() => {
    hasShownResumeToast.current = false
  }, [lessonId])

  useEffect(() => {
    if (
      !hasShownResumeToast.current &&
      progress?.lastWatchedLesson === lessonId &&
      progress?.lastVideoPosition &&
      progress.lastVideoPosition > 0
    ) {
      hasShownResumeToast.current = true
      toast(`Resuming from ${formatBookmarkTimestamp(progress.lastVideoPosition)}`, { duration: 2000 })
    }
  }, [progress, lessonId])

  const prevLesson = currentIndex > 0 ? allLessons[currentIndex - 1] : null
  const nextLesson = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null

  const videoResource = lesson?.resources.find(r => r.type === 'video')
  const captionSrc = videoResource?.metadata?.captions?.[0]?.src
  const videoChapters = videoResource?.metadata?.chapters
  const allPdfResources = lesson?.resources.filter(r => r.type === 'pdf') ?? []
  // When no video exists, promote first PDF to primary content
  const primaryPdf = !videoResource && allPdfResources.length > 0 ? allPdfResources[0] : null
  const pdfResources = primaryPdf ? allPdfResources.slice(1) : allPdfResources

  const handlePdfPageChangeRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handlePdfPageChange = (page: number) => {
    if (!courseId || !primaryPdf) return
    clearTimeout(handlePdfPageChangeRef.current)
    handlePdfPageChangeRef.current = setTimeout(() => {
      savePdfPage(courseId, primaryPdf.id, page)
    }, 500)
  }

  const materialsPdfTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const handleMaterialsPdfPageChange = (resourceId: string, page: number) => {
    if (!courseId) return
    clearTimeout(materialsPdfTimers.current.get(resourceId))
    materialsPdfTimers.current.set(
      resourceId,
      setTimeout(() => savePdfPage(courseId, resourceId, page), 500)
    )
  }

  const [videoCurrentTime, setVideoCurrentTime] = useState(0)

  const lastSaveTimeRef = useRef(-Infinity)
  const handleTimeUpdate = (time: number) => {
    setVideoCurrentTime(time)
    if (courseId && lessonId && time - lastSaveTimeRef.current >= 5) {
      lastSaveTimeRef.current = time
      saveVideoPosition(courseId, lessonId, time)
    }
  }

  const handleVideoEnded = () => {
    if (courseId && lessonId && !completed) {
      markLessonComplete(courseId, lessonId)
      setCompleted(true)
      // Trigger celebration
      setCelebrationType('lesson')
      setCelebrationTitle(lesson?.title || 'Lesson')
      setCelebrationModal(true)
    }
    // Show auto-advance countdown if there's a next lesson
    if (nextLesson) {
      setShowAutoAdvance(true)
    }
  }

  const handleVideoSeek = (timestamp: number) => {
    setSeekToTime(timestamp)
  }

  const handleSeekComplete = () => {
    setSeekToTime(undefined)
  }

  const handleBookmarkAdd = async (timestamp: number) => {
    if (courseId && lessonId) {
      await addBookmark(courseId, lessonId, timestamp)
      setBookmarks(await getLessonBookmarks(courseId, lessonId))
      toast(`Bookmarked at ${formatBookmarkTimestamp(timestamp)}`, { duration: 2000 })
    }
  }

  const handleBookmarksChange = async () => {
    if (courseId && lessonId) {
      setBookmarks(await getLessonBookmarks(courseId, lessonId))
    }
  }

  const toggleComplete = () => {
    if (!courseId || !lessonId) return
    if (completed) {
      markLessonIncomplete(courseId, lessonId)
      setCompleted(false)
    } else {
      markLessonComplete(courseId, lessonId)
      setCompleted(true)
      // Trigger celebration when manually marking complete
      setCelebrationType('lesson')
      setCelebrationTitle(lesson?.title || 'Lesson')
      setCelebrationModal(true)
    }
  }

  const handleNoteChange = (value: string, tags: string[] = []) => {
    setNoteText(value)
    if (courseId && lessonId) {
      saveNote(courseId, lessonId, value, tags)
    }
  }

  if (!course || !lesson) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-semibold mb-2">Lesson Not Found</h2>
        <Button asChild>
          <Link to="/courses">Back to Courses</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0" data-testid="lesson-content-scroll">
        <Link
          data-theater-hide
          to={`/courses/${courseId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {course.shortTitle}
        </Link>

        {/* Video Player */}
        {videoResource && (
          /*
           * Outer anchor: always in normal flow at original position.
           * videoWrapperRef points here — watched by IntersectionObserver.
           * Preserves layout space (prevents layout shift) when inner div
           * becomes position:fixed in mini-player mode.
           */
          <div
            ref={videoWrapperRef}
            data-testid="video-anchor"
            className={cn(
              'relative mb-5',
              // Theater mode: back link is hidden via data-theater-hide, so video starts at
              // header-bottom + main-padding = ~7.75rem from viewport top. Using 8rem for a 4px buffer.
              isTheaterMode ? 'w-full h-[calc(100svh-8rem)]' : 'w-full aspect-video max-h-[calc(60svh)]'
            )}
          >
            {/* Inner: becomes fixed mini-player when scrolled past while playing */}
            <div
              data-testid="mini-player"
              tabIndex={isMiniPlayer ? 0 : -1}
              role={isMiniPlayer ? 'button' : undefined}
              aria-label={isMiniPlayer ? 'Mini player — click to return to main video' : undefined}
              className={cn(
                'absolute inset-0',
                isMiniPlayer &&
                  'fixed bottom-4 right-4 top-auto left-auto w-80 h-[180px] z-50 rounded-2xl overflow-hidden shadow-2xl cursor-pointer'
              )}
              onKeyDown={(e) => {
                // Enter/Space: scroll back to main video (mini-player mode only)
                if (isMiniPlayer && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  handleMiniPlayerClick()
                }
              }}
            >
              {/* Transparent overlay intercepts pointer events in mini-player mode,
                  preventing clicks from reaching the <video> element (which would toggle play/pause). */}
              {isMiniPlayer && (
                <div
                  className="absolute inset-0 z-10 cursor-pointer"
                  aria-hidden="true"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMiniPlayerClick()
                  }}
                />
              )}
              <VideoPlayer
                src={getResourceUrl(videoResource)}
                title={lesson.title}
                initialPosition={
                  progress?.lastWatchedLesson === lessonId ? progress?.lastVideoPosition : undefined
                }
                seekToTime={seekToTime}
                courseId={courseId}
                lessonId={lessonId}
                chapters={videoChapters}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnded}
                onSeekComplete={handleSeekComplete}
                onBookmarkAdd={handleBookmarkAdd}
                bookmarks={bookmarks}
                onBookmarkSeek={handleVideoSeek}
                captions={videoResource.metadata?.captions}
                onPlayStateChange={setIsVideoPlaying}
                theaterMode={isTheaterMode}
                onTheaterModeToggle={handleTheaterModeToggle}
              />
            </div>
          </div>
        )}

        {/* Auto-Advance Countdown */}
        {showAutoAdvance && nextLesson && (
          <div className="mb-5">
            <AutoAdvanceCountdown
              seconds={5}
              nextLessonTitle={nextLesson.title}
              onAdvance={() => {
                setShowAutoAdvance(false)
                navigate(`/courses/${courseId}/${nextLesson.id}`)
              }}
              onCancel={() => setShowAutoAdvance(false)}
            />
          </div>
        )}

        {/* Primary PDF (when no video) */}
        {primaryPdf && (
          <div className="mb-5">
            <PdfViewer
              src={getResourceUrl(primaryPdf)}
              title={primaryPdf.title}
              initialPage={courseId ? getPdfPage(courseId, primaryPdf.id) ?? 1 : 1}
              onPageChange={handlePdfPageChange}
              collapsible
            />
          </div>
        )}

        {/* Lesson Header */}
        <div className="bg-card rounded-2xl shadow-sm p-5 mb-5">
          <div className="flex items-start justify-between mb-3">
            <h1 ref={titleRef} tabIndex={-1} className="text-xl font-bold outline-none">
              {lesson.title}
            </h1>
            <div className="flex items-center gap-2">
              {/* Mobile lesson list button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="lg:hidden shrink-0">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Open course content</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="text-sm">Course Content</SheetTitle>
                  </SheetHeader>
                  <div data-testid="mobile-course-accordion">
                    <ModuleAccordion
                      modules={course.modules}
                      courseId={course.id}
                      activeLessonId={lessonId}
                      completedLessons={progress?.completedLessons ?? []}
                      compact
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <button
                onClick={toggleComplete}
                aria-label={completed ? 'Mark lesson incomplete' : 'Mark lesson complete'}
                className="flex items-center gap-1.5 text-sm shrink-0 cursor-pointer"
              >
                {completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
                <span className={completed ? 'text-green-600' : 'text-muted-foreground'}>
                  {completed ? 'Completed' : 'Mark Complete'}
                </span>
              </button>
            </div>
          </div>

          {lesson.description && (
            <p className="text-sm text-muted-foreground mb-3">{lesson.description}</p>
          )}

          {lesson.keyTopics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {lesson.keyTopics.map(topic => (
                <span
                  key={topic}
                  className="rounded-full bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs text-blue-700 dark:text-blue-300"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {lesson.resources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {lesson.resources.map(r => (
                <ResourceBadge key={r.id} type={r.type} />
              ))}
            </div>
          )}
        </div>

        {/* Tabs: PDFs / Notes / Bookmarks / Transcript */}
        <Tabs defaultValue={pdfResources.length > 0 ? 'materials' : 'notes'} key={lessonId}>
          <TabsList>
            {pdfResources.length > 0 && (
              <TabsTrigger value="materials">Materials ({pdfResources.length})</TabsTrigger>
            )}
            <TabsTrigger value="notes">Notes</TabsTrigger>
            {videoResource && (
              <TabsTrigger value="bookmarks">Bookmarks ({bookmarks.length})</TabsTrigger>
            )}
            {captionSrc && (
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
            )}
          </TabsList>

          {pdfResources.length > 0 && (
            <TabsContent value="materials" className="mt-4 space-y-4">
              {pdfResources.map(pdf => (
                <PdfViewer
                  key={pdf.id}
                  src={getResourceUrl(pdf)}
                  title={pdf.title}
                  initialPage={courseId ? getPdfPage(courseId, pdf.id) ?? 1 : 1}
                  onPageChange={(page) => handleMaterialsPdfPageChange(pdf.id, page)}
                  collapsible
                />
              ))}
            </TabsContent>
          )}

          <TabsContent value="notes" className="mt-4">
            <NoteEditor
              courseId={courseId || ''}
              lessonId={lessonId || ''}
              initialContent={noteText}
              currentVideoTime={videoCurrentTime}
              onSave={handleNoteChange}
              onVideoSeek={handleVideoSeek}
            />
          </TabsContent>

          {videoResource && (
            <TabsContent value="bookmarks" className="mt-4">
              <div className="bg-card rounded-2xl shadow-sm p-5">
                <h3 className="text-sm font-semibold mb-3">Video Bookmarks</h3>
                <BookmarksList
                  bookmarks={bookmarks}
                  onSeek={handleVideoSeek}
                  onBookmarksChange={handleBookmarksChange}
                />
              </div>
            </TabsContent>
          )}

          {captionSrc && (
            <TabsContent value="transcript" className="mt-4">
              <div className="bg-card rounded-2xl shadow-sm overflow-hidden h-[400px]">
                <TranscriptPanel
                  src={captionSrc}
                  currentTime={videoCurrentTime}
                  onSeek={handleVideoSeek}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Prev / Next Navigation */}
        <div className="flex items-center justify-between mt-6 mb-8">
          {prevLesson ? (
            <Button
              variant="outline"
              onClick={() => navigate(`/courses/${courseId}/${prevLesson.id}`)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
          ) : (
            <div />
          )}
          {nextLesson ? (
            <Button
              onClick={() => navigate(`/courses/${courseId}/${nextLesson.id}`)}
              className="bg-brand hover:bg-brand-hover"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/* Sidebar Course Structure — hidden in theater mode */}
      <div data-testid="desktop-sidebar" className={cn('sticky top-0 self-start flex-shrink-0 w-96 bg-card rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100svh-3rem)]', isTheaterMode ? 'hidden' : 'hidden lg:flex')}>
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <h3 className="text-sm font-semibold">Course Content</h3>
        </div>
        <div className="p-3 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="course-sidebar-accordion">
          <ModuleAccordion
            modules={course.modules}
            courseId={course.id}
            activeLessonId={lessonId}
            completedLessons={progress?.completedLessons ?? []}
            compact
          />
        </div>
      </div>

      {/* Completion Celebration Modal */}
      <CompletionModal
        open={celebrationModal}
        onOpenChange={setCelebrationModal}
        type={celebrationType}
        title={celebrationTitle}
        onContinue={
          nextLesson
            ? () => {
                setCelebrationModal(false)
                navigate(`/courses/${courseId}/${nextLesson.id}`)
              }
            : undefined
        }
      />
    </div>
  )
}
