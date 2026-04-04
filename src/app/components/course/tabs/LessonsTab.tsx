/**
 * LessonsTab — Course lesson list sub-panel for PlayerSidePanel.
 *
 * Includes search/filter, highlighted titles, and lesson duration formatting.
 *
 * Extracted from PlayerSidePanel.tsx to reduce god-component complexity.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router'
import { Video, PlayCircle, FileText, Search, X, FolderOpen, ChevronDown } from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import type { CourseAdapter, LessonItem } from '@/lib/courseAdapter'

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
// Folder grouping
// ---------------------------------------------------------------------------

interface LessonGroup {
  folder: string
  lessons: LessonItem[]
}

function getFolderName(path: string): string {
  const parts = path.split('/')
  return parts.length > 1 ? parts[0] : ''
}

function groupLessonsByFolder(lessons: LessonItem[]): LessonGroup[] {
  const groups = new Map<string, LessonItem[]>()
  for (const lesson of lessons) {
    const path = (lesson.sourceMetadata?.path as string) ?? ''
    const folder = getFolderName(path)
    if (!groups.has(folder)) groups.set(folder, [])
    groups.get(folder)!.push(lesson)
  }
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([folder, items]) => ({ folder, lessons: items }))
}

// ---------------------------------------------------------------------------
// LessonsTab component
// ---------------------------------------------------------------------------

function LessonLink({
  lesson,
  courseId,
  isActive,
  index,
  activeRef,
  searchQuery,
}: {
  lesson: LessonItem
  courseId: string
  isActive: boolean
  index: number
  activeRef?: React.Ref<HTMLAnchorElement>
  searchQuery: string
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
        </div>
      </div>
    </Link>
  )
}

export interface LessonsTabProps {
  courseId: string
  lessonId: string
  adapter: CourseAdapter
}

export function LessonsTab({ courseId, lessonId, adapter }: LessonsTabProps) {
  const [lessons, setLessons] = useState<LessonItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)

    adapter
      .getLessons()
      .then(items => {
        if (!ignore) {
          setLessons(items)
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

  const showSearch = lessons.length > LESSON_SEARCH_THRESHOLD

  const filteredLessons = useMemo(() => {
    if (!searchQuery) return lessons
    const q = searchQuery.toLowerCase()
    return lessons.filter(l => l.title.toLowerCase().includes(q))
  }, [lessons, searchQuery])

  const groupedLessons = useMemo(() => groupLessonsByFolder(filteredLessons), [filteredLessons])
  const hasMultipleGroups =
    groupedLessons.length > 1 || (groupedLessons.length === 1 && groupedLessons[0].folder !== '')

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (lessons.length === 0) {
    return (
      <EmptyState icon={Video} title="No lessons" description="This course has no lessons yet" />
    )
  }

  // Pre-compute O(1) lookup map for original lesson indices
  const lessonIndexMap = useMemo(() => new Map(lessons.map((l, i) => [l.id, i])), [lessons])

  const currentIndex = lessons.findIndex(l => l.id === lessonId)

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
        {searchQuery && filteredLessons.length !== lessons.length
          ? `Showing ${filteredLessons.length} of ${lessons.length} lessons`
          : currentIndex >= 0
            ? `Lesson ${currentIndex + 1} of ${lessons.length}`
            : `${lessons.length} lessons`}
      </div>
      {filteredLessons.length === 0 && searchQuery ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          data-testid="lesson-search-empty"
        >
          <Search className="size-10 mb-3 opacity-50" aria-hidden="true" />
          <p className="text-sm">No lessons match your search</p>
        </div>
      ) : hasMultipleGroups ? (
        groupedLessons.map(group => (
          <Collapsible key={group.folder || 'root'} defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground group/folder">
              <FolderOpen className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left text-xs truncate">
                {group.folder || 'General'}
              </span>
              <span className="text-xs text-muted-foreground">{group.lessons.length}</span>
              <ChevronDown
                className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]/folder:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-2 pl-2 border-l border-border/50 space-y-0.5">
                {group.lessons.map((lesson, indexInGroup) => {
                  const isActive = lesson.id === lessonId
                  return (
                    <LessonLink
                      key={lesson.id}
                      lesson={lesson}
                      courseId={courseId}
                      isActive={isActive}
                      index={indexInGroup}
                      activeRef={isActive ? activeRef : undefined}
                      searchQuery={searchQuery}
                    />
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))
      ) : (
        filteredLessons.map(lesson => {
          const isActive = lesson.id === lessonId
          const originalIndex = lessonIndexMap.get(lesson.id) ?? 0
          return (
            <LessonLink
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              isActive={isActive}
              index={originalIndex}
              activeRef={isActive ? activeRef : undefined}
              searchQuery={searchQuery}
            />
          )
        })
      )}
    </div>
  )
}
