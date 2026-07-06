/**
 * ContinueLearningPathSection — Overview dashboard section for path-based resume.
 *
 * Shows the user's next best course from active learning paths, enabling
 * 1-click resume to the exact lesson.
 *
 * @see R3, R4, R5 — docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md
 */

import { useState, useMemo, useCallback, Component, type ReactNode, type ErrorInfo } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Route, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useMultiPathProgress } from '@/app/hooks/usePathProgress'
import { fadeUp } from '@/lib/motion'
import type { LearningPathEntry, ImportedCourse } from '@/data/types'
import type { CourseProgressInfo } from '@/app/hooks/usePathProgress'

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Derive the next best course info for a single path given its sorted entries
 * and course progress map. Returns null if the path is complete or empty.
 */
interface DerivedCourseInfo {
  entry: LearningPathEntry
  course: ImportedCourse | null
  action: 'resume' | 'start'
  completionPct: number
}

function deriveNextCourse(
  sortedEntries: LearningPathEntry[],
  courseProgress: Map<string, CourseProgressInfo> | undefined,
  importedCourses: ImportedCourse[]
): DerivedCourseInfo | null {
  if (sortedEntries.length === 0 || !courseProgress || courseProgress.size === 0) return null

  // Pass 1: Find the first in-progress course (resume)
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (!cp) continue
    if (cp.completionPct > 0 && cp.completionPct < 100) {
      const course = importedCourses.find(c => c.id === entry.courseId) ?? null
      return { entry, course, action: 'resume', completionPct: cp.completionPct }
    }
  }

  // Pass 2: Find the first unstarted course (start)
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (!cp) continue
    if (cp.completionPct === 0) {
      const course = importedCourses.find(c => c.id === entry.courseId) ?? null
      return { entry, course, action: 'start', completionPct: 0 }
    }
  }

  // All complete or unactionable
  return null
}

// ── Props ────────────────────────────────────────────────────────────────

interface PathCardProps {
  pathName: string
  courseName: string
  completionPct: number
  totalCourses: number
  estimatedRemainingHours: number
  action: 'resume' | 'start'
  navigateLabel: string
  onNavigate: () => void
  isPrimary?: boolean
}

