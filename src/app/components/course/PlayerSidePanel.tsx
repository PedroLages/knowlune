/**
 * PlayerSidePanel — Tabbed side panel for the unified lesson player.
 *
 * Tabs: Lessons (default), Notes, Transcript, AI Summary, Bookmarks
 *
 * Renders inside:
 * - Desktop: ResizablePanelGroup right panel
 * - Mobile: Sheet bottom drawer
 *
 * @see E89-S07
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  Trash2,
  BookmarkIcon,
  AlertTriangle,
  FileText,
  Video,
  PlayCircle,
  Maximize2,
  X,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { NoteEditor } from '@/app/components/notes/NoteEditor'
import { TranscriptPanel } from '@/app/components/youtube/TranscriptPanel'
import type { TranscriptLoadingState } from '@/app/components/youtube/TranscriptPanel'
import { AISummaryPanel } from '@/app/components/figma/AISummaryPanel'
import { useNoteStore } from '@/stores/useNoteStore'
import {
  getLessonBookmarks,
  deleteBookmark,
  addBookmark,
  formatBookmarkTimestamp,
} from '@/lib/bookmarks'
import { toastWithUndo, toastError } from '@/lib/toastHelpers'
import type { CourseAdapter, LessonItem } from '@/lib/courseAdapter'
import type { Note, VideoBookmark, TranscriptCue, CourseSource } from '@/data/types'
import { db } from '@/db/schema'

/** Source type constant to avoid magic strings when checking adapter source. */
const YOUTUBE_SOURCE: CourseSource = 'youtube'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NotesTabProps {
  courseId: string
  lessonId: string
}

