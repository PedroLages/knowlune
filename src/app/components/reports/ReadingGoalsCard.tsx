/**
 * ReadingGoalsCard — reading goal stats for the Reports page.
 *
 * Shows: current daily goal streak, longest streak, yearly progress,
 * and a monthly bar chart of books finished vs expected pace.
 *
 * Returns null when no reading goal is set.
 *
 * @module ReadingGoalsCard
 */
import { useMemo } from 'react'
import { Target, Flame } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card, CardContent, CardHeader } from '@/app/components/ui/card'
import { useReadingGoalStore } from '@/stores/useReadingGoalStore'
import { useBookStore } from '@/stores/useBookStore'
import { ChartContainer, ChartTooltipContent } from '@/app/components/ui/chart'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface MonthDataPoint {
  month: string
  finished: number
  pace: number
}

export function ReadingGoalsCard() {
  const goal = useReadingGoalStore(s => s.goal)
  const streak = useReadingGoalStore(s => s.streak)
  const books = useBookStore(s => s.books)

  const monthlyData = useMemo((): MonthDataPoint[] => {
    if (!goal) return []

    const currentYear = new Date().getFullYear()
    const monthlyRate = goal.yearlyBookTarget / 12

    // Count finished books per month
    const finishedByMonth = Array<number>(12).fill(0)
    for (const book of books) {
      if (book.status === 'finished' && book.finishedAt) {
        const d = new Date(book.finishedAt)
        if (d.getFullYear() === currentYear) {
          finishedByMonth[d.getMonth()]++
        }
      }
    }

    return MONTH_LABELS.map((month, i) => ({
      month,
      finished: finishedByMonth[i],
      pace: Math.round(monthlyRate * 10) / 10,
    }))
  }, [goal, books])

  if (!goal) return null

  const currentYear = new Date().getFullYear()
  const finishedThisYear = books.filter(
    b => b.status === 'finished' && b.finishedAt?.startsWith(currentYear.toString())
  ).length

  const chartConfig = {
    finished: { label: 'Books Finished', color: 'hsl(var(--brand))' },
  }

  return (
    <Card>
      <CardHeader className="border-b border-border/50 bg-surface-sunken/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-brand-soft p-2">
            <Target className="size-5 text-brand" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-display">Reading Goals</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Daily reading streaks and yearly progress
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Streak stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-1 rounded-xl bg-brand-soft p-3">
            <Flame className="size-5 text-brand-soft-foreground" aria-hidden="true" />
            <span className="text-2xl font-bold text-brand-soft-foreground">
              {streak.currentStreak}
            </span>
            <span className="text-xs text-brand-soft-foreground text-center">Current Streak</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/30 p-3">
            <Flame className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-2xl font-bold">{streak.longestStreak}</span>
            <span className="text-xs text-muted-foreground text-center">Longest Streak</span>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/30 p-3">
            <Target className="size-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-2xl font-bold">{finishedThisYear}</span>
            <span className="text-xs text-muted-foreground text-center">Books This Year</span>
          </div>
        </div>

        {/* Monthly books chart */}
        <div>
          <h3 className="text-sm font-medium mb-3">
            Books Finished per Month ({currentYear})
          </h3>
          <ChartContainer config={chartConfig} className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltipContent />} />
                <ReferenceLine
                  y={goal.yearlyBookTarget / 12}
                  stroke="hsl(var(--muted-foreground))"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: 'Pace', fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Bar
                  dataKey="finished"
                  fill="hsl(var(--brand))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
