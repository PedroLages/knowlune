/**
 * HighlightMiniPopover — actions for an existing highlight (tap on overlay).
 *
 * Desktop: compact floating toolbar anchored above/beside the highlight; measured clamp.
 * Mobile: fixed bottom sheet (same breakpoint as selection toolbar, max-width 639px).
 *
 * @module HighlightMiniPopover
 */
/* eslint-disable component-size/max-lines -- reader modal: view / edit / confirm-delete × sheet + desktop */
import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { StickyNote, Layers, BookA, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'
import { cn } from '@/app/components/ui/utils'
import type { BookHighlight, HighlightColor } from '@/data/types'
import {
  clampMiniPopoverPosition,
  type HighlightMiniPopoverAnchor,
} from '@/app/components/reader/highlightMiniPopoverPosition'

export type { HighlightMiniPopoverAnchor, MiniPopoverClampOptions } from '@/app/components/reader/highlightMiniPopoverPosition'
export { clampMiniPopoverPosition } from '@/app/components/reader/highlightMiniPopoverPosition'

const COLORS: { id: HighlightColor; bg: string; label: string }[] = [
  { id: 'yellow', bg: 'bg-[#FFEB3B]', label: 'Yellow' },
  { id: 'green', bg: 'bg-[#4CAF50]', label: 'Green' },
  { id: 'blue', bg: 'bg-[#42A5F5]', label: 'Highlight blue' },
  { id: 'pink', bg: 'bg-[#EC407A]', label: 'Highlight pink' },
]

interface HighlightMiniPopoverProps {
  highlight: BookHighlight
  anchor: HighlightMiniPopoverAnchor
  initialMode?: 'view' | 'edit' | 'confirm-delete'
  onClose: () => void
  onUpdate: (updates: Partial<Pick<BookHighlight, 'color' | 'note'>>) => Promise<void>
  onDelete: () => Promise<void>
  onCreateFlashcard: () => void
  onViewFlashcard: () => void
  onVocabulary?: () => void
}

function useReaderSheetLayout() {
  const [isSheet, setIsSheet] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 639px)')
    const apply = () => setIsSheet(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  return isSheet
}

export function HighlightMiniPopover({
  highlight,
  anchor,
  initialMode = 'view',
  onClose,
  onUpdate,
  onDelete,
  onCreateFlashcard,
  onViewFlashcard,
  onVocabulary,
}: HighlightMiniPopoverProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>(initialMode)
  const [currentColor, setCurrentColor] = useState<HighlightColor>(highlight.color)
  const [editColor, setEditColor] = useState<HighlightColor>(highlight.color)
  const [editNote, setEditNote] = useState(highlight.note ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const isSheet = useReaderSheetLayout()

  const [floatingPos, setFloatingPos] = useState(() =>
    clampMiniPopoverPosition(anchor, { width: 280, height: 72 })
  )

  useEffect(() => {
    setMode(initialMode)
    setCurrentColor(highlight.color)
    setEditColor(highlight.color)
    setEditNote(highlight.note ?? '')
  }, [highlight.id, initialMode])

  useEffect(() => {
    if (mode === 'edit') {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [mode])

  useLayoutEffect(() => {
    if (isSheet) return
    const run = () => {
      const el = popoverRef.current
      if (!el) return
      setFloatingPos(
        clampMiniPopoverPosition(anchor, {
          width: el.offsetWidth,
          height: el.offsetHeight,
        })
      )
    }
    run()
    const id = requestAnimationFrame(run)
    return () => cancelAnimationFrame(id)
  }, [anchor.centerX, anchor.top, anchor.bottom, mode, isSheet])

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
      setCurrentColor(editColor)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  const handleQuickColorSelect = async (color: HighlightColor) => {
    if (color === currentColor || isSaving) return
    const previousColor = currentColor
    setCurrentColor(color)
    setEditColor(color)
    setIsSaving(true)
    try {
      await onUpdate({ color })
    } catch {
      setCurrentColor(previousColor)
      setEditColor(previousColor)
      toast.error('Failed to update highlight color')
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

  const colorSwatches = (
    <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Highlight color">
      {COLORS.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            handleQuickColorSelect(c.id).catch(() => {
              /* silent-catch-ok */
            })
          }}
          disabled={isSaving}
          aria-label={`Change highlight color to ${c.label}`}
          aria-pressed={currentColor === c.id}
          data-testid={`mini-popover-color-${c.id}`}
          className={cn(
            'size-7 rounded-full border-2 transition-transform cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            'disabled:cursor-not-allowed disabled:opacity-60',
            c.bg,
            currentColor === c.id ? 'border-foreground scale-105' : 'border-transparent'
          )}
        />
      ))}
    </div>
  )

  const flashcardButton =
    highlight.flashcardId ? (
      <Button
        variant="ghost"
        size="icon"
        onClick={onViewFlashcard}
        className="size-10 sm:size-8 text-brand shrink-0 cursor-pointer"
        aria-label="View linked flashcard"
        data-testid="mini-popover-view-flashcard"
      >
        <Layers className="size-5 sm:size-4" aria-hidden="true" />
      </Button>
    ) : (
      <Button
        variant="ghost"
        size="icon"
        onClick={onCreateFlashcard}
        className="size-10 sm:size-8 text-muted-foreground shrink-0 cursor-pointer"
        aria-label="Create flashcard from highlight"
        data-testid="mini-popover-create-flashcard"
      >
        <Layers className="size-5 sm:size-4" aria-hidden="true" />
      </Button>
    )

  const viewToolbarRow = (
    <div className="flex items-center gap-1 min-w-0">
      {colorSwatches}
      <span className="h-8 w-px bg-border/60 shrink-0 mx-1" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMode('edit')}
        className="size-10 sm:size-8 text-muted-foreground shrink-0 cursor-pointer"
        aria-label={highlight.note ? 'Edit note' : 'Add note'}
        data-testid="mini-popover-edit"
      >
        <StickyNote className="size-5 sm:size-4" aria-hidden="true" />
      </Button>
      {flashcardButton}
      {onVocabulary && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onVocabulary}
          className="size-10 sm:size-8 text-muted-foreground shrink-0 cursor-pointer"
          aria-label="Add to vocabulary"
          data-testid="mini-popover-vocabulary"
        >
          <BookA className="size-5 sm:size-4" aria-hidden="true" />
        </Button>
      )}
      <span className="h-8 w-px bg-border/60 shrink-0 mx-1" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setMode('confirm-delete')}
        className="size-10 sm:size-8 text-destructive hover:text-destructive shrink-0 cursor-pointer"
        aria-label="Delete highlight"
        data-testid="mini-popover-delete"
      >
        <Trash2 className="size-5 sm:size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="size-10 sm:size-8 text-muted-foreground shrink-0 cursor-pointer"
        aria-label="Close highlight actions"
        data-testid="mini-popover-close"
      >
        <X className="size-5 sm:size-4" aria-hidden="true" />
      </Button>
    </div>
  )

  const viewBodyMobile = (
    <div className="space-y-3">
      <div className="flex items-start gap-2 min-w-0">
        <p className="text-xs text-foreground line-clamp-3 flex-1 min-w-0">{highlight.textAnchor}</p>
      </div>
      {highlight.note && (
        <div className="flex items-start gap-1.5 pl-5 min-w-0">
          <StickyNote className="size-3 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-xs text-muted-foreground italic line-clamp-3 min-w-0">{highlight.note}</p>
        </div>
      )}
      <div className="border-t border-border/50 pt-2">
        {colorSwatches}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode('edit')}
          className="h-9 px-2 text-xs gap-1 cursor-pointer"
          aria-label="Edit highlight"
          data-testid="mini-popover-edit"
        >
          <StickyNote className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode('confirm-delete')}
          className="h-9 px-2 text-xs gap-1 text-destructive hover:text-destructive cursor-pointer"
          aria-label="Delete highlight"
          data-testid="mini-popover-delete"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Delete
        </Button>
        <div className="flex-1 min-w-[1rem]" />
        {flashcardButton}
        {onVocabulary && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onVocabulary}
            className="size-9 text-muted-foreground shrink-0 cursor-pointer"
            aria-label="Add to vocabulary"
            data-testid="mini-popover-vocabulary"
          >
            <BookA className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )

  const editBody = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-foreground">Edit highlight</p>
        <button
          type="button"
          onClick={() => setMode('view')}
          aria-label="Cancel edit"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Highlight color">
        {COLORS.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setEditColor(c.id)}
            aria-label={c.label}
            aria-pressed={editColor === c.id}
            className={cn(
              'size-8 sm:size-6 rounded-full border-2 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              c.bg,
              editColor === c.id ? 'border-foreground scale-110' : 'border-transparent'
            )}
          />
        ))}
      </div>
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
            handleSaveEdit().catch(() => {
              /* silent-catch-ok */
            })
          }
          if (e.key === 'Escape') setMode('view')
        }}
        aria-label="Highlight note"
        data-testid="mini-popover-note-input"
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setMode('view')} className="h-9 sm:h-7 text-xs">
          Cancel
        </Button>
        <Button
          variant="brand"
          size="sm"
          onClick={() => {
            handleSaveEdit().catch(() => {
              /* silent-catch-ok */
            })
          }}
          disabled={isSaving}
          className="h-9 sm:h-7 text-xs gap-1"
          data-testid="mini-popover-save"
        >
          <Check className="size-3" aria-hidden="true" />
          Save
        </Button>
      </div>
    </div>
  )

  const confirmDeleteBody = (
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
          className="h-9 sm:h-7 text-xs"
          data-testid="mini-popover-cancel-delete"
        >
          No
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            handleDelete().catch(() => {
              /* silent-catch-ok */
            })
          }}
          disabled={isSaving}
          className="h-9 sm:h-7 text-xs"
          data-testid="mini-popover-confirm-delete"
        >
          Yes, delete
        </Button>
      </div>
    </div>
  )

  const sheetShell = (children: ReactNode) => (
    <div
      role="dialog"
      aria-label="Highlight actions"
      data-testid="highlight-mini-popover"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[60]',
        'border-t border-border bg-popover shadow-lg rounded-t-2xl',
        'px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
        'max-h-[min(70vh,520px)] overflow-y-auto'
      )}
    >
      {children}
    </div>
  )

  if (isSheet) {
    return sheetShell(
      <>
        {mode === 'view' && viewBodyMobile}
        {mode === 'edit' && editBody}
        {mode === 'confirm-delete' && confirmDeleteBody}
      </>
    )
  }

  return (
    <div
      ref={popoverRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic anchor clamping
      style={{ top: floatingPos.top, left: floatingPos.left }}
      className={cn(
        'fixed z-[60] rounded-xl bg-popover border border-border shadow-lg',
        mode === 'view'
          ? 'w-auto max-w-[calc(100vw-1rem)] px-2 py-1.5'
          : 'w-64 max-w-[min(24rem,calc(100vw-1rem))] p-3'
      )}
      data-testid="highlight-mini-popover"
    >
      {mode === 'view' && viewToolbarRow}
      {mode === 'edit' && editBody}
      {mode === 'confirm-delete' && confirmDeleteBody}
    </div>
  )
}