function PathResumeCard({
  pathName,
  courseName,
  completionPct,
  totalCourses,
  estimatedRemainingHours,
  action,
  navigateLabel,
  onNavigate,
  isPrimary = false,
}: PathCardProps) {
  return (
    <div className={`rounded-xl border border-border/50 bg-card p-4 ${isPrimary ? '' : 'mt-2'}`}>
      {/* Path name (small, muted) */}
      <p className="text-xs text-muted-foreground font-medium truncate mb-1">{pathName}</p>

      {/* Course title */}
      <h3 className="text-sm font-semibold truncate mb-2">
        {action === 'resume' ? 'Next: ' : 'Start: '}
        {courseName}
      </h3>

      {/* Progress bar for in-progress courses */}
      {action === 'resume' && (
        <div className="w-full h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-500"
            style={{ width: `${completionPct}%` }}
            role="progressbar"
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${completionPct}% complete`}
          />
        </div>
      )}

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-3">
        <span>
          {totalCourses} {totalCourses === 1 ? 'course' : 'courses'}
        </span>
        <span>{Math.round(completionPct)}% complete</span>
        {estimatedRemainingHours > 0 && completionPct < 100 && (
          <span>~{estimatedRemainingHours}h remaining</span>
        )}
      </div>

      {/* Action button — right-aligned, content-sized */}
      <div className="flex justify-end">
        <Button variant="brand" size="sm" onClick={onNavigate}>
          {navigateLabel}
          <ArrowRight className="ml-1.5 size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

function ContinueLearningPathSectionInner() {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  // Store data
  const paths = useLearningPathStore(s => s.paths)
  const entries = useLearningPathStore(s => s.entries)
  const importedCourses = useCourseImportStore(s => s.importedCourses)

  // Build entries-by-path map for progress computation
  const entriesByPathMap = useMemo(() => {
    const entriesMap = new Map<string, LearningPathEntry[]>()
    for (const path of paths) {
      if (path.isTemplate) continue // skip template paths
      const pathEntries = entries
        .filter(e => e.pathId === path.id)
        .sort((a, b) => a.position - b.position)
      entriesMap.set(path.id, pathEntries)
    }
    return entriesMap
  }, [paths, entries])

  // Get progress for ALL paths in one hook call
  const progressMap = useMultiPathProgress(entriesByPathMap)

  // Derive next course info per path
  const actionablePaths = useMemo(() => {
    const results: Array<{
      pathId: string
      pathName: string
      createdAt: string
      totalCourses: number
      estimatedRemainingHours: number
      info: DerivedCourseInfo
    }> = []

    for (const [pathId, sortedEntries] of entriesByPathMap) {
      const progress = progressMap.get(pathId)
      const path = paths.find(p => p.id === pathId)
      if (!path || !progress) continue

      const info = deriveNextCourse(sortedEntries, progress.courseProgress, importedCourses)
      if (info) {
        results.push({
          pathId,
          pathName: path.name,
          createdAt: path.createdAt,
          totalCourses: progress.totalCourses,
          estimatedRemainingHours: progress.estimatedRemainingHours,
          info,
        })
      }
    }

    // Sort by most recently created first
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return results
  }, [entriesByPathMap, progressMap, paths, importedCourses])

  // Handle navigation
  const handleNavigate = useCallback(
    (pathId: string, courseId: string, action: 'resume' | 'start') => {
      if (action === 'resume' || action === 'start') {
        // Navigate to course detail page (the lesson player URL isn't known
        // without the hook's async targetLessonId resolution; the course
        // detail page is a safe destination)
        navigate(`/courses/${courseId}`)
      } else {
        navigate(`/learning-tracks/${pathId}`)
      }
    },
    [navigate]
  )

  // Empty state: no actionable paths
  if (actionablePaths.length === 0) return null

  const primary = actionablePaths[0]
  const remaining = actionablePaths.slice(1)

  return (
    <section data-testid="section-continue-learning-path">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Route className="size-5 text-brand-soft-foreground" aria-hidden="true" />
        <h2 className="text-xl font-semibold">Continue Learning</h2>
      </div>

      {/* Primary path card */}
      <PathResumeCard
        pathName={primary.pathName}
        courseName={primary.info.course?.name ?? 'Unknown Course'}
        completionPct={primary.info.completionPct}
        totalCourses={primary.totalCourses}
        estimatedRemainingHours={primary.estimatedRemainingHours}
        action={primary.info.action}
        navigateLabel={primary.info.action === 'resume' ? 'Continue' : 'Start'}
        onNavigate={() =>
          handleNavigate(primary.pathId, primary.info.entry.courseId, primary.info.action)
        }
        isPrimary
      />

      {/* Remaining paths (expandable) */}
      {remaining.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={expanded}
            aria-controls="continue-learning-path-remaining"
          >
            {expanded ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
            <span>
              {expanded
                ? 'Show less'
                : `${remaining.length} more ${remaining.length === 1 ? 'learning path' : 'learning paths'}`}
            </span>
          </button>

          {expanded && (
            <div id="continue-learning-path-remaining">
              {remaining.map(p => (
                <PathResumeCard
                  key={p.pathId}
                  pathName={p.pathName}
                  courseName={p.info.course?.name ?? 'Unknown Course'}
                  completionPct={p.info.completionPct}
                  totalCourses={p.totalCourses}
                  estimatedRemainingHours={p.estimatedRemainingHours}
                  action={p.info.action}
                  navigateLabel={p.info.action === 'resume' ? 'Continue' : 'Start'}
                  onNavigate={() => handleNavigate(p.pathId, p.info.entry.courseId, p.info.action)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ── Error Boundary Wrapper ──────────────────────────────────────────────

/**
 * Wraps the inner component so a render error in path data computation doesn't
 * crash the entire dashboard. Falls back to rendering nothing.
 */
export function ContinueLearningPathSection() {
  return (
    <ErrorBoundary fallback={null}>
      <motion.div variants={fadeUp}>
        <ContinueLearningPathSectionInner />
      </motion.div>
    </ErrorBoundary>
  )
}

// ── Simple Error Boundary ────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ContinueLearningPathSection] Error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
