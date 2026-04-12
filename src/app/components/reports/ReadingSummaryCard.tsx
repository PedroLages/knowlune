/**
 * ReadingSummaryCard — annual reading summary with key metrics.
 *
 * Shows: books finished this year vs yearly goal, avg pages per session,
 * longest reading session, and most read author. Each metric shows "—"
 * when insufficient data. Renders null when no books are finished.
 *
 * @module ReadingSummaryCard
 * @since E112-S02
 */
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Clock, User, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { getReadingSummary, formatReadingTime, type ReadingSummary } from '@/services/ReadingStatsService'

interface SummaryPillProps {
  icon: React.ReactNode
  label: string
  value: string
  'data-testid'?: string
}

function SummaryPill({ icon, label, value, 'data-testid': testId }: SummaryPillProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-brand-soft p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        data-testid={testId}
        className="text-lg font-semibold tabular-nums text-brand-soft-foreground truncate"
      >
        {value}
      </p>
    </div>
  )
}

export function ReadingSummaryCard() {
  const [summary, setSummary] = useState<ReadingSummary | null | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  const loadSummary = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getReadingSummary()
      setSummary(result)
    } catch (err) {
      // silent-catch-ok: reading summary is non-critical display data
      console.error('[ReadingSummaryCard] Failed to load reading summary:', err)
      setSummary(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  if (isLoading) {
    return <Skeleton className="h-48 rounded-xl" />
  }

  // AC4: render null when no finished books
  if (!summary) return null

  const booksThisYearValue = summary.yearlyGoal != null
    ? `${summary.booksFinishedThisYear} / ${summary.yearlyGoal}`
    : `${summary.booksFinishedThisYear}`

  return (
    <Card data-testid="reading-summary-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
          Reading Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <SummaryPill
            icon={<BookOpen className="size-3.5" aria-hidden="true" />}
            label="Books This Year"
            value={booksThisYearValue}
            data-testid="summary-books-this-year"
          />
          <SummaryPill
            icon={<BookOpen className="size-3.5" aria-hidden="true" />}
            label="Avg Pages / Session"
            value={summary.avgPagesPerSession != null ? `${summary.avgPagesPerSession} pages` : '—'}
            data-testid="summary-avg-pages"
          />
          <SummaryPill
            icon={<Clock className="size-3.5" aria-hidden="true" />}
            label="Longest Session"
            value={summary.longestSessionMinutes != null ? formatReadingTime(summary.longestSessionMinutes) : '—'}
            data-testid="summary-longest-session"
          />
          <SummaryPill
            icon={<User className="size-3.5" aria-hidden="true" />}
            label="Most Read Author"
            value={summary.mostReadAuthor ?? '—'}
            data-testid="summary-most-read-author"
          />
        </div>
      </CardContent>
    </Card>
  )
}
