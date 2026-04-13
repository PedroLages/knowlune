/**
 * GenreDistributionCard — donut chart of book genre distribution.
 *
 * Shows genres from books in reading, finished, and want-to-read status.
 * Genres below 5% are grouped into "Other". Renders null when fewer than
 * 2 books have genres set.
 *
 * @module GenreDistributionCard
 * @since E112-S02
 */
import { useState, useEffect, useCallback } from 'react'
import { BookOpen } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { ChartContainer, type ChartConfig } from '@/app/components/ui/chart'
import { Skeleton } from '@/app/components/ui/skeleton'
import { getGenreDistribution, type GenreDataPoint } from '@/services/ReadingStatsService'

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

const genreChartConfig = {
  count: { label: 'Books' },
} satisfies ChartConfig

export function GenreDistributionCard() {
  const [data, setData] = useState<GenreDataPoint[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getGenreDistribution()
      setData(result)
    } catch (err) {
      // silent-catch-ok: genre distribution is non-critical display data
      console.error('[GenreDistributionCard] Failed to load genre distribution:', err)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  if (isLoading) {
    return <Skeleton className="h-48 rounded-xl" />
  }

  if (!data || data.length === 0) return null

  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <Card data-testid="genre-distribution-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
          Genre Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ChartContainer config={genreChartConfig} className="h-[160px] w-[160px] shrink-0">
            <PieChart aria-label="Genre distribution chart">
              <Pie
                data={data}
                dataKey="count"
                nameKey="genre"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number, name: string) => [
                  `${value} ${value === 1 ? 'book' : 'books'}`,
                  name,
                ]) as any}
              />
            </PieChart>
          </ChartContainer>

          {/* Legend */}
          <ul className="flex-1 space-y-1.5 min-w-0" aria-label="Genre list">
            {data.map(({ genre, count }, i) => (
              <li key={genre} className="flex items-center gap-2 text-sm">
                <span
                  className="size-3 rounded-sm shrink-0"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  aria-hidden="true"
                />
                <span className="truncate text-foreground">{genre}</span>
                <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
                  {count} ({Math.round((count / total) * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
