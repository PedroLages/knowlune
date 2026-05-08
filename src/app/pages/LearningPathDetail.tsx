import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
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
  X,
  Plus,
  BookOpen,
  ChevronRight,
  Sparkles,
  Download,
  AlertCircle,
  LayoutTemplate,
  Check,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible'
import { EmptyState } from '@/app/components/EmptyState'
import { DelayedFallback } from '@/app/components/DelayedFallback'
import { MoveUpDownButtons } from '@/app/components/figma/MoveUpDownButtons'
import { InlineCoursePicker } from '@/app/components/figma/InlineCoursePicker'
import { ImportWizardDialog } from '@/app/components/figma/ImportWizardDialog'
import { CourseTypeBadge } from '@/app/components/shared/CourseTypeBadge'
import { CourseThumbnail } from '@/app/components/shared/CourseThumbnail'
import { PathHeroBanner } from '@/app/components/learning-path/PathHeroBanner'
import { PathProgressSidebar } from '@/app/components/learning-path/PathProgressSidebar'
import { EditPathDialog } from '@/app/components/learning-path/EditPathDialog'
import { ContinueLearningBento } from '@/app/components/learning-path/ContinueLearningBento'
import { PathTimeline } from '@/app/components/learning-path/PathTimeline'
import { ControlCenter } from '@/app/components/learning-path/ControlCenter'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useAuthorStore } from '@/stores/useAuthorStore'
import { useIsMobile } from '@/app/hooks/useMediaQuery'
import { usePathProgress } from '@/app/hooks/usePathProgress'
import { usePathMilestones } from '@/app/hooks/usePathMilestones'
import { useImportWizardTrigger } from '@/app/hooks/useImportWizardTrigger'
import { useLoadCourseThumbnails } from '@/app/hooks/useLoadCourseThumbnails'
import { staggerContainer, fadeUp } from '@/lib/motion'
import { extractGapSearchTerm, cleanGapJustification } from '@/data/learningPathUtils'
import { toast } from 'sonner'
import { suggestPathOrder, type OrderSuggestionResult } from '@/ai/learningPath/suggestOrder'
import type { LearningPathEntry, Course, PathCourseInfo } from '@/data/types'

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
            <CourseThumbnail url={thumbnailUrl} />

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
  const navigate = useNavigate()
  const {
    paths,
    entries,
    loadPaths,
    addCourseToPath,
    reorderCourse,
    removeCourseFromPath,
    getEntriesForPath,
    applyAIOrder,
    deletePathWithUndo,
    replaceGapEntry,
  } = useLearningPathStore()
  const { importedCourses, loadImportedCourses, thumbnailUrls, loadThumbnailUrls } =
    useCourseImportStore()
  const { authors, loadAuthors } = useAuthorStore()

  const [isLoaded, setIsLoaded] = useState(false)
  const catalogCourses: Course[] = [] // Catalog courses table dropped (E89-S01)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [resolvingGapEntryId, setResolvingGapEntryId] = useState<string | null>(null)

  // Import wizard trigger (singleton guard pattern)
  const {
    trigger: importTrigger,
    isOpen: importWizardOpen,
    setIsOpen: setImportWizardOpen,
    gapContext: wizardGapContext,
  } = useImportWizardTrigger()

  // "Keep panel open" toggle persisted in localStorage
  const [keepPanelOpen, setKeepPanelOpen] = useState(() => {
    try {
      return localStorage.getItem('keepCoursePanelOpen') === 'true'
    } catch {
      // silent-catch-ok: localStorage may be unavailable
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
    (gap?: { gapEntryId: string; searchTerm?: string }) => importTrigger(pathId ?? null, gap),
    [importTrigger, pathId]
  )

  // AI Suggest Order state (E26-S04)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [orderSuggestion, setOrderSuggestion] = useState<OrderSuggestionResult | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // Load all data on mount
  useEffect(() => {
    let ignore = false
    Promise.all([loadPaths(), loadImportedCourses(), loadAuthors()])
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

  // Watch path progress and fire milestone challenges automatically
  usePathMilestones({
    pathId: pathId ?? '',
    pathName: path?.name ?? 'Learning Path',
    completionPct: pathProgress.completionPct,
  })

  // Build course info lookup — uses real progress data
  const courseInfo = useMemo(() => {
    const map = new Map<string, PathCourseInfo>()

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

  // Course name lookup for PlanMyWeek and other components
  const courseNames = useMemo(() => {
    const names: Record<string, string> = {}
    for (const ic of importedCourses) {
      names[ic.id] = ic.name
    }
    for (const cc of catalogCourses) {
      names[cc.id] = cc.title
    }
    return names
  }, [importedCourses, catalogCourses])

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

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const handleDeletePath = useCallback(() => {
    if (pathId) {
      deletePathWithUndo(pathId)
      navigate('/learning-paths')
    }
  }, [pathId, deletePathWithUndo, navigate])

  // Handle course add from the inline course picker (single-select mode)
  const handlePickerAddCourse = useCallback(
    (courses: Array<{ courseId: string; courseType: 'imported' | 'catalog' }>) => {
      if (!pathId || courses.length === 0) return
      const course = courses[0]

      // Resolve gap entry inline (match/replace mode from gap entry resolution)
      if (resolvingGapEntryId) {
        replaceGapEntry(pathId, resolvingGapEntryId, course.courseId, course.courseType).catch(
          () => {
            toast.error('Failed to resolve gap entry')
          }
        )
        setResolvingGapEntryId(null)
        if (!keepPanelOpen) {
          setPickerOpen(false)
        }
        return
      }

      addCourseToPath(pathId, course.courseId, course.courseType).catch(() => {
        toast.error('Failed to add course')
      })
      if (!keepPanelOpen) {
        setPickerOpen(false)
      }
    },
    [pathId, addCourseToPath, replaceGapEntry, resolvingGapEntryId, keepPanelOpen]
  )

  // AI Suggest Order handler (E26-S04)
  const handleSuggestOrder = useCallback(async () => {
    if (!pathId || courseEntries.length < 2) return

    setIsSuggesting(true)
    try {
      const courseNamesMap = new Map<string, string>()
      const courseTags = new Map<string, string[]>()

      for (const ic of importedCourses) {
        courseNamesMap.set(ic.id, ic.name)
        courseTags.set(ic.id, ic.tags || [])
      }

      for (const cc of catalogCourses) {
        courseNamesMap.set(cc.id, cc.title)
        courseTags.set(cc.id, [])
      }

      const result = await suggestPathOrder(courseEntries, courseNamesMap, courseTags)
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
  const [showReorderList, setShowReorderList] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // First non-gap course ID for hero CTA
  const firstCourseId = useMemo(
    () => courseEntries.find(e => e.courseId !== '')?.courseId ?? null,
    [courseEntries]
  )

  // Current in-progress course ID for hero CTA
  const currentCourseId = useMemo(() => {
    const inProgress = currentEntry?.courseId
    return inProgress && inProgress !== '' ? inProgress : null
  }, [currentEntry])

  // Check prefers-reduced-motion
  const prefersReducedMotion = useReducedMotion()
  const shouldAnimate = !prefersReducedMotion
  const isMobile = useIsMobile()

  // Wrapped stagger variants based on motion preference
  const containerVariants = shouldAnimate ? staggerContainer : { hidden: {}, visible: {} }
  const itemVariants = shouldAnimate ? fadeUp : { hidden: {}, visible: {} }

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
            navigate('/learning-paths')
          }}
        />
      </div>
    )
  }

  return (
    <>
      {/* Full-width hero banner — breaks out of Layout main padding */}
      <div className="-mx-4 -mt-4 sm:-mx-6 sm:-mt-6">
        <PathHeroBanner
          path={path}
          courseCount={courseEntries.length}
          completedCount={completedEntries.length}
          pathProgress={pathProgress}
          thumbnailUrls={thumbnailUrls}
          currentCourseId={currentCourseId}
          firstCourseId={firstCourseId}
          onEdit={() => setEditDialogOpen(true)}
          onDelete={() => setDeleteConfirmOpen(true)}
        />
      </div>

      {/* Content area with negative margin to overlap hero */}
      <div className="-mt-10 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          {/* Template banner — for paths forked from a template */}
          {path.forkedFrom && (
            <motion.div variants={itemVariants}>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-brand-soft/50 border border-brand-soft">
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

          {/* Course list section */}
          {courseEntries.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[var(--content-gap)]">
              {/* Left Column (2/3): Continue Learning + Timeline */}
              <div className="lg:col-span-2 space-y-8">
              {/* Continue Learning Bento Card */}
              {currentEntry && (
                <motion.section variants={itemVariants}>
                  <ContinueLearningBento
                    entry={currentEntry}
                    courseInfo={courseInfo.get(currentEntry.courseId)}
                    thumbnailUrl={thumbnailUrls[currentEntry.courseId]}
                    onViewCurriculum={() => setShowReorderList(false)}
                  />
                </motion.section>
              )}

              {/* Completed Courses Strip */}
              {completedEntries.length > 0 && (
                <motion.section variants={itemVariants}>
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

              {/* Timeline */}
              {!showReorderList && (
                <motion.section variants={itemVariants}>
                  <h2 className="text-xl font-bold mb-4">Course Timeline</h2>
                  <PathTimeline
                    entries={courseEntries.map(e => ({
                      ...e,
                      info: courseInfo.get(e.courseId),
                      thumbnailUrl: thumbnailUrls[e.courseId],
                    }))}
                    courseInfoMap={courseInfo}
                    thumbnailUrls={thumbnailUrls}
                    gapEntries={courseEntries.filter(e => e.courseId === '')}
                    onGapResolve={resolution => {
                      const gapEntry = courseEntries.find(e => e.id === resolution.entryId)
                      const searchTerm = extractGapSearchTerm(gapEntry?.justification)

                      if (resolution.type === 'import') {
                        handleImportClick({
                          gapEntryId: resolution.entryId,
                          searchTerm,
                        })
                      } else if (resolution.type === 'match' || resolution.type === 'replace') {
                        setResolvingGapEntryId(resolution.entryId)
                        setPickerOpen(true)
                      }
                    }}
                    onCourseClick={courseId => navigate(`/courses/${courseId}`)}
                    autoScrollToCurrent
                    simplified={isMobile}
                  />
                </motion.section>
              )}

              {/* Gap entry summary between timeline and reorder list */}
              {gapCount > 0 && !showReorderList && (
                <motion.div variants={itemVariants}>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/30">
                    <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {matchedCount} of {courseEntries.length} courses matched
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Resolve gap entries above to complete your path.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Full Reorder List (togglable) */}
              {showReorderList && (
                <motion.section variants={itemVariants}>
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
                            const searchTerm = extractGapSearchTerm(entry.justification)
                            const justification = cleanGapJustification(entry.justification)
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
                                      setResolvingGapEntryId(entry.id)
                                      setPickerOpen(true)
                                    }}
                                  >
                                    <Download className="w-3.5 h-3.5 mr-1" />
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

            {/* Right Column (1/3, sticky): Progress Sidebar + Control Center */}
            <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-24 lg:self-start">
              {/* Progress Sidebar */}
              <PathProgressSidebar progress={pathProgress} />

              {/* Add Course collapsible panel */}
              <Collapsible open={pickerOpen} onOpenChange={setPickerOpen} className="space-y-3">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="brand"
                    data-testid="add-course-button"
                    className="w-full"
                    aria-expanded={pickerOpen}
                    aria-controls="inline-course-picker-panel-sidebar"
                  >
                    <Plus className="size-4 mr-2" aria-hidden="true" />
                    {pickerOpen ? 'Cancel' : 'Add Course'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent id="inline-course-picker-panel-sidebar" className="space-y-3">
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
                onClick={() => handleImportClick()}
                data-testid="import-course-button"
                className={pickerOpen ? 'hidden' : 'w-full'}
              >
                <Download className="size-4 mr-2" aria-hidden="true" />
                Import Course
              </Button>

              {/* ControlCenter — unified right-rail component */}
              {path && courseEntries.length > 0 && (
                <ControlCenter
                  pathId={pathId!}
                  pathName={path.name}
                  entries={courseEntries}
                  courseInfoMap={courseInfo}
                  courseNames={courseNames}
                  progress={pathProgress}
                  isSuggesting={isSuggesting}
                  onSuggestOrder={handleSuggestOrder}
                  onToggleCurriculum={() => setShowReorderList(v => !v)}
                  showCurriculum={showReorderList}
                />
              )}
            </aside>
          </div>
        ) : (
          /* Empty state — no courses in path */
          <motion.div variants={itemVariants} className="space-y-6">
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Add courses to build your learning path. You can reorder them by dragging or using the arrow buttons."
              actionLabel="Add Course"
              onAction={() => setPickerOpen(true)}
            />
            <Collapsible open={pickerOpen} onOpenChange={setPickerOpen} className="space-y-3">
              <CollapsibleContent id="inline-course-picker-panel" className="space-y-3">
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
                onClick={() => handleImportClick()}
                data-testid="import-course-button"
                className={pickerOpen ? 'hidden' : ''}
              >
                <Download className="size-4 mr-2" aria-hidden="true" />
                Import Course
              </Button>
            </div>
          </motion.div>
        )}
        </motion.div>
      </div>

      {/* Edit Path Dialog */}
      <EditPathDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        path={path}
      />

      {/* Import Wizard Dialog (R2, R3) */}
      <ImportWizardDialog
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        targetPathId={pathId}
        gapEntryId={wizardGapContext?.gapEntryId}
        searchTerm={wizardGapContext?.searchTerm}
      />

      {/* Delete Path Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this learning path?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{path?.name}&rdquo; and all associated course
              entries. You can undo this action from the toast notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeletePath}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <div className="rounded-xl border border-brand/20 bg-brand-soft/30 p-3">
                <p className="text-sm text-muted-foreground italic">{orderSuggestion.rationale}</p>
              </div>

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
