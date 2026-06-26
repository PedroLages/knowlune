import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, BookOpen, Plus, Sparkles, GripVertical, CheckCircle2, Folders } from 'lucide-react'
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
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { cn } from '@/app/components/ui/utils'
import { MoveUpDownButtons } from '@/app/components/figma/MoveUpDownButtons'
import { CourseTypeBadge } from '@/app/components/shared/CourseTypeBadge'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import type { ImportedCourse } from '@/data/types'

// --- Types ---

export interface CoursePickerItem {
  id: string
  name: string
  type: 'imported' | 'catalog'
  authorName: string | undefined
  thumbnailUrl: string | undefined
  tags: string[]
}

export interface InlineCoursePickerProps {
  /** Selection mode for the picker */
  mode: 'multiSelect' | 'singleSelect'
  /** Course IDs to exclude (e.g., already in the path) */
  excludeCourseIds: Set<string>
  /** Called when courses are selected and confirmed */
  onAdd: (courses: Array<{ courseId: string; courseType: 'imported' | 'catalog' }>) => void
  /** Controlled selected course IDs (for multiSelect mode) */
  selectedCourseIds?: string[]
  /** Called when selection changes (for multiSelect mode) */
  onSelectionChange?: (ids: string[]) => void
  /** Show "Recently Imported" section */
  showRecentlyImported?: boolean
  /** Show "Suggested Next" section (static placeholder) */
  showSuggestedNext?: boolean
  /** Show "Import new course" action */
  showImportAction?: boolean
  /** Handler for import new course action */
  onImportCourse?: () => void
  /** Show "Import multiple" batch action */
  showBatchImportAction?: boolean
  /** Handler for batch import action */
  onBatchImport?: () => void
  /** Max height for the scrollable list */
  maxHeight?: string
  /** External loading state (e.g., while stores are being initialized) */
  loading?: boolean
  /** Hide the confirm "Add N Courses" button in multi-select mode footer */
  hideConfirmButton?: boolean
  /** Additional class names */
  className?: string
}

// --- Constants ---

const FORMAT_TYPE_TAGS = new Set([
  'video',
  'book',
  'article',
  'course',
  'tutorial',
  'guide',
  'podcast',
  'interactive',
  'assessment',
])

// --- Helpers ---

/**
 * Suggest a path name from the first selected course's tags.
 * Scans tags for a topic-like tag (not a format/type tag) and appends
 * " Development" or " Fundamentals". Falls back to "Untitled Path".
 */
export function suggestNameFromTags(
  selectedCourses: CoursePickerItem[],
  _importedCourses?: ImportedCourse[]
): string {
  if (selectedCourses.length === 0) return 'Untitled Path'

  // Get tags from the first selected course
  const course = selectedCourses[0]
  const tags = course.tags ?? []
  const topicTag = tags.find(t => !FORMAT_TYPE_TAGS.has(t.toLowerCase()))
  if (topicTag) {
    const capitalized = topicTag.charAt(0).toUpperCase() + topicTag.slice(1)
    // Heuristic: short tags get " Fundamentals", longer get " Development"
    if (capitalized.length <= 8) {
      return `${capitalized} Fundamentals`
    }
    return `${capitalized} Development`
  }

  return 'Untitled Path'
}

// --- Skeleton ---

function PickerSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading courses">
      <Skeleton className="h-10 w-full rounded-xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// --- Course Row ---

function CourseRow({
  course,
  isSelected,
  mode,
  onToggle,
  onAdd,
}: {
  course: CoursePickerItem
  isSelected: boolean
  mode: 'multiSelect' | 'singleSelect'
  onToggle: (courseId: string) => void
  onAdd: (courseId: string, courseType: 'imported' | 'catalog') => void
}) {
  return (
    <div
      role="listitem"
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        isSelected ? 'border-brand bg-brand-soft/30' : 'border-border hover:bg-muted/50'
      )}
      data-testid={`course-row-${course.id}`}
    >
      {/* Thumbnail */}
      <div className="size-10 shrink-0 rounded-md bg-muted overflow-hidden">
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="size-full flex items-center justify-center">
            <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{course.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {course.authorName && (
            <span className="text-xs text-muted-foreground truncate">{course.authorName}</span>
          )}
          <CourseTypeBadge courseType={course.type} />
        </div>
      </div>

      {/* Action button */}
      {mode === 'multiSelect' ? (
        <label
          htmlFor={`picker-checkbox-${course.id}`}
          className={cn(
            'flex items-center gap-2 cursor-pointer shrink-0',
            'size-6 rounded border-2 transition-colors',
            isSelected ? 'bg-brand border-brand' : 'border-muted-foreground/30 hover:border-brand'
          )}
          data-testid={`checkbox-${course.id}`}
        >
          <input
            id={`picker-checkbox-${course.id}`}
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(course.id)}
            className="sr-only"
            aria-label={`Select ${course.name}`}
          />
          {isSelected && (
            <svg
              className="size-4 text-brand-foreground mx-auto"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </label>
      ) : (
        <Button
          variant="brand-outline"
          size="sm"
          onClick={() => onAdd(course.id, course.type)}
          aria-label={`Add ${course.name}`}
          className="shrink-0"
        >
          Add
        </Button>
      )}
    </div>
  )
}

