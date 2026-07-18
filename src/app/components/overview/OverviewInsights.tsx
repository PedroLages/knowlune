import { Link } from 'react-router'
import { ArrowRight, BookOpenText, Brain, ClipboardCheck } from 'lucide-react'
import { Progress } from '@/app/components/ui/progress'
import type { LearningInsights } from '@/lib/overviewDashboard'

interface OverviewInsightsProps {
  insights: LearningInsights
}

function CardHeader({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof Brain
  title: string
  description: string
  href: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-brand" aria-hidden="true" />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <Link
        to={href}
        className="inline-flex min-h-11 items-center rounded-lg px-2 text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        aria-label={`View ${title.toLowerCase()}`}
      >
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  )
}

function MasteryCard({ insights }: OverviewInsightsProps) {
  if (insights.mastery.length === 0) return null
  return (
    <article className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <CardHeader
        icon={Brain}
        title="Mastery"
        description="Current knowledge-map signals"
        href="/knowledge-map"
      />
      <div className="mt-5 space-y-4">
        {insights.mastery.map(topic => (
          <div key={topic.name}>
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">{topic.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">
                {Math.round(topic.score)}%
              </span>
            </div>
            <Progress
              value={topic.score}
              className="mt-2 h-1.5"
              labelFormat={value => `${topic.name} mastery is ${Math.round(value)}%`}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {topic.retention === null
                ? 'Retention appears after spaced-repetition reviews.'
                : `${Math.round(topic.retention * 100)}% estimated retention`}
            </p>
          </div>
        ))}
      </div>
    </article>
  )
}

function AssessmentCard({ insights }: OverviewInsightsProps) {
  const assessment = insights.assessment
  if (!assessment) return null
  return (
    <article className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <CardHeader
        icon={ClipboardCheck}
        title="Assessments"
        description="Completed quiz attempts only"
        href="/reports?tab=quizzes"
      />
      <div className="mt-5 flex items-end justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs text-muted-foreground">Real average</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{assessment.averageScore}%</p>
        </div>
        <p className="text-xs text-muted-foreground">{assessment.attempts.length} recent</p>
      </div>
      <div className="mt-4 space-y-3">
        {assessment.attempts.map(attempt => (
          <div
            key={attempt.id}
            className="grid grid-cols-[68px_1fr_38px] items-center gap-2 text-xs"
          >
            <span className="text-muted-foreground">{attempt.label}</span>
            <Progress
              value={attempt.percentage}
              className="h-1.5"
              labelFormat={value => `${attempt.label} score was ${Math.round(value)}%`}
            />
            <span className="text-right font-medium tabular-nums">{attempt.percentage}%</span>
          </div>
        ))}
      </div>
      {assessment.weakTopics.length > 0 && (
        <div className="mt-5 rounded-2xl bg-warning-soft p-4">
          <p className="text-xs font-semibold text-warning">Topics to reinforce</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {assessment.weakTopics.map(topic => (
              <li key={topic.name} className="flex justify-between gap-3">
                <span className="truncate">{topic.name}</span>
                <span className="shrink-0 tabular-nums">
                  {topic.accuracy}% · {topic.answers} answers
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function ReadingCard({ insights }: OverviewInsightsProps) {
  const reading = insights.reading
  if (!reading) return null
  return (
    <article className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <CardHeader
        icon={BookOpenText}
        title="Reading"
        description="PDF activity from the last 30 days"
        href="/reports?tab=study"
      />
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-[11px] text-muted-foreground">Minutes</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{reading.minutesLast30Days}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Pages reached</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">{reading.pagesReached}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Documents</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums">
            {reading.documentsWithProgress}
          </dd>
        </div>
      </dl>
      {reading.recentItem ? (
        <div className="mt-5 rounded-2xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">Most recently read</p>
          <p className="mt-1 truncate text-sm font-medium">{reading.recentItem.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {reading.recentItem.courseName} · page {reading.recentItem.currentPage} of{' '}
            {reading.recentItem.totalPages}
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-muted/60 p-4 text-xs text-muted-foreground">
          Reading time is available; page progress will appear when a PDF reports it.
        </p>
      )}
    </article>
  )
}

export function OverviewInsights({ insights }: OverviewInsightsProps) {
  const visibleCards =
    Number(insights.mastery.length > 0) +
    Number(Boolean(insights.assessment)) +
    Number(Boolean(insights.reading))
  if (visibleCards === 0) return null

  return (
    <section aria-labelledby="overview-insights-title" data-testid="section-insights">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Learning insights
        </p>
        <h2 id="overview-insights-title" className="mt-1 text-xl font-semibold">
          Signals grounded in your own learning data
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MasteryCard insights={insights} />
        <AssessmentCard insights={insights} />
        <ReadingCard insights={insights} />
      </div>
    </section>
  )
}
