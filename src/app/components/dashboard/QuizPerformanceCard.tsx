import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { ClipboardList, ArrowRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Skeleton } from '@/app/components/ui/skeleton'
import { calculateQuizMetrics } from '@/lib/quizMetrics'
import type { QuizMetrics } from '@/lib/quizMetrics'

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function QuizPerformanceSkeleton() {
  return (
    <div
      className="rounded-[24px] border border-border/50 bg-card p-6"
      aria-busy="true"
      aria-label="Loading quiz performance"
      data-testid="quiz-performance-skeleton"
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
      <Skeleton className="h-3.5 w-44 mt-5" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metric row
// ---------------------------------------------------------------------------

function MetricRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums" data-testid={testId}>
        {value}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function QuizEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-6 text-center"
      data-testid="quiz-performance-empty"
    >
      <div className="size-12 rounded-full bg-brand-soft flex items-center justify-center mb-3">
        <ClipboardList className="size-5 text-brand-soft-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        No quizzes completed yet. Start a quiz to track your progress!
      </p>
      <Button asChild variant="brand-outline" size="sm" className="rounded-xl">
        <Link to="/courses">Find Quizzes</Link>
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function QuizPerformanceCard() {
  const [metrics, setMetrics] = useState<QuizMetrics | null>(null)

  useEffect(() => {
    let ignore = false

    calculateQuizMetrics()
      .then(result => {
        if (!ignore) setMetrics(result)
      })
      // silent-catch-ok — fallback to zero-state; quizMetrics.ts already logs the error
      .catch(() => {
        if (!ignore) setMetrics({ totalQuizzes: 0, averageScore: 0, completionRate: 0 })
      })

    return () => {
      ignore = true
    }
  }, [])

  if (metrics === null) {
    return <QuizPerformanceSkeleton />
  }

  // B1: When empty, use a plain <div> wrapper (no nested interactive elements)
  if (metrics.totalQuizzes === 0) {
    return (
      <div
        className="w-full text-left rounded-[24px] border border-border/50 bg-card p-6"
        data-testid="quiz-performance-card"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Quiz Performance</h2>
          <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>

        <QuizEmptyState />
      </div>
    )
  }

  return (
    <div
      className="relative w-full text-left rounded-[24px] border border-border/50 bg-card p-6 hover:border-brand-muted motion-safe:transition-colors motion-safe:duration-200"
      data-testid="quiz-performance-card"
    >
      {/* Card-level link overlay — visually hidden, stretches to fill the card */}
      <Link
        to="/reports?tab=quizzes"
        className="absolute inset-0 rounded-[24px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label="Quiz Performance — view detailed analytics"
        tabIndex={0}
      >
        <span className="sr-only">View quiz performance details</span>
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Quiz Performance</h2>
        <ClipboardList className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="space-y-1 divide-y divide-border/40">
        <MetricRow
          label="Quizzes Completed"
          value={String(metrics.totalQuizzes)}
          testId="metric-quizzes-completed"
        />
        <MetricRow
          label="Average Score"
          value={`${Math.round(metrics.averageScore)}%`}
          testId="metric-average-score"
        />
        <MetricRow
          label="Completion Rate"
          value={`${Math.round(metrics.completionRate)}%`}
          testId="metric-completion-rate"
        />
      </div>

      <div className="relative z-10 mt-4 pt-3 border-t border-border/40">
        <Link
          to="/reports?tab=quizzes"
          className="inline-flex items-center gap-1 text-xs text-brand-soft-foreground hover:text-brand-hover motion-safe:transition-colors py-2 -my-2"
        >
          View Detailed Analytics
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}
