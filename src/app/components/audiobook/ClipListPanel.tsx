/**
 * ClipListPanel — Sheet panel listing all audio clips for the current audiobook.
 *
 * Features:
 * - Drag-and-drop reordering via @dnd-kit (PointerSensor + KeyboardSensor)
 * - Inline title editing (Enter saves, Escape cancels)
 * - Delete with inline confirmation
 * - Tap a clip row to seek to its start time and play to end time
 *
 * @module ClipListPanel
 * @since E111-S01
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Play, Check, X } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/components/ui/utils'
import { useAudioClipStore } from '@/stores/useAudioClipStore'
import { formatAudioTime } from '@/app/hooks/useAudioPlayer'
import type { AudioClip, BookChapter } from '@/data/types'

interface ClipListPanelProps {
  open: boolean
  onClose: () => void
  bookId: string
  chapters: BookChapter[]
  onPlayClip: (chapterIndex: number, startTime: number, endTime: number) => void
}

// ─── Sortable clip item ───────────────────────────────────────────────────────

interface SortableClipItemProps {
  clip: AudioClip
  chapterTitle: string
  onPlay: () => void
  onUpdateTitle: (title: string) => void
  onDelete: () => void
}

function SortableClipItem({
  clip,
  chapterTitle,
  onPlay,
  onUpdateTitle,
  onDelete,
}: SortableClipItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: clip.id,
  })

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(clip.title ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleEditStart = () => {
    setEditValue(clip.title ?? '')
    setIsEditing(true)
    // Focus after state flush
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleEditSave = () => {
    const trimmed = editValue.trim()
    if (trimmed !== (clip.title ?? '')) {
      onUpdateTitle(trimmed)
    }
    setIsEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleEditSave()
    if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(clip.title ?? '')
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
      style={style}
      {...attributes}
      role="listitem"
      aria-roledescription="sortable"
      className={cn(
        'flex items-start gap-2 px-4 py-3 border-b border-border/50',
        isDragging && 'opacity-50'
      )}
      data-testid="clip-item"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="shrink-0 mt-1 rounded p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground active:cursor-grabbing cursor-grab touch-manipulation"
        aria-label="Drag to reorder clip"
        data-testid="clip-drag-handle"
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Seek / play button */}
        <button
          type="button"
          onClick={onPlay}
          className="flex items-center gap-1.5 text-left w-full hover:text-brand transition-colors min-h-[44px]"
          aria-label={`Play clip from ${chapterTitle} ${formatAudioTime(clip.startTime)} to ${formatAudioTime(clip.endTime)}`}
        >
          <Play className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="text-xs font-medium text-muted-foreground truncate">
            {chapterTitle} · {formatAudioTime(clip.startTime)} – {formatAudioTime(clip.endTime)}
          </span>
        </button>

        {/* Title: editable inline */}
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleEditSave}
              placeholder="Add a title..."
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Clip title"
              data-testid="clip-title-input"
            />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 size-7 text-success hover:text-success"
              onClick={handleEditSave}
              aria-label="Save clip title"
            >
              <Check className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-foreground truncate">
            {clip.title || <span className="text-muted-foreground italic">Untitled clip</span>}
          </p>
        )}

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Delete this clip?</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onDelete}
              aria-label="Confirm delete clip"
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirmDelete(false)}
              aria-label="Cancel delete"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 items-start gap-1 mt-1">
        {!isEditing && !confirmDelete && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={handleEditStart}
              aria-label="Edit clip title"
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete clip"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </>
        )}
        {isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsEditing(false)
              setEditValue(clip.title ?? '')
            }}
            aria-label="Cancel editing"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Drag overlay ghost card ──────────────────────────────────────────────────

function ClipDragOverlay({ clip, chapterTitle }: { clip: AudioClip; chapterTitle: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-card px-4 py-3 shadow-xl">
      <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground truncate">
          {chapterTitle} · {formatAudioTime(clip.startTime)} – {formatAudioTime(clip.endTime)}
        </p>
        <p className="text-sm text-foreground truncate">{clip.title || 'Untitled clip'}</p>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function ClipListPanel({ open, onClose, bookId, chapters, onPlayClip }: ClipListPanelProps) {
  const clips = useAudioClipStore(s => s.clips)
  const isLoaded = useAudioClipStore(s => s.isLoaded)
  const loadedBookId = useAudioClipStore(s => s.loadedBookId)
  const loadClips = useAudioClipStore(s => s.loadClips)
  const updateClipTitle = useAudioClipStore(s => s.updateClipTitle)
  const deleteClip = useAudioClipStore(s => s.deleteClip)
  const reorderClips = useAudioClipStore(s => s.reorderClips)

  const [activeId, setActiveId] = useState<string | null>(null)

  // Load clips when panel opens
  useEffect(() => {
    if (!open) return
    loadClips(bookId)
  }, [open, bookId, loadClips])

  // Force reload when bookId changes (panel was open for a different book)
  useEffect(() => {
    if (open && loadedBookId !== bookId) {
      loadClips(bookId)
    }
  }, [bookId, open, loadedBookId, loadClips])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const oldIndex = clips.findIndex(c => c.id === active.id)
      const newIndex = clips.findIndex(c => c.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      reorderClips(oldIndex, newIndex)
    },
    [clips, reorderClips]
  )

  const activeClip = activeId ? clips.find(c => c.id === activeId) : null

  return (
    <Sheet
      open={open}
      onOpenChange={v => {
        if (!v) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-md p-0"
        data-testid="clip-list-panel"
      >
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/50">
          <SheetTitle>Clips</SheetTitle>
        </SheetHeader>

        {!isLoaded || clips.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground px-4 text-center">
            {!isLoaded
              ? 'Loading clips…'
              : 'No clips yet. Tap "Start Clip" while listening to save a passage.'}
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={clips.map(c => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul role="list" aria-label="Audio clips">
                    {clips.map(clip => {
                      const chapterTitle =
                        chapters[clip.chapterIndex]?.title ?? `Chapter ${clip.chapterIndex + 1}`

                      return (
                        <li key={clip.id}>
                          <SortableClipItem
                            clip={clip}
                            chapterTitle={chapterTitle}
                            onPlay={() => {
                              onPlayClip(clip.chapterIndex, clip.startTime, clip.endTime)
                            }}
                            onUpdateTitle={title => updateClipTitle(clip.id, title)}
                            onDelete={() => deleteClip(clip.id)}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </SortableContext>

                <DragOverlay>
                  {activeClip ? (
                    <ClipDragOverlay
                      clip={activeClip}
                      chapterTitle={
                        chapters[activeClip.chapterIndex]?.title ??
                        `Chapter ${activeClip.chapterIndex + 1}`
                      }
                    />
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
