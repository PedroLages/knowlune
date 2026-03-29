/**
 * UnifiedLessonPlayer — Single lesson player for both local and YouTube courses.
 *
 * Replaces ImportedLessonPlayer (264 lines) and YouTubeLessonPlayer (407 lines)
 * with a single adapter-driven component. Uses ResizablePanelGroup on desktop
 * and Sheet (bottom drawer) on mobile for the side panel placeholder.
 *
 * Sub-components:
 * - PlayerHeader: back link, lesson title, course name, completion toggle
 * - LocalVideoContent: local video playback with permission handling
 * - YouTubeVideoContent: YouTube iframe player with transcript
 *
 * @see E89-S05
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { useCourseAdapter } from '@/hooks/useCourseAdapter'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useSessionTracking } from '@/app/hooks/useSessionTracking'
import { useIsDesktop } from '@/app/hooks/useMediaQuery'
import { PlayerHeader } from '@/app/components/course/PlayerHeader'
import { LocalVideoContent } from '@/app/components/course/LocalVideoContent'
import { YouTubeVideoContent } from '@/app/components/course/YouTubeVideoContent'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/app/components/ui/resizable'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/app/components/ui/sheet'
import { Button } from '@/app/components/ui/button'
import { PanelRight } from 'lucide-react'

export function UnifiedLessonPlayer() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>()
  const { adapter, loading, error } = useCourseAdapter(courseId)

  const importedCourses = useCourseImportStore(state => state.importedCourses)
  const course = importedCourses.find(c => c.id === courseId)

  const isDesktop = useIsDesktop()

  // Resolve lesson title from adapter's lesson list (not raw UUID)
  const [lessonTitle, setLessonTitle] = useState('Lesson')
  useEffect(() => {
    if (!adapter || !lessonId) return
    let ignore = false
    adapter.getLessons().then(lessons => {
      if (ignore) return
      const match = lessons.find(l => l.id === lessonId)
      setLessonTitle(match?.title ?? 'Lesson')
    })
    return () => { ignore = true }
  }, [adapter, lessonId])

  // Session tracking (AC5): start on mount, pause/resume on idle, end on leave
  useSessionTracking(courseId, lessonId, 'video')

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

  const videoContent = isYouTube ? (
    <YouTubeVideoContent courseId={courseId!} lessonId={lessonId!} />
  ) : (
    <LocalVideoContent courseId={courseId!} lessonId={lessonId!} />
  )

  // Side panel placeholder content (populated in S07)
  const sidePanelContent = (
    <div className="flex flex-col items-center justify-center h-full p-4 text-muted-foreground">
      <p className="text-sm">Side panel content coming in S07</p>
    </div>
  )

  return (
    <div data-testid="lesson-player-content" className="flex flex-col h-full">
      <PlayerHeader
        courseId={courseId!}
        lessonId={lessonId!}
        lessonTitle={lessonTitle}
        courseName={course?.name}
        showCompletionToggle={isYouTube || capabilities.hasVideo}
      />

      {/* Content area: resizable panels on desktop, sheet on mobile */}
      <div className="flex-1 overflow-auto">
        {isDesktop ? (
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize={75} minSize={50}>
              <div className="h-full overflow-auto p-4">{videoContent}</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
              <div className="h-full overflow-auto border-l">{sidePanelContent}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full">
            <div className="h-full overflow-auto p-4">{videoContent}</div>

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
    </div>
  )
}
