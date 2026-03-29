/**
 * PlayerSidePanel — Tabbed side panel for the unified lesson player.
 *
 * Tabs: Notes (default), Transcript, AI Summary, Bookmarks
 *
 * Renders inside:
 * - Desktop: ResizablePanelGroup right panel
 * - Mobile: Sheet bottom drawer
 *
 * @see E89-S07
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Trash2, BookmarkIcon, AlertTriangle, FileText } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyState } from '@/app/components/EmptyState'
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
import type { CourseAdapter } from '@/lib/courseAdapter'
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
}

function TranscriptTab({ courseId, lessonId, adapter }: TranscriptTabProps) {
  const [cues, setCues] = useState<TranscriptCue[]>([])
  const [loadingState, setLoadingState] = useState<TranscriptLoadingState>('loading')

  // currentTime is intentionally 0 — transcript highlighting will be wired
  // when the video ref is lifted to a shared parent component (future work).
  const [currentTime] = useState(0)

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

  const handleSeek = useCallback((_time: number) => {
    // Transcript seek requires access to the video player ref.
    // In the unified player, video and side panel are siblings,
    // so seeking must be wired via parent state or event bus.
    // For now, this is a no-op — seek wiring comes with video ref lifting.
  }, [])

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
// Main component
// ---------------------------------------------------------------------------

interface PlayerSidePanelProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
}

export function PlayerSidePanel({ courseId, lessonId, adapter }: PlayerSidePanelProps) {
  const capabilities = adapter.getCapabilities()
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

  return (
    <Tabs defaultValue="notes" className="flex flex-col h-full" data-testid="player-side-panel">
      {/* Radix Tabs provides arrow-key navigation between triggers by default — no custom keyboard shortcuts needed. */}
      <TabsList className="w-full shrink-0 px-1">
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

      <TabsContent value="notes" className="flex-1 overflow-hidden">
        <NotesTab courseId={courseId} lessonId={lessonId} />
      </TabsContent>

      {capabilities.hasTranscript && (
        <TabsContent value="transcript" className="flex-1 overflow-hidden">
          <TranscriptTab courseId={courseId} lessonId={lessonId} adapter={adapter} />
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
