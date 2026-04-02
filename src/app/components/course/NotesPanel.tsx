/**
 * NotesPanel — Desktop resizable side panel for note-taking.
 *
 * Renders inside a ResizablePanel (controlled by UnifiedLessonPlayer) and provides:
 * - Close button header
 * - Scrollable NotesTab with frame capture support
 * - Deferred focus: when `pendingFocus` is true, focuses the TipTap editor
 *   after the panel animation completes
 *
 * Ported from the classic LessonPlayer's inline notes panel.
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Button } from '@/app/components/ui/button'
import { NotesTab } from './tabs/NotesTab'
import type { CapturedFrame } from '@/lib/frame-capture'

interface NotesPanelProps {
  courseId: string
  lessonId: string
  currentTime?: number
  onSeek?: (time: number) => void
  onClose: () => void
  onCaptureFrame?: () => Promise<CapturedFrame | null>
  /** When true, focus the TipTap editor after mount/animation */
  pendingFocus: boolean
  /** Called after focus is applied so parent can clear the pending flag */
  onFocusComplete: () => void
}

export function NotesPanel({
  courseId,
  lessonId,
  currentTime,
  onSeek,
  onClose,
  onCaptureFrame,
  pendingFocus,
  onFocusComplete,
}: NotesPanelProps) {
  // Deferred focus: focus the ProseMirror editor after panel animation
  useEffect(() => {
    if (!pendingFocus) return
    // .ProseMirror is TipTap-specific — scoped to avoid matching other contenteditable elements
    requestAnimationFrame(() => {
      const editor = document.querySelector('.ProseMirror[contenteditable="true"]') as HTMLElement
      editor?.focus()
      onFocusComplete()
    })
  }, [pendingFocus, onFocusComplete])

  return (
    <ScrollArea className="sticky top-0 max-h-[calc(100svh-3rem)] h-full">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
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
        />
      </div>
    </ScrollArea>
  )
}
