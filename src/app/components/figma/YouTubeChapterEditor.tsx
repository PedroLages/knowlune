/**
 * YouTube Chapter Editor
 *
 * Step 3 of the YouTube import wizard — lets users review, rename,
 * reorder, merge/split chapters created by the rule-based grouping algorithm.
 *
 * Features:
 * - Drag-and-drop for reordering videos within/between chapters
 * - Drag-and-drop for reordering chapters
 * - Inline chapter title editing
 * - Add/remove chapters with confirmation
 * - Keyboard alternatives for all drag interactions (WCAG 2.5.7)
 *
 * Shared component — used in wizard Step 3 AND as a post-import edit dialog.
 *
 * Story: E28-S06
 * @see youtubeRuleBasedGrouping.ts — grouping algorithm
 */

import { useCallback, useMemo, useRef, useState } from 'react'
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
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  FolderOpen,
  Info,
  Settings,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { ScrollArea } from '@/app/components/ui/scroll-area'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { cn } from '@/app/components/ui/utils'
import type { VideoChapter } from '@/lib/youtubeRuleBasedGrouping'
import { generateChapterId } from '@/lib/youtubeRuleBasedGrouping'
import type { YouTubeImportVideo } from '@/stores/useYouTubeImportStore'

// --- Types ---

interface YouTubeChapterEditorProps {
  chapters: VideoChapter[]
  videos: YouTubeImportVideo[]
  onChaptersChange: (chapters: VideoChapter[]) => void
  /** Whether to show the info banner about AI provider */
  showAiBanner?: boolean
  /** AI result banner: "AI organized N videos into M chapters" (E28-S07) */
  aiBannerMessage?: string
}

interface RemoveDialogState {
  chapterId: string
  chapterTitle: string
  videoCount: number
}

// --- Helpers ---

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatTotalDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// --- Component ---

