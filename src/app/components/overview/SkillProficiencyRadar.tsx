import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/app/components/ui/chart'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart } from 'recharts'
import type { SkillProficiencyData } from '@/lib/reportStats'

const chartConfig = {
  proficiency: {
    label: 'Proficiency',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig

interface SkillProficiencyRadarProps {
  data: SkillProficiencyData[]
}

export function SkillProficiencyRadar({ data }: SkillProficiencyRadarProps) {
  if (data.length === 0) return null

  return (
    <div
      role="img"
      aria-label={`Skill proficiency: ${data.map(d => `${d.domain} ${d.proficiency}%`).join(', ')}`}
    >
      <ChartContainer
        config={chartConfig}
        className="mx-auto h-[280px] w-full min-h-[1px]"
        aria-hidden="true"
      >
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid gridType="polygon" stroke="var(--border)" strokeOpacity={0.5} />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
          />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
          <ChartTooltip
            content={<ChartTooltipContent formatter={value => [`${value}%`, 'Proficiency']} />}
          />
          <Radar
            name="Skill Proficiency"
            dataKey="proficiency"
            stroke="var(--color-proficiency)"
            fill="var(--color-proficiency)"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: 'var(--color-proficiency)',
              strokeWidth: 0,
            }}
            activeDot={{
              r: 6,
              fill: 'var(--color-proficiency)',
              stroke: 'var(--background)',
              strokeWidth: 2,
            }}
          />
        </RadarChart>
      </ChartContainer>
    </div>
  )
}
