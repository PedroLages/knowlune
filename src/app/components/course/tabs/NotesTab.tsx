/**
 * NotesTab — Notes editing sub-panel for PlayerSidePanel.
 *
 * Extracted from PlayerSidePanel.tsx to reduce god-component complexity.
 */

import { useEffect, useCallback, useState } from 'react'
import { Link2 } from 'lucide-react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Badge } from '@/app/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { NoteEditor } from '@/app/components/notes/NoteEditor'
import { useNoteStore } from '@/stores/useNoteStore'
import {
  acceptNoteLinkSuggestion,
  dismissNoteLinkPair,
} from '@/ai/knowledgeGaps/noteLinkSuggestions'
import { db } from '@/db'
import type { Note } from '@/data/types'
import type { NoteLinkSuggestion } from '@/ai/knowledgeGaps/types'
import type { CapturedFrame } from '@/lib/frame-capture'

export interface NotesTabProps {
  courseId: string
  lessonId: string
  /** Callback when user clicks a timestamp link to seek video */
  onSeek?: (time: number) => void
  /** Current video playback time in seconds (for timestamp insertion) */
  currentTime?: number
  /** Callback to capture the current video frame as a JPEG for embedding in notes */
  onCaptureFrame?: () => Promise<CapturedFrame | null>
  /** Callback when save status changes (for parent toolbar "Saved" indicator). */
  onSaveStatusChange?: (status: 'idle' | 'saved') => void
  /** When true, stretch editor to fill available vertical space (desktop side panel). */
  fillHeight?: boolean
}

export function NotesTab({
  courseId,
  lessonId,
  onSeek,
  currentTime,
  onCaptureFrame,
  onSaveStatusChange,
  fillHeight = false,
}: NotesTabProps) {
  const notes = useNoteStore(s => s.notes)
  const loadNotesByLesson = useNoteStore(s => s.loadNotesByLesson)
  const saveNote = useNoteStore(s => s.saveNote)
  const addNote = useNoteStore(s => s.addNote)
  const isLoading = useNoteStore(s => s.isLoading)
  const pendingData = useNoteStore(s => s.pendingNoteLinkSuggestions)
  const pendingNoteLinkSuggestions =
    pendingData?.courseId === courseId && pendingData?.videoId === lessonId
      ? pendingData.suggestions
      : []
  const clearPendingNoteLinkSuggestions = useNoteStore(s => s.clearPendingNoteLinkSuggestions)

  // Clear stale suggestions on lesson/course change
  useEffect(() => {
    clearPendingNoteLinkSuggestions()
  }, [courseId, lessonId, clearPendingNoteLinkSuggestions])

  useEffect(() => {
    loadNotesByLesson(courseId, lessonId)
  }, [courseId, lessonId, loadNotesByLesson])

  const existingNote = notes.find(n => n.courseId === courseId && n.videoId === lessonId)

  // Seed notes with YouTube video description when no note exists yet
  const [videoDescription, setVideoDescription] = useState('')
  useEffect(() => {
    if (existingNote || isLoading) return
    let ignore = false
    db.importedVideos
      .get(lessonId)
      .then(v => {
        if (ignore) return
        if (v?.description) {
          const html = v.description
            .split(/\n{2,}/)
            .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('')
          setVideoDescription(html)
        }
      })
      // silent-catch-ok: video description is optional seed data; failure is non-critical
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [lessonId, existingNote, isLoading])

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

  const handleLinkNotes = useCallback(
    async (suggestion: NoteLinkSuggestion) => {
      await acceptNoteLinkSuggestion(suggestion, (source, target) => {
        useNoteStore.setState(state => ({
          notes: state.notes.map(n => {
            if (n.id === source.id) return source
            if (n.id === target.id) return target
            return n
          }),
        }))
      })
      useNoteStore.setState(state => {
        const data = state.pendingNoteLinkSuggestions
        if (!data) return state
        return {
          pendingNoteLinkSuggestions: {
            ...data,
            suggestions: data.suggestions.filter(
              s =>
                s.sourceNoteId !== suggestion.sourceNoteId ||
                s.targetNoteId !== suggestion.targetNoteId
            ),
          },
        }
      })
    },
    []
  )

  const handleDismissSuggestion = useCallback(
    (suggestion: NoteLinkSuggestion) => {
      dismissNoteLinkPair(suggestion.sourceNoteId, suggestion.targetNoteId)
      useNoteStore.setState(state => {
        const data = state.pendingNoteLinkSuggestions
        if (!data) return state
        return {
          pendingNoteLinkSuggestions: {
            ...data,
            suggestions: data.suggestions.filter(
              s =>
                s.sourceNoteId !== suggestion.sourceNoteId ||
                s.targetNoteId !== suggestion.targetNoteId
            ),
          },
        }
      })
    },
    []
  )

  if (isLoading) {
    if (fillHeight) {
      return (
        <div className="flex flex-col flex-1 min-h-0 p-4">
          <Skeleton className="h-4 w-32 shrink-0" />
          <Skeleton className="flex-1 min-h-[250px] w-full mt-3" />
        </div>
      )
    }

    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className={fillHeight ? 'flex flex-col flex-1 min-h-0' : 'h-full overflow-auto'}>
      {/* Inline note link suggestions badge */}
      {pendingNoteLinkSuggestions.length > 0 && (
        <div className={cn('px-5 pt-3', fillHeight && 'shrink-0')}>
          <Popover>
            <PopoverTrigger asChild>
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1"
                data-testid="note-link-suggestions-badge"
                aria-label="View note link suggestions"
              >
                <Link2 className="size-3" />
                {pendingNoteLinkSuggestions.length}{' '}
                suggestion{pendingNoteLinkSuggestions.length !== 1 ? 's' : ''}
              </Badge>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80">
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Note connection{pendingNoteLinkSuggestions.length !== 1 ? 's' : ''} found
                </p>
                {pendingNoteLinkSuggestions.map(suggestion => (
                  <div
                    key={`${suggestion.sourceNoteId}:${suggestion.targetNoteId}`}
                    className="space-y-2 rounded-md border p-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {suggestion.targetCourseTitle}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      &ldquo;{suggestion.previewContent}&rdquo;
                    </p>
                    {suggestion.sharedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {suggestion.sharedTags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="brand"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleLinkNotes(suggestion)}
                        data-testid="note-link-accept"
                      >
                        Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDismissSuggestion(suggestion)}
                        data-testid="note-link-dismiss"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
      <NoteEditor
        courseId={courseId}
        lessonId={lessonId}
        noteId={existingNote?.id}
        initialContent={existingNote?.content ?? videoDescription}
        onSave={handleSave}
        onVideoSeek={onSeek}
        currentVideoTime={currentTime}
        onCaptureFrame={onCaptureFrame}
        onSaveStatusChange={onSaveStatusChange}
        compact
        fillHeight={fillHeight}
        className={fillHeight ? 'flex-1 min-h-0' : undefined}
      />
    </div>
  )
}