// --- Section Header ---

function SectionHeader({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-1 py-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {children}
      </span>
      {count !== undefined && (
        <Badge variant="secondary" className="text-[10px]">
          {count}
        </Badge>
      )}
    </div>
  )
}

// --- Sortable Selected Course Row (DnD) ---

function SortableCourseRow({
  course,
  position,
  index,
  total,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  course: CoursePickerItem
  position: number
  index: number
  total: number
  onToggle: (courseId: string) => void
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: course.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic dnd-kit value
      style={style}
      {...attributes}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-brand bg-brand-soft/30',
        isDragging && 'opacity-50 shadow-lg z-10'
      )}
      data-testid={`selected-course-row-${course.id}`}
    >
      {/* Drag handle */}
      <button
        className="cursor-grab touch-manipulation rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${course.name}`}
        data-testid={`drag-handle-${course.id}`}
        {...listeners}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>

      {/* Numbered position badge */}
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums"
        aria-label={`Position ${position}`}
      >
        {position}
      </span>

      {/* Thumbnail */}
      <div className="size-8 shrink-0 rounded-md bg-muted overflow-hidden">
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="size-full flex items-center justify-center">
            <BookOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{course.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {course.authorName && (
            <span className="text-xs text-muted-foreground truncate">{course.authorName}</span>
          )}
          <CourseTypeBadge courseType={course.type} />
        </div>
      </div>

      {/* Deselect button */}
      <button
        onClick={() => onToggle(course.id)}
        className="shrink-0 size-6 rounded border-2 border-brand bg-brand flex items-center justify-center"
        aria-label={`Deselect ${course.name}`}
      >
        <CheckCircle2 className="size-4 text-brand-foreground" aria-hidden="true" />
      </button>

      {/* Keyboard reorder buttons (WCAG 2.5.7) */}
      <MoveUpDownButtons
        index={index}
        total={total}
        itemLabel={course.name}
        onMoveUp={() => onMoveUp(index)}
        onMoveDown={() => onMoveDown(index)}
        orientation="horizontal"
        size="sm"
        data-testid={`reorder-${course.id}`}
      />
    </div>
  )
}

// --- Main Component ---

