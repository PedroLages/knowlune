import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, ChevronUp, Pencil, Trash2, X, Clock } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog'
import { NoteEditor } from './NoteEditor'
import { useNoteStore } from '@/stores/useNoteStore'
import { formatTimestamp } from '@/lib/format'
import { toast } from 'sonner'
import type { Note } from '@/data/types'

interface NoteCardProps {
  note: Note
  lessonTitle: string
  courseId: string
  onDelete: (noteId: string) => Promise<void>
}

/** Strip HTML tags to extract plain text for preview snippets. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim()
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

/** Read-only Tiptap renderer — mounts only when expanded to avoid stale content. */
function ReadOnlyContent({ content }: { content: string }) {
  const editor = useEditor({
    editable: false,
    content,
    extensions: [StarterKit],
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none' },
    },
  })
  return <EditorContent editor={editor} />
}

type ViewState = 'collapsed' | 'expanded' | 'editing'

export function NoteCard({ note, courseId, onDelete }: NoteCardProps) {
  const [viewState, setViewState] = useState<ViewState>('collapsed')
  const saveNote = useNoteStore(s => s.saveNote)
  const cancelRef = useRef(false)

  const preview = stripHtml(note.content)
  const snippet = preview.length > 120 ? preview.slice(0, 120) + '...' : preview

  const toggleExpand = () => {
    setViewState(v => v === 'collapsed' ? 'expanded' : 'collapsed')
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
    try {
      await onDelete(note.id)
      toast.success('Note deleted')
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const handleCancel = () => {
    cancelRef.current = true
    setViewState('expanded')
  }

  return (
    <div className="bg-card rounded-[24px] border p-4 transition-shadow hover:shadow-sm">
      {/* Card header — click anywhere to toggle (mouse), use chevron button for keyboard */}
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={toggleExpand}
      >
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
                to={`/courses/${courseId}/${note.videoId}?t=${note.timestamp}&panel=notes`}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                onClick={e => e.stopPropagation()}
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
          className="shrink-0 inline-flex items-center justify-center size-11 rounded-md hover:bg-accent transition-colors"
          aria-expanded={viewState !== 'collapsed'}
          aria-label={viewState === 'collapsed' ? 'Expand note' : 'Collapse note'}
          onClick={e => { e.stopPropagation(); toggleExpand() }}
        >
          {viewState === 'collapsed'
            ? <ChevronDown aria-hidden="true" className="size-4" />
            : <ChevronUp aria-hidden="true" className="size-4" />
          }
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid="delete-note-button">
                  <Trash2 className="size-3.5 mr-1.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The note and its search index entry will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
