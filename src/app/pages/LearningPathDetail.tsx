import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { motion } from 'motion/react'
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
  ArrowRight,
  GripVertical,
  X,
  Plus,
  BookOpen,
  ChevronRight,
  Sparkles,
  Loader2,
  Settings,
  Clock,
  CheckCircle2,
  Check,
  Lock,
  Flame,
  Download,
  Import,
  AlertCircle,
  LayoutTemplate,
} from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Card, CardContent } from '@/app/components/ui/card'
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
import { cn } from '@/app/components/ui/utils'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { TrailMap } from '@/app/components/figma/TrailMap'
import { MoveUpDownButtons } from '@/app/components/figma/MoveUpDownButtons'
import { InlineCoursePicker } from '@/app/components/figma/InlineCoursePicker'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { CourseTypeBadge } from '@/app/components/shared/CourseTypeBadge'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { usePathProgress } from '@/app/hooks/usePathProgress'
import { useImportWizardTrigger } from '@/app/hooks/useImportWizardTrigger'
import { useLoadCourseThumbnails } from '@/app/hooks/useLoadCourseThumbnails'
// db import removed (E89-S01) — catalog courses table dropped
import { staggerContainer, fadeUp } from '@/lib/motion'
import { toast } from 'sonner'
import {
  isOrderSuggestionAvailable,
  suggestPathOrder,
  type OrderSuggestionResult,
} from '@/ai/learningPath/suggestOrder'
import type { LearningPathEntry, Course } from '@/data/types'

// --- Sortable Course Row ---

