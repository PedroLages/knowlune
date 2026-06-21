/**
 * FloatingNotesPanel — Picture-in-picture notes overlay for mobile lesson player.
 *
 * Three-state floating panel that overlays the video area on viewports below 768px:
 *   1. Closed (pill) — small floating badge at bottom-right
 *   2. Expanded — bottom 35-55% panel with drag handle, NotesTab, toolbar
 *   3. Fullscreen — delegates to BelowVideoTabs existing overlay via store state
 *
 * Renders via React Portal into a sibling DOM node adjacent to the video container,
 * avoiding the overflow-hidden clipping constraint on the video container itself.
 *
 * @requires useLessonChromeStore for mobileNotesPanel state
 * @see Plan: docs/plans/2026-05-04-005-feat-course-lesson-notes-top3-plan.md
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, ChevronDown, Maximize2, Check } from 'lucide-react'
import { NotesTab } from '@/app/components/course/tabs/NotesTab'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import { useNoteStore } from '@/stores/useNoteStore'
import { cn } from '@/app/components/ui/utils'
import type { CapturedFrame } from '@/lib/frame-capture'

interface FloatingNotesPanelProps {
  courseId: string
  lessonId: string
  currentTime?: number
  onSeek?: (time: number) => void
  onCaptureFrame?: () => Promise<CapturedFrame | null>
  /** The DOM node to portal into (adjacent to video container). */
  portalTarget: HTMLElement | null
}

