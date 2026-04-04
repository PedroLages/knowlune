/**
 * BelowVideoTabs — Tabbed content section rendered below the video player.
 *
 * Replaces the sidebar-based PlayerSidePanel tabs with a below-video layout
 * that matches the classic LessonPlayer's content organization.
 *
 * Tabs: Notes, Bookmarks, Transcript, AI Summary, Materials
 *
 * @see Plan: Merge Classic Features into Modern UnifiedLessonPlayer
 */

import { useState, useEffect, useRef } from 'react'
import { PencilLine, Bookmark, FileText, Sparkles, FolderOpen, X, Maximize2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { AISummaryPanel } from '@/app/components/figma/AISummaryPanel'
import type { CourseAdapter } from '@/lib/courseAdapter'
import type { CapturedFrame } from '@/lib/frame-capture'

import { NotesTab } from './tabs/NotesTab'
import { TranscriptTab } from './tabs/TranscriptTab'
import { LessonBookmarksTab } from './tabs/LessonBookmarksTab'
import { MaterialsTab } from './tabs/MaterialsTab'

interface BelowVideoTabsProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
  /** Current video playback time in seconds */
  currentTime?: number
  /** Callback when user clicks a transcript cue or bookmark to seek */
  onSeek?: (time: number) => void
  /** Programmatically switch to a tab (e.g. "notes" when user presses N) */
  focusTab?: string | null
  /** Counter that increments on each focus request, enabling re-triggers for the same tab */
  focusTabKey?: number
  /** Whether the current lesson is a PDF (hides Bookmarks tab) */
  isPdf?: boolean
  /** When true, hide the Notes tab (desktop notes panel is open instead) */
  hideNotesTab?: boolean
  /** Callback to capture video frame for embedding in notes */
  onCaptureFrame?: () => Promise<CapturedFrame | null>
}

