import { Fragment, useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

/** Shared date formatter — avoids creating Intl.DateTimeFormat per cell. */
const cellDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

/** Compute 365-day cutoff as ISO string for bounded DB query. */
function getCutoffISOString(todayStr: string): string {
  const d = new Date(todayStr + 'T00:00:00')
  d.setDate(d.getDate() - 365)
  return d.toISOString()
}

export function ActivityHeatmap() {
  const [dayMap, setDayMap] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [showTable, setShowTable] = useState(false)

  // HIGH #1: Recompute `today` on each render so it stays correct past midnight.
  // toLocalDateString() is a cheap YYYY-MM-DD formatter — no memoization needed.
  const today = toLocalDateString()

  // Track the grid container for roving tabindex (NIT #2)
  const gridRef = useRef<HTMLDivElement>(null)

  /** Fetch sessions bounded to the 365-day window. */
  const fetchSessions = useCallback(async (todayStr: string) => {
    const cutoff = getCutoffISOString(todayStr)
    // MEDIUM #2: Use indexed `.where('startTime').above(cutoff)` instead of `.toArray()`.
    return db.studySessions.where('startTime').above(cutoff).toArray()
  }, [])

  useEffect(() => {
    let ignore = false

    const load = async () => {
      try {
        const sessions = await fetchSessions(today)
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
  }, [today, fetchSessions])

  // MEDIUM #1: Debounce `study-log-updated` events to avoid redundant full-table scans.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    const handler = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(async () => {
        try {
          const sessions = await fetchSessions(today)
          setDayMap(aggregateSessionsByDay(sessions, today))
        } catch (err) {
          // silent-catch-ok: background refresh on event — stale data shown, non-critical
          console.error('[ActivityHeatmap] Failed to refresh study sessions:', err)
        }
      }, 300)
    }

    window.addEventListener('study-log-updated', handler)
    return () => {
      window.removeEventListener('study-log-updated', handler)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [today, fetchSessions])

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

  // HIGH #2: Memoize grid style object keyed on `totalWeeks`.
  const gridStyle = useMemo(
    () => ({
      gridTemplateColumns: `auto repeat(${totalWeeks}, minmax(8px, 1fr))`,
      gridTemplateRows: 'auto repeat(7, 1fr)',
    }),
    [totalWeeks]
  )

  // HIGH #3: Pre-compute formatted dates for all cells to avoid Intl calls in the render loop.
  const formattedDates = useMemo(() => {
    const result = new Map<string, string>()
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const row = grid[dayIdx]
      if (!row) continue
      for (let wi = 0; wi < totalWeeks; wi++) {
        const day = row[wi]
        if (!day) continue
        const d = new Date(day.date + 'T12:00:00')
        result.set(day.date, cellDateFormatter.format(d))
      }
    }
    return result
  }, [grid, totalWeeks])

  // NIT #2: Roving tabindex — only the first cell gets tabIndex=0, others get -1.
  // Arrow key navigation within the grid.
  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement
      if (target.role !== 'img') return

      const cells = gridRef.current?.querySelectorAll<HTMLElement>('[role="img"]')
      if (!cells) return

      const cellArray = Array.from(cells)
      const currentIndex = cellArray.indexOf(target)
      if (currentIndex === -1) return

      let nextIndex: number | null = null
      switch (e.key) {
        case 'ArrowRight':
          nextIndex = currentIndex + 7 < cellArray.length ? currentIndex + 7 : null
          break
        case 'ArrowLeft':
          nextIndex = currentIndex - 7 >= 0 ? currentIndex - 7 : null
          break
        case 'ArrowDown':
          nextIndex = currentIndex + 1 < cellArray.length ? currentIndex + 1 : null
          break
        case 'ArrowUp':
          nextIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : null
          break
        default:
          return
      }

      if (nextIndex !== null) {
        e.preventDefault()
        target.tabIndex = -1
        cellArray[nextIndex].tabIndex = 0
        cellArray[nextIndex].focus()
      }
    },
    []
  )

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

  // Track cell index for roving tabindex
  let cellIndex = 0

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
              ref={gridRef}
              role="group"
              aria-label={`Study activity heatmap — ${totalActiveDays} active day${totalActiveDays !== 1 ? 's' : ''} in the past year`}
              className="grid gap-[3px]"
              style={gridStyle}
              onKeyDown={handleGridKeyDown}
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

                    const formattedDate = formattedDates.get(day.date) ?? day.date

                    const ariaLabel =
                      day.totalSeconds > 0
                        ? `${formattedDate}: ${formatStudyTime(day.totalSeconds)} studied`
                        : `${formattedDate}: No activity`

                    // NIT #2: roving tabindex — only first cell is tabbable
                    const isFirstCell = cellIndex === 0
                    cellIndex++

                    return (
                      <Tooltip key={day.date}>
                        <TooltipTrigger asChild>
                          <div
                            tabIndex={isFirstCell ? 0 : -1}
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
                      className={cn('size-3 rounded-[3px] cursor-help', LEVEL_CLASSES[level])}
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
