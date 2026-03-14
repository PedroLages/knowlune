import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Brain, AlertCircle, CheckCircle2, Loader2, Cpu } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { detectGaps } from '@/ai/knowledgeGaps/detectGaps'
import type { GapDetectionResult, GapItem, GapSeverity } from '@/ai/knowledgeGaps/types'
import { useCourseImportStore } from '@/stores/useCourseImportStore'

type PageState = 'idle' | 'analyzing' | 'completed' | 'error'

const SEVERITY_LABEL: Record<GapSeverity, string> = {
  critical: 'Critical',
  medium: 'Medium',
  low: 'Low',
}

const SEVERITY_BADGE_CLASS: Record<GapSeverity, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  low: 'bg-info/10 text-info border-info/20',
}

const GAP_TYPE_LABEL: Record<GapItem['gapType'], string> = {
  'under-noted': 'Under-noted',
  skipped: 'Skipped',
}

function GapCard({ gap }: { gap: GapItem }) {
  const videoPath = `/imported-courses/${gap.courseId}/lessons/${gap.videoId}`

  return (
    <div
      className={`rounded-[24px] border p-6 shadow-sm ${SEVERITY_BADGE_CLASS[gap.severity]}`}
      data-testid="gap-item"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_BADGE_CLASS[gap.severity]}`}
            data-testid="gap-severity"
            data-severity={gap.severity}
          >
            {SEVERITY_LABEL[gap.severity]}
          </span>
          <span className="text-sm font-medium" data-testid="gap-type">
            {GAP_TYPE_LABEL[gap.gapType]}
          </span>
          <span className="text-sm text-muted-foreground">— {gap.courseTitle}</span>
        </div>

        <Link
          to={videoPath}
          className="text-sm font-medium text-brand hover:text-brand-hover underline underline-offset-2 shrink-0"
          data-testid="gap-video-link"
        >
          Review video →
        </Link>
      </div>

      <h3 className="font-semibold text-base mb-1">{gap.videoTitle}</h3>

      {gap.gapType === 'under-noted' && (
        <p className="text-sm text-muted-foreground">
          {gap.noteCount === 0 ? 'No notes yet' : `${gap.noteCount} note${gap.noteCount === 1 ? '' : 's'}`}
          {' '}for this video
          {' '}(course has {gap.videoCount} video{gap.videoCount === 1 ? '' : 's'})
        </p>
      )}

      {gap.gapType === 'skipped' && (
        <p className="text-sm text-muted-foreground">
          Marked complete but only watched{' '}
          <span data-testid="gap-watch-percentage" className="font-medium">
            {gap.watchPercentage}%
          </span>
        </p>
      )}

      {gap.aiDescription && (
        <p
          className="text-sm mt-2 italic text-foreground/70"
          data-testid="ai-gap-description"
        >
          {gap.aiDescription}
        </p>
      )}
    </div>
  )
}

function AnalyzingSkeletons() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-[24px] border bg-card p-6 space-y-3 shadow-sm">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function KnowledgeGaps() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [result, setResult] = useState<GapDetectionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const { importedCourses, loadImportedCourses } = useCourseImportStore()

  useEffect(() => {
    loadImportedCourses()
    return () => {
      abortRef.current?.abort()
    }
  }, [loadImportedCourses])

  const hasCourses = importedCourses.length > 0

  async function handleAnalyze() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPageState('analyzing')
    setResult(null)
    setErrorMessage(null)

    try {
      const detection = await detectGaps({ signal: controller.signal })
      if (!controller.signal.aborted) {
        setResult(detection)
        setPageState('completed')
      }
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : 'Failed to analyze gaps'
      setErrorMessage(message)
      setPageState('error')
      console.error('[KnowledgeGaps] Detection failed:', err)
    }
  }

  // Group gaps by course for display
  const gapsByCourse = result
    ? result.gaps.reduce<Map<string, GapItem[]>>((acc, gap) => {
        const list = acc.get(gap.courseId) ?? []
        list.push(gap)
        acc.set(gap.courseId, list)
        return acc
      }, new Map())
    : new Map<string, GapItem[]>()

  const totalGaps = result?.gaps.length ?? 0
  const affectedCourses = gapsByCourse.size

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      {/* Screen reader live region for analysis status */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {pageState === 'analyzing' && 'Analyzing your study patterns for knowledge gaps…'}
        {pageState === 'completed' && `Analysis complete. ${totalGaps} gap${totalGaps === 1 ? '' : 's'} found.`}
      </div>

      {/* Page Header */}
      <header className="mb-10 text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-brand-soft">
          <Brain className="size-8 text-brand" />
        </div>
        <h1 className="font-display text-4xl text-foreground mb-4">Knowledge Gaps</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Identify topics you&apos;ve under-annotated or videos you rushed through — and get back on track.
        </p>
      </header>

      {/* Action Bar */}
      <div className="mb-8 flex justify-center">
        <Button
          size="lg"
          onClick={handleAnalyze}
          disabled={!hasCourses || pageState === 'analyzing'}
          className="bg-brand hover:bg-brand-hover min-w-44"
          data-testid="analyze-gaps-button"
        >
          {pageState === 'analyzing' ? (
            <>
              <Loader2 className="mr-2 size-5 animate-spin" />
              <span data-testid="analyzing-indicator">Analyzing…</span>
            </>
          ) : (
            <>
              <Brain className="mr-2 size-5" />
              Analyze My Learning
            </>
          )}
        </Button>
      </div>

      {/* No courses yet */}
      {!hasCourses && pageState === 'idle' && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-2">No courses imported yet.</p>
          <Link to="/courses" className="text-brand underline">
            Import a course to get started →
          </Link>
        </div>
      )}

      {/* Analyzing skeleton */}
      {pageState === 'analyzing' && <AnalyzingSkeletons />}

      {/* Error state */}
      {pageState === 'error' && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="size-4" />
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
            <span>{errorMessage ?? 'Something went wrong. Please try again.'}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnalyze}
              data-testid="retry-analyze-button"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {pageState === 'completed' && result && (
        <div>
          {/* Result summary header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="font-display text-xl text-foreground">
              {totalGaps === 0
                ? 'No gaps found'
                : `${totalGaps} gap${totalGaps === 1 ? '' : 's'} across ${affectedCourses} course${affectedCourses === 1 ? '' : 's'}`}
            </h2>

            {/* AI enrichment badge */}
            {!result.aiEnriched && (
              <Badge
                variant="outline"
                className="gap-1.5 text-xs font-normal"
                data-testid="rule-based-analysis-badge"
              >
                <Cpu className="size-3" />
                Rule-based analysis
              </Badge>
            )}
          </div>

          {/* Empty state */}
          {totalGaps === 0 && (
            <div className="text-center py-16" data-testid="no-gaps-state">
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="size-8 text-success" />
              </div>
              <h3 className="font-display text-2xl mb-2">No gaps detected!</h3>
              <p className="text-muted-foreground text-lg">
                Your study coverage looks great. Keep it up!
              </p>
            </div>
          )}

          {/* Gap cards grouped by course */}
          {totalGaps > 0 && (
            <div className="space-y-8" data-testid="knowledge-gaps-list">
              {[...gapsByCourse.entries()].map(([courseId, courseGaps]) => (
                <section key={courseId}>
                  <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide mb-3 px-1">
                    {courseGaps[0]?.courseTitle ?? courseId}
                  </h3>
                  <div className="space-y-4">
                    {courseGaps.map(gap => (
                      <GapCard key={`${gap.courseId}:${gap.videoId}`} gap={gap} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
