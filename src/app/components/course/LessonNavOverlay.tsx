/**
 * LessonNavOverlay — Floating prev/next lesson navigation arrows overlaid on the
 * video player. Provides immediate access to adjacent lessons without scrolling.
 *
 * Desktop: Arrows appear on hover over the video player area (opacity transition).
 * Mobile/tablet: Arrows are always visible at reduced opacity (30%).
 *
 * During fullscreen, arrows are unmounted from the DOM to prevent Tab-key focus
 * behind the fullscreen element.
 *
 * @see Unit 4 — docs/plans/2026-07-11-005-feat-lesson-navigation-and-video-fixes-plan.md
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip'
import { cn } from '@/app/components/ui/utils'

interface LessonNavOverlayProps {
  courseId: string
  prevLesson: { id: string; title: string } | null
  nextLesson: { id: string; title: string } | null
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function LessonNavOverlay({ courseId, prevLesson, nextLesson }: LessonNavOverlayProps) {
  const navigate = useNavigate()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Watch for prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_MOTION_QUERY)
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Fullscreen detection with vendor-prefix fallbacks
  useEffect(() => {
    function handleFullscreenChange() {
      const el = (
        document.fullscreenElement ??
        (document as unknown as Record<string, Element | null>).webkitFullscreenElement ??
        (document as unknown as Record<string, Element | null>).mozFullscreenElement
      ) as Element | null

      // Only consider fullscreen if it's the video player container
      if (el?.closest('[data-video-player-container]')) {
        setIsFullscreen(true)
      } else {
        setIsFullscreen(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
    }
  }, [])

  // During fullscreen, unmount arrows from DOM to prevent Tab focus behind
  // the fullscreen element
  if (isFullscreen) return null

  const transitionClass = reducedMotion
    ? 'transition-none'
    : 'transition-opacity duration-200'

  const handleNav = (lessonId: string) => {
    navigate(`/courses/${courseId}/lessons/${lessonId}`, {
      state: { autoPlay: undefined },
    })
  }

  const arrowBaseClasses = cn(
    // Default: visible at 30% for mobile/tablet
    'opacity-30',
    // Desktop: hidden until hover over the video container
    'md:opacity-0',
    // Show on hover of the parent video container (group/video-container)
    'group-hover/video-container:opacity-100',
    // Always show when focused via keyboard
    'focus-visible:opacity-100',
    // Touch target and visual design
    'size-12 rounded-full',
    'bg-black/40 hover:bg-black/60',
    'text-white',
    'flex items-center justify-center',
    // Accessibility: focus ring
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80',
    'cursor-pointer',
    transitionClass
  )

  return (
    <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden="true">
      {/* Previous lesson arrow */}
      {prevLesson && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleNav(prevLesson.id)}
                aria-label={`Previous lesson: ${prevLesson.title}`}
                className={arrowBaseClasses}
              >
                <ChevronLeft className="size-6" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="max-w-[200px] truncate block">{prevLesson.title}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Next lesson arrow */}
      {nextLesson && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleNav(nextLesson.id)}
                aria-label={`Next lesson: ${nextLesson.title}`}
                className={arrowBaseClasses}
              >
                <ChevronRight className="size-6" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="max-w-[200px] truncate block">{nextLesson.title}</span>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
