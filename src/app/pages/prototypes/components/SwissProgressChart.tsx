import { format } from 'date-fns'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface SwissProgressChartProps {
  data: { date: string; count: number }[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null

  return (
    <div className="border border-neutral-200 bg-white px-3 py-2">
      <p className="text-xs text-neutral-500">{format(new Date(label), 'MMM dd')}</p>
      <p className="text-xs font-bold text-black">{payload[0].value} actions</p>
    </div>
  )
}

export function SwissProgressChart({ data }: SwissProgressChartProps) {
  const formatted = data.map(d => ({
    ...d,
    label: format(new Date(d.date), 'MMM dd'),
  }))

  return (
    <div>
      {/* Horizontal rule */}
      <hr className="border-t border-neutral-200 mb-6" />

      {/* Title */}
      <h3 className="text-lg font-bold text-black mb-1">Study Activity</h3>
      <p className="text-sm text-neutral-500 mb-6">Daily actions over the last 30 days</p>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={256}>
        <LineChart data={formatted}>
          <CartesianGrid stroke="#e5e5e5" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            stroke="#a3a3a3"
            tickLine={false}
            axisLine={{ stroke: '#a3a3a3' }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#a3a3a3"
            tickLine={false}
            axisLine={{ stroke: '#a3a3a3' }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#DC2626"
            strokeWidth={2}
            dot={{ r: 3, fill: '#DC2626', stroke: '#DC2626' }}
            activeDot={{ r: 3, fill: '#DC2626', stroke: '#DC2626' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
