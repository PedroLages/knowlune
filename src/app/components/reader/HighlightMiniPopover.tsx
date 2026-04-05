/**
 * HighlightMiniPopover — action popover for an existing highlight.
 *
 * Shown when the user taps/clicks an existing highlight annotation.
 * Two states:
 *   - view: shows note preview, Edit, Delete, and flashcard button
 *   - edit: shows color selector and note textarea for updating
 *
 * Positioned near the tapped highlight using fixed coordinates.
 *
 * @module HighlightMiniPopover
 */
import { useState, useRef, useEffect } from 'react'
import { StickyNote, Layers, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { cn } from '@/app/components/ui/utils'
import type { BookHighlight, HighlightColor } from '@/data/types'

const COLORS: { id: HighlightColor; bg: string; label: string }[] = [
  { id: 'yellow', bg: 'bg-[#FFEB3B]', label: 'Yellow' },
  { id: 'green', bg: 'bg-[#4CAF50]', label: 'Green' },
  { id: 'blue', bg: 'bg-[#42A5F5]', label: 'Blue' },
  { id: 'pink', bg: 'bg-[#EC407A]', label: 'Pink' },
]

interface HighlightMiniPopoverProps {
  highlight: BookHighlight
  position: { top: number; left: number }
  onClose: () => void
  onUpdate: (updates: Partial<Pick<BookHighlight, 'color' | 'note'>>) => Promise<void>
  onDelete: () => Promise<void>
  onCreateFlashcard: () => void
  onViewFlashcard: () => void
}

export function HighlightMiniPopover({
  highlight,
  position,
  onClose,
  onUpdate,
  onDelete,
  onCreateFlashcard,
  onViewFlashcard,
}: HighlightMiniPopoverProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view')
  const [editColor, setEditColor] = useState<HighlightColor>(highlight.color)
  const [editNote, setEditNote] = useState(highlight.note ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (mode === 'edit') {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [mode])

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const el = document.querySelector('[data-testid="highlight-mini-popover"]')
      if (el && !el.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      await onUpdate({ color: editColor, note: editNote || undefined })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsSaving(true)
    try {
      await onDelete()
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  // Clamp position to viewport edges
  const clampedLeft = Math.min(position.left, window.innerWidth - 280)

  return (
    <div
      style={{ top: position.top, left: Math.max(8, clampedLeft) }}
      className="fixed z-[60] w-64 rounded-xl bg-popover border border-border shadow-lg p-3"
      data-testid="highlight-mini-popover"
    >
      {/* View mode */}
      {mode === 'view' && (
        <div className="space-y-2">
          {/* Color indicator + text preview */}
          <div className="flex items-start gap-2">
            <span
              className={cn('size-3 rounded-full mt-0.5 shrink-0', COLORS.find(c => c.id === highlight.color)?.bg ?? 'bg-[#FFEB3B]')}
              aria-hidden="true"
            />
            <p className="text-xs text-foreground line-clamp-3 flex-1">
              {highlight.textAnchor}
            </p>
          </div>

          {/* Note preview */}
          {highlight.note && (
            <div className="flex items-start gap-1.5 pl-5">
              <StickyNote className="size-3 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-xs text-muted-foreground italic line-clamp-2">{highlight.note}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 pt-1 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('edit')}
              className="h-7 px-2 text-xs gap-1"
              aria-label="Edit highlight"
              data-testid="mini-popover-edit"
            >
              <Pencil className="size-3" aria-hidden="true" />
              Edit
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('confirm-delete')}
              className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
              aria-label="Delete highlight"
              data-testid="mini-popover-delete"
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Delete
            </Button>

            <div className="flex-1" />

            {highlight.flashcardId ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onViewFlashcard}
                className="size-7 text-brand"
                aria-label="View linked flashcard"
                data-testid="mini-popover-view-flashcard"
              >
                <Layers className="size-3.5" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCreateFlashcard}
                className="size-7 text-muted-foreground"
                aria-label="Create flashcard from highlight"
                data-testid="mini-popover-create-flashcard"
              >
                <Layers className="size-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Edit mode */}
      {mode === 'edit' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Edit highlight</p>
            <button
              onClick={() => setMode('view')}
              aria-label="Cancel edit"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Color selector */}
          <div className="flex gap-1.5" role="group" aria-label="Highlight color">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => setEditColor(c.id)}
                aria-label={`${c.label} highlight`}
                aria-pressed={editColor === c.id}
                className={cn(
                  'size-6 rounded-full border-2 transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  c.bg,
                  editColor === c.id ? 'border-foreground scale-110' : 'border-transparent'
                )}
              />
            ))}
          </div>

          {/* Note textarea */}
          <Textarea
            ref={textareaRef}
            value={editNote}
            onChange={e => setEditNote(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="text-xs resize-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSaveEdit().catch(() => { /* silent-catch-ok */ })
              }
              if (e.key === 'Escape') setMode('view')
            }}
            aria-label="Highlight note"
            data-testid="mini-popover-note-input"
          />

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('view')}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="brand"
              size="sm"
              onClick={() => { handleSaveEdit().catch(() => { /* silent-catch-ok */ }) }}
              disabled={isSaving}
              className="h-7 text-xs gap-1"
              data-testid="mini-popover-save"
            >
              <Check className="size-3" aria-hidden="true" />
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {mode === 'confirm-delete' && (
        <div className="space-y-3">
          <p className="text-xs text-foreground">Delete this highlight?</p>
          {highlight.flashcardId && (
            <p className="text-xs text-muted-foreground">
              The linked flashcard will be kept but the connection will be removed.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('view')}
              className="h-7 text-xs"
              data-testid="mini-popover-cancel-delete"
            >
              No
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { handleDelete().catch(() => { /* silent-catch-ok */ }) }}
              disabled={isSaving}
              className="h-7 text-xs"
              data-testid="mini-popover-confirm-delete"
            >
              Yes, delete
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
