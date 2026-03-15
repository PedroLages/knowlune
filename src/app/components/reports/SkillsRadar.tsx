import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts'
import type { SkillDimension } from '@/lib/reportStats'

const chartConfig = {
  value: {
    label: 'Score',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

interface SkillsRadarProps {
  data: SkillDimension[]
}

export function SkillsRadar({ data }: SkillsRadarProps) {
  if (data.length === 0) return null

  return (
    <div role="img" aria-label={`Learning profile: ${data.map(d => `${d.dimension} ${d.value}%`).join(', ')}`}>
    <ChartContainer config={chartConfig} className="mx-auto h-[280px] w-full min-h-[1px]" aria-hidden="true">
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid
          gridType="polygon"
          stroke="var(--border)"
          strokeOpacity={0.5}
        />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={false}
          axisLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => [`${value}%`, 'Score']}
            />
          }
        />
        <Radar
          name="Your Skills"
          dataKey="value"
          stroke="var(--color-value)"
          fill="var(--color-value)"
          fillOpacity={0.2}
          strokeWidth={2}
          dot={{
            r: 4,
            fill: 'var(--color-value)',
            strokeWidth: 0,
          }}
          activeDot={{
            r: 6,
            fill: 'var(--color-value)',
            stroke: 'var(--background)',
            strokeWidth: 2,
          }}
        />
      </RadarChart>
    </ChartContainer>
    </div>
  )
}
