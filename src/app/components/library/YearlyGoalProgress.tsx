/**
 * YearlyGoalProgress — shows books finished this year vs yearly goal.
 *
 * Displays a linear progress bar with "X/Y books" label and a pace
 * indicator ("N books ahead/behind schedule").
 *
 * @module YearlyGoalProgress
 */
import { useMemo } from 'react'
import { useBookStore } from '@/stores/useBookStore'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { Progress } from '@/app/components/ui/progress'

export function YearlyGoalProgress() {
  const goal = useReadingGoalStore(s => s.goal)
  const books = useBookStore(s => s.books)

  const { finishedThisYear, paceLabel, paceColor, progressPct } = useMemo(() => {
    if (!goal || goal.yearlyBookTarget <= 0) {
      return { finishedThisYear: 0, paceLabel: '', paceColor: '', progressPct: 0 }
    }

    const currentYear = new Date().getFullYear().toString()
    const finishedThisYear = books.filter(
      b => b.status === 'finished' && b.finishedAt?.startsWith(currentYear)
    ).length

    // Pace: how many books should be done by now
    const now = new Date()
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
    )
    const expectedByNow = (goal.yearlyBookTarget / 365) * dayOfYear
    const diff = Math.round(finishedThisYear - expectedByNow)

    let paceLabel = ''
    let paceColor = ''
    if (diff > 0) {
      paceLabel = `${diff} book${diff !== 1 ? 's' : ''} ahead of schedule`
      paceColor = 'text-success'
    } else if (diff < 0) {
      const behind = Math.abs(diff)
      paceLabel = `${behind} book${behind !== 1 ? 's' : ''} behind schedule`
      paceColor = 'text-warning'
    } else {
      paceLabel = 'On track'
      paceColor = 'text-success'
    }

    const progressPct = Math.min((finishedThisYear / goal.yearlyBookTarget) * 100, 100)

    return { finishedThisYear, paceLabel, paceColor, progressPct }
  }, [goal, books])

  if (!goal || goal.yearlyBookTarget <= 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {finishedThisYear}/{goal.yearlyBookTarget} books
        </span>
        <span className={paceColor}>{paceLabel}</span>
      </div>
      <Progress
        value={progressPct}
        className="h-1.5 bg-brand-soft"
        aria-label={`Yearly reading goal: ${finishedThisYear} of ${goal.yearlyBookTarget} books finished`}
      />
    </div>
  )
}
