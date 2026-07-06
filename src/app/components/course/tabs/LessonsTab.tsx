/**
 * LessonsTab - Course lesson list sub-panel for PlayerSidePanel.
 *
 * Renders a professional course navigator with:
 * - Clean section headers (collapsible, only active section expanded by default)
 * - Global lesson numbering (001, 002, 003...)
 * - Unified status circle (not started / in progress / completed / active)
 * - Clean file-type badges (Video, PDF, Reading)
 * - Filter chips: All, Videos, PDFs, In Progress, Completed
 * - Companion materials nested under parent lesson
 *
 * Rewritten for lesson-based curriculum architecture (2026-07-06).
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
  Clock,
  Circle,
} from 'lucide-react'
import { Input } from '@/app/components/ui/input'
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
// Types
// ---------------------------------------------------------------------------

type FilterType = 'all' | 'video' | 'pdf' | 'in-progress' | 'completed'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a human-readable file type badge label. */
function getTypeBadge(type: LessonGroupItem['type']): { label: string; icon: React.ReactNode } {
  switch (type) {
    case 'video':
      return { label: 'Video', icon: <Video className="size-3" aria-hidden="true" /> }
    case 'pdf':
      return { label: 'PDF', icon: <FileText className="size-3" aria-hidden="true" /> }
    case 'text':
      return { label: 'Reading', icon: <BookOpen className="size-3" aria-hidden="true" /> }
    default:
      return { label: 'Material', icon: <FileText className="size-3" aria-hidden="true" /> }
  }
}

/** Format the global lesson number (zero-padded 3 digits). */
function formatLessonNumber(globalIndex: number): string {
  return String(globalIndex + 1).padStart(3, '0')
}

// ---------------------------------------------------------------------------
// StatusCircle - unified status indicator (replaces multiple colored icons)
// ---------------------------------------------------------------------------

