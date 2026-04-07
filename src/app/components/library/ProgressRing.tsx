/**
 * SVG circular progress ring with customizable center content.
 *
 * Used for yearly reading goal display. Accepts children for
 * flexible center text (e.g., "12 / 24 books").
 *
 * @since Library Redesign
 */

import { memo } from 'react'
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
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      role="img"
      aria-label={`${Math.round(percent)}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
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
