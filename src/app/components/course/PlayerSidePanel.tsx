/**
 * PlayerSidePanel — Tabbed side panel for the unified lesson player.
 *
 * Tabs: Lessons (default), Notes, Transcript, AI Summary, Bookmarks
 *
 * Renders inside:
 * - Desktop: ResizablePanelGroup right panel
 * - Mobile: Sheet bottom drawer
 *
 * Tab content components are in ./tabs/:
 * - NotesTab, TranscriptTab, LessonBookmarksTab, LessonsTab
 *
 * @see E89-S07
 */

import { useState, useEffect, useRef } from 'react'
import { FileText, Maximize2, X } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { AISummaryPanel } from '@/app/components/figma/AISummaryPanel'
import type { CourseAdapter } from '@/lib/courseAdapter'

import { NotesTab } from './tabs/NotesTab'
import { TranscriptTab } from './tabs/TranscriptTab'
import { LessonBookmarksTab } from './tabs/LessonBookmarksTab'
import { LessonsTab } from './tabs/LessonsTab'

// Re-export NotesTab for backward compatibility (imported by UnifiedLessonPlayer)
export { NotesTab } from './tabs/NotesTab'

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface PlayerSidePanelProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
  /** Current video playback time in seconds (for transcript highlighting) */
  currentTime?: number
  /** Callback when user clicks a transcript cue to seek */
  onSeek?: (time: number) => void
  /** Programmatically switch to a tab (e.g. "notes" when user presses N) */
  focusTab?: string | null
  /** Whether the current lesson is a PDF (hides Add Bookmark button) */
  isPdf?: boolean
}

