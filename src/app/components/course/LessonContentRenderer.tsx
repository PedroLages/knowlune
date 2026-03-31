/**
 * LessonContentRenderer — Conditional rendering logic that chooses between
 * PDF, YouTube, and Local video content based on resolved lesson type.
 *
 * Extracted from UnifiedLessonPlayer to reduce component complexity.
 *
 * @see E89-S05, E89-S06
 */

import { lazy, Suspense, forwardRef } from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { LocalVideoContent } from '@/app/components/course/LocalVideoContent'
import { YouTubeVideoContent } from '@/app/components/course/YouTubeVideoContent'
import type { VideoPlayerHandle } from '@/app/components/figma/VideoPlayer'
import type { CourseSource } from '@/data/types'

// Lazy-load PdfContent to avoid pdfjs-dist bundle impact for video-only users
const PdfContent = lazy(() =>
  import('@/app/components/course/PdfContent').then(m => ({ default: m.PdfContent }))
)

export interface LessonContentRendererProps {
  courseId: string
  lessonId: string
  lessonTypeResolved: boolean
  isPdf: boolean
  /** Source type determines which video component to render (YouTube embed vs local player) */
  sourceType: CourseSource
  onEnded: () => void | Promise<void>
  onAutoComplete?: () => void
  onTimeUpdate: (time: number) => void
  seekToTime: number | undefined
  onSeekComplete: () => void
  onFocusNotes?: () => void
  onVisibilityChange?: (visible: boolean) => void
  onPlayStateChange?: (playing: boolean) => void
  onBlobUrlReady?: (url: string | null) => void
}

export const LessonContentRenderer = forwardRef<VideoPlayerHandle, LessonContentRendererProps>(
  function LessonContentRenderer(props, ref) {
    const {
      courseId,
      lessonId,
      lessonTypeResolved,
      isPdf,
      sourceType,
      onEnded,
      onAutoComplete,
      onTimeUpdate,
      seekToTime,
      onSeekComplete,
      onFocusNotes,
      onVisibilityChange,
      onPlayStateChange,
      onBlobUrlReady,
    } = props

    // While lessonType is still resolving, show a skeleton instead of
    // defaulting to video content (prevents PDF lessons from flashing video UI).
    if (!lessonTypeResolved) {
      return (
        <DelayedFallback>
          <div aria-busy="true" aria-label="Resolving lesson type">
            <Skeleton className="w-full aspect-video rounded-xl" />
          </div>
        </DelayedFallback>
      )
    }

    if (isPdf) {
      return (
        <Suspense
          fallback={
            <DelayedFallback>
              <div aria-busy="true" aria-label="Loading PDF viewer">
                <Skeleton className="w-full aspect-[3/4] rounded-xl" />
              </div>
            </DelayedFallback>
          }
        >
          <PdfContent courseId={courseId} lessonId={lessonId} />
        </Suspense>
      )
    }

    if (sourceType === 'youtube') {
      return (
        <YouTubeVideoContent
          courseId={courseId}
          lessonId={lessonId}
          onEnded={onEnded}
          onAutoComplete={onAutoComplete}
          onTimeUpdate={onTimeUpdate}
          seekToTime={seekToTime}
          onSeekComplete={onSeekComplete}
        />
      )
    }

    return (
      <LocalVideoContent
        ref={ref}
        courseId={courseId}
        lessonId={lessonId}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate}
        seekToTime={seekToTime}
        onSeekComplete={onSeekComplete}
        onFocusNotes={onFocusNotes}
        onVisibilityChange={onVisibilityChange}
        onPlayStateChange={onPlayStateChange}
        onBlobUrlReady={onBlobUrlReady}
      />
    )
  }
)
