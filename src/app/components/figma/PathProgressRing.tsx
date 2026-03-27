import { cn } from '@/app/components/ui/utils'

const SIZES = {
  sm: { size: 48, stroke: 3, fontSize: 'text-[10px]' },
  md: { size: 72, stroke: 3, fontSize: 'text-xs' },
  lg: { size: 96, stroke: 4, fontSize: 'text-lg' },
} as const

interface PathProgressRingProps {
  /** Completion percentage 0-100 */
  percentage: number
  /** Ring size preset */
  size?: keyof typeof SIZES
  /** Additional className for the container */
  className?: string
  /** Override the center content (defaults to percentage text) */
  children?: React.ReactNode
}

/**
 * SVG circular progress ring for learning path cards.
 * Uses stroke-dasharray/dashoffset for the fill animation.
 */
export function PathProgressRing({
  percentage,
  size = 'md',
  className,
  children,
}: PathProgressRingProps) {
  const config = SIZES[size]
  const radius = (config.size - config.stroke * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference

  const isCompleted = percentage >= 100

  // Pick stroke color based on status
  const strokeClass = isCompleted
    ? 'stroke-success'
    : percentage > 0
      ? 'stroke-brand'
      : 'stroke-muted-foreground/30'

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: config.size, height: config.size }}
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(percentage)}% completed`}
    >
      <svg
        className="w-full h-full -rotate-90"
        viewBox={`0 0 ${config.size} ${config.size}`}
        fill="none"
      >
        {/* Background track */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          strokeWidth={config.stroke}
          className="stroke-muted"
        />
        {/* Progress arc */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          strokeWidth={config.stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(strokeClass, 'transition-[stroke-dashoffset] duration-500')}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children ?? (
          <span className={cn('font-bold text-foreground', config.fontSize)}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  )
}
