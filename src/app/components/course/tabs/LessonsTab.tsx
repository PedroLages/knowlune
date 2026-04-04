/**
 * LessonsTab — Course lesson list sub-panel for PlayerSidePanel.
 *
 * Includes search/filter, highlighted titles, lesson duration formatting,
 * and companion material count badges (PDFs matched to videos by filename).
 * Sidebar shows all content types (videos + standalone PDFs) in natural folder order.
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
// Folder tree (nested subfolder grouping from full paths)
// ---------------------------------------------------------------------------

interface FolderNode {
  name: string            // display name (e.g., "02-02 How To Use The BTE")
  path: string            // full path key for expanded state (e.g., "07-BTE/02-02 How To Use The BTE")
  items: MaterialGroup[]  // items directly in this folder (not in subfolders)
  children: FolderNode[]  // sorted subfolders
}

/** Extract the directory portion of a path (everything before the filename). */
function getDirPath(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/')
  return lastSlash > 0 ? filePath.substring(0, lastSlash) : ''
}

/** Build a nested folder tree from material groups using their full directory paths. */
function buildFolderTree(groups: MaterialGroup[]): FolderNode[] {
  // Intermediate map: full dir path → items in that exact folder
  const dirMap = new Map<string, MaterialGroup[]>()
  for (const group of groups) {
    const filePath = (group.primary.sourceMetadata?.path as string) ?? ''
    const dir = getDirPath(filePath)
    if (!dirMap.has(dir)) dirMap.set(dir, [])
    dirMap.get(dir)!.push(group)
  }

  // Build tree by inserting each dir path into a nested structure
  const rootChildren: FolderNode[] = []
  const nodeMap = new Map<string, FolderNode>()

  // Collect all unique directory paths and sort them so parents come before children
  const allDirs = Array.from(dirMap.keys())
    .filter(d => d !== '')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  for (const dir of allDirs) {
    const segments = dir.split('/')
    let parentChildren = rootChildren
    let currentPath = ''

    for (let i = 0; i < segments.length; i++) {
      currentPath = i === 0 ? segments[i] : `${currentPath}/${segments[i]}`
      let node = nodeMap.get(currentPath)
      if (!node) {
        node = { name: segments[i], path: currentPath, items: [], children: [] }
        nodeMap.set(currentPath, node)
        parentChildren.push(node)
        // Sort after insertion to maintain natural order
        parentChildren.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      }
      parentChildren = node.children
    }
  }

  // Assign items to their folder nodes
  for (const [dir, items] of dirMap) {
    if (dir === '') continue // root items handled separately
    const node = nodeMap.get(dir)
    if (node) node.items = items
  }

  return rootChildren
}

/** Count all items in a folder node and its descendants. */
function countNodeItems(node: FolderNode): number {
  return node.items.length + node.children.reduce((sum, c) => sum + countNodeItems(c), 0)
}

/** Check if a folder node or any descendant contains the given lesson ID. */
function nodeContainsLesson(node: FolderNode, lessonId: string): boolean {
  if (node.items.some(g => g.primary.id === lessonId)) return true
  return node.children.some(c => nodeContainsLesson(c, lessonId))
}

