/**
 * LessonsTab — Course lesson list sub-panel for PlayerSidePanel.
 *
 * Renders a clean lesson-based outline (sections → lessons) using
 * the lesson-based curriculum engine. Companion materials (PDFs, TXTs,
 * cheat sheets, slides) are nested under their parent lesson.
 *
 * Rewritten for lesson-based curriculum architecture (2026-07-05).
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Link } from 'react-router'
import {
  Video,
  PlayCircle,
  FileText,
  BookOpen,
  Search,
  X,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Input } from '@/app/components/ui/input'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import type { CourseAdapter } from '@/lib/courseAdapter'
import type { CourseSection, LessonGroup, LessonGroupItem } from '@/lib/lessonBasedCurriculum'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import {
  formatLessonDuration,
  LESSON_SEARCH_THRESHOLD,
  HighlightedLessonTitle,
} from './LessonsTabHighlightedTitle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get active state label for a lesson.
 */
function getActiveLabel(type: LessonGroupItem['type'], isMaterial: boolean): string {
  if (isMaterial) return 'Viewing material'
  switch (type) {
    case 'video':
      return 'Now playing'
    case 'pdf':
    case 'text':
      return 'Now reading'
    default:
      return 'Active'
  }
}

/**
 * Get content type icon for a lesson item.
 */
function LessonTypeIcon({
  type,
  className,
}: {
  type: LessonGroupItem['type']
  className?: string
}) {
  switch (type) {
    case 'video':
      return <Video className={cn('size-3', className)} aria-hidden="true" />
    case 'pdf':
      return <FileText className={cn('size-3', className)} aria-hidden="true" />
    case 'text':
      return <BookOpen className={cn('size-3', className)} aria-hidden="true" />
    default:
      return <FileText className={cn('size-3', className)} aria-hidden="true" />
  }
}

// ---------------------------------------------------------------------------
// LessonRow — single lesson in the sidebar
// ---------------------------------------------------------------------------

