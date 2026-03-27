import { Check, Play, Lock } from 'lucide-react'
import { cn } from '@/app/components/ui/utils'

interface TrailMapProps {
  /** Total number of courses in the path */
  totalCourses: number
  /** Number of completed courses */
  completedCount: number
  /** Index of the current in-progress course (0-based), or -1 if none */
  currentIndex: number
  /** Additional className */
  className?: string
}

/**
 * Winding SVG trail map showing learning journey progress.
 * Renders a bezier curve path with waypoint markers for each course.
 *
 * Visual states:
 * - Completed: filled brand circle with check icon
 * - Current: larger pulsing circle with play icon + "CURRENT" label
 * - Upcoming: outlined muted circle with lock icon
 */
export function TrailMap({
  totalCourses,
  completedCount,
  currentIndex,
  className,
}: TrailMapProps) {
  if (totalCourses === 0) return null

  // Calculate waypoint X positions (evenly spaced)
  const padding = 40
  const viewWidth = 1200
  const viewHeight = 200
  const usableWidth = viewWidth - padding * 2

  const waypoints = Array.from({ length: totalCourses }, (_, i) => {
    const x = padding + (i / Math.max(totalCourses - 1, 1)) * usableWidth
    // Create a gentle wave pattern for Y positions
    const wave = Math.sin((i / Math.max(totalCourses - 1, 1)) * Math.PI * 2) * 40
    const y = viewHeight / 2 + wave
    return { x, y }
  })

  // Build the SVG path through waypoints using smooth curves
  const buildPath = () => {
    if (waypoints.length < 2) return ''
    let d = `M${waypoints[0].x} ${waypoints[0].y}`
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1]
      const curr = waypoints[i]
      const cpx = (prev.x + curr.x) / 2
      d += ` C${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`
    }
    return d
  }

  // Build partial path (for the completed segment)
  const buildPartialPath = (endIndex: number) => {
    if (endIndex < 1 || waypoints.length < 2) return ''
    const clampedEnd = Math.min(endIndex, waypoints.length - 1)
    let d = `M${waypoints[0].x} ${waypoints[0].y}`
    for (let i = 1; i <= clampedEnd; i++) {
      const prev = waypoints[i - 1]
      const curr = waypoints[i]
      const cpx = (prev.x + curr.x) / 2
      d += ` C${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`
    }
    return d
  }

  const fullPath = buildPath()
  const completedPath = buildPartialPath(currentIndex >= 0 ? currentIndex : completedCount)

  return (
    <div className={cn('relative w-full', className)} style={{ height: viewHeight + 40 }}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${viewWidth} ${viewHeight + 40}`}
        fill="none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background trail (dashed) */}
        <path
          d={fullPath}
          stroke="var(--muted)"
          strokeWidth="4"
          strokeDasharray="12 8"
          fill="none"
          transform="translate(0, 20)"
        />
        {/* Completed segment */}
        {completedPath && (
          <path
            d={completedPath}
            stroke="var(--brand)"
            strokeWidth="4"
            strokeDasharray="12 8"
            fill="none"
            transform="translate(0, 20)"
          />
        )}

        {/* Waypoint markers */}
        {waypoints.map((wp, i) => {
          const isCompleted = i < completedCount
          const isCurrent = i === currentIndex
          const isUpcoming = !isCompleted && !isCurrent

          const cy = wp.y + 20

          if (isCurrent) {
            return (
              <g key={i}>
                {/* Pulsing ring */}
                <circle
                  cx={wp.x}
                  cy={cy}
                  r="22"
                  fill="var(--brand)"
                  opacity="0.15"
                >
                  <animate
                    attributeName="r"
                    values="22;28;22"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.15;0.05;0.15"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                {/* Main circle */}
                <circle
                  cx={wp.x}
                  cy={cy}
                  r="18"
                  fill="var(--card)"
                  stroke="var(--brand)"
                  strokeWidth="4"
                />
              </g>
            )
          }

          return (
            <circle
              key={i}
              cx={wp.x}
              cy={cy}
              r="14"
              fill={isCompleted ? 'var(--brand)' : 'var(--card)'}
              stroke={isCompleted ? 'var(--brand)' : 'var(--muted)'}
              strokeWidth={isUpcoming ? 2 : 0}
            />
          )
        })}
      </svg>

      {/* HTML overlay for icons (better rendering than SVG foreignObject) */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {waypoints.map((wp, i) => {
          const isCompleted = i < completedCount
          const isCurrent = i === currentIndex
          const isUpcoming = !isCompleted && !isCurrent

          // Convert SVG coordinates to percentage positions
          const leftPct = (wp.x / viewWidth) * 100
          const topPct = ((wp.y + 20) / (viewHeight + 40)) * 100

          if (isCurrent) {
            return (
              <div
                key={i}
                className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              >
                <div className="size-9 rounded-full flex items-center justify-center">
                  <Play className="size-4 text-brand fill-brand" aria-hidden="true" />
                </div>
                <span className="mt-1 text-[10px] font-black bg-brand text-brand-foreground px-2 py-0.5 rounded-full tracking-tighter">
                  CURRENT
                </span>
              </div>
            )
          }

          return (
            <div
              key={i}
              className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            >
              {isCompleted ? (
                <Check className="size-4 text-brand-foreground" aria-hidden="true" />
              ) : isUpcoming ? (
                <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
