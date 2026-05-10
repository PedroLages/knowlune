import { useState, useEffect, useMemo, useCallback } from 'react'
import { Route, AlertCircle, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'
import { Skeleton } from '@/app/components/ui/skeleton'
import { Button } from '@/app/components/ui/button'
import { db } from '@/db'
import { useLearningPathStore } from '@/stores/useLearningPathStore'
import { useMultiPathProgress } from '@/app/hooks/usePathProgress'
import { toast } from 'sonner'
import type { DateRange } from './DateRangeFilter'

// ── Chart configs ──

const stackedBarConfig = {
  '0-25': { label: '0–25%', color: 'var(--chart-1)' },
  '25-50': { label: '25–50%', color: 'var(--chart-2)' },
  '50-75': { label: '50–75%', color: 'var(--chart-3)' },
  '75-100': { label: '75–100%', color: 'var(--chart-4)' },
} satisfies ChartConfig

const cumulativeHoursConfig = {
  hours: {
    label: 'Cumulative Hours',
    color: 'var(--brand)',
  },
} satisfies ChartConfig

// ── Helpers ──

interface PathRow {
  pathId: string
  pathName: string
  completionPct: number
  completedCourses: number
  totalCourses: number
  hoursSpent: number
  estimatedRemainingHours: number
  lastActivityDate: string | null
}

interface Props {
  dateRange: DateRange
}

/**
 * Learning Paths analytics tab for Reports.
 * Shows stacked bar chart (completion distribution), cumulative hours
 * line chart (filterable by date range), and a sortable stats table.
 */
export function PathAnalyticsTab({ dateRange }: Props) {
  const { paths, entries, loadPaths } = useLearningPathStore()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [pathRows, setPathRows] = useState<PathRow[]>([])

  // Load paths if not already loaded
  useEffect(() => {
    let ignore = false
    loadPaths()
      .then(() => {
        if (!ignore) setIsLoading(false)
      })
      .catch(() => {
        if (!ignore) {
          setError('Failed to load learning paths.')
          setIsLoading(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [loadPaths, retryCount])

  // Build pathId -> entries map for multi-path progress
  const pathEntriesMap = useMemo(() => {
    const map = new Map<string, typeof entries>()
    for (const path of paths) {
      map.set(
        path.id,
        entries.filter(e => e.pathId === path.id)
      )
    }
    return map
  }, [paths, entries])

  // Get progress for all paths
  const progressMap = useMultiPathProgress(pathEntriesMap)

  // Collect courseIds per path for study session filtering
  const pathCourseIds = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const path of paths) {
      map.set(
        path.id,
        entries.filter(e => e.pathId === path.id && e.courseId !== '').map(e => e.courseId)
      )
    }
    return map
  }, [paths, entries])

  // Compute path rows with session data (parallelized per-path queries)
  const computePathRows = useCallback(async () => {
    try {
      const rows = await Promise.all(
        paths.map(async path => {
          const progress = progressMap.get(path.id)
          const courseIds = pathCourseIds.get(path.id) ?? []

          let hoursSpent = 0
          let lastActivityDate: string | null = null

          // Query study sessions for courses in this path
          if (courseIds.length > 0) {
            let query = db.studySessions.where('courseId').anyOf(courseIds)

            // Apply date range filter for sessions
            if (dateRange.from || dateRange.to) {
              query = query.filter(s => {
                const startTime = new Date(s.startTime).getTime()
                if (dateRange.from && startTime < dateRange.from.getTime()) return false
                if (dateRange.to && startTime > dateRange.to.getTime()) return false
                return true
              })
            }

            const sessions = await query.toArray()

            // Sum active duration (seconds -> hours)
            hoursSpent =
              Math.round(
                (sessions.reduce((sum, s) => sum + s.duration, 0) / 3600) * 10
              ) / 10

            // Find last activity
            if (sessions.length > 0) {
              const timestamps = sessions.map(s => new Date(s.startTime).getTime())
              const latest = new Date(Math.max(...timestamps))
              lastActivityDate = latest.toISOString()
            }
          }

          return {
            pathId: path.id,
            pathName: path.name,
            completionPct: progress?.completionPct ?? 0,
            completedCourses: progress?.completedCourses ?? 0,
            totalCourses: progress?.totalCourses ?? 0,
            hoursSpent,
            estimatedRemainingHours: progress?.estimatedRemainingHours ?? 0,
            lastActivityDate,
          }
        })
      )

      setPathRows(rows)
    } catch (err) {
      console.error('[PathAnalyticsTab] Failed to compute path rows:', err)
      toast.error('Failed to load path analytics')
    }
  }, [paths, progressMap, pathCourseIds, dateRange])

  useEffect(() => {
    computePathRows()
  }, [computePathRows])

  // ── Stacked bar chart data ──
  const stackedBarData = useMemo(() => {
    const buckets = { '0-25': 0, '25-50': 0, '50-75': 0, '75-100': 0 }
    for (const row of pathRows) {
      if (row.completionPct < 25) buckets['0-25']++
      else if (row.completionPct < 50) buckets['25-50']++
      else if (row.completionPct < 75) buckets['50-75']++
      else buckets['75-100']++
    }
    return [buckets]
  }, [pathRows])

  // ── Cumulative hours line chart data ──
  const cumulativeHoursData = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return []
    // Simplified: aggregate hours per path as single data points
    return pathRows
      .filter(r => r.hoursSpent > 0)
      .map(r => ({
        name: r.pathName,
        hours: r.hoursSpent,
      }))
  }, [pathRows, dateRange])

  // ── Sort state for table ──
  const [sortKey, setSortKey] = useState<keyof PathRow>('completionPct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sortedRows = useMemo(() => {
    return [...pathRows].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (sortDir === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    })
  }, [pathRows, sortKey, sortDir])

  function toggleSort(key: keyof PathRow) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  // ── Empty / loading / error states ──
  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading path analytics">
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-[300px] w-full rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="size-10 text-destructive mb-3" aria-hidden="true" />
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={() => setRetryCount(c => c + 1)}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (paths.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Route className="size-10 text-muted-foreground/30 mb-3" aria-hidden="true" />
          <p className="text-muted-foreground">
            No learning paths yet.{' '}
            <Link to="/learning-tracks" className="text-brand underline hover:text-brand-hover">
              Create a learning path
            </Link>{' '}
            to see analytics here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stacked bar chart: completion distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Path Completion Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={stackedBarConfig} className="h-[200px] w-full" aria-label="Stacked bar chart showing path completion distribution across 0-25%, 25-50%, 50-75%, and 75-100% buckets" role="img">
            <BarChart data={stackedBarData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="0-25" stackId="a" fill="var(--color-0-25)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="25-50" stackId="a" fill="var(--color-25-50)" />
              <Bar dataKey="50-75" stackId="a" fill="var(--color-50-75)" />
              <Bar dataKey="75-100" stackId="a" fill="var(--color-75-100)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Cumulative hours line chart (filterable by date range) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" aria-hidden="true" />
            Study Hours per Path
            {(dateRange.from || dateRange.to) && (
              <span className="text-xs text-muted-foreground font-normal">
                (filtered by date range)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cumulativeHoursData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No study hours recorded{(dateRange.from || dateRange.to) ? ' in this date range' : ' yet'}.
            </p>
          ) : (
            <ChartContainer config={cumulativeHoursConfig} className="h-[250px] w-full" aria-label="Line chart showing study hours per learning path" role="img">
              <LineChart data={cumulativeHoursData}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip
                  content={<ChartTooltipContent labelFormatter={label => `${label}`} />}
                />
                <Line
                  type="monotone"
                  dataKey="hours"
                  stroke="var(--color-hours)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Stats table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Path Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <SortableTh
                    label="Path"
                    sortKey="pathName"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Completion"
                    sortKey="completionPct"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Courses"
                    sortKey="completedCourses"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Hours"
                    sortKey="hoursSpent"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Remaining"
                    sortKey="estimatedRemainingHours"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                  <SortableTh
                    label="Last Activity"
                    sortKey="lastActivityDate"
                    currentSort={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(row => (
                  <tr key={row.pathId} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <Link
                        to={`/learning-tracks/${row.pathId}`}
                        className="text-brand hover:text-brand-hover underline font-medium"
                      >
                        {row.pathName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{row.completionPct}%</td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {row.completedCourses}/{row.totalCourses}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{row.hoursSpent}h</td>
                    <td className="py-2.5 pr-4 tabular-nums">{row.estimatedRemainingHours}h</td>
                    <td className="py-2.5 tabular-nums text-xs text-muted-foreground">
                      {row.lastActivityDate
                        ? new Date(row.lastActivityDate).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No path data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SortableTh({
  label,
  sortKey,
  currentSort,
  sortDir,
  onSort,
}: {
  label: string
  sortKey: keyof PathRow
  currentSort: keyof PathRow
  sortDir: 'asc' | 'desc'
  onSort: (key: keyof PathRow) => void
}) {
  const ariaSort = currentSort === sortKey ? (sortDir === 'asc' ? 'ascending' as const : 'descending' as const) : 'none' as const
  return (
    <th className="py-2.5 pr-4 text-left" aria-sort={ariaSort}>
      <button
        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors flex items-center gap-1"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {currentSort === sortKey && (
          <span className="text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
        )}
      </button>
    </th>
  )
}