function NotesTab({ courseId, lessonId }: NotesTabProps) {
  const notes = useNoteStore(s => s.notes)
  const loadNotesByLesson = useNoteStore(s => s.loadNotesByLesson)
  const saveNote = useNoteStore(s => s.saveNote)
  const addNote = useNoteStore(s => s.addNote)
  const isLoading = useNoteStore(s => s.isLoading)

  useEffect(() => {
    loadNotesByLesson(courseId, lessonId)
  }, [courseId, lessonId, loadNotesByLesson])

  const existingNote = notes.find(n => n.courseId === courseId && n.videoId === lessonId)

  const handleSave = useCallback(
    async (content: string, tags: string[]) => {
      if (existingNote) {
        await saveNote({
          ...existingNote,
          content,
          tags,
          updatedAt: new Date().toISOString(),
        })
      } else {
        const newNote: Note = {
          id: crypto.randomUUID(),
          courseId,
          videoId: lessonId,
          content,
          tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await addNote(newNote)
      }
    },
    [courseId, lessonId, existingNote, saveNote, addNote]
  )

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <NoteEditor
        courseId={courseId}
        lessonId={lessonId}
        noteId={existingNote?.id}
        initialContent={existingNote?.content ?? ''}
        onSave={handleSave}
        compact
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

interface TranscriptTabProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
  /** Current video playback time in seconds (for active cue highlighting) */
  currentTime?: number
  /** Callback when user clicks a cue to seek the video */
  onSeek?: (time: number) => void
}

function TranscriptTab({
  courseId,
  lessonId,
  adapter,
  currentTime: externalTime,
  onSeek: externalSeek,
}: TranscriptTabProps) {
  const [cues, setCues] = useState<TranscriptCue[]>([])
  const [loadingState, setLoadingState] = useState<TranscriptLoadingState>('loading')

  const currentTime = externalTime ?? 0

  // Single effect for transcript loading. For YouTube sources, prefer Dexie
  // (richer cue data with timing) and fall back to adapter.getTranscript().
  // For local sources, use adapter.getTranscript() only.
  // Merging into one effect eliminates the race condition between two
  // independent effects that both call setCues/setLoadingState.
  useEffect(() => {
    let cancelled = false
    setLoadingState('loading')
    setCues([])

    const isYouTube = adapter.getSource() === YOUTUBE_SOURCE

    const loadTranscript = async () => {
      // YouTube: try Dexie first for richer cue data
      if (isYouTube) {
        try {
          const video = await db.importedVideos.get(lessonId)
          if (!cancelled && video?.youtubeVideoId) {
            const transcript = await db.youtubeTranscripts
              .where('[courseId+videoId]')
              .equals([courseId, video.youtubeVideoId])
              .first()

            if (!cancelled && transcript?.status === 'done' && transcript.cues?.length) {
              setCues(transcript.cues)
              setLoadingState('ready')
              return // Dexie had data — done
            }
          }
        } catch {
          // silent-catch-ok — fall through to adapter.getTranscript()
        }
      }

      // Fallback (all sources): use adapter.getTranscript()
      try {
        const transcriptText = await adapter.getTranscript(lessonId)
        if (cancelled) return

        if (!transcriptText) {
          setLoadingState('empty')
          return
        }

        const parsed = parseTranscriptText(transcriptText)
        if (parsed.length === 0) {
          setLoadingState('empty')
          return
        }

        setCues(parsed)
        setLoadingState('ready')
      } catch {
        // silent-catch-ok — error state handled by component
        if (!cancelled) setLoadingState('error')
      }
    }

    loadTranscript()

    return () => {
      cancelled = true
    }
  }, [adapter, courseId, lessonId])

  const handleSeek = useCallback(
    (time: number) => {
      if (externalSeek) {
        externalSeek(time)
      }
    },
    [externalSeek]
  )

  return (
    <div className="h-full">
      <TranscriptPanel
        cues={cues}
        currentTime={currentTime}
        onSeek={handleSeek}
        loadingState={loadingState}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

interface LessonBookmarksTabProps {
  courseId: string
  lessonId: string
}

function LessonBookmarksTab({ courseId, lessonId }: LessonBookmarksTabProps) {
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)

    getLessonBookmarks(courseId, lessonId)
      .then(bm => {
        if (!ignore) {
          setBookmarks(bm)
          setIsLoading(false)
        }
      })
      .catch(() => {
        // silent-catch-ok — error state handled by component
        if (!ignore) {
          setError('Failed to load bookmarks')
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [courseId, lessonId])

  const handleDelete = async (bookmark: VideoBookmark) => {
    const bookmarkBackup = { ...bookmark }

    try {
      setBookmarks(prev => prev.filter(b => b.id !== bookmark.id))
      await deleteBookmark(bookmark.id)

      toastWithUndo({
        message: `Bookmark at ${formatBookmarkTimestamp(bookmark.timestamp)} deleted`,
        onUndo: async () => {
          await addBookmark(
            bookmarkBackup.courseId,
            bookmarkBackup.lessonId,
            bookmarkBackup.timestamp,
            bookmarkBackup.label
          )
          setBookmarks(prev => [...prev, bookmarkBackup])
          toast.success('Bookmark restored')
        },
        duration: 5000,
      })
    } catch {
      setBookmarks(prev => [...prev, bookmarkBackup])
      toastError.deleteFailed('bookmark')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading bookmarks...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-destructive">
        <AlertTriangle className="mb-3 size-12 opacity-60" />
        <p>{error}</p>
        <p className="text-xs mt-1 text-muted-foreground">Try refreshing the page</p>
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <EmptyState
        icon={BookmarkIcon}
        title="No bookmarks yet"
        description="Bookmark moments in this video to find them later"
      />
    )
  }

  return (
    <div className="space-y-2 p-2">
      {bookmarks.map(bookmark => (
        <div
          key={bookmark.id}
          data-testid="bookmark-entry"
          className="group flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="shrink-0 w-14 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <span className="text-xs font-mono font-semibold text-warning">
                {formatBookmarkTimestamp(bookmark.timestamp)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {bookmark.label || formatBookmarkTimestamp(bookmark.timestamp)}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(bookmark.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
            onClick={() => handleDelete(bookmark)}
            aria-label="Delete bookmark"
          >
            <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// VTT parser (for local transcript text)
// ---------------------------------------------------------------------------

function parseTime(t: string): number {
  const parts = t.replace(',', '.').split(':')
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
  }
  return parseFloat(parts[0]) * 60 + parseFloat(parts[1])
}

function parseTranscriptText(text: string): TranscriptCue[] {
  const blocks = text.trim().split(/\n\n+/)
  const cues: TranscriptCue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const timestampLine = lines.find(l => l.includes('-->'))
    if (!timestampLine) continue

    const match = timestampLine.match(
      /(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-->\s*(\d+:\d{2}(?::\d{2})?(?:[.,]\d+)?)/
    )
    if (!match) continue

    const startTime = parseTime(match[1])
    const endTime = parseTime(match[2])

    const tsIdx = lines.indexOf(timestampLine)
    const textLines = lines.slice(tsIdx + 1).filter(l => l.trim())
    if (!textLines.length) continue

    cues.push({ startTime, endTime, text: textLines.join(' ') })
  }

  return cues
}

// ---------------------------------------------------------------------------
// Lessons tab — course structure with active lesson highlight
// ---------------------------------------------------------------------------

function formatLessonDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

interface LessonsTabProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
}

function LessonsTab({ courseId, lessonId, adapter }: LessonsTabProps) {
  const [lessons, setLessons] = useState<LessonItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)

    adapter
      .getLessons()
      .then(items => {
        if (!ignore) {
          setLessons(items)
          setIsLoading(false)
        }
      })
      .catch(() => {
        // silent-catch-ok — error state handled by empty list
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [adapter])

  // Scroll active lesson into view on mount
  useEffect(() => {
    if (!isLoading && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [isLoading, lessonId])

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (lessons.length === 0) {
    return (
      <EmptyState icon={Video} title="No lessons" description="This course has no lessons yet" />
    )
  }

  const currentIndex = lessons.findIndex(l => l.id === lessonId)

  return (
    <div className="p-2 space-y-0.5" data-testid="lessons-tab-list">
      <div className="px-2 pb-2 text-xs text-muted-foreground">
        {currentIndex >= 0
          ? `Lesson ${currentIndex + 1} of ${lessons.length}`
          : `${lessons.length} lessons`}
      </div>
      {lessons.map((lesson, index) => {
        const isActive = lesson.id === lessonId
        return (
          <Link
            key={lesson.id}
            ref={isActive ? activeRef : undefined}
            to={`/courses/${courseId}/lessons/${lesson.id}`}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
              isActive ? 'bg-brand-soft text-brand-soft-foreground font-medium' : 'hover:bg-accent'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="flex-shrink-0 size-7 rounded-lg bg-brand-soft/50 flex items-center justify-center">
              {isActive ? (
                <PlayCircle className="size-3.5 text-brand" aria-hidden="true" />
              ) : (
                <span className="text-xs font-semibold text-brand-soft-foreground">
                  {index + 1}
                </span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{lesson.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {lesson.type === 'pdf' ? (
                  <FileText className="size-3 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <Video className="size-3 text-muted-foreground" aria-hidden="true" />
                )}
                {lesson.duration != null && lesson.duration > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {formatLessonDuration(lesson.duration)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

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
}

export function PlayerSidePanel({
  courseId,
  lessonId,
  adapter,
  currentTime: externalCurrentTime,
  onSeek: externalOnSeek,
  focusTab,
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
  const fullscreenOverlayRef = useRef<HTMLDivElement>(null)
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

  // Controlled tab state to allow programmatic switching (e.g. N key → Notes tab)
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
        <NotesTab courseId={courseId} lessonId={lessonId} />
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
            <NotesTab courseId={courseId} lessonId={lessonId} />
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
        <LessonBookmarksTab courseId={courseId} lessonId={lessonId} />
      </TabsContent>
    </Tabs>
  )
}
