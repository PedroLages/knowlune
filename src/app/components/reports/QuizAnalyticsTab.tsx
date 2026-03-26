import { useState, useEffect } from 'react'
import { AlertTriangle, ClipboardList, Target, Trophy, TrendingDown } from 'lucide-react'
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
import { MotionConfig, motion } from 'motion/react'
import { staggerContainer, fadeUp } from '@/lib/motion'

interface QuizPerformance {
  quizId: string
  quizTitle: string
  averageScore: number
}

interface QuizAnalyticsData {
  totalQuizzes: number
  totalAttempts: number
  averageScore: number
  retakeData: RetakeFrequencyResult
  bestQuiz: QuizPerformance | null
  worstQuiz: QuizPerformance | null
}

export function QuizAnalyticsTab() {
  const [data, setData] = useState<QuizAnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadData() {
      try {
        // Aggregate scores with constant memory using each() cursor
        let totalScore = 0
        let attemptCount = 0
        const perQuiz = new Map<string, { totalScore: number; count: number }>()

        await Promise.all([
          db.quizAttempts.each(attempt => {
            totalScore += attempt.percentage ?? 0
            attemptCount++
            const entry = perQuiz.get(attempt.quizId)
            if (entry) {
              entry.totalScore += attempt.percentage ?? 0
              entry.count++
            } else {
              perQuiz.set(attempt.quizId, {
                totalScore: attempt.percentage ?? 0,
                count: 1,
              })
            }
          }),
        ])

        if (ignore) return

        const averageScore = attemptCount > 0 ? totalScore / attemptCount : 0

        // Resolve quiz names and find best/worst
        let bestQuiz: QuizPerformance | null = null
        let worstQuiz: QuizPerformance | null = null

        if (perQuiz.size > 0) {
          const quizIds = [...perQuiz.keys()]
          const quizRecords = await db.quizzes.where('id').anyOf(quizIds).toArray()
          const quizNameMap = new Map(quizRecords.map(q => [q.id, q.title]))

          let bestAvg = -Infinity
          let worstAvg = Infinity

          for (const [quizId, stats] of perQuiz) {
            const avg = stats.totalScore / stats.count
            const title = quizNameMap.get(quizId) ?? `Quiz ${quizId}`

            if (avg > bestAvg) {
              bestAvg = avg
              bestQuiz = { quizId, quizTitle: title, averageScore: avg }
            }
            if (avg < worstAvg) {
              worstAvg = avg
              worstQuiz = { quizId, quizTitle: title, averageScore: avg }
            }
          }

          // If only one quiz, don't show it as both best and worst
          if (perQuiz.size === 1) {
            worstQuiz = null
          }
        }

        const [quizCount, retakeData] = await Promise.all([
          db.quizzes.count(),
          calculateRetakeFrequency(),
        ])

        if (ignore) return

        setData({
          totalQuizzes: quizCount,
          totalAttempts: attemptCount,
          averageScore,
          retakeData,
          bestQuiz,
          worstQuiz,
        })
      } catch (err) {
        console.error('[QuizAnalytics] Failed to load stats:', err)
        if (!ignore) {
          setError(true)
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

  if (error) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Failed to load quiz analytics"
        description="Something went wrong while loading your quiz data. Please try again later."
      />
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
    <MotionConfig reducedMotion="user">
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        <section aria-labelledby="quiz-analytics-heading" className="space-y-6">
          <h2 id="quiz-analytics-heading" className="sr-only">
            Quiz Analytics
          </h2>

          {/* Stat cards */}
          <motion.div
            variants={fadeUp}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <Card data-testid="quiz-total-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-xl bg-brand-soft p-2">
                    <ClipboardList
                      className="size-4 text-brand-soft-foreground"
                      aria-hidden="true"
                    />
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

            <Card data-testid="quiz-completion-rate-card">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="rounded-xl bg-brand-soft p-2">
                    <Target className="size-4 text-brand-soft-foreground" aria-hidden="true" />
                  </div>
                </div>
                <p className="text-2xl font-bold tabular-nums">
                  {data.totalQuizzes > 0
                    ? (data.totalAttempts / data.totalQuizzes).toFixed(1)
                    : '0'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Attempts per Quiz</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Retake frequency detail */}
          <motion.div variants={fadeUp}>
            <Card data-testid="quiz-retake-detail-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="size-4 text-muted-foreground" aria-hidden="true" />
                  Retake Frequency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(Number.isFinite(data.retakeData.averageRetakes)
                    ? data.retakeData.averageRetakes
                    : 0
                  ).toFixed(1)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">attempts per quiz</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {interpretRetakeFrequency(
                    Number.isFinite(data.retakeData.averageRetakes)
                      ? data.retakeData.averageRetakes
                      : 0
                  )}
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Best & Worst performing quizzes */}
          {(data.bestQuiz || data.worstQuiz) && (
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.bestQuiz && (
                <Card data-testid="quiz-best-performing-card">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trophy className="size-4 text-success" aria-hidden="true" />
                      Best Performing Quiz
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold truncate" title={data.bestQuiz.quizTitle}>
                      {data.bestQuiz.quizTitle}
                    </p>
                    <p className="text-2xl font-bold tabular-nums mt-1">
                      {Math.round(data.bestQuiz.averageScore)}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">average score</p>
                  </CardContent>
                </Card>
              )}

              {data.worstQuiz && (
                <Card data-testid="quiz-worst-performing-card">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingDown className="size-4 text-destructive" aria-hidden="true" />
                      Needs Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-semibold truncate" title={data.worstQuiz.quizTitle}>
                      {data.worstQuiz.quizTitle}
                    </p>
                    <p className="text-2xl font-bold tabular-nums mt-1">
                      {Math.round(data.worstQuiz.averageScore)}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">average score</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </section>
      </motion.div>
    </MotionConfig>
  )
}
