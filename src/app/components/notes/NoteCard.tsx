import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Pencil, Trash2, Clock, X } from 'lucide-react'
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
} from '@/app/components/ui/alert-dialog'
import { NoteEditor } from './NoteEditor'
import { useNoteStore } from '@/stores/useNoteStore'
import { formatTimestamp } from '@/lib/format'
import { toast } from 'sonner'
import type { Note } from '@/data/types'

interface NoteCardProps {
  note: Note
  courseId: string
  lessonTitle: string
}

/** Strip HTML tags and collapse whitespace for preview text */
function getPreviewText(html: string, maxLength = 120): string {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '\u2026'
}

/** Format an ISO date string to a relative or short date */
function formatRelativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Rewrite video:// protocol links to navigable lesson URLs with ?t= param.
 * Content is self-authored via Tiptap editor and stored in local IndexedDB.
 */
function rewriteTimestampLinks(html: string, courseId: string, videoId: string): string {
  return html.replace(
    /href="video:\/\/(\d+(?:\.\d+)?)"/g,
    (_match, seconds) => `href="/courses/${courseId}/${videoId}?t=${seconds}"`,
  )
}

export function NoteCard({ note, courseId, lessonTitle }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { saveNote, deleteNote } = useNoteStore()

  const preview = getPreviewText(note.content)
  const hasContent = preview.length > 0

  const handleSave = useCallback(
    (content: string, tags: string[]) => {
      saveNote({
        ...note,
        content,
        tags,
        updatedAt: new Date().toISOString(),
      })
    },
    [note, saveNote],
  )

  const handleDelete = useCallback(async () => {
    await deleteNote(note.id)
    toast('Note deleted')
    setDeleteOpen(false)
  }, [note.id, deleteNote])

  if (editing) {
    return (
      <div className="bg-card rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-muted-foreground">{lessonTitle}</h4>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setEditing(false)}
            aria-label="Close editor"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <NoteEditor
          courseId={courseId}
          lessonId={note.videoId}
          initialContent={note.content}
          onSave={handleSave}
        />
      </div>
    )
  }

  return (
    <>
      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        {/* Collapsed header — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-start gap-3 p-4 text-left hover:bg-accent/50 transition-colors cursor-pointer"
          aria-expanded={expanded}
        >
          <span className="mt-0.5 shrink-0 text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>

          <div className="flex-1 min-w-0">
            {hasContent ? (
              <p className="text-sm line-clamp-2">{preview}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Empty note</p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {note.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
              {note.timestamp != null && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(note.timestamp)}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {formatRelativeDate(note.updatedAt)}
              </span>
            </div>
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="border-t border-border">
            {/* Action buttons */}
            <div className="flex items-center justify-end gap-1 px-4 pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>

            {/* Rendered note content — self-authored HTML from Tiptap, stored locally */}
            <div
              className="prose prose-sm dark:prose-invert max-w-none px-5 pb-4 pt-2
                [&_a[href^='/courses/']]:text-brand [&_a[href^='/courses/']]:underline [&_a[href^='/courses/']]:cursor-pointer"
              dangerouslySetInnerHTML={{
                __html: rewriteTimestampLinks(note.content, courseId, note.videoId),
              }}
            />
          </div>
        )}
      </div>

      {/* Delete confirmation dialog (NFR23) */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your note for &ldquo;{lessonTitle}&rdquo;. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
