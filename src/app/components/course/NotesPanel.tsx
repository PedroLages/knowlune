/**
 * NotesPanel — Desktop resizable side panel for note-taking.
 *
 * Renders inside a ResizablePanel (controlled by UnifiedLessonPlayer) and provides:
 * - Close button header
 * - Fill-height NotesTab with frame capture support
 * - Deferred focus: when store `pendingNoteFocus` is true, focuses the TipTap editor
 *   after the panel animation completes
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { NotesTab } from './tabs/NotesTab'
import { cn } from '@/app/components/ui/utils'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import type { CapturedFrame } from '@/lib/frame-capture'

interface NotesPanelProps {
  courseId: string
  lessonId: string
  currentTime?: number
  onSeek?: (time: number) => void
  onClose: () => void
  onCaptureFrame?: () => Promise<CapturedFrame | null>
  /** Theater mode — stretches panel to full viewport height */
  isTheater?: boolean
}

export function NotesPanel({
  courseId,
  lessonId,
  currentTime,
  onSeek,
  onClose,
  onCaptureFrame,
  isTheater,
}: NotesPanelProps) {
  const pendingFocus = useLessonChromeStore(s => s.pendingNoteFocus)
  const clearPendingNoteFocus = useLessonChromeStore(s => s.clearPendingNoteFocus)

  useEffect(() => {
    if (!pendingFocus) return
    requestAnimationFrame(() => {
      const editor = document.querySelector(
        '#lesson-notes-panel .ProseMirror[contenteditable="true"]'
      ) as HTMLElement | null
      editor?.focus()
      clearPendingNoteFocus()
    })
  }, [pendingFocus, clearPendingNoteFocus])

  return (
    <div
      id="lesson-notes-panel"
      data-testid="lesson-notes-panel"
      className={cn(
        'sticky top-0 self-start w-full flex flex-col h-full min-h-0 overflow-hidden',
        isTheater ? 'max-h-[calc(100svh-1rem)]' : 'max-h-[calc(100svh-3rem)]'
      )}
    >
      <div className="flex flex-col flex-1 min-h-0 p-4">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-sm font-semibold">Notes</h3>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label="Close notes panel"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <NotesTab
          courseId={courseId}
          lessonId={lessonId}
          onSeek={onSeek}
          currentTime={currentTime}
          onCaptureFrame={onCaptureFrame}
          fillHeight
        />
      </div>
    </div>
  )
}
