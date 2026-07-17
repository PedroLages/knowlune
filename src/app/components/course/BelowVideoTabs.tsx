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

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  PencilLine,
  Bookmark,
  FileText,
  Sparkles,
  FolderOpen,
  X,
  Maximize2,
  GraduationCap,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { cn } from '@/app/components/ui/utils'
import { Button } from '@/app/components/ui/button'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { STUDY_TOOLS, type StudyTool } from '@/app/hooks/useLessonSessionState'
import { useLessonChromeStore } from '@/stores/useLessonChromeStore'
import { StudyToolSelector } from '@/app/components/course/StudyToolSelector'
import { AISummaryPanel } from '@/app/components/figma/AISummaryPanel'
import type { CourseAdapter } from '@/lib/courseAdapter'
import type { CapturedFrame } from '@/lib/frame-capture'

import { NotesTab } from './tabs/NotesTab'
import { TranscriptTab } from './tabs/TranscriptTab'
import { LessonBookmarksTab } from './tabs/LessonBookmarksTab'
import { MaterialsTab } from './tabs/MaterialsTab'
import { TutorChat } from '@/app/components/tutor/TutorChat'
import { isAIAvailable } from '@/lib/aiConfiguration'

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
  /** Course name for tutor context */
  courseName?: string
  /** Lesson title for tutor context */
  lessonTitle?: string
  /** Lesson position string (e.g. "3 of 12") for tutor context */
  lessonPosition?: string
  /** Controlled active study tool. */
  activeTool?: StudyTool
  /** Called when the learner selects another study tool. */
  onActiveToolChange?: (tool: StudyTool) => void
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
  courseName,
  lessonTitle,
  lessonPosition,
  activeTool: controlledActiveTool,
  onActiveToolChange,
}: BelowVideoTabsProps) {
  const capabilities = adapter.getCapabilities()
  const isMobile = useMediaQuery('(max-width: 767px)')
  const aiAvailable = isAIAvailable()

  const defaultTab: StudyTool = isPdf ? 'materials' : 'notes'
  const [uncontrolledActiveTool, setUncontrolledActiveTool] = useState<StudyTool>(defaultTab)
  const activeTool = controlledActiveTool ?? uncontrolledActiveTool
  const changeActiveTool = useCallback(
    (tool: StudyTool) => {
      if (controlledActiveTool === undefined) setUncontrolledActiveTool(tool)
      onActiveToolChange?.(tool)
    },
    [controlledActiveTool, onActiveToolChange]
  )

  // Transcript version counter — revalidates persisted summaries after generation.
  const [transcriptVersion, setTranscriptVersion] = useState(0)
  const handleTranscriptGenerated = useCallback(() => {
    setTranscriptVersion(v => v + 1)
  }, [])

  // Reset tab when lesson changes
  useEffect(() => {
    if (controlledActiveTool === undefined) {
      setUncontrolledActiveTool(isPdf ? 'materials' : 'notes')
    }
  }, [controlledActiveTool, lessonId, isPdf])

  // Programmatic tab switching (e.g. N key -> Notes, badge click -> Materials)
  useEffect(() => {
    if (focusTab && STUDY_TOOLS.includes(focusTab as StudyTool)) {
      changeActiveTool(focusTab as StudyTool)
    }
  }, [changeActiveTool, focusTab, focusTabKey])

  // Auto-switch away from notes tab when desktop notes panel is open
  useEffect(() => {
    if (hideNotesTab && activeTool === 'notes') {
      // Fallback priority: bookmarks → transcript → materials → ai-summary
      if (!isPdf) {
        changeActiveTool('bookmarks')
      } else if (capabilities.hasTranscript) {
        changeActiveTool('transcript')
      } else if (capabilities.hasPdf) {
        changeActiveTool('materials')
      } else {
        changeActiveTool('summary')
      }
    }
  }, [hideNotesTab, activeTool, isPdf, capabilities, changeActiveTool])

  // Fullscreen notes overlay (mobile)
  // Synced with useLessonChromeStore.mobileNotesPanel for dual-state coordination
  // between the FloatingNotesPanel and the existing fullscreen overlay.
  const [isNotesFullscreen, setIsNotesFullscreen] = useState(false)
  const mobileNotesPanel = useLessonChromeStore(s => s.mobileNotesPanel)
  const setMobileNotesPanel = useLessonChromeStore(s => s.setMobileNotesPanel)
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null)
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null)

  // Sync fullscreen overlay with store: open when store says 'fullscreen'
  useEffect(() => {
    if (mobileNotesPanel === 'fullscreen' && !isNotesFullscreen) {
      setIsNotesFullscreen(true)
    }
  }, [mobileNotesPanel, isNotesFullscreen])

  // When closing fullscreen overlay, sync store back to 'expanded'
  const closeFullscreenNotes = useCallback(() => {
    setIsNotesFullscreen(false)
    setMobileNotesPanel('expanded')
    requestAnimationFrame(() => {
      const floatingTrigger = document.querySelector<HTMLElement>(
        '[data-testid="floating-notes-maximize"]'
      )
      ;(floatingTrigger ?? fullscreenTriggerRef.current)?.focus()
    })
  }, [setMobileNotesPanel])

  // ESC handler + focus trap for fullscreen notes overlay
  useEffect(() => {
    if (!isNotesFullscreen) return
    const overlay = fullscreenOverlayRef.current
    if (!overlay) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFullscreenNotes()
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

  // On mobile, tapping the Notes tab opens the floating panel instead of inline content.
  const handleToolChange = useCallback(
    (value: string) => {
      if (!STUDY_TOOLS.includes(value as StudyTool)) return
      const tool = value as StudyTool
      if (isMobile && value === 'notes') {
        changeActiveTool(tool)
        useLessonChromeStore.getState().setNotesOpen(true)
        useLessonChromeStore.getState().setMobileNotesPanel('expanded')
        return
      }
      changeActiveTool(tool)
    },
    [changeActiveTool, isMobile]
  )

  const availableTools = useMemo(
    () =>
      [
        {
          value: 'notes' as const,
          label: 'Notes',
          icon: PencilLine,
          hidden: Boolean(hideNotesTab),
        },
        {
          value: 'bookmarks' as const,
          label: 'Bookmarks',
          icon: Bookmark,
          hidden: Boolean(isPdf),
        },
        {
          value: 'transcript' as const,
          label: 'Transcript',
          icon: FileText,
          hidden: !capabilities.hasTranscript,
        },
        {
          value: 'summary' as const,
          label: 'AI Summary',
          icon: Sparkles,
          hidden: !capabilities.hasTranscript,
        },
        {
          value: 'materials' as const,
          label: 'Materials',
          icon: FolderOpen,
          hidden: !capabilities.hasPdf,
        },
        { value: 'tutor' as const, label: 'Tutor', icon: GraduationCap, hidden: !aiAvailable },
      ].filter(tool => !tool.hidden),
    [aiAvailable, capabilities.hasPdf, capabilities.hasTranscript, hideNotesTab, isPdf]
  )

  useEffect(() => {
    if (availableTools.some(tool => tool.value === activeTool)) return
    const fallback = availableTools[0]?.value
    if (fallback) changeActiveTool(fallback)
  }, [activeTool, availableTools, changeActiveTool])

  return (
    <>
      <Tabs
        value={activeTool}
        onValueChange={handleToolChange}
        className="mt-4"
        data-testid="below-video-tabs"
      >
        <StudyToolSelector
          value={activeTool}
          tools={availableTools}
          onValueChange={handleToolChange}
        />

        <TabsList variant="brand-pill" className="hidden sm:flex">
          <TabsTrigger value="notes" variant="brand-pill" className={cn(hideNotesTab && 'hidden')}>
            <PencilLine className="size-3.5" aria-hidden="true" />
            Notes
          </TabsTrigger>
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
            <TabsTrigger value="summary" variant="brand-pill">
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
          {aiAvailable && (
            <TabsTrigger value="tutor" variant="brand-pill">
              <GraduationCap className="size-3.5" aria-hidden="true" />
              Tutor
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent
          value="notes"
          forceMount
          className={cn(
            'mt-4',
            (hideNotesTab || isMobile) && 'hidden',
            'data-[state=inactive]:hidden'
          )}
          aria-hidden={activeTool !== 'notes'}
        >
          <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
            {isMobile && (
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <span className="text-xs font-medium text-muted-foreground">Notes</span>
                <Button
                  ref={fullscreenTriggerRef}
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => {
                    setMobileNotesPanel('fullscreen')
                    setIsNotesFullscreen(true)
                  }}
                  aria-label="Open notes in fullscreen"
                  data-testid="notes-fullscreen-button"
                >
                  <Maximize2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            )}
            {!isMobile ? (
              <NotesTab
                courseId={courseId}
                lessonId={lessonId}
                onSeek={onSeek}
                currentTime={currentTime}
                onCaptureFrame={onCaptureFrame}
              />
            ) : null}
          </div>
        </TabsContent>

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
            <div className="h-[65svh] min-h-96 overflow-hidden rounded-2xl bg-card shadow-sm sm:h-[min(68svh,40rem)] sm:min-h-[30rem]">
              <TranscriptTab
                courseId={courseId}
                lessonId={lessonId}
                adapter={adapter}
                currentTime={currentTime}
                onSeek={onSeek}
                isPdf={isPdf}
                onTranscriptGenerated={handleTranscriptGenerated}
              />
            </div>
          </TabsContent>
        )}

        {capabilities.hasTranscript && (
          <TabsContent
            value="summary"
            forceMount
            className="mt-4 data-[state=inactive]:hidden"
            aria-hidden={activeTool !== 'summary'}
          >
            <div className="bg-card rounded-2xl shadow-sm">
              <AISummaryPanel
                key={`${courseId}:${lessonId}`}
                courseId={courseId}
                lessonId={lessonId}
                transcriptVersion={transcriptVersion}
                onRequestTranscript={() => changeActiveTool('transcript')}
              />
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

        {aiAvailable && (
          <TabsContent value="tutor" className="mt-4">
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              <TutorChat
                courseId={courseId}
                lessonId={lessonId}
                courseName={courseName ?? 'Course'}
                lessonTitle={lessonTitle ?? 'Lesson'}
                lessonPosition={lessonPosition}
                videoPositionSeconds={currentTime}
              />
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
              onClick={closeFullscreenNotes}
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
