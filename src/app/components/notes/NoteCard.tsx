import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, ChevronUp, Pencil, Trash2, X, Clock, Download } from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { NoteEditor } from './NoteEditor'
import { ReadOnlyContent } from './ReadOnlyContent'
import { useNoteStore } from '@/stores/useNoteStore'
import { formatTimestamp } from '@/lib/format'
import { stripHtml } from '@/lib/textUtils'
import { toast } from 'sonner'
import { exportNoteAsMarkdown } from '@/lib/noteExport'
import { toastWithUndo } from '@/lib/toastHelpers'
import type { Note } from '@/data/types'

interface NoteCardProps {
  note: Note
  lessonTitle: string
  courseId: string
  courseName: string
  onDelete: (noteId: string) => Promise<void>
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  const weeks = Math.floor(diffDays / 7)
  if (diffDays < 30) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  return date.toLocaleDateString()
}

type ViewState = 'collapsed' | 'expanded' | 'editing'

export function NoteCard({ note, courseId, courseName, lessonTitle, onDelete }: NoteCardProps) {
  const [viewState, setViewState] = useState<ViewState>('collapsed')
  const saveNote = useNoteStore(s => s.saveNote)
  const cancelRef = useRef(false)

  const preview = stripHtml(note.content)
  const snippet = preview.length > 120 ? preview.slice(0, 120) + '...' : preview

  const toggleExpand = () => {
    setViewState(v => (v === 'collapsed' ? 'expanded' : 'collapsed'))
  }

  const handleSave = async (content: string, tags: string[]) => {
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    try {
      await saveNote({
        ...note,
        content,
        tags,
        updatedAt: new Date().toISOString(),
      })
      setViewState('expanded')
      toast.success('Note saved')
    } catch {
      toast.error('Failed to save note')
    }
  }

  const handleDelete = async () => {
    const noteBackup = { ...note }

    try {
      await onDelete(note.id)

      toastWithUndo({
        message: 'Note deleted',
        onUndo: async () => {
          await saveNote(noteBackup)
          toast.success('Note restored', { duration: 3000 })
        },
        duration: 5000,
      })
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const handleCancel = () => {
    cancelRef.current = true
    setViewState('expanded')
  }

  const handleExport = () => {
    try {
      exportNoteAsMarkdown(note, courseName, lessonTitle)
      toast.success('Note exported successfully')
    } catch {
      toast.error('Failed to export note')
    }
  }

  return (
    <div
      id={`note-${note.id}`}
      data-note-id={note.id}
      className="relative bg-card rounded-2xl border p-4 transition-shadow hover:shadow-sm"
    >
      {/* Card header */}
      <div className="relative flex items-start justify-between gap-3">
        {/* Overlay button for click-to-expand — sits behind interactive children */}
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-pointer"
          onClick={toggleExpand}
          aria-label={viewState === 'collapsed' ? 'Expand note' : 'Collapse note'}
          tabIndex={0}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground line-clamp-2">{snippet}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {note.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {note.timestamp != null && (
              <Link
                to={`/courses/${courseId}/lessons/${note.videoId}?t=${note.timestamp}&panel=notes`}
                className="relative z-10 inline-flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <Clock className="size-3" />
                {formatTimestamp(note.timestamp)}
              </Link>
            )}
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(note.updatedAt)}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="relative z-10 shrink-0 inline-flex items-center justify-center size-11 rounded-md hover:bg-accent transition-colors"
          aria-expanded={viewState !== 'collapsed'}
          aria-label={viewState === 'collapsed' ? 'Expand note' : 'Collapse note'}
          onClick={toggleExpand}
        >
          {viewState === 'collapsed' ? (
            <ChevronDown aria-hidden="true" className="size-4" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>

      {/* Expanded view */}
      {viewState === 'expanded' && (
        <div className="mt-4 border-t pt-4">
          <ReadOnlyContent content={note.content} />
          <div className="flex items-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setViewState('editing')}>
              <Pencil className="size-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              data-testid="export-note-button"
            >
              <Download className="size-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              data-testid="delete-note-button"
              onClick={handleDelete}
            >
              <Trash2 className="size-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Edit mode */}
      {viewState === 'editing' && (
        <div className="mt-4 border-t pt-4">
          <NoteEditor
            courseId={courseId}
            lessonId={note.videoId}
            initialContent={note.content}
            onSave={handleSave}
          />
          <Button variant="ghost" size="sm" className="mt-2" onClick={handleCancel}>
            <X className="size-3.5 mr-1.5" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
