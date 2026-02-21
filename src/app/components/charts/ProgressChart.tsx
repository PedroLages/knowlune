import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'

interface ProgressChartProps {
  data: { date: string; count: number }[]
}

export function ProgressChart({ data }: ProgressChartProps) {
  // Transform data to include formatted dates
  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    activities: item.count,
    fullDate: item.date, // Keep for tooltip
  }))

  // Chart configuration for shadcn/ui theming
  const chartConfig = {
    activities: {
      label: 'Activities',
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  // Return null if no data
  if (data.length === 0) {
    return null
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Learning Activity</CardTitle>
        <CardDescription>Your study activity over the last {data.length} days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value, payload) => {
                    // Show full date in tooltip
                    if (payload && payload[0]?.payload?.fullDate) {
                      return format(new Date(payload[0].payload.fullDate), 'MMMM dd, yyyy')
                    }
                    return value
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="activities"
              stroke="var(--color-activities)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
