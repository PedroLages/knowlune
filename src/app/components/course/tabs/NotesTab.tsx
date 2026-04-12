/**
 * NotesTab — Notes editing sub-panel for PlayerSidePanel.
 *
 * Extracted from PlayerSidePanel.tsx to reduce god-component complexity.
 */

import { useEffect, useCallback, useState } from 'react'
import { Skeleton } from '@/app/components/ui/skeleton'
import { NoteEditor } from '@/app/components/notes/NoteEditor'
import { useNoteStore } from '@/stores/useNoteStore'
import { db } from '@/db'
import type { Note } from '@/data/types'
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
}

export function NotesTab({
  courseId,
  lessonId,
  onSeek,
  currentTime,
  onCaptureFrame,
}: NotesTabProps) {
  const notes = useNoteStore(s => s.notes)
  const loadNotesByLesson = useNoteStore(s => s.loadNotesByLesson)
  const saveNote = useNoteStore(s => s.saveNote)
  const addNote = useNoteStore(s => s.addNote)
  const isLoading = useNoteStore(s => s.isLoading)

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
        initialContent={existingNote?.content ?? videoDescription}
        onSave={handleSave}
        onVideoSeek={onSeek}
        currentVideoTime={currentTime}
        onCaptureFrame={onCaptureFrame}
        compact
      />
    </div>
  )
}
