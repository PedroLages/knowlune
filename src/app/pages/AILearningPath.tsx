import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router'
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
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { Button } from '@/app/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert'
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
import { Sparkles, RotateCw, Loader2, AlertCircle, BookOpen, GripVertical } from 'lucide-react'
import { staggerContainer, fadeUp } from '@/lib/motion'
import type { LearningPathEntry, ImportedCourse } from '@/data/types'

/** Sortable wrapper for course cards */
function SortableCourseCard({
  course,
  courseData,
  index,
}: {
  course: LearningPathEntry
  courseData: ImportedCourse | undefined
  index: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: course.courseId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <motion.div
      ref={setNodeRef}
      // eslint-disable-next-line react-best-practices/no-inline-styles -- dynamic value requires inline style
      style={style}
      {...attributes}
      variants={fadeUp}
      custom={index}
      data-testid={`learning-path-course-${index}`}
    >
      <div className="relative bg-card border border-border rounded-[24px] p-8 shadow-sm">
        {/* Position Badge */}
        <div className="absolute -top-4 -left-4 size-12 rounded-full bg-gradient-to-br from-gold to-warning flex items-center justify-center font-display text-gold-foreground font-bold shadow-lg">
          {course.position}
        </div>

        {/* Drag Handle */}
        <button
          className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-manipulation"
          aria-label="Drag to reorder"
          {...listeners}
        >
          <GripVertical className="size-5" />
        </button>

        {/* Manual Override Badge */}
        {course.isManuallyOrdered && (
          <div
            className="absolute top-4 right-14 px-3 py-1 rounded-full bg-info/10 text-info border border-info/20 text-sm font-medium"
            data-testid="manual-override-indicator"
          >
            Manual
          </div>
        )}

        {/* Course Title */}
        <h3 className="font-display text-2xl mb-3 mt-2 pr-12">
          {courseData?.name || 'Unknown Course'}
        </h3>

        {/* AI Justification */}
        {course.justification && (
          <p className="text-muted-foreground italic" data-testid="course-justification">
            {course.justification}
          </p>
        )}
      </div>
    </motion.div>
  )
}

export function AILearningPath() {
  const {
    activePath,
    entries,
    isGenerating,
    error,
    generatePath,
    reorderCourse,
    regeneratePath,
    loadPaths,
    getEntriesForPath,
  } = useLearningPathStore()
  const { importedCourses, loadImportedCourses } = useCourseImportStore()
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)

  // Get entries for the active path (entries dependency triggers recalc on add/remove/reorder)
  const courses = useMemo(
    () => (activePath ? getEntriesForPath(activePath.id) : []),
    [activePath, entries, getEntriesForPath]
  )

  // Load data on mount
  useEffect(() => {
    loadImportedCourses()
    loadPaths()
  }, [loadImportedCourses, loadPaths])

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px tolerance to distinguish click from drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id && activePath) {
      const oldIndex = courses.findIndex(c => c.courseId === active.id)
      const newIndex = courses.findIndex(c => c.courseId === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderCourse(activePath.id, oldIndex, newIndex)
      }
    }
  }

  const handleGenerate = async () => {
    await generatePath()
  }

  const handleRegenerateClick = () => {
    // Check if any courses are manually ordered
    const hasManualOverrides = courses.some(c => c.isManuallyOrdered)
    if (hasManualOverrides) {
      setShowRegenerateDialog(true)
    } else {
      // No manual overrides, regenerate immediately
      regeneratePath()
    }
  }

  const handleRegenerateConfirm = () => {
    setShowRegenerateDialog(false)
    regeneratePath()
  }

  const courseCount = importedCourses.length
  const hasPath = courses.length > 0
  const canGenerate = courseCount >= 2 && !isGenerating

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      {/* Page Header */}
      <header className="mb-12 text-center">
        <h1 className="font-display text-4xl text-foreground mb-4">Your Learning Path</h1>
        <p className="text-muted-foreground text-lg">
          {hasPath
            ? 'AI-suggested course sequence based on prerequisites'
            : 'Let AI analyze your courses and suggest an optimal learning order'}
        </p>
      </header>

      {/* Action Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-center gap-4">
        {!hasPath && canGenerate && (
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={!canGenerate}
            variant="brand"
            data-testid="generate-learning-path-button"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 size-5 animate-spin" />
                Analyzing courses...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-5" />
                Generate Learning Path
              </>
            )}
          </Button>
        )}

        {hasPath && !isGenerating && (
          <Button
            variant="outline"
            size="lg"
            onClick={handleRegenerateClick}
            data-testid="regenerate-learning-path-button"
          >
            <RotateCw className="mr-2 size-4" />
            Regenerate
          </Button>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-8" data-testid="ai-unavailable-status">
          <AlertCircle className="size-4" />
          <AlertTitle>AI unavailable</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              className="ml-4"
              data-testid="retry-learning-path-button"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State (< 2 courses) */}
      {courseCount < 2 && (
        <div className="text-center py-16" data-testid="learning-path-empty-state">
          <div className="mx-auto size-20 rounded-full bg-brand-soft flex items-center justify-center mb-6">
            <BookOpen className="size-10 text-brand" />
          </div>
          <h3 className="font-display text-2xl mb-2">Not Enough Courses</h3>
          <p className="text-muted-foreground text-lg mb-4">
            At least 2 courses are needed to generate a learning path.
          </p>
          <p className="text-muted-foreground">
            Import more courses from the{' '}
            <Link to="/courses" className="text-brand underline">
              Courses page
            </Link>{' '}
            to get started.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && !hasPath && (
        <div className="text-center py-16">
          <Loader2 className="mx-auto size-12 animate-spin text-brand mb-4" />
          <p className="text-muted-foreground text-lg">Generating learning path...</p>
        </div>
      )}

      {/* Learning Path List */}
      {hasPath && !isGenerating && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={courses.map(c => c.courseId)}
            strategy={verticalListSortingStrategy}
          >
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-8"
              role="feed"
              aria-busy={isGenerating}
              data-testid="learning-path-list"
            >
              {courses.map((course, index) => {
                // Find the full course data from importedCourses
                const courseData = importedCourses.find(c => c.id === course.courseId)

                return (
                  <SortableCourseCard
                    key={course.courseId}
                    course={course}
                    courseData={courseData}
                    index={index}
                  />
                )
              })}
            </motion.div>
          </SortableContext>
        </DndContext>
      )}

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Learning Path?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace your current path with a fresh AI-generated sequence. Any manual
              reordering will be replaced, and manual overrides will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
