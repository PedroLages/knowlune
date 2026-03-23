import { Fragment, useState, useEffect, useMemo } from 'react'
import { cn } from '@/app/components/ui/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip'
import { Button } from '@/app/components/ui/button'
import { db } from '@/db'
import { toLocalDateString } from '@/lib/dateUtils'
import {
  aggregateSessionsByDay,
  buildHeatmapGrid,
  getMonthlyHeatmapSummary,
  formatStudyTime,
  type HeatmapLevel,
} from '@/lib/activityHeatmap'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const LEVEL_CLASSES: Record<HeatmapLevel, string> = {
  0: 'bg-heatmap-empty',
  1: 'bg-heatmap-level-1',
  2: 'bg-heatmap-level-2',
  3: 'bg-heatmap-level-3',
  4: 'bg-heatmap-level-4',
}

const LEGEND_LABELS: Record<HeatmapLevel, string> = {
  0: 'No activity',
  1: '< 15 min',
  2: '15–44 min',
  3: '45–89 min',
  4: '90+ min',
}

export function ActivityHeatmap() {
  const [dayMap, setDayMap] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [showTable, setShowTable] = useState(false)

  const today = useMemo(() => toLocalDateString(), [])

  useEffect(() => {
    let ignore = false

    const load = async () => {
      try {
        const sessions = await db.studySessions.toArray()
        if (!ignore) {
          setDayMap(aggregateSessionsByDay(sessions, today))
          setIsLoading(false)
        }
      } catch (err) {
        // silent-catch-ok: background data load — component renders empty state naturally
        console.error('[ActivityHeatmap] Failed to load study sessions:', err)
        if (!ignore) setIsLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [today])

  // Refresh when sessions change (new lesson completed, session ended, etc.)
  useEffect(() => {
    const handler = async () => {
      try {
        const sessions = await db.studySessions.toArray()
        setDayMap(aggregateSessionsByDay(sessions, today))
      } catch (err) {
        // silent-catch-ok: background refresh on event — stale data shown, non-critical
        console.error('[ActivityHeatmap] Failed to refresh study sessions:', err)
      }
    }
    window.addEventListener('study-log-updated', handler)
    return () => window.removeEventListener('study-log-updated', handler)
  }, [today])

  const { grid, monthLabels, totalWeeks } = useMemo(
    () => buildHeatmapGrid(dayMap, today),
    [dayMap, today]
  )

  const monthlySummary = useMemo(() => getMonthlyHeatmapSummary(dayMap), [dayMap])

  const totalActiveDays = useMemo(() => {
    let count = 0
    for (const [, seconds] of dayMap) {
      if (seconds > 0) count++
    }
    return count
  }, [dayMap])

  if (isLoading) {
    return (
      <div
        data-testid="activity-heatmap-skeleton"
        className="h-32 bg-muted/50 rounded-xl animate-pulse"
        aria-busy="true"
        aria-label="Loading activity heatmap"
      />
    )
  }

  return (
    <div data-testid="activity-heatmap">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalActiveDays} active day{totalActiveDays !== 1 ? 's' : ''} in the past year
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowTable(v => !v)}
          aria-pressed={showTable}
          className="text-xs min-h-[44px]"
        >
          {showTable ? 'View as grid' : 'View as table'}
        </Button>
      </div>

      {showTable ? (
        /* ── Accessible table view ── */
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm border-collapse"
            aria-label="Monthly study activity summary"
          >
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Month</th>
                <th className="text-right py-2 pr-4 font-medium text-muted-foreground">
                  Active Days
                </th>
                <th className="text-right py-2 font-medium text-muted-foreground">
                  Total Study Time
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map(month => (
                <tr key={month.label} className="border-b border-border/50">
                  <td className="py-2 pr-4">{month.label}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{month.activeDays}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatStudyTime(month.totalSeconds)}
                  </td>
                </tr>
              ))}
              {monthlySummary.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-muted-foreground text-sm">
                    No study sessions recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Heatmap grid view ── */
        <div className="overflow-x-auto -mx-1 px-1">
          <TooltipProvider>
            <div
              role="group"
              aria-label={`Study activity heatmap — ${totalActiveDays} active day${totalActiveDays !== 1 ? 's' : ''} in the past year`}
              className="grid gap-[3px]"
              style={{
                gridTemplateColumns: `auto repeat(${totalWeeks}, minmax(8px, 1fr))`,
                gridTemplateRows: 'auto repeat(7, 1fr)',
              }}
            >
              {/* Month labels row */}
              <div aria-hidden="true" /> {/* empty top-left corner */}
              {Array.from({ length: totalWeeks }, (_, colIdx) => {
                const label = monthLabels.find(m => m.colStart === colIdx)
                return (
                  <div
                    key={`month-${colIdx}`}
                    aria-hidden="true"
                    className="text-[10px] text-muted-foreground h-4 flex items-end px-0.5 leading-none"
                  >
                    {label?.label ?? ''}
                  </div>
                )
              })}
              {/* Day rows (Sun=0 through Sat=6) */}
              {[0, 1, 2, 3, 4, 5, 6].map(dayIdx => (
                <Fragment key={`row-${dayIdx}`}>
                  {/* Day label (show Mon, Wed, Fri only — odd rows) */}
                  <div
                    aria-hidden="true"
                    className="text-[10px] text-muted-foreground pr-2 h-[14px] flex items-center justify-end leading-none"
                  >
                    {dayIdx % 2 === 1 ? DAY_LABELS[dayIdx] : ''}
                  </div>

                  {/* Activity cells for this day across all weeks */}
                  {Array.from({ length: totalWeeks }, (_, wi) => {
                    const day = grid[dayIdx]?.[wi] ?? null

                    if (!day) {
                      return <div key={`pad-${dayIdx}-${wi}`} aria-hidden="true" />
                    }

                    const d = new Date(day.date + 'T12:00:00')
                    const formattedDate = d.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })

                    const ariaLabel =
                      day.totalSeconds > 0
                        ? `${formattedDate}: ${formatStudyTime(day.totalSeconds)} studied`
                        : `${formattedDate}: No activity`

                    return (
                      <Tooltip key={day.date}>
                        <TooltipTrigger asChild>
                          <div
                            tabIndex={0}
                            role="img"
                            aria-label={ariaLabel}
                            className={cn(
                              'aspect-square w-full rounded-[3px]',
                              'motion-safe:transition-[transform,box-shadow] motion-safe:duration-150',
                              'motion-safe:hover:scale-110 motion-safe:hover:shadow-md',
                              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                              day.isToday && 'ring-2 ring-brand ring-offset-1 ring-offset-card',
                              LEVEL_CLASSES[day.level]
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <div className="text-xs space-y-1 min-w-[140px]">
                            <div className="font-semibold">{formattedDate}</div>
                            <div className="text-muted-foreground">
                              {formatStudyTime(day.totalSeconds)}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="flex items-center gap-1">
              {([0, 1, 2, 3, 4] as HeatmapLevel[]).map(level => (
                <Tooltip key={level}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn('size-3 rounded-[3px] cursor-default', LEVEL_CLASSES[level])}
                      aria-label={LEGEND_LABELS[level]}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <span className="text-xs">{LEGEND_LABELS[level]}</span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <span>More</span>
            <span className="ml-auto flex items-center gap-1.5">
              <div className="size-3 rounded-[3px] ring-2 ring-brand ring-offset-1 ring-offset-card" />
              Today
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