/** Get all folder paths that lead to the given lesson ID (for auto-expanding). */
function getAncestorPaths(nodes: FolderNode[], lessonId: string): string[] {
  const paths: string[] = []
  function walk(node: FolderNode): boolean {
    if (nodeContainsLesson(node, lessonId)) {
      paths.push(node.path)
      node.children.forEach(walk)
      return true
    }
    return false
  }
  nodes.forEach(walk)
  return paths
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
        <div className={cn('flex items-center gap-1.5 mt-0.5', isActive ? 'text-brand-soft-foreground/70' : 'text-muted-foreground')}>
          {lesson.type === 'pdf' ? (
            <FileText className="size-3" aria-hidden="true" />
          ) : (
            <Video className="size-3" aria-hidden="true" />
          )}
          {lesson.duration != null && lesson.duration > 0 && (
            <span className="text-xs">
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
// FolderTreeNode — recursive folder rendering with nested collapsibles
// ---------------------------------------------------------------------------

function FolderTreeNode({
  node,
  courseId,
  lessonId,
  expandedFolders,
  toggleFolder,
  activeRef,
  searchQuery,
  onFocusMaterials,
  forceOpen,
}: {
  node: FolderNode
  courseId: string
  lessonId: string
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
  activeRef: React.RefObject<HTMLAnchorElement | null>
  searchQuery: string
  onFocusMaterials?: () => void
  forceOpen?: boolean
}) {
  const totalCount = countNodeItems(node)
  const isActive = nodeContainsLesson(node, lessonId)
  const isOpen = forceOpen || expandedFolders.has(node.path)

  return (
    <Collapsible open={isOpen} onOpenChange={() => toggleFolder(node.path)}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium group/folder',
          isActive
            ? 'bg-brand-soft/30 text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left text-xs truncate">{node.name}</span>
        <span className="text-xs text-muted-foreground">{totalCount}</span>
        <ChevronDown
          className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]/folder:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-2 pl-2 border-l border-border/50 space-y-0.5">
          {/* Direct items in this folder */}
          {node.items.map((group, idx) => (
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
          {/* Nested subfolders */}
          {node.children.map(child => (
            <FolderTreeNode
              key={child.path}
              node={child}
              courseId={courseId}
              lessonId={lessonId}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              activeRef={activeRef}
              searchQuery={searchQuery}
              onFocusMaterials={onFocusMaterials}
              forceOpen={forceOpen}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
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

  // Filter out root-level PDFs (course-level books/manuals) — accessible via Materials tab
  const displayGroups = useMemo(
    () => materialGroups.filter(g => {
      if (g.primary.type !== 'pdf') return true
      const path = (g.primary.sourceMetadata?.path as string) ?? ''
      return getDirPath(path) !== ''
    }),
    [materialGroups]
  )

  const showSearch = displayGroups.length > LESSON_SEARCH_THRESHOLD

  // Filter groups by search query (match primary title or material titles)
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return displayGroups
    const q = searchQuery.toLowerCase()
    return displayGroups.filter(
      g =>
        g.primary.title.toLowerCase().includes(q) ||
        g.materials.some(m => m.title.toLowerCase().includes(q))
    )
  }, [displayGroups, searchQuery])

  // Build nested folder tree
  const folderTree = useMemo(() => buildFolderTree(filteredGroups), [filteredGroups])
  const rootItems = useMemo(
    () => filteredGroups.filter(g => getDirPath((g.primary.sourceMetadata?.path as string) ?? '') === ''),
    [filteredGroups]
  )
  const hasMultipleFolders = folderTree.length > 1 || (folderTree.length === 1 && rootItems.length > 0) || folderTree.length > 0

  // Auto-expand ancestor folders containing the active lesson
  const activePaths = useMemo(
    () => getAncestorPaths(folderTree, lessonId),
    [folderTree, lessonId]
  )

  // Controlled expanded-folders state using full path keys
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(activePaths)
  )

  // When active lesson changes folder, auto-expand the full chain
  useEffect(() => {
    if (activePaths.length > 0) {
      setExpandedFolders(prev => {
        const next = new Set(prev)
        for (const p of activePaths) next.add(p)
        return next
      })
    }
  }, [activePaths.join(',')])

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderPath)) next.delete(folderPath)
      else next.add(folderPath)
      return next
    })
  }, [])

  // Pre-compute O(1) lookup for original group indices (must be before early returns)
  const groupIndexMap = useMemo(
    () => new Map(displayGroups.map((g, i) => [g.primary.id, i])),
    [displayGroups]
  )

  const currentIndex = displayGroups.findIndex(g => g.primary.id === lessonId)

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (displayGroups.length === 0) {
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
        {searchQuery && filteredGroups.length !== displayGroups.length
          ? `Showing ${filteredGroups.length} of ${displayGroups.length} lessons`
          : currentIndex >= 0
            ? `Lesson ${currentIndex + 1} of ${displayGroups.length}`
            : `${displayGroups.length} lessons`}
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
        <>
          {/* Root-level items (no folder) render flat */}
          {rootItems.map(group => {
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
          })}
          {/* Nested folder tree */}
          {folderTree.map(node => (
            <FolderTreeNode
              key={node.path}
              node={node}
              courseId={courseId}
              lessonId={lessonId}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              activeRef={activeRef}
              searchQuery={searchQuery}
              onFocusMaterials={onFocusMaterials}
              forceOpen={!!searchQuery}
            />
          ))}
        </>
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
