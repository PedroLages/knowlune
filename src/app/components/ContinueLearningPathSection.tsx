/**
 * ContinueLearningPathSection — Overview dashboard section for path-based resume.
 *
 * Shows the user's next best course from active learning paths, enabling
 * 1-click resume to the exact lesson.
 *
 * Uses the canonical {@link resolveTrackResumeTarget} resolver so lesson
 * selection is consistent with track cards, the track-detail page, and the
 * course-overview CTA.
 *
 * @see src/lib/learningResumeResolver.ts
 * @see docs/plans/2026-05-04-001-feat-smart-resume-learning-paths-plan.md
 */

import { useState, useMemo, useCallback, useEffect, useRef, Component, type ReactNode, type ErrorInfo } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Route, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { db } from '@/db'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useCourseImportStore } from '@/stores/useCourseImportStore'
import { useContentProgressStore } from '@/stores/useContentProgressStore'
import { useMultiPathProgress } from '@/app/hooks/usePathProgress'
import {
  resolveCourseResumeTargetSync,
  type CourseResumeTarget,
} from '@/lib/learningResumeResolver'
import { fadeUp } from '@/lib/motion'
import type { LearningPathEntry, ImportedCourse, ImportedVideo, ImportedPdf, VideoProgress } from '@/data/types'
import type { CourseProgressInfo } from '@/app/hooks/usePathProgress'

// ── Helpers ──────────────────────────────────────────────────────────────

/** Per-path actionable info combining progress display with the resolved lesson target. */
interface ActionablePathInfo {
  pathId: string
  pathName: string
  createdAt: string
  totalCourses: number
  estimatedRemainingHours: number
  /** The course that should be opened next */
  entry: LearningPathEntry
  course: ImportedCourse | null
  completionPct: number
  /** Resolved lesson target for the selected course (null while loading) */
  lessonTarget: CourseResumeTarget | null
}

/**
 * Find the first actionable course for a path using the same two-pass algorithm
 * as before (in-progress → unstarted), but augmented with per-lesson resolution.
 * Returns null when the path is complete or empty.
 */
function findActionableCourse(
  sortedEntries: LearningPathEntry[],
  courseProgress: Map<string, CourseProgressInfo> | undefined,
  importedCourses: ImportedCourse[],
): { entry: LearningPathEntry; course: ImportedCourse | null; completionPct: number } | null {
  if (sortedEntries.length === 0 || !courseProgress || courseProgress.size === 0) return null

  // Pass 1: first in-progress course
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (!cp) continue
    if (cp.completionPct > 0 && cp.completionPct < 100) {
      const course = importedCourses.find(c => c.id === entry.courseId) ?? null
      return { entry, course, completionPct: cp.completionPct }
    }
  }

  // Pass 2: first unstarted course
  for (const entry of sortedEntries) {
    const cp = courseProgress.get(entry.courseId)
    if (!cp) continue
    if (cp.completionPct === 0) {
      const course = importedCourses.find(c => c.id === entry.courseId) ?? null
      return { entry, course, completionPct: 0 }
    }
  }

  return null
}

// ── Props ────────────────────────────────────────────────────────────────

interface PathCardProps {
  pathName: string
  courseName: string
  completionPct: number
  totalCourses: number
  estimatedRemainingHours: number
  action: 'resume' | 'start' | 'complete'
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
  const actionLabel =
    action === 'resume' ? 'Next: ' : action === 'start' ? 'Start: ' : ''

