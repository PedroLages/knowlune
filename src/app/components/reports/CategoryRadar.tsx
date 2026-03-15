import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import type { CategoryRadarData } from '@/lib/reportStats'

const chartConfig = {
  completion: {
    label: 'Avg Completion',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig

interface CategoryRadarProps {
  data: CategoryRadarData[]
}

export function CategoryRadar({ data }: CategoryRadarProps) {
  if (data.length === 0) return null

  return (
    <div
      role="img"
      aria-label={`Category progress: ${data.map(d => `${d.category} ${d.completion}%`).join(', ')}`}
    >
      <ChartContainer
        config={chartConfig}
        className="mx-auto h-[280px] w-full min-h-[1px]"
        aria-hidden="true"
      >
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid gridType="polygon" stroke="var(--border)" strokeOpacity={0.5} />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            tickLine={false}
          />
          <ChartTooltip
            content={<ChartTooltipContent formatter={value => [`${value}%`, 'Avg Completion']} />}
          />
          <Radar
            name="Completion"
            dataKey="completion"
            stroke="var(--color-completion)"
            fill="var(--color-completion)"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: 'var(--color-completion)',
              strokeWidth: 0,
            }}
            activeDot={{
              r: 6,
              fill: 'var(--color-completion)',
              stroke: 'var(--background)',
              strokeWidth: 2,
            }}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  )
}
