import { useState, useEffect } from 'react'
import { ClipboardList, Target, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyState } from '@/app/components/EmptyState'
import { db } from '@/db'
import {
  calculateRetakeFrequency,
  interpretRetakeFrequency,
  type RetakeFrequencyResult,
} from '@/lib/analytics'
import { toast } from 'sonner'

interface QuizAnalyticsData {
  totalQuizzes: number
  totalAttempts: number
  averageScore: number
  retakeData: RetakeFrequencyResult
}

export function QuizAnalyticsTab() {
  const [data, setData] = useState<QuizAnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadData() {
      try {
        const [quizCount, attempts, retakeData] = await Promise.all([
          db.quizzes.count(),
          db.quizAttempts.toArray(),
          calculateRetakeFrequency(),
        ])

        if (ignore) return

        const averageScore =
          attempts.length > 0
            ? attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length
            : 0

        setData({
          totalQuizzes: quizCount,
          totalAttempts: attempts.length,
          averageScore,
          retakeData,
        })
      } catch (err) {
        console.error('[QuizAnalytics] Failed to load stats:', err)
        if (!ignore) {
          toast.error('Failed to load quiz analytics')
        }
      } finally {
        if (!ignore) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      ignore = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading quiz analytics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-[24px]" />
      </div>
    )
  }

  if (!data || data.totalAttempts === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No quizzes taken yet"
        description="Complete a quiz to see your performance analytics here"
        actionLabel="Browse Courses"
        actionHref="/courses"
      />
    )
  }

  return (
    <section aria-labelledby="quiz-analytics-heading" className="space-y-6">
      <h2 id="quiz-analytics-heading" className="sr-only">
        Quiz Analytics
      </h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="quiz-total-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-xl bg-brand-soft p-2">
                <ClipboardList className="size-4 text-brand-soft-foreground" aria-hidden="true" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">{data.totalAttempts}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quizzes Taken ({data.totalQuizzes} unique)
            </p>
          </CardContent>
        </Card>

        <Card data-testid="quiz-avg-score-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-xl bg-brand-soft p-2">
                <Target className="size-4 text-brand-soft-foreground" aria-hidden="true" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">{Math.round(data.averageScore)}%</p>
            <p className="text-sm text-muted-foreground mt-1">Average Score</p>
          </CardContent>
        </Card>

        <Card data-testid="quiz-retake-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-xl bg-brand-soft p-2">
                <RotateCcw className="size-4 text-brand-soft-foreground" aria-hidden="true" />
              </div>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {data.retakeData.averageRetakes.toFixed(1)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Average Retakes</p>
          </CardContent>
        </Card>
      </div>

      {/* Retake frequency detail */}
      <Card data-testid="quiz-retake-detail-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="size-4 text-muted-foreground" aria-hidden="true" />
            Retake Frequency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{data.retakeData.averageRetakes.toFixed(1)}</div>
          <p className="text-sm text-muted-foreground mt-1">attempts per quiz</p>
          <p className="text-sm text-muted-foreground mt-2">
            {interpretRetakeFrequency(data.retakeData.averageRetakes)}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