  return (
    <div className={`rounded-xl border border-border/50 bg-card p-4 ${isPrimary ? '' : 'mt-2'}`}>
      {/* Path name (small, muted) */}
      <p className="text-xs text-muted-foreground font-medium truncate mb-1">{pathName}</p>

      {/* Course title */}
      <h3 className="text-sm font-semibold truncate mb-2">
        {actionLabel}
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
  const statusMap = useContentProgressStore(s => s.statusMap)
  const loadCourseProgress = useContentProgressStore(s => s.loadCourseProgress)

  // Per-course resolved lesson targets (populated asynchronously).
  // Keyed by courseId; null until the resolver runs for that course.
  const [lessonTargets, setLessonTargets] = useState<
    Map<string, CourseResumeTarget>
  >(new Map())

  // Track which courses we've already resolved to avoid duplicate work
  const resolvedRef = useRef(new Set<string>())

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

  // Collect all course IDs that appear as the first actionable course in any path.
  // These are the ones we need lesson-level targets for.
  const targetCourseIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [pathId, sortedEntries] of entriesByPathMap) {
      const progress = progressMap.get(pathId)
      if (!progress) continue
      const found = findActionableCourse(sortedEntries, progress.courseProgress, importedCourses)
      if (found) ids.add(found.entry.courseId)
    }
    return ids
  }, [entriesByPathMap, progressMap, importedCourses])

  // Eagerly load contentProgress + per-course data for target courses,
  // then resolve lesson targets via the canonical sync resolver.
  useEffect(() => {
    const courseIds = [...targetCourseIds]
    if (courseIds.length === 0) return

    let ignore = false

    async function resolveAll() {
      // Batch-load contentProgress for all target courses
      await Promise.allSettled(courseIds.map(id => loadCourseProgress(id)))

      if (ignore) return

      // For each course, load videos + progress, then resolve
      const next = new Map(lessonTargets)
      let changed = false

      for (const courseId of courseIds) {
        if (resolvedRef.current.has(courseId)) continue
        resolvedRef.current.add(courseId)

        try {
          const [videos, pdfs, vpList] = await Promise.all([
            db.importedVideos.where('courseId').equals(courseId).toArray(),
            db.importedPdfs.where('courseId').equals(courseId).toArray(),
            db.progress.where('courseId').equals(courseId).toArray(),
          ])

          const target = resolveCourseResumeTargetSync(courseId, {
            videos: videos as ImportedVideo[],
            pdfs: pdfs as ImportedPdf[],
            videoProgressList: vpList as VideoProgress[],
            statusMap,
          })

          next.set(courseId, target)
          changed = true
        } catch {
          // Non-critical — skip this course if data can't be loaded
        }
      }

      if (!ignore && changed) setLessonTargets(next)
    }

    resolveAll()
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCourseIds, statusMap, loadCourseProgress])

  // Reset resolved set when targetCourseIds change structurally
  useEffect(() => {
    resolvedRef.current = new Set()
  }, [targetCourseIds])

  // Derive actionable path info, merging course-level progress with lesson targets
  const actionablePaths = useMemo(() => {
    const results: ActionablePathInfo[] = []

    for (const [pathId, sortedEntries] of entriesByPathMap) {
      const progress = progressMap.get(pathId)
      const path = paths.find(p => p.id === pathId)
      if (!path || !progress) continue

      const found = findActionableCourse(sortedEntries, progress.courseProgress, importedCourses)
      if (!found) continue

      const lessonTarget = lessonTargets.get(found.entry.courseId) ?? null

      results.push({
        pathId,
        pathName: path.name,
        createdAt: path.createdAt,
        totalCourses: progress.totalCourses,
        estimatedRemainingHours: progress.estimatedRemainingHours,
        entry: found.entry,
        course: found.course,
        completionPct: found.completionPct,
        lessonTarget,
      })
    }

    // Sort by most recently created first
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return results
  }, [entriesByPathMap, progressMap, paths, importedCourses, lessonTargets])

  // Determine the action label from the lesson target.
  // Falls back to completionPct when the lesson target hasn't resolved yet.
  const getAction = useCallback(
    (p: ActionablePathInfo): 'resume' | 'start' | 'complete' => {
      if (p.lessonTarget) {
        if (p.lessonTarget.action === 'resume') return 'resume'
        if (p.lessonTarget.action === 'start') return 'start'
        return 'complete'
      }
      // Before the lesson target resolves, derive from course-level progress
      return p.completionPct > 0 ? 'resume' : 'start'
    },
    [],
  )

  // Handle navigation to the EXACT lesson URL (not just the course overview).
  // Uses the pre-resolved lesson target for instant navigation.
  const handleNavigate = useCallback(
    (p: ActionablePathInfo) => {
      const target = p.lessonTarget

      if (target && (target.action === 'resume' || target.action === 'start') && target.lessonId) {
        // Navigate directly to the lesson player
        navigate(`/courses/${target.courseId}/lessons/${target.lessonId}`, {
          state: {
            fromTrack: { trackId: p.pathId, trackName: p.pathName },
            resumePositionSeconds: target.resumePositionSeconds,
          },
        })
      } else if (target?.action === 'complete') {
        // All courses in the track are done — go to track detail
        navigate(`/learning-tracks/${p.pathId}`)
      } else {
        // Lesson target not yet resolved or course has no playable lessons —
        // fall back to course overview
        navigate(`/courses/${p.entry.courseId}`, {
          state: {
            fromTrack: { trackId: p.pathId, trackName: p.pathName },
          },
        })
      }
    },
    [navigate],
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
        courseName={primary.course?.name ?? 'Unknown Course'}
        completionPct={primary.completionPct}
        totalCourses={primary.totalCourses}
        estimatedRemainingHours={primary.estimatedRemainingHours}
        action={getAction(primary)}
        navigateLabel={
          getAction(primary) === 'resume'
            ? 'Continue'
            : getAction(primary) === 'start'
              ? 'Start'
              : 'Review'
        }
        onNavigate={() => handleNavigate(primary)}
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
                  courseName={p.course?.name ?? 'Unknown Course'}
                  completionPct={p.completionPct}
                  totalCourses={p.totalCourses}
                  estimatedRemainingHours={p.estimatedRemainingHours}
                  action={getAction(p)}
                  navigateLabel={
                    getAction(p) === 'resume'
                      ? 'Continue'
                      : getAction(p) === 'start'
                        ? 'Start'
                        : 'Review'
                  }
                  onNavigate={() => handleNavigate(p)}
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