function SortableCourseRow({
  entry,
  course,
  authorName,
  thumbnailUrl,
  completionPct,
  index,
  totalCount,
  isAIGenerated,
  onMoveUp,
  onMoveDown,
  onRemove,
  registerMoveUpRef,
  registerMoveDownRef,
}: {
  entry: LearningPathEntry
  course: { name: string; type: 'imported' | 'catalog' } | undefined
  authorName: string | undefined
  thumbnailUrl: string | undefined
  completionPct: number
  index: number
  totalCount: number
  isAIGenerated: boolean
  onMoveUp: (index: number) => void
  onMoveDown: (index: number) => void
  onRemove: (courseId: string) => void
  registerMoveUpRef: (courseId: string, el: HTMLButtonElement | null) => void
  registerMoveDownRef: (courseId: string, el: HTMLButtonElement | null) => void
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
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
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
                <img src={thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
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
                <CourseTypeBadge courseType={entry.courseType} />
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
              <div className="flex items-center gap-2 mt-0.5">
                {authorName && (
                  <span className="text-xs text-muted-foreground truncate">{authorName}</span>
                )}
                {completionPct === 0 ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider border-muted-foreground/30 text-muted-foreground"
                  >
                    Not Started
                  </Badge>
                ) : completionPct >= 100 ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wider border-success/30 text-success"
                  >
                    Completed
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">{completionPct}% complete</span>
                )}
              </div>
            </div>

            {/* Keyboard / single-pointer reorder buttons (WCAG 2.5.7) */}
            <MoveUpDownButtons
              index={index}
              total={totalCount}
              itemLabel={course?.name || 'course'}
              onMoveUp={() => onMoveUp(index)}
              onMoveDown={() => onMoveDown(index)}
              size="sm"
              upRef={el => registerMoveUpRef(entry.courseId, el)}
              downRef={el => registerMoveDownRef(entry.courseId, el)}
              testIdPrefix={`path-course-row-${index}-move`}
            />

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

// --- Main Component ---

export function LearningPathDetail() {
  const { pathId } = useParams<{ pathId: string }>()
  const {
    paths,
    entries,
    loadPaths,
    addCourseToPath,
    reorderCourse,
    removeCourseFromPath,
    getEntriesForPath,
    applyAIOrder,
  } = useLearningPathStore()
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const { authors, loadAuthors } = useAuthorStore()

  const [isLoaded, setIsLoaded] = useState(false)
  const catalogCourses: Course[] = [] // Catalog courses table dropped (E89-S01)
  const [pickerOpen, setPickerOpen] = useState(false)

  // Import wizard trigger (singleton guard pattern)
  const {
    trigger: importTrigger,
    isOpen: importWizardOpen,
    setIsOpen: setImportWizardOpen,
  } = useImportWizardTrigger()

  // "Keep panel open" toggle persisted in localStorage
  const [keepPanelOpen, setKeepPanelOpen] = useState(() => {
    try {
      return localStorage.getItem('keepCoursePanelOpen') === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('keepCoursePanelOpen', String(keepPanelOpen))
    } catch {
      // silent-catch-ok: localStorage may be unavailable
    }
  }, [keepPanelOpen])

  // Handle import wizard click with singleton guard (R10)
  const handleImportClick = useCallback(
    () => importTrigger(pathId ?? null),
    [importTrigger, pathId]
  )

  // AI Suggest Order state (E26-S04)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [orderSuggestion, setOrderSuggestion] = useState<OrderSuggestionResult | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // Load all data on mount
  useEffect(() => {
    let ignore = false
    Promise.all([
      loadPaths(),
      loadImportedCourses(),
      loadAuthors(),
      // Catalog courses table dropped (E89-S01) — no catalog load needed
    ])
      .then(() => {
        if (!ignore) setIsLoaded(true)
      })
      .catch(err => {
        console.error('[LearningPathDetail] Failed to load:', err)
        toast.error('Failed to load path data')
        if (!ignore) setIsLoaded(true)
      })
    return () => {
      ignore = true
    }
  }, [loadPaths, loadImportedCourses, loadAuthors])

  // Load thumbnail URLs when imported courses are available
  useLoadCourseThumbnails(importedCourses, loadThumbnailUrls)

  // Find the path
  const path = useMemo(() => paths.find(p => p.id === pathId), [paths, pathId])

  // Get sorted entries for this path
  const courseEntries = useMemo(
    () => (pathId ? getEntriesForPath(pathId) : []),
    [pathId, entries, getEntriesForPath]
  )

  // Gap entry detection
  const gapCount = useMemo(
    () => courseEntries.filter(e => e.courseId === '').length,
    [courseEntries]
  )
  const matchedCount = useMemo(() => courseEntries.length - gapCount, [courseEntries, gapCount])

  // Set of course IDs already in path (excludes gap entries)
  const existingCourseIds = useMemo(
    () => new Set(courseEntries.map(e => e.courseId).filter(id => id !== '')),
    [courseEntries]
  )

  // Real progress tracking from contentProgress (catalog) + progress table (imported)
  const pathProgress = usePathProgress(courseEntries)

  // Build course info lookup — uses real progress data
  const courseInfo = useMemo(() => {
    const map = new Map<
      string,
      { name: string; type: 'imported' | 'catalog'; authorName?: string; completionPct: number }
    >()

    for (const ic of importedCourses) {
      const authorName = ic.authorId ? authors.find(a => a.id === ic.authorId)?.name : undefined
      const cpInfo = pathProgress.courseProgress.get(ic.id)
      map.set(ic.id, {
        name: ic.name,
        type: 'imported',
        authorName,
        completionPct: cpInfo?.completionPct ?? 0,
      })
    }

    for (const cc of catalogCourses) {
      const authorName = authors.find(a => a.id === cc.authorId)?.name
      const cpInfo = pathProgress.courseProgress.get(cc.id)
      map.set(cc.id, {
        name: cc.title,
        type: 'catalog',
        authorName,
        completionPct: cpInfo?.completionPct ?? 0,
      })
    }

    return map
  }, [importedCourses, catalogCourses, authors, pathProgress.courseProgress])

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

  // Focus restoration after Move Up/Down (E66-S01, WCAG 2.5.7)
  // Refs keyed by courseId so they survive index changes during re-render.
  const moveUpRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())
  const moveDownRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())
  const registerMoveUpRef = useCallback((courseId: string, el: HTMLButtonElement | null) => {
    if (el) moveUpRefs.current.set(courseId, el)
    else moveUpRefs.current.delete(courseId)
  }, [])
  const registerMoveDownRef = useCallback((courseId: string, el: HTMLButtonElement | null) => {
    if (el) moveDownRefs.current.set(courseId, el)
    else moveDownRefs.current.delete(courseId)
  }, [])

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0 && pathId) {
        const courseId = courseEntries[index]?.courseId
        reorderCourse(pathId, index, index - 1)
        if (courseId) {
          requestAnimationFrame(() => {
            moveUpRefs.current.get(courseId)?.focus()
          })
        }
      }
    },
    [courseEntries, pathId, reorderCourse]
  )

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < courseEntries.length - 1 && pathId) {
        const courseId = courseEntries[index]?.courseId
        reorderCourse(pathId, index, index + 1)
        if (courseId) {
          requestAnimationFrame(() => {
            moveDownRefs.current.get(courseId)?.focus()
          })
        }
      }
    },
    [courseEntries, pathId, reorderCourse]
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

  // Handle course add from the inline course picker (single-select mode)
  const handlePickerAddCourse = useCallback(
    (courses: Array<{ courseId: string; courseType: 'imported' | 'catalog' }>) => {
      if (!pathId || courses.length === 0) return
      const course = courses[0]
      addCourseToPath(pathId, course.courseId, course.courseType).catch(() => {
        toast.error('Failed to add course')
      })
      if (!keepPanelOpen) {
        setPickerOpen(false)
      }
    },
    [pathId, addCourseToPath, keepPanelOpen]
  )

  // AI Suggest Order handler (E26-S04)
  const handleSuggestOrder = useCallback(async () => {
    if (!pathId || courseEntries.length < 2) return

    setIsSuggesting(true)
    try {
      // Build course name and tag maps
      const courseNames = new Map<string, string>()
      const courseTags = new Map<string, string[]>()

      for (const ic of importedCourses) {
        courseNames.set(ic.id, ic.name)
        courseTags.set(ic.id, ic.tags || [])
      }

      for (const cc of catalogCourses) {
        courseNames.set(cc.id, cc.title)
        courseTags.set(cc.id, [])
      }

      const result = await suggestPathOrder(courseEntries, courseNames, courseTags)
      setOrderSuggestion(result)
      setConfirmDialogOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to suggest order')
    } finally {
      setIsSuggesting(false)
    }
  }, [pathId, courseEntries, importedCourses, catalogCourses])

  const handleAcceptOrder = useCallback(async () => {
    if (!pathId || !orderSuggestion) return

    try {
      await applyAIOrder(pathId, orderSuggestion.entries)
      toast.success('AI-suggested order applied')
      setConfirmDialogOpen(false)
      setOrderSuggestion(null)
    } catch {
      toast.error('Failed to apply suggested order')
    }
  }, [pathId, orderSuggestion, applyAIOrder])

  // Derived data — must be above early returns to satisfy React Rules of Hooks
  const completedEntries = useMemo(
    () => courseEntries.filter(e => (courseInfo.get(e.courseId)?.completionPct ?? 0) >= 100),
    [courseEntries, courseInfo]
  )
  const currentEntry = useMemo(
    () =>
      courseEntries.find(e => {
        const pct = courseInfo.get(e.courseId)?.completionPct ?? 0
        return pct > 0 && pct < 100
      }) ??
      (courseEntries.length > completedEntries.length
        ? courseEntries[completedEntries.length]
        : null),
    [courseEntries, courseInfo, completedEntries.length]
  )
  const upcomingEntries = useMemo(
    () =>
      courseEntries.filter(e => {
        const pct = courseInfo.get(e.courseId)?.completionPct ?? 0
        return pct === 0 && e !== currentEntry
      }),
    [courseEntries, courseInfo, currentEntry]
  )
  const currentIndex = currentEntry ? courseEntries.indexOf(currentEntry) : -1
  const [showReorderList, setShowReorderList] = useState(false)

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
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </DelayedFallback>
    )
  }

  // Path not found
  if (!path) {
    return (
      <div className="space-y-6">
        <Link
          to="/learning-paths"
          className="inline-flex items-center gap-2 text-brand font-medium hover:-translate-x-1 transition-transform"
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
    <>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-8"
      >
        {/* Back link */}
        <motion.div variants={fadeUp}>
          <Link
            to="/learning-paths"
            className="inline-flex items-center gap-2 text-brand font-medium hover:-translate-x-1 transition-transform"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Learning Paths
          </Link>
        </motion.div>

        {/* Template banner — for paths forked from a template */}
        {path.forkedFrom && (
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-soft/50 border border-brand-soft mb-4">
              <LayoutTemplate className="w-5 h-5 text-brand-soft-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-brand-soft-foreground">
                  This path was created from a template
                </p>
              </div>
              <Button variant="brand-outline" size="sm" asChild>
                <Link to={`/learning-paths/templates/${path.forkedFrom}`}>View template</Link>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Gap entry summary — for paths with unmatched entries */}
        {gapCount > 0 && (
          <motion.div variants={fadeUp}>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30 mb-4">
              <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {matchedCount} of {courseEntries.length} courses matched from your library
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Import the remaining {gapCount} {gapCount === 1 ? 'course' : 'courses'} to
                  complete this path.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col md:flex-row md:items-end justify-between gap-[var(--content-gap)]"
        >
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight font-display mb-4">
              {path.name}
            </h1>
            {path.description && (
              <p className="text-muted-foreground leading-relaxed mb-4">{path.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground font-medium text-sm">
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-brand" aria-hidden="true" />
                {pathProgress.completedLessons} lessons completed
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-brand" aria-hidden="true" />
                {pathProgress.completedCourses}/{pathProgress.totalCourses} courses done
              </span>
              {pathProgress.estimatedRemainingHours > 0 && (
                <span className="flex items-center gap-1.5">
                  <Flame className="size-4 text-brand" aria-hidden="true" />~
                  {pathProgress.estimatedRemainingHours}h remaining
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="block text-5xl font-black text-brand mb-1">
              {pathProgress.completionPct}%
            </span>
            <span className="text-sm font-bold text-muted-foreground tracking-widest uppercase">
              Completed
            </span>
          </div>
        </motion.div>

        {/* Trail Map */}
        {courseEntries.length > 0 && (
          <motion.div variants={fadeUp}>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 px-2">
              Path Journey
            </h2>
            <TrailMap
              totalCourses={courseEntries.length}
              completedCount={completedEntries.length}
              currentIndex={currentIndex}
            />
          </motion.div>
        )}

        {/* Empty state */}
        {courseEntries.length === 0 ? (
          <motion.div variants={fadeUp} className="space-y-6">
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Add courses to build your learning path. You can reorder them by dragging or using the arrow buttons."
              actionLabel="Add Course"
              onAction={() => setPickerOpen(true)}
            />
            {/* Collapsible course picker — rendered here so it mounts even in empty state (BLOCKER 2) */}
            <Collapsible open={pickerOpen} onOpenChange={setPickerOpen} className="space-y-3">
              <CollapsibleContent id="inline-course-picker-panel" className="space-y-3">
                {/* Keep panel open toggle */}
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={keepPanelOpen}
                    onChange={e => setKeepPanelOpen(e.target.checked)}
                    className="rounded border-muted-foreground/30"
                    data-testid="keep-panel-open-toggle"
                  />
                  Keep panel open
                </label>
                <InlineCoursePicker
                  mode="singleSelect"
                  excludeCourseIds={existingCourseIds}
                  onAdd={handlePickerAddCourse}
                />
              </CollapsibleContent>
            </Collapsible>
            <div className="flex justify-center mt-4">
              <Button
                variant="brand-outline"
                onClick={handleImportClick}
                data-testid="import-course-button"
                className={pickerOpen ? 'hidden' : ''}
              >
                <Download className="size-4 mr-2" aria-hidden="true" />
                Import Course
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Primary Content */}
            <div className="lg:col-span-8 space-y-12">
              {/* Hero: Now Learning */}
              {currentEntry &&
                (() => {
                  const info = courseInfo.get(currentEntry.courseId)
                  const pct = info?.completionPct ?? 0
                  return (
                    <motion.section variants={fadeUp}>
                      <Card className="overflow-hidden shadow-xl border-brand/20 rounded-2xl">
                        <div className="flex flex-col md:flex-row min-h-[280px]">
                          {/* Thumbnail */}
                          <div className="md:w-5/12 relative bg-muted">
                            {thumbnailUrls[currentEntry.courseId] ? (
                              <img
                                src={thumbnailUrls[currentEntry.courseId]}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-full min-h-[200px] flex items-center justify-center bg-gradient-to-br from-brand/10 to-brand/30">
                                <BookOpen className="size-16 text-brand/40" aria-hidden="true" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                              <Badge className="bg-brand/80 backdrop-blur-sm text-brand-foreground text-xs uppercase tracking-wider">
                                Now Learning
                              </Badge>
                            </div>
                          </div>
                          {/* Info */}
                          <div className="md:w-7/12 p-8 flex flex-col justify-between">
                            <div>
                              <h3 className="text-2xl md:text-3xl font-bold mb-2">
                                {info?.name || 'Unknown Course'}
                              </h3>
                              <p className="text-muted-foreground mb-6 flex items-center gap-2 font-medium">
                                {info?.authorName && <>{info.authorName} • </>}
                                <span className="text-brand">{pct}% Complete</span>
                              </p>
                              <div className="w-full bg-muted h-2.5 rounded-full mb-6">
                                <div
                                  className="bg-brand h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <Button
                              variant="brand"
                              className="w-full md:w-fit px-8 py-4 shadow-lg shadow-brand/20"
                              asChild
                            >
                              <Link to={`/courses/${currentEntry.courseId}`}>
                                Continue Learning
                                <ArrowRight className="size-4 ml-2" aria-hidden="true" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </motion.section>
                  )
                })()}

              {/* Completed Courses Strip */}
              {completedEntries.length > 0 && (
                <motion.section variants={fadeUp}>
                  <h2 className="text-xl font-bold mb-6 px-2">Completed Courses</h2>
                  <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-thin">
                    {completedEntries.map(entry => {
                      const info = courseInfo.get(entry.courseId)
                      return (
                        <div
                          key={entry.courseId}
                          className="min-w-[180px] bg-card p-4 rounded-2xl shadow-sm border border-border flex-shrink-0"
                        >
                          <div className="relative w-full h-24 rounded-xl overflow-hidden mb-3 bg-muted">
                            {thumbnailUrls[entry.courseId] ? (
                              <img
                                src={thumbnailUrls[entry.courseId]}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen
                                  className="size-6 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </div>
                            )}
                            <div className="absolute top-2 right-2 bg-success text-success-foreground rounded-full p-0.5">
                              <Check className="size-3.5" aria-hidden="true" />
                            </div>
                          </div>
                          <h4 className="font-bold text-sm leading-tight line-clamp-2">
                            {info?.name || 'Unknown Course'}
                          </h4>
                        </div>
                      )
                    })}
                  </div>
                </motion.section>
              )}

              {/* Full Reorder List (togglable) */}
              {showReorderList && (
                <motion.section variants={fadeUp}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">All Courses (Reorder)</h2>
                    <Button variant="outline" size="sm" onClick={() => setShowReorderList(false)}>
                      Done Reordering
                    </Button>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={courseEntries.map(e => e.courseId)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div
                        className="space-y-3"
                        role="list"
                        aria-label="Courses in this learning path"
                        data-testid="path-course-list"
                      >
                        {courseEntries.map((entry, index) => {
                          // Gap entry: courseId is empty — render as non-sortable gap card
                          if (entry.courseId === '') {
                            const matchTitleMatch =
                              entry.justification?.match(/\[Search for: (.+)\]$/)
                            const searchTerm = matchTitleMatch ? matchTitleMatch[1] : undefined
                            const justification =
                              entry.justification?.replace(/\s*\[Search for: .+\]$/, '') ||
                              undefined
                            return (
                              <div
                                key={entry.id}
                                className="flex items-start gap-4 p-4 rounded-xl border-2 border-dashed border-warning/40 bg-warning/5"
                                role="listitem"
                              >
                                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-warning/20 flex items-center justify-center text-sm font-semibold text-warning">
                                  {index + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm">
                                    {justification || searchTerm || `Course ${index + 1}`}
                                  </h4>
                                  {justification && justification !== searchTerm && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {justification}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-warning/60 text-warning"
                                    >
                                      <AlertCircle className="w-3 h-3 mr-1" />
                                      Not in your library
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                      // Open the add-course picker dialog
                                      setPickerOpen(true)
                                    }}
                                  >
                                    <Import className="w-3.5 h-3.5 mr-1" />
                                    Find this course
                                  </Button>
                                </div>
                              </div>
                            )
                          }

                          const info = courseInfo.get(entry.courseId)
                          return (
                            <SortableCourseRow
                              key={entry.courseId}
                              entry={entry}
                              course={info}
                              authorName={info?.authorName}
                              thumbnailUrl={thumbnailUrls[entry.courseId]}
                              completionPct={info?.completionPct ?? 0}
                              index={index}
                              totalCount={courseEntries.length}
                              isAIGenerated={path.isAIGenerated}
                              onMoveUp={handleMoveUp}
                              onMoveDown={handleMoveDown}
                              onRemove={handleRemove}
                              registerMoveUpRef={registerMoveUpRef}
                              registerMoveDownRef={registerMoveDownRef}
                            />
                          )
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </motion.section>
              )}
            </div>

            {/* Right Column: Sidebar */}
            <aside className="lg:col-span-4 space-y-8">
              {/* Add Course collapsible panel */}
              <Collapsible open={pickerOpen} onOpenChange={setPickerOpen} className="space-y-3">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="brand"
                    data-testid="add-course-button"
                    className="w-full"
                    aria-expanded={pickerOpen}
                    aria-controls="inline-course-picker-panel"
                  >
                    <Plus className="size-4 mr-2" aria-hidden="true" />
                    {pickerOpen ? 'Cancel' : 'Add Course'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent id="inline-course-picker-panel" className="space-y-3">
                  {/* Keep panel open toggle */}
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={keepPanelOpen}
                      onChange={e => setKeepPanelOpen(e.target.checked)}
                      className="rounded border-muted-foreground/30"
                      data-testid="keep-panel-open-toggle"
                    />
                    Keep panel open
                  </label>
                  <InlineCoursePicker
                    mode="singleSelect"
                    excludeCourseIds={existingCourseIds}
                    onAdd={handlePickerAddCourse}
                  />
                </CollapsibleContent>
              </Collapsible>

              <Button
                variant="brand-outline"
                onClick={handleImportClick}
                data-testid="import-course-button"
                className={pickerOpen ? 'hidden' : 'w-full'}
              >
                <Download className="size-4 mr-2" aria-hidden="true" />
                Import Course
              </Button>

              {/* Coming Up Next */}
              {upcomingEntries.length > 0 && (
                <Card className="rounded-2xl">
                  <CardContent className="p-8">
                    <h3 className="text-lg font-bold mb-6">Coming Up Next</h3>
                    <div className="space-y-6">
                      {upcomingEntries.slice(0, 3).map((entry, i) => {
                        const info = courseInfo.get(entry.courseId)
                        return (
                          <div
                            key={entry.courseId}
                            className={cn('flex items-start gap-4', i > 0 && 'opacity-60')}
                          >
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Lock className="size-4 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <div>
                              <h4 className="font-bold text-foreground">
                                {info?.name || 'Unknown Course'}
                              </h4>
                              {info?.authorName && (
                                <p className="text-xs text-muted-foreground font-medium mt-1">
                                  {info.authorName}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      className="w-full mt-8"
                      onClick={() => setShowReorderList(v => !v)}
                    >
                      {showReorderList ? 'Hide Curriculum' : 'View Full Curriculum'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Suggest Order */}
              {courseEntries.length >= 2 &&
                (isOrderSuggestionAvailable() ? (
                  <button
                    className="w-full bg-brand-soft p-6 rounded-2xl border border-brand/20 flex items-center justify-between group hover:bg-brand-muted transition-all text-left"
                    onClick={handleSuggestOrder}
                    disabled={isSuggesting}
                    data-testid="suggest-order-button"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-card flex items-center justify-center text-brand shadow-sm">
                        {isSuggesting ? (
                          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Sparkles className="size-5" aria-hidden="true" />
                        )}
                      </div>
                      <span className="font-bold text-foreground">
                        {isSuggesting ? 'Analyzing...' : 'Suggest Order'}
                      </span>
                    </div>
                    <ChevronRight
                      className="size-5 text-muted-foreground group-hover:text-brand transition-colors"
                      aria-hidden="true"
                    />
                  </button>
                ) : (
                  <Link
                    to="/settings"
                    className="w-full block bg-muted p-6 rounded-2xl border border-border"
                    data-testid="suggest-order-settings-link"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-card flex items-center justify-center text-muted-foreground shadow-sm">
                        <Settings className="size-5" aria-hidden="true" />
                      </div>
                      <span className="font-medium text-muted-foreground">
                        Configure AI for ordering
                      </span>
                    </div>
                  </Link>
                ))}

              {/* Daily Tip Card */}
              <div className="p-6 bg-gradient-to-br from-brand to-brand-hover rounded-2xl text-brand-foreground">
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full mb-4 inline-block">
                  Study Tip
                </span>
                <h4 className="font-bold text-lg mb-2 italic">
                  &quot;Focus on one concept at a time.&quot;
                </h4>
                <p className="text-brand-foreground/80 text-sm leading-relaxed">
                  Multitasking while learning reduces retention. Master each course before moving to
                  the next.
                </p>
              </div>
            </aside>
          </div>
        )}
      </motion.div>

      {/* Import Wizard Dialog (R2, R3) */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        targetPathId={pathId}
      />

      {/* AI Order Suggestion Confirmation Dialog (E26-S04) */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <Sparkles className="size-5 text-brand" aria-hidden="true" />
                AI-Suggested Order
              </span>
            </DialogTitle>
            <DialogDescription>
              Review the suggested course sequence. Accepting will reorder all courses and set AI
              justifications.
            </DialogDescription>
          </DialogHeader>

          {orderSuggestion && (
            <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6 space-y-3">
              {/* Overall rationale */}
              <div className="rounded-xl border border-brand/20 bg-brand-soft/30 p-3">
                <p className="text-sm text-muted-foreground italic">{orderSuggestion.rationale}</p>
              </div>

              {/* Suggested order list */}
              <div
                className="space-y-2"
                role="list"
                aria-label="Suggested course order"
                data-testid="suggest-order-preview"
              >
                {orderSuggestion.entries.map(entry => {
                  const info = courseInfo.get(entry.courseId)
                  return (
                    <div
                      key={entry.courseId}
                      role="listitem"
                      className="flex items-start gap-3 p-3 rounded-lg border border-border"
                    >
                      <div className="size-7 shrink-0 rounded-full bg-brand-soft flex items-center justify-center text-sm font-semibold text-brand-soft-foreground">
                        {entry.position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {info?.name || 'Unknown Course'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 italic leading-relaxed">
                          {entry.justification}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false)
                setOrderSuggestion(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="brand" onClick={handleAcceptOrder} data-testid="accept-order-button">
              Accept Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
