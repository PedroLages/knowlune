/**
 * Compact 13-week calendar heat map for reading streak visualization.
 *
 * Reuses `getActivityLevel` from `activityHeatmap.ts` and existing
 * heatmap design tokens (--heatmap-empty through --heatmap-level-4).
 *
 * @since Library Redesign
 */

import { memo, useMemo } from 'react'
import { getActivityLevel } from '@/lib/activityHeatmap'
import { toLocalDateString } from '@/lib/dateUtils'
import { cn } from '@/app/components/ui/utils'

interface CalendarHeatMapProps {
  dayMap: Map<string, number> // YYYY-MM-DD → seconds studied
  today: string // YYYY-MM-DD
  weeks?: number // default 13
  className?: string
}

const LEVEL_CLASSES: Record<number, string> = {
  0: 'bg-[var(--heatmap-empty)]',
  1: 'bg-[var(--heatmap-level-1)]',
  2: 'bg-[var(--heatmap-level-2)]',
  3: 'bg-[var(--heatmap-level-3)]',
  4: 'bg-[var(--heatmap-level-4)]',
}

const DAY_LABELS = ['', 'M', '', 'W', '', 'F', '']

export const CalendarHeatMap = memo(function CalendarHeatMap({
  dayMap,
  today,
  weeks = 13,
  className,
}: CalendarHeatMapProps) {
  const grid = useMemo(() => {
    const totalDays = weeks * 7
    const endDate = new Date(today + 'T12:00:00')
    const cells: { date: string; level: number }[] = []

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(endDate)
      d.setDate(d.getDate() - i)
      const dateStr = toLocalDateString(d)
      const seconds = dayMap.get(dateStr) ?? 0
      cells.push({ date: dateStr, level: getActivityLevel(seconds) })
    }
    return cells
  }, [dayMap, today, weeks])

  // Group cells into columns (weeks), each with 7 rows (days)
  const columns: typeof grid[] = []
  for (let w = 0; w < weeks; w++) {
    columns.push(grid.slice(w * 7, (w + 1) * 7))
  }

  const activeDays = grid.filter(c => c.level > 0).length

  return (
    <div className={cn('flex flex-col gap-2', className)} role="img" aria-label={`Reading activity: ${activeDays} active days in the last ${weeks} weeks`}>
      {/* Legend */}
      <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
        <span>Past {weeks} Weeks</span>
        <span className="flex gap-1 items-center">
          Less
          {[0, 1, 2, 3, 4].map(level => (
            <div key={level} className={cn('w-2.5 h-2.5 rounded-[2px]', LEVEL_CLASSES[level])} />
          ))}
          More
        </span>
      </div>
      {/* Grid */}
      <div className="flex gap-[3px] overflow-hidden rounded-lg bg-card p-2">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] pr-1">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="w-3 h-3 flex items-center justify-center text-[8px] text-muted-foreground">
              {label}
            </div>
          ))}
        </div>
        {/* Weeks */}
        {columns.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((cell, di) => (
              <div
                key={di}
                className={cn('w-3 h-3 rounded-[2px] transition-colors', LEVEL_CLASSES[cell.level])}
                title={`${cell.date}: ${cell.level > 0 ? 'Active' : 'No activity'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
})