function StatusCircle({
  status,
  globalNumber,
  isActive,
}: {
  status: 'not-started' | 'in-progress' | 'completed'
  globalNumber: number
  isActive: boolean
}) {
  if (isActive) {
    return (
      <span className="flex-shrink-0 size-7 rounded-lg bg-brand flex items-center justify-center shadow-sm shadow-brand/20">
        <PlayCircle className="size-3.5 text-brand-foreground" aria-hidden="true" />
      </span>
    )
  }

  if (status === 'completed') {
    return (
      <span className="flex-shrink-0 size-7 rounded-lg bg-success/15 flex items-center justify-center">
        <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
      </span>
    )
  }

  if (status === 'in-progress') {
    return (
      <span className="flex-shrink-0 size-7 rounded-lg bg-brand-soft/60 flex items-center justify-center">
        <Clock className="size-3.5 text-brand" aria-hidden="true" />
      </span>
    )
  }

  // Not started
  return (
    <span className="flex-shrink-0 size-7 rounded-lg bg-muted flex items-center justify-center">
      <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
        {formatLessonNumber(globalNumber)}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// LessonRow - single lesson in the sidebar
// ---------------------------------------------------------------------------

function LessonRow({
  lesson,
  courseId,
  isActive,
  globalIndex,
  materialCount,
  activeRef,
  searchQuery,
  hasMaterials,
}: {
  lesson: LessonGroupItem
  courseId: string
  isActive: boolean
  globalIndex: number
  materialCount: number
  activeRef?: React.Ref<HTMLAnchorElement>
  searchQuery: string
  hasMaterials: boolean
}) {
  const completionStatus = useContentProgressStore(
    state => state.statusMap[courseId + ':' + lesson.id] ?? 'not-started'
  )

  const formattedDuration =
    lesson.type === 'video' && lesson.duration && lesson.duration > 0
      ? formatLessonDuration(lesson.duration)
      : null

  const badge = getTypeBadge(lesson.type)

  return (
    <Link
      ref={activeRef}
      to={'/courses/' + courseId + '/lessons/' + lesson.id}
      title={lesson.displayTitle}
      className={cn(
        'flex items-start gap-2.5 rounded-xl px-2.5 py-3 transition-colors group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1',
        isActive
          ? 'bg-brand-soft'
          : 'hover:bg-accent'
      )}
      aria-current={isActive ? 'page' : undefined}
      data-active={isActive ? 'true' : undefined}
    >
      {/* Status indicator */}
      <StatusCircle
        status={completionStatus}
        globalNumber={globalIndex}
        isActive={isActive}
      />

      {/* Lesson info */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p
          className={cn(
            'text-sm leading-snug line-clamp-2',
            isActive
              ? 'text-brand-soft-foreground font-semibold'
              : completionStatus === 'completed'
                ? 'text-muted-foreground/70'
                : 'text-foreground'
          )}
        >
          <HighlightedLessonTitle text={lesson.displayTitle} query={searchQuery} />
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Now Playing label */}
          {isActive && (
            <span className="text-[11px] text-brand font-semibold mr-0.5">Now Playing</span>
          )}
          {/* Type badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              isActive
                ? 'bg-brand/10 text-brand'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {badge.icon}
            {badge.label}
          </span>
          {/* Duration (videos only) */}
          {formattedDuration && (
            <span className="text-[10px] text-muted-foreground/70">{formattedDuration}</span>
          )}
          {/* Material count */}
          {hasMaterials && (
            <span className="text-[10px] text-muted-foreground/50">
              +{materialCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// MaterialRow - companion material sub-row (lighter visual weight)
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
  const isActive = material.id === lessonId
  const badge = getTypeBadge(material.type)

  return (
    <Link
      to={'/courses/' + courseId + '/lessons/' + material.id}
      title={material.displayTitle}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-2 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1',
        isActive
          ? 'bg-brand-soft/70'
          : 'hover:bg-accent/50'
      )}
      aria-current={isActive ? 'page' : undefined}
      data-testid={'material-link-' + material.id}
      data-active={isActive ? 'true' : undefined}
    >
      {/* Small dot indicator */}
      <span className="flex-shrink-0 size-5 flex items-center justify-center">
        <Circle className={cn('size-1.5', isActive ? 'fill-brand text-brand' : 'fill-muted-foreground/30 text-muted-foreground/30')} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-xs leading-snug line-clamp-1',
            isActive ? 'text-brand-soft-foreground font-medium' : 'text-muted-foreground'
          )}
        >
          <HighlightedLessonTitle text={material.displayTitle} query={searchQuery} />
        </p>
      </div>
      <span className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground/60 bg-muted/50 flex-shrink-0">
        {badge.icon}
        {badge.label}
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// LessonGroupRow - primary lesson with collapsible companion materials
// ---------------------------------------------------------------------------

function LessonGroupRow({
  group,
  courseId,
  lessonId,
  globalIndex,
  activeRef,
  searchQuery,
  isExpanded,
  onToggleExpand,
}: {
  group: LessonGroup
  courseId: string
  lessonId: string
  globalIndex: number
  activeRef?: React.Ref<HTMLAnchorElement>
  searchQuery: string
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
        globalIndex={globalIndex}
        materialCount={0}
        activeRef={isPrimaryActive ? activeRef : undefined}
        searchQuery={searchQuery}
        hasMaterials={false}
      />
    )
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div>
        <LessonRow
          lesson={group.primary}
          courseId={courseId}
          isActive={isPrimaryActive || Boolean(activeMaterial)}
          globalIndex={globalIndex}
          materialCount={group.materials.length}
          activeRef={isPrimaryActive ? activeRef : undefined}
          searchQuery={searchQuery}
          hasMaterials
        />
        {/* Expand/collapse toggle */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1 ml-9 px-2 py-0.5 rounded-md text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors w-full text-left',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
            )}
            aria-label={isExpanded ? 'Hide materials' : 'Show materials'}
            data-testid={'materials-collapse-' + group.primary.id}
          >
            <ChevronDown
              className={cn(
                'size-3 transition-transform',
                isExpanded && 'rotate-180'
              )}
              aria-hidden="true"
            />
            {group.materials.length} material{group.materials.length !== 1 ? 's' : ''}
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="ml-9 pl-3 border-l border-border/40 pt-0.5 space-y-0">
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
// SectionHeader - collapsible section heading
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
  sectionIndex,
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
  sectionIndex: number
}) {
  const hasActiveLesson = section.lessons.some(
    g => g.primary.id === lessonId || g.materials.some(m => m.id === lessonId)
  )

  // Count completed lessons in this section
  const statusMap = useContentProgressStore(state => state.statusMap)
  const completedCount = section.lessons.filter(
    g => statusMap[courseId + ':' + g.primary.id] === 'completed'
  ).length

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1',
          hasActiveLesson
            ? 'bg-brand-soft/40'
            : 'hover:bg-accent'
        )}
        aria-expanded={isExpanded}
      >
        {/* Section number */}
        <span className="flex-shrink-0 size-6 rounded-md bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground tabular-nums">
          {String(sectionIndex + 1).padStart(2, '0')}
        </span>
        <span className={cn(
          'flex-1 text-left text-sm font-semibold line-clamp-1',
          hasActiveLesson ? 'text-brand-soft-foreground' : 'text-foreground'
        )}>
          {section.title}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
          {completedCount}/{section.lessons.length}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted-foreground transition-transform flex-shrink-0',
            isExpanded && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-2 pl-3 border-l border-border/40 space-y-px pt-1">
          {section.lessons.map((group, gi) => {
            const globalLessonIndex = section.startIndex + gi
            return (
              <LessonGroupRow
                key={group.primary.id}
                group={group}
                courseId={courseId}
                lessonId={lessonId}
                globalIndex={globalLessonIndex}
                activeRef={group.primary.id === lessonId ? activeRef : undefined}
                searchQuery={searchQuery}
                isExpanded={expandedMaterialGroups.has(group.primary.id)}
                onToggleExpand={() => toggleMaterialGroup(group.primary.id)}
              />
            )
          })}
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

export function LessonsTab({ courseId, lessonId, adapter, onFocusMaterials: _onFocusMaterials }: LessonsTabProps) {
  const [sections, setSections] = useState<CourseSection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const activeRef = useRef<HTMLAnchorElement>(null)

  const statusMap = useContentProgressStore(state => state.statusMap)

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

  // Filters
  const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'video', label: 'Videos' },
    { value: 'pdf', label: 'PDFs' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
  ]

  // Filter sections by search query + active filter
  const filteredSections = useMemo(() => {
    let result = sections

    // Apply content-type filter
    if (activeFilter === 'video') {
      result = result
        .map(section => ({
          ...section,
          lessons: section.lessons.filter(g => g.primary.type === 'video'),
        }))
        .filter(s => s.lessons.length > 0)
    } else if (activeFilter === 'pdf') {
      result = result
        .map(section => ({
          ...section,
          lessons: section.lessons.filter(g => g.primary.type === 'pdf' || g.primary.type === 'text'),
        }))
        .filter(s => s.lessons.length > 0)
    } else if (activeFilter === 'in-progress') {
      result = result
        .map(section => ({
          ...section,
          lessons: section.lessons.filter(
            g => statusMap[courseId + ':' + g.primary.id] === 'in-progress'
          ),
        }))
        .filter(s => s.lessons.length > 0)
    } else if (activeFilter === 'completed') {
      result = result
        .map(section => ({
          ...section,
          lessons: section.lessons.filter(
            g => statusMap[courseId + ':' + g.primary.id] === 'completed'
          ),
        }))
        .filter(s => s.lessons.length > 0)
    }

    // Apply search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result
        .map(section => ({
          ...section,
          lessons: section.lessons.filter(
            g =>
              g.primary.displayTitle.toLowerCase().includes(q) ||
              g.materials.some(m => m.displayTitle.toLowerCase().includes(q))
          ),
        }))
        .filter(s => s.lessons.length > 0)
    }

    return result
  }, [sections, searchQuery, activeFilter, courseId, statusMap])

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

  // Sections expanded state - only active section expanded by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(activeSectionPaths)
  )

  useEffect(() => {
    setExpandedSections(new Set(activeSectionPaths))
  }, [JSON.stringify([...activeSectionPaths])])

  // Material groups expanded state - only active lesson's group expanded
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

  const filteredTotal = filteredSections.reduce((sum, s) => sum + s.lessons.length, 0)

  // --- Render ---
  return (
    <div className="p-2 space-y-1" data-testid="lessons-tab-list">
      {/* Search + Filter row */}
      {(showSearch || true) && (
        <div className="px-1 pt-1 pb-2 space-y-2">
          {/* Search input */}
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

          {/* Filter chips */}
          <div className="flex items-center gap-1 flex-wrap">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setActiveFilter(opt.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  activeFilter === opt.value
                    ? 'bg-brand text-brand-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted-foreground/15'
                )}
                aria-pressed={activeFilter === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lesson count */}
      <div className="px-2 pb-1.5 text-[11px] text-muted-foreground">
        {searchQuery || activeFilter !== 'all'
          ? 'Showing ' + filteredTotal + ' of ' + totalLessons + ' lessons'
          : currentIndex >= 0
            ? 'Lesson ' + (currentIndex + 1) + ' of ' + totalLessons
            : totalLessons + ' lessons'}
      </div>

      {/* Empty search/filter state */}
      {filteredSections.length === 0 && (searchQuery || activeFilter !== 'all') ? (
        <div
          className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          data-testid="lesson-search-empty"
        >
          <Search className="size-10 mb-3 opacity-50" aria-hidden="true" />
          <p className="text-sm mb-1">No lessons match</p>
          <p className="text-xs text-muted-foreground/70 mb-3">
            Try a different search term or clear the filter.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearchQuery(''); setActiveFilter('all') }}
            className="rounded-xl"
          >
            Clear all filters
          </Button>
        </div>
      ) : hasMultipleSections ? (
        /* Multi-section layout */
        filteredSections.map((section, si) => (
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
            sectionIndex={si}
          />
        ))
      ) : (
        /* Flat layout (single section) */
        filteredSections.flatMap(section =>
          section.lessons.map((group, gi) => {
            const globalLessonIndex = section.startIndex + gi
            return (
              <LessonGroupRow
                key={group.primary.id}
                group={group}
                courseId={courseId}
                lessonId={lessonId}
                globalIndex={globalLessonIndex}
                activeRef={group.primary.id === lessonId ? activeRef : undefined}
                searchQuery={searchQuery}
                isExpanded={expandedMaterialGroups.has(group.primary.id)}
                onToggleExpand={() => toggleMaterialGroup(group.primary.id)}
              />
            )
          })
        )
      )}
    </div>
  )
}