export function PlayerSidePanel({
  courseId,
  lessonId,
  adapter,
  currentTime: externalCurrentTime,
  onSeek: externalOnSeek,
  focusTab,
  isPdf,
}: PlayerSidePanelProps) {
  const capabilities = adapter.getCapabilities()
  // Use 768px breakpoint per spec (not project's default 639px mobile breakpoint)
  // so tablets (640-768px) also see the fullscreen notes button
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isNotesFullscreen, setIsNotesFullscreen] = useState(false)
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null)
  const fullscreenEditorRef = useRef<HTMLDivElement>(null)
  const [transcriptSrc, setTranscriptSrc] = useState<string | null>(null)

  // Build a blob URL for the transcript (for AISummaryPanel which expects a URL)
  const transcriptBlobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    adapter.getTranscript(lessonId).then(text => {
      if (cancelled || !text) {
        setTranscriptSrc(null)
        return
      }

      // Revoke previous blob URL before creating a new one
      if (transcriptBlobUrlRef.current) {
        URL.revokeObjectURL(transcriptBlobUrlRef.current)
        transcriptBlobUrlRef.current = null
      }

      // If it's already VTT-formatted, create a blob URL
      const vttText = text.includes('-->')
        ? text
        : `WEBVTT\n\n00:00:00.000 --> 99:59:59.999\n${text}`

      const blob = new Blob([vttText], { type: 'text/vtt' })
      const url = URL.createObjectURL(blob)
      transcriptBlobUrlRef.current = url
      if (!cancelled) setTranscriptSrc(url)
    })

    return () => {
      cancelled = true
      // Revoke blob URL on rapid lessonId changes to prevent memory leaks.
      // The ref tracks the current URL so cleanup always revokes the correct one.
      if (transcriptBlobUrlRef.current) {
        URL.revokeObjectURL(transcriptBlobUrlRef.current)
        transcriptBlobUrlRef.current = null
      }
    }
  }, [adapter, lessonId])

  // ESC handler + focus trap for fullscreen notes overlay
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isNotesFullscreen) return
    const overlay = fullscreenOverlayRef.current
    if (!overlay) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotesFullscreen(false)
        requestAnimationFrame(() => fullscreenTriggerRef.current?.focus())
        return
      }

      // Focus trap: cycle Tab within the overlay
      if (e.key === 'Tab') {
        const focusableEls = overlay.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]'
        )
        if (focusableEls.length === 0) return

        const first = focusableEls[0]
        const last = focusableEls[focusableEls.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isNotesFullscreen])

  // Focus first focusable element on overlay open
  useEffect(() => {
    if (isNotesFullscreen) {
      requestAnimationFrame(() => {
        const el = fullscreenOverlayRef.current
        if (el) {
          const focusable = el.querySelector<HTMLElement>(
            'textarea, [contenteditable], input, button'
          )
          focusable?.focus()
        }
      })
    }
  }, [isNotesFullscreen])

  // Controlled tab state to allow programmatic switching (e.g. N key -> Notes tab)
  const [activeTab, setActiveTab] = useState('lessons')

  useEffect(() => {
    if (focusTab) {
      setActiveTab(focusTab)
    }
  }, [focusTab])

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex flex-col h-full"
      data-testid="player-side-panel"
    >
      {/* Radix Tabs provides arrow-key navigation between triggers by default — no custom keyboard shortcuts needed. */}
      <TabsList className="w-full shrink-0 px-1">
        <TabsTrigger value="lessons" className="text-xs">
          Lessons
        </TabsTrigger>
        <TabsTrigger value="notes" className="text-xs">
          Notes
        </TabsTrigger>
        {capabilities.hasTranscript && (
          <TabsTrigger value="transcript" className="text-xs">
            Transcript
          </TabsTrigger>
        )}
        <TabsTrigger value="ai-summary" className="text-xs">
          AI Summary
        </TabsTrigger>
        <TabsTrigger value="bookmarks" className="text-xs">
          Bookmarks
        </TabsTrigger>
      </TabsList>

      <TabsContent value="lessons" className="flex-1 overflow-auto">
        <LessonsTab courseId={courseId} lessonId={lessonId} adapter={adapter} />
      </TabsContent>

      <TabsContent value="notes" className="flex-1 overflow-hidden">
        {isMobile && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b lg:hidden">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <Button
              ref={fullscreenTriggerRef}
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setIsNotesFullscreen(true)}
              aria-label="Open notes in fullscreen"
              data-testid="notes-fullscreen-button"
            >
              <Maximize2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
        <NotesTab
          courseId={courseId}
          lessonId={lessonId}
          onSeek={externalOnSeek}
          currentTime={externalCurrentTime}
        />
      </TabsContent>

      {/* Fullscreen notes overlay (mobile only) */}
      {isNotesFullscreen && (
        <div
          ref={fullscreenOverlayRef}
          className="fixed inset-0 z-50 bg-background flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Notes fullscreen editor"
          data-testid="notes-fullscreen-overlay"
        >
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Notes</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsNotesFullscreen(false)
                requestAnimationFrame(() => fullscreenTriggerRef.current?.focus())
              }}
              aria-label="Close fullscreen notes"
              data-testid="notes-fullscreen-close"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <div ref={fullscreenEditorRef} className="flex-1 overflow-auto p-4">
            <NotesTab
              courseId={courseId}
              lessonId={lessonId}
              onSeek={externalOnSeek}
              currentTime={externalCurrentTime}
            />
          </div>
        </div>
      )}

      {capabilities.hasTranscript && (
        <TabsContent value="transcript" className="flex-1 overflow-hidden">
          <TranscriptTab
            courseId={courseId}
            lessonId={lessonId}
            adapter={adapter}
            currentTime={externalCurrentTime}
            onSeek={externalOnSeek}
          />
        </TabsContent>
      )}

      <TabsContent value="ai-summary" className="flex-1 overflow-auto">
        {transcriptSrc ? (
          <AISummaryPanel transcriptSrc={transcriptSrc} />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-3 py-8">
              <FileText className="size-10 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-center">No transcript available for AI summary generation.</p>
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="bookmarks" className="flex-1 overflow-auto">
        <LessonBookmarksTab
          courseId={courseId}
          lessonId={lessonId}
          onSeek={externalOnSeek}
          currentTime={externalCurrentTime}
          isPdf={isPdf}
        />
      </TabsContent>
    </Tabs>
  )
}