export function FloatingNotesPanel({
  courseId,
  lessonId,
  currentTime,
  onSeek,
  onCaptureFrame,
  portalTarget,
}: FloatingNotesPanelProps) {
  const mobileNotesPanel = useLessonChromeStore(s => s.mobileNotesPanel)
  const setMobileNotesPanel = useLessonChromeStore(s => s.setMobileNotesPanel)
  const closeMobileNotesPanel = useLessonChromeStore(s => s.closeMobileNotesPanel)

  // Note count for the pill badge — useMemo to avoid infinite re-renders
  // from .filter() producing a new array reference on every selector call.
  const allNotes = useNoteStore(s => s.notes)
  const nonEmptyCount = useMemo(
    () =>
      allNotes.filter(
        n =>
          n.courseId === courseId &&
          n.videoId === lessonId &&
          !n.deleted &&
          n.content?.trim().length > 0
      ).length,
    [allNotes, courseId, lessonId]
  )

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleSaveStatusChange = useCallback((status: 'idle' | 'saved') => {
    setSaveStatus(status)
    // Auto-clear "Saved" after 2s (matches NoteEditor's fade timeout)
    if (status === 'saved') {
      clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
    }
  }, [])

  // Clean up fade timeout on unmount
  useEffect(() => {
    return () => clearTimeout(fadeTimeoutRef.current)
  }, [])

  // Swipe gesture tracking
  // Use ref for delta tracking to avoid stale closure in handleTouchEnd.
  // React state updates from touchMove are batched and may not commit
  // before the synchronous touchend handler fires on fast swipes.
  const [swipeDelta, setSwipeDelta] = useState(0)
  const swipeDeltaRef = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)
  const handleRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (mobileNotesPanel !== 'expanded') return
      // Gate to handle region (top 20px of panel)
      const handle = handleRef.current
      if (!handle) return
      const rect = handle.getBoundingClientRect()
      const touch = e.touches[0]
      // Allow touch anywhere in the handle bar area
      if (touch.clientY < rect.top - 10 || touch.clientY > rect.bottom + 10) return

      isSwiping.current = true
      touchStartY.current = touch.clientY
      swipeDeltaRef.current = 0
      setSwipeDelta(0)
    },
    [mobileNotesPanel]
  )

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current) return
    const touch = e.touches[0]
    const delta = Math.max(0, touch.clientY - touchStartY.current)
    swipeDeltaRef.current = delta
    setSwipeDelta(delta)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return
    isSwiping.current = false
    // 48px min drag distance to trigger collapse (prevents accidental closes)
    // Read from ref (not state) to avoid stale closure on fast swipes
    if (swipeDeltaRef.current >= 48) {
      closeMobileNotesPanel()
    }
    swipeDeltaRef.current = 0
    setSwipeDelta(0)
  }, [closeMobileNotesPanel])

  // Don't render pill when no notes exist and panel is closed (R8)
  const showPill = nonEmptyCount > 0 || mobileNotesPanel !== 'closed'

  // When fullscreen, this component doesn't render anything except keeping the
  // store state set — the BelowVideoTabs overlay handles rendering
  if (mobileNotesPanel === 'fullscreen') {
    // Render nothing when in fullscreen; BelowVideoTabs owns the overlay.
    // Return null but keep the component mounted so hooks persist.
    return null
  }

  // Portal target not ready yet — render nothing
  if (!portalTarget) return null

  const panelContent = (
    <>
      {/* --- Closed state: floating pill --- */}
      {mobileNotesPanel === 'closed' && showPill && (
        <button
          type="button"
          className={cn(
            'fixed bottom-20 right-4 z-50 flex items-center gap-2 px-3 py-2.5',
            'bg-brand text-brand-foreground rounded-full shadow-lg',
            'transition-transform duration-200 hover:scale-105',
            'motion-reduce:transition-none',
            'min-w-[44px] min-h-[44px]'
          )}
          onClick={() => setMobileNotesPanel('expanded')}
          aria-label="Open notes panel"
          data-testid="floating-notes-pill"
        >
          <PencilLine className="size-4" aria-hidden="true" />
          <span className="text-xs font-medium">{nonEmptyCount}</span>
        </button>
      )}

      {/* --- Expanded state: floating panel --- */}
      {mobileNotesPanel === 'expanded' && (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-50',
            'bg-card border-t rounded-t-2xl shadow-lg',
            'transition-transform duration-300',
            'motion-reduce:transition-none',
            'portrait:max-h-[40vh] landscape:max-h-[55vh]'
          )}
          style={{
            transform: swipeDelta > 0 ? `translateY(${swipeDelta}px)` : 'translateY(0)',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }}
          role="dialog"
          aria-label="Lesson notes"
          data-testid="floating-notes-panel"
        >
          {/* Drag handle (swipe-down target, gated to top 20px) */}
          <div
            ref={handleRef}
            className={cn(
              'flex items-center justify-center py-2 cursor-grab active:cursor-grabbing',
              'touch-action:pan-y'
            )}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            data-testid="floating-notes-handle"
          >
            <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Toolbar: collapse, save status, maximize */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b">
            <button
              type="button"
              className="flex items-center justify-center size-8 rounded-md hover:bg-accent transition-colors"
              onClick={closeMobileNotesPanel}
              aria-label="Close notes panel"
              data-testid="floating-notes-collapse"
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>

            {/* Saved indicator */}
            <span
              className={cn(
                'text-xs text-success transition-opacity duration-300 flex items-center gap-1',
                saveStatus === 'saved' ? 'opacity-100' : 'opacity-0'
              )}
              aria-live="polite"
            >
              <Check className="size-3" aria-hidden="true" />
              Saved
            </span>

            <button
              type="button"
              className="flex items-center justify-center size-8 rounded-md hover:bg-accent transition-colors"
              onClick={() => setMobileNotesPanel('fullscreen')}
              aria-label="Maximize notes to fullscreen"
              data-testid="floating-notes-maximize"
            >
              <Maximize2 className="size-4" aria-hidden="true" />
            </button>
          </div>

          {/* Scrollable content: NotesTab with compact editor */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(100% - 60px)' }}>
            <NotesTab
              courseId={courseId}
              lessonId={lessonId}
              onSeek={onSeek}
              currentTime={currentTime}
              onCaptureFrame={onCaptureFrame}
              onSaveStatusChange={handleSaveStatusChange}
            />
          </div>
        </div>
      )}
    </>
  )

  return createPortal(panelContent, portalTarget)
}
