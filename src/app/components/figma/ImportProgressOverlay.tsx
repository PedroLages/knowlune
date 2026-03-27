import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/app/components/ui/button'
import { Progress } from '@/app/components/ui/progress'
import { Card } from '@/app/components/ui/card'
import { X, CheckCircle2, Loader2, XCircle, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react'
import { useImportProgressStore } from '@/stores/useImportProgressStore'
import type { CourseImportProgress } from '@/stores/useImportProgressStore'
import { toast } from 'sonner'

const AUTO_DISMISS_MS = 3000
const ETA_THRESHOLD = 20 // Show ETA after this many files processed

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s remaining`
  const minutes = Math.floor(seconds / 60)
  const secs = Math.ceil(seconds % 60)
  if (minutes < 60) return `${minutes}m ${secs}s remaining`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return `${hours}h ${remainingMins}m remaining`
}

function calculateEta(course: CourseImportProgress): string | null {
  if (course.filesProcessed < ETA_THRESHOLD) return null
  if (!course.totalFiles || course.totalFiles <= 0) return null
  if (course.filesProcessed >= course.totalFiles) return null

  const elapsed = (Date.now() - course.startedAt) / 1000
  const rate = course.filesProcessed / elapsed
  if (rate <= 0) return null

  const remaining = course.totalFiles - course.filesProcessed
  const secondsLeft = remaining / rate
  return formatTimeRemaining(secondsLeft)
}

function getProgressText(course: CourseImportProgress): string {
  if (course.error) return course.error
  if (course.phase === 'cancelled') return 'Cancelled'
  if (course.phase === 'complete') return 'Complete'

  const total = course.totalFiles
  const processed = course.filesProcessed

  if (course.phase === 'scanning' && (total === null || total === 0)) {
    return `Scanning folder\u2026 ${processed} of ? files processed`
  }

  if (total && total > 0) {
    const percent = Math.round((processed / total) * 100)
    return `${processed} of ${total} files processed (${percent}%)`
  }

  return `Scanning folder\u2026 ${processed} files found`
}

function CourseProgressItem({ course }: { course: CourseImportProgress }) {
  const eta = calculateEta(course)
  const progressText = getProgressText(course)
  const progressPercent =
    course.totalFiles && course.totalFiles > 0
      ? Math.round((course.filesProcessed / course.totalFiles) * 100)
      : 0

  return (
    <div className="space-y-1.5" data-testid={`import-progress-${course.courseId}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {course.phase === 'complete' && (
            <CheckCircle2 className="size-4 text-success shrink-0" aria-hidden="true" />
          )}
          {(course.phase === 'scanning' || course.phase === 'processing') && !course.error && (
            <Loader2 className="size-4 text-brand animate-spin shrink-0" aria-hidden="true" />
          )}
          {course.error && (
            <XCircle className="size-4 text-destructive shrink-0" aria-hidden="true" />
          )}
          {course.phase === 'cancelled' && (
            <XCircle className="size-4 text-warning shrink-0" aria-hidden="true" />
          )}
          <span className="text-sm font-medium truncate">{course.courseName}</span>
        </div>
      </div>

      {course.phase !== 'complete' && course.phase !== 'cancelled' && !course.error && (
        <Progress
          value={progressPercent}
          className="h-1.5"
          aria-label={`Import progress for ${course.courseName}`}
        />
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{progressText}</p>
        {eta && <p className="text-xs text-muted-foreground tabular-nums">{eta}</p>}
      </div>
    </div>
  )
}

export function ImportProgressOverlay() {
  const isActive = useImportProgressStore(s => s.isActive)
  const isVisible = useImportProgressStore(s => s.isVisible)
  const courses = useImportProgressStore(s => s.courses)
  const cancelRequested = useImportProgressStore(s => s.cancelRequested)
  const cancelImport = useImportProgressStore(s => s.cancelImport)
  const confirmCancellation = useImportProgressStore(s => s.confirmCancellation)
  const dismissOverlay = useImportProgressStore(s => s.dismissOverlay)
  const reset = useImportProgressStore(s => s.reset)

  const [expanded, setExpanded] = useState(true)
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevIsActive = useRef(isActive)

  const courseList = [...courses.values()]
  const totalCourses = courseList.length
  const completedCourses = courseList.filter(
    c => c.phase === 'complete' || c.error || c.phase === 'cancelled'
  ).length
  const successCourses = courseList.filter(c => c.phase === 'complete').length

  // Auto-dismiss 3s after all imports complete (AC5)
  useEffect(() => {
    if (prevIsActive.current && !isActive && totalCourses > 0) {
      // Imports just finished
      const cancelledCount = courseList.filter(c => c.phase === 'cancelled').length

      if (cancelledCount > 0) {
        toast.info(`Import cancelled. No partial data saved.`)
      } else if (successCourses > 0) {
        toast.success(
          `Import complete! ${successCourses} ${successCourses === 1 ? 'course' : 'courses'} added.`
        )
      }

      autoDismissTimer.current = setTimeout(() => {
        dismissOverlay()
        // Small delay before full reset so user sees the final state
        setTimeout(() => reset(), 300)
      }, AUTO_DISMISS_MS)
    }
    prevIsActive.current = isActive

    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current)
      }
    }
  }, [isActive, totalCourses, successCourses, courseList, dismissOverlay, reset])

  const handleCancel = useCallback(() => {
    cancelImport()
    // The import loops check cancelRequested and will call confirmCancellation
    // For immediate UX feedback, confirm after a brief delay if still pending
    setTimeout(() => {
      const state = useImportProgressStore.getState()
      if (state.cancelRequested) {
        confirmCancellation()
      }
    }, 500)
  }, [cancelImport, confirmCancellation])

  const handleClose = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current)
    }
    dismissOverlay()
    if (!isActive) {
      setTimeout(() => reset(), 300)
    }
  }, [isActive, dismissOverlay, reset])

  if (!isVisible || totalCourses === 0) return null

  // Overall progress for bulk imports (AC3)
  const overallPercent = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0

  const isBulk = totalCourses > 1

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 sm:w-96"
      role="status"
      aria-live="polite"
      aria-label="Import progress"
      data-testid="import-progress-overlay"
    >
      <Card className="bg-card rounded-[24px] border border-border shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-4 text-brand" aria-hidden="true" />
            <h3 className="text-sm font-semibold">
              {isActive
                ? isBulk
                  ? `Importing ${completedCourses} of ${totalCourses} courses\u2026`
                  : 'Importing course\u2026'
                : `Import complete! ${successCourses} ${successCourses === 1 ? 'course' : 'courses'} added.`}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {isBulk && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                aria-controls={expanded ? 'import-details-panel' : undefined}
                className="size-7 p-0"
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
              >
                {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="size-7 p-0"
              aria-label="Close import progress"
              data-testid="import-progress-close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Overall progress bar for bulk imports */}
        {isBulk && (
          <div className="px-4 pb-2">
            <Progress
              value={overallPercent}
              className="h-2"
              showLabel
              labelFormat={() => `${completedCourses} of ${totalCourses} complete`}
              aria-label="Overall import progress"
            />
          </div>
        )}

        {/* Per-course progress (expanded view or single import) */}
        {(expanded || !isBulk) && (
          <div
            id="import-details-panel"
            className="px-4 pb-3 space-y-3 max-h-60 overflow-y-auto"
            data-testid="import-progress-courses"
          >
            {courseList.map(course => (
              <CourseProgressItem key={course.courseId} course={course} />
            ))}
          </div>
        )}

        {/* Cancel button (AC4) */}
        {isActive && (
          <div className="px-4 pb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelRequested}
              className="w-full rounded-xl"
              data-testid="import-progress-cancel"
              aria-label="Cancel import"
            >
              {cancelRequested ? (
                <>
                  <Loader2 className="size-3 mr-1.5 animate-spin" aria-hidden="true" />
                  Cancelling\u2026
                </>
              ) : (
                'Cancel Import'
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
