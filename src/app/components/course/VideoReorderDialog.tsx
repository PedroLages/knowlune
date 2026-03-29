/**
 * VideoReorderDialog — Grouped drag-and-drop video reorder list.
 *
 * Supports folder grouping (local courses) and chapter grouping (YouTube courses).
 * Within-group and cross-group drag-and-drop with @dnd-kit.
 * Persists new order to IndexedDB immediately on drop.
 *
 * Story: E89-S10
 */
import { useCallback, useMemo, useState } from 'react'
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
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Video, ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/db'
import { persistWithRetry } from '@/lib/persistWithRetry'
import { cn } from '@/app/components/ui/utils'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Button } from '@/app/components/ui/button'
import type { ImportedVideo, YouTubeCourseChapter } from '@/data/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoGroup {
  key: string
  title: string
  videos: ImportedVideo[]
}

export interface VideoReorderDialogProps {
  videos: ImportedVideo[]
  chapters: YouTubeCourseChapter[]
  isYouTube: boolean
  onReorder: (reordered: ImportedVideo[]) => void
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function stripExtension(filename: string): string {
  return filename.replace(/\.\w+$/, '')
}

function getFolderName(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : ''
}

// ---------------------------------------------------------------------------
// Grouping functions
// ---------------------------------------------------------------------------

function groupByFolder(videos: ImportedVideo[]): VideoGroup[] {
  const groups = new Map<string, ImportedVideo[]>()
  for (const video of videos) {
    const folder = getFolderName(video.path)
    if (!groups.has(folder)) groups.set(folder, [])
    groups.get(folder)!.push(video)
  }
  return Array.from(groups.entries()).map(([title, vids]) => ({
    key: title || '__root__',
    title,
    videos: vids,
  }))
}

function groupByChapter(videos: ImportedVideo[], chapters: YouTubeCourseChapter[]): VideoGroup[] {
  if (chapters.length === 0) {
    return [{ key: '__root__', title: '', videos }]
  }

  // Build a map: videoId -> chapter title (using the first chapter that mentions the video)
  const videoChapterMap = new Map<string, string>()
  for (const ch of chapters) {
    if (!videoChapterMap.has(ch.videoId)) {
      videoChapterMap.set(ch.videoId, ch.title)
    }
  }

  const groupMap = new Map<string, ImportedVideo[]>()
  const groupOrder: string[] = []
  for (const video of videos) {
    const chTitle = videoChapterMap.get(video.youtubeVideoId ?? '') ?? ''
    if (!groupMap.has(chTitle)) {
      groupMap.set(chTitle, [])
      groupOrder.push(chTitle)
    }
    groupMap.get(chTitle)!.push(video)
  }

  return groupOrder.map(title => ({
    key: title || '__root__',
    title,
    videos: groupMap.get(title) ?? [],
  }))
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function persistVideoOrder(videos: ImportedVideo[]): Promise<void> {
  await persistWithRetry(async () => {
    await db.transaction('rw', db.importedVideos, async () => {
      for (const video of videos) {
        await db.importedVideos.update(video.id, { order: video.order })
      }
    })
  })
}

// ---------------------------------------------------------------------------
// Sortable Video Row
// ---------------------------------------------------------------------------

function SortableVideoRow({
  video,
  position,
  groupKey,
  allGroups,
  onMoveToGroup,
}: {
  video: ImportedVideo
  position: number
  groupKey: string
  allGroups: VideoGroup[]
  onMoveToGroup: (videoId: string, targetGroupKey: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
    data: { groupKey },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const otherGroups = allGroups.filter(g => g.key !== groupKey && allGroups.length > 1)

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
      style={style}
      {...attributes}
      role="listitem"
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5',
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

      {/* Move to another group — keyboard alternative (WCAG 2.5.7) */}
      {otherGroups.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 size-6 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-label={`Move ${stripExtension(video.filename)} to another group`}
              data-testid={`move-video-${video.id}`}
            >
              <FolderOpen className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {otherGroups.map(g => (
              <DropdownMenuItem key={g.key} onClick={() => onMoveToGroup(video.id, g.key)}>
                Move to {g.title || 'General'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drag Overlay
// ---------------------------------------------------------------------------

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

      <span className="flex-1 truncate text-sm font-medium">{stripExtension(video.filename)}</span>

      {video.duration > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(video.duration)}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Collapsible Group
// ---------------------------------------------------------------------------

function CollapsibleGroup({
  group,
  globalPosition,
  isExpanded,
  onToggle,
  allGroups,
  onMoveToGroup,
}: {
  group: VideoGroup
  globalPosition: number
  isExpanded: boolean
  onToggle: () => void
  allGroups: VideoGroup[]
  onMoveToGroup: (videoId: string, targetGroupKey: string) => void
}) {
  const totalDuration = group.videos.reduce((sum, v) => sum + v.duration, 0)

  return (
    <div
      className="rounded-xl border border-border/50 bg-card overflow-hidden"
      data-testid={`reorder-group-${group.key}`}
    >
      {/* Group header */}
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 bg-surface-sunken/50 hover:bg-accent transition-colors text-sm font-medium text-foreground"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={
          isExpanded ? `Collapse ${group.title || 'General'}` : `Expand ${group.title || 'General'}`
        }
        data-testid={`reorder-group-toggle-${group.key}`}
      >
        <FolderOpen className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left truncate">{group.title || 'General'}</span>
        <span
          className="text-xs text-muted-foreground tabular-nums shrink-0"
          data-testid={`reorder-group-count-${group.key}`}
        >
          {group.videos.length} {group.videos.length === 1 ? 'video' : 'videos'}
          {totalDuration > 0 && ` \u00B7 ${formatDuration(totalDuration)}`}
        </span>
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        )}
      </button>

      {/* Group videos */}
      {isExpanded && (
        <div className="px-2 py-1.5">
          <SortableContext
            items={group.videos.map(v => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              className="space-y-1.5"
              role="list"
              aria-label={`Videos in ${group.title || 'General'}`}
            >
              {group.videos.map((video, index) => (
                <SortableVideoRow
                  key={video.id}
                  video={video}
                  position={globalPosition + index + 1}
                  groupKey={group.key}
                  allGroups={allGroups}
                  onMoveToGroup={onMoveToGroup}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function VideoReorderDialog({
  videos,
  chapters,
  isYouTube,
  onReorder,
}: VideoReorderDialogProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set())
  const [initialized, setInitialized] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Build groups from videos
  const groups = useMemo(() => {
    if (isYouTube) {
      return groupByChapter(videos, chapters)
    }
    return groupByFolder(videos)
  }, [videos, chapters, isYouTube])

  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0].title !== '')

  // Initialize expanded state when groups become available
  if (!initialized && groups.length > 0) {
    const allKeys = new Set(groups.map(g => g.key))
    setExpandedGroups(allKeys)
    setInitialized(true)
  }

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Build a flat map of video ID -> video for quick lookup
  const videoMap = useMemo(() => {
    const map = new Map<string, ImportedVideo>()
    for (const v of videos) map.set(v.id, v)
    return map
  }, [videos])

  // Compute global position offset for each group
  const groupPositionOffset = useMemo(() => {
    const offsets = new Map<string, number>()
    let offset = 0
    for (const group of groups) {
      offsets.set(group.key, offset)
      offset += group.videos.length
    }
    return offsets
  }, [groups])

  // Flatten groups back to a single ordered list
  const flattenGroups = useCallback((gs: VideoGroup[]): ImportedVideo[] => {
    const result: ImportedVideo[] = []
    let order = 0
    for (const group of gs) {
      for (const video of group.videos) {
        result.push({ ...video, order })
        order++
      }
    }
    return result
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could auto-expand groups on hover in future
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over || active.id === over.id) return

      const activeVideoId = active.id as string
      const overVideoId = over.id as string

      // Find source and target groups
      const sourceGroup = groups.find(g => g.videos.some(v => v.id === activeVideoId))
      const targetGroup = groups.find(g => g.videos.some(v => v.id === overVideoId))

      if (!sourceGroup || !targetGroup) return

      let updatedGroups: VideoGroup[]

      if (sourceGroup.key === targetGroup.key) {
        // Within-group reorder
        const oldIdx = sourceGroup.videos.findIndex(v => v.id === activeVideoId)
        const newIdx = sourceGroup.videos.findIndex(v => v.id === overVideoId)
        if (oldIdx === -1 || newIdx === -1) return

        const reorderedVideos = arrayMove(sourceGroup.videos, oldIdx, newIdx)
        updatedGroups = groups.map(g =>
          g.key === sourceGroup.key ? { ...g, videos: reorderedVideos } : g
        )
      } else {
        // Cross-group move
        const video = sourceGroup.videos.find(v => v.id === activeVideoId)
        if (!video) return

        const targetIdx = targetGroup.videos.findIndex(v => v.id === overVideoId)
        const newSourceVideos = sourceGroup.videos.filter(v => v.id !== activeVideoId)
        const newTargetVideos = [...targetGroup.videos]
        newTargetVideos.splice(targetIdx, 0, video)

        updatedGroups = groups.map(g => {
          if (g.key === sourceGroup.key) return { ...g, videos: newSourceVideos }
          if (g.key === targetGroup.key) return { ...g, videos: newTargetVideos }
          return g
        })
      }

      const reorderedFlat = flattenGroups(updatedGroups)

      // Optimistic UI update
      onReorder(reorderedFlat)

      // Persist to IndexedDB
      setIsSaving(true)
      try {
        await persistVideoOrder(reorderedFlat)
      } catch (error) {
        // silent-catch-ok — toast.error provides visible user feedback
        console.error('[VideoReorderDialog] Failed to persist order:', error)
        toast.error('Failed to save video order. Please try again.')
        // Rollback
        onReorder(videos)
      } finally {
        setIsSaving(false)
      }
    },
    [groups, flattenGroups, onReorder, videos]
  )

  // Move video to a different group (keyboard accessible alternative)
  const handleMoveToGroup = useCallback(
    async (videoId: string, targetGroupKey: string) => {
      const sourceGroup = groups.find(g => g.videos.some(v => v.id === videoId))
      const targetGroup = groups.find(g => g.key === targetGroupKey)
      if (!sourceGroup || !targetGroup) return

      const video = sourceGroup.videos.find(v => v.id === videoId)
      if (!video) return

      const newSourceVideos = sourceGroup.videos.filter(v => v.id !== videoId)
      const newTargetVideos = [...targetGroup.videos, video]

      const updatedGroups = groups.map(g => {
        if (g.key === sourceGroup.key) return { ...g, videos: newSourceVideos }
        if (g.key === targetGroupKey) return { ...g, videos: newTargetVideos }
        return g
      })

      const reorderedFlat = flattenGroups(updatedGroups)
      onReorder(reorderedFlat)

      setIsSaving(true)
      try {
        await persistVideoOrder(reorderedFlat)
      } catch (error) {
        // silent-catch-ok — toast.error provides visible user feedback
        console.error('[VideoReorderDialog] Failed to persist order:', error)
        toast.error('Failed to save video order. Please try again.')
        onReorder(videos)
      } finally {
        setIsSaving(false)
      }
    },
    [groups, flattenGroups, onReorder, videos]
  )

  const activeVideo = activeId ? videoMap.get(activeId) : null
  const activePosition = activeVideo ? videos.findIndex(v => v.id === activeVideo.id) + 1 : 0

  if (videos.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">No videos in this course.</p>
    )
  }

  // If only one group with no title (root-level videos), render flat list
  if (!hasMultipleGroups) {
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
                  groupKey="__root__"
                  allGroups={groups}
                  onMoveToGroup={handleMoveToGroup}
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

  // Grouped view
  return (
    <div data-testid="video-reorder-grouped" aria-label="Reorder videos by group">
      {isSaving && (
        <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
          Saving order...
        </p>
      )}
      <ScrollArea className="max-h-[50vh]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-2 pr-2">
            {groups.map(group => (
              <CollapsibleGroup
                key={group.key}
                group={group}
                globalPosition={groupPositionOffset.get(group.key) ?? 0}
                isExpanded={expandedGroups.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
                allGroups={groups}
                onMoveToGroup={handleMoveToGroup}
              />
            ))}
          </div>

          <DragOverlay>
            {activeVideo ? (
              <DragOverlayContent video={activeVideo} position={activePosition} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </ScrollArea>
    </div>
  )
}
