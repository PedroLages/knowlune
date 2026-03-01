import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'

interface HybridProgressChartProps {
  data: { date: string; count: number }[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: { fullDate: string } }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const fullDate = payload[0]?.payload?.fullDate
  const displayDate = fullDate ? format(new Date(fullDate), 'MMMM dd, yyyy') : label

  return (
    <div className="rounded-lg bg-white shadow-md border border-neutral-100 px-3 py-2">
      <p className="text-xs font-medium text-neutral-900 mb-0.5">{displayDate}</p>
      <p className="text-xs text-neutral-500">
        {payload[0].value} {payload[0].value === 1 ? 'activity' : 'activities'}
      </p>
    </div>
  )
}

export function HybridProgressChart({ data }: HybridProgressChartProps) {
  if (data.length === 0) return null

  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    activities: item.count,
    fullDate: item.date,
  }))

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-6 mb-8">
      <h3 className="text-lg font-semibold text-neutral-900 mb-1">Learning Activity</h3>
      <p className="text-sm text-neutral-500 mb-4">
        Your study activity over the last {data.length} days
      </p>

      <ResponsiveContainer width="100%" height={256}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#a3a3a3"
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="activities"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#2563eb', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