export function InlineCoursePicker({
  mode,
  excludeCourseIds,
  onAdd,
  selectedCourseIds = [],
  onSelectionChange,
  showRecentlyImported = false,
  showSuggestedNext = false,
  showImportAction = false,
  onImportCourse,
  showBatchImportAction = false,
  onBatchImport,
  maxHeight = '400px',
  loading = false,
  hideConfirmButton = false,
  className,
}: InlineCoursePickerProps) {
  const { importedCourses, thumbnailUrls } = useCourseImportStore()
  const { authors } = useAuthorStore()
  const entries = useLearningPathStore(s => s.entries)
  const [search, setSearch] = useState('')

  // Drag-and-drop sensors (follow VideoReorderList pattern)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const [dragActiveId, setDragActiveId] = useState<string | null>(null)

  // Reset search on mount
  useEffect(() => {
    setSearch('')
  }, [])

  // Build course list from imported courses (catalog courses table dropped in E89-S01).
  // Sort alphabetically by name for predictable, stable display order — Dexie's
  // toArray() order is arbitrary (UUID primary keys), causing courses to shuffle
  // between page reloads.
  const allCourses: CoursePickerItem[] = useMemo(() => {
    return importedCourses
      .filter(c => !excludeCourseIds.has(c.id))
      .map(c => ({
        id: c.id,
        name: c.name,
        type: 'imported' as const,
        authorName: c.authorId ? authors.find(a => a.id === c.authorId)?.name : undefined,
        thumbnailUrl: thumbnailUrls[c.id],
        tags: c.tags ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [importedCourses, excludeCourseIds, authors, thumbnailUrls])

  // Recently Imported: courses not assigned to any path
  const assignedCourseIds: Set<string> = useMemo(() => {
    return new Set(entries.map(e => e.courseId).filter(id => id !== ''))
  }, [entries])

  const recentlyImported: CoursePickerItem[] = useMemo(() => {
    if (!showRecentlyImported) return []
    return allCourses.filter(c => !assignedCourseIds.has(c.id))
  }, [allCourses, assignedCourseIds, showRecentlyImported])

  // Filter by search
  const filteredCourses = useMemo(() => {
    if (!search.trim()) return allCourses
    const q = search.toLowerCase()
    return allCourses.filter(
      c =>
        c.name.toLowerCase().includes(q) || (c.authorName && c.authorName.toLowerCase().includes(q))
    )
  }, [allCourses, search])

  // Separate recently imported from the filtered list for display
  const recentlyImportedIds = useMemo(
    () => new Set(recentlyImported.map(c => c.id)),
    [recentlyImported]
  )

  const recentlyImportedFiltered = useMemo(
    () => filteredCourses.filter(c => recentlyImportedIds.has(c.id)),
    [filteredCourses, recentlyImportedIds]
  )

  const otherFiltered = useMemo(
    () => filteredCourses.filter(c => !recentlyImportedIds.has(c.id)),
    [filteredCourses, recentlyImportedIds]
  )

  const hasCourses = allCourses.length > 0

  // Lookup selected CoursePickerItem objects (for the "Selected Courses" DnD section)
  const selectedCourses = useMemo(() => {
    return selectedCourseIds
      .map(id => allCourses.find(c => c.id === id))
      .filter((c): c is CoursePickerItem => c !== undefined)
  }, [selectedCourseIds, allCourses])

  // Drag handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setDragActiveId(null)

      if (!over || active.id === over.id || !onSelectionChange) return

      const oldIndex = selectedCourseIds.indexOf(String(active.id))
      const newIndex = selectedCourseIds.indexOf(String(over.id))
      if (oldIndex === -1 || newIndex === -1) return

      onSelectionChange(arrayMove(selectedCourseIds, oldIndex, newIndex))
    },
    [selectedCourseIds, onSelectionChange]
  )

  const dragActiveCourse = dragActiveId ? selectedCourses.find(c => c.id === dragActiveId) : null
  const dragActivePosition = dragActiveId ? selectedCourseIds.indexOf(dragActiveId) + 1 : 0

  // Selection state
  const handleToggle = useCallback(
    (courseId: string) => {
      if (!onSelectionChange) return
      const isSelected = selectedCourseIds.includes(courseId)
      if (isSelected) {
        onSelectionChange(selectedCourseIds.filter(id => id !== courseId))
      } else {
        onSelectionChange([...selectedCourseIds, courseId])
      }
    },
    [selectedCourseIds, onSelectionChange]
  )

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index <= 0 || !onSelectionChange) return
      const updated = [...selectedCourseIds]
      const temp = updated[index - 1]
      updated[index - 1] = updated[index]
      updated[index] = temp
      onSelectionChange(updated)
    },
    [selectedCourseIds, onSelectionChange]
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index >= selectedCourseIds.length - 1 || !onSelectionChange) return
      const updated = [...selectedCourseIds]
      const temp = updated[index + 1]
      updated[index + 1] = updated[index]
      updated[index] = temp
      onSelectionChange(updated)
    },
    [selectedCourseIds, onSelectionChange]
  )

  const handleAdd = useCallback(
    (courseId: string, courseType: 'imported' | 'catalog') => {
      onAdd([{ courseId, courseType }])
    },
    [onAdd]
  )

  const handleConfirmMultiSelect = useCallback(() => {
    if (selectedCourseIds.length === 0) return
    const courses = selectedCourseIds
      .map(id => allCourses.find(c => c.id === id))
      .filter((c): c is CoursePickerItem => c !== undefined)
    onAdd(courses.map(c => ({ courseId: c.id, courseType: c.type })))
  }, [selectedCourseIds, allCourses, onAdd])

  // Suggested Next placeholder
  const renderSuggestedNext = () => {
    if (!showSuggestedNext) return null
    return (
      <div>
        <SectionHeader>Suggested Next</SectionHeader>
        <div
          className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-border bg-muted/30"
          data-testid="suggested-next-placeholder"
        >
          <Sparkles className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Upgrade to unlock AI suggestions
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              AI-powered course recommendations will appear here when available.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <PickerSkeleton />
  }

  return (
    <div className={cn('space-y-3', className)} data-testid="inline-course-picker">
      {/* Search Bar */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search courses by title or author..."
          aria-label="Search courses"
          className="pl-9"
          autoFocus
        />
      </div>

      {/* Selected count (multi-select) */}
      {mode === 'multiSelect' && selectedCourseIds.length > 0 && (
        <div
          className="text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          data-testid="selected-count"
        >
          <span className="font-medium text-foreground">{selectedCourseIds.length}</span>{' '}
          {selectedCourseIds.length === 1 ? 'course' : 'courses'} selected
        </div>
      )}

      {/* Selected Courses reorderable section (multi-select, DnD) */}
      {mode === 'multiSelect' && selectedCourseIds.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div data-testid="selected-courses-section">
            <SectionHeader>Selected Courses</SectionHeader>
            <SortableContext items={selectedCourseIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {selectedCourses.map((course, index) => (
                  <SortableCourseRow
                    key={course.id}
                    course={course}
                    position={index + 1}
                    index={index}
                    total={selectedCourseIds.length}
                    onToggle={handleToggle}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                  />
                ))}
              </div>
            </SortableContext>
          </div>

          <DragOverlay>
            {dragActiveCourse ? (
              <div className="flex items-center gap-3 rounded-lg border border-brand bg-card px-3 py-2.5 shadow-xl">
                <GripVertical className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums">
                  {dragActivePosition}
                </span>
                <BookOpen className="size-4 text-brand" aria-hidden="true" />
                <span className="flex-1 truncate text-sm font-medium">{dragActiveCourse.name}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Scrollable course list */}
      <div
        className="space-y-1 overflow-y-auto"
        style={{ maxHeight }}
        role="list"
        aria-label="Available courses"
        data-testid="course-list"
      >
        {importedCourses.length === 0 && !search.trim() ? (
          <div className="py-10 text-center" data-testid="no-courses">
            <BookOpen className="size-8 mx-auto mb-3 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No courses yet</p>
            <p className="text-sm text-muted-foreground mt-1.5">
              Import your first course to build a learning track.
            </p>
          </div>
        ) : !hasCourses && !search.trim() ? (
          <div
            className="py-8 text-center text-sm text-muted-foreground"
            data-testid="all-excluded"
          >
            All courses are already in this path.
          </div>
        ) : filteredCourses.length === 0 && search.trim() ? (
          <div className="py-8 text-center text-sm text-muted-foreground" data-testid="no-results">
            No matching courses found for &quot;{search}&quot;.
          </div>
        ) : (
          <>
            {/* Recently Imported section */}
            {showRecentlyImported && recentlyImportedFiltered.length > 0 && (
              <div data-testid="recently-imported-section">
                <SectionHeader count={recentlyImportedFiltered.length}>
                  Recently Imported
                </SectionHeader>
                {recentlyImportedFiltered.map(course => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    isSelected={selectedCourseIds.includes(course.id)}
                    mode={mode}
                    onToggle={handleToggle}
                    onAdd={handleAdd}
                  />
                ))}
              </div>
            )}

            {/* Suggested Next section (placeholder) */}
            {showSuggestedNext && renderSuggestedNext()}

            {/* All available courses */}
            {otherFiltered.length > 0 && (
              <div data-testid="all-courses-section">
                {showRecentlyImported && recentlyImportedFiltered.length > 0 && (
                  <SectionHeader>All Courses</SectionHeader>
                )}
                {otherFiltered.map(course => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    isSelected={selectedCourseIds.includes(course.id)}
                    mode={mode}
                    onToggle={handleToggle}
                    onAdd={handleAdd}
                  />
                ))}
              </div>
            )}

            {/* If all filtered courses are in Recently Imported */}
            {recentlyImportedFiltered.length > 0 &&
              otherFiltered.length === 0 &&
              !search.trim() && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  All imported courses are shown above.
                </div>
              )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {mode === 'multiSelect' && selectedCourseIds.length > 0 && !hideConfirmButton && (
          <Button
            variant="brand"
            size="sm"
            onClick={handleConfirmMultiSelect}
            data-testid="confirm-multi-select"
            className="rounded-xl"
          >
            Add {selectedCourseIds.length} {selectedCourseIds.length === 1 ? 'Course' : 'Courses'}
          </Button>
        )}

        {showImportAction && onImportCourse && (
          <Button
            variant="outline"
            size="sm"
            onClick={onImportCourse}
            data-testid="import-course-action"
            className="rounded-xl"
          >
            <Plus className="size-3.5 mr-1.5" aria-hidden="true" />
            Import new course
          </Button>
        )}

        {showBatchImportAction && onBatchImport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchImport}
            data-testid="import-multiple-action"
            className="rounded-xl"
          >
            <Folders className="size-3.5 mr-1.5" aria-hidden="true" />
            Import multiple
          </Button>
        )}
      </div>
    </div>
  )
}
