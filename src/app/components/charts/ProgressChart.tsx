import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'

interface ProgressChartProps {
  data: { date: string; count: number }[]
}

export function ProgressChart({ data }: ProgressChartProps) {
  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    activities: item.count,
    fullDate: item.date,
  }))

  const chartConfig = {
    activities: {
      label: 'Activities',
      color: 'var(--brand)',
    },
  } satisfies ChartConfig

  if (data.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Activity</CardTitle>
        <CardDescription>Your study activity over the last {data.length} days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value, payload) => {
                    const fullDate = payload?.[0]?.payload?.fullDate
                    if (typeof fullDate === 'string' || typeof fullDate === 'number') {
                      return format(new Date(fullDate), 'MMMM dd, yyyy')
                    }
                    return value
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="activities"
              fill="url(#activityGradient)"
              stroke="var(--color-activities)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: 'var(--brand)', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