function LessonRow({
  lesson,
  courseId,
  isActive,
  index,
  materialCount,
  activeRef,
  searchQuery,
  onFocusMaterials,
  isMaterial,
}: {
  lesson: LessonGroupItem
  courseId: string
  isActive: boolean
  index: number
  materialCount: number
  activeRef?: React.Ref<HTMLAnchorElement>
  searchQuery: string
  onFocusMaterials?: () => void
  isMaterial?: boolean
}) {
  const completionStatus = useContentProgressStore(
    state => state.statusMap[`${courseId}:${lesson.id}`] ?? 'not-started'
  )
  const isCompleted = completionStatus === 'completed'

  const formattedDuration =
    lesson.type === 'video' && lesson.duration && lesson.duration > 0
      ? formatLessonDuration(lesson.duration)
      : null

  const displayInfo = isMaterial
    ? null
    : lesson.type === 'video'
      ? formattedDuration
      : lesson.type === 'pdf'
        ? `${lesson.pageCount ?? '?'} pgs`
        : lesson.type === 'text'
          ? 'Reading'
          : null

  const activeLabel = isActive ? getActiveLabel(lesson.type, Boolean(isMaterial)) : null

  return (
    <Link
      ref={activeRef}
      to={`/courses/${courseId}/lessons/${lesson.id}`}
      title={lesson.displayTitle}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1',
        isActive
          ? 'bg-brand-soft text-brand-soft-foreground font-medium'
          : 'hover:bg-accent'
      )}
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? 'true' : undefined}
    >
      {/* Index / completion / active indicator */}
      <span
        className={cn(
          'flex-shrink-0 size-7 rounded-lg flex items-center justify-center',
          isCompleted && !isActive
            ? 'bg-success/10'
            : isMaterial
              ? 'bg-resource-pdf-bg'
              : 'bg-brand-soft/50'
        )}
      >
        {isActive ? (
          <PlayCircle className="size-4 text-brand" aria-hidden="true" />
        ) : isCompleted && !isMaterial ? (
          <CheckCircle2
            className="size-3.5 text-success"
            aria-hidden="true"
            data-testid={`completion-check-${lesson.id}`}
          />
        ) : isMaterial ? (
          <FileText className="size-3.5 text-resource-pdf" aria-hidden="true" />
        ) : (
          <span className="text-xs font-semibold text-brand-soft-foreground">{index + 1}</span>
        )}
      </span>

      {/* Lesson info */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm line-clamp-2',
            isCompleted && !isActive && 'line-through text-muted-foreground'
          )}
        >
          <HighlightedLessonTitle text={lesson.displayTitle} query={searchQuery} />
        </p>
        <div
          className={cn(
            'flex items-center gap-1.5 mt-0.5',
            isActive ? 'text-brand-soft-foreground/70' : 'text-muted-foreground'
          )}
        >
          <LessonTypeIcon type={lesson.type} />
          {displayInfo && <span className="text-xs">{displayInfo}</span>}
          {activeLabel && (
            <span className="text-[11px] text-brand font-medium">{activeLabel}</span>
          )}
          {!isMaterial && materialCount > 0 && onFocusMaterials && (
            <button
              type="button"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 rounded-sm"
              onClick={e => {
                e.preventDefault()
                e.stopPropagation()
                onFocusMaterials()
              }}
              aria-label={`${materialCount} material${materialCount !== 1 ? 's' : ''}`}
            >
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                <FileText className="size-2.5 mr-0.5" aria-hidden="true" />
                {materialCount}
              </Badge>
            </button>
          )}
          {!isMaterial && materialCount > 0 && !onFocusMaterials && (
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
// MaterialRow — companion material sub-row
// ---------------------------------------------------------------------------

function MaterialRow({
  material,
  courseId,
  lessonId,
  searchQuery,
}: {
  material: LessonGroupItem
  courseId: string
  lessonId: string
  searchQuery: string
}) {
  const completionStatus = useContentProgressStore(
    state => state.statusMap[`${courseId}:${material.id}`] ?? 'not-started'
  )
  const isCompleted = completionStatus === 'completed'
  const isActive = material.id === lessonId

  return (
    <Link
      to={`/courses/${courseId}/lessons/${material.id}`}
      title={material.displayTitle}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1',
        isActive
          ? 'bg-brand-soft text-brand-soft-foreground font-medium'
          : 'hover:bg-accent'
      )}
      aria-current={isActive ? 'page' : undefined}
      data-testid={`material-link-${material.id}`}
      data-active={isActive ? 'true' : undefined}
    >
      <span
        className={cn(
          'flex-shrink-0 size-7 rounded-lg flex items-center justify-center',
          isCompleted && !isActive ? 'bg-success/10' : 'bg-resource-pdf-bg'
        )}
      >
        {isCompleted && !isActive ? (
          <CheckCircle2
            className="size-3.5 text-success"
            aria-hidden="true"
            data-testid={`completion-check-${material.id}`}
          />
        ) : (
          <LessonTypeIcon
            type={material.type}
            className={isActive ? 'text-brand' : 'text-resource-pdf'}
          />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm line-clamp-2',
            isCompleted && !isActive && 'line-through text-muted-foreground'
          )}
        >
          <HighlightedLessonTitle text={material.displayTitle} query={searchQuery} />
        </p>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
          <LessonTypeIcon type={material.type} />
          {material.type === 'pdf' && material.pageCount ? (
            <span>{material.pageCount} pgs</span>
          ) : (
            <span className="capitalize">{material.type}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// LessonGroupRow — primary lesson with collapsible companion materials
// ---------------------------------------------------------------------------

function LessonGroupRow({
  group,
  courseId,
  lessonId,
  index,
  activeRef,
  searchQuery,
  onFocusMaterials,
  isExpanded,
  onToggleExpand,
}: {
  group: LessonGroup
  courseId: string
  lessonId: string
  index: number
  activeRef?: React.Ref<HTMLAnchorElement>
  searchQuery: string
  onFocusMaterials?: () => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const isPrimaryActive = group.primary.id === lessonId
  const hasMaterials = group.materials.length > 0

  // Check if active lesson is a material within this group
  const activeMaterial = group.materials.find(m => m.id === lessonId)

  if (!hasMaterials) {
    return (
      <LessonRow
        lesson={group.primary}
        courseId={courseId}
        isActive={isPrimaryActive}
        index={index}
        materialCount={0}
        activeRef={isPrimaryActive ? activeRef : undefined}
        searchQuery={searchQuery}
        onFocusMaterials={onFocusMaterials}
      />
    )
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <LessonRow
            lesson={group.primary}
            courseId={courseId}
            isActive={isPrimaryActive || Boolean(activeMaterial)}
            index={index}
            materialCount={group.materials.length}
            activeRef={isPrimaryActive ? activeRef : undefined}
            searchQuery={searchQuery}
            onFocusMaterials={onFocusMaterials}
          />
        </div>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex-shrink-0 size-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label={isExpanded ? 'Collapse materials' : 'Expand materials'}
            data-testid={`materials-collapse-${group.primary.id}`}
          >
            <ChevronDown
              className={cn(
                'size-3.5 text-muted-foreground transition-transform',
                isExpanded && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="ml-6 pl-2 border-l border-border/50 space-y-0.5">
          {group.materials.map(material => (
            <MaterialRow
              key={material.id}
              material={material}
              courseId={courseId}
              lessonId={lessonId}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ---------------------------------------------------------------------------
// SectionHeader — collapsible section heading
// ---------------------------------------------------------------------------

function SectionHeader({
  section,
  courseId,
  lessonId,
  isExpanded,
  onToggle,
  searchQuery,
  expandedMaterialGroups,
  toggleMaterialGroup,
  activeRef,
  onFocusMaterials,
}: {
  section: CourseSection
  courseId: string
  lessonId: string
  isExpanded: boolean
  onToggle: () => void
  searchQuery: string
  expandedMaterialGroups: Set<string>
  toggleMaterialGroup: (id: string) => void
  activeRef: React.RefObject<HTMLAnchorElement | null>
  onFocusMaterials?: () => void
}) {
  const hasActiveLesson = section.lessons.some(
    g => g.primary.id === lessonId || g.materials.some(m => m.id === lessonId)
  )

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1',
          hasActiveLesson
            ? 'bg-brand-soft/30 text-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
        aria-expanded={isExpanded}
      >
        <span className="flex-1 text-left text-sm font-semibold line-clamp-1">
          {section.title}
        </span>
        <span className="text-xs text-muted-foreground">
          {section.lessons.length} lesson{section.lessons.length !== 1 ? 's' : ''}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-2 pl-2 border-l border-border/50 space-y-0.5 pt-0.5">
          {section.lessons.map((group, gi) => (
            <LessonGroupRow
              key={group.primary.id}
              group={group}
              courseId={courseId}
              lessonId={lessonId}
              index={gi}
              searchQuery={searchQuery}
              isExpanded={expandedMaterialGroups.has(group.primary.id)}
              onToggleExpand={() => toggleMaterialGroup(group.primary.id)}
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
  const [sections, setSections] = useState<CourseSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    let ignore = false
    setIsLoading(true)
    setLoadError(false)

    adapter
      .getLessonBasedCurriculum()
      .then(data => {
        if (!ignore) {
          setSections(data)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!ignore) {
          setIsLoading(false)
          setLoadError(true)
        }
      })

    return () => {
      ignore = true
    }
  }, [adapter, retryCount])

  // Scroll active lesson into view on mount
  useEffect(() => {
    if (!isLoading && activeRef.current) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    }
  }, [isLoading, lessonId])

  // Total lesson count (primary lessons only)
  const totalLessons = useMemo(
    () => sections.reduce((sum, s) => sum + s.lessons.length, 0),
    [sections]
  )

  const showSearch = totalLessons > LESSON_SEARCH_THRESHOLD

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections
    const q = searchQuery.toLowerCase()
    return sections
      .map(section => ({
        ...section,
        lessons: section.lessons.filter(
          g =>
            g.primary.displayTitle.toLowerCase().includes(q) ||
            g.materials.some(m => m.displayTitle.toLowerCase().includes(q))
        ),
      }))
      .filter(s => s.lessons.length > 0)
  }, [sections, searchQuery])

  // Auto-expand sections containing the active lesson
  const activeSectionPaths = useMemo(() => {
    const paths = new Set<string>()
    for (const section of sections) {
      const hasActive = section.lessons.some(
        g => g.primary.id === lessonId || g.materials.some(m => m.id === lessonId)
      )
      if (hasActive) paths.add(section.title)
    }
    return paths
  }, [sections, lessonId])

  const hasMultipleSections = sections.length > 1

  // Sections expanded state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(activeSectionPaths)
  )

  useEffect(() => {
    setExpandedSections(new Set(activeSectionPaths))
  }, [JSON.stringify([...activeSectionPaths])])

  // Material groups expanded state
  const [expandedMaterialGroups, setExpandedMaterialGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const section of sections) {
      for (const group of section.lessons) {
        if (group.materials.some(m => m.id === lessonId)) {
          initial.add(group.primary.id)
        }
      }
    }
    return initial
  })

  // Auto-expand groups with materials on first load
  const initialExpandDoneRef = useRef(false)
  const lastCourseIdRef = useRef(courseId)

  useEffect(() => {
    if (lastCourseIdRef.current !== courseId) {
      initialExpandDoneRef.current = false
      lastCourseIdRef.current = courseId
    }
  }, [courseId])

  useEffect(() => {
    if (isLoading || sections.length === 0) return

    const groupsWithMaterials = new Set<string>()
    for (const section of sections) {
      for (const group of section.lessons) {
        if (group.materials.length > 0) {
          groupsWithMaterials.add(group.primary.id)
        }
      }
    }

    if (!initialExpandDoneRef.current && groupsWithMaterials.size > 0) {
      setExpandedMaterialGroups(prev => {
        const next = new Set(prev)
        for (const id of groupsWithMaterials) next.add(id)
        return next
      })
      initialExpandDoneRef.current = true
    }
  }, [isLoading, sections])

  // Auto-expand parent group when active lesson is a material
  useEffect(() => {
    setExpandedMaterialGroups(prev => {
      const next = new Set(prev)
      for (const section of sections) {
        for (const group of section.lessons) {
          if (group.materials.some(m => m.id === lessonId)) {
            next.add(group.primary.id)
          }
        }
      }
      return next
    })
  }, [lessonId, sections])

  const toggleSection = useCallback((sectionTitle: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionTitle)) next.delete(sectionTitle)
      else next.add(sectionTitle)
      return next
    })
  }, [])

  const toggleMaterialGroup = useCallback((groupId: string) => {
    setExpandedMaterialGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // Find current lesson index
  let currentIndex = -1
  let lessonCount = 0
  for (const section of sections) {
    for (const group of section.lessons) {
      if (group.primary.id === lessonId) {
        currentIndex = lessonCount
      }
      lessonCount++
    }
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  // --- Error state ---
  if (loadError) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 px-4 text-center"
        data-testid="lessons-tab-error"
      >
        <AlertTriangle className="size-10 mb-3 text-destructive opacity-70" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Failed to load course content
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Please check your connection and try again.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRetryCount(c => c + 1)}
          className="rounded-xl"
        >
          Retry
        </Button>
      </div>
    )
  }

  // --- Empty state ---
  if (sections.length === 0 || totalLessons === 0) {
    return (
      <EmptyState icon={Video} title="No lessons" description="This course has no lessons yet" />
    )
  }

  // --- Render ---
  return (
    <div className="p-2 space-y-0.5" data-testid="lessons-tab-list">
      {/* Search */}
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

      {/* Lesson count */}
      <div className="px-2 pb-2 text-xs text-muted-foreground">
        {searchQuery
          ? `Showing ${filteredSections.reduce((sum, s) => sum + s.lessons.length, 0)} of ${totalLessons} lessons`
          : currentIndex >= 0
            ? `Lesson ${currentIndex + 1} of ${totalLessons}`
            : `${totalLessons} lessons`}
      </div>

      {/* Empty search state */}
      {filteredSections.length === 0 && searchQuery ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          data-testid="lesson-search-empty"
        >
          <Search className="size-10 mb-3 opacity-50" aria-hidden="true" />
          <p className="text-sm mb-1">No lessons match your search</p>
          <p className="text-xs text-muted-foreground/70 mb-3">
            Try a different search term or clear the filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery('')}
            className="rounded-xl"
          >
            Clear search
          </Button>
        </div>
      ) : hasMultipleSections ? (
        /* Multi-section layout */
        filteredSections.map(section => (
          <SectionHeader
            key={section.title}
            section={section}
            courseId={courseId}
            lessonId={lessonId}
            isExpanded={expandedSections.has(section.title)}
            onToggle={() => toggleSection(section.title)}
            searchQuery={searchQuery}
            expandedMaterialGroups={expandedMaterialGroups}
            toggleMaterialGroup={toggleMaterialGroup}
            activeRef={activeRef}
            onFocusMaterials={onFocusMaterials}
          />
        ))
      ) : (
        /* Flat layout (single section) */
        filteredSections.flatMap(section =>
          section.lessons.map((group, gi) => (
            <LessonGroupRow
              key={group.primary.id}
              group={group}
              courseId={courseId}
              lessonId={lessonId}
              index={gi}
              activeRef={group.primary.id === lessonId ? activeRef : undefined}
              searchQuery={searchQuery}
              onFocusMaterials={onFocusMaterials}
              isExpanded={expandedMaterialGroups.has(group.primary.id)}
              onToggleExpand={() => toggleMaterialGroup(group.primary.id)}
            />
          ))
        )
      )}
    </div>
  )
}
