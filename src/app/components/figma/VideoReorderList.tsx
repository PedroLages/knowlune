/**
 * Drag-and-drop video reorder list.
 *
 * Uses @dnd-kit/sortable to allow users to reorder videos within a course.
 * Persists new order to IndexedDB immediately on drop.
 *
 * Story: E24-S06
 */
import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Video } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { MoveUpDownButtons } from '@/app/components/figma/MoveUpDownButtons'
import { cn } from '@/app/components/ui/utils'
import type { ImportedVideo } from '@/data/types'

interface VideoReorderListProps {
  videos: ImportedVideo[]
  onReorder: (reordered: ImportedVideo[]) => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = String(Math.floor(seconds % 60)).padStart(2, '0')
  return `${m}:${s}`
}

function stripExtension(filename: string): string {
  return filename.replace(/\.\w+$/, '')
}

/** Single sortable video row */
function SortableVideoRow({
  video,
  position,
  index,
  total,
  onMoveUp,
  onMoveDown,
  registerMoveUpRef,
  registerMoveDownRef,
}: {
  video: ImportedVideo
  position: number
  index: number
  total: number
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  registerMoveUpRef: (id: string, el: HTMLButtonElement | null) => void
  registerMoveDownRef: (id: string, el: HTMLButtonElement | null) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
  })

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
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5',
        isDragging && 'opacity-50 shadow-lg z-10'
      )}
      data-testid={`video-reorder-item-${video.id}`}
    >
      <button
        className="cursor-grab touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${video.filename}`}
        data-testid={`drag-handle-${video.id}`}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums"
        aria-label={`Position ${position}`}
      >
        {position}
      </span>

      <Video className="size-4 shrink-0 text-brand" aria-hidden="true" />

      <span className="flex-1 truncate text-sm font-medium" title={video.filename}>
        {stripExtension(video.filename)}
      </span>

      {video.duration > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(video.duration)}
        </span>
      )}

      <MoveUpDownButtons
        index={index}
        total={total}
        itemLabel={stripExtension(video.filename)}
        onMoveUp={() => onMoveUp(index)}
        onMoveDown={() => onMoveDown(index)}
        size="sm"
        upRef={el => registerMoveUpRef(video.id, el)}
        downRef={el => registerMoveDownRef(video.id, el)}
        testIdPrefix={`video-reorder-${video.id}-move`}
      />
    </div>
  )
}

/** Overlay shown while dragging */
function DragOverlayContent({ video, position }: { video: ImportedVideo; position: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-card px-3 py-2.5 shadow-xl">
      <div className="rounded p-1 text-muted-foreground">
        <GripVertical className="size-4" aria-hidden="true" />
      </div>

      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums">
        {position}
      </span>

      <Video className="size-4 shrink-0 text-brand" aria-hidden="true" />

      <span className="flex-1 truncate text-sm font-medium">{video.filename}</span>

      {video.duration > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(video.duration)}
        </span>
      )}
    </div>
  )
}

export function VideoReorderList({ videos, onReorder }: VideoReorderListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // E66-S01: focus refs for Move Up/Down buttons (WCAG 2.5.7)
  const moveUpRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())
  const moveDownRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())
  const registerMoveUpRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) moveUpRefs.current.set(id, el)
    else moveUpRefs.current.delete(id)
  }, [])
  const registerMoveDownRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) moveDownRefs.current.set(id, el)
    else moveDownRefs.current.delete(id)
  }, [])

  const reorderAndPersist = useCallback(
    async (oldIndex: number, newIndex: number) => {
      if (oldIndex === newIndex) return
      if (oldIndex < 0 || newIndex < 0) return
      if (oldIndex >= videos.length || newIndex >= videos.length) return

      const reordered = arrayMove(videos, oldIndex, newIndex).map((v, i) => ({
        ...v,
        order: i,
      }))

      // Optimistic UI update
      onReorder(reordered)

      // Persist to IndexedDB
      setIsSaving(true)
      try {
        await persistWithRetry(async () => {
          await db.transaction('rw', db.importedVideos, async () => {
            for (const video of reordered) {
              await db.importedVideos.update(video.id, { order: video.order })
            }
          })
        })
      } catch (error) {
        // silent-catch-ok — toast.error provides visible user feedback
        console.error('[VideoReorder] Failed to persist order:', error)
        toast.error('Failed to save video order. Please try again.')
        // Rollback to original order
        onReorder(videos)
      } finally {
        setIsSaving(false)
      }
    },
    [videos, onReorder]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const oldIndex = videos.findIndex(v => v.id === active.id)
      const newIndex = videos.findIndex(v => v.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      await reorderAndPersist(oldIndex, newIndex)
    },
    [videos, reorderAndPersist]
  )

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0) return
      const id = videos[index]?.id
      void reorderAndPersist(index, index - 1)
      if (id) requestAnimationFrame(() => moveUpRefs.current.get(id)?.focus())
    },
    [videos, reorderAndPersist]
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= videos.length - 1) return
      const id = videos[index]?.id
      void reorderAndPersist(index, index + 1)
      if (id) requestAnimationFrame(() => moveDownRefs.current.get(id)?.focus())
    },
    [videos, reorderAndPersist]
  )

  const activeVideo = activeId ? videos.find(v => v.id === activeId) : null
  const activePosition = activeVideo ? videos.indexOf(activeVideo) + 1 : 0

  if (videos.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">No videos in this course.</p>
    )
  }

  return (
    <div data-testid="video-reorder-list" aria-label="Reorder videos" role="list">
      {isSaving && (
        <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
          Saving order...
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={videos.map(v => v.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {videos.map((video, index) => (
              <SortableVideoRow
                key={video.id}
                video={video}
                position={index + 1}
                index={index}
                total={videos.length}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                registerMoveUpRef={registerMoveUpRef}
                registerMoveDownRef={registerMoveDownRef}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeVideo ? (
            <DragOverlayContent video={activeVideo} position={activePosition} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
