/**
 * LessonsTab — Course lesson list sub-panel for PlayerSidePanel.
 *
 * Includes search/filter, highlighted titles, lesson duration formatting,
 * and companion material count badges (PDFs matched to videos by filename).
 * Sidebar shows only videos — PDFs are accessible via the Materials tab.
 *
 * Extracted from PlayerSidePanel.tsx to reduce god-component complexity.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import { Video, PlayCircle, FileText, Search, X, FolderOpen, ChevronDown } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import type { CourseAdapter, LessonItem, MaterialGroup } from '@/lib/courseAdapter'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatLessonDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Minimum number of lessons required to show the search input */
export const LESSON_SEARCH_THRESHOLD = 8

export function HighlightedLessonTitle({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const splitRegex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(splitRegex)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = part.length > 0 && part.toLowerCase() === query.toLowerCase()
        return isMatch ? (
          <mark key={i} className="bg-warning/30 text-inherit rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Folder grouping (operates on MaterialGroup[])
// ---------------------------------------------------------------------------

interface FolderGroup {
  folder: string
  groups: MaterialGroup[]
}

function getFolderName(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : ''
}

function groupByFolder(materialGroups: MaterialGroup[]): FolderGroup[] {
  const folders = new Map<string, MaterialGroup[]>()
  for (const group of materialGroups) {
    const path = (group.primary.sourceMetadata?.path as string) ?? ''
    const folder = getFolderName(path)
    if (!folders.has(folder)) folders.set(folder, [])
    folders.get(folder)!.push(group)
  }
  return Array.from(folders.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([folder, groups]) => ({ folder, groups }))
}

// ---------------------------------------------------------------------------
// LessonLink (primary lesson row)
// ---------------------------------------------------------------------------

function LessonLink({
  lesson,
  courseId,
  isActive,
  index,
  materialCount,
  activeRef,
  searchQuery,
  onFocusMaterials,
}: {
  lesson: LessonItem
  courseId: string
  isActive: boolean
  index: number
  materialCount: number
  activeRef?: React.Ref<HTMLAnchorElement>
  searchQuery: string
  onFocusMaterials?: () => void
}) {
  return (
    <Link
      ref={activeRef}
      to={`/courses/${courseId}/lessons/${lesson.id}`}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
        isActive ? 'bg-brand-soft text-brand-soft-foreground font-medium' : 'hover:bg-accent'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="flex-shrink-0 size-7 rounded-lg bg-brand-soft/50 flex items-center justify-center">
        {isActive ? (
          <PlayCircle className="size-3.5 text-brand" aria-hidden="true" />
        ) : (
          <span className="text-xs font-semibold text-brand-soft-foreground">{index + 1}</span>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">
          <HighlightedLessonTitle text={lesson.title} query={searchQuery} />
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {lesson.type === 'pdf' ? (
            <FileText className="size-3 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Video className="size-3 text-muted-foreground" aria-hidden="true" />
          )}
          {lesson.duration != null && lesson.duration > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatLessonDuration(lesson.duration)}
            </span>
          )}
          {materialCount > 0 && onFocusMaterials && (
            <button
              type="button"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 rounded-sm"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                onFocusMaterials()
              }}
              aria-label="View materials"
            >
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                <FileText className="size-2.5 mr-0.5" aria-hidden="true" />
                {materialCount}
              </Badge>
            </button>
          )}
          {materialCount > 0 && !onFocusMaterials && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">
              <FileText className="size-2.5 mr-0.5" aria-hidden="true" />
              {materialCount}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// MaterialGroupRow — primary lesson with material count badge
// ---------------------------------------------------------------------------

function MaterialGroupRow({
  group,
  courseId,
  lessonId,
  index,
  activeRef,
  searchQuery,
  onFocusMaterials,
}: {
  group: MaterialGroup
  courseId: string
  lessonId: string
  index: number
  activeRef?: React.Ref<HTMLAnchorElement>
  searchQuery: string
  onFocusMaterials?: () => void
}) {
  const isActive = group.primary.id === lessonId

  return (
    <LessonLink
      lesson={group.primary}
      courseId={courseId}
      isActive={isActive}
      index={index}
      materialCount={group.materials.length}
      activeRef={isActive ? activeRef : undefined}
      searchQuery={searchQuery}
      onFocusMaterials={onFocusMaterials}
    />
  )
}

// ---------------------------------------------------------------------------
// LessonsTab component
// ---------------------------------------------------------------------------

export interface LessonsTabProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
  onFocusMaterials?: () => void
}

export function LessonsTab({ courseId, lessonId, adapter, onFocusMaterials }: LessonsTabProps) {
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)

    adapter
      .getGroupedLessons()
      .then(groups => {
        if (!ignore) {
          setMaterialGroups(groups)
          setIsLoading(false)
        }
      })
      .catch(() => {
        // silent-catch-ok — error state handled by empty list
        if (!ignore) setIsLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [adapter])

  // Scroll active lesson into view on mount
  useEffect(() => {
    if (!isLoading && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [isLoading, lessonId])

  // Sidebar shows only videos (standalone PDFs are accessed via Materials tab)
  const videoGroups = useMemo(
    () => materialGroups.filter(g => g.primary.type === 'video'),
    [materialGroups]
  )

  const showSearch = videoGroups.length > LESSON_SEARCH_THRESHOLD

  // Filter groups by search query (match primary title or material titles)
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return videoGroups
    const q = searchQuery.toLowerCase()
    return videoGroups.filter(
      g =>
        g.primary.title.toLowerCase().includes(q) ||
        g.materials.some(m => m.title.toLowerCase().includes(q))
    )
  }, [videoGroups, searchQuery])

  const folderGroups = useMemo(() => groupByFolder(filteredGroups), [filteredGroups])
  const hasMultipleFolders =
    folderGroups.length > 1 || (folderGroups.length === 1 && folderGroups[0].folder !== '')

  // Determine which folder contains the active lesson
  const activeFolder = useMemo(() => {
    if (!hasMultipleFolders) return ''
    const activeGroup = videoGroups.find(g => g.primary.id === lessonId)
    if (!activeGroup) return ''
    const path = (activeGroup.primary.sourceMetadata?.path as string) ?? ''
    return getFolderName(path)
  }, [videoGroups, lessonId, hasMultipleFolders])

  // Controlled expanded-folders state: collapse all, auto-expand active folder
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() =>
    activeFolder ? new Set([activeFolder]) : new Set()
  )

  // When active lesson changes folder, auto-expand the new folder
  useEffect(() => {
    if (activeFolder && !expandedFolders.has(activeFolder)) {
      setExpandedFolders(new Set([activeFolder]))
    }
    // Only react to folder changes, not expandedFolders state updates
  }, [activeFolder])

  const toggleFolder = useCallback((folder: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }, [])

  // Lesson index within the active folder (for contextual "Lesson X of Y")
  const activeFolderGroup = useMemo(
    () => folderGroups.find(fg => fg.folder === activeFolder),
    [folderGroups, activeFolder]
  )
  const indexInFolder = activeFolderGroup
    ? activeFolderGroup.groups.findIndex(g => g.primary.id === lessonId)
    : -1

  // Pre-compute O(1) lookup for original group indices (must be before early returns)
  const groupIndexMap = useMemo(
    () => new Map(videoGroups.map((g, i) => [g.primary.id, i])),
    [videoGroups]
  )

  const currentIndex = videoGroups.findIndex(g => g.primary.id === lessonId)

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (videoGroups.length === 0) {
    return (
      <EmptyState icon={Video} title="No lessons" description="This course has no lessons yet" />
    )
  }

  return (
    <div className="p-2 space-y-0.5" data-testid="lessons-tab-list">
      {showSearch && (
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 rounded-xl"
              aria-label="Filter lessons by title"
              data-testid="lesson-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                data-testid="lesson-search-clear"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="px-2 pb-2 text-xs text-muted-foreground">
        {searchQuery && filteredGroups.length !== videoGroups.length
          ? `Showing ${filteredGroups.length} of ${videoGroups.length} lessons`
          : hasMultipleFolders && activeFolderGroup && indexInFolder >= 0
            ? `Lesson ${indexInFolder + 1} of ${activeFolderGroup.groups.length} in ${activeFolder || 'General'}`
            : currentIndex >= 0
              ? `Lesson ${currentIndex + 1} of ${videoGroups.length}`
              : `${videoGroups.length} lessons`}
      </div>
      {filteredGroups.length === 0 && searchQuery ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          data-testid="lesson-search-empty"
        >
          <Search className="size-10 mb-3 opacity-50" aria-hidden="true" />
          <p className="text-sm">No lessons match your search</p>
        </div>
      ) : hasMultipleFolders ? (
        folderGroups.map(fg => {
          const groupCount = fg.groups.length
          const isActiveFolder = fg.folder === activeFolder
          return (
            <Collapsible key={fg.folder || 'root'} open={searchQuery ? true : expandedFolders.has(fg.folder)} onOpenChange={() => toggleFolder(fg.folder)}>
              <CollapsibleTrigger className={cn(
                'flex w-full items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium group/folder',
                isActiveFolder
                  ? 'bg-brand-soft/30 text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}>
                <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left text-xs truncate">
                  {fg.folder || 'General'}
                </span>
                <span className="text-xs text-muted-foreground">{groupCount}</span>
                <ChevronDown
                  className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]/folder:rotate-180"
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-2 pl-2 border-l border-border/50 space-y-0.5">
                  {fg.groups.map((group, idx) => (
                    <MaterialGroupRow
                      key={group.primary.id}
                      group={group}
                      courseId={courseId}
                      lessonId={lessonId}
                      index={idx}
                      activeRef={group.primary.id === lessonId ? activeRef : undefined}
                      searchQuery={searchQuery}
                      onFocusMaterials={onFocusMaterials}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })
      ) : (
        filteredGroups.map(group => {
          const originalIndex = groupIndexMap.get(group.primary.id) ?? 0
          return (
            <MaterialGroupRow
              key={group.primary.id}
              group={group}
              courseId={courseId}
              lessonId={lessonId}
              index={originalIndex}
              activeRef={group.primary.id === lessonId ? activeRef : undefined}
              searchQuery={searchQuery}
              onFocusMaterials={onFocusMaterials}
            />
          )
        })
      )}
    </div>
  )
}
