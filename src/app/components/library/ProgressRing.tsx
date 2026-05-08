/**
 * SVG circular progress ring with customizable center content.
 *
 * Used for yearly reading goal display. Accepts children for
 * flexible center text (e.g., "12 / 24 books").
 *
 * Padding is added around the SVG so strokeLinecap="round" arcs are not
 * clipped by overflow:hidden ancestors.
 *
 * @since Library Redesign
 */

import { memo, useMemo } from 'react'
import { cn } from '@/app/components/ui/utils'

interface ProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  className?: string
  children?: React.ReactNode
}

export const ProgressRing = memo(function ProgressRing({
  percent,
  size = 160,
  strokeWidth = 8,
  className,
  children,
}: ProgressRingProps) {
  const { svgDim, cx, cy, radius, circumference, offset } = useMemo(() => {
    const pad = strokeWidth
    const dim = size + pad * 2
    const c = dim / 2
    const r = (size - strokeWidth) / 2
    const circ = 2 * Math.PI * r
    const off = circ - (Math.min(percent, 100) / 100) * circ
    return { svgDim: dim, cx: c, cy: c, radius: r, circumference: circ, offset: off }
  }, [percent, size, strokeWidth])

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: svgDim, height: svgDim }}
      role="img"
      aria-label={`${Math.round(percent)}% complete`}
    >
      <svg
        width={svgDim}
        height={svgDim}
        viewBox={`0 0 ${svgDim} ${svgDim}`}
        className="-rotate-90 overflow-visible"
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={percent >= 100 ? 'text-success' : 'text-brand'}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      {/* Center content */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
})