export function BelowVideoTabs({
  courseId,
  lessonId,
  adapter,
  currentTime,
  onSeek,
  focusTab,
  focusTabKey,
  isPdf,
  hideNotesTab,
  onCaptureFrame,
}: BelowVideoTabsProps) {
  const capabilities = adapter.getCapabilities()
  const isMobile = useMediaQuery('(max-width: 768px)')

  // Default to notes (or materials for PDF lessons)
  const defaultTab = isPdf ? 'materials' : 'notes'
  const [activeTab, setActiveTab] = useState(defaultTab)

  // Reset tab when lesson changes
  useEffect(() => {
    setActiveTab(isPdf ? 'materials' : 'notes')
  }, [lessonId, isPdf])

  // Programmatic tab switching (e.g. N key -> Notes, badge click -> Materials)
  useEffect(() => {
    if (focusTab) {
      setActiveTab(focusTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTab, focusTabKey])

  // Auto-switch away from notes tab when desktop notes panel is open
  useEffect(() => {
    if (hideNotesTab && activeTab === 'notes') {
      // Fallback priority: bookmarks → transcript → materials → ai-summary
      if (!isPdf) {
        setActiveTab('bookmarks')
      } else if (capabilities.hasTranscript) {
        setActiveTab('transcript')
      } else if (capabilities.hasPdf) {
        setActiveTab('materials')
      } else {
        setActiveTab('ai-summary')
      }
    }
  }, [hideNotesTab, activeTab, isPdf, capabilities])

  // Build transcript blob URL for AISummaryPanel
  const [transcriptSrc, setTranscriptSrc] = useState<string | null>(null)
  const transcriptBlobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    adapter.getTranscript(lessonId).then(text => {
      if (cancelled || !text) {
        setTranscriptSrc(null)
        return
      }

      if (transcriptBlobUrlRef.current) {
        URL.revokeObjectURL(transcriptBlobUrlRef.current)
        transcriptBlobUrlRef.current = null
      }

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
      if (transcriptBlobUrlRef.current) {
        URL.revokeObjectURL(transcriptBlobUrlRef.current)
        transcriptBlobUrlRef.current = null
      }
    }
  }, [adapter, lessonId])

  // Fullscreen notes overlay (mobile)
  const [isNotesFullscreen, setIsNotesFullscreen] = useState(false)
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null)
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null)

  // ESC handler + focus trap for fullscreen notes overlay
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
        const focusable = fullscreenOverlayRef.current?.querySelector<HTMLElement>(
          'textarea, [contenteditable], input, button'
        )
        focusable?.focus()
      })
    }
  }, [isNotesFullscreen])

  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-4"
        data-testid="below-video-tabs"
      >
        <TabsList variant="brand-pill">
          {!hideNotesTab && (
            <TabsTrigger value="notes" variant="brand-pill">
              <PencilLine className="size-3.5" aria-hidden="true" />
              Notes
            </TabsTrigger>
          )}
          {!isPdf && (
            <TabsTrigger value="bookmarks" variant="brand-pill">
              <Bookmark className="size-3.5" aria-hidden="true" />
              Bookmarks
            </TabsTrigger>
          )}
          {capabilities.hasTranscript && (
            <TabsTrigger value="transcript" variant="brand-pill">
              <FileText className="size-3.5" aria-hidden="true" />
              Transcript
            </TabsTrigger>
          )}
          {capabilities.hasTranscript && (
            <TabsTrigger value="ai-summary" variant="brand-pill">
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI Summary
            </TabsTrigger>
          )}
          {capabilities.hasPdf && (
            <TabsTrigger value="materials" variant="brand-pill">
              <FolderOpen className="size-3.5" aria-hidden="true" />
              Materials
            </TabsTrigger>
          )}
        </TabsList>

        {!hideNotesTab && (
          <TabsContent value="notes" className="mt-4">
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              {isMobile && (
                <div className="flex items-center justify-between px-4 py-2 border-b">
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
                onSeek={onSeek}
                currentTime={currentTime}
                onCaptureFrame={onCaptureFrame}
              />
            </div>
          </TabsContent>
        )}

        {!isPdf && (
          <TabsContent value="bookmarks" className="mt-4">
            <div className="bg-card rounded-2xl shadow-sm p-2">
              <LessonBookmarksTab
                courseId={courseId}
                lessonId={lessonId}
                onSeek={onSeek}
                currentTime={currentTime}
                isPdf={isPdf}
              />
            </div>
          </TabsContent>
        )}

        {capabilities.hasTranscript && (
          <TabsContent value="transcript" className="mt-4">
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden h-[400px]">
              <TranscriptTab
                courseId={courseId}
                lessonId={lessonId}
                adapter={adapter}
                currentTime={currentTime}
                onSeek={onSeek}
              />
            </div>
          </TabsContent>
        )}

        {capabilities.hasTranscript && (
          <TabsContent value="ai-summary" className="mt-4">
            <div className="bg-card rounded-2xl shadow-sm">
              {transcriptSrc ? (
                <AISummaryPanel transcriptSrc={transcriptSrc} />
              ) : (
                <div className="p-4 text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-3 py-8">
                    <FileText className="size-10 text-muted-foreground/50" aria-hidden="true" />
                    <p className="text-center">
                      No transcript available for AI summary generation.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {capabilities.hasPdf && (
          <TabsContent value="materials" className="mt-4">
            <div className="bg-card rounded-2xl shadow-sm">
              <MaterialsTab courseId={courseId} lessonId={lessonId} adapter={adapter} />
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Fullscreen notes overlay (mobile) */}
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
          <div className="flex-1 overflow-auto p-4">
            <NotesTab
              courseId={courseId}
              lessonId={lessonId}
              onSeek={onSeek}
              currentTime={currentTime}
              onCaptureFrame={onCaptureFrame}
            />
          </div>
        </div>
      )}
    </>
  )
}
