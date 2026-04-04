import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Trophy, Target, RotateCcw, BookOpen, TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/app/components/ui/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table'
import { Badge } from '@/app/components/ui/badge'
import { EmptyState } from '@/app/components/EmptyState'
import { Skeleton } from '@/app/components/ui/skeleton'
import { calculateQuizAnalytics, type QuizAnalyticsSummary } from '@/lib/analytics'
import { fadeUp } from '@/lib/motion'

function scoreColor(pct: number): string {
  if (pct >= 80) return 'text-success'
  if (pct >= 60) return 'text-warning'
  return 'text-destructive'
}

export function QuizAnalyticsDashboard() {
  const [summary, setSummary] = useState<QuizAnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    // silent-catch-ok: error state updated in component
    calculateQuizAnalytics()
      .then(data => {
        if (!ignore) {
          setSummary(data)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Failed to load quiz analytics:', err)
        if (!ignore) {
          setError('Failed to load analytics. Please try again.')
          setLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [retryKey])

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading quiz analytics">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-52 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        data-testid="quiz-analytics-error"
        className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center"
      >
        <p className="text-sm text-destructive">{error}</p>
        <button
          className="mt-3 text-sm text-brand-soft-foreground hover:underline"
          onClick={() => setRetryKey(k => k + 1)}
        >
          Try again
        </button>
      </div>
    )
  }

  if (!summary || summary.totalQuizzesCompleted === 0) {
    return (
      <EmptyState
        data-testid="quiz-analytics-empty"
        icon={BookOpen}
        title="No quiz data yet"
        description="Complete a quiz to see your analytics."
        actionLabel="Browse Courses"
        actionHref="/courses"
      />
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="sr-only">Quiz Analytics</h2>
      {/* ── Row 1: Metric cards (3-col → 1-col) ── */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        data-testid="quiz-metric-cards"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="size-4" aria-hidden="true" />
              Total Quizzes Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold" data-testid="quiz-total-count">
              {summary.totalQuizzesCompleted}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="size-4" aria-hidden="true" />
              Average Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn('text-3xl font-bold', scoreColor(summary.averageScore))}
              data-testid="quiz-avg-score"
            >
              {summary.averageScore}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="size-4" aria-hidden="true" />
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn('text-3xl font-bold', scoreColor(summary.completionRate))}
              data-testid="quiz-completion-rate"
            >
              {summary.completionRate}%
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Row 2: Average Retake Frequency ── */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
              Average Retake Frequency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="quiz-retake-frequency">
              {summary.averageRetakeFrequency.toFixed(1)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">attempts per quiz</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Row 3: Recent Quizzes table ── */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Quizzes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table aria-label="Recent quiz attempts">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Quiz</TableHead>
                  <TableHead scope="col">Score</TableHead>
                  <TableHead scope="col">Date</TableHead>
                  <TableHead scope="col">
                    <span className="sr-only">Detail</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recentAttempts.map(attempt => (
                  <TableRow key={attempt.id} data-testid="quiz-recent-row">
                    <TableCell className="font-medium">{attempt.quizTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={scoreColor(attempt.percentage)}>
                        {attempt.percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {(() => {
                        const d = new Date(attempt.completedAt)
                        return isNaN(d.getTime())
                          ? 'Unknown'
                          : d.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                      })()}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/reports/quiz/${attempt.quizId}`}
                        className="block py-3 text-brand-soft-foreground text-sm hover:underline"
                        aria-label={`View details for ${attempt.quizTitle}`}
                      >
                        Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Row 4: Top/Bottom performing (2-col → 1-col) ── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Card data-testid="top-performing-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-success" aria-hidden="true" />
              Top Performing Quizzes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.topPerforming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              summary.topPerforming.map(quiz => (
                <div key={quiz.quizId} className="flex items-center justify-between">
                  <Link
                    to={`/reports/quiz/${quiz.quizId}`}
                    className="text-sm text-brand-soft-foreground hover:underline truncate max-w-[160px]"
                    aria-label={`View details for ${quiz.quizTitle}`}
                  >
                    {quiz.quizTitle}
                  </Link>
                  <Badge
                    variant="outline"
                    className={cn('ml-2 shrink-0', scoreColor(quiz.averageScore))}
                  >
                    {quiz.averageScore}%
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card data-testid="needs-improvement-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="size-4 text-warning" aria-hidden="true" />
              Quizzes Needing Practice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.needsImprovement.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet</p>
            ) : (
              summary.needsImprovement.map(quiz => (
                <div key={quiz.quizId} className="flex items-center justify-between">
                  <Link
                    to={`/reports/quiz/${quiz.quizId}`}
                    className="text-sm text-brand-soft-foreground hover:underline truncate max-w-[160px]"
                    aria-label={`View details for ${quiz.quizTitle}`}
                  >
                    {quiz.quizTitle}
                  </Link>
                  <Badge
                    variant="outline"
                    className={cn('ml-2 shrink-0', scoreColor(quiz.averageScore))}
                  >
                    {quiz.averageScore}%
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
