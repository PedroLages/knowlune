import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, BarChart3, BookOpenCheck, CheckCircle2, Target } from 'lucide-react'
import { Line, LineChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '@/db'
import type { Quiz, QuizAttempt } from '@/types/quiz'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/app/components/ui/chart'
import { Badge } from '@/app/components/ui/badge'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EmptyState } from '@/app/components/EmptyState'
import { toast } from 'sonner'

const chartConfig = {
  score: { label: 'Score', color: 'var(--chart-1)' },
} satisfies ChartConfig

interface QuizReportData {
  quiz: Quiz
  attempts: QuizAttempt[]
  courseId: string | null
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-destructive'
}

export default function QuizReport() {
  const { quizId = '' } = useParams<{ quizId: string }>()
  const [data, setData] = useState<QuizReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const quiz = await db.quizzes.get(quizId)
        if (!quiz) {
          if (!ignore) setData(null)
          return
        }
        const [attempts, video, pdf] = await Promise.all([
          db.quizAttempts.where('quizId').equals(quizId).sortBy('completedAt'),
          db.importedVideos.where('id').equals(quiz.lessonId).first(),
          db.importedPdfs.where('id').equals(quiz.lessonId).first(),
        ])
        if (!ignore) setData({ quiz, attempts, courseId: video?.courseId ?? pdf?.courseId ?? null })
      } catch (loadError) {
        console.error('[QuizReport] Failed to load quiz report:', loadError)
        toast.error('Could not load this quiz report')
        if (!ignore) setError('We could not load this quiz report. Please try again.')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    void load()
    return () => {
      ignore = true
    }
  }, [quizId])

  const chartData = useMemo(
    () =>
      data?.attempts.map((attempt, index) => ({
        attempt: index + 1,
        score: Math.round(attempt.percentage),
      })) ?? [],
    [data]
  )

  const weakTopics = useMemo(() => {
    if (!data) return []
    const questionById = new Map(data.quiz.questions.map(question => [question.id, question]))
    const topicScores = new Map<string, { correct: number; total: number }>()
    for (const attempt of data.attempts) {
      for (const answer of attempt.answers) {
        const topic = questionById.get(answer.questionId)?.topic?.trim()
        if (!topic) continue
        const score = topicScores.get(topic) ?? { correct: 0, total: 0 }
        score.total += 1
        score.correct += answer.isCorrect ? 1 : 0
        topicScores.set(topic, score)
      }
    }
    return [...topicScores]
      .map(([name, score]) => ({ name, accuracy: Math.round((score.correct / score.total) * 100) }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5)
  }, [data])

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading quiz report">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    )
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-destructive/30 bg-card p-8 text-center" role="alert">
        <p className="text-sm text-destructive">{error}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
      </section>
    )
  }

  if (!data || data.attempts.length === 0) {
    return (
      <EmptyState
        icon={BookOpenCheck}
        title="No attempts yet"
        description="Complete this quiz to build a score history and topic report."
        actionLabel="Back to quiz analytics"
        actionHref="/reports?tab=quizzes"
      />
    )
  }

  const latest = data.attempts[data.attempts.length - 1]
  const average = Math.round(data.attempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / data.attempts.length)
  const best = Math.max(...data.attempts.map(attempt => attempt.percentage))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/reports?tab=quizzes" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to quiz analytics
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quiz report</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.quiz.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{data.attempts.length} completed attempt{data.attempts.length === 1 ? '' : 's'}</p>
        </div>
        {data.courseId && (
          <Button asChild variant="outline" className="min-h-11">
            <Link to={`/courses/${data.courseId}/lessons/${data.quiz.lessonId}/quiz`}>
              Open quiz
            </Link>
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Latest score" value={`${Math.round(latest.percentage)}%`} icon={Target} tone={scoreTone(latest.percentage)} />
        <Metric label="Average" value={`${average}%`} icon={BarChart3} tone={scoreTone(average)} />
        <Metric label="Best score" value={`${Math.round(best)}%`} icon={CheckCircle2} tone={scoreTone(best)} />
        <Metric label="Pass rate" value={`${Math.round((data.attempts.filter(attempt => attempt.passed).length / data.attempts.length) * 100)}%`} icon={BookOpenCheck} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Score trajectory</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full" role="img" aria-label="Quiz score trajectory">
              <LineChart data={chartData} accessibilityLayer>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="attempt" tickLine={false} axisLine={false} tickFormatter={value => `#${value}`} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={value => `${value}%`} />
                <Tooltip formatter={value => [`${value}%`, 'Score']} labelFormatter={label => `Attempt ${label}`} />
                <Line dataKey="score" type="monotone" stroke="var(--color-score)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
            <table className="sr-only">
              <caption>Quiz score trajectory</caption>
              <thead><tr><th scope="col">Attempt</th><th scope="col">Score</th></tr></thead>
              <tbody>{chartData.map(point => <tr key={point.attempt}><td>{point.attempt}</td><td>{point.score}%</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Topics to reinforce</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {weakTopics.length > 0 ? weakTopics.map(topic => (
              <div key={topic.name} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 p-3">
                <span className="truncate text-sm font-medium">{topic.name}</span>
                <Badge variant="outline" className={scoreTone(topic.accuracy)}>{topic.accuracy}%</Badge>
              </div>
            )) : <p className="text-sm text-muted-foreground">No weak topics detected yet.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Attempt history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-6 py-3">Attempt</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Score</th><th className="px-6 py-3">Result</th><th className="px-6 py-3" /></tr></thead>
            <tbody>
              {[...data.attempts].reverse().map((attempt, index) => (
                <tr key={attempt.id} className="border-b border-border/60">
                  <td className="px-6 py-3 font-medium">Attempt {data.attempts.length - index}</td>
                  <td className="px-6 py-3 text-muted-foreground">{new Date(attempt.completedAt).toLocaleDateString()}</td>
                  <td className={`px-6 py-3 font-semibold ${scoreTone(attempt.percentage)}`}>{Math.round(attempt.percentage)}%</td>
                  <td className="px-6 py-3">{attempt.passed ? 'Passed' : 'Keep practicing'}</td>
                  <td className="px-6 py-3 text-right">{data.courseId && <Link className="text-brand hover:underline" to={`/courses/${data.courseId}/lessons/${data.quiz.lessonId}/quiz/review/${attempt.id}`}>Review</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value, icon: Icon, tone = 'text-foreground' }: { label: string; value: string; icon: typeof Target; tone?: string }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p></div>
        <Icon className="size-4 text-brand" aria-hidden="true" />
      </div>
    </article>
  )
}