export function YouTubeChapterEditor({
  chapters,
  videos,
  onChaptersChange,
  showAiBanner = false,
  aiBannerMessage,
}: YouTubeChapterEditorProps) {
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(() => {
    // First chapter expanded by default
    return new Set(chapters.length > 0 ? [chapters[0].id] : [])
  })
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [removeDialog, setRemoveDialog] = useState<RemoveDialogState | null>(null)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)

  // Build video lookup map
  const videoMap = useMemo(() => {
    const map = new Map<string, YouTubeImportVideo>()
    for (const v of videos) {
      map.set(v.videoId, v)
    }
    return map
  }, [videos])

  // --- DnD Setup ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    if (id.startsWith('video:')) {
      setActiveVideoId(id.replace('video:', ''))
    } else if (id.startsWith('chapter:')) {
      setActiveChapterId(id.replace('chapter:', ''))
    }
  }, [])

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // Could implement hover-to-expand chapters here
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveVideoId(null)
      setActiveChapterId(null)

      if (!over || active.id === over.id) return

      const activeId = active.id as string
      const overId = over.id as string

      // Handle chapter reordering
      if (activeId.startsWith('chapter:') && overId.startsWith('chapter:')) {
        const activeChId = activeId.replace('chapter:', '')
        const overChId = overId.replace('chapter:', '')
        const oldIdx = chapters.findIndex(c => c.id === activeChId)
        const newIdx = chapters.findIndex(c => c.id === overChId)
        if (oldIdx !== -1 && newIdx !== -1) {
          onChaptersChange(arrayMove(chapters, oldIdx, newIdx))
        }
        return
      }

      // Handle video reordering within/between chapters
      if (activeId.startsWith('video:')) {
        const videoId = activeId.replace('video:', '')

        // Find source chapter
        const sourceChapter = chapters.find(c => c.videoIds.includes(videoId))
        if (!sourceChapter) return

        // Determine target chapter and position
        let targetChapter: VideoChapter | undefined
        let targetPosition: number

        if (overId.startsWith('video:')) {
          const overVideoId = overId.replace('video:', '')
          targetChapter = chapters.find(c => c.videoIds.includes(overVideoId))
          if (!targetChapter) return
          targetPosition = targetChapter.videoIds.indexOf(overVideoId)
        } else if (overId.startsWith('chapter:')) {
          const overChId = overId.replace('chapter:', '')
          targetChapter = chapters.find(c => c.id === overChId)
          if (!targetChapter) return
          targetPosition = targetChapter.videoIds.length
        } else {
          return
        }

        // Same chapter: reorder
        if (sourceChapter.id === targetChapter.id) {
          const oldIdx = sourceChapter.videoIds.indexOf(videoId)
          const newVideoIds = arrayMove(sourceChapter.videoIds, oldIdx, targetPosition)
          onChaptersChange(
            chapters.map(c =>
              c.id === sourceChapter.id ? { ...c, videoIds: newVideoIds, source: 'manual' as const } : c
            )
          )
        } else {
          // Different chapter: move between
          const newSourceVideoIds = sourceChapter.videoIds.filter(id => id !== videoId)
          const newTargetVideoIds = [...targetChapter.videoIds]
          newTargetVideoIds.splice(targetPosition, 0, videoId)

          onChaptersChange(
            chapters.map(c => {
              if (c.id === sourceChapter.id)
                return { ...c, videoIds: newSourceVideoIds, source: 'manual' as const }
              if (c.id === targetChapter!.id)
                return { ...c, videoIds: newTargetVideoIds, source: 'manual' as const }
              return c
            })
          )
        }
      }
    },
    [chapters, onChaptersChange]
  )

  // --- Chapter actions ---

  const toggleChapter = useCallback((chapterId: string) => {
    setExpandedChapters(prev => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }, [])

  const startEditingTitle = useCallback((chapterId: string, currentTitle: string) => {
    setEditingChapterId(chapterId)
    setEditingTitle(currentTitle)
  }, [])

  const saveTitle = useCallback(() => {
    if (editingChapterId && editingTitle.trim()) {
      onChaptersChange(
        chapters.map(c =>
          c.id === editingChapterId
            ? { ...c, title: editingTitle.trim(), source: 'manual' as const }
            : c
        )
      )
    }
    setEditingChapterId(null)
    setEditingTitle('')
  }, [editingChapterId, editingTitle, chapters, onChaptersChange])

  const cancelEditing = useCallback(() => {
    setEditingChapterId(null)
    setEditingTitle('')
  }, [])

  const addChapter = useCallback(() => {
    const newChapter: VideoChapter = {
      id: generateChapterId(),
      title: 'New Chapter',
      videoIds: [],
      source: 'manual',
    }
    onChaptersChange([...chapters, newChapter])
    // Expand and start editing the new chapter
    setExpandedChapters(prev => new Set([...prev, newChapter.id]))
    setEditingChapterId(newChapter.id)
    setEditingTitle('New Chapter')
  }, [chapters, onChaptersChange])

  const confirmRemoveChapter = useCallback(
    (chapterId: string) => {
      const chapter = chapters.find(c => c.id === chapterId)
      if (!chapter) return

      if (chapter.videoIds.length === 0) {
        // Empty chapter — remove directly
        onChaptersChange(chapters.filter(c => c.id !== chapterId))
      } else {
        // Has videos — show confirmation dialog
        setRemoveDialog({
          chapterId,
          chapterTitle: chapter.title,
          videoCount: chapter.videoIds.length,
        })
      }
    },
    [chapters, onChaptersChange]
  )

  const handleRemoveKeepVideos = useCallback(() => {
    if (!removeDialog) return

    const chapter = chapters.find(c => c.id === removeDialog.chapterId)
    if (!chapter) return

    // Find or create "Uncategorized" chapter
    let uncategorized = chapters.find(c => c.title === 'Uncategorized')
    let updatedChapters: VideoChapter[]

    if (uncategorized) {
      updatedChapters = chapters
        .filter(c => c.id !== removeDialog.chapterId)
        .map(c =>
          c.id === uncategorized!.id
            ? { ...c, videoIds: [...c.videoIds, ...chapter.videoIds] }
            : c
        )
    } else {
      uncategorized = {
        id: generateChapterId(),
        title: 'Uncategorized',
        videoIds: chapter.videoIds,
        source: 'manual',
      }
      updatedChapters = [
        ...chapters.filter(c => c.id !== removeDialog.chapterId),
        uncategorized,
      ]
    }

    onChaptersChange(updatedChapters)
    setRemoveDialog(null)
  }, [removeDialog, chapters, onChaptersChange])

  const handleRemoveWithVideos = useCallback(() => {
    if (!removeDialog) return
    onChaptersChange(chapters.filter(c => c.id !== removeDialog.chapterId))
    setRemoveDialog(null)
  }, [removeDialog, chapters, onChaptersChange])

  // --- Keyboard reorder for chapters ---

  const moveChapter = useCallback(
    (chapterId: string, direction: 'up' | 'down') => {
      const idx = chapters.findIndex(c => c.id === chapterId)
      if (idx === -1) return
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= chapters.length) return
      onChaptersChange(arrayMove(chapters, idx, newIdx))
    },
    [chapters, onChaptersChange]
  )

  // --- Keyboard move video between chapters ---

  const moveVideoToChapter = useCallback(
    (videoId: string, targetChapterId: string) => {
      const sourceChapter = chapters.find(c => c.videoIds.includes(videoId))
      if (!sourceChapter || sourceChapter.id === targetChapterId) return

      onChaptersChange(
        chapters.map(c => {
          if (c.id === sourceChapter.id) {
            return { ...c, videoIds: c.videoIds.filter(id => id !== videoId), source: 'manual' as const }
          }
          if (c.id === targetChapterId) {
            return { ...c, videoIds: [...c.videoIds, videoId], source: 'manual' as const }
          }
          return c
        })
      )
    },
    [chapters, onChaptersChange]
  )

  // Active video/chapter for drag overlay
  const activeVideo = activeVideoId ? videoMap.get(activeVideoId) : null
  const activeChapter = activeChapterId
    ? chapters.find(c => c.id === activeChapterId)
    : null

  return (
    <div className="space-y-3" data-testid="chapter-editor">
      {/* AI success banner (E28-S07) */}
      {aiBannerMessage && (
        <div
          className="flex items-start gap-3 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3"
          role="status"
          data-testid="ai-structure-banner"
        >
          <Sparkles className="size-4 shrink-0 mt-0.5 text-brand-soft-foreground" aria-hidden="true" />
          <p className="text-sm text-brand-soft-foreground font-medium">
            {aiBannerMessage}
          </p>
        </div>
      )}

      {/* Info banner for rule-based grouping */}
      {showAiBanner && !aiBannerMessage && (
        <div
          className="flex items-start gap-3 rounded-xl border border-info/20 bg-info/5 px-4 py-3"
          role="status"
          data-testid="rule-based-banner"
        >
          <Info className="size-4 shrink-0 mt-0.5 text-info" aria-hidden="true" />
          <p className="text-sm text-foreground">
            Videos grouped by keyword similarity from titles.{' '}
            <a
              href="/settings"
              className="font-medium text-brand-soft-foreground underline underline-offset-2 hover:text-brand"
            >
              <Settings className="inline-block size-3.5 mr-0.5 align-text-bottom" aria-hidden="true" />
              Set up an AI provider
            </a>{' '}
            in Settings for smarter organization.
          </p>
        </div>
      )}

      {/* Chapter list */}
      <ScrollArea className="max-h-[50vh]" data-testid="chapter-list">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={chapters.map(c => `chapter:${c.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pr-2">
              {chapters.map((chapter, chapterIdx) => (
                <SortableChapter
                  key={chapter.id}
                  chapter={chapter}
                  chapterIndex={chapterIdx}
                  totalChapters={chapters.length}
                  isExpanded={expandedChapters.has(chapter.id)}
                  isEditing={editingChapterId === chapter.id}
                  editingTitle={editingTitle}
                  videoMap={videoMap}
                  allChapters={chapters}
                  onToggle={() => toggleChapter(chapter.id)}
                  onStartEdit={() => startEditingTitle(chapter.id, chapter.title)}
                  onEditTitleChange={setEditingTitle}
                  onSaveTitle={saveTitle}
                  onCancelEdit={cancelEditing}
                  onRemove={() => confirmRemoveChapter(chapter.id)}
                  onMoveChapter={(dir) => moveChapter(chapter.id, dir)}
                  onMoveVideo={moveVideoToChapter}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeVideo && (
              <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-card px-3 py-2 shadow-xl">
                <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium truncate">
                  {activeVideo.metadata?.title || activeVideo.videoId}
                </span>
              </div>
            )}
            {activeChapter && (
              <div className="rounded-xl border border-brand/30 bg-card px-4 py-3 shadow-xl">
                <span className="text-sm font-semibold">{activeChapter.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {activeChapter.videoIds.length} videos
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </ScrollArea>

      {/* Add Chapter button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full rounded-xl min-h-[44px]"
        onClick={addChapter}
        data-testid="add-chapter-btn"
      >
        <Plus className="size-4 mr-1.5" aria-hidden="true" />
        Add Chapter
      </Button>

      {/* Remove Chapter Confirmation Dialog */}
      <AlertDialog
        open={removeDialog !== null}
        onOpenChange={(open) => !open && setRemoveDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove chapter "{removeDialog?.chapterTitle}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This chapter contains {removeDialog?.videoCount}{' '}
              {removeDialog?.videoCount === 1 ? 'video' : 'videos'}. Choose what to do with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-xl min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl min-h-[44px] bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={handleRemoveKeepVideos}
              data-testid="remove-keep-videos"
            >
              <FolderOpen className="size-4 mr-1.5" aria-hidden="true" />
              Move to Uncategorized
            </AlertDialogAction>
            <AlertDialogAction
              className="rounded-xl min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveWithVideos}
              data-testid="remove-with-videos"
            >
              <Trash2 className="size-4 mr-1.5" aria-hidden="true" />
              Remove with videos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// --- Sortable Chapter ---

interface SortableChapterProps {
  chapter: VideoChapter
  chapterIndex: number
  totalChapters: number
  isExpanded: boolean
  isEditing: boolean
  editingTitle: string
  videoMap: Map<string, YouTubeImportVideo>
  allChapters: VideoChapter[]
  onToggle: () => void
  onStartEdit: () => void
  onEditTitleChange: (title: string) => void
  onSaveTitle: () => void
  onCancelEdit: () => void
  onRemove: () => void
  onMoveChapter: (direction: 'up' | 'down') => void
  onMoveVideo: (videoId: string, targetChapterId: string) => void
}

function SortableChapter({
  chapter,
  chapterIndex,
  totalChapters,
  isExpanded,
  isEditing,
  editingTitle,
  videoMap,
  allChapters,
  onToggle,
  onStartEdit,
  onEditTitleChange,
  onSaveTitle,
  onCancelEdit,
  onRemove,
  onMoveChapter,
  onMoveVideo,
}: SortableChapterProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `chapter:${chapter.id}` })

  const titleInputRef = useRef<HTMLInputElement>(null)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return chapter.videoIds.reduce((sum, videoId) => {
      const video = videoMap.get(videoId)
      return sum + (video?.metadata?.duration || 0)
    }, 0)
  }, [chapter.videoIds, videoMap])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onSaveTitle()
      } else if (e.key === 'Escape') {
        onCancelEdit()
      }
    },
    [onSaveTitle, onCancelEdit]
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl border border-border/50 bg-card overflow-hidden transition-shadow',
        isDragging && 'opacity-50 shadow-lg z-10'
      )}
      data-testid={`chapter-${chapter.id}`}
    >
      {/* Chapter header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-surface-sunken/50">
        {/* Drag handle */}
        <button
          className="cursor-grab touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder ${chapter.title}`}
          data-testid={`chapter-drag-handle-${chapter.id}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>

        {/* Expand/collapse toggle */}
        <button
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Collapse ${chapter.title}` : `Expand ${chapter.title}`}
          data-testid={`chapter-toggle-${chapter.id}`}
        >
          {isExpanded ? (
            <ChevronDown className="size-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-4" aria-hidden="true" />
          )}
        </button>

        {/* Title — inline editable */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                ref={titleInputRef}
                value={editingTitle}
                onChange={e => onEditTitleChange(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={onSaveTitle}
                className="h-7 text-sm font-semibold"
                autoFocus
                data-testid={`chapter-title-input-${chapter.id}`}
              />
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                onClick={onSaveTitle}
                aria-label="Save title"
              >
                <Check className="size-3.5 text-success" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0"
                onClick={onCancelEdit}
                aria-label="Cancel editing"
              >
                <X className="size-3.5 text-destructive" />
              </Button>
            </div>
          ) : (
            <button
              className="flex-1 text-left text-sm font-semibold text-foreground truncate hover:underline"
              onClick={onStartEdit}
              title="Click to rename"
              data-testid={`chapter-title-${chapter.id}`}
            >
              {chapter.title}
            </button>
          )}

          {/* Source badge */}
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0 text-xs gap-1',
              chapter.source === 'ai' && 'bg-brand-soft text-brand-soft-foreground'
            )}
          >
            {chapter.source === 'ai' && <Sparkles className="size-3" aria-hidden="true" />}
            {chapter.source === 'ai' ? 'AI Suggested' : chapter.source === 'rule-based' ? 'Rule-based' : 'Manual'}
          </Badge>
        </div>

        {/* Meta: video count + duration */}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {chapter.videoIds.length} {chapter.videoIds.length === 1 ? 'video' : 'videos'}
          {totalDuration > 0 && ` · ${formatTotalDuration(totalDuration)}`}
        </span>

        {/* Chapter actions — keyboard reorder + edit + remove */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => onMoveChapter('up')}
            disabled={chapterIndex === 0}
            aria-label={`Move ${chapter.title} up`}
            title="Move chapter up"
          >
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={() => onMoveChapter('down')}
            disabled={chapterIndex === totalChapters - 1}
            aria-label={`Move ${chapter.title} down`}
            title="Move chapter down"
          >
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0"
            onClick={onStartEdit}
            aria-label={`Rename ${chapter.title}`}
            title="Rename chapter"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0 text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove ${chapter.title}`}
            title="Remove chapter"
            data-testid={`chapter-remove-${chapter.id}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded: AI rationale + video list */}
      {isExpanded && (
        <div className="px-2 py-1.5" data-testid={`chapter-videos-${chapter.id}`}>
          {/* AI rationale (E28-S07) */}
          {chapter.rationale && chapter.source === 'ai' && (
            <div
              className="mb-2 flex items-start gap-2 rounded-lg bg-brand-soft/30 px-3 py-2"
              data-testid={`chapter-rationale-${chapter.id}`}
            >
              <Sparkles className="size-3.5 shrink-0 mt-0.5 text-brand-soft-foreground" aria-hidden="true" />
              <p className="text-xs text-muted-foreground italic">{chapter.rationale}</p>
            </div>
          )}
          {chapter.videoIds.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No videos in this chapter. Drag videos here to add them.
            </p>
          ) : (
            <SortableContext
              items={chapter.videoIds.map(id => `video:${id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1" role="list" aria-label={`Videos in ${chapter.title}`}>
                {chapter.videoIds.map(videoId => {
                  const video = videoMap.get(videoId)
                  if (!video) return null
                  return (
                    <SortableVideoRow
                      key={videoId}
                      video={video}
                      chapterId={chapter.id}
                      allChapters={allChapters}
                      onMoveToChapter={onMoveVideo}
                    />
                  )
                })}
              </div>
            </SortableContext>
          )}
        </div>
      )}
    </div>
  )
}

// --- Sortable Video Row ---

interface SortableVideoRowProps {
  video: YouTubeImportVideo
  chapterId: string
  allChapters: VideoChapter[]
  onMoveToChapter: (videoId: string, targetChapterId: string) => void
}

function SortableVideoRow({
  video,
  chapterId,
  allChapters,
  onMoveToChapter,
}: SortableVideoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `video:${video.videoId}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Other chapters this video could be moved to (for keyboard a11y)
  const otherChapters = allChapters.filter(c => c.id !== chapterId)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent',
        isDragging && 'opacity-50 shadow-md z-10'
      )}
      role="listitem"
      data-testid={`chapter-video-${video.videoId}`}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab touch-manipulation rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${video.metadata?.title || video.videoId}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" aria-hidden="true" />
      </button>

      {/* Video title */}
      <span className="flex-1 min-w-0 text-sm truncate" title={video.metadata?.title || video.videoId}>
        {video.metadata?.title || video.videoId}
      </span>

      {/* Duration */}
      {video.metadata && video.metadata.duration > 0 && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatDuration(video.metadata.duration)}
        </span>
      )}

      {/* Move to chapter — keyboard alternative (WCAG 2.5.7) */}
      {otherChapters.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 size-6 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              aria-label={`Move ${video.metadata?.title || video.videoId} to another chapter`}
              data-testid={`move-video-${video.videoId}`}
            >
              <FolderOpen className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {otherChapters.map(c => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => onMoveToChapter(video.videoId, c.id)}
              >
                Move to {c.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
