import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowLeft,
  GripVertical,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Search,
  BookOpen,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import { Skeleton } from '@/app/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { db } from '@/db'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { toast } from 'sonner'
import type { LearningPathEntry, Course } from '@/data/types'

// --- Sortable Course Row ---

function SortableCourseRow({
  entry,
  course,
  authorName,
  thumbnailUrl,
  index,
  totalCount,
  isAIGenerated,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  entry: LearningPathEntry
  course: { name: string; type: 'imported' | 'catalog' } | undefined
  authorName: string | undefined
  thumbnailUrl: string | undefined
  index: number
  totalCount: number
  isAIGenerated: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onRemove: (courseId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.courseId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const [justificationOpen, setJustificationOpen] = useState(false)

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      variants={fadeUp}
      custom={index}
      data-testid={`path-course-row-${index}`}
      className={isDragging ? 'z-50 relative' : ''}
    >
      <Card className={isDragging ? 'shadow-lg ring-2 ring-brand' : 'shadow-sm'}>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 p-4">
            {/* Drag handle */}
            <button
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-manipulation"
              aria-label={`Drag to reorder ${course?.name || 'course'}`}
              {...listeners}
            >
              <GripVertical className="size-5" aria-hidden="true" />
            </button>

            {/* Position badge */}
            <div className="size-8 shrink-0 rounded-full bg-brand-soft flex items-center justify-center text-sm font-semibold text-brand-soft-foreground">
              {entry.position}
            </div>

            {/* Thumbnail */}
            <div className="size-12 shrink-0 rounded-lg bg-muted overflow-hidden">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="size-full flex items-center justify-center">
                  <BookOpen className="size-5 text-muted-foreground" aria-hidden="true" />
                </div>
              )}
            </div>

            {/* Course info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-medium text-sm leading-tight truncate">
                  {course?.name || 'Unknown Course'}
                </h3>
                <Badge
                  variant="secondary"
                  className="shrink-0 text-[10px] uppercase tracking-wider"
                >
                  {entry.courseType === 'imported' ? 'Imported' : 'Catalog'}
                </Badge>
                {entry.isManuallyOrdered && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] uppercase tracking-wider border-info/30 text-info"
                    data-testid="manual-override-indicator"
                  >
                    Manual
                  </Badge>
                )}
              </div>
              {authorName && (
                <p className="text-xs text-muted-foreground truncate">{authorName}</p>
              )}
            </div>

            {/* Keyboard move buttons */}
            <div className="flex flex-col gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
                aria-label={`Move ${course?.name || 'course'} up`}
              >
                <ChevronUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => onMoveDown(index)}
                disabled={index === totalCount - 1}
                aria-label={`Move ${course?.name || 'course'} down`}
              >
                <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(entry.courseId)}
              aria-label={`Remove ${course?.name || 'course'} from path`}
              data-testid={`remove-course-${index}`}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {/* AI justification (collapsible) */}
          {isAIGenerated && entry.justification && (
            <Collapsible open={justificationOpen} onOpenChange={setJustificationOpen}>
              <div className="border-t border-border px-4 py-2">
                <CollapsibleTrigger asChild>
                  <button
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                    data-testid={`justification-toggle-${index}`}
                  >
                    <Sparkles className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
                    <span>Why this order?</span>
                    <ChevronRight
                      className={`size-3.5 shrink-0 transition-transform ${justificationOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p
                    className="text-xs text-muted-foreground mt-2 pl-5.5 pb-1 leading-relaxed italic"
                    data-testid={`course-justification-${index}`}
                  >
                    {entry.justification}
                  </p>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// --- Course Picker Dialog ---

function CoursePickerDialog({
  open,
  onOpenChange,
  pathId,
  existingCourseIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathId: string
  existingCourseIds: Set<string>
}) {
  const { importedCourses, thumbnailUrls } = useCourseImportStore()
  const { authors } = useAuthorStore()
  const addCourseToPath = useLearningPathStore(s => s.addCourseToPath)
  const [search, setSearch] = useState('')
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([])
  const [isAdding, setIsAdding] = useState<string | null>(null)

  // Load catalog courses when dialog opens
  useEffect(() => {
    if (open) {
      // silent-catch-ok — fallback to empty array if catalog unavailable
      db.courses.toArray().then(setCatalogCourses).catch(() => setCatalogCourses([]))
      setSearch('')
    }
  }, [open])

  // Combine imported and catalog courses, excluding those already in the path
  const availableCourses = useMemo(() => {
    const q = search.toLowerCase()
    const imported = importedCourses
      .filter(c => !existingCourseIds.has(c.id))
      .map(c => ({
        id: c.id,
        name: c.name,
        type: 'imported' as const,
        authorName: c.authorId ? authors.find(a => a.id === c.authorId)?.name : undefined,
        thumbnailUrl: thumbnailUrls[c.id],
      }))

    const catalog = catalogCourses
      .filter(c => !existingCourseIds.has(c.id))
      .map(c => ({
        id: c.id,
        name: c.title,
        type: 'catalog' as const,
        authorName: authors.find(a => a.id === c.authorId)?.name,
        thumbnailUrl: c.coverImage,
      }))

    const all = [...imported, ...catalog]

    if (!q) return all
    return all.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.authorName && c.authorName.toLowerCase().includes(q))
    )
  }, [importedCourses, catalogCourses, existingCourseIds, search, authors, thumbnailUrls])

  const handleAdd = useCallback(
    async (courseId: string, courseType: 'imported' | 'catalog') => {
      setIsAdding(courseId)
      try {
        await addCourseToPath(pathId, courseId, courseType)
        toast.success('Course added to path')
      } catch {
        toast.error('Failed to add course')
      } finally {
        setIsAdding(null)
      }
    },
    [pathId, addCourseToPath]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Course</DialogTitle>
          <DialogDescription>
            Select a course to add to this learning path.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search courses..."
            aria-label="Search courses to add"
            className="pl-9"
            autoFocus
          />
        </div>

        <div
          className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6 space-y-2"
          role="list"
          aria-label="Available courses"
        >
          {availableCourses.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {search.trim()
                ? 'No matching courses found.'
                : 'All courses are already in this path.'}
            </div>
          ) : (
            availableCourses.map(course => (
              <div
                key={course.id}
                role="listitem"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {/* Thumbnail */}
                <div className="size-10 shrink-0 rounded-md bg-muted overflow-hidden">
                  {course.thumbnailUrl ? (
                    <img
                      src={course.thumbnailUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
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
                      <span className="text-xs text-muted-foreground truncate">
                        {course.authorName}
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className="text-[10px] uppercase tracking-wider shrink-0"
                    >
                      {course.type === 'imported' ? 'Imported' : 'Catalog'}
                    </Badge>
                  </div>
                </div>

                {/* Add button */}
                <Button
                  variant="brand-outline"
                  size="sm"
                  onClick={() => handleAdd(course.id, course.type)}
                  disabled={isAdding === course.id}
                  aria-label={`Add ${course.name}`}
                >
                  {isAdding === course.id ? 'Adding...' : 'Add'}
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Component ---

export function LearningPathDetail() {
  const { pathId } = useParams<{ pathId: string }>()
  const {
    paths,
    entries,
    loadPaths,
    reorderCourse,
    removeCourseFromPath,
    getEntriesForPath,
  } = useLearningPathStore()
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const { authors, loadAuthors } = useAuthorStore()

  const [isLoaded, setIsLoaded] = useState(false)
  const [catalogCourses, setCatalogCourses] = useState<Course[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  // Load all data on mount
  useEffect(() => {
    let ignore = false
    Promise.all([
      loadPaths(),
      loadImportedCourses(),
      loadAuthors(),
      // silent-catch-ok — fallback to empty array if catalog unavailable
      db.courses.toArray().then(setCatalogCourses).catch(() => []),
    ]).then(() => {
      if (!ignore) setIsLoaded(true)
    }).catch(err => {
      console.error('[LearningPathDetail] Failed to load:', err)
      toast.error('Failed to load path data')
      if (!ignore) setIsLoaded(true)
    })
    return () => {
      ignore = true
    }
  }, [loadPaths, loadImportedCourses, loadAuthors])

  // Load thumbnail URLs when imported courses are available
  useEffect(() => {
    if (importedCourses.length > 0) {
      loadThumbnailUrls(importedCourses.map(c => c.id))
    }
  }, [importedCourses, loadThumbnailUrls])

  // Find the path
  const path = useMemo(() => paths.find(p => p.id === pathId), [paths, pathId])

  // Get sorted entries for this path
  const courseEntries = useMemo(
    () => (pathId ? getEntriesForPath(pathId) : []),
    [pathId, entries, getEntriesForPath]
  )

  // Set of course IDs already in path
  const existingCourseIds = useMemo(
    () => new Set(courseEntries.map(e => e.courseId)),
    [courseEntries]
  )

  // Build course info lookup
  const courseInfo = useMemo(() => {
    const map = new Map<string, { name: string; type: 'imported' | 'catalog'; authorName?: string }>()

    for (const ic of importedCourses) {
      const authorName = ic.authorId ? authors.find(a => a.id === ic.authorId)?.name : undefined
      map.set(ic.id, { name: ic.name, type: 'imported', authorName })
    }

    for (const cc of catalogCourses) {
      const authorName = authors.find(a => a.id === cc.authorId)?.name
      map.set(cc.id, { name: cc.title, type: 'catalog', authorName })
    }

    return map
  }, [importedCourses, catalogCourses, authors])

  // DnD sensors (same pattern as AILearningPath)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (over && active.id !== over.id && pathId) {
        const oldIndex = courseEntries.findIndex(c => c.courseId === active.id)
        const newIndex = courseEntries.findIndex(c => c.courseId === over.id)
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderCourse(pathId, oldIndex, newIndex)
        }
      }
    },
    [courseEntries, pathId, reorderCourse]
  )

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0 && pathId) {
        reorderCourse(pathId, index, index - 1)
      }
    },
    [pathId, reorderCourse]
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < courseEntries.length - 1 && pathId) {
        reorderCourse(pathId, index, index + 1)
      }
    },
    [courseEntries.length, pathId, reorderCourse]
  )

  const handleRemove = useCallback(
    (courseId: string) => {
      if (pathId) {
        removeCourseFromPath(pathId, courseId)
        toast.success('Course removed from path')
      }
    },
    [pathId, removeCourseFromPath]
  )

  // Loading state
  if (!isLoaded) {
    return (
      <DelayedFallback>
        <div className="space-y-6 max-w-3xl mx-auto">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-96" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-[24px]" />
          ))}
        </div>
      </DelayedFallback>
    )
  }

  // Path not found
  if (!path) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Link
          to="/learning-paths"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Learning Paths
        </Link>
        <EmptyState
          icon={BookOpen}
          title="Path not found"
          description="This learning path does not exist or has been deleted."
          actionLabel="View All Paths"
          onAction={() => {
            window.location.href = '/learning-paths'
          }}
        />
      </div>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-3xl mx-auto"
      >
        {/* Back link */}
        <motion.div variants={fadeUp}>
          <Link
            to="/learning-paths"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Learning Paths
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight font-display">{path.name}</h1>
              {path.isAIGenerated && (
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  AI Generated
                </Badge>
              )}
            </div>
            {path.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{path.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {courseEntries.length} {courseEntries.length === 1 ? 'course' : 'courses'}
            </p>
          </div>
          <Button
            variant="brand"
            onClick={() => setPickerOpen(true)}
            data-testid="add-course-button"
          >
            <Plus className="size-4 mr-2" aria-hidden="true" />
            Add Course
          </Button>
        </motion.div>

        {/* Course list */}
        {courseEntries.length === 0 ? (
          <motion.div variants={fadeUp}>
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Add courses to build your learning path. You can reorder them by dragging or using the arrow buttons."
              actionLabel="Add Course"
              onAction={() => setPickerOpen(true)}
            />
          </motion.div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={courseEntries.map(e => e.courseId)}
              strategy={verticalListSortingStrategy}
            >
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-3"
                role="list"
                aria-label="Courses in this learning path"
                data-testid="path-course-list"
              >
                {courseEntries.map((entry, index) => {
                  const info = courseInfo.get(entry.courseId)
                  return (
                    <SortableCourseRow
                      key={entry.courseId}
                      entry={entry}
                      course={info}
                      authorName={info?.authorName}
                      thumbnailUrl={thumbnailUrls[entry.courseId]}
                      index={index}
                      totalCount={courseEntries.length}
                      isAIGenerated={path.isAIGenerated}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onRemove={handleRemove}
                    />
                  )
                })}
              </motion.div>
            </SortableContext>
          </DndContext>
        )}
      </motion.div>

      {/* Course Picker Dialog */}
      <CoursePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        pathId={pathId!}
        existingCourseIds={existingCourseIds}
      />
    </MotionConfig>
  )
}
